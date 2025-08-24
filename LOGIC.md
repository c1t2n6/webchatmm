# WebChat System Logic & Conventions
# ===================================

## 🎯 **User Status Convention**
**Quy ước thống nhất cho trạng thái người dùng**

### **Enum Values (Database & Code):**
```python
class UserStatus(Enum):
    IDLE = 'idle'           # ← lowercase, no spaces
    SEARCHING = 'searching' # ← lowercase, no spaces  
    CONNECTED = 'connected' # ← lowercase, no spaces
```

### **Quy tắc:**
- ✅ **Sử dụng:** `idle`, `searching`, `connected`
- ❌ **Không sử dụng:** `Idle`, `Searching`, `Connected`
- ❌ **Không sử dụng:** `IDLE`, `SEARCHING`, `CONNECTED`
- ❌ **Không sử dụng:** `Idle`, `Searching`, `Connected`

### **Áp dụng trong:**
1. **Database:** Tất cả status values phải là lowercase
2. **API responses:** Trả về lowercase values
3. **Frontend:** Xử lý lowercase values
4. **Matching engine:** Sử dụng lowercase values

---

## 🔄 **Status Flow Logic**
**Luồng chuyển đổi trạng thái**

### **IDLE → SEARCHING:**
- User click "Tìm kiếm"
- Profile phải hoàn chỉnh
- Được thêm vào matching queue

### **SEARCHING → CONNECTED:**
- Tìm thấy match phù hợp
- Tạo chat room
- Cả 2 users chuyển sang CONNECTED

### **CONNECTED → IDLE:**
- Chat room kết thúc
- User disconnect
- Reset current_room_id

---

## 📝 **Database Update Required**
**Cần cập nhật database để khớp với quy ước mới**

### **SQL Commands:**
```sql
-- Cập nhật tất cả status values
UPDATE users SET status = 'idle' WHERE status = 'Idle';
UPDATE users SET status = 'searching' WHERE status = 'Searching';
UPDATE users SET status = 'connected' WHERE status = 'Connected';

-- Kiểm tra kết quả
SELECT DISTINCT status FROM users;
```

### **Expected Result:**
```
status
-------
idle
searching
connected
```

---

## 🧪 **Testing Convention**
**Quy ước test cho từng trạng thái**

### **Test IDLE Status:**
- User mới đăng ký → status = 'idle'
- User logout → status = 'idle'
- Chat kết thúc → status = 'idle'

### **Test SEARCHING Status:**
- User click search → status = 'searching'
- User trong queue → status = 'searching'
- Profile incomplete → không được search

### **Test CONNECTED Status:**
- Match thành công → status = 'connected'
- Có current_room_id
- Cả 2 users cùng status

---

## 🚨 **Error Prevention**
**Ngăn chặn lỗi enum mismatch**

### **Code Rules:**
1. **Luôn sử dụng enum:** `UserStatus.IDLE.value` thay vì hardcode string
2. **Validate input:** Kiểm tra status values trước khi update
3. **Consistent casing:** Tất cả lowercase trong database
4. **Migration script:** Chạy script fix database trước khi deploy

### **Validation Example:**
```python
def validate_status(status: str) -> bool:
    valid_statuses = ['idle', 'searching', 'connected']
    return status.lower() in valid_statuses
```

---

## 📋 **Implementation Checklist**
**Danh sách cần thực hiện**

- [ ] **Update enum values** trong `app/models/__init__.py`
- [ ] **Run database migration** script
- [ ] **Update matching engine** để sử dụng lowercase
- [ ] **Update API responses** để trả về lowercase
- [ ] **Update frontend** để xử lý lowercase
- [ ] **Test all status flows** từ IDLE → SEARCHING → CONNECTED
- [ ] **Verify database consistency** không còn old values

---

## 🔍 **Debug Commands**
**Lệnh debug để kiểm tra status**

### **Check Database Status:**
```python
from app.database import get_db
from sqlalchemy import text

db = next(get_db())
result = db.execute(text("SELECT DISTINCT status FROM users"))
statuses = [row[0] for row in result]
print(f"Current statuses: {statuses}")
```

### **Check User Status:**
```python
from app.models import User, UserStatus

# Tìm user có status cụ thể
users = db.query(User).filter(User.status == UserStatus.CONNECTED).all()
print(f"Connected users: {len(users)}")
```

---

## 📚 **References**
**Tài liệu tham khảo**

- **SQLAlchemy Enum:** https://docs.sqlalchemy.org/en/14/core/type_basics.html#enums
- **Python Enum:** https://docs.python.org/3/library/enum.html
- **Database Migration:** Best practices for schema updates
- **Status Machine:** State transition patterns

---

**Lưu ý:** Sau khi cập nhật quy ước này, **KHÔNG BAO GIỜ** thay đổi enum values nữa để tránh breaking changes!

---

# 🚪 LOGIC END PHÒNG CHAT
**Luồng xử lý khi user kết thúc phòng chat**

## 🔄 **Flow End Phòng Chat:**

```
User A click "End Chat" button
↓
Frontend: gọi endChat() method
↓
API Call: POST /chat/end/{room_id}
↓
Backend: Update room status to "ended"
↓
Backend: Gửi notification qua WebSocket
↓
Backend: Đóng WebSocket connections (delay 3s)
↓
Frontend: Nhận notification "room_closed"
↓
Frontend: Hiển thị modal thông báo
↓
User B: Click "Về Phòng Chờ" hoặc đợi 10s
↓
Frontend: Reload page
↓
Page reload: Về phòng chờ (backend đã update user status)
```

## 📡 **WebSocket Message Types:**

### **Status WebSocket (`/ws/status`):**
- `match_found`: Tìm thấy người chat
- `room_ended_by_user`: Phòng bị end bởi user khác

### **Chat WebSocket (`/ws/chat/{room_id}`):**
- `message`: Tin nhắn chat
- `typing`: Typing indicator
- `room_closed`: Phòng đã đóng (force close)
- `room_ended_by_user`: Phòng bị end bởi user

## 🔧 **Backend Logic (app/api/chat.py):**

```python
@router.post("/end/{room_id}")
async def end_chat_room(room_id: int, current_user: User = Depends(get_current_user)):
    # 1. Validate user access to room
    # 2. Update room status to "ended"
    # 3. Send notification BEFORE closing connections
    # 4. Use dual notification strategy:
    #    - Personal message (status WebSocket)
    #    - Room broadcast fallback (chat WebSocket)
    # 5. Delay 3 seconds before closing connections
    # 6. Return 200 OK
```

## 🎨 **Frontend Logic (chat.js):**

### **Nhận Notification:**
```javascript
handleChatWebSocketMessage(data) {
    switch (data.type) {
        case 'room_closed':
            this.handleRoomClosed(data);
            break;
        case 'room_ended_by_user':
            this.handleRoomEndedByUser(data);
            break;
    }
}
```

### **Hiển Thị Modal:**
```javascript
showRoomEndedModal(message) {
    // 1. Tạo modal HTML với nút "Về Phòng Chờ"
    // 2. Thêm event listener cho nút
    // 3. Auto-close sau 10 giây
    // 4. Reload page khi click hoặc auto-close
}
```

### **Cleanup WebSocket:**
```javascript
// Đóng WebSocket TRƯỚC khi reload
if (this.chatWebSocket) {
    this.chatWebSocket.close();
    this.chatWebSocket = null;
}
if (this.websocket) {
    this.websocket.close();
    this.websocket = null;
}
// Reload page
window.location.reload();
```

## ⚠️ **Lưu Ý Quan Trọng:**

### **1. Script Loading Order:**
```html
<!-- chat.js phải load TRƯỚC app.js -->
<script src="/static/js/modules/chat.js"></script>
<script type="module" src="/static/js/app.js"></script>
```

### **2. WebSocket Cleanup:**
- **KHÔNG đóng WebSocket ngay lập tức** khi nhận notification
- **Đóng WebSocket TRƯỚC khi reload** để cleanup sạch sẽ
- **Dual notification strategy** để đảm bảo user nhận được thông báo

### **3. Page Reload Logic:**
- **KHÔNG dùng `window.location.href = '/waiting-room'`** (có thể không tồn tại)
- **Dùng `window.location.reload()`** để reload page
- **Backend đã update user status** nên page reload sẽ về phòng chờ

## 🐛 **Common Issues & Solutions:**

### **Issue 1: User không nhận được notification**
- **Cause:** WebSocket bị đóng quá sớm
- **Solution:** Delay 3s trước khi đóng connection

### **Issue 2: Modal không hiển thị**
- **Cause:** `showWarning` method không tồn tại
- **Solution:** Dùng `showRoomEndedModal` thay vì `showError`

### **Issue 3: Không tự động về phòng chờ**
- **Cause:** Logic redirect sai
- **Solution:** Dùng `window.location.reload()` thay vì hard redirect

## 📁 **File Dependencies:**

### **Core Files (KHÔNG ĐƯỢC XÓA):**
- `templates/index.html` - Main template
- `static/js/app.js` - Main application
- `static/js/modules/chat.js` - Chat module
- `app/api/chat.py` - Chat API
- `app/websocket_manager.py` - WebSocket manager

### **Files Có Thể Xóa:**
- `templates/debug_*.html` - Debug pages
- `templates/test_*.html` - Test pages
- `app/*_fixed.py` - Fixed versions
- `test_*.py` - Test scripts
