# 🎯 Voice Call Logic Design - Comprehensive Brainstorm

## 📋 Mục tiêu
Khi 2 users cùng chọn **Voice Call Entry Mode**, mặc định cả 2 đều **auto-accept** vào call ngay lập tức, không cần bấm accept/reject.

---

## 🎯 **TÓM TẮT LOGIC CHÍNH**

### **Core Logic: End Call Behavior**

**NGUYÊN TẮC:**
- Database (`rooms.keep_active`) là **source of truth**
- Backend **LUÔN check database** trước khi quyết định
- Logic này áp dụng cho **TẤT CẢ** các trường hợp end call (hangup, disconnect, timeout, max duration)

**QUY TẮC:**
```
KHI END CALL (bất kỳ lý do nào):
  ├─ Backend check: SELECT keep_active FROM rooms WHERE id = ?
  │
  ├─ Nếu keep_active = TRUE:
  │   └─ Chỉ end call
  │   └─ Room vẫn active
  │   └─ Gửi voice_call_ended { roomStillActive: true }
  │   └─ Frontend: Auto chuyển vào chat UI
  │
  └─ Nếu keep_active = FALSE:
      └─ End call + End room
      └─ Room bị đóng
      └─ Gửi voice_call_ended { roomStillActive: false, roomClosed: true }
      └─ Frontend: Back to waiting room
```

**EXCEPTION:**
- End Room explicit (button click): Không check keep_active, luôn end room

---

## 🔄 **FLOW 1: VÀO CALL (Voice Entry Mode)**

### **Scenario: Cả 2 users đều chọn Voice Call Entry Mode**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: MATCHING                                           │
└─────────────────────────────────────────────────────────────┘
User 1: Click "Tìm kiếm" với entry_mode = 'voice'
User 2: Click "Tìm kiếm" với entry_mode = 'voice'
→ MatchingService tìm thấy match
→ Tạo room với entry_mode = 'voice'

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: JOIN ROOM                                          │
└─────────────────────────────────────────────────────────────┘
Backend: 
  - Gửi match_found event cho cả 2 users
  - Kèm theo: { room_id, matched_user, entry_mode: 'voice' }

Frontend (User 1 & User 2):
  - Nhận match_found
  - Gọi handleVoiceMatchFound()
  - Auto join room: enterChatRoom(room_id)
  - Set currentMode = 'voice'

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: AUTO-INITIATE CALL (Backend)                       │
└─────────────────────────────────────────────────────────────┘
MatchingService.autoInitiateVoiceCall():
  - Wait 2s để users join room xong
  - VoiceCallService.initiateCall(callerId, calleeId, roomId)
  - Tạo call session với status = 'initiated'
  - Gửi voice_call_incoming cho cả 2 users

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: AUTO-ACCEPT CALL (Frontend + Backend)              │
└─────────────────────────────────────────────────────────────┘
⚠️ CRITICAL CHANGE: Vì cả 2 đều chọn voice mode → Auto-accept!

Frontend (User 1 & User 2):
  - Nhận voice_call_incoming
  - Kiểm tra: entry_mode === 'voice'?
  - ✅ YES → Auto accept (không hiện accept/reject buttons)
  - Gửi voice_call_accept ngay lập tức

Backend:
  - Nhận voice_call_accept từ User 1 (callee)
  - VoiceCallService.acceptCall(callId, userId)
  - Update status = 'accepted'
  - Gửi voice_call_accepted cho caller (User 2)
  - Gửi voice_call_start_webrtc cho cả 2 users

┌─────────────────────────────────────────────────────────────┐
│ STEP 5: START WEBRTC (Frontend)                            │
└─────────────────────────────────────────────────────────────┘
Frontend (User 1 & User 2):
  - Nhận voice_call_start_webrtc
  - Request microphone permission
  - Create RTCPeerConnection
  - User 1 (caller): Create offer → Send webrtc_offer
  - User 2 (callee): Receive offer → Create answer → Send webrtc_answer
  - Exchange ICE candidates
  - Connection state: connecting → connected
  - Show "Đang gọi..." → "Đang nói chuyện..."

```

---

## 🚪 **FLOW 2: THOÁT CALL & END ROOM (Logic Rõ Ràng & Nhất Quán)**

### **⚠️ QUAN TRỌNG: Keep Active là tính năng của Chat Room**

**Keep Active (Giữ cuộc trò chuyện)** là tính năng được quản lý bởi **Chat Room Module**, không phải Voice Call:
- Keep active được set khi user click "Giữ cuộc trò chuyện" trong chat room
- State được lưu trong database (`rooms.keep_active`) và chat room state (keepActiveManager)
- Voice call module **chỉ check** state này khi end call để quyết định có end room không
- Keep active state được **share** giữa chat và voice call (cùng 1 room)

### **⚠️ ⚠️ ⚠️ CORE LOGIC: End Call Behavior**

**NGUYÊN TẮC CHUNG**: 
- **Database là source of truth** cho `keep_active` state
- **Backend kiểm tra `rooms.keep_active` từ database** trước khi quyết định có end room không
- **Frontend check state** để UX tốt hơn (hiển thị đúng UI), nhưng backend luôn verify

**LOGIC ÁP DỤNG CHO TẤT CẢ TRƯỜNG HỢP END CALL:**

```
KHI END CALL:
  ├─ Backend check: rooms.keep_active = true?
  │  ├─ YES → Chỉ end call, KHÔNG end room
  │  │   └─ Gửi voice_call_ended { roomStillActive: true }
  │  └─ NO → End call + End room
  │      └─ Gửi voice_call_ended { roomStillActive: false, roomClosed: true }
  │      └─ Gửi room_closed event
```

**KẾT QUẢ:**
- ✅ **Nếu keep_active = true**: End call → Room vẫn active → Auto chuyển vào chat UI
- ❌ **Nếu keep_active = false**: End call → End room → Back to waiting room

---

### **2.1. User bấm HANGUP button (End Call)**

```
Frontend Flow:
  1. User click hangup button
  2. VoiceCallManager.hangup()
  3. Check frontend state: isRoomKeptActive()? (for UX preview)
  4. Gửi voice_call_hangup event với { callId, reason: 'user_hangup' }
  5. Cleanup local stream, peer connection
  6. Hide call UI

Backend Flow:
  1. Nhận voice_call_hangup
  2. VoiceCallService.endCall(callId, userId, 'user_hangup')
  3. ✅ Check database: SELECT keep_active FROM rooms WHERE id = ?
  4. Quyết định:
     - keep_active = true → Chỉ end call
     - keep_active = false → End call + End room
  5. Gửi voice_call_ended với flags tương ứng

Frontend (sau khi nhận voice_call_ended):
  - Check data.roomStillActive và data.roomClosed
  - roomStillActive = true → Auto chuyển vào chat UI
  - roomClosed = true → Back to waiting room
```

---

### **2.2. User click "Kết thúc phòng" (End Room - Explicit Action)**

```
⚠️ ĐÂY LÀ HÀNH ĐỘNG KHÁC: End Room = End tất cả (call + chat) - KHÔNG PHỤ THUỘC keep_active

Frontend Flow:
  1. User click "Kết thúc phòng" button
  2. Nếu đang call → End call trước (với reason = 'room_ended', force end room = true)
  3. Gửi end_room event hoặc call API /chat/end/:roomId

Backend Flow:
  1. ConnectionManager.forceCloseRoom(roomId) hoặc roomModel.endRoom(roomId)
  2. Nếu có active call → VoiceCallService.endCall() với reason = 'room_ended', shouldEndRoom = true
  3. End call (không check keep_active vì đây là explicit end room action)
  4. End room (update database, close connections)
  5. Gửi voice_call_ended { roomStillActive: false, roomClosed: true }
  6. Gửi room_closed event cho cả 2 users

Frontend (sau khi nhận room_closed):
  - Hide chat UI, hide call UI
  - Show waiting room
  - Reset room state
  - Users phải match lại để chat
```

---

### **2.3. User đóng tab/đóng browser (End Call)**

```
Browser Flow:
  1. beforeunload event triggered
  2. WebSocket disconnect event

Backend Flow:
  1. ConnectionManager.handleDisconnect(userId)
  2. VoiceCallService.handleUserDisconnect(userId)
  3. VoiceCallService.endCall(callId, userId, 'user_disconnect')
  4. ✅ Check database: SELECT keep_active FROM rooms WHERE id = ?
  5. Quyết định:
     - keep_active = true → Chỉ end call
     - keep_active = false → End call + End room
  6. Gửi voice_call_ended cho user còn lại với flags tương ứng

Frontend (user còn lại):
  - Nhận voice_call_ended
  - Check data.roomStillActive và data.roomClosed
  - roomStillActive = true → Auto chuyển vào chat UI
  - roomClosed = true → Back to waiting room
```

---

### **2.4. User mất kết nối mạng (End Call)**

```
Frontend Flow:
  1. WebSocket disconnect event
  2. VoiceCallManager.onCallDisconnected()
  3. Show reconnection UI
  4. Attempt reconnection (trong vài giây)
  5. Nếu reconnect thất bại → End call

Backend Flow:
  1. ConnectionManager.handleDisconnect(userId)
  2. VoiceCallService.handleUserDisconnect(userId)
  3. VoiceCallService.endCall(callId, userId, 'network_disconnect')
  4. ✅ Check database: SELECT keep_active FROM rooms WHERE id = ?
  5. Quyết định:
     - keep_active = true → Chỉ end call
     - keep_active = false → End call + End room
  6. Gửi voice_call_ended cho user còn lại với flags tương ứng

Frontend (user còn lại):
  - Nhận voice_call_ended
  - Check data.roomStillActive và data.roomClosed
  - roomStillActive = true → Auto chuyển vào chat UI
  - roomClosed = true → Back to waiting room
```

---

### **2.5. Call timeout (30s không accept) - End Call**

```
Backend Flow:
  1. VoiceCallService.initiateCall() tạo timeout 30s
  2. Timeout expires
  3. VoiceCallService.handleCallTimeout(callId)
  4. VoiceCallService.endCall(callId, null, 'timeout')
  5. ✅ Check database: SELECT keep_active FROM rooms WHERE id = ?
  6. Quyết định:
     - keep_active = true → Chỉ end call
     - keep_active = false → End call + End room
  7. Gửi voice_call_ended cho cả 2 users với flags tương ứng

Frontend:
  - Nhận voice_call_ended
  - Check data.roomStillActive và data.roomClosed
  - roomStillActive = true → Auto chuyển vào chat UI (nếu đang trong chat)
  - roomClosed = true → Back to waiting room
```

---

### **2.6. Max call duration reached (1 hour) - End Call**

```
Backend Flow:
  1. VoiceCallService.setMaxDurationTimeout(callId)
  2. Timeout expires sau 1 hour
  3. VoiceCallService.endCall(callId, userId, 'max_duration_reached')
  4. ✅ Check database: SELECT keep_active FROM rooms WHERE id = ?
  5. Quyết định:
     - keep_active = true → Chỉ end call
     - keep_active = false → End call + End room
  6. Gửi voice_call_ended cho cả 2 users với flags tương ứng

Frontend:
  - Nhận voice_call_ended
  - Check data.roomStillActive và data.roomClosed
  - roomStillActive = true → Auto chuyển vào chat UI
  - roomClosed = true → Back to waiting room
```

---

### **📝 TÓM TẮT: End Call Logic**

**NGUYÊN TẮC:**
- ✅ **Database (`rooms.keep_active`) là source of truth**
- ✅ **Backend LUÔN check database trước khi quyết định**
- ✅ **Frontend check state chỉ để UX tốt hơn, không phải để quyết định logic**

**ÁP DỤNG CHO TẤT CẢ TRƯỜNG HỢP:**
- ✅ User hangup (2.1)
- ✅ User disconnect (2.3)
- ✅ Network disconnect (2.4)
- ✅ Call timeout (2.5)
- ✅ Max duration reached (2.6)

**EXCEPTION:**
- ❌ **End Room explicit (2.2)**: KHÔNG check keep_active, luôn end room

---

## ⚠️ **EDGE CASES & HANDLING**

### **EC1: User 2 chưa join room khi User 1 initiate call**

```
Problem:
  - Matching xong, User 1 join room trước
  - Backend auto-initiate call ngay
  - User 2 chưa join room → Không nhận được voice_call_incoming

Solution:
  ✅ MatchingService.autoInitiateVoiceCall() phải đợi cả 2 users join room
  ✅ Check: connectionManager.getUsersInRoom(roomId).length === 2
  ✅ Nếu chưa đủ 2 users → Wait thêm 2-3s, retry
  ✅ Hoặc đợi User 2 join room trước khi initiate
```

### **EC2: User reject sau khi auto-accept (should not happen)**

```
Problem:
  - Voice entry mode đã auto-accept
  - Nhưng user vẫn có thể reject (edge case)

Solution:
  ✅ Disable reject button khi entry_mode === 'voice'
  ✅ Hoặc cho phép reject nhưng end room luôn
  ✅ Nếu reject → End call + End room + Back to waiting room
```

### **EC3: Multiple rapid hangup attempts**

```
Problem:
  - User bấm hangup nhiều lần liên tiếp
  - Gửi nhiều voice_call_hangup events

Solution:
  ✅ Throttle hangup button (disable sau khi click)
  ✅ Backend check: call status đã 'ended' → Ignore duplicate hangup
  ✅ Return success nhưng không process lại
```

### **EC4: User disconnect trước khi call connected**

```
Problem:
  - Call đang ở trạng thái 'initiated' hoặc 'accepted'
  - User disconnect → WebRTC chưa connected

Solution:
  ✅ VoiceCallService.handleUserDisconnect() check call status
  ✅ Nếu status = 'initiated' → Reject với reason = 'user_disconnect'
  ✅ Nếu status = 'accepted' → End với reason = 'user_disconnect'
  ✅ Cleanup properly
```

### **EC5: WebRTC connection fails sau khi accept**

```
Problem:
  - Call accepted
  - Nhưng WebRTC không connect được (ICE failed, network issue)

Solution:
  ✅ Frontend: ICE connection failed → Show error
  ✅ Gửi webrtc_error event cho backend
  ✅ Backend có thể auto-end call sau 30s nếu WebRTC không connect
  ✅ Hoặc để user tự end call
```

### **EC6: User 1 và User 2 cùng initiate call**

```
Problem:
  - Cả 2 users đều click "Bắt đầu gọi" cùng lúc
  - Tạo 2 calls khác nhau

Solution:
  ✅ Chỉ cho phép 1 caller (User 1)
  ✅ Backend: initiateCall() check isUserInCall()
  ✅ Nếu user đã trong call → Return error
  ✅ Frontend: Disable "Bắt đầu gọi" button khi đã có call
```

### **EC7: Call timeout nhưng user vẫn đang connect**

```
Problem:
  - Timeout 30s nhưng WebRTC đang connecting
  - End call quá sớm

Solution:
  ✅ Extend timeout nếu call đã accepted
  ✅ Hoặc chỉ timeout nếu status = 'initiated'
  ✅ Nếu accepted → Không timeout, chỉ timeout max duration
```

---

## 🔧 **IMPLEMENTATION CHANGES NEEDED**

### **1. Backend: Auto-accept logic trong initiateCall()**

```javascript
// src/services/VoiceCallService.js
async initiateCall(callerId, calleeId, roomId) {
  // ... existing code ...
  
  // ✅ NEW: Check if entry_mode is 'voice' → Auto-accept
  const room = await this.database.get('SELECT entry_mode FROM rooms WHERE id = ?', [roomId]);
  const isVoiceEntryMode = room?.entry_mode === 'voice';
  
  if (isVoiceEntryMode) {
    // Auto-accept immediately
    await this.acceptCall(callId, calleeId); // calleeId accepts
  } else {
    // Normal flow: Send voice_call_incoming, wait for accept
    this.connectionManager.sendToUser(calleeId, {
      type: 'voice_call_incoming',
      callId,
      caller: { ... },
      roomId
    });
  }
}
```

### **2. Frontend: Skip accept/reject UI cho voice entry mode**

```javascript
// static/js/modules/voice_call_manager.js
handleIncomingCall(data) {
  // Check if voice entry mode
  const isVoiceEntryMode = this.app.currentRoom?.entry_mode === 'voice';
  
  if (isVoiceEntryMode) {
    // Auto-accept, skip accept/reject UI
    this.autoAcceptCall(data.callId);
  } else {
    // Show accept/reject buttons
    this.showCallAcceptUI(data);
  }
}

async autoAcceptCall(callId) {
  // Auto-accept without showing buttons
  await this.requestMicrophonePermission();
  await this.createPeerConnection();
  
  this.webSocketManager.send('voice_call_accept', { callId });
  this.updateCallStatus('Đang kết nối...', 'Chấp nhận cuộc gọi');
}
```

### **3. Backend: Ensure both users joined before auto-initiate**

```javascript
// src/services/MatchingService.js
async autoInitiateVoiceCall(callerId, calleeId, roomId) {
  // ✅ Wait và check cả 2 users đã join room
  let attempts = 0;
  const maxAttempts = 5; // 5 attempts = 10 seconds
  
  while (attempts < maxAttempts) {
    const usersInRoom = this.connectionManager.getUsersInRoom(roomId);
    
    if (usersInRoom && usersInRoom.length >= 2) {
      // Both users joined → Initiate call
      const result = await voiceCallService.initiateCall(callerId, calleeId, roomId);
      return result;
    }
    
    // Wait 2s before retry
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  
  console.warn('⚠️ Users not ready for auto voice call initiation');
}
```

### **4. Frontend: Handle disconnect gracefully**

```javascript
// static/js/modules/voice_call_manager.js
onCallDisconnected(reason) {
  if (this.callState === this.CALL_STATES.CONNECTED) {
    // Call was connected → Show reconnection attempt
    this.showReconnectionUI();
    this.attemptReconnection();
  } else {
    // Call not connected → End call
    this.endCall(reason);
  }
}
```

### **5. Frontend: Hangup và handle voice_call_ended event**

```javascript
// static/js/modules/voice_call_manager.js
async hangup() {
  try {
    console.log('📞 User hanging up call');
    
    // ✅ SIMPLIFIED: Chỉ gửi hangup event, backend sẽ quyết định có end room không
    this.webSocketManager.send('voice_call_hangup', {
      callId: this.currentCall?.callId,
      reason: 'user_hangup'
    });
    
    // Cleanup local call resources
    await this.cleanupCall();
    this.hideCallUI();
    
    // ✅ NOTE: Không end room ở đây, đợi backend response
    // Backend sẽ check keep_active và quyết định có end room không
    
  } catch (error) {
    console.error('❌ Error hanging up:', error);
    this.cleanupCall();
    this.hideCallUI();
  }
}

// Handle voice_call_ended event (from backend)
socket.on('voice_call_ended', (data) => {
  console.log('📞 Call ended event received:', data);
  
  // Cleanup call
  this.cleanupCall();
  this.hideCallUI();
  
  // ✅ LOGIC: Check backend flags để quyết định UI
  if (data.roomClosed === true || data.roomStillActive === false) {
    // Room đã bị đóng → Back to waiting room
    console.log('📞 Call ended, room closed → Back to waiting');
    this.app.backToWaiting();
  } else if (data.roomStillActive === true) {
    // Room vẫn active → Auto chuyển vào chat UI
    console.log('📞 Call ended, room still active → Switching to chat');
    this.app.chatModule.showChatRoom();
    this.app.uiModule.showChatRoom();
  } else {
    // Fallback: Check frontend state (nếu backend không gửi flags)
    const isKeptActive = this.app.chatModule?.isRoomKeptActive?.() || false;
    if (isKeptActive) {
      console.log('📞 Call ended, frontend shows kept active → Switching to chat');
      this.app.chatModule.showChatRoom();
      this.app.uiModule.showChatRoom();
    } else {
      console.log('📞 Call ended, no flags → Back to waiting');
      this.app.backToWaiting();
    }
  }
});
```

### **5a. Chat Module: Method để check room kept active**

```javascript
// static/js/modules/chat_refactored.js hoặc keep_active_manager.js
// ✅ Method để check xem room đã được keep active chưa
isRoomKeptActive() {
  // Check từ keep active manager
  if (this.keepActiveManager) {
    return this.keepActiveManager.isRoomKeptActive(this.app.currentRoom?.id);
  }
  
  // Hoặc check từ room state
  return this.app.currentRoom?.keep_active === true;
}

// Trong KeepActiveManager:
isRoomKeptActive(roomId) {
  if (!roomId) return false;
  
  // Check từ state hoặc backend
  const roomState = this.getRoomState(roomId);
  return roomState?.keptActive === true;
}
```

### **6. Backend: End call - Check keep active để quyết định có end room không**

```javascript
// src/services/VoiceCallService.js
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
    
    // Cleanup call
    this.cleanupCall(callId);
    
    console.log(`✅ Call ended: ${callId}, duration: ${duration}s, room ended: ${endRoom}`);
    return { success: true, duration, roomEnded: endRoom };
    
  } catch (error) {
    console.error('❌ Error ending call:', error);
    return { success: false, error: error.message };
  }
}

// ✅ UPDATE: handleUserDisconnect cũng áp dụng logic này
async handleUserDisconnect(userId) {
  const callId = this.userCalls.get(userId);
  if (callId) {
    console.log(`🔌 User ${userId} disconnected during call ${callId}`);
    // ✅ Áp dụng logic: check keep_active từ database
    await this.endCall(callId, userId, 'user_disconnect', false); // false = check keep_active
  }
}

// ✅ UPDATE: handleCallTimeout cũng áp dụng logic này
async handleCallTimeout(callId) {
  console.log(`⏱️ Call timeout: ${callId}`);
  // ✅ Áp dụng logic: check keep_active từ database
  await this.endCall(callId, null, 'timeout', false); // false = check keep_active
}
```

### **7. Backend: End room phải end call trước**

```javascript
// src/services/ConnectionManager.js
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
    
    // Then close room
    const usersInRoom = this.getUsersInRoom(roomId);
    
    // Broadcast room_closed
    await this.broadcastToRoom({
      type: 'room_closed',
      roomId,
      message: 'Phòng đã được đóng'
    }, roomId);
    
    // Cleanup room connections
    for (const userId of usersInRoom) {
      this.userRooms.delete(userId);
    }
    this.roomConnections.delete(roomId);
    
    console.log(`✅ Room ${roomId} force closed successfully`);
    
  } catch (error) {
    console.error('❌ Error force closing room:', error);
    throw error;
  }
}

// ✅ NEW: Helper method để get active call in room
// src/services/VoiceCallService.js
getActiveCallInRoom(roomId) {
  for (const [callId, callSession] of this.activeCalls.entries()) {
    if (callSession.room_id === roomId && callSession.status !== 'ended') {
      return { id: callId, ...callSession };
    }
  }
  return null;
}
```

---

## 📊 **STATE MACHINE**

```
┌─────────────┐
│   IDLE      │
└──────┬──────┘
       │ User clicks "Tìm kiếm" (voice mode)
       ▼
┌─────────────┐
│  MATCHING   │
└──────┬──────┘
       │ Match found
       ▼
┌─────────────┐
│ JOINING     │ (Join room)
└──────┬──────┘
       │ Both users joined
       ▼
┌─────────────┐
│ INITIATED   │ (Call created)
└──────┬──────┘
       │ Voice entry mode → AUTO-ACCEPT
       ▼
┌─────────────┐
│  ACCEPTED   │
└──────┬──────┘
       │ Start WebRTC
       ▼
┌─────────────┐
│ CONNECTING  │ (WebRTC connecting)
└──────┬──────┘
       │ ICE connected
       ▼
┌─────────────┐
│  CONNECTED  │ (Call active)
└──────┬──────┘
       │ Hangup / Disconnect / Timeout / Max duration
       ▼
┌─────────────┐
│    ENDED    │
└─────────────┘
```

---

## ✅ **CHECKLIST IMPLEMENTATION**

### **Auto-Accept Logic:**
- [ ] Backend: Auto-accept logic trong VoiceCallService.initiateCall()
- [ ] Backend: Check both users joined before auto-initiate
- [ ] Frontend: Skip accept/reject UI cho voice entry mode
- [ ] Frontend: Auto-accept khi nhận voice_call_incoming (voice mode)

### **End Call Logic:**
- [ ] Backend: Implement `endCall()` với `forceEndRoom` parameter
- [ ] Backend: Check `rooms.keep_active` từ database trong `endCall()`
- [ ] Backend: End room nếu `keep_active = false`, chỉ end call nếu `keep_active = true`
- [ ] Backend: Gửi `voice_call_ended` với `roomStillActive` và `roomClosed` flags
- [ ] Backend: Update `handleUserDisconnect()` để áp dụng logic
- [ ] Backend: Update `handleCallTimeout()` để áp dụng logic
- [ ] Backend: Implement `getActiveCallInRoom()` helper method
- [ ] Frontend: Simplify `hangup()` - chỉ gửi event, không end room
- [ ] Frontend: Handle `voice_call_ended` event với backend flags
- [ ] Frontend: Auto switch to chat nếu `roomStillActive = true`
- [ ] Frontend: Back to waiting nếu `roomClosed = true`
- [ ] Backend: `forceCloseRoom()` gọi `endCall()` với `forceEndRoom = true`

### **Error Handling:**
- [ ] Frontend: Handle disconnect gracefully với reconnection
- [ ] Frontend: Disable reject button khi voice entry mode
- [ ] Frontend: Throttle hangup button
- [ ] Backend: Handle duplicate hangup attempts
- [ ] Backend: Handle disconnect before call connected
- [ ] Backend: Extend timeout nếu call đã accepted
- [ ] Frontend: Show proper error messages

### **Testing:**
- [ ] Test: End call khi room đã keep active → Chỉ end call, auto chuyển vào chat
- [ ] Test: End call khi room chưa keep active → End call = End room, back to waiting
- [ ] Test: Keep active từ chat room trước khi call → End call → Auto chuyển vào chat
- [ ] Test: Keep active trong khi đang call → End call → Auto chuyển vào chat
- [ ] Test: Voice call entry mode, end call khi chưa keep → End room
- [ ] Test: End room khi đang call → End call trước, rồi end room
- [ ] Test: End room khi không call → Chỉ end room
- [ ] Test: Test tất cả edge cases

---

## 🎯 **SUMMARY**

**Core Logic:**
- ✅ Voice Entry Mode = Auto-accept (cả 2 users)
- ✅ Không hiện accept/reject buttons
- ✅ Start WebRTC ngay sau khi match
- ✅ Handle disconnect gracefully
- ✅ Cleanup properly khi call end

**End Call vs End Room (QUAN TRỌNG - LOGIC MỚI):**

**NGUYÊN TẮC:**
- ✅ **Database (`rooms.keep_active`) là source of truth**
- ✅ **Backend LUÔN check database trước khi quyết định**
- ✅ **Frontend chỉ handle UI dựa trên backend flags**

**END CALL BEHAVIOR (Áp dụng cho TẤT CẢ trường hợp end call):**
- ✅ **Nếu `rooms.keep_active = true`**: 
  - Chỉ end call, KHÔNG end room
  - Room vẫn active, users vẫn trong room
  - Auto chuyển vào chat UI
  - Có thể chat tiếp, có thể gọi lại
  
- ❌ **Nếu `rooms.keep_active = false`**: 
  - End call = End room (kết thúc toàn bộ)
  - Room bị đóng, users bị đưa ra khỏi room
  - Back to waiting room
  - Phải match lại để chat

**END ROOM (Explicit Action):**
- ✅ **End Room button click**: 
  - Force end call với `forceEndRoom = true` (không check keep_active)
  - End room luôn, không phụ thuộc keep_active
  - Users bị đưa ra khỏi room, phải match lại

**ÁP DỤNG CHO:**
- ✅ User hangup (2.1)
- ✅ User disconnect (2.3)  
- ✅ Network disconnect (2.4)
- ✅ Call timeout (2.5)
- ✅ Max duration reached (2.6)
- ❌ End Room explicit (2.2) - Exception: luôn end room

**Key Improvements:**
1. **Auto-accept** cho voice entry mode
2. **Ensure both users joined** trước khi initiate
3. **End call logic** phân biệt rõ với end room
4. **Auto-switch to chat** khi end call (nếu room kept active)
5. **Better error handling** cho edge cases
6. **Graceful disconnect** với reconnection attempt
7. **Prevent duplicate operations** (hangup, accept, reject)
