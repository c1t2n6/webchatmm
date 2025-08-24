# Hướng Dẫn Migration Nhanh - Development

## 🚀 Cách Chạy Migration (Đơn Giản Nhất)

### Bước 1: Backup Database
```bash
# Tự động backup khi chạy script
# Hoặc backup thủ công
cp mapmo.db mapmo_backup_$(date +%Y%m%d_%H%M%S).db
```

### Bước 2: Chạy Migration Script
```bash
# Sử dụng script Python (Khuyến nghị)
python migrate_dev.py

# Hoặc sử dụng SQL trực tiếp
Get-Content simple_migration.sql | sqlite3 mapmo.db
```

### Bước 3: Verify Migration
```bash
# Kiểm tra tables đã được tạo
sqlite3 mapmo.db ".tables"

# Test hệ thống
python quick_system_check.py
```

## 📋 Các Script Có Sẵn

### 1. `migrate_dev.py` - Script Migration Chính
- ✅ Tự động backup database
- ✅ Tạo tất cả tables mới
- ✅ Tạo indexes
- ✅ Verify migration
- ✅ Test hệ thống

### 2. `simple_migration.sql` - SQL Script
- ✅ Tạo tables cơ bản
- ✅ Tương thích SQLite
- ✅ Có thể chạy trực tiếp

### 3. `quick_system_check.py` - Test Nhanh
- ✅ Kiểm tra import modules
- ✅ Test schemas
- ✅ Test services
- ✅ Test WebSocket

## 🔍 Kiểm Tra Sau Migration

### Tables Cần Có
- `chat_rooms` - Phòng chat mới
- `chat_messages` - Tin nhắn mới
- `room_participants` - Người tham gia
- `message_reactions` - Reactions
- `chat_sessions` - Sessions
- `chat_events` - Events

### Test Commands
```bash
# Kiểm tra database
sqlite3 mapmo.db ".tables"
sqlite3 mapmo.db ".indexes"

# Test hệ thống
python quick_system_check.py
python test_optimized_system_integration.py
```

## 🚨 Xử Lý Lỗi

### Nếu Migration Thất Bại
```bash
# Khôi phục từ backup
cp mapmo_backup_YYYYMMDD_HHMMSS.db mapmo.db

# Hoặc xóa tables mới
sqlite3 mapmo.db "DROP TABLE IF EXISTS chat_rooms;"
sqlite3 mapmo.db "DROP TABLE IF EXISTS chat_messages;"
# ... xóa các tables khác
```

### Nếu Có Lỗi Import
```bash
# Kiểm tra Python path
export PYTHONPATH="${PYTHONPATH}:/path/to/webchat"

# Kiểm tra dependencies
pip install -r requirements.txt
```

## 📊 Trạng Thái Hiện Tại

✅ **Migration đã hoàn thành thành công!**
- Tables mới đã được tạo
- Hệ thống cũ vẫn hoạt động
- Không có conflict
- Tất cả tests đều PASS

## 🎯 Bước Tiếp Theo

1. **Test ứng dụng hoạt động**
2. **Kiểm tra các tính năng mới**
3. **Test WebSocket connections**
4. **Verify chat functionality**
5. **Nếu mọi thứ OK, có thể deploy production**

## ⚠️ Lưu Ý Quan Trọng

- **CHỈ CHẠY TRÊN DEVELOPMENT**
- **Backup database trước khi migration**
- **Test kỹ trước khi deploy production**
- **Có thể rollback nếu cần**

---

*Hướng dẫn này dành cho môi trường development*
*Migration đã được test và hoạt động thành công*
