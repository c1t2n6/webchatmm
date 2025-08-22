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
