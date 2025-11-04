// Migration: Simplify Voice Call Tables
// Remove call_participants and voice_call_invitations tables
// Update user_call_settings to simplified version

class SimplifyVoiceCallTables {
  constructor(database) {
    this.db = database;
    this.migrationName = '002_simplify_voice_call_tables';
  }

  async up() {
    console.log(`🔄 Running migration: ${this.migrationName}`);
    
    try {
      // 1. Drop voice_call_invitations table (no longer needed)
      await this.db.run('DROP TABLE IF EXISTS voice_call_invitations');
      console.log('✅ Dropped voice_call_invitations table');

      // 2. Drop call_participants table (1-on-1 calls don't need it)
      await this.db.run('DROP TABLE IF EXISTS call_participants');
      console.log('✅ Dropped call_participants table');

      // 3. Simplify user_call_settings table
      // SQLite doesn't support DROP COLUMN, so we'll create new table
      const createNewUserCallSettingsTable = `
        CREATE TABLE IF NOT EXISTS user_call_settings_new (
          user_id INTEGER PRIMARY KEY,
          call_notifications BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      await this.db.run(createNewUserCallSettingsTable);
      console.log('✅ Created simplified user_call_settings_new table');

      // 4. Migrate existing data (only call_notifications)
      const migrateData = `
        INSERT OR IGNORE INTO user_call_settings_new (user_id, call_notifications, created_at, updated_at)
        SELECT user_id, call_notifications, created_at, updated_at
        FROM user_call_settings
      `;
      
      await this.db.run(migrateData);
      console.log('✅ Migrated existing user call settings data');

      // 5. Drop old table and rename new one
      await this.db.run('DROP TABLE IF EXISTS user_call_settings');
      await this.db.run('ALTER TABLE user_call_settings_new RENAME TO user_call_settings');
      console.log('✅ Replaced user_call_settings with simplified version');

      // 6. Remove voice call columns from rooms table that are no longer needed
      // Note: SQLite doesn't support DROP COLUMN easily, so we'll just leave them
      // They'll be ignored in the code
      console.log('ℹ️ Note: Leaving unused voice call columns in rooms table (voice_call_session_id, etc.)');
      console.log('ℹ️ These columns will be ignored in the simplified system');

      // 7. Drop related indexes
      const dropIndexes = [
        'DROP INDEX IF EXISTS idx_voice_invitations_status',
        'DROP INDEX IF EXISTS idx_voice_invitations_room'
      ];

      for (const sql of dropIndexes) {
        try {
          await this.db.run(sql);
          console.log(`✅ Dropped index: ${sql}`);
        } catch (error) {
          console.log(`⚠️ Index may not exist: ${sql}`);
        }
      }

      // Record migration as completed
      await this.recordMigration();
      console.log(`✅ Migration completed: ${this.migrationName}`);

    } catch (error) {
      console.error(`❌ Migration failed: ${this.migrationName}`, error);
      throw error;
    }
  }

  async down() {
    console.log(`🔄 Rolling back migration: ${this.migrationName}`);
    
    try {
      // Restore user_call_settings to original structure
      const restoreUserCallSettingsTable = `
        CREATE TABLE IF NOT EXISTS user_call_settings_restored (
          user_id INTEGER PRIMARY KEY,
          auto_answer BOOLEAN DEFAULT 0,
          call_notifications BOOLEAN DEFAULT 1,
          microphone_device_id TEXT NULL,
          speaker_device_id TEXT NULL,
          call_quality_preference VARCHAR(20) DEFAULT 'balanced',
          max_call_duration INTEGER DEFAULT 3600,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      await this.db.run(restoreUserCallSettingsTable);
      
      // Migrate data back
      const migrateDataBack = `
        INSERT OR IGNORE INTO user_call_settings_restored (user_id, call_notifications, created_at, updated_at)
        SELECT user_id, call_notifications, created_at, updated_at
        FROM user_call_settings
      `;
      
      await this.db.run(migrateDataBack);
      await this.db.run('DROP TABLE IF EXISTS user_call_settings');
      await this.db.run('ALTER TABLE user_call_settings_restored RENAME TO user_call_settings');

      // Recreate call_participants table
      const recreateCallParticipantsTable = `
        CREATE TABLE IF NOT EXISTS call_participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          call_session_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          left_at DATETIME NULL,
          is_muted BOOLEAN DEFAULT 0,
          audio_quality VARCHAR(20) DEFAULT 'good',
          FOREIGN KEY (call_session_id) REFERENCES call_sessions(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      await this.db.run(recreateCallParticipantsTable);

      // Recreate voice_call_invitations table
      const recreateInvitationsTable = `
        CREATE TABLE IF NOT EXISTS voice_call_invitations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id INTEGER NOT NULL,
          inviter_id INTEGER NOT NULL,
          invitee_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME DEFAULT (datetime('now', '+2 minutes')),
          responded_at DATETIME,
          FOREIGN KEY (room_id) REFERENCES rooms(id),
          FOREIGN KEY (inviter_id) REFERENCES users(id),
          FOREIGN KEY (invitee_id) REFERENCES users(id)
        )
      `;
      
      await this.db.run(recreateInvitationsTable);

      // Remove migration record
      await this.removeMigrationRecord();
      console.log(`✅ Migration rolled back: ${this.migrationName}`);

    } catch (error) {
      console.error(`❌ Rollback failed: ${this.migrationName}`, error);
      throw error;
    }
  }

  async recordMigration() {
    await this.db.run(
      'INSERT OR IGNORE INTO migrations (name) VALUES (?)',
      [this.migrationName]
    );
  }

  async removeMigrationRecord() {
    await this.db.run(
      'DELETE FROM migrations WHERE name = ?',
      [this.migrationName]
    );
  }
}

module.exports = SimplifyVoiceCallTables;
