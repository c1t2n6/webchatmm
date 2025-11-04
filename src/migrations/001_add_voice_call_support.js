// Migration: Add Voice Call Support to Rooms
// Add entry_mode, current_mode, voice_call_active fields to rooms table

const fs = require('fs').promises;
const path = require('path');

class VoiceCallMigration {
  constructor(database) {
    this.db = database;
    this.migrationName = '001_add_voice_call_support';
  }

  async up() {
    console.log(`🔄 Running migration: ${this.migrationName}`);
    
    try {
      // Add new columns to rooms table
      const alterRoomsTable = [
        // Entry mode: how user entered this room ('chat' or 'voice')
        `ALTER TABLE rooms ADD COLUMN entry_mode TEXT DEFAULT 'chat'`,
        
        // Current mode: current active mode ('chat' or 'voice')
        `ALTER TABLE rooms ADD COLUMN current_mode TEXT DEFAULT 'chat'`,
        
        // Voice call status: is there an active voice call in this room
        `ALTER TABLE rooms ADD COLUMN voice_call_active BOOLEAN DEFAULT 0`,
        
        // Voice call session ID: reference to active voice call
        `ALTER TABLE rooms ADD COLUMN voice_call_session_id INTEGER`,
        
        // Both users kept room: easier access for UI logic
        `ALTER TABLE rooms ADD COLUMN both_kept BOOLEAN DEFAULT 0`
      ];

      // Execute each ALTER statement
      for (const sql of alterRoomsTable) {
        try {
          await this.db.run(sql);
          console.log(`✅ Executed: ${sql}`);
        } catch (error) {
          // Handle "duplicate column name" error gracefully
          if (error.message.includes('duplicate column name')) {
            console.log(`⚠️ Column already exists, skipping: ${sql}`);
          } else {
            throw error;
          }
        }
      }

      // Create voice call invitations table
      const createInvitationsTable = `
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

      await this.db.run(createInvitationsTable);
      console.log('✅ Created voice_call_invitations table');

      // Create indexes for better performance
      const createIndexes = [
        `CREATE INDEX IF NOT EXISTS idx_rooms_entry_mode ON rooms(entry_mode)`,
        `CREATE INDEX IF NOT EXISTS idx_rooms_voice_call_active ON rooms(voice_call_active)`,
        `CREATE INDEX IF NOT EXISTS idx_voice_invitations_status ON voice_call_invitations(status)`,
        `CREATE INDEX IF NOT EXISTS idx_voice_invitations_room ON voice_call_invitations(room_id)`
      ];

      for (const sql of createIndexes) {
        await this.db.run(sql);
        console.log(`✅ Created index: ${sql}`);
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
      // Drop voice_call_invitations table
      await this.db.run('DROP TABLE IF EXISTS voice_call_invitations');
      console.log('✅ Dropped voice_call_invitations table');

      // Remove columns from rooms table (SQLite doesn't support DROP COLUMN easily)
      // In production, you might want to create new table and migrate data
      console.log('⚠️ Note: SQLite does not support DROP COLUMN. Consider manual cleanup if needed.');

      // Remove migration record
      await this.removeMigrationRecord();
      console.log(`✅ Migration rolled back: ${this.migrationName}`);

    } catch (error) {
      console.error(`❌ Rollback failed: ${this.migrationName}`, error);
      throw error;
    }
  }

  async recordMigration() {
    // Create migrations table if it doesn't exist
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Record this migration
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

  async isMigrationExecuted() {
    const result = await this.db.get(
      'SELECT * FROM migrations WHERE name = ?',
      [this.migrationName]
    );
    return !!result;
  }
}

module.exports = VoiceCallMigration;
