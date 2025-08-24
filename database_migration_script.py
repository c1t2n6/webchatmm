#!/usr/bin/env python3
"""
Database Migration Script
========================

Script để chuyển đổi database từ hệ thống chat cũ sang hệ thống mới
mà không làm mất dữ liệu hiện tại.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone
import json

# Thêm đường dẫn để import modules
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def create_migration_script():
    """Tạo script migration SQL"""
    
    migration_sql = """
-- Database Migration Script: Hệ thống Chat Cũ -> Mới
-- Thực hiện theo thứ tự để tránh mất dữ liệu

-- 1. Tạo các bảng mới (không xóa bảng cũ)
CREATE TABLE IF NOT EXISTS chat_rooms (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    name VARCHAR(255),
    type VARCHAR(20) DEFAULT 'private',
    status VARCHAR(20) DEFAULT 'active',
    max_participants INTEGER DEFAULT 2,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    room_id BIGINT NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    message_index BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_participants (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    room_id BIGINT NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    last_read_message_id BIGINT,
    metadata JSON,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_reactions (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    message_id BIGINT NOT NULL,
    user_id INTEGER NOT NULL,
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    room_id BIGINT NOT NULL,
    user_id INTEGER NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_events (
    id BIGINT PRIMARY KEY AUTOINCREMENT,
    room_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Tạo indexes cho hiệu suất
CREATE INDEX IF NOT EXISTS idx_chat_rooms_status ON chat_rooms(status);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_activity ON chat_rooms(last_activity);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_index ON chat_messages(message_index);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires_at ON chat_sessions(expires_at);

-- 3. Migration dữ liệu từ hệ thống cũ sang mới
-- (Chỉ thực hiện nếu muốn chuyển đổi dữ liệu cũ)

-- Tạo trigger để tự động cập nhật updated_at
CREATE TRIGGER IF NOT EXISTS update_chat_rooms_updated_at 
    AFTER UPDATE ON chat_rooms
    FOR EACH ROW
    BEGIN
        UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_chat_messages_updated_at 
    AFTER UPDATE ON chat_messages
    FOR EACH ROW
    BEGIN
        UPDATE chat_messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- 4. Tạo view để tương thích ngược (nếu cần)
CREATE VIEW IF NOT EXISTS v_rooms_compatible AS
SELECT 
    cr.id,
    cr.name,
    cr.type,
    cr.status,
    cr.created_at,
    cr.last_activity,
    rp1.user_id as user1_id,
    rp2.user_id as user2_id
FROM chat_rooms cr
LEFT JOIN room_participants rp1 ON cr.id = rp1.room_id AND rp1.id = (
    SELECT MIN(id) FROM room_participants WHERE room_id = cr.id
)
LEFT JOIN room_participants rp2 ON cr.id = rp2.room_id AND rp2.id = (
    SELECT MAX(id) FROM room_participants WHERE room_id = cr.id AND id != rp1.id
)
WHERE cr.type = 'private' AND cr.status = 'active';

-- 5. Tạo function để migrate dữ liệu cũ (tùy chọn)
-- Chỉ sử dụng khi muốn chuyển đổi dữ liệu từ hệ thống cũ
"""
    
    return migration_sql

def create_data_migration_script():
    """Tạo script để migrate dữ liệu từ hệ thống cũ sang mới"""
    
    migration_script = """
-- Data Migration Script (Tùy chọn)
-- Chỉ chạy khi muốn chuyển đổi dữ liệu từ hệ thống cũ

-- 1. Migrate rooms
INSERT INTO chat_rooms (id, uuid, type, status, created_at, last_activity)
SELECT 
    r.id,
    'migrated-' || r.id || '-' || strftime('%s', 'now'),
    r.type,
    CASE 
        WHEN r.end_time IS NULL THEN 'active'
        ELSE 'ended'
    END,
    r.start_time,
    COALESCE(r.last_message_time, r.start_time)
FROM rooms r
WHERE NOT EXISTS (SELECT 1 FROM chat_rooms cr WHERE cr.id = r.id);

-- 2. Migrate room participants
INSERT INTO room_participants (room_id, user_id, status, joined_at)
SELECT 
    r.id,
    r.user1_id,
    'active',
    r.start_time
FROM rooms r
WHERE NOT EXISTS (
    SELECT 1 FROM room_participants rp 
    WHERE rp.room_id = r.id AND rp.user_id = r.user1_id
);

INSERT INTO room_participants (room_id, user_id, status, joined_at)
SELECT 
    r.id,
    r.user2_id,
    'active',
    r.start_time
FROM rooms r
WHERE NOT EXISTS (
    SELECT 1 FROM room_participants rp 
    WHERE rp.room_id = r.id AND rp.user_id = r.user2_id
);

-- 3. Migrate messages
INSERT INTO chat_messages (id, uuid, room_id, user_id, content, content_type, message_index, created_at)
SELECT 
    m.id,
    'migrated-' || m.id || '-' || strftime('%s', 'now'),
    m.room_id,
    m.user_id,
    m.content,
    'text',
    m.id,
    m.timestamp
FROM messages m
WHERE NOT EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.id = m.id);

-- 4. Cập nhật message_index cho các message đã migrate
UPDATE chat_messages 
SET message_index = id 
WHERE message_index = 0 OR message_index IS NULL;

-- 5. Cập nhật last_activity của chat_rooms
UPDATE chat_rooms 
SET last_activity = (
    SELECT MAX(created_at) 
    FROM chat_messages 
    WHERE room_id = chat_rooms.id
)
WHERE last_activity IS NULL OR last_activity = created_at;
"""
    
    return migration_script

def create_rollback_script():
    """Tạo script để rollback nếu cần"""
    
    rollback_sql = """
-- Rollback Script (Chỉ sử dụng khi cần khôi phục)
-- CẢNH BÁO: Script này sẽ xóa tất cả dữ liệu mới!

-- 1. Xóa các bảng mới
DROP TABLE IF EXISTS chat_events;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS room_participants;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_rooms;

-- 2. Xóa các view và trigger
DROP VIEW IF EXISTS v_rooms_compatible;
DROP TRIGGER IF EXISTS update_chat_rooms_updated_at;
DROP TRIGGER IF EXISTS update_chat_messages_updated_at;

-- 3. Xóa các index
-- (SQLite tự động xóa index khi xóa table)
"""
    
    return rollback_sql

def create_migration_files():
    """Tạo các file migration"""
    
    # Tạo thư mục migrations nếu chưa có
    migrations_dir = Path("migrations")
    migrations_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # File migration chính
    migration_file = migrations_dir / f"001_create_optimized_chat_system_{timestamp}.sql"
    with open(migration_file, 'w', encoding='utf-8') as f:
        f.write(create_migration_script())
    
    # File migration dữ liệu
    data_migration_file = migrations_dir / f"002_migrate_existing_data_{timestamp}.sql"
    with open(data_migration_file, 'w', encoding='utf-8') as f:
        f.write(create_data_migration_script())
    
    # File rollback
    rollback_file = migrations_dir / f"003_rollback_optimized_system_{timestamp}.sql"
    with open(rollback_file, 'w', encoding='utf-8') as f:
        f.write(create_rollback_script())
    
    # File README
    readme_file = migrations_dir / "README.md"
    readme_content = f"""# Database Migration Guide

## Tổng quan
Script này chuyển đổi database từ hệ thống chat cũ sang hệ thống mới được tối ưu hóa.

## Thứ tự thực hiện
1. **001_create_optimized_chat_system_{timestamp}.sql** - Tạo cấu trúc mới
2. **002_migrate_existing_data_{timestamp}.sql** - Migrate dữ liệu cũ (tùy chọn)
3. **003_rollback_optimized_system_{timestamp}.sql** - Rollback nếu cần

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
"""
    
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    print(f"✅ Đã tạo các file migration:")
    print(f"   📁 {migration_file}")
    print(f"   📁 {data_migration_file}")
    print(f"   📁 {rollback_file}")
    print(f"   📁 {readme_file}")
    
    return migrations_dir

def main():
    """Main function"""
    print("🚀 Tạo Database Migration Scripts...")
    
    try:
        migrations_dir = create_migration_files()
        
        print(f"\n📋 Migration files đã được tạo trong thư mục: {migrations_dir}")
        print("\n🔧 Hướng dẫn sử dụng:")
        print("1. Backup database hiện tại")
        print("2. Chạy file 001 để tạo cấu trúc mới")
        print("3. Chạy file 002 nếu muốn migrate dữ liệu cũ")
        print("4. Test hệ thống")
        print("5. Sử dụng file 003 nếu cần rollback")
        
        print("\n⚠️  Lưu ý: Luôn test trên môi trường development trước!")
        
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
