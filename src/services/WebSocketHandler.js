// WebSocket Handler for chat and status connections
const jwt = require('jsonwebtoken');
const config = require('../../config');

class WebSocketHandler {
  constructor(connectionManager, userModel, roomModel, messageModel) {
    this.connectionManager = connectionManager;
    this.userModel = userModel;
    this.roomModel = roomModel;
    this.messageModel = messageModel;
  }

  // Handle chat WebSocket connection
  async handleChatConnection(socket, roomId) {
    try {
      console.log(`🔌 Chat WebSocket connection for room ${roomId}`);

      // ✅ SỬA: Tránh duplicate connection
      if (socket._chatConnected) {
        console.log(`⚠️ User already connected to chat, skipping duplicate connection`);
        return;
      }

      // Validate connection
      const validation = await this.validateConnection(socket, roomId);
      if (!validation.success) {
        socket.emit('error', { message: validation.error });
        socket.disconnect();
        return;
      }

      const { user } = validation;

      // Add user to room
      const added = await this.connectionManager.addToRoom(roomId, user.id, socket);
      if (!added) {
        socket.emit('error', { message: 'Failed to join room' });
        socket.disconnect();
        return;
      }

      // Send welcome message
      this.sendWelcomeMessage(socket, roomId, user);

      // Set up message handlers
      this.setupChatHandlers(socket, roomId, user);

      // Mark as connected
      socket._chatConnected = true;

      console.log(`✅ User ${user.id} successfully connected to room ${roomId}`);

    } catch (error) {
      console.error(`❌ Chat WebSocket error:`, error);
      socket.emit('error', { message: 'Connection failed' });
      socket.disconnect();
    }
  }

  // Handle status WebSocket connection
  async handleStatusConnection(socket) {
    try {
      console.log(`🔌 Status WebSocket connection`);

      // Validate connection
      const validation = await this.validateConnection(socket);
      if (!validation.success) {
        socket.emit('error', { message: validation.error });
        socket.disconnect();
        return;
      }

      const { user } = validation;

      // Add to active connections
      this.connectionManager.connect(user.id, socket);

      // Send initial status
      socket.emit('status_update', {
        user_id: user.id,
        status: user.status,
        current_room_id: user.current_room_id,
        timestamp: new Date().toISOString()
      });

      // Set up status handlers
      this.setupStatusHandlers(socket, user);

      console.log(`✅ User ${user.id} connected to status WebSocket`);

    } catch (error) {
      console.error(`❌ Status WebSocket error:`, error);
      socket.emit('error', { message: 'Connection failed' });
      socket.disconnect();
    }
  }

  // Validate WebSocket connection
  async validateConnection(socket, roomId = null) {
    try {
      // ✅ SỬA: Get token from auth object (Socket.IO)
      const token = socket.handshake.auth.token;
      console.log('🔍 WebSocket auth token:', token ? 'present' : 'missing');
      
      if (!token) {
        return { success: false, error: 'Missing token' };
      }

      // Verify token
      const tokenData = this.verifyToken(token);
      console.log('🔍 Token data:', tokenData);
      
      if (!tokenData) {
        return { success: false, error: 'Invalid token' };
      }

      // Get user from database
      const user = await this.userModel.findByUsername(tokenData.sub);
      console.log('🔍 User found:', user ? `ID ${user.id}` : 'not found');
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check if user is banned
      if (await this.userModel.isBanned(user)) {
        return { success: false, error: 'Account banned' };
      }

      // Validate room access if this is a chat WebSocket
      if (roomId) {
        const roomAccess = await this.validateRoomAccess(user, roomId);
        if (!roomAccess.success) {
          return { success: false, error: roomAccess.error };
        }
      }

      return { success: true, user };

    } catch (error) {
      console.error('❌ Validation error:', error);
      return { success: false, error: 'Validation failed' };
    }
  }

  // Validate room access
  async validateRoomAccess(user, roomId) {
    try {
      // Check if user is in this room
      if (user.current_room_id !== roomId) {
        return { success: false, error: 'Access denied to this room' };
      }

      // Verify room exists and user belongs to it
      const room = await this.roomModel.findById(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Check if room is still active
      if (room.end_time) {
        return { success: false, error: 'Room has ended' };
      }

      if (room.user1_id !== user.id && room.user2_id !== user.id) {
        return { success: false, error: 'Not authorized for this room' };
      }

      return { success: true };

    } catch (error) {
      console.error('❌ Room access validation error:', error);
      return { success: false, error: 'Room validation failed' };
    }
  }

  // Set up chat message handlers
  setupChatHandlers(socket, roomId, user) {
    // ✅ SỬA: Tránh duplicate event listeners
    if (socket._chatHandlersSetup) {
      console.log(`⚠️ Chat handlers already setup for user ${user.id}, skipping duplicate`);
      return;
    }
    
    // Handle chat messages
    socket.on('message', async (data, ack) => {
      try {
        await this.handleChatMessage(socket, roomId, user, data, ack);
      } catch (error) {
        console.error('❌ Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
        if (ack) ack({ status: 'error', message: 'Failed to send message' });
      }
    });
    
    // Mark handlers as setup
    socket._chatHandlersSetup = true;

    // Handle typing indicators
    socket.on('typing', async (data) => {
      try {
        await this.handleTypingIndicator(socket, roomId, user, data);
      } catch (error) {
        console.error('❌ Typing indicator error:', error);
      }
    });

    // Handle like responses
    socket.on('like_response', async (data) => {
      try {
        await this.handleLikeResponse(socket, roomId, user, data);
      } catch (error) {
        console.error('❌ Like response error:', error);
      }
    });

    // Handle heartbeat
    socket.on('heartbeat', () => {
      socket.emit('heartbeat', {
        timestamp: new Date().toISOString(),
        room_id: roomId
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 User ${user.id} disconnected from room ${roomId}`);
      await this.connectionManager.removeFromRoom(roomId, user.id);
    });
  }

  // Set up status message handlers
  setupStatusHandlers(socket, user) {
    // Handle heartbeat
    socket.on('heartbeat', () => {
      socket.emit('heartbeat', {
        timestamp: new Date().toISOString()
      });
    });

    // ✅ THÊM: Handle join-room từ status WebSocket
    socket.on('join-room', async (data) => {
      const { roomId } = data;
      console.log(`👤 User ${user.id} joining room ${roomId} from status WebSocket`);
      
      if (roomId) {
        await this.handleChatConnection(socket, roomId);
      } else {
        socket.emit('error', { message: 'Room ID is required' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User ${user.id} disconnected from status WebSocket`);
      this.connectionManager.disconnect(user.id);
    });
  }

  // ✅ THÊM: Centralized connection handler
  async handleConnection(socket, user) {
    console.log(`👤 User ${user.id} connected to WebSocket`);
    
    // Set up status handlers first
    this.setupStatusHandlers(socket, user);
    
    // If user is already in a room, set up chat handlers
    if (user.current_room_id) {
      console.log(`👤 User ${user.id} already in room ${user.current_room_id}, setting up chat handlers`);
      await this.handleChatConnection(socket, user.current_room_id);
    }
  }

  // Handle chat message
  async handleChatMessage(socket, roomId, user, data, ack) {
    try {
      console.log(`🔍 WebSocket - handleChatMessage called with data:`, data);
      console.log(`🔍 WebSocket - Data type:`, typeof data);
      console.log(`🔍 WebSocket - Data keys:`, data ? Object.keys(data) : 'null');
      
      // ✅ SỬA: Kiểm tra data structure trước
      if (!data || typeof data !== 'object') {
        console.log(`⚠️ Invalid message data from user ${user.id}:`, data);
        socket.emit('error', { message: 'Dữ liệu tin nhắn không hợp lệ' });
        if (ack) ack({ status: 'error', message: 'Dữ liệu tin nhắn không hợp lệ' });
        return;
      }

      // ✅ SỬA: Kiểm tra message type trước
      if (data.type !== 'message') {
        console.log(`⚠️ Not a message type from user ${user.id}:`, data.type);
        if (ack) ack({ status: 'error', message: 'Loại tin nhắn không hợp lệ' });
        return;
      }

      const { content } = data;
      
      // ✅ SỬA: Kiểm tra content kỹ hơn
      if (!content || typeof content !== 'string' || !content.trim()) {
        console.log(`⚠️ Empty or invalid message content from user ${user.id}:`, content);
        socket.emit('error', { message: 'Tin nhắn không hợp lệ' });
        if (ack) ack({ status: 'error', message: 'Tin nhắn không hợp lệ' });
        return;
      }

      const trimmedContent = content.trim();
      
      // Validate message length (max 1000 characters)
      if (trimmedContent.length > 1000) {
        socket.emit('error', { message: 'Tin nhắn quá dài (tối đa 1000 ký tự)' });
        if (ack) ack({ status: 'error', message: 'Tin nhắn quá dài (tối đa 1000 ký tự)' });
        return;
      }

      console.log(`🔍 WebSocket - Processing message from user ${user.id}: "${trimmedContent}"`);

      // Save message to database
      const message = await this.messageModel.create({
        room_id: roomId,
        user_id: user.id,
        content: trimmedContent
      });

      // Update room's last message time
      await this.roomModel.updateLastMessageTime(roomId);

      // Create message JSON for broadcasting
      const messageData = {
        type: 'message',
        message_id: message.id,
        user_id: user.id,
        username: user.username,
        content: trimmedContent,
        timestamp: message.timestamp,
        avatar_url: user.avatar_url
      };

      console.log(`🔍 WebSocket - Broadcasting message data:`, messageData);

      // ✅ SỬA: Gửi message cho cả sender để hiển thị tin nhắn
      await this.connectionManager.broadcastToRoom(messageData, roomId);
      console.log(`💬 Message broadcasted to room ${roomId} (including sender ${user.id})`);

      if (ack) ack({ status: 'success', message_id: message.id });

    } catch (error) {
      console.error(`❌ Error handling chat message from user ${user.id}:`, error);
      socket.emit('error', { message: 'Lỗi server khi gửi tin nhắn' });
      if (ack) ack({ status: 'error', message: 'Lỗi server khi gửi tin nhắn' });
    }
  }

  // Handle typing indicator
  async handleTypingIndicator(socket, roomId, user, data) {
    const { is_typing } = data;
    
    const typingData = {
      type: is_typing ? 'typing' : 'stop_typing',
      user_id: user.id,
      username: user.username,
      is_typing: is_typing,
      timestamp: new Date().toISOString()
    };

    // Broadcast typing indicator to other users in room
    await this.connectionManager.broadcastToRoom(typingData, roomId, user.id);
    console.log(`⌨️ Typing indicator broadcasted for user ${user.id} (is_typing: ${is_typing})`);
  }

  // Handle like response
  async handleLikeResponse(socket, roomId, user, data) {
    const { response } = data;
    
    if (!['yes', 'no'].includes(response)) {
      console.log(`⚠️ Invalid like response: ${response}`);
      return;
    }

    // Update room like responses
    const room = await this.roomModel.findById(roomId);
    if (!room) return;

    const likeResponses = { ...room.like_responses };
    const userKey = user.id === room.user1_id ? 'user1' : 'user2';
    likeResponses[userKey] = response;

    await this.roomModel.update(roomId, { like_responses: likeResponses });

    // Check if both users have responded
    if (Object.keys(likeResponses).length === 2) {
      const user1Response = likeResponses.user1;
      const user2Response = likeResponses.user2;
      
      if (user1Response === 'yes' && user2Response === 'yes') {
        // Both like each other - increase reveal level
        const newRevealLevel = Math.min(room.reveal_level + 1, 2);
        await this.roomModel.update(roomId, { reveal_level: newRevealLevel });
      }
    }

    // Broadcast like response to room
    const likeData = {
      type: 'like_response',
      user_id: user.id,
      username: user.username,
      response: response,
      reveal_level: room.reveal_level,
      timestamp: new Date().toISOString()
    };

    await this.connectionManager.broadcastToRoom(likeData, roomId);
    console.log(`❤️ Like response broadcasted for user ${user.id}`);
  }

  // Send welcome message
  sendWelcomeMessage(socket, roomId, user) {
    const welcomeMessage = {
      type: 'connection',
      message: 'Connected to chat room',
      room_id: roomId,
      timestamp: new Date().toISOString(),
      user_info: {
        user_id: user.id,
        username: user.username
      }
    };

    socket.emit('message', welcomeMessage);
    console.log(`👋 Welcome message sent to user ${user.id}`);
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secretKey);
    } catch (error) {
      return null;
    }
  }
}

module.exports = WebSocketHandler;
