#!/usr/bin/env python3
"""
Script kiểm tra database để tìm hiểu tại sao user1 và user2 có nhiều phòng chat
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

def check_rooms_overview(conn):
    """Kiểm tra tổng quan về phòng chat"""
    print("=== KIỂM TRA TỔNG QUAN PHÒNG CHAT ===")
    
    cursor = conn.cursor()
    
    # Tổng số phòng
    cursor.execute("SELECT COUNT(*) as total FROM rooms")
    total_rooms = cursor.fetchone()['total']
    print(f"Tổng số phòng: {total_rooms}")
    
    # Phòng active (chưa end)
    cursor.execute("SELECT COUNT(*) as active FROM rooms WHERE end_time IS NULL")
    active_rooms = cursor.fetchone()['active']
    print(f"Phòng active: {active_rooms}")
    
    # Phòng đã end
    cursor.execute("SELECT COUNT(*) as ended FROM rooms WHERE end_time IS NOT NULL")
    ended_rooms = cursor.fetchone()['ended']
    print(f"Phòng đã end: {ended_rooms}")
    
    # Phòng theo ngày
    cursor.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM rooms 
        GROUP BY DATE(created_at) 
        ORDER BY date DESC 
        LIMIT 7
    """)
    daily_rooms = cursor.fetchall()
    print(f"Phòng theo ngày (7 ngày gần nhất):")
    for row in daily_rooms:
        print(f"   {row['date']}: {row['count']} phòng")
    
    print()

def check_user_room_status(conn):
    """Kiểm tra trạng thái user và phòng"""
    print("=== KIỂM TRA TRẠNG THÁI USER VÀ PHÒNG ===")
    
    cursor = conn.cursor()
    
    # User status
    cursor.execute("""
        SELECT status, COUNT(*) as count 
        FROM users 
        GROUP BY status
    """)
    user_statuses = cursor.fetchall()
    print(f"Trạng thái user:")
    for row in user_statuses:
        print(f"   {row['status']}: {row['count']} user")
    
    # User có current_room_id
    cursor.execute("""
        SELECT COUNT(*) as count 
        FROM users 
        WHERE current_room_id IS NOT NULL
    """)
    users_in_rooms = cursor.fetchone()['count']
    print(f"User đang trong phòng: {users_in_rooms}")
    
    # User có current_room_id nhưng phòng đã end
    cursor.execute("""
        SELECT u.id, u.username, u.current_room_id, r.end_time
        FROM users u
        JOIN rooms r ON u.current_room_id = r.id
        WHERE r.end_time IS NOT NULL
    """)
    users_in_ended_rooms = cursor.fetchall()
    print(f"User trong phòng đã end: {len(users_in_ended_rooms)}")
    for row in users_in_ended_rooms:
        print(f"   User {row['username']} (ID: {row['id']}) - Phòng {row['current_room_id']} ended: {row['end_time']}")
    
    print()

def check_duplicate_rooms(conn):
    """Kiểm tra phòng trùng lặp"""
    print("=== KIỂM TRA PHÒNG TRÙNG LẶP ===")
    
    cursor = conn.cursor()
    
    # Phòng có cùng user1_id và user2_id
    cursor.execute("""
        SELECT user1_id, user2_id, COUNT(*) as count, 
               GROUP_CONCAT(id) as room_ids,
               GROUP_CONCAT(created_at) as created_dates
        FROM rooms
        GROUP BY user1_id, user2_id
        HAVING COUNT(*) > 1
        ORDER BY count DESC
    """)
    duplicate_pairs = cursor.fetchall()
    
    if duplicate_pairs:
        print(f"Tìm thấy {len(duplicate_pairs)} cặp user có nhiều phòng:")
        for row in duplicate_pairs:
            print(f"   User1: {row['user1_id']}, User2: {row['user2_id']}")
            print(f"   Số phòng: {row['count']}")
            print(f"   Room IDs: {row['room_ids']}")
            print(f"   Ngày tạo: {row['created_dates']}")
            print()
    else:
        print("Không có phòng trùng lặp")
    
    # Phòng có cùng user1_id hoặc user2_id
    cursor.execute("""
        SELECT user1_id, COUNT(*) as count
        FROM rooms
        GROUP BY user1_id
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 10
    """)
    user1_multiple_rooms = cursor.fetchall()
    
    if user1_multiple_rooms:
        print(f"User1 có nhiều phòng (top 10):")
        for row in user1_multiple_rooms:
            print(f"   User {row['user1_id']}: {row['count']} phòng")
    
    cursor.execute("""
        SELECT user2_id, COUNT(*) as count
        FROM rooms
        GROUP BY user2_id
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 10
    """)
    user2_multiple_rooms = cursor.fetchall()
    
    if user2_multiple_rooms:
        print(f"User2 có nhiều phòng (top 10):")
        for row in user2_multiple_rooms:
            print(f"   User {row['user2_id']}: {row['count']} phòng")
    
    print()

def check_room_creation_patterns(conn):
    """Kiểm tra pattern tạo phòng"""
    print("=== KIỂM TRA PATTERN TẠO PHÒNG ===")
    
    cursor = conn.cursor()
    
    # Phòng được tạo trong 24h gần nhất
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM rooms
        WHERE created_at >= datetime('now', '-24 hours')
    """)
    rooms_24h = cursor.fetchone()['count']
    print(f"Phòng tạo trong 24h: {rooms_24h}")
    
    # Phòng được tạo trong 1h gần nhất
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM rooms
        WHERE created_at >= datetime('now', '-1 hour')
    """)
    rooms_1h = cursor.fetchone()['count']
    print(f"Phòng tạo trong 1h: {rooms_1h}")
    
    # Phòng được tạo trong 10 phút gần nhất
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM rooms
        WHERE created_at >= datetime('now', '-10 minutes')
    """)
    rooms_10min = cursor.fetchone()['count']
    print(f"Phòng tạo trong 10 phút: {rooms_10min}")
    
    # Phòng được tạo theo giờ
    cursor.execute("""
        SELECT strftime('%H', created_at) as hour, COUNT(*) as count
        FROM rooms
        WHERE created_at >= datetime('now', '-24 hours')
        GROUP BY strftime('%H', created_at)
        ORDER BY hour
    """)
    hourly_rooms = cursor.fetchall()
    print(f"Phòng tạo theo giờ (24h gần nhất):")
    for row in hourly_rooms:
        print(f"   {row['hour']}:00 - {row['count']} phòng")
    
    print()

def check_room_lifecycle(conn):
    """Kiểm tra vòng đời phòng"""
    print("=== KIỂM TRA VÒNG ĐỜI PHÒNG ===")
    
    cursor = conn.cursor()
    
    # Phòng có thời gian tồn tại ngắn (< 1 phút)
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM rooms
        WHERE end_time IS NOT NULL 
        AND (julianday(end_time) - julianday(start_time)) * 24 * 60 < 1
    """)
    short_lived_rooms = cursor.fetchone()['count']
    print(f"Phòng tồn tại < 1 phút: {short_lived_rooms}")
    
    # Phòng có thời gian tồn tại rất ngắn (< 10 giây)
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM rooms
        WHERE end_time IS NOT NULL 
        AND (julianday(end_time) - julianday(start_time)) * 24 * 60 * 60 < 10
    """)
    very_short_rooms = cursor.fetchone()['count']
    print(f"Phòng tồn tại < 10 giây: {very_short_rooms}")
    
    # Phòng có thời gian tồn tại dài (> 24h)
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM rooms
        WHERE end_time IS NOT NULL 
        AND (julianday(end_time) - julianday(start_time)) > 1
    """)
    long_lived_rooms = cursor.fetchone()['count']
    print(f"Phòng tồn tại > 24h: {long_lived_rooms}")
    
    # Phòng chưa end và tồn tại > 24h
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM rooms
        WHERE end_time IS NULL 
        AND (julianday('now') - julianday(start_time)) > 1
    """)
    active_long_rooms = cursor.fetchone()['count']
    print(f"Phòng active > 24h: {active_long_rooms}")
    
    print()

def check_specific_user_rooms(conn, user_id: int):
    """Kiểm tra phòng của một user cụ thể"""
    print(f"=== KIỂM TRA PHÒNG CỦA USER {user_id} ===")
    
    cursor = conn.cursor()
    
    # Phòng user tham gia
    cursor.execute("""
        SELECT id, type, user1_id, user2_id, start_time, end_time, created_at
        FROM rooms
        WHERE user1_id = ? OR user2_id = ?
        ORDER BY created_at DESC
    """, (user_id, user_id))
    user_rooms = cursor.fetchall()
    
    print(f"User {user_id} tham gia {len(user_rooms)} phòng:")
    for row in user_rooms:
        role = "User1" if row['user1_id'] == user_id else "User2"
        other_user = row['user2_id'] if row['user1_id'] == user_id else row['user1_id']
        status = "Active" if row['end_time'] is None else "Ended"
        print(f"   Phòng {row['id']}: {role} với User {other_user}")
        print(f"     Loại: {row['type']}, Trạng thái: {status}")
        print(f"   Bắt đầu: {row['start_time']}")
        if row['end_time']:
            print(f"     Kết thúc: {row['end_time']}")
        print(f"     Tạo: {row['created_at']}")
        print()
    
    # User status hiện tại
    cursor.execute("""
        SELECT status, current_room_id, online_status
        FROM users
        WHERE id = ?
    """, (user_id,))
    user_status = cursor.fetchone()
    
    if user_status:
        print(f"Trạng thái hiện tại của User {user_id}:")
        print(f"   Status: {user_status['status']}")
        print(f"   Current Room ID: {user_status['current_room_id']}")
        print(f"   Online: {user_status['online_status']}")
    
    print()

def check_matching_queue(conn):
    """Kiểm tra matching queue"""
    print("=== KIỂM TRA MATCHING QUEUE ===")
    
    cursor = conn.cursor()
    
    # User trong queue
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM matching_queue
    """)
    queue_users = cursor.fetchone()['count']
    print(f"User trong queue: {queue_users}")
    
    # User trong queue theo type
    cursor.execute("""
        SELECT type, COUNT(*) as count
        FROM matching_queue
        GROUP BY type
    """)
    queue_by_type = cursor.fetchall()
    print(f"Queue theo type:")
    for row in queue_by_type:
        print(f"   {row['type']}: {row['count']} user")
    
    # User trong queue nhưng status không phải searching
    cursor.execute("""
        SELECT mq.user_id, mq.type, u.status, u.current_room_id
        FROM matching_queue mq
        JOIN users u ON mq.user_id = u.id
        WHERE u.status != 'searching'
    """)
    inconsistent_queue = cursor.fetchall()
    
    if inconsistent_queue:
        print(f"User trong queue nhưng status không phải searching: {len(inconsistent_queue)}")
        for row in inconsistent_queue:
            print(f"   User {row['user_id']}: type={row['type']}, status={row['status']}, room={row['current_room_id']}")
    
    print()

def main():
    """Main function"""
    print("BẮT ĐẦU KIỂM TRA DATABASE")
    print("=" * 50)
    
    conn = connect_db()
    if not conn:
        return
    
    try:
        # Kiểm tra tổng quan
        check_rooms_overview(conn)
        
        # Kiểm tra trạng thái user
        check_user_room_status(conn)
        
        # Kiểm tra phòng trùng lặp
        check_duplicate_rooms(conn)
        
        # Kiểm tra pattern tạo phòng
        check_room_creation_patterns(conn)
        
        # Kiểm tra vòng đời phòng
        check_room_lifecycle(conn)
        
        # Kiểm tra matching queue
        check_matching_queue(conn)
        
        # Kiểm tra một số user cụ thể có nhiều phòng
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user1_id, COUNT(*) as count
            FROM rooms
            GROUP BY user1_id
            HAVING COUNT(*) > 3
            ORDER BY count DESC
            LIMIT 3
        """)
        top_users = cursor.fetchall()
        
        if top_users:
            print("=== KIỂM TRA USER CÓ NHIỀU PHÒNG ===")
            for row in top_users:
                check_specific_user_rooms(conn, row['user1_id'])
        
        print("HOÀN THÀNH KIỂM TRA")
        
    except Exception as e:
        print(f"Lỗi trong quá trình kiểm tra: {e}")
    
    finally:
        conn.close()

if __name__ == "__main__":
    main()
