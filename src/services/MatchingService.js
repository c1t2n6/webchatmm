// Matching Service for WebChat
class MatchingService {
  constructor(userModel, roomModel, connectionManager = null) {
    this.userModel = userModel;
    this.roomModel = roomModel;
    this.connectionManager = connectionManager;
    this.searchingUsers = new Map(); // user_id -> search data
    this.matchingQueue = []; // Queue of users waiting to be matched
    this.cleanupInterval = null;
    this.maxSearchTime = 5 * 60 * 1000; // 5 minutes
    this.matchingInProgress = false; // Prevent concurrent matching
    this.instanceId = Math.random().toString(36).substr(2, 9); // Debug ID
    this.startCleanupTimer();
    console.log(`🔧 MatchingService created with ID: ${this.instanceId}`);
  }

  // Start cleanup timer for expired searches
  startCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // ✅ TẠM THỜI DISABLE: Cleanup timer để debug
    console.log('🔧 Cleanup timer disabled for debugging');
    /*
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanupExpiredSearches();
        if (cleaned > 0) {
          console.log(`🧹 Cleaned up ${cleaned} expired searches`);
        }
      } catch (error) {
        console.error('❌ Cleanup timer error:', error);
      }
    }, 60000); // Run every minute
    */
  }

  // Stop cleanup timer
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Add user to search queue
  async addToSearchQueue(userId, searchData) {
    try {
      console.log(`🔍 Adding user ${userId} to search queue`);
      console.log(`🔍 Current instance ID: ${this.instanceId || 'no-id'}`);
      console.log(`🔍 Current queue state: ${JSON.stringify({
        queueSize: this.matchingQueue.length,
        searchingUsers: Array.from(this.searchingUsers.keys())
      })}`);

      // Check if user is already searching
      if (this.searchingUsers.has(userId)) {
        console.log(`⚠️ User ${userId} is already searching`);
        return { success: false, message: 'Already searching' };
      }

      // Add to searching users map
      this.searchingUsers.set(userId, {
        ...searchData,
        timestamp: new Date(),
        retryCount: 0
      });

      // Add to matching queue
      this.matchingQueue.push(userId);

      console.log(`✅ User ${userId} added to search queue`);
      console.log(`📊 Queue size: ${this.matchingQueue.length}`);
      console.log(`📊 Searching users: ${Array.from(this.searchingUsers.keys())}`);

      // Try to match immediately
      await this.tryMatch();

      return { success: true, message: 'Added to search queue' };

    } catch (error) {
      console.error(`❌ Error adding user ${userId} to search queue:`, error);
      return { success: false, message: 'Failed to add to search queue' };
    }
  }

  // Remove user from search queue
  async removeFromSearchQueue(userId) {
    try {
      console.log(`🔍 Removing user ${userId} from search queue`);

      // Remove from searching users map
      this.searchingUsers.delete(userId);

      // Remove from matching queue
      const index = this.matchingQueue.indexOf(userId);
      if (index > -1) {
        this.matchingQueue.splice(index, 1);
      }

      console.log(`✅ User ${userId} removed from search queue`);
      console.log(`📊 Queue size: ${this.matchingQueue.length}`);

      return { success: true, message: 'Removed from search queue' };

    } catch (error) {
      console.error(`❌ Error removing user ${userId} from search queue:`, error);
      return { success: false, message: 'Failed to remove from search queue' };
    }
  }

  // Try to match users in queue
  async tryMatch() {
    try {
      // Prevent concurrent matching
      if (this.matchingInProgress) {
        console.log(`⏳ Matching already in progress, skipping`);
        return null;
      }

      this.matchingInProgress = true;
      console.log(`🔍 Trying to match users, queue size: ${this.matchingQueue.length}`);

      if (this.matchingQueue.length < 2) {
        console.log(`⏳ Not enough users to match (need 2, have ${this.matchingQueue.length})`);
        this.matchingInProgress = false;
        return null;
      }

      // Get first two users from queue
      const user1Id = this.matchingQueue.shift();
      const user2Id = this.matchingQueue.shift();

      console.log(`🤝 Attempting to match user ${user1Id} with user ${user2Id}`);

      // Get user data
      const user1 = await this.userModel.findById(user1Id);
      const user2 = await this.userModel.findById(user2Id);

      if (!user1 || !user2) {
        console.log(`❌ One or both users not found`);
        this.matchingInProgress = false;
        return null;
      }

      // Check if users are still searching
      if (!this.searchingUsers.has(user1Id) || !this.searchingUsers.has(user2Id)) {
        console.log(`❌ One or both users are no longer searching`);
        this.matchingInProgress = false;
        return null;
      }

      // ✅ NEW: Check entry mode compatibility
      const user1SearchData = this.searchingUsers.get(user1Id);
      const user2SearchData = this.searchingUsers.get(user2Id);
      
      const isEntryModeCompatible = this.checkEntryModeCompatibility(user1SearchData, user2SearchData);
      if (!isEntryModeCompatible) {
        console.log(`❌ Entry mode incompatible: ${user1SearchData.entry_mode} vs ${user2SearchData.entry_mode}`);
        // Put users back in queue
        this.matchingQueue.unshift(user2Id, user1Id);
        this.matchingInProgress = false;
        return null;
      }

      // Check compatibility
      const isCompatible = await this.checkCompatibility(user1, user2);
      if (!isCompatible) {
        console.log(`❌ Users are not compatible`);
        // Put users back in queue
        this.matchingQueue.unshift(user2Id, user1Id);
        this.matchingInProgress = false;
        return null;
      }

      // Create room với entry_mode
      const entryMode = user1SearchData.entry_mode || 'chat';
      const room = await this.createRoom(user1, user2, entryMode);
      if (!room) {
        console.log(`❌ Failed to create room`);
        // Put users back in queue
        this.matchingQueue.unshift(user2Id, user1Id);
        this.matchingInProgress = false;
        return null;
      }

      // Update user statuses
      await this.userModel.updateStatus(user1Id, 'connected', room.id);
      await this.userModel.updateStatus(user2Id, 'connected', room.id);

      // ✅ SỬA: Không thêm users vào roomConnections ở đây
      // Để WebSocketHandler.addToRoom() xử lý khi users thực sự connect
      console.log(`🏠 Room ${room.id} created, users will be added when they connect via WebSocket`);

      // Remove from searching users
      this.searchingUsers.delete(user1Id);
      this.searchingUsers.delete(user2Id);

      console.log(`✅ Successfully matched user ${user1Id} with user ${user2Id} in room ${room.id}`);

      // ✅ THÊM: Broadcast match_found message to both users (chỉ gửi 1 lần)
      if (this.connectionManager) {
        // Delay ngắn để đảm bảo WebSocket connections đã sẵn sàng
        setTimeout(() => {
          this.sendMatchFoundOnce(user1Id, user2Id, room, user1, user2);
        }, 500); // Delay 500ms
      } else {
        console.log(`⚠️ No ConnectionManager available - cannot send match_found messages`);
      }

      this.matchingInProgress = false;
      return {
        success: true,
        room: room,
        user1: user1,
        user2: user2
      };

    } catch (error) {
      console.error(`❌ Error in tryMatch:`, error);
      this.matchingInProgress = false;
      return { success: false, message: 'Matching failed' };
    }
  }

  // Check if two users are compatible
  async checkCompatibility(user1, user2) {
    try {
      // Basic compatibility checks
      if (user1.id === user2.id) {
        console.log(`❌ Cannot match user with themselves`);
        return false;
      }

      // Check if users are banned
      if (await this.userModel.isBanned(user1) || await this.userModel.isBanned(user2)) {
        console.log(`❌ One or both users are banned`);
        return false;
      }

      // Check gender preferences (if specified)
      if (user1.preferred_gender && user1.preferred_gender.length > 0) {
        if (!user1.preferred_gender.includes(user2.gender)) {
          console.log(`❌ User1 gender preference not met`);
          return false;
        }
      }

      if (user2.preferred_gender && user2.preferred_gender.length > 0) {
        if (!user2.preferred_gender.includes(user1.gender)) {
          console.log(`❌ User2 gender preference not met`);
          return false;
        }
      }

      // Check if users are already in rooms
      if (user1.current_room_id || user2.current_room_id) {
        console.log(`❌ One or both users are already in rooms`);
        return false;
      }

      console.log(`✅ Users are compatible`);
      return true;

    } catch (error) {
      console.error(`❌ Error checking compatibility:`, error);
      return false;
    }
  }

  // Create room for matched users
  async createRoom(user1, user2, entryMode = 'chat') {
    try {
      console.log(`🏠 Creating room for user ${user1.id} and user ${user2.id} with entry_mode: ${entryMode}`);

      const roomData = {
        type: 'chat',
        user1_id: user1.id,
        user2_id: user2.id,
        like_responses: {},
        keep_active_responses: {},
        reveal_level: 0,
        keep_active: false,
        // ✅ NEW: Add entry mode support
        entry_mode: entryMode,
        current_mode: entryMode,
        voice_call_active: false,
        both_kept: false
      };

      const room = await this.roomModel.create(roomData);
      console.log(`✅ Room ${room.id} created successfully`);

      return room;

    } catch (error) {
      console.error(`❌ Error creating room:`, error);
      return null;
    }
  }

  // Get search queue status
  getQueueStatus() {
    return {
      queueSize: this.matchingQueue.length,
      searchingUsers: Array.from(this.searchingUsers.keys()),
      timestamp: new Date().toISOString()
    };
  }

  // Clean up expired searches
  async cleanupExpiredSearches() {
    try {
      const now = new Date();
      const expiredUsers = [];

      for (const [userId, searchData] of this.searchingUsers.entries()) {
        const searchAge = now - searchData.timestamp;

        if (searchAge > this.maxSearchTime) {
          expiredUsers.push(userId);
        }
      }

      for (const userId of expiredUsers) {
        await this.removeFromSearchQueue(userId);
        await this.userModel.updateStatus(userId, 'idle');
        console.log(`🧹 Cleaned up expired search for user ${userId}`);
      }

      return expiredUsers.length;

    } catch (error) {
      console.error(`❌ Error cleaning up expired searches:`, error);
      return 0;
    }
  }

  // Get service statistics
  getStats() {
    return {
      searchingUsers: this.searchingUsers.size,
      queueSize: this.matchingQueue.length,
      isCleanupRunning: this.cleanupInterval !== null,
      maxSearchTime: this.maxSearchTime
    };
  }

  // Graceful shutdown
  async shutdown() {
    try {
      this.stopCleanupTimer();
      
      // Clear all searching users
      for (const userId of this.searchingUsers.keys()) {
        await this.userModel.updateStatus(userId, 'idle');
      }
      
      this.searchingUsers.clear();
      this.matchingQueue = [];
      
      console.log('✅ MatchingService shutdown complete');
    } catch (error) {
      console.error('❌ Error during MatchingService shutdown:', error);
    }
  }

  // ✅ THÊM: Send match_found messages chỉ 1 lần duy nhất
  sendMatchFoundOnce(user1Id, user2Id, room, user1, user2) {
    const entryMode = room.entry_mode || 'chat';
    
    const matchMessage1 = {
      type: 'match_found',
      room_id: room.id,
      matched_user: {
        id: user2.id,
        username: user2.username,
        nickname: user2.nickname,
        avatar_url: user2.avatar_url
      },
      icebreaker: entryMode === 'voice' ? "Chào bạn! Hãy bắt đầu cuộc gọi nhé! 📞" : "Chào bạn! Hãy bắt đầu cuộc trò chuyện nhé! 😊",
      entry_mode: entryMode
    };

    const matchMessage2 = {
      type: 'match_found',
      room_id: room.id,
      matched_user: {
        id: user1.id,
        username: user1.username,
        nickname: user1.nickname,
        avatar_url: user1.avatar_url
      },
      icebreaker: entryMode === 'voice' ? "Chào bạn! Hãy bắt đầu cuộc gọi nhé! 📞" : "Chào bạn! Hãy bắt đầu cuộc trò chuyện nhé! 😊",
      entry_mode: entryMode
    };

    // Send to user1
    const sent1 = this.connectionManager.sendToUser(user1Id, matchMessage1);
    
    // Send to user2
    const sent2 = this.connectionManager.sendToUser(user2Id, matchMessage2);

    // Log kết quả
    console.log(`📤 Message sent to user ${user1Id}: ${sent1 ? 'success' : 'failed'}`);
    console.log(`📤 Message sent to user ${user2Id}: ${sent2 ? 'success' : 'failed'}`);

    if (sent1 && sent2) {
      console.log(`📢 Sent match_found messages to users ${user1Id} and ${user2Id}`);
      
      // ✅ NEW: Auto-initiate voice call if entry mode is 'voice'
      if (entryMode === 'voice') {
        console.log(`📞 Entry mode is voice - auto-initiating voice call...`);
        this.autoInitiateVoiceCall(user1Id, user2Id, room.id);
      }
    } else {
      console.log(`⚠️ Some messages failed to send, but not retrying to avoid duplicates`);
    }
  }

  // ✅ NEW: Auto-initiate voice call after matching
  async autoInitiateVoiceCall(callerId, calleeId, roomId) {
    try {
      console.log(`📞 Auto-initiating voice call: ${callerId} -> ${calleeId} in room ${roomId}`);
      
      // ✅ IMPROVED: Wait and check that both users are in the room before initiating
      const maxAttempts = 10; // 10 attempts = 5 seconds total
      let attempt = 0;
      
      const checkAndInitiate = async () => {
        attempt++;
        
        // Check if both users are in the room
        const isCallerInRoom = this.connectionManager.isUserInRoom(callerId, roomId);
        const isCalleeInRoom = this.connectionManager.isUserInRoom(calleeId, roomId);
        
        console.log(`📞 Attempt ${attempt}/${maxAttempts}: Caller ${callerId} in room: ${isCallerInRoom}, Callee ${calleeId} in room: ${isCalleeInRoom}`);
        
        if (isCallerInRoom && isCalleeInRoom) {
          // Both users are in the room, proceed with call initiation
          try {
            // Get voice call service from global instance
            const voiceCallService = global.voiceCallService;
            if (!voiceCallService) {
              console.error('❌ VoiceCallService not available for auto-initiation');
              return;
            }

            // Initiate the call
            const result = await voiceCallService.initiateCall(callerId, calleeId, roomId);
            
            if (result.success) {
              console.log(`✅ Auto voice call initiated successfully: ${result.data.callId}`);
            } else {
              console.error(`❌ Auto voice call initiation failed:`, result.error);
              // If it's a validation error, retry once more after a short delay
              if (result.error?.code === 'USERS_NOT_IN_SAME_ROOM' && attempt < maxAttempts) {
                console.log(`⚠️ Validation failed, retrying in 500ms...`);
                setTimeout(checkAndInitiate, 500);
              }
            }
          } catch (error) {
            console.error('❌ Error in auto voice call initiation:', error);
          }
        } else if (attempt < maxAttempts) {
          // Users not ready yet, wait and retry
          setTimeout(checkAndInitiate, 500); // Wait 500ms before retry
        } else {
          // Max attempts reached, users still not in room
          console.error(`❌ Auto voice call failed: Users not in room after ${maxAttempts} attempts`);
        }
      };
      
      // Start checking after initial delay
      setTimeout(checkAndInitiate, 1000); // Wait 1 second first
      
    } catch (error) {
      console.error('❌ Error setting up auto voice call:', error);
    }
  }

  // ✅ NEW: Check entry mode compatibility
  checkEntryModeCompatibility(user1SearchData, user2SearchData) {
    const user1EntryMode = user1SearchData.entry_mode || 'chat';
    const user2EntryMode = user2SearchData.entry_mode || 'chat';
    const user1Preference = user1SearchData.match_preference || 'same_entry_mode';
    const user2Preference = user2SearchData.match_preference || 'same_entry_mode';

    console.log(`🔍 Checking entry mode compatibility:`);
    console.log(`  User 1: ${user1EntryMode} (preference: ${user1Preference})`);
    console.log(`  User 2: ${user2EntryMode} (preference: ${user2Preference})`);

    // Both users prefer same entry mode
    if (user1Preference === 'same_entry_mode' && user2Preference === 'same_entry_mode') {
      const compatible = user1EntryMode === user2EntryMode;
      console.log(`  Result: ${compatible ? 'Compatible' : 'Incompatible'} (same entry mode required)`);
      return compatible;
    }

    // Allow any entry mode (future feature)
    if (user1Preference === 'any' || user2Preference === 'any') {
      console.log(`  Result: Compatible (any mode allowed)`);
      return true;
    }

    // Default: require same entry mode
    const compatible = user1EntryMode === user2EntryMode;
    console.log(`  Result: ${compatible ? 'Compatible' : 'Incompatible'} (default: same entry mode)`);
    return compatible;
  }
}

module.exports = MatchingService;
