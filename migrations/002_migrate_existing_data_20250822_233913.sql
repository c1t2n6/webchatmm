
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
