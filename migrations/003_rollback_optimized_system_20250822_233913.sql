
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
