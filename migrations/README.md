# Database Migration Guide

## Tổng quan
Script này chuyển đổi database từ hệ thống chat cũ sang hệ thống mới được tối ưu hóa.

## Thứ tự thực hiện
1. **001_create_optimized_chat_system_20250822_233913.sql** - Tạo cấu trúc mới
2. **002_migrate_existing_data_20250822_233913.sql** - Migrate dữ liệu cũ (tùy chọn)
3. **003_rollback_optimized_system_20250822_233913.sql** - Rollback nếu cần

## Lưu ý quan trọng
- Backup database trước khi chạy migration
- Test trên môi trường development trước
- Chạy từng file theo thứ tự
- File 002 chỉ chạy khi muốn chuyển đổi dữ liệu cũ

## Kiểm tra sau migration
- Chạy test: `python test_optimized_system_integration.py`
- Kiểm tra ứng dụng hoạt động bình thường
- Verify dữ liệu được migrate đúng

## Rollback
Nếu có vấn đề, chạy file 003 để rollback về trạng thái cũ.
