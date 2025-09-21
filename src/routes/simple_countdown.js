// Simple Countdown Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Initialize models
let userModel, roomModel, connectionManager;

// ✅ THÊM: Countdown state management với tối ưu hóa
const countdownStates = new Map(); // roomId -> countdown state
const notificationStates = new Map(); // roomId -> notification state
const userResponses = new Map(); // roomId -> Map<userId, response>

// ✅ THÊM: Cleanup expired states
const cleanupExpiredStates = () => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [roomId, state] of countdownStates.entries()) {
    if (now - state.startTime > maxAge) {
      countdownStates.delete(roomId);
      console.log(`🧹 Cleaned up expired countdown state for room ${roomId}`);
    }
  }
  
  for (const [roomId, state] of notificationStates.entries()) {
    if (now - state.startTime > maxAge) {
      notificationStates.delete(roomId);
      userResponses.delete(roomId);
      console.log(`🧹 Cleaned up expired notification state for room ${roomId}`);
    }
  }
};

// ✅ THÊM: Stop all timers for a specific room
const stopRoomTimers = (roomId) => {
  console.log(`🛑 Stopping all timers for room ${roomId}`);
  
  // Stop countdown state
  const countdownState = countdownStates.get(roomId);
  if (countdownState) {
    countdownState.active = false;
    countdownStates.delete(roomId);
    console.log(`🛑 Stopped countdown timer for room ${roomId}`);
  }
  
  // Stop notification state
  const notificationState = notificationStates.get(roomId);
  if (notificationState) {
    notificationState.active = false;
    notificationStates.delete(roomId);
    userResponses.delete(roomId);
    console.log(`🛑 Stopped notification timer for room ${roomId}`);
  }
};

// Cleanup every 2 minutes
setInterval(cleanupExpiredStates, 2 * 60 * 1000);

// ✅ THÊM: Xử lý user disconnect/reconnect
const handleUserDisconnect = (userId) => {
  console.log(`🔌 User ${userId} disconnected, checking active states...`);
  
  // Tìm các room có user này và đang trong countdown/notification
  for (const [roomId, state] of countdownStates.entries()) {
    if (state.active) {
      // Kiểm tra xem user có trong room này không
      roomModel.findById(roomId).then(room => {
        if (room && (room.user1_id === userId || room.user2_id === userId)) {
          console.log(`🔌 User ${userId} disconnected from room ${roomId} during countdown`);
          // Có thể pause countdown hoặc chờ reconnect
        }
      });
    }
  }
  
  for (const [roomId, state] of notificationStates.entries()) {
    if (state.active) {
      // Kiểm tra xem user có trong room này không
      roomModel.findById(roomId).then(room => {
        if (room && (room.user1_id === userId || room.user2_id === userId)) {
          console.log(`🔌 User ${userId} disconnected from room ${roomId} during notification`);
          // Có thể extend timeout hoặc chờ reconnect
        }
      });
    }
  }
};

const handleUserReconnect = (userId) => {
  console.log(`🔌 User ${userId} reconnected, syncing states...`);
  
  // Sync countdown/notification states cho user này
  for (const [roomId, state] of countdownStates.entries()) {
    if (state.active) {
      roomModel.findById(roomId).then(room => {
        if (room && (room.user1_id === userId || room.user2_id === userId)) {
          console.log(`🔌 Syncing countdown state for reconnected user ${userId} in room ${roomId}`);
          // Broadcast current state to reconnected user
          if (connectionManager) {
            connectionManager.broadcastToUser({
              type: 'countdown_start',
              room_id: parseInt(roomId),
              duration: state.remaining
            }, userId);
          }
        }
      });
    }
  }
  
  for (const [roomId, state] of notificationStates.entries()) {
    if (state.active) {
      roomModel.findById(roomId).then(room => {
        if (room && (room.user1_id === userId || room.user2_id === userId)) {
          console.log(`🔌 Syncing notification state for reconnected user ${userId} in room ${roomId}`);
          // Broadcast current notification state to reconnected user
          if (connectionManager) {
            connectionManager.broadcastToUser({
              type: 'notification_show',
              room_id: parseInt(roomId),
              message: 'Bạn có muốn tiếp tục cuộc trò chuyện không?',
              timeout: state.remaining,
              users_to_notify: state.users_to_notify || []
            }, userId);
          }
        }
      });
    }
  }
};

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
    const { duration = 300 } = req.body;
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

    // ✅ SỬA: Tối ưu hóa logic response với userResponses Map riêng
    let notificationState = notificationStates.get(roomId);
    if (!notificationState) {
      // Tạo notification state mới nếu chưa có
      notificationState = {
        active: true,
        startTime: Date.now(),
        timeout: 30000 // 30 seconds
      };
      notificationStates.set(roomId, notificationState);
      console.log(`⏰ Created new notification state for room ${roomId}`);
    }

    // Record user response trong Map riêng
    if (!userResponses.has(roomId)) {
      userResponses.set(roomId, new Map());
    }
    userResponses.get(roomId).set(currentUser.id, {
      response: response,
      timestamp: Date.now()
    });
    
    console.log(`⏰ User ${currentUser.id} response recorded: ${response}`);

    if (response === 'no') {
      // User wants to end - end the room immediately
      console.log(`⏰ User ${currentUser.id} wants to end, closing room ${roomId} immediately`);
      
      // End the room
      await roomModel.endRoom(roomId);
      
      // Clear states
      countdownStates.delete(roomId);
      notificationStates.delete(roomId);
      userResponses.delete(roomId);
      
      // Broadcast room ended message
      if (connectionManager) {
        await connectionManager.broadcastToRoom({
          type: 'room_ended',
          message: 'Một người dùng đã chọn kết thúc cuộc trò chuyện.',
          room_id: parseInt(roomId),
          ended_by: currentUser.id,
          reason: 'user_declined'
        }, parseInt(roomId));
      }

      res.json({
        room_ended: true,
        message: 'Cuộc trò chuyện đã kết thúc.'
      });
    } else {
      // User wants to continue - check if both users have responded
      const otherUserId = room.user1_id === currentUser.id ? room.user2_id : room.user1_id;
      const roomResponses = userResponses.get(roomId);
      const otherUserResponse = roomResponses ? roomResponses.get(otherUserId) : null;

      if (otherUserResponse) {
        // Both users have responded
        if (otherUserResponse.response === 'yes') {
          // Both want to continue - keep room active
          console.log(`⏰ Both users want to continue, keeping room ${roomId} active`);
          
          // Clear all states
          notificationStates.delete(roomId);
          userResponses.delete(roomId);
          
          // ✅ THÊM: Clear countdown state nếu có
          if (countdownStates.has(roomId)) {
            countdownStates.delete(roomId);
            console.log(`⏰ Cleared countdown state for room ${roomId}`);
          }
          
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
          userResponses.delete(roomId);
          
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
  
  // ✅ TỐI ƯU: Set countdown state với timestamp chính xác
  const now = Date.now();
  countdownStates.set(roomId, {
    active: true,
    remaining: duration,
    startTime: now,
    startTimestamp: now, // ✅ THÊM: High precision start time
    endTimestamp: now + (duration * 1000) // ✅ THÊM: Chính xác thời gian kết thúc
  });

  // ✅ TỐI ƯU: Broadcast countdown start với thêm timestamp information
  if (connectionManager) {
    const roomIdInt = parseInt(roomId);
    console.log(`⏰ Broadcasting countdown_start to room ${roomId} (${roomIdInt})`);
    console.log(`⏰ ConnectionManager roomConnections:`, connectionManager.roomConnections);
    console.log(`⏰ Room ${roomId} (${roomIdInt}) exists:`, connectionManager.roomConnections.has(roomIdInt));
    
    const now = Date.now();
    connectionManager.broadcastToRoom({
      type: 'countdown_start',
      room_id: roomIdInt,
      duration: duration,
      startTimestamp: now, // ✅ THÊM: Thời gian bắt đầu chính xác
      endTimestamp: now + (duration * 1000) // ✅ THÊM: Thời gian kết thúc dự kiến
    }, roomIdInt);
  } else {
    console.log(`⚠️ No ConnectionManager available for countdown broadcast`);
  }

  // ✅ TỐI ƯU: Sử dụng high precision timer và tăng tần suất update
  const startTimestamp = Date.now();
  const endTimestamp = startTimestamp + (duration * 1000);
  
  // Cập nhật state với timestamp chính xác
  const state = countdownStates.get(roomId);
  state.startTimestamp = startTimestamp;
  state.endTimestamp = endTimestamp;
  
  // ✅ TỐI ƯU: Interval 500ms thay vì 1000ms để smooth hơn
  const countdownInterval = setInterval(async () => {
    const currentState = countdownStates.get(roomId);
    if (!currentState || !currentState.active) {
      clearInterval(countdownInterval);
      return;
    }

    // ✅ TỐI ƯU: Tính toán chính xác dựa trên timestamp
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((currentState.endTimestamp - now) / 1000));
    currentState.remaining = remaining;
    
    // ✅ TỐI ƯU: Check số users trong room trước khi broadcast
    if (connectionManager && connectionManager.roomConnections.has(parseInt(roomId))) {
      const usersInRoom = connectionManager.roomConnections.get(parseInt(roomId));
      
      // ✅ TỐI ƯU: Nếu không có user nào trong room, dừng countdown
      if (!usersInRoom || usersInRoom.size === 0) {
        console.log(`⚠️ No users in room ${roomId}, stopping countdown timer`);
        clearInterval(countdownInterval);
        countdownStates.delete(roomId);
        return;
      }
      
      connectionManager.broadcastToRoom({
        type: 'countdown_update',
        room_id: parseInt(roomId),
        remaining: remaining,
        timestamp: now,
        endTimestamp: currentState.endTimestamp // ✅ THÊM: Frontend có thể tự tính toán
      }, parseInt(roomId));
    } else {
      console.log(`⚠️ Room ${roomId} not found in connections, stopping countdown timer`);
      clearInterval(countdownInterval);
      countdownStates.delete(roomId);
      return;
    }

    if (remaining <= 0) {
      // Countdown finished, start notification phase
      clearInterval(countdownInterval);
      countdownStates.delete(roomId);
      startNotificationPhase(roomId);
    }
  }, 500); // ✅ TỐI ƯU: 500ms thay vì 1000ms
}

function startNotificationPhase(roomId) {
  console.log(`⏰ Starting notification phase for room ${roomId}`);
  
  // ✅ TỐI ƯU: Set notification state với timestamp chính xác
  const now = Date.now();
  notificationStates.set(roomId, {
    active: true,
    remaining: 30, // 30 seconds to respond
    users_to_notify: [roomId], // Will be populated with actual user IDs
    startTime: now,
    startTimestamp: now, // ✅ THÊM: High precision start time
    endTimestamp: now + (30 * 1000) // ✅ THÊM: Chính xác thời gian kết thúc
  });

  // Get room users
  roomModel.findById(roomId).then(room => {
    if (room) {
      // ✅ SỬA: Loại bỏ user đã ấn "Giữ hoạt động" khỏi users_to_notify
      const notificationState = notificationStates.get(roomId);
      const roomResponses = userResponses.get(roomId);
      console.log(`⏰ Notification state for room ${roomId}:`, notificationState);
      console.log(`⏰ User responses for room ${roomId}:`, roomResponses);
      
      const usersToNotify = [room.user1_id, room.user2_id].filter(userId => {
        // Chỉ gửi notification cho user chưa có response
        const hasResponse = roomResponses && roomResponses.has(userId);
        console.log(`⏰ User ${userId} has response:`, hasResponse);
        return !hasResponse;
      });
      
      notificationStates.get(roomId).users_to_notify = usersToNotify;
      
      console.log(`⏰ Users to notify for room ${roomId}:`, usersToNotify);
      
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

  // ✅ TỐI ƯU: Start notification countdown với high precision timer
  const notificationStartTime = Date.now();
  const notificationEndTime = notificationStartTime + (30 * 1000); // 30 giây
  
  // Cập nhật notification state với timestamp
  const notificationState = notificationStates.get(roomId);
  notificationState.startTimestamp = notificationStartTime;
  notificationState.endTimestamp = notificationEndTime;
  
  const notificationInterval = setInterval(async () => {
    const state = notificationStates.get(roomId);
    if (!state || !state.active) {
      clearInterval(notificationInterval);
      return;
    }

    // ✅ TỐI ƯU: Tính toán chính xác dựa trên timestamp
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((state.endTimestamp - now) / 1000));
    state.remaining = remaining;
    
    // ✅ TỐI ƯU: Check số users trong room trước khi broadcast notification
    if (connectionManager && connectionManager.roomConnections.has(parseInt(roomId))) {
      const usersInRoom = connectionManager.roomConnections.get(parseInt(roomId));
      
      // ✅ TỐI ƯU: Nếu không có user nào trong room, dừng notification timer
      if (!usersInRoom || usersInRoom.size === 0) {
        console.log(`⚠️ No users in room ${roomId}, stopping notification timer`);
        clearInterval(notificationInterval);
        notificationStates.delete(roomId);
        userResponses.delete(roomId);
        return;
      }
      
      connectionManager.broadcastToRoom({
        type: 'notification_update',
        room_id: parseInt(roomId),
        remaining: remaining,
        timestamp: now,
        endTimestamp: state.endTimestamp
      }, parseInt(roomId));
    } else {
      console.log(`⚠️ Room ${roomId} not found in connections, stopping notification timer`);
      clearInterval(notificationInterval);
      notificationStates.delete(roomId);
      userResponses.delete(roomId);
      return;
    }

    if (remaining <= 0) {
      // Notification timeout, end room
      clearInterval(notificationInterval);
      notificationStates.delete(roomId);
      userResponses.delete(roomId); // ✅ FIX: Clear user responses to prevent memory leak
      
      console.log(`⏰ Notification timeout for room ${roomId}, ending room`);
      
      // End the room
      roomModel.endRoom(roomId).then(() => {
        // Broadcast room ended
        if (connectionManager) {
          connectionManager.broadcastToRoom({
            type: 'room_ended',
            message: 'Hết thời gian phản hồi. Cuộc trò chuyện đã kết thúc.',
            room_id: parseInt(roomId),
            reason: 'timeout'
          }, parseInt(roomId));
        }
      });
    }
  }, 500); // ✅ TỐI ƯU: 500ms thay vì 1000ms
}

module.exports = { 
  router, 
  initModels, 
  handleUserDisconnect, 
  handleUserReconnect,
  stopRoomTimers // ✅ THÊM: Export hàm stopRoomTimers
};
