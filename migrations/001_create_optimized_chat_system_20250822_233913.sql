
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
