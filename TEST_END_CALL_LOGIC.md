# 🧪 Test Checklist: End Call Logic với Keep Active

## 📋 **Pre-Test Setup**
- [ ] Server đang chạy (`npm start`)
- [ ] Database đã được khởi tạo
- [ ] WebSocket connection hoạt động
- [ ] Có 2 user accounts để test (hoặc 2 tab cùng 1 user)
- [ ] Browser console mở để xem logs

---

## 🎯 **Test Cases: End Call Logic**

### **Test Case 1: End Call khi Room CHƯA Keep Active**
**Mục tiêu:** Xác nhận khi end call mà room chưa keep active thì sẽ end cả room

**Steps:**
1. [ ] User 1 và User 2 match nhau (chat hoặc voice call entry mode)
2. [ ] User 1 hoặc User 2 click "Voice Call" để vào call
3. [ ] Đảm bảo room CHƯA được keep active (không click "Giữ cuộc trò chuyện")
4. [ ] Trong khi đang call, User 1 hoặc User 2 click "Hangup" (kết thúc cuộc gọi)
5. [ ] **Expected Result:**
   - [ ] Call kết thúc
   - [ ] Room cũng bị đóng
   - [ ] Cả 2 users quay về waiting room
   - [ ] Console log: `Room X not kept active → Ending room`
   - [ ] Console log: `roomClosed: true` hoặc `roomStillActive: false`

**Backend Log Check:**
```
📞 Ending call: {callId} by user {userId}, reason: user_hangup
📞 Room {roomId} keep_active: false, will end room: true
📞 Room {roomId} not kept active → Ending room
✅ Call ended: {callId}, duration: Xs, room ended: true
```

**Frontend Log Check:**
```
📞 Call ended event received: { roomClosed: true, roomStillActive: false }
📞 Call ended, room closed → Back to waiting
```

---

### **Test Case 2: End Call khi Room ĐÃ Keep Active**
**Mục tiêu:** Xác nhận khi end call mà room đã keep active thì chỉ end call, không end room

**Steps:**
1. [ ] User 1 và User 2 match nhau và vào chat room
2. [ ] User 1 hoặc User 2 click "Giữ cuộc trò chuyện" (Keep Active)
3. [ ] User 1 hoặc User 2 click "Voice Call" để vào call
4. [ ] Trong khi đang call, User 1 hoặc User 2 click "Hangup"
5. [ ] **Expected Result:**
   - [ ] Call kết thúc
   - [ ] Room VẪN còn active (không bị đóng)
   - [ ] Cả 2 users TỰ ĐỘNG chuyển vào chat UI
   - [ ] Console log: `Room X keep_active: true, will end room: false`
   - [ ] Console log: `roomStillActive: true`

**Backend Log Check:**
```
📞 Ending call: {callId} by user {userId}, reason: user_hangup
📞 Room {roomId} keep_active: true, will end room: false
✅ Call ended: {callId}, duration: Xs, room ended: false
```

**Frontend Log Check:**
```
📞 Call ended event received: { roomStillActive: true, roomClosed: false }
📞 Call ended, room still active → Switching to chat
```

---

### **Test Case 3: Keep Active TRƯỚC KHI Call**
**Mục tiêu:** Xác nhận keep active trước khi call thì end call sẽ chuyển vào chat

**Steps:**
1. [ ] User 1 và User 2 match nhau và vào chat room
2. [ ] User 1 hoặc User 2 click "Giữ cuộc trò chuyện" (Keep Active)
3. [ ] User 1 hoặc User 2 click "Voice Call" để vào call
4. [ ] Trong khi đang call, User 1 hoặc User 2 click "Hangup"
5. [ ] **Expected Result:**
   - [ ] Call kết thúc
   - [ ] Auto chuyển vào chat UI
   - [ ] Có thể chat tiếp, có thể gọi lại

**Verification:**
- [ ] Check database: `SELECT keep_active FROM rooms WHERE id = ?` → Should be `1` (true)
- [ ] Check backend log: `roomStillActive: true`
- [ ] Check frontend: Chat UI hiển thị, không về waiting room

---

### **Test Case 4: Keep Active TRONG KHI ĐANG Call**
**Mục tiêu:** Xác nhận keep active trong khi call thì end call vẫn chuyển vào chat

**Steps:**
1. [ ] User 1 và User 2 match nhau
2. [ ] User 1 hoặc User 2 click "Voice Call" để vào call
3. [ ] **TRONG KHI ĐANG CALL**, User 1 hoặc User 2 vào chat room và click "Giữ cuộc trò chuyện"
4. [ ] Trong khi đang call, User 1 hoặc User 2 click "Hangup"
5. [ ] **Expected Result:**
   - [ ] Call kết thúc
   - [ ] Auto chuyển vào chat UI
   - [ ] Room vẫn active

**Verification:**
- [ ] Check database: `keep_active = 1`
- [ ] Check backend log: `roomStillActive: true`
- [ ] Check frontend: Auto switch to chat

---

### **Test Case 5: Voice Call Entry Mode - End Call khi CHƯA Keep**
**Mục tiêu:** Xác nhận voice call entry mode mà chưa keep thì end call = end room

**Steps:**
1. [ ] User 1 và User 2 đều chọn "Voice Call Entry Mode"
2. [ ] Match và vào call ngay
3. [ ] Đảm bảo CHƯA keep active
4. [ ] User 1 hoặc User 2 click "Hangup"
5. [ ] **Expected Result:**
   - [ ] Call kết thúc
   - [ ] Room bị đóng
   - [ ] Back to waiting room

**Verification:**
- [ ] Check database: Room should have `end_time` set
- [ ] Check backend log: `roomClosed: true`
- [ ] Check frontend: Back to waiting room

---

### **Test Case 6: End Room khi ĐANG Call**
**Mục tiêu:** Xác nhận end room khi đang call thì end call trước rồi mới end room

**Steps:**
1. [ ] User 1 và User 2 đang trong call
2. [ ] User 1 hoặc User 2 click "Kết thúc phòng" (End Room button)
3. [ ] **Expected Result:**
   - [ ] Call bị end trước (với `reason: 'room_ended'`, `forceEndRoom: true`)
   - [ ] Room bị đóng
   - [ ] Cả 2 users quay về waiting room

**Backend Log Check:**
```
🔒 Force closing room {roomId}
📞 Ending call {callId} before closing room
📞 Ending call: {callId} by user null, reason: room_ended
✅ Call ended: {callId}, duration: Xs, room ended: true
✅ Room {roomId} force closed successfully
```

**Frontend Log Check:**
```
📞 Call ended event received: { roomClosed: true, roomStillActive: false }
🔍 Chat - Room closed notification received
```

---

### **Test Case 7: User Disconnect khi ĐANG Call (CHƯA Keep)**
**Mục tiêu:** Xác nhận user disconnect khi call chưa keep thì end call = end room

**Steps:**
1. [ ] User 1 và User 2 đang trong call
2. [ ] Đảm bảo room CHƯA keep active
3. [ ] User 1 đóng tab/đóng browser
4. [ ] **Expected Result:**
   - [ ] User 2 nhận được `voice_call_ended` event
   - [ ] Room bị đóng
   - [ ] User 2 quay về waiting room

**Backend Log Check:**
```
🔌 User {userId} disconnected during call {callId}
📞 Room {roomId} keep_active: false, will end room: true
📞 Room {roomId} not kept active → Ending room
```

**Frontend Log (User 2):**
```
📞 Call ended event received: { roomClosed: true }
📞 Call ended, room closed → Back to waiting
```

---

### **Test Case 8: User Disconnect khi ĐANG Call (ĐÃ Keep)**
**Mục tiêu:** Xác nhận user disconnect khi call đã keep thì chỉ end call, room vẫn active

**Steps:**
1. [ ] User 1 và User 2 đang trong call
2. [ ] Room ĐÃ được keep active
3. [ ] User 1 đóng tab/đóng browser
4. [ ] **Expected Result:**
   - [ ] User 2 nhận được `voice_call_ended` event
   - [ ] Room VẪN active
   - [ ] User 2 auto chuyển vào chat UI

**Backend Log Check:**
```
🔌 User {userId} disconnected during call {callId}
📞 Room {roomId} keep_active: true, will end room: false
```

**Frontend Log (User 2):**
```
📞 Call ended event received: { roomStillActive: true }
📞 Call ended, room still active → Switching to chat
```

---

### **Test Case 9: Call Timeout (CHƯA Keep)**
**Mục tiêu:** Xác nhận call timeout khi chưa keep thì end call = end room

**Steps:**
1. [ ] User 1 và User 2 match nhau
2. [ ] User 1 initiate call nhưng User 2 KHÔNG accept (hoặc timeout sau 30s)
3. [ ] Đảm bảo room CHƯA keep active
4. [ ] Đợi timeout (30 giây)
5. [ ] **Expected Result:**
   - [ ] Call timeout → end call
   - [ ] Room bị đóng
   - [ ] Back to waiting room

**Backend Log Check:**
```
⏱️ Call timeout: {callId}
📞 Room {roomId} keep_active: false, will end room: true
```

---

### **Test Case 10: Max Duration Reached (ĐÃ Keep)**
**Mục tiêu:** Xác nhận max duration (1 hour) khi đã keep thì chỉ end call

**Steps:**
1. [ ] User 1 và User 2 vào call
2. [ ] Room ĐÃ được keep active
3. [ ] Đợi đến khi max duration (1 hour) - hoặc giả lập bằng cách sửa code
4. [ ] **Expected Result:**
   - [ ] Call bị end (max duration reached)
   - [ ] Room VẪN active
   - [ ] Auto chuyển vào chat UI

**Backend Log Check:**
```
📞 Ending call: {callId} by user {userId}, reason: max_duration_reached
📞 Room {roomId} keep_active: true, will end room: false
```

---

## 🔍 **Database Verification**

Sau mỗi test case, verify trong database:

```sql
-- Check room keep_active status
SELECT id, user1_id, user2_id, keep_active, end_time 
FROM rooms 
WHERE id = {roomId};

-- Check call session
SELECT id, room_id, status, duration, end_reason, ended_at 
FROM call_sessions 
WHERE room_id = {roomId}
ORDER BY created_at DESC;
```

---

## 📊 **Test Results Summary**

Sau khi test xong, điền kết quả:

| Test Case | Status | Notes |
|-----------|--------|-------|
| Test 1: End Call (chưa keep) | ⬜ Pass / ⬜ Fail | |
| Test 2: End Call (đã keep) | ⬜ Pass / ⬜ Fail | |
| Test 3: Keep trước khi call | ⬜ Pass / ⬜ Fail | |
| Test 4: Keep trong khi call | ⬜ Pass / ⬜ Fail | |
| Test 5: Voice mode (chưa keep) | ⬜ Pass / ⬜ Fail | |
| Test 6: End room khi đang call | ⬜ Pass / ⬜ Fail | |
| Test 7: Disconnect (chưa keep) | ⬜ Pass / ⬜ Fail | |
| Test 8: Disconnect (đã keep) | ⬜ Pass / ⬜ Fail | |
| Test 9: Timeout (chưa keep) | ⬜ Pass / ⬜ Fail | |
| Test 10: Max duration (đã keep) | ⬜ Pass / ⬜ Fail | |

---

## 🐛 **Debugging Tips**

1. **Check Backend Logs:**
   - Look for: `📞 Room X keep_active: ...`
   - Look for: `roomStillActive: ...` và `roomClosed: ...`

2. **Check Frontend Console:**
   - Look for: `📞 Call ended event received:`
   - Look for: `roomStillActive` và `roomClosed` flags

3. **Check Database:**
   - Verify `rooms.keep_active` value
   - Verify `rooms.end_time` (should be NULL if room still active)

4. **Network Tab:**
   - Check WebSocket messages: `voice_call_ended` event
   - Verify flags trong event data

---

## ✅ **Success Criteria**

Tất cả test cases phải:
- ✅ Backend check database đúng
- ✅ Backend gửi flags đúng
- ✅ Frontend handle flags đúng
- ✅ UI chuyển đúng (chat hoặc waiting room)
- ✅ Database state đúng

---

**Ngày test:** ___________  
**Người test:** ___________  
**Ghi chú:** ___________
