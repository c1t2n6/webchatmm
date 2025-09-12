// Message model
class Message {
  constructor(db) {
    this.db = db;
  }

  async create(messageData) {
    const {
      room_id,
      user_id,
      content
    } = messageData;

    const sql = `
      INSERT INTO messages (room_id, user_id, content)
      VALUES (?, ?, ?)
    `;

    const params = [room_id, user_id, content];
    const result = await this.db.run(sql, params);
    return this.findById(result.id);
  }

  async findById(id) {
    const sql = 'SELECT * FROM messages WHERE id = ?';
    return await this.db.get(sql, [id]);
  }

  async findByRoomId(room_id, limit = 50, offset = 0) {
    // ✅ SỬA: Validate input parameters
    const roomId = parseInt(room_id);
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 messages
    const offsetNum = Math.max(parseInt(offset) || 0, 0);
    
    if (isNaN(roomId) || roomId <= 0) {
      throw new Error('Invalid room_id parameter');
    }
    
    const sql = `
      SELECT m.*, u.username, u.nickname
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.timestamp ASC
      LIMIT ? OFFSET ?
    `;
    return await this.db.all(sql, [roomId, limitNum, offsetNum]);
  }

  async getRecentByRoomId(room_id, limit = 50) {
    // ✅ SỬA: Validate input parameters
    const roomId = parseInt(room_id);
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 messages
    
    if (isNaN(roomId) || roomId <= 0) {
      throw new Error('Invalid room_id parameter');
    }
    
    const sql = `
      SELECT m.*, u.username, u.nickname
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `;
    const messages = await this.db.all(sql, [roomId, limitNum]);
    return messages.reverse(); // Return in chronological order
  }

  async getCountByRoomId(room_id) {
    const sql = 'SELECT COUNT(*) as count FROM messages WHERE room_id = ?';
    const result = await this.db.get(sql, [room_id]);
    return result.count;
  }

  // ✅ THÊM: Method getByRoomId để tương thích với API
  async getByRoomId(room_id, limit = 50, offset = 0) {
    return await this.findByRoomId(room_id, limit, offset);
  }

  async delete(id) {
    const sql = 'DELETE FROM messages WHERE id = ?';
    await this.db.run(sql, [id]);
    return true;
  }

  async deleteByRoomId(room_id) {
    const sql = 'DELETE FROM messages WHERE room_id = ?';
    await this.db.run(sql, [room_id]);
    return true;
  }

  async getAll() {
    const sql = 'SELECT * FROM messages ORDER BY timestamp DESC';
    return await this.db.all(sql);
  }
}

module.exports = Message;
