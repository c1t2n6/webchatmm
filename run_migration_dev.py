#!/usr/bin/env python3
"""
Development Migration Runner
===========================

Script để chạy database migration trên môi trường development một cách an toàn.
"""

import os
import sys
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime
import traceback

# Thêm đường dẫn để import modules
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def backup_database():
    """Backup database hiện tại"""
    print("🔒 Tạo backup database...")
    
    db_path = Path("mapmo.db")
    if not db_path.exists():
        print("❌ Không tìm thấy database mapmo.db")
        return False
    
    # Tạo backup với timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = Path(f"mapmo_backup_{timestamp}.db")
    
    try:
        shutil.copy2(db_path, backup_path)
        print(f"✅ Database đã được backup thành công: {backup_path}")
        return str(backup_path)
    except Exception as e:
        print(f"❌ Lỗi khi backup database: {e}")
        return False

def check_database_connection():
    """Kiểm tra kết nối database"""
    print("\n🔍 Kiểm tra kết nối database...")
    
    try:
        conn = sqlite3.connect("mapmo.db")
        cursor = conn.cursor()
        
        # Kiểm tra tables hiện tại
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        print(f"✅ Kết nối database thành công")
        print(f"✅ Tables hiện tại: {existing_tables}")
        
        conn.close()
        return True, existing_tables
        
    except Exception as e:
        print(f"❌ Lỗi kết nối database: {e}")
        return False, []

def run_migration_step1():
    """Chạy migration step 1: Tạo cấu trúc mới"""
    print("\n🚀 Chạy Migration Step 1: Tạo cấu trúc mới...")
    
    migration_file = "migrations/001_create_optimized_chat_system_fixed.sql"
    
    if not Path(migration_file).exists():
        print(f"❌ Không tìm thấy file migration: {migration_file}")
        return False
    
    try:
        # Đọc SQL script
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Chạy migration
        conn = sqlite3.connect("mapmo.db")
        cursor = conn.cursor()
        
        # Chạy từng câu lệnh SQL
        sql_commands = [cmd.strip() for cmd in sql_script.split(';') if cmd.strip()]
        
        for i, command in enumerate(sql_commands):
            if command and not command.startswith('--'):
                try:
                    cursor.execute(command)
                    print(f"✅ Thực thi command {i+1}: {command[:50]}...")
                except Exception as e:
                    print(f"⚠️  Command {i+1} có thể đã tồn tại: {e}")
        
        conn.commit()
        conn.close()
        
        print("✅ Migration Step 1 hoàn thành!")
        return True
        
    except Exception as e:
        print(f"❌ Lỗi trong Migration Step 1: {e}")
        traceback.print_exc()
        return False

def run_migration_step2():
    """Chạy migration step 2: Migrate dữ liệu cũ (tùy chọn)"""
    print("\n🚀 Chạy Migration Step 2: Migrate dữ liệu cũ...")
    
    migration_file = "migrations/002_migrate_existing_data_20250822_233913.sql"
    
    if not Path(migration_file).exists():
        print(f"❌ Không tìm thấy file migration: {migration_file}")
        return False
    
    try:
        # Đọc SQL script
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Chạy migration
        conn = sqlite3.connect("mapmo.db")
        cursor = conn.cursor()
        
        # Chạy từng câu lệnh SQL
        sql_commands = [cmd.strip() for cmd in sql_script.split(';') if cmd.strip()]
        
        for i, command in enumerate(sql_commands):
            if command and not command.startswith('--'):
                try:
                    cursor.execute(command)
                    print(f"✅ Thực thi command {i+1}: {command[:50]}...")
                except Exception as e:
                    print(f"⚠️  Command {i+1} có thể đã tồn tại: {e}")
        
        conn.commit()
        conn.close()
        
        print("✅ Migration Step 2 hoàn thành!")
        return True
        
    except Exception as e:
        print(f"❌ Lỗi trong Migration Step 2: {e}")
        traceback.print_exc()
        return False

def verify_migration():
    """Verify migration đã thành công"""
    print("\n🔍 Verify migration...")
    
    try:
        conn = sqlite3.connect("mapmo.db")
        cursor = conn.cursor()
        
        # Kiểm tra tables mới
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        all_tables = [row[0] for row in cursor.fetchall()]
        
        # Tables cần có sau migration
        required_tables = [
            'chat_rooms', 'chat_messages', 'room_participants',
            'message_reactions', 'chat_sessions', 'chat_events'
        ]
        
        missing_tables = [table for table in required_tables if table not in all_tables]
        
        if missing_tables:
            print(f"❌ Thiếu tables: {missing_tables}")
            return False
        else:
            print("✅ Tất cả tables mới đã được tạo")
        
        # Kiểm tra indexes
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in cursor.fetchall()]
        
        print(f"✅ Tổng số indexes: {len(indexes)}")
        
        # Kiểm tra triggers
        cursor.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
        triggers = [row[0] for row in cursor.fetchall()]
        
        print(f"✅ Tổng số triggers: {len(triggers)}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Lỗi khi verify migration: {e}")
        return False

def test_system_after_migration():
    """Test hệ thống sau migration"""
    print("\n🧪 Test hệ thống sau migration...")
    
    try:
        # Test import các modules mới
        from app.models.chat_models import ChatRoom, ChatMessage, RoomParticipant
        print("✅ Import models mới thành công")
        
        from app.schemas.chat_schemas import ChatRoomCreate, ChatMessageCreate
        print("✅ Import schemas mới thành công")
        
        from app.websocket.connection_manager import ConnectionManager
        print("✅ Import connection manager mới thành công")
        
        from app.services.chat_service import ChatService
        print("✅ Import chat service mới thành công")
        
        # Test tạo objects
        room = ChatRoomCreate(user2_id=1, search_type="chat")
        print("✅ Tạo ChatRoomCreate thành công")
        
        message = ChatMessageCreate(content="Test message", room_id=1)
        print("✅ Tạo ChatMessageCreate thành công")
        
        print("✅ Tất cả tests đều PASS!")
        return True
        
    except Exception as e:
        print(f"❌ Lỗi trong test: {e}")
        traceback.print_exc()
        return False

def rollback_migration():
    """Rollback migration nếu cần"""
    print("\n🔄 Rollback migration...")
    
    rollback_file = "migrations/003_rollback_optimized_system_20250822_233913.sql"
    
    if not Path(rollback_file).exists():
        print(f"❌ Không tìm thấy file rollback: {rollback_file}")
        return False
    
    try:
        # Đọc SQL script
        with open(rollback_file, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Chạy rollback
        conn = sqlite3.connect("mapmo.db")
        cursor = conn.cursor()
        
        # Chạy từng câu lệnh SQL
        sql_commands = [cmd.strip() for cmd in sql_script.split(';') if cmd.strip()]
        
        for i, command in enumerate(sql_commands):
            if command and not command.startswith('--'):
                try:
                    cursor.execute(command)
                    print(f"✅ Thực thi rollback command {i+1}: {command[:50]}...")
                except Exception as e:
                    print(f"⚠️  Rollback command {i+1} có thể đã được thực thi: {e}")
        
        conn.commit()
        conn.close()
        
        print("✅ Rollback hoàn thành!")
        return True
        
    except Exception as e:
        print(f"❌ Lỗi trong rollback: {e}")
        traceback.print_exc()
        return False

def main():
    """Main function"""
    print("🚀 Development Migration Runner")
    print("="*50)
    print("⚠️  CHÚ Ý: Chỉ chạy trên môi trường development!")
    print("⚠️  Backup database sẽ được tạo tự động")
    print("="*50)
    
    try:
        # 1. Backup database
        backup_path = backup_database()
        if not backup_path:
            print("❌ Không thể backup database. Dừng migration.")
            return False
        
        # 2. Kiểm tra kết nối database
        db_ok, existing_tables = check_database_connection()
        if not db_ok:
            print("❌ Không thể kết nối database. Dừng migration.")
            return False
        
        # 3. Chạy Migration Step 1
        if not run_migration_step1():
            print("❌ Migration Step 1 thất bại. Dừng migration.")
            return False
        
        # 4. Verify migration
        if not verify_migration():
            print("❌ Verification thất bại. Dừng migration.")
            return False
        
        # 5. Chạy Migration Step 2 (tùy chọn)
        print("\n❓ Bạn có muốn migrate dữ liệu cũ không? (y/n): ", end="")
        user_input = input().lower().strip()
        
        if user_input in ['y', 'yes', 'có']:
            if not run_migration_step2():
                print("⚠️  Migration Step 2 thất bại, nhưng hệ thống vẫn hoạt động")
        
        # 6. Test hệ thống
        if not test_system_after_migration():
            print("❌ Test hệ thống thất bại.")
            print("🔄 Bắt đầu rollback...")
            rollback_migration()
            return False
        
        print("\n🎉 MIGRATION THÀNH CÔNG!")
        print("✅ Hệ thống chat mới đã sẵn sàng")
        print(f"✅ Database backup: {backup_path}")
        print("\n📋 Bước tiếp theo:")
        print("1. Test ứng dụng hoạt động bình thường")
        print("2. Kiểm tra các tính năng mới")
        print("3. Nếu có vấn đề, sử dụng rollback script")
        
        return True
        
    except KeyboardInterrupt:
        print("\n⚠️  Migration bị gián đoạn bởi user")
        print("🔄 Bắt đầu rollback...")
        rollback_migration()
        return False
        
    except Exception as e:
        print(f"\n❌ Lỗi không mong muốn: {e}")
        print("🔄 Bắt đầu rollback...")
        rollback_migration()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
