// WebSocket Connection Manager
class ConnectionManager {
  constructor() {
    this.activeConnections = new Map(); // user_id -> socket
    this.roomConnections = new Map(); // room_id -> Set of user_ids
    this.userRooms = new Map(); // user_id -> room_id
    this.roomLocks = new Map(); // room_id -> lock
  }

  // Connect user to status WebSocket
  connect(userId, socket) {
    // Disconnect existing connection if any
    const existingSocket = this.activeConnections.get(userId);
    if (existingSocket && existingSocket !== socket) {
      console.log(`⚠️ Disconnecting existing connection for user ${userId}`);
      try {
        existingSocket.emit('connection_replaced', { 
          message: 'Kết nối mới từ thiết bị khác' 
        });
        existingSocket.disconnect();
      } catch (error) {
        console.error(`❌ Error disconnecting existing socket for user ${userId}:`, error);
      }
    }
    
    this.activeConnections.set(userId, socket);
    console.log(`👤 User ${userId} connected to status WebSocket`);
  }

  // Disconnect user from status WebSocket
  disconnect(userId) {
    this.activeConnections.delete(userId);
    console.log(`👤 User ${userId} disconnected from status WebSocket`);
    
    // Remove from all rooms
    this.removeUserFromAllRooms(userId);
  }

  // Add user to room
  async addToRoom(roomId, userId, socket) {
    try {
      // Check if user is already in this room
      if (this.isUserInRoom(userId, roomId)) {
        return true;
      }

      // Create room if it doesn't exist
      if (!this.roomConnections.has(roomId)) {
        this.roomConnections.set(roomId, new Set());
      }

      // Add user to room
      this.roomConnections.get(roomId).add(userId);
      this.userRooms.set(userId, roomId);
      this.activeConnections.set(userId, socket);

      console.log(`✅ User ${userId} added to room ${roomId}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error adding user ${userId} to room ${roomId}:`, error);
      return false;
    }
  }

  // Remove user from room
  async removeFromRoom(roomId, userId) {
    try {
      console.log(`👤 Removing user ${userId} from room ${roomId}`);

      if (this.roomConnections.has(roomId)) {
        this.roomConnections.get(roomId).delete(userId);
        this.userRooms.delete(userId);

        // Close room if no more users
        if (this.roomConnections.get(roomId).size === 0) {
          this.roomConnections.delete(roomId);
          console.log(`🏠 Room ${roomId} closed - no more users`);
        }
      }

      console.log(`✅ User ${userId} removed from room ${roomId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error removing user ${userId} from room ${roomId}:`, error);
      return false;
    }
  }

  // Remove user from all rooms
  removeUserFromAllRooms(userId) {
    const roomsToRemove = [];
    
    for (const [roomId, users] of this.roomConnections.entries()) {
      if (users.has(userId)) {
        roomsToRemove.push(roomId);
      }
    }

    for (const roomId of roomsToRemove) {
      this.removeFromRoom(roomId, userId);
    }
  }

  // Send message to specific user
  sendToUser(userId, message) {
    const socket = this.activeConnections.get(userId);
    if (socket) {
      try {
        // ✅ SỬA: Kiểm tra socket connection trước khi gửi
        if (!socket.connected) {
          console.log(`⚠️ Socket for user ${userId} is not connected`);
          this.disconnect(userId);
          return false;
        }
        
        // ✅ SỬA: Sử dụng Socket.IO emit
        socket.emit('message', message);
        // ✅ THÊM: Emit theo typed event nếu có 'type'
        if (message && typeof message === 'object' && message.type) {
          socket.emit(message.type, message);
        }
        console.log(`📤 Message sent to user ${userId}:`, message.type);
        return true;
      } catch (error) {
        console.error(`❌ Error sending message to user ${userId}:`, error);
        this.disconnect(userId);
        return false;
      }
    }
    console.log(`⚠️ No active connection found for user ${userId}`);
    return false;
  }

  // Broadcast message to room
  async broadcastToRoom(message, roomId, excludeUserId = null) {
    try {
      console.log(`📢 Broadcasting message to room ${roomId}, excludeUserId: ${excludeUserId}, message type: ${message.type}`);
      
      if (!this.roomConnections.has(roomId)) {
        console.log(`⚠️ Room ${roomId} not found in room_connections`);
        return false;
      }

      const usersInRoom = Array.from(this.roomConnections.get(roomId));
      console.log(`👥 Users in room ${roomId}: ${usersInRoom.join(', ')}`);

      if (usersInRoom.length === 0) {
        console.log(`⚠️ No users in room ${roomId}`);
        return false;
      }

      let successCount = 0;
      const failedUsers = [];
      
      for (const userId of usersInRoom) {
        // Skip excluded user - use strict comparison
        if (excludeUserId && String(userId) === String(excludeUserId)) {
          console.log(`⏭️ Skipping excluded user ${userId}`);
          continue;
        }

        const socket = this.activeConnections.get(userId);
        if (socket) {
          try {
            if (!socket.connected) {
              console.log(`⚠️ Socket for user ${userId} is not connected`);
              this.disconnect(userId);
              failedUsers.push(userId);
              continue;
            }
            
            socket.emit('message', message);
            if (message && typeof message === 'object' && message.type) {
              socket.emit(message.type, message);
            }
            successCount++;
            console.log(`✅ Message sent to user ${userId}`);
          } catch (error) {
            console.error(`❌ Error sending to user ${userId}:`, error);
            this.disconnect(userId);
            failedUsers.push(userId);
          }
        } else {
          console.log(`⚠️ No active connection for user ${userId}`);
          failedUsers.push(userId);
        }
      }

      console.log(`📊 Successfully sent to ${successCount}/${usersInRoom.length} users`);
      
      if (failedUsers.length > 0) {
        console.log(`❌ Failed to send to users: ${failedUsers.join(', ')}`);
      }

      return successCount > 0;
    } catch (error) {
      console.error(`❌ Error broadcasting to room ${roomId}:`, error);
      return false;
    }
  }

  // ✅ THÊM: Broadcast message to specific user
  async broadcastToUser(message, userId) {
    try {
      console.log(`📢 Broadcasting message to user ${userId}`);

      const socket = this.activeConnections.get(userId);
      if (!socket) {
        console.log(`⚠️ No active connection found for user ${userId}`);
        return false;
      }

      try {
        socket.emit('message', message);
        console.log(`✅ Message sent to user ${userId}`);
        return true;
      } catch (error) {
        console.error(`❌ Error sending message to user ${userId}:`, error);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error broadcasting to user ${userId}:`, error);
      return false;
    }
  }

  // Get room info
  getRoomInfo(roomId) {
    if (!this.roomConnections.has(roomId)) {
      return {
        room_id: roomId,
        users: [],
        connection_count: 0,
        status: 'closed'
      };
    }

    const usersInRoom = Array.from(this.roomConnections.get(roomId));
    return {
      room_id: roomId,
      users: usersInRoom,
      connection_count: usersInRoom.length,
      status: 'active'
    };
  }

  // Check if user is in room
  isUserInRoom(userId, roomId) {
    return this.roomConnections.has(roomId) && 
           this.roomConnections.get(roomId).has(userId);
  }

  // Get user's current room
  getUserRoom(userId) {
    return this.userRooms.get(userId);
  }

  // Force close room
  async forceCloseRoom(roomId) {
    try {
      console.log(`🔒 Force closing room ${roomId}`);

      // ✅ NEW: Check if there's an active call in this room
      const voiceCallService = global.voiceCallService;
      if (voiceCallService) {
        // Get active calls in this room
        const activeCall = voiceCallService.getActiveCallInRoom(roomId);
        if (activeCall) {
          // ✅ End call first với forceEndRoom = true (không check keep_active)
          console.log(`📞 Ending call ${activeCall.id} before closing room`);
          await voiceCallService.endCall(activeCall.id, null, 'room_ended', true); // true = force end room
        }
      }

      // ✅ THÊM: Stop all countdown/notification timers for this room
      try {
        const { stopRoomTimers } = require('../routes/simple_countdown');
        stopRoomTimers(roomId);
      } catch (error) {
        console.log(`⚠️ Could not stop room timers: ${error.message}`);
      }

      // ✅ SỬA: Kiểm tra room có tồn tại không trước khi xử lý
      let usersInRoom = [];
      if (this.roomConnections.has(roomId)) {
        usersInRoom = Array.from(this.roomConnections.get(roomId));
        console.log(`👥 Found ${usersInRoom.length} users in room ${roomId}: ${usersInRoom.join(', ')}`);
      } else {
        console.log(`⚠️ Room ${roomId} not found in room_connections, checking userRooms...`);
        // ✅ THÊM: Tìm users từ userRooms nếu room_connections đã bị xóa
        for (const [userId, userRoomId] of this.userRooms.entries()) {
          if (userRoomId === roomId) {
            usersInRoom.push(userId);
          }
        }
        console.log(`👥 Found ${usersInRoom.length} users from userRooms: ${usersInRoom.join(', ')}`);
      }

      if (usersInRoom.length === 0) {
        console.log(`⚠️ No users found in room ${roomId} for force close`);
        return false;
      }
      
      // Send final room closed notification
      const closeMessage = {
        type: 'room_closed',
        message: 'Phòng chat đã được đóng',
        room_id: roomId,
        timestamp: new Date().toISOString(),
        force_close: true
      };

      // ✅ SỬA: Broadcast trước khi disconnect
      await this.broadcastToRoom(closeMessage, roomId);

      // Close all connections
      for (const userId of usersInRoom) {
        const socket = this.activeConnections.get(userId);
        if (socket) {
          try {
            socket.disconnect();
            console.log(`🔌 Disconnected user ${userId} from room ${roomId}`);
          } catch (error) {
            console.error(`❌ Error disconnecting user ${userId}:`, error);
          }
        }
        this.userRooms.delete(userId);
      }

      // Clear room
      this.roomConnections.delete(roomId);
      console.log(`✅ Room ${roomId} force closed successfully`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error force closing room ${roomId}:`, error);
      return false;
    }
  }
}

module.exports = ConnectionManager;
