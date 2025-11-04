// Voice Call Service - Manages voice call logic and WebRTC signaling
const CallSession = require('../models/CallSession');
const UserCallSettings = require('../models/UserCallSettings');
const { createErrorResponse, createSuccessResponse, VOICE_CALL_ERRORS } = require('../utils/voiceCallErrors');
// ✅ REMOVED: CallParticipant, VoiceCallInvitation - not needed for simplified system

class VoiceCallService {
  constructor(database, connectionManager) {
    this.database = database;
    this.connectionManager = connectionManager;
    
    // Initialize models
    this.callSessionModel = new CallSession(database);
    this.userCallSettingsModel = new UserCallSettings(database);
    // ✅ REMOVED: CallParticipant, VoiceCallInvitation models
    
    // Active calls tracking
    this.activeCalls = new Map(); // callId -> callSession
    this.userCalls = new Map();   // userId -> callId
    this.callTimeouts = new Map(); // callId -> timeoutId
    
    // Configuration
    this.config = {
      CALL_TIMEOUT: 30000, // 30 seconds
      MAX_CALL_DURATION: 3600000, // 1 hour
      RING_TIMEOUT: 30000, // 30 seconds
      RECONNECT_TIMEOUT: 10000 // 10 seconds
    };
    
    console.log('✅ VoiceCallService initialized');
  }

  // ✅ REMOVED: Voice call invitation system - using direct call system

  // === CALL INITIATION ===

  async initiateCall(callerId, calleeId, roomId) {
    try {
      console.log(`📞 Initiating call: ${callerId} -> ${calleeId} in room ${roomId}`);

      // Validate call initiation
      const validation = await this.validateCallInitiation(callerId, calleeId, roomId);
      if (!validation.valid) {
        return { 
          success: false, 
          error: validation.errorCode ? 
            createErrorResponse(validation.errorCode) : 
            createErrorResponse('INVALID_CALL_STATE', validation.error) 
        };
      }

      // Create call session
      const callSession = await this.callSessionModel.create({
        roomId,
        callerId,
        calleeId,
        status: 'initiated'
      });

      // Store in active calls
      this.activeCalls.set(callSession.id, callSession);
      this.userCalls.set(callerId, callSession.id);
      this.userCalls.set(calleeId, callSession.id);

      // ✅ REMOVED: Add participants - not needed for 1-on-1 calls
      
      // Send incoming call notification
      const callData = {
        type: 'voice_call_incoming',
        callId: callSession.id,
        caller: {
          id: callerId,
          username: validation.callerInfo.username,
          nickname: validation.callerInfo.nickname,
          avatar: validation.callerInfo.avatar_url
        },
        roomId
      };

      this.connectionManager.sendToUser(calleeId, callData);

      // Update call status to ringing
      await this.callSessionModel.update(callSession.id, { status: 'ringing' });

      // Set call timeout
      this.setCallTimeout(callSession.id);

      console.log(`✅ Call initiated successfully: ${callSession.id}`);
      return createSuccessResponse({ callId: callSession.id }, 'Cuộc gọi được khởi tạo thành công');

    } catch (error) {
      console.error('❌ Error initiating call:', error);
      return { 
        success: false, 
        error: createErrorResponse('SYSTEM_ERROR', null, error.message) 
      };
    }
  }

  async validateCallInitiation(callerId, calleeId, roomId) {
    try {
      // Check if users are different
      if (callerId === calleeId) {
        return { valid: false, errorCode: 'CANNOT_CALL_SELF' };
      }

      // Check if either user is already in a call
      if (this.userCalls.has(callerId)) {
        return { valid: false, errorCode: 'USER_ALREADY_IN_CALL' };
      }

      if (this.userCalls.has(calleeId)) {
        return { valid: false, errorCode: 'TARGET_USER_BUSY' };
      }

      // Get user info
      const callerInfo = await this.database.get(
        'SELECT id, username, nickname, avatar_url, status FROM users WHERE id = ?',
        [callerId]
      );

      const calleeInfo = await this.database.get(
        'SELECT id, username, nickname, avatar_url, status FROM users WHERE id = ?',
        [calleeId]
      );

      if (!callerInfo || !calleeInfo) {
        return { valid: false, errorCode: 'USER_NOT_FOUND' };
      }

      // ✅ IMPROVED: Check if both users are in the room (check ConnectionManager first for real-time state)
      const isCallerInRoom = this.connectionManager.isUserInRoom(callerId, roomId);
      const isCalleeInRoom = this.connectionManager.isUserInRoom(calleeId, roomId);
      
      if (!isCallerInRoom || !isCalleeInRoom) {
        console.log(`⚠️ Users not in room: Caller ${callerId} in room: ${isCallerInRoom}, Callee ${calleeId} in room: ${isCalleeInRoom}`);
        return { valid: false, errorCode: 'USERS_NOT_IN_SAME_ROOM' };
      }
      
      // Also check database to ensure room exists and is valid
      const roomCheck = await this.database.get(
        'SELECT * FROM rooms WHERE id = ? AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))',
        [roomId, callerId, calleeId, calleeId, callerId]
      );

      if (!roomCheck) {
        return { valid: false, errorCode: 'USERS_NOT_IN_SAME_ROOM' };
      }

      // Check if room has ended
      if (roomCheck.end_time) {
        return { valid: false, errorCode: 'ROOM_ENDED' };
      }

      // Check if callee has call notifications enabled
      const calleeSettings = await this.userCallSettingsModel.getSettings(calleeId);
      if (!calleeSettings.call_notifications) {
        return { valid: false, errorCode: 'CALL_NOTIFICATIONS_DISABLED' };
      }

      return { 
        valid: true, 
        callerInfo, 
        calleeInfo,
        roomInfo: roomCheck
      };

    } catch (error) {
      console.error('❌ Error validating call initiation:', error);
      return { valid: false, errorCode: 'SYSTEM_ERROR' };
    }
  }

  // === CALL ACCEPTANCE ===

  async acceptCall(callId, userId) {
    try {
      console.log(`📞 Accepting call: ${callId} by user ${userId}`);

      const callSession = this.activeCalls.get(callId);
      if (!callSession || callSession.callee_id !== userId) {
        return { success: false, error: 'Cuộc gọi không hợp lệ' };
      }

      // Clear call timeout
      this.clearCallTimeout(callId);

      // Update call status
      await this.callSessionModel.update(callId, {
        status: 'accepted',
        answeredAt: new Date().toISOString()
      });

      // Update local cache
      const updatedSession = await this.callSessionModel.findById(callId);
      this.activeCalls.set(callId, updatedSession);

      // Notify caller that call was accepted
      this.connectionManager.sendToUser(callSession.caller_id, {
        type: 'voice_call_accepted',
        callId,
        callee: {
          id: userId,
          nickname: callSession.callee_nickname
        }
      });

      // Notify callee to start WebRTC
      this.connectionManager.sendToUser(userId, {
        type: 'voice_call_start_webrtc',
        callId,
        role: 'callee'
      });

      console.log(`✅ Call accepted: ${callId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      return { success: false, error: error.message };
    }
  }

  // === CALL REJECTION ===

  async rejectCall(callId, userId, reason = 'user_rejected') {
    try {
      console.log(`📞 Rejecting call: ${callId} by user ${userId}, reason: ${reason}`);

      const callSession = this.activeCalls.get(callId);
      if (!callSession) {
        return { success: false, error: 'Cuộc gọi không tồn tại' };
      }

      // Clear call timeout
      this.clearCallTimeout(callId);

      // Update call status
      await this.callSessionModel.update(callId, {
        status: 'rejected',
        endedAt: new Date().toISOString(),
        endReason: reason
      });

      // Notify caller
      this.connectionManager.sendToUser(callSession.caller_id, {
        type: 'voice_call_rejected',
        callId,
        reason
      });

      // Cleanup
      this.cleanupCall(callId);

      console.log(`✅ Call rejected: ${callId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error rejecting call:', error);
      return { success: false, error: error.message };
    }
  }

  // === WEBRTC SIGNALING ===

  async handleWebRTCOffer(callId, userId, offer) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const callSession = this.activeCalls.get(callId);
        if (!callSession || callSession.status !== 'accepted') {
          return { success: false, error: 'Cuộc gọi không ở trạng thái hợp lệ' };
        }

        const targetUserId = userId === callSession.caller_id ? 
          callSession.callee_id : callSession.caller_id;

        // Send with timeout
        await this.sendWithTimeout(targetUserId, {
          type: 'webrtc_offer',
          callId,
          offer,
          from: userId
        }, 5000);

        console.log(`📡 WebRTC offer sent from ${userId} to ${targetUserId}`);
        return { success: true };

      } catch (error) {
        retryCount++;
        console.warn(`⚠️ WebRTC offer attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          console.error('❌ Error handling WebRTC offer after all retries:', error);
          return { success: false, error: error.message };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }
  
  async sendWithTimeout(userId, data, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Send timeout'));
      }, timeout);
      
      try {
        this.connectionManager.sendToUser(userId, data);
        clearTimeout(timer);
        resolve();
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  // === RECONNECTION HANDLING ===

  async handleReconnection(callId, userId) {
    try {
      console.log(`🔄 Handling reconnection for call ${callId} by user ${userId}`);
      
      const callSession = this.activeCalls.get(callId);
      if (!callSession) {
        return { success: false, error: 'Call session not found' };
      }

      // Verify user is part of this call
      if (callSession.caller_id !== userId && callSession.callee_id !== userId) {
        return { success: false, error: 'User not authorized for this call' };
      }

      // Update call status to indicate reconnection
      await this.callSessionModel.update(callId, {
        status: 'reconnecting'
      });

      console.log(`✅ Reconnection handled for call ${callId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error handling reconnection:', error);
      return { success: false, error: error.message };
    }
  }

  getActiveCall(callId) {
    return this.activeCalls.get(callId);
  }

  async handleWebRTCAnswer(callId, userId, answer) {
    try {
      const callSession = this.activeCalls.get(callId);
      if (!callSession) {
        return { success: false, error: 'Cuộc gọi không tồn tại' };
      }

      const targetUserId = userId === callSession.caller_id ? 
        callSession.callee_id : callSession.caller_id;

      this.connectionManager.sendToUser(targetUserId, {
        type: 'webrtc_answer',
        callId,
        answer,
        from: userId
      });

      // Mark call as active
      await this.callSessionModel.update(callId, { status: 'active' });
      
      // Update local cache
      const updatedSession = await this.callSessionModel.findById(callId);
      this.activeCalls.set(callId, updatedSession);

      // Set max call duration timeout
      this.setMaxDurationTimeout(callId);

      console.log(`📡 WebRTC answer sent from ${userId} to ${targetUserId}`);
      console.log(`✅ Call is now active: ${callId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error handling WebRTC answer:', error);
      return { success: false, error: error.message };
    }
  }

  async handleICECandidate(callId, userId, candidate) {
    try {
      const callSession = this.activeCalls.get(callId);
      if (!callSession) {
        return { success: false, error: 'Cuộc gọi không tồn tại' };
      }

      const targetUserId = userId === callSession.caller_id ? 
        callSession.callee_id : callSession.caller_id;

      this.connectionManager.sendToUser(targetUserId, {
        type: 'ice_candidate',
        callId,
        candidate,
        from: userId
      });

      return { success: true };

    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
      return { success: false, error: error.message };
    }
  }

  // === CALL CONTROL ===

  // ✅ REMOVED: toggleMute and updateAudioQuality - handled in frontend only for simplified system

  // === CALL TERMINATION ===

  async endCall(callId, userId, reason = 'user_hangup', forceEndRoom = false) {
    try {
      console.log(`📞 Ending call: ${callId} by user ${userId}, reason: ${reason}`);

      const callSession = this.activeCalls.get(callId);
      if (!callSession) {
        return { success: false, error: 'Cuộc gọi không tồn tại' };
      }

      const roomId = callSession.room_id;

      // ✅ CORE LOGIC: Check keep_active từ database (source of truth)
      // forceEndRoom = true: Explicit end room action (reason = 'room_ended'), skip check
      let endRoom = forceEndRoom;
      if (!forceEndRoom && roomId) {
        // Check từ database
        const room = await this.database.get('SELECT keep_active FROM rooms WHERE id = ?', [roomId]);
        const isKeptActive = Boolean(room?.keep_active);
        endRoom = !isKeptActive; // End room nếu chưa keep active
        console.log(`📞 Room ${roomId} keep_active: ${isKeptActive}, will end room: ${endRoom}`);
      }

      // Clear timeouts
      this.clearCallTimeout(callId);
      this.clearMaxDurationTimeout(callId);

      // Calculate duration
      const startTime = callSession.answered_at || callSession.started_at || callSession.created_at;
      const duration = startTime ? Math.floor((new Date() - new Date(startTime)) / 1000) : 0;

      // Update call session
      await this.callSessionModel.update(callId, {
        status: 'ended',
        endedAt: new Date().toISOString(),
        duration,
        endReason: reason
      });

      // ✅ NEW: End room nếu chưa keep active
      if (endRoom && roomId) {
        console.log(`📞 Room ${roomId} not kept active → Ending room`);
        
        // Import room model để end room
        const RoomModel = require('../models/Room');
        const roomModel = new RoomModel(this.database);
        await roomModel.endRoom(roomId);
        
        // Force close room via ConnectionManager
        if (this.connectionManager) {
          await this.connectionManager.forceCloseRoom(roomId);
        }
      }

      // Notify both users
      [callSession.caller_id, callSession.callee_id].forEach(id => {
        if (this.connectionManager.activeConnections.has(id)) {
          this.connectionManager.sendToUser(id, {
            type: 'voice_call_ended',
            callId,
            reason,
            duration,
            endedBy: userId,
            // ✅ FLAGS: Backend tells frontend room state
            roomStillActive: !endRoom, // true = room still active, false = room closed
            roomClosed: endRoom // true = room was closed, false = room still active
          });
        }
      });

      // Cleanup
      this.cleanupCall(callId);

      console.log(`✅ Call ended: ${callId}, duration: ${duration}s, room ended: ${endRoom}`);
      return { success: true, duration, roomEnded: endRoom };

    } catch (error) {
      console.error('❌ Error ending call:', error);
      return { success: false, error: error.message };
    }
  }

  // === TIMEOUT MANAGEMENT ===

  setCallTimeout(callId) {
    const timeoutId = setTimeout(() => {
      this.handleCallTimeout(callId);
    }, this.config.CALL_TIMEOUT);
    
    this.callTimeouts.set(callId, timeoutId);
  }

  clearCallTimeout(callId) {
    const timeoutId = this.callTimeouts.get(callId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.callTimeouts.delete(callId);
    }
  }

  setMaxDurationTimeout(callId) {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    // Get max duration from user settings (use caller's settings)
    this.userCallSettingsModel.getMaxCallDuration(callSession.caller_id)
      .then(maxDuration => {
        const timeoutId = setTimeout(() => {
          this.endCall(callId, callSession.caller_id, 'max_duration_reached');
        }, maxDuration * 1000);
        
        this.callTimeouts.set(`${callId}_max_duration`, timeoutId);
      });
  }

  clearMaxDurationTimeout(callId) {
    const timeoutId = this.callTimeouts.get(`${callId}_max_duration`);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.callTimeouts.delete(`${callId}_max_duration`);
    }
  }

  async handleCallTimeout(callId) {
    console.log(`⏱️ Call timeout: ${callId}`);
    // ✅ Áp dụng logic: check keep_active từ database
    await this.endCall(callId, null, 'timeout', false); // false = check keep_active
  }

  // === UTILITY METHODS ===

  cleanupCall(callId) {
    const callSession = this.activeCalls.get(callId);
    if (callSession) {
      this.userCalls.delete(callSession.caller_id);
      this.userCalls.delete(callSession.callee_id);
    }
    this.activeCalls.delete(callId);
    this.clearCallTimeout(callId);
    this.clearMaxDurationTimeout(callId);
  }

  // Get active call for user
  getActiveCallForUser(userId) {
    const callId = this.userCalls.get(userId);
    return callId ? this.activeCalls.get(callId) : null;
  }

  // Check if user is in a call
  isUserInCall(userId) {
    return this.userCalls.has(userId);
  }

  // Get call statistics
  getActiveCallsCount() {
    return this.activeCalls.size;
  }

  // Cleanup on user disconnect
  async handleUserDisconnect(userId) {
    const callId = this.userCalls.get(userId);
    if (callId) {
      console.log(`🔌 User ${userId} disconnected during call ${callId}`);
      // ✅ Áp dụng logic: check keep_active từ database
      await this.endCall(callId, userId, 'user_disconnect', false); // false = check keep_active
    }
  }

  // ✅ NEW: Helper method để get active call in room
  getActiveCallInRoom(roomId) {
    for (const [callId, callSession] of this.activeCalls.entries()) {
      if (callSession.room_id === roomId && callSession.status !== 'ended') {
        return { id: callId, ...callSession };
      }
    }
    return null;
  }

  // Health check
  getStatus() {
    return {
      activeCalls: this.activeCalls.size,
      activeUsers: this.userCalls.size,
      pendingTimeouts: this.callTimeouts.size
    };
  }
}

module.exports = VoiceCallService;
