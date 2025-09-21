# Hướng dẫn Test Typing Indicator

## 🧪 **Cách test typing indicator**

### **1. Test cơ bản trong browser console:**

```javascript
// Test nhanh typing indicator
quickTypingTest();

// Test đầy đủ typing indicator
testTypingIndicator();
```

### **2. Test thủ công:**

```javascript
// Kiểm tra trạng thái hiện tại
console.log('App loaded:', !!window.app);
console.log('MessageHandler:', !!window.app?.messageHandler);
console.log('WebSocket connected:', window.app?.websocketManager?.isConnected());
console.log('Current user:', window.app?.currentUser);

// Test hiển thị typing indicator
window.app.messageHandler.showTypingIndicator('test_user_123');

// Test ẩn typing indicator
window.app.messageHandler.hideTypingIndicator('test_user_123');
```

### **3. Test typing thực tế:**

1. **Mở 2 tab browser** (hoặc 2 người dùng khác nhau)
2. **Vào cùng 1 chat room**
3. **Gõ vào input field** ở tab 1
4. **Kiểm tra tab 2** xem có hiện "Đang nhập..." không

### **4. Debug logs cần kiểm tra:**

Khi gõ vào input, bạn sẽ thấy các logs sau:

```
💬 Message - Input event triggered: [text]
💬 Message - handleTyping called, isTyping: false, WebSocket connected: true
💬 Message - Starting typing indicator
💬 Message - Sending typing indicator
💬 Message - Typing data: {type: 'typing', is_typing: true, user_id: '...'}
🔌 WebSocket - Sending typing message: {type: 'typing', is_typing: true, user_id: '...'}
```

Khi nhận typing indicator từ người khác:

```
🔌 WebSocket - Received typing message: {type: 'typing', user_id: '...', is_typing: true}
💬 Chat - Received typing indicator: {type: 'typing', user_id: '...', is_typing: true}
💬 Chat - Current user ID: [your_id]
💬 Chat - Data user ID: [other_user_id]
💬 Chat - Showing typing indicator for user: [other_user_id]
💬 Message - showTypingIndicator called for user: [other_user_id]
💬 Message - Current user ID: [your_id]
💬 Message - Creating typing indicator element
💬 Message - Typing indicator added to chat
```

### **5. Troubleshooting:**

#### **Nếu typing indicator không hiện:**

1. **Kiểm tra WebSocket connection:**
   ```javascript
   console.log('WebSocket connected:', window.app.websocketManager.isConnected());
   ```

2. **Kiểm tra input element:**
   ```javascript
   const input = document.getElementById('messageInput');
   console.log('Input element:', input);
   ```

3. **Kiểm tra typing listeners:**
   ```javascript
   console.log('Typing handler:', window.app.messageHandler.typingHandler);
   ```

4. **Kiểm tra chat messages container:**
   ```javascript
   const chatMessages = document.getElementById('chatMessages');
   console.log('Chat messages container:', chatMessages);
   ```

#### **Nếu typing indicator hiện nhưng không ẩn:**

1. **Kiểm tra timeout:**
   ```javascript
   console.log('Typing timeout:', window.app.messageHandler.typingTimeout);
   ```

2. **Test hide manually:**
   ```javascript
   window.app.messageHandler.hideTypingIndicator('test_user');
   ```

### **6. Test với 2 người dùng:**

1. **Mở 2 tab browser**
2. **Login với 2 tài khoản khác nhau**
3. **Vào cùng 1 chat room**
4. **Gõ ở tab 1, xem tab 2**

### **7. Expected Behavior:**

- ✅ Khi gõ: Hiện "Đang nhập..." ở tab khác
- ✅ Khi dừng gõ 1 giây: Ẩn "Đang nhập..."
- ✅ Khi gửi tin nhắn: Ẩn "Đang nhập..." ngay lập tức
- ✅ Khi rời room: Clear tất cả typing state

### **8. Performance Notes:**

- Typing indicator sẽ tự động ẩn sau 3 giây nếu không có hoạt động
- Debounce delay: 1 giây (không gửi quá nhiều events)
- Memory được cleanup đúng cách khi rời room
