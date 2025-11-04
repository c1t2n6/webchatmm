// User Call Settings Model - Manages user preferences for voice calls
class UserCallSettings {
  constructor(database) {
    this.db = database;
  }

  // Create default settings for user
  async createDefaultSettings(userId) {
    const sql = `
      INSERT OR IGNORE INTO user_call_settings (
        user_id,
        call_notifications
      ) VALUES (?, 1)
    `;
    
    try {
      await this.db.run(sql, [userId]);
      return await this.getSettings(userId);
    } catch (error) {
      console.error('❌ Error creating default call settings:', error);
      throw error;
    }
  }

  // Get user call settings
  async getSettings(userId) {
    const sql = `
      SELECT * FROM user_call_settings WHERE user_id = ?
    `;
    
    try {
      let settings = await this.db.get(sql, [userId]);
      
      // Create default settings if they don't exist
      if (!settings) {
        await this.createDefaultSettings(userId);
        settings = await this.db.get(sql, [userId]);
      }
      
      return settings;
    } catch (error) {
      console.error('❌ Error getting call settings:', error);
      throw error;
    }
  }

  // Update user call settings
  async updateSettings(userId, updateData) {
    const fields = [];
    const values = [];
    
    // Build dynamic update query  
    if (updateData.callNotifications !== undefined) {
      fields.push('call_notifications = ?');
      values.push(updateData.callNotifications ? 1 : 0);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    // Add updated_at timestamp
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId); // Add user ID for WHERE clause
    
    const sql = `
      UPDATE user_call_settings 
      SET ${fields.join(', ')}
      WHERE user_id = ?
    `;
    
    try {
      const result = await this.db.run(sql, values);
      if (result.changes === 0) {
        // Settings don't exist, create them first
        await this.createDefaultSettings(userId);
        // Then update with the provided data
        return await this.updateSettings(userId, updateData);
      }
      return await this.getSettings(userId);
    } catch (error) {
      console.error('❌ Error updating call settings:', error);
      throw error;
    }
  }

  // ✅ REMOVED: hasAutoAnswer - auto-answer feature removed

  // Check if user has call notifications enabled
  async hasCallNotifications(userId) {
    try {
      const settings = await this.getSettings(userId);
      return settings.call_notifications === 1;
    } catch (error) {
      console.error('❌ Error checking call notifications:', error);
      return true; // Default to enabled
    }
  }

  // ✅ REMOVED: Audio device methods - not needed for simplified system
  // ✅ REMOVED: Quality preference methods - using auto-detect  
  
  // Get max call duration in seconds (default: 3600 = 1 hour)
  async getMaxCallDuration(userId) {
    try {
      // For now, return default max duration (1 hour)
      // In the future, this can be retrieved from user settings if we add max_duration column
      return 3600; // 1 hour in seconds
    } catch (error) {
      console.error('❌ Error getting max call duration:', error);
      return 3600; // Default to 1 hour on error
    }
  }

  // Reset settings to default
  async resetToDefault(userId) {
    const sql = `
      UPDATE user_call_settings 
      SET 
        call_notifications = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    
    try {
      const result = await this.db.run(sql, [userId]);
      if (result.changes === 0) {
        // Settings don't exist, create default ones
        await this.createDefaultSettings(userId);
      }
      return await this.getSettings(userId);
    } catch (error) {
      console.error('❌ Error resetting call settings:', error);
      throw error;
    }
  }

  // Get settings statistics (for admin/analytics)
  async getSettingsStatistics() {
    const sql = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN call_notifications = 1 THEN 1 END) as notifications_enabled
      FROM user_call_settings
    `;
    
    try {
      return await this.db.get(sql);
    } catch (error) {
      console.error('❌ Error getting settings statistics:', error);
      throw error;
    }
  }

  // Delete user settings (for user deletion cleanup)
  async deleteUserSettings(userId) {
    const sql = `DELETE FROM user_call_settings WHERE user_id = ?`;
    
    try {
      const result = await this.db.run(sql, [userId]);
      console.log(`🧹 Deleted call settings for user ${userId}`);
      return result.changes > 0;
    } catch (error) {
      console.error('❌ Error deleting user call settings:', error);
      throw error;
    }
  }
}

module.exports = UserCallSettings;
