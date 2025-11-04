# ⚡ Quick Test Guide: End Call Logic

## 🚀 **Test Nhanh (5 phút)**

### **Setup:**
1. Mở 2 tab browser (hoặc 2 trình duyệt khác nhau)
2. Login vào 2 user khác nhau (hoặc cùng 1 user ở 2 tab)
3. Mở Console (F12) ở cả 2 tab để xem logs

---

## ✅ **Test Case 1: End Call CHƯA Keep → End Room** ⭐ QUAN TRỌNG NHẤT

**Steps:**
1. Tab 1 & Tab 2: Match nhau (chat hoặc voice call entry mode)
2. Tab 1 hoặc Tab 2: Click "Voice Call"
3. ⚠️ **QUAN TRỌNG:** KHÔNG click "Giữ cuộc trò chuyện"
4. Trong khi đang call, click "Hangup"

**✅ Kết quả mong đợi:**
- Call kết thúc
- Cả 2 tab quay về waiting room
- Backend log: `Room X keep_active: false, will end room: true`
- Frontend log: `roomClosed: true`

**❌ Nếu FAIL:**
- Check backend log có check database không
- Check frontend có nhận flags không

---

## ✅ **Test Case 2: End Call ĐÃ Keep → Chuyển Vào Chat** ⭐ QUAN TRỌNG NHẤT

**Steps:**
1. Tab 1 & Tab 2: Match nhau và vào chat room
2. Tab 1 hoặc Tab 2: Click **"Giữ cuộc trò chuyện"** ⭐
3. Tab 1 hoặc Tab 2: Click "Voice Call"
4. Trong khi đang call, click "Hangup"

**✅ Kết quả mong đợi:**
- Call kết thúc
- **Cả 2 tab TỰ ĐỘNG chuyển vào chat UI** ⭐
- KHÔNG quay về waiting room
- Backend log: `Room X keep_active: true, will end room: false`
- Frontend log: `roomStillActive: true` và `Switching to chat`

**❌ Nếu FAIL:**
- Check database: `keep_active` có phải `1` không?
- Check frontend có gọi `showChatRoom()` không?
- Check flags từ backend

---

## ✅ **Test Case 3: End Room Khi Đang Call**

**Steps:**
1. Tab 1 & Tab 2: Đang trong call
2. Tab 1 hoặc Tab 2: Click **"Kết thúc phòng"** (End Room button)

**✅ Kết quả mong đợi:**
- Call bị end trước
- Room bị đóng
- Cả 2 tab quay về waiting room
- Backend log: `Force closing room` → `Ending call before closing room`

---

## 🔍 **Quick Verification Commands**

### **Check Backend Logs:**
```bash
# Terminal chạy server
# Look for:
📞 Room X keep_active: ...
roomStillActive: ...
roomClosed: ...
```

### **Check Frontend Console:**
```javascript
// In browser console, look for:
📞 Call ended event received: { roomStillActive: ..., roomClosed: ... }
📞 Call ended, room still active → Switching to chat
// OR
📞 Call ended, room closed → Back to waiting
```

### **Check Database (Optional):**
```sql
-- Open database (app.db)
SELECT id, keep_active, end_time FROM rooms WHERE id = {roomId};

-- Check call sessions
SELECT id, status, end_reason, ended_at FROM call_sessions 
WHERE room_id = {roomId} ORDER BY created_at DESC LIMIT 1;
```

---

## 🐛 **Troubleshooting**

### **Nếu không chuyển vào chat khi đã keep:**
1. Check backend log: `Room X keep_active: true`?
2. Check frontend: Có nhận `roomStillActive: true`?
3. Check code: `handleCallEnded()` có gọi `showChatRoom()`?

### **Nếu không end room khi chưa keep:**
1. Check backend log: `Room X keep_active: false`?
2. Check database: `keep_active` có phải `0` hoặc `NULL`?
3. Check code: `endCall()` có gọi `roomModel.endRoom()`?

### **Nếu flags không được gửi:**
1. Check backend: `voice_call_ended` event có gửi `roomStillActive` và `roomClosed`?
2. Check frontend: Socket listener có đăng ký `voice_call_ended`?

---

## 📝 **Test Results**

Sau khi test, điền kết quả:

- [ ] **Test Case 1** (End call chưa keep): ⬜ Pass / ⬜ Fail
- [ ] **Test Case 2** (End call đã keep): ⬜ Pass / ⬜ Fail  
- [ ] **Test Case 3** (End room khi call): ⬜ Pass / ⬜ Fail

**Ghi chú:** ___________

---

**Thời gian test:** ___ phút  
**Kết quả:** ⬜ Tất cả Pass / ⬜ Có Fail
