# Hướng Dẫn Chạy Migration Trên Development

## 📋 Tổng Quan

Hướng dẫn này sẽ giúp bạn chạy database migration từ hệ thống chat cũ sang hệ thống mới một cách an toàn trên môi trường development.

## ⚠️ Lưu Ý Quan Trọng

- **CHỈ CHẠY TRÊN MÔI TRƯỜNG DEVELOPMENT**
- **KHÔNG BAO GIỜ chạy trên production trước khi test kỹ**
- **Backup database sẽ được tạo tự động**
- **Có thể rollback nếu có vấn đề**

## 🚀 Cách 1: Sử Dụng Script Tự Động (Khuyến Nghị)

### Bước 1: Chuẩn Bị
```bash
# Đảm bảo bạn đang ở thư mục gốc của project
cd /path/to/your/webchat/project

# Kiểm tra các file migration có sẵn
ls -la migrations/
```

### Bước 2: Chạy Migration Script
```bash
# Chạy script migration tự động
python run_migration_dev.py
```

Script này sẽ:
- ✅ Tự động backup database
- ✅ Kiểm tra kết nối database
- ✅ Chạy migration step 1 (tạo cấu trúc mới)
- ✅ Verify migration
- ✅ Hỏi bạn có muốn migrate dữ liệu cũ không
- ✅ Test hệ thống sau migration
- ✅ Tự động rollback nếu có vấn đề

## 🔧 Cách 2: Chạy Thủ Công (Cho Người Dùng Nâng Cao)

### Bước 1: Backup Database
```bash
# Tạo backup thủ công
cp mapmo.db mapmo_backup_$(date +%Y%m%d_%H%M%S).db
```

### Bước 2: Chạy Migration Step 1
```bash
# Chạy SQL script để tạo cấu trúc mới
sqlite3 mapmo.db < migrations/001_create_optimized_chat_system_20250822_233913.sql
```

### Bước 3: Verify Migration
```bash
# Kiểm tra tables mới đã được tạo
sqlite3 mapmo.db ".tables"
```

### Bước 4: Chạy Migration Step 2 (Tùy Chọn)
```bash
# Chỉ chạy nếu muốn migrate dữ liệu cũ
sqlite3 mapmo.db < migrations/002_migrate_existing_data_20250822_233913.sql
```

### Bước 5: Test Hệ Thống
```bash
# Chạy test để verify
python quick_system_check.py
```

## 📊 Cấu Trúc Migration

### Step 1: Tạo Cấu Trúc Mới
- `chat_rooms` - Bảng phòng chat mới
- `chat_messages` - Bảng tin nhắn mới
- `room_participants` - Bảng người tham gia
- `message_reactions` - Bảng reactions
- `chat_sessions` - Bảng sessions
- `chat_events` - Bảng events

### Step 2: Migrate Dữ Liệu Cũ (Tùy Chọn)
- Chuyển đổi rooms từ hệ thống cũ
- Chuyển đổi messages
- Chuyển đổi participants
- Cập nhật indexes và timestamps

### Step 3: Rollback (Nếu Cần)
- Xóa tất cả tables mới
- Xóa indexes và triggers
- Khôi phục về trạng thái cũ

## 🔍 Kiểm Tra Sau Migration

### 1. Kiểm Tra Database
```bash
# Kiểm tra tables
sqlite3 mapmo.db ".tables"

# Kiểm tra indexes
sqlite3 mapmo.db ".indexes"

# Kiểm tra triggers
sqlite3 mapmo.db ".schema"
```

### 2. Kiểm Tra Hệ Thống
```bash
# Test import modules
python quick_system_check.py

# Test tích hợp
python test_optimized_system_integration.py

# Test hiệu suất
python test_performance_benchmark.py
```

### 3. Kiểm Tra Ứng Dụng
```bash
# Khởi động ứng dụng
python -m uvicorn app.main:app --reload

# Kiểm tra các endpoints hoạt động
# Test WebSocket connections
# Test chat functionality
```

## 🚨 Xử Lý Lỗi

### Nếu Migration Thất Bại
```bash
# Script sẽ tự động rollback
# Hoặc chạy rollback thủ công
sqlite3 mapmo.db < migrations/003_rollback_optimized_system_20250822_233913.sql
```

### Nếu Cần Khôi Phục Database
```bash
# Khôi phục từ backup
cp mapmo_backup_YYYYMMDD_HHMMSS.db mapmo.db
```

### Nếu Có Lỗi Import
```bash
# Kiểm tra Python path
export PYTHONPATH="${PYTHONPATH}:/path/to/your/webchat/project"

# Kiểm tra dependencies
pip install -r requirements.txt
```

## 📋 Checklist Trước Khi Migration

- [ ] Đang ở môi trường development
- [ ] Không có user nào đang sử dụng hệ thống
- [ ] Backup database đã được tạo
- [ ] Tất cả tests cũ đều PASS
- [ ] Có thể rollback nếu cần

## 📋 Checklist Sau Khi Migration

- [ ] Tất cả tables mới đã được tạo
- [ ] Indexes và triggers đã được tạo
- [ ] Hệ thống có thể import modules mới
- [ ] Schemas hoạt động đúng
- [ ] Services khởi tạo thành công
- [ ] WebSocket manager hoạt động
- [ ] Ứng dụng khởi động bình thường
- [ ] Các tính năng cũ vẫn hoạt động

## 🔄 Rollback Plan

### Khi Nào Cần Rollback
- Migration thất bại
- Hệ thống không hoạt động sau migration
- Có lỗi nghiêm trọng
- Performance giảm đáng kể

### Cách Rollback
```bash
# Sử dụng script tự động
python run_migration_dev.py
# Chọn rollback khi được hỏi

# Hoặc chạy thủ công
sqlite3 mapmo.db < migrations/003_rollback_optimized_system_20250822_233913.sql
```

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra logs trong terminal
2. Kiểm tra database backup
3. Chạy rollback script
4. Khôi phục từ backup nếu cần
5. Liên hệ team development

## 🎯 Kết Luận

Migration script được thiết kế để an toàn và tự động. Nó sẽ:
- Backup database trước khi thay đổi
- Chạy migration từng bước
- Verify kết quả
- Test hệ thống
- Tự động rollback nếu có vấn đề

**Luôn test trên development trước khi áp dụng production!**

---

*Hướng dẫn được tạo vào: 2025-08-22*
*Phiên bản: 1.0*
