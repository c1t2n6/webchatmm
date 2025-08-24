#!/usr/bin/env python3
"""
Simple Development Migration Script
==================================

Script đơn giản để chạy migration trên development.
"""

import os
import sys
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime

def backup_database():
    """Backup database"""
    print("🔒 Tạo backup database...")
    
    db_path = Path("mapmo.db")
    if not db_path.exists():
        print("❌ Không tìm thấy database mapmo.db")
        return False
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = Path(f"mapmo_backup_{timestamp}.db")
    
    try:
        shutil.copy2(db_path, backup_path)
        print(f"✅ Database đã được backup: {backup_path}")
        return str(backup_path)
    except Exception as e:
        print(f"❌ Lỗi backup: {e}")
        return False

def run_migration():
    """Chạy migration"""
    print("\n🚀 Chạy migration...")
    
    try:
        conn = sqlite3.connect("mapmo.db")
        cursor = conn.cursor()
        
        # Tạo bảng chat_rooms
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                name TEXT,
                type TEXT DEFAULT 'private',
                status TEXT DEFAULT 'active',
                max_participants INTEGER DEFAULT 2,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        """)
        print("✅ Tạo bảng chat_rooms")
        
        # Tạo bảng chat_messages
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_type TEXT DEFAULT 'text',
                message_index INTEGER NOT NULL,
                status TEXT DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        print("✅ Tạo bảng chat_messages")
        
        # Tạo bảng room_participants
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS room_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                left_at TIMESTAMP,
                last_read_message_id INTEGER,
                metadata TEXT,
                FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(room_id, user_id)
            )
        """)
        print("✅ Tạo bảng room_participants")
        
        # Tạo bảng message_reactions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS message_reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                reaction_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(message_id, user_id, reaction_type)
            )
        """)
        print("✅ Tạo bảng message_reactions")
        
        # Tạo bảng chat_sessions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        print("✅ Tạo bảng chat_sessions")
        
        # Tạo bảng chat_events
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                user_id INTEGER,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        print("✅ Tạo bảng chat_events")
        
        # Tạo indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_rooms_status ON chat_rooms(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id)")
        print("✅ Tạo indexes")
        
        conn.commit()
        conn.close()
        
        print("✅ Migration hoàn thành!")
        return True
        
    except Exception as e:
        print(f"❌ Lỗi migration: {e}")
        return False

def verify_migration():
    """Verify migration"""
    print("\n🔍 Verify migration...")
    
    try:
        conn = sqlite3.connect("mapmo.db")
        cursor = conn.cursor()
        
        # Kiểm tra tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        required_tables = [
            'chat_rooms', 'chat_messages', 'room_participants',
            'message_reactions', 'chat_sessions', 'chat_events'
        ]
        
        missing = [t for t in required_tables if t not in tables]
        
        if missing:
            print(f"❌ Thiếu tables: {missing}")
            return False
        
        print("✅ Tất cả tables đã được tạo")
        
        # Kiểm tra indexes
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in cursor.fetchall()]
        print(f"✅ Tổng số indexes: {len(indexes)}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Lỗi verify: {e}")
        return False

def test_system():
    """Test hệ thống"""
    print("\n🧪 Test hệ thống...")
    
    try:
        # Test import
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        from app.websocket.connection_manager import ConnectionManager
        from app.services.chat_service import ChatService
        
        print("✅ Import modules thành công")
        
        # Test tạo objects
        room = ChatRoomCreate(user2_id=1, search_type="chat")
        message = ChatMessageCreate(content="Test", room_id=1)
        
        print("✅ Schemas hoạt động")
        
        # Test services
        service = ChatService()
        manager = ConnectionManager()
        
        print("✅ Services khởi tạo thành công")
        
        print("✅ Tất cả tests PASS!")
        return True
        
    except Exception as e:
        print(f"❌ Lỗi test: {e}")
        return False

def main():
    """Main function"""
    print("🚀 Development Migration Script")
    print("="*40)
    
    try:
        # 1. Backup
        backup_path = backup_database()
        if not backup_path:
            return False
        
        # 2. Migration
        if not run_migration():
            return False
        
        # 3. Verify
        if not verify_migration():
            return False
        
        # 4. Test
        if not test_system():
            return False
        
        print("\n🎉 MIGRATION THÀNH CÔNG!")
        print(f"✅ Backup: {backup_path}")
        print("✅ Hệ thống chat mới đã sẵn sàng")
        print("\n📋 Bước tiếp theo:")
        print("1. Test ứng dụng hoạt động")
        print("2. Kiểm tra các tính năng mới")
        print("3. Nếu có vấn đề, khôi phục từ backup")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Lỗi: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
