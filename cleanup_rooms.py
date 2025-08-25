#!/usr/bin/env python3
"""
Script cleanup để xóa hết tất cả các phòng và thông tin liên quan
Reset database về trạng thái ban đầu
"""

import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Any

def connect_db():
    """Kết nối database"""
    try:
        conn = sqlite3.connect('mapmo.db')
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"Lỗi kết nối database: {e}")
        return None

def backup_database():
    """Backup database trước khi xóa"""
    import shutil
    import os
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"mapmo_backup_{timestamp}.db"
    
    try:
        shutil.copy2('mapmo.db', backup_name)
        print(f"✅ Đã backup database thành công: {backup_name}")
        return True
    except Exception as e:
        print(f"❌ Lỗi backup database: {e}")
        return False

def show_current_state(conn):
    """Hiển thị trạng thái hiện tại trước khi xóa"""
    print("=== TRẠNG THÁI HIỆN TẠI TRƯỚC KHI XÓA ===")
    
    cursor = conn.cursor()
    
    # Số phòng
    cursor.execute("SELECT COUNT(*) as total FROM rooms")
    total_rooms = cursor.fetchone()['total']
    print(f"Tổng số phòng: {total_rooms}")
    
    # Số tin nhắn
    cursor.execute("SELECT COUNT(*) as total FROM messages")
    total_messages = cursor.fetchone()['total']
    print(f"Tổng số tin nhắn: {total_messages}")
    
    # User trong phòng
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE current_room_id IS NOT NULL")
    users_in_rooms = cursor.fetchone()['count']
    print(f"User đang trong phòng: {users_in_rooms}")
    
    # User status
    cursor.execute("SELECT status, COUNT(*) as count FROM users GROUP BY status")
    user_statuses = cursor.fetchall()
    print(f"Trạng thái user:")
    for row in user_statuses:
        print(f"   {row['status']}: {row['count']} user")
    
    # Matching queue
    cursor.execute("SELECT COUNT(*) as count FROM matching_queue")
    queue_users = cursor.fetchone()['count']
    print(f"User trong queue: {queue_users}")
    
    print()

def cleanup_rooms_and_messages(conn):
    """Xóa tất cả phòng và tin nhắn"""
    print("=== BẮT ĐẦU XÓA PHÒNG VÀ TIN NHẮN ===")
    
    cursor = conn.cursor()
    
    try:
        # 1. Xóa tất cả tin nhắn
        cursor.execute("DELETE FROM messages")
        deleted_messages = cursor.rowcount
        print(f"✅ Đã xóa {deleted_messages} tin nhắn")
        
        # 2. Xóa tất cả phòng
        cursor.execute("DELETE FROM rooms")
        deleted_rooms = cursor.rowcount
        print(f"✅ Đã xóa {deleted_rooms} phòng")
        
        # 3. Xóa matching queue
        cursor.execute("DELETE FROM matching_queue")
        deleted_queue = cursor.rowcount
        print(f"✅ Đã xóa {deleted_queue} user khỏi queue")
        
        # 4. Commit thay đổi
        conn.commit()
        print("✅ Đã commit thay đổi")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi khi xóa: {e}")
        return False

def reset_user_statuses(conn):
    """Reset trạng thái tất cả user về ban đầu"""
    print("=== RESET TRẠNG THÁI USER ===")
    
    cursor = conn.cursor()
    
    try:
        # Reset tất cả user về trạng thái ban đầu
        cursor.execute("""
            UPDATE users 
            SET status = 'idle', 
                current_room_id = NULL, 
                online_status = 0,
                updated_at = ?
        """, (datetime.now().isoformat(),))
        
        updated_users = cursor.rowcount
        print(f"✅ Đã reset {updated_users} user về trạng thái ban đầu")
        
        # Commit thay đổi
        conn.commit()
        print("✅ Đã commit thay đổi")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Lỗi khi reset user status: {e}")
        return False

def verify_cleanup(conn):
    """Xác nhận việc cleanup đã thành công"""
    print("=== XÁC NHẬN CLEANUP ===")
    
    cursor = conn.cursor()
    
    # Kiểm tra phòng
    cursor.execute("SELECT COUNT(*) as count FROM rooms")
    rooms_count = cursor.fetchone()['count']
    print(f"Phòng còn lại: {rooms_count}")
    
    # Kiểm tra tin nhắn
    cursor.execute("SELECT COUNT(*) as count FROM messages")
    messages_count = cursor.fetchone()['count']
    print(f"Tin nhắn còn lại: {messages_count}")
    
    # Kiểm tra user status
    cursor.execute("SELECT status, COUNT(*) as count FROM users GROUP BY status")
    user_statuses = cursor.fetchall()
    print(f"Trạng thái user sau cleanup:")
    for row in user_statuses:
        print(f"   {row['status']}: {row['count']} user")
    
    # Kiểm tra user trong phòng
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE current_room_id IS NOT NULL")
    users_in_rooms = cursor.fetchone()['count']
    print(f"User trong phòng: {users_in_rooms}")
    
    # Kiểm tra queue
    cursor.execute("SELECT COUNT(*) as count FROM matching_queue")
    queue_users = cursor.fetchone()['count']
    print(f"User trong queue: {queue_users}")
    
    if rooms_count == 0 and messages_count == 0 and users_in_rooms == 0 and queue_users == 0:
        print("✅ CLEANUP THÀNH CÔNG! Database đã được reset về trạng thái ban đầu")
        return True
    else:
        print("❌ CLEANUP CHƯA HOÀN THÀNH! Vẫn còn dữ liệu cũ")
        return False

def main():
    """Main function"""
    print("🚀 BẮT ĐẦU CLEANUP DATABASE")
    print("=" * 50)
    print("⚠️  CẢNH BÁO: Script này sẽ xóa HẾT tất cả phòng và tin nhắn!")
    print("⚠️  Database sẽ được reset về trạng thái ban đầu!")
    print("=" * 50)
    
    # Xác nhận từ user
    confirm = input("Bạn có chắc chắn muốn tiếp tục? (yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ Đã hủy cleanup")
        return
    
    conn = connect_db()
    if not conn:
        return
    
    try:
        # 1. Backup database
        if not backup_database():
            print("❌ Không thể backup database, dừng cleanup")
            return
        
        # 2. Hiển thị trạng thái hiện tại
        show_current_state(conn)
        
        # 3. Xác nhận lần nữa
        confirm2 = input("Xác nhận lần cuối - Bạn có chắc chắn muốn xóa HẾT? (yes/no): ")
        if confirm2.lower() != 'yes':
            print("❌ Đã hủy cleanup")
            return
        
        # 4. Bắt đầu cleanup
        print("\n🔄 BẮT ĐẦU CLEANUP...")
        
        # Xóa phòng và tin nhắn
        if not cleanup_rooms_and_messages(conn):
            print("❌ Lỗi khi xóa phòng và tin nhắn")
            return
        
        # Reset user status
        if not reset_user_statuses(conn):
            print("❌ Lỗi khi reset user status")
            return
        
        # 5. Xác nhận kết quả
        print("\n🔍 KIỂM TRA KẾT QUẢ...")
        verify_cleanup(conn)
        
        print("\n✅ HOÀN THÀNH CLEANUP!")
        print("🎯 Database đã được reset về trạng thái ban đầu")
        print("🎯 Tất cả phòng và tin nhắn đã được xóa")
        print("🎯 Tất cả user đã được reset về trạng thái 'idle'")
        
    except Exception as e:
        print(f"❌ Lỗi trong quá trình cleanup: {e}")
        conn.rollback()
    
    finally:
        conn.close()

if __name__ == "__main__":
    main()
