// User model
const bcrypt = require('bcrypt');
const config = require('../../config');

class User {
  constructor(db) {
    this.db = db;
  }

  async create(userData) {
    const {
      username,
      password,
      email,
      nickname,
      dob,
      gender,
      preferred_gender = [],
      needs = [],
      interests = [],
      profile_completed = false,
      role = 'free'
    } = userData;

    // Hash password
    const password_hash = await bcrypt.hash(password, config.bcryptRounds);

    const sql = `
      INSERT INTO users (
        username, password_hash, email, nickname, dob, gender,
        preferred_gender, needs, interests, profile_completed, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      username,
      password_hash,
      email,
      nickname,
      dob,
      gender,
      JSON.stringify(preferred_gender),
      JSON.stringify(needs),
      JSON.stringify(interests),
      profile_completed,
      role
    ];

    const result = await this.db.run(sql, params);
    return this.findById(result.id);
  }

  async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const user = await this.db.get(sql, [id]);
    return user ? this.parseUser(user) : null;
  }

  async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    const user = await this.db.get(sql, [username]);
    return user ? this.parseUser(user) : null;
  }

  async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const user = await this.db.get(sql, [email]);
    return user ? this.parseUser(user) : null;
  }

  async findByNickname(nickname) {
    const sql = 'SELECT * FROM users WHERE nickname = ?';
    const user = await this.db.get(sql, [nickname]);
    return user ? this.parseUser(user) : null;
  }

  async update(id, updateData) {
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'preferred_gender' || key === 'needs' || key === 'interests') {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
      }
    });

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.run(sql, values);

    return this.findById(id);
  }

  async updateStatus(id, status, current_room_id = null) {
    const sql = 'UPDATE users SET status = ?, current_room_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await this.db.run(sql, [status, current_room_id, id]);
    return this.findById(id);
  }

  async updateOnlineStatus(id, online_status) {
    const sql = 'UPDATE users SET online_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await this.db.run(sql, [online_status, id]);
    return this.findById(id);
  }

  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async isBanned(user) {
    if (!user.banned_until) return false;
    const today = new Date().toISOString().split('T')[0];
    return user.banned_until > today;
  }

  parseUser(user) {
    if (!user) return null;

    return {
      ...user,
      preferred_gender: user.preferred_gender ? JSON.parse(user.preferred_gender) : [],
      needs: user.needs ? JSON.parse(user.needs) : [],
      interests: user.interests ? JSON.parse(user.interests) : [],
      profile_completed: Boolean(user.profile_completed),
      online_status: Boolean(user.online_status)
    };
  }

  async getAll() {
    const sql = 'SELECT * FROM users ORDER BY created_at DESC';
    const users = await this.db.all(sql);
    return users.map(user => this.parseUser(user));
  }

  async getByStatus(status) {
    const sql = 'SELECT * FROM users WHERE status = ? ORDER BY created_at DESC';
    const users = await this.db.all(sql, [status]);
    return users.map(user => this.parseUser(user));
  }

  async delete(id) {
    const sql = 'DELETE FROM users WHERE id = ?';
    await this.db.run(sql, [id]);
    return true;
  }

  async findActiveByUserId(userId) {
    const sql = `
      SELECT u.*, r.id as room_id, r.type, r.start_time, r.end_time
      FROM users u
      LEFT JOIN rooms r ON u.current_room_id = r.id
      WHERE u.id = ? AND r.end_time IS NULL
    `;
    const result = await this.db.get(sql, [userId]);
    return result ? this.parseUser(result) : null;
  }

  async getRoomStats(userId) {
    const sql = `
      SELECT 
        COUNT(CASE WHEN r.user1_id = ? OR r.user2_id = ? THEN 1 END) as total_rooms,
        COUNT(CASE WHEN (r.user1_id = ? OR r.user2_id = ?) AND r.end_time IS NOT NULL THEN 1 END) as completed_rooms,
        COUNT(CASE WHEN (r.user1_id = ? OR r.user2_id = ?) AND r.end_time IS NULL THEN 1 END) as active_rooms,
        COUNT(m.id) as total_messages
      FROM rooms r
      LEFT JOIN messages m ON r.id = m.room_id AND (r.user1_id = ? OR r.user2_id = ?)
      WHERE r.user1_id = ? OR r.user2_id = ?
    `;
    const result = await this.db.get(sql, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);
    return result || {
      total_rooms: 0,
      completed_rooms: 0,
      active_rooms: 0,
      total_messages: 0
    };
  }
}

module.exports = User;
