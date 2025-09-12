// Room model
class Room {
  constructor(db) {
    this.db = db;
  }

  async create(roomData) {
    const {
      type = 'chat',
      user1_id,
      user2_id,
      like_responses = {},
      keep_active_responses = {},
      reveal_level = 0,
      keep_active = false
    } = roomData;

    const sql = `
      INSERT INTO rooms (
        type, user1_id, user2_id, like_responses, keep_active_responses,
        reveal_level, keep_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      type,
      user1_id,
      user2_id,
      JSON.stringify(like_responses),
      JSON.stringify(keep_active_responses),
      reveal_level,
      keep_active
    ];

    const result = await this.db.run(sql, params);
    return this.findById(result.id);
  }

  async findById(id) {
    const sql = 'SELECT * FROM rooms WHERE id = ?';
    const room = await this.db.get(sql, [id]);
    return room ? this.parseRoom(room) : null;
  }

  async findByUserId(user_id) {
    const sql = `
      SELECT * FROM rooms 
      WHERE (user1_id = ? OR user2_id = ?) 
      AND end_time IS NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const room = await this.db.get(sql, [user_id, user_id]);
    return room ? this.parseRoom(room) : null;
  }

  async findActiveByUserId(user_id) {
    const sql = `
      SELECT * FROM rooms 
      WHERE (user1_id = ? OR user2_id = ?) 
      AND end_time IS NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const room = await this.db.get(sql, [user_id, user_id]);
    return room ? this.parseRoom(room) : null;
  }

  async update(id, updateData) {
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'like_responses' || key === 'keep_active_responses') {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
      }
    });

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.run(sql, values);

    return this.findById(id);
  }

  async endRoom(id) {
    const sql = 'UPDATE rooms SET end_time = CURRENT_TIMESTAMP WHERE id = ?';
    await this.db.run(sql, [id]);
    return this.findById(id);
  }

  async updateLastMessageTime(id) {
    const sql = 'UPDATE rooms SET last_message_time = CURRENT_TIMESTAMP WHERE id = ?';
    await this.db.run(sql, [id]);
    return this.findById(id);
  }

  async getRoomUsers(room_id) {
    const sql = `
      SELECT u.* FROM users u
      INNER JOIN rooms r ON (u.id = r.user1_id OR u.id = r.user2_id)
      WHERE r.id = ? AND r.end_time IS NULL
    `;
    const users = await this.db.all(sql, [room_id]);
    return users;
  }

  async getOtherUser(room_id, current_user_id) {
    const sql = `
      SELECT u.* FROM users u
      INNER JOIN rooms r ON (u.id = r.user1_id OR u.id = r.user2_id)
      WHERE r.id = ? AND u.id != ? AND r.end_time IS NULL
    `;
    const user = await this.db.get(sql, [room_id, current_user_id]);
    return user;
  }

  parseRoom(room) {
    if (!room) return null;

    return {
      ...room,
      like_responses: room.like_responses ? JSON.parse(room.like_responses) : {},
      keep_active_responses: room.keep_active_responses ? JSON.parse(room.keep_active_responses) : {},
      keep_active: Boolean(room.keep_active)
    };
  }

  async getAll() {
    const sql = 'SELECT * FROM rooms ORDER BY created_at DESC';
    const rooms = await this.db.all(sql);
    return rooms.map(room => this.parseRoom(room));
  }

  async getActive() {
    const sql = 'SELECT * FROM rooms WHERE end_time IS NULL ORDER BY created_at DESC';
    const rooms = await this.db.all(sql);
    return rooms.map(room => this.parseRoom(room));
  }

  async delete(id) {
    const sql = 'DELETE FROM rooms WHERE id = ?';
    await this.db.run(sql, [id]);
    return true;
  }
}

module.exports = Room;
