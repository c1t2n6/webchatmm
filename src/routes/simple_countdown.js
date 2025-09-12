// Simple Countdown Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Initialize models
let userModel, roomModel, connectionManager;

// ✅ THÊM: Countdown state management
const countdownStates = new Map(); // roomId -> countdown state
const notificationStates = new Map(); // roomId -> notification state

const initModels = (db, connManager) => {
  const User = require('../models/User');
  const Room = require('../models/Room');
  
  userModel = new User(db);
  roomModel = new Room(db);
  connectionManager = connManager;
};

// Get countdown status for a room
router.get('/status/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUser = req.user;

    console.log(`⏰ Getting countdown status for room ${roomId}, user ${currentUser.id}`);

    // Check if user has access to this room
    const room = await roomModel.findById(roomId);
    if (!room) {
      return res.status(404).json({
        error: 'Not found',
        detail: 'Room not found'
      });
    }

    // Check if user is in this room
    if (room.user1_id !== currentUser.id && room.user2_id !== currentUser.id) {
      return res.status(403).json({
        error: 'Forbidden',
        detail: 'You do not have access to this room'
      });
    }

    // Check if room is ended
    if (room.end_time) {
      return res.json({
        phase: 'ended',
        room_ended: true,
        end_time: room.end_time
      });
    }

    // ✅ SỬA: Return actual countdown/notification state
    const countdownState = countdownStates.get(roomId);
    const notificationState = notificationStates.get(roomId);

    if (notificationState && notificationState.active) {
      return res.json({
        phase: 'notification',
        notification_remaining: notificationState.remaining,
        room_id: parseInt(roomId),
        active: true,
        users_to_notify: notificationState.users_to_notify || []
      });
    } else if (countdownState && countdownState.active) {
      return res.json({
        phase: 'countdown',
        countdown_remaining: countdownState.remaining,
        room_id: parseInt(roomId),
        active: true
      });
    } else {
      return res.json({
        phase: 'idle',
        room_id: parseInt(roomId),
        active: false
      });
    }

  } catch (error) {
    console.error('❌ Error getting countdown status:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Failed to get countdown status: ' + error.message
    });
  }
});

// Start countdown for a room
router.post('/start/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { duration = 15 } = req.body;
    const currentUser = req.user;

    console.log(`⏰ Starting countdown for room ${roomId}, duration: ${duration}s`);

    // Check if user has access to this room
    const room = await roomModel.findById(roomId);
    if (!room) {
      return res.status(404).json({
        error: 'Not found',
        detail: 'Room not found'
      });
    }

    // Check if user is in this room
    if (room.user1_id !== currentUser.id && room.user2_id !== currentUser.id) {
      return res.status(403).json({
        error: 'Forbidden',
        detail: 'You do not have access to this room'
      });
    }

    // Check if room is ended
    if (room.end_time) {
      return res.status(400).json({
        error: 'Room ended',
        detail: 'Room has already ended'
      });
    }

    // ✅ SỬA: Check if both users are connected before starting countdown
    const roomIdInt = parseInt(roomId);
    if (connectionManager && connectionManager.roomConnections.has(roomIdInt)) {
      const usersInRoom = Array.from(connectionManager.roomConnections.get(roomIdInt));
      console.log(`⏰ Users in room ${roomId} (${roomIdInt}):`, usersInRoom);
      
      if (usersInRoom.length < 2) {
        console.log(`⏰ Not enough users connected (${usersInRoom.length}/2), delaying countdown start`);
        // Delay countdown start until both users are connected
        setTimeout(() => {
          startCountdownTimer(roomId, duration);
        }, 2000);
      } else {
        // Both users are connected, start countdown immediately
        startCountdownTimer(roomId, duration);
      }
    } else {
      console.log(`⏰ Room ${roomId} (${roomIdInt}) not found in roomConnections, delaying countdown start`);
      console.log(`⏰ Available rooms:`, Array.from(connectionManager.roomConnections.keys()));
      // Delay countdown start until room is properly set up
      setTimeout(() => {
        startCountdownTimer(roomId, duration);
      }, 2000);
    }

    res.json({
      success: true,
      message: 'Countdown started',
      duration: duration,
      room_id: parseInt(roomId)
    });

  } catch (error) {
    console.error('❌ Error starting countdown:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Failed to start countdown: ' + error.message
    });
  }
});

// ✅ THÊM: Response to notification
router.post('/response/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { response } = req.body; // "yes" or "no"
    const currentUser = req.user;

    console.log(`⏰ User ${currentUser.id} responded ${response} to room ${roomId}`);

    // Check if user has access to this room
    const room = await roomModel.findById(roomId);
    if (!room) {
      return res.status(404).json({
        error: 'Not found',
        detail: 'Room not found'
      });
    }

    // Check if user is in this room
    if (room.user1_id !== currentUser.id && room.user2_id !== currentUser.id) {
      return res.status(403).json({
        error: 'Forbidden',
        detail: 'You do not have access to this room'
      });
    }

    // Check if room is in notification phase
    const notificationState = notificationStates.get(roomId);
    if (!notificationState || !notificationState.active) {
      return res.status(400).json({
        error: 'Not in notification phase',
        detail: 'Room is not in notification phase'
      });
    }

    // Record user response
    if (!notificationState.responses) {
      notificationState.responses = new Map();
    }
    notificationState.responses.set(currentUser.id, response);

    console.log(`⏰ User ${currentUser.id} response recorded: ${response}`);

    if (response === 'no') {
      // User wants to end - end the room immediately
      console.log(`⏰ User ${currentUser.id} wants to end, closing room ${roomId} immediately`);
      
      // End the room
      await roomModel.endRoom(roomId);
      
      // Clear states
      countdownStates.delete(roomId);
      notificationStates.delete(roomId);
      
      // Broadcast room ended message
      if (connectionManager) {
        await connectionManager.broadcastToRoom({
          type: 'room_ended',
          message: 'Cuộc trò chuyện đã kết thúc.',
          room_id: parseInt(roomId)
        }, parseInt(roomId));
      }

      res.json({
        room_ended: true,
        message: 'Cuộc trò chuyện đã kết thúc.'
      });
    } else {
      // User wants to continue - check if both users have responded
      const otherUserId = room.user1_id === currentUser.id ? room.user2_id : room.user1_id;
      const otherUserResponse = notificationState.responses.get(otherUserId);

      if (otherUserResponse) {
        // Both users have responded
        if (otherUserResponse === 'yes') {
          // Both want to continue - keep room active
          console.log(`⏰ Both users want to continue, keeping room ${roomId} active`);
          
          // Clear notification state
          notificationStates.delete(roomId);
          
          // Broadcast room kept message
          if (connectionManager) {
            await connectionManager.broadcastToRoom({
              type: 'room_kept',
              message: 'Cả hai người đã đồng ý tiếp tục cuộc trò chuyện!',
              room_id: parseInt(roomId)
            }, parseInt(roomId));
          }

          res.json({
            room_kept: true,
            message: 'Cả hai người đã đồng ý tiếp tục cuộc trò chuyện!'
          });
        } else {
          // Other user wants to end - end the room
          console.log(`⏰ Other user wants to end, closing room ${roomId}`);
          
          // End the room
          await roomModel.endRoom(roomId);
          
          // Clear states
          countdownStates.delete(roomId);
          notificationStates.delete(roomId);
          
          // Broadcast room ended message
          if (connectionManager) {
            await connectionManager.broadcastToRoom({
              type: 'room_ended',
              message: 'Cuộc trò chuyện đã kết thúc.',
              room_id: parseInt(roomId)
            }, parseInt(roomId));
          }

          res.json({
            room_ended: true,
            message: 'Cuộc trò chuyện đã kết thúc.'
          });
        }
      } else {
        // Waiting for other user
        console.log(`⏰ Waiting for other user ${otherUserId} to respond`);
        
        res.json({
          waiting_for_other: true,
          message: 'Đang chờ người kia phản hồi...'
        });
      }
    }

  } catch (error) {
    console.error('❌ Error handling response:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Failed to handle response: ' + error.message
    });
  }
});

// ✅ THÊM: Helper functions
function startCountdownTimer(roomId, duration) {
  console.log(`⏰ Starting countdown timer for room ${roomId}, duration: ${duration}s`);
  
  // Set countdown state
  countdownStates.set(roomId, {
    active: true,
    remaining: duration,
    startTime: Date.now()
  });

  // Broadcast countdown start
  if (connectionManager) {
    const roomIdInt = parseInt(roomId);
    console.log(`⏰ Broadcasting countdown_start to room ${roomId} (${roomIdInt})`);
    console.log(`⏰ ConnectionManager roomConnections:`, connectionManager.roomConnections);
    console.log(`⏰ Room ${roomId} (${roomIdInt}) exists:`, connectionManager.roomConnections.has(roomIdInt));
    
    connectionManager.broadcastToRoom({
      type: 'countdown_start',
      room_id: roomIdInt,
      duration: duration
    }, roomIdInt);
  } else {
    console.log(`⚠️ No ConnectionManager available for countdown broadcast`);
  }

  // Start countdown interval
  const countdownInterval = setInterval(async () => {
    const state = countdownStates.get(roomId);
    if (!state || !state.active) {
      clearInterval(countdownInterval);
      return;
    }

    state.remaining--;
    
    // Broadcast countdown update
    if (connectionManager) {
      connectionManager.broadcastToRoom({
        type: 'countdown_update',
        room_id: parseInt(roomId),
        remaining: state.remaining
      }, parseInt(roomId));
    }

    if (state.remaining <= 0) {
      // Countdown finished, start notification phase
      clearInterval(countdownInterval);
      countdownStates.delete(roomId);
      startNotificationPhase(roomId);
    }
  }, 1000);
}

function startNotificationPhase(roomId) {
  console.log(`⏰ Starting notification phase for room ${roomId}`);
  
  // Set notification state
  notificationStates.set(roomId, {
    active: true,
    remaining: 30, // 30 seconds to respond
    users_to_notify: [roomId] // Will be populated with actual user IDs
  });

  // Get room users
  roomModel.findById(roomId).then(room => {
    if (room) {
      const usersToNotify = [room.user1_id, room.user2_id];
      notificationStates.get(roomId).users_to_notify = usersToNotify;
      
      // Broadcast notification show
      if (connectionManager) {
        connectionManager.broadcastToRoom({
          type: 'notification_show',
          room_id: parseInt(roomId),
          message: 'Bạn có muốn tiếp tục cuộc trò chuyện với người này không?',
          timeout: 30,
          users_to_notify: usersToNotify
        }, parseInt(roomId));
      }
    }
  });

  // Start notification countdown
  const notificationInterval = setInterval(async () => {
    const state = notificationStates.get(roomId);
    if (!state || !state.active) {
      clearInterval(notificationInterval);
      return;
    }

    state.remaining--;
    
    // Broadcast notification update
    if (connectionManager) {
      connectionManager.broadcastToRoom({
        type: 'notification_update',
        room_id: parseInt(roomId),
        remaining: state.remaining
      }, parseInt(roomId));
    }

    if (state.remaining <= 0) {
      // Notification timeout, end room
      clearInterval(notificationInterval);
      notificationStates.delete(roomId);
      
      console.log(`⏰ Notification timeout for room ${roomId}, ending room`);
      
      // End the room
      roomModel.endRoom(roomId).then(() => {
        // Broadcast room ended
        if (connectionManager) {
          connectionManager.broadcastToRoom({
            type: 'room_ended',
            message: 'Hết thời gian phản hồi. Cuộc trò chuyện đã kết thúc.',
            room_id: parseInt(roomId)
          }, parseInt(roomId));
        }
      });
    }
  }, 1000);
}

module.exports = { router, initModels };
