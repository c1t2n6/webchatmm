// Call Session Model - Manages voice call sessions
class CallSession {
  constructor(database) {
    this.db = database;
  }

  // Create a new call session
  async create(sessionData) {
    const { roomId, callerId, calleeId, status = 'initiated' } = sessionData;
    
    const sql = `
      INSERT INTO call_sessions (room_id, caller_id, callee_id, status)
      VALUES (?, ?, ?, ?)
    `;
    
    try {
      const result = await this.db.run(sql, [roomId, callerId, calleeId, status]);
      return await this.findById(result.id);
    } catch (error) {
      console.error('❌ Error creating call session:', error);
      throw error;
    }
  }

  // Find call session by ID
  async findById(id) {
    const sql = `
      SELECT 
        cs.*,
        caller.username as caller_username,
        caller.nickname as caller_nickname,
        caller.avatar_url as caller_avatar,
        callee.username as callee_username,
        callee.nickname as callee_nickname,
        callee.avatar_url as callee_avatar
      FROM call_sessions cs
      LEFT JOIN users caller ON cs.caller_id = caller.id
      LEFT JOIN users callee ON cs.callee_id = callee.id
      WHERE cs.id = ?
    `;
    
    try {
      return await this.db.get(sql, [id]);
    } catch (error) {
      console.error('❌ Error finding call session:', error);
      throw error;
    }
  }

  // Update call session
  async update(id, updateData) {
    const fields = [];
    const values = [];
    
    // Build dynamic update query
    if (updateData.status !== undefined) {
      fields.push('status = ?');
      values.push(updateData.status);
    }
    
    if (updateData.answeredAt !== undefined) {
      fields.push('answered_at = ?');
      values.push(updateData.answeredAt);
    }
    
    if (updateData.endedAt !== undefined) {
      fields.push('ended_at = ?');
      values.push(updateData.endedAt);
    }
    
    if (updateData.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updateData.duration);
    }
    
    if (updateData.endReason !== undefined) {
      fields.push('end_reason = ?');
      values.push(updateData.endReason);
    }
    
    if (updateData.qualityRating !== undefined) {
      fields.push('quality_rating = ?');
      values.push(updateData.qualityRating);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(id); // Add ID for WHERE clause
    
    const sql = `
      UPDATE call_sessions 
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    
    try {
      await this.db.run(sql, values);
      return await this.findById(id);
    } catch (error) {
      console.error('❌ Error updating call session:', error);
      throw error;
    }
  }

  // Get active call for user
  async getActiveCallForUser(userId) {
    const sql = `
      SELECT cs.*
      FROM call_sessions cs
      WHERE (cs.caller_id = ? OR cs.callee_id = ?)
        AND cs.status IN ('initiated', 'ringing', 'accepted', 'active')
      ORDER BY cs.created_at DESC
      LIMIT 1
    `;
    
    try {
      return await this.db.get(sql, [userId, userId]);
    } catch (error) {
      console.error('❌ Error getting active call for user:', error);
      throw error;
    }
  }

  // Get call history for user
  async getCallHistoryForUser(userId, limit = 50, offset = 0) {
    const sql = `
      SELECT 
        cs.*,
        CASE 
          WHEN cs.caller_id = ? THEN callee.username
          ELSE caller.username
        END as other_username,
        CASE 
          WHEN cs.caller_id = ? THEN callee.nickname
          ELSE caller.nickname
        END as other_nickname,
        CASE 
          WHEN cs.caller_id = ? THEN callee.avatar_url
          ELSE caller.avatar_url
        END as other_avatar,
        CASE 
          WHEN cs.caller_id = ? THEN 'outgoing'
          ELSE 'incoming'
        END as call_direction
      FROM call_sessions cs
      LEFT JOIN users caller ON cs.caller_id = caller.id
      LEFT JOIN users callee ON cs.callee_id = callee.id
      WHERE cs.caller_id = ? OR cs.callee_id = ?
      ORDER BY cs.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    try {
      return await this.db.all(sql, [
        userId, userId, userId, userId, // For CASE statements
        userId, userId, // For WHERE clause
        limit, offset
      ]);
    } catch (error) {
      console.error('❌ Error getting call history:', error);
      throw error;
    }
  }

  // Get call statistics for user
  async getCallStatsForUser(userId) {
    const sql = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'ended' AND duration > 0 THEN 1 END) as completed_calls,
        COUNT(CASE WHEN status = 'missed' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_calls,
        COUNT(CASE WHEN caller_id = ? THEN 1 END) as outgoing_calls,
        COUNT(CASE WHEN callee_id = ? THEN 1 END) as incoming_calls,
        AVG(CASE WHEN duration > 0 THEN duration END) as avg_call_duration,
        MAX(duration) as longest_call_duration,
        SUM(duration) as total_call_duration
      FROM call_sessions
      WHERE caller_id = ? OR callee_id = ?
    `;
    
    try {
      return await this.db.get(sql, [userId, userId, userId, userId]);
    } catch (error) {
      console.error('❌ Error getting call stats:', error);
      throw error;
    }
  }

  // Delete old call sessions (cleanup)
  async deleteOldSessions(daysOld = 30) {
    const sql = `
      DELETE FROM call_sessions 
      WHERE created_at < datetime('now', '-' || ? || ' days')
        AND status IN ('ended', 'missed', 'rejected')
    `;
    
    try {
      const result = await this.db.run(sql, [daysOld]);
      console.log(`🧹 Deleted ${result.changes} old call sessions`);
      return result.changes;
    } catch (error) {
      console.error('❌ Error deleting old call sessions:', error);
      throw error;
    }
  }

  // Get calls in room
  async getCallsInRoom(roomId, limit = 10) {
    const sql = `
      SELECT cs.*, 
        caller.nickname as caller_nickname,
        callee.nickname as callee_nickname
      FROM call_sessions cs
      LEFT JOIN users caller ON cs.caller_id = caller.id
      LEFT JOIN users callee ON cs.callee_id = callee.id
      WHERE cs.room_id = ?
      ORDER BY cs.created_at DESC
      LIMIT ?
    `;
    
    try {
      return await this.db.all(sql, [roomId, limit]);
    } catch (error) {
      console.error('❌ Error getting calls in room:', error);
      throw error;
    }
  }
}

module.exports = CallSession;
