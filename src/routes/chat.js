// Chat routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validateMessage } = require('../middleware/validation');
const { searchLimiter, messageLimiter } = require('../middleware/rateLimiter');

// Initialize models
let userModel, roomModel, messageModel, connectionManager;

const initModels = (db, connManager) => {
  const User = require('../models/User');
  const Room = require('../models/Room');
  const Message = require('../models/Message');
  
  userModel = new User(db);
  roomModel = new Room(db);
  messageModel = new Message(db);
  connectionManager = connManager;
  
  // ✅ SỬA: Sử dụng global MatchingService
  if (!global.matchingService) {
    const MatchingService = require('../services/MatchingService');
    global.matchingService = new MatchingService(userModel, roomModel, connectionManager);
    console.log('🔧 Global MatchingService created');
  } else {
    console.log('🔧 Global MatchingService already exists, reusing');
  }
};

// Search for chat partner
router.post('/search', authenticateToken, searchLimiter, async (req, res) => {
  try {
    const { type = 'chat' } = req.body;
    const currentUser = req.user;

    // Check if user is already in a room
    if (currentUser.current_room_id) {
      const room = await roomModel.findById(currentUser.current_room_id);
      if (room && !room.end_time) {
        const otherUser = await roomModel.getOtherUser(room.id, currentUser.id);
        if (otherUser) {
          return res.json({
            room_id: currentUser.current_room_id,
            matched_user: {
              id: otherUser.id,
              username: otherUser.username,
              nickname: otherUser.nickname,
              avatar_url: otherUser.avatar_url
            },
            icebreaker: "Bạn đã có sẵn phòng chat!"
          });
        }
      }
    }

    // Check if user is already searching
    if (currentUser.status === 'searching') {
      return res.status(400).json({
        error: 'Already searching',
        detail: 'Bạn đang tìm kiếm người chat'
      });
    }

    // Check if user is banned
    if (await userModel.isBanned(currentUser)) {
      return res.status(403).json({
        error: 'Account banned',
        detail: `Tài khoản bị tạm khóa đến ${currentUser.banned_until}`
      });
    }

    // Update user status
    await userModel.updateStatus(currentUser.id, 'searching');

    // Add to matching queue
    const searchResult = await global.matchingService.addToSearchQueue(currentUser.id, {
      type: type,
      user: currentUser
    });

    if (!searchResult.success) {
      await userModel.updateStatus(currentUser.id, 'idle');
      return res.status(400).json({
        error: 'Search failed',
        detail: searchResult.message
      });
    }

    // Check if we got matched immediately
    const queueStatus = global.matchingService.getQueueStatus();
    
    res.json({
      room_id: null,
      matched_user: null,
      icebreaker: `Đang tìm kiếm người chat... (${queueStatus.queueSize} người đang chờ)`,
      queue_status: queueStatus
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi tìm kiếm: ' + error.message
    });
  }
});

// Cancel search
router.post('/cancel-search', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.status !== 'searching') {
      return res.status(400).json({
        error: 'Not searching',
        detail: 'Bạn không đang tìm kiếm'
      });
    }

    // Remove from matching queue
    await global.matchingService.removeFromSearchQueue(currentUser.id);

    // Update user status
    await userModel.updateStatus(currentUser.id, 'idle');

    res.json({ message: 'Đã hủy tìm kiếm' });

  } catch (error) {
    console.error('Cancel search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi hủy tìm kiếm: ' + error.message
    });
  }
});

// Get current room
router.get('/current-room', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    // Get fresh user data from database
    const freshUser = await userModel.findById(currentUser.id);
    if (!freshUser) {
      return res.status(404).json({
        error: 'User not found',
        detail: 'Không tìm thấy user'
      });
    }

    if (!freshUser.current_room_id) {
      return res.status(404).json({
        error: 'No active room',
        detail: 'Bạn không có phòng chat nào'
      });
    }

    const room = await roomModel.findById(freshUser.current_room_id);
    if (!room || room.end_time) {
      // Reset user status
      await userModel.updateStatus(freshUser.id, 'idle', null);
      return res.status(404).json({
        error: 'Room not found',
        detail: 'Phòng chat không tồn tại hoặc đã kết thúc'
      });
    }

    const otherUser = await roomModel.getOtherUser(room.id, freshUser.id);
    if (!otherUser) {
      return res.status(404).json({
        error: 'User not found',
        detail: 'Không tìm thấy người chat'
      });
    }

    res.json({
      room_id: freshUser.current_room_id,
      matched_user: {
        id: otherUser.id,
        username: otherUser.username,
        nickname: otherUser.nickname,
        avatar_url: otherUser.avatar_url
      },
      icebreaker: "Chào mừng bạn trở lại phòng chat!"
    });

  } catch (error) {
    console.error('Get current room error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi lấy thông tin phòng hiện tại: ' + error.message
    });
  }
});

// Get room messages
router.get('/room/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const currentUser = req.user;

    // Validate room access
    const room = await roomModel.findById(roomId);
    if (!room) {
      return res.status(404).json({
        error: 'Room not found',
        detail: 'Không tìm thấy phòng chat'
      });
    }

    if (room.user1_id !== currentUser.id && room.user2_id !== currentUser.id) {
      return res.status(403).json({
        error: 'Access denied',
        detail: 'Bạn không có quyền truy cập phòng này'
      });
    }

    // Get messages
    const messages = await messageModel.findByRoomId(roomId, parseInt(limit), parseInt(offset));

    res.json({
      messages: messages,
      total: messages.length,
      room_id: parseInt(roomId)
    });

  } catch (error) {
    console.error('Get room messages error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi lấy tin nhắn: ' + error.message
    });
  }
});

// End chat session
router.post('/end/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUser = req.user;

    // Get room
    const room = await roomModel.findById(roomId);
    if (!room) {
      return res.status(404).json({
        error: 'Room not found',
        detail: 'Không tìm thấy phòng chat'
      });
    }

    // Check if room is already ended
    if (room.end_time) {
      return res.json({
        message: 'Phòng chat đã được kết thúc trước đó',
        room_already_ended: true,
        ended_at: room.end_time
      });
    }

    // Validate room access
    if (room.user1_id !== currentUser.id && room.user2_id !== currentUser.id) {
      return res.status(403).json({
        error: 'Access denied',
        detail: 'Bạn không có quyền truy cập phòng này'
      });
    }

    // End room
    await roomModel.endRoom(roomId);

    // Update both users' status
    await userModel.updateStatus(room.user1_id, 'idle', null);
    await userModel.updateStatus(room.user2_id, 'idle', null);

    // ✅ SỬA: Send WebSocket notification TRƯỚC khi cleanup
    if (connectionManager) {
      const roomEndedNotification = {
        type: 'room_ended_by_user',
        room_id: parseInt(roomId),
        ended_by_user_id: currentUser.id,
        message: `Phòng chat đã được kết thúc bởi ${currentUser.username}`,
        timestamp: new Date().toISOString()
      };

      console.log(`📢 Broadcasting room ended notification to room ${roomId}`);
      await connectionManager.broadcastToRoom(roomEndedNotification, parseInt(roomId));
      
      // ✅ THÊM: Force close room để đảm bảo cleanup hoàn toàn
      console.log(`🔒 Force closing room ${roomId}`);
      await connectionManager.forceCloseRoom(parseInt(roomId));
    }

    res.json({ message: 'Cuộc trò chuyện đã kết thúc' });

  } catch (error) {
    console.error('End chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi kết thúc phiên: ' + error.message
    });
  }
});

// Check room status
router.get('/check-room-status', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    // Check if user is in an active room
    const room = await roomModel.findActiveByUserId(currentUser.id);
    
    if (room) {
      // Update user status if needed
      if (currentUser.current_room_id !== room.id || currentUser.status !== 'connected') {
        await userModel.updateStatus(currentUser.id, 'connected', room.id);
      }

      return res.json({
        room_id: room.id,
        status: 'active',
        user1_id: room.user1_id,
        user2_id: room.user2_id,
        start_time: room.start_time
      });
    }

    res.json({
      room_id: null,
      status: 'no_active_room'
    });

  } catch (error) {
    console.error('Check room status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi kiểm tra trạng thái phòng: ' + error.message
    });
  }
});

// Check matching status
router.get('/matching-status', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    const queueStatus = global.matchingService.getQueueStatus();
    
    res.json({
      user_id: currentUser.id,
      status: currentUser.status,
      queue_status: queueStatus,
      current_room_id: currentUser.current_room_id
    });

  } catch (error) {
    console.error('Matching status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi kiểm tra trạng thái matching: ' + error.message
    });
  }
});

// Force match (for testing)
router.post('/force-match', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Forbidden',
        detail: 'Force match chỉ được sử dụng trong development'
      });
    }

    const result = await global.matchingService.tryMatch();
    
    if (result && result.success) {
      res.json({
        message: 'Force match successful',
        room: result.room,
        matched_users: [result.user1.username, result.user2.username]
      });
    } else {
      res.json({
        message: 'No users available for matching',
        queue_status: global.matchingService.getQueueStatus()
      });
    }

  } catch (error) {
    console.error('Force match error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi force match: ' + error.message
    });
  }
});

// Get chat history for a room
router.get('/:roomId/history', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const currentUser = req.user;

    console.log(`📚 Getting chat history for room ${roomId}, user ${currentUser.id}`);

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

    // Get messages
    const messages = await messageModel.getByRoomId(roomId, parseInt(limit), parseInt(offset));
    
    console.log(`📚 Found ${messages.length} messages for room ${roomId}`);

    res.json({
      success: true,
      messages: messages,
      room_id: roomId,
      total: messages.length
    });

  } catch (error) {
    console.error('❌ Error getting chat history:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Failed to get chat history: ' + error.message
    });
  }
});

// ✅ THÊM: Get room details endpoint
router.get('/room/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUser = req.user;

    console.log(`🔍 Getting room details for room ${roomId}, user ${currentUser.id}`);

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

    // Get other user info
    const otherUser = await roomModel.getOtherUser(roomId, currentUser.id);
    
    res.json({
      id: room.id,
      user1_id: room.user1_id,
      user2_id: room.user2_id,
      start_time: room.start_time,
      end_time: room.end_time,
      matched_user: otherUser ? {
        id: otherUser.id,
        username: otherUser.username,
        nickname: otherUser.nickname,
        avatar_url: otherUser.avatar_url
      } : null,
      icebreaker: "Chào mừng bạn đến với phòng chat!"
    });

  } catch (error) {
    console.error('❌ Error getting room details:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Failed to get room details: ' + error.message
    });
  }
});

// ✅ THÊM: Keep room active endpoint
router.post('/keep/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUser = req.user;

    console.log(`🔒 User ${currentUser.id} requesting to keep room ${roomId} active`);

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

    // For now, just return success (room is kept active by default)
    res.json({
      success: true,
      message: 'Room kept active',
      room_id: parseInt(roomId)
    });

  } catch (error) {
    console.error('❌ Error keeping room active:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Failed to keep room active: ' + error.message
    });
  }
});

// ✅ THÊM: End room endpoint
router.post('/end/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUser = req.user;

    console.log(`🔚 User ${currentUser.id} requesting to end room ${roomId}`);

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

    // Check if room is already ended
    if (room.end_time) {
      return res.status(400).json({
        error: 'Room ended',
        detail: 'Room has already ended'
      });
    }

    // End the room
    await roomModel.endRoom(roomId);
    
    // Clear countdown/notification states
    if (global.countdownStates) {
      global.countdownStates.delete(roomId);
    }
    if (global.notificationStates) {
      global.notificationStates.delete(roomId);
    }

    // Broadcast room ended message
    if (connectionManager) {
      await connectionManager.broadcastToRoom({
        type: 'room_ended',
        message: 'Cuộc trò chuyện đã kết thúc.',
        room_id: parseInt(roomId)
      }, parseInt(roomId));
    }

    res.json({
      success: true,
      message: 'Room ended successfully',
      room_id: parseInt(roomId)
    });

  } catch (error) {
    console.error('❌ Error ending room:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Failed to end room: ' + error.message
    });
  }
});

// Export matching service getter
const getMatchingService = () => matchingService;

module.exports = { router, initModels, getMatchingService };
