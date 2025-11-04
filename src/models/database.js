// Database connection and setup
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../../config');
const MigrationRunner = require('../utils/migrationRunner');

class Database {
  constructor() {
    this.db = null;
    // Use DATABASE_URL from environment or fallback to default
    this.dbPath = this.getDatabasePath();
  }

  getDatabasePath() {
    // Parse DATABASE_URL (format: sqlite:///./app.db)
    if (config.databaseUrl && config.databaseUrl.startsWith('sqlite:///')) {
      const dbPath = config.databaseUrl.replace('sqlite:///', '');
      return path.resolve(dbPath);
    }
    
    // Fallback to default path
    return path.join(__dirname, '../../app.db');
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('🔗 Attempting to connect to database at:', this.dbPath);
      
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        console.log('📁 Creating database directory:', dbDir);
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Database connection error:', err);
          console.error('❌ Database path:', this.dbPath);
          console.error('❌ Current working directory:', process.cwd());
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          console.log('✅ Database path:', this.dbPath);
          resolve();
        }
      });
    });
  }

  async createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(128),
        google_id VARCHAR(128) UNIQUE,
        email VARCHAR(120) UNIQUE,
        is_verified BOOLEAN DEFAULT 0,
        nickname VARCHAR(50) UNIQUE NOT NULL,
        dob DATE NOT NULL,
        gender VARCHAR(10) NOT NULL,
        preferred_gender TEXT,
        needs TEXT,
        interests TEXT,
        profile_completed BOOLEAN DEFAULT 0,
        status VARCHAR(20) DEFAULT 'idle',
        online_status BOOLEAN DEFAULT 0,
        current_room_id INTEGER,
        avatar_url VARCHAR(255) DEFAULT 'default_avatar.jpg',
        reports_count INTEGER DEFAULT 0,
        banned_until DATE,
        role VARCHAR(20) DEFAULT 'free',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (current_room_id) REFERENCES rooms(id)
      )
    `;

    const createRoomsTable = `
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type VARCHAR(10) NOT NULL DEFAULT 'chat',
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        like_responses TEXT,
        keep_active_responses TEXT,
        reveal_level INTEGER DEFAULT 0,
        keep_active BOOLEAN DEFAULT 0,
        last_message_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users(id),
        FOREIGN KEY (user2_id) REFERENCES users(id)
      )
    `;

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const createReportsTable = `
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        reported_user_id INTEGER NOT NULL,
        room_id INTEGER,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id),
        FOREIGN KEY (reported_user_id) REFERENCES users(id),
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `;

    const createMatchingQueueTable = `
      CREATE TABLE IF NOT EXISTS matching_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        type VARCHAR(10) NOT NULL DEFAULT 'chat',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const createIcebreakersTable = `
      CREATE TABLE IF NOT EXISTS icebreakers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interest VARCHAR(50) NOT NULL,
        prompt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Voice Call Tables
    const createCallSessionsTable = `
      CREATE TABLE IF NOT EXISTS call_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        caller_id INTEGER NOT NULL,
        callee_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'initiated',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        answered_at DATETIME NULL,
        ended_at DATETIME NULL,
        duration INTEGER DEFAULT 0,
        end_reason VARCHAR(50) NULL,
        quality_rating INTEGER NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        FOREIGN KEY (caller_id) REFERENCES users(id),
        FOREIGN KEY (callee_id) REFERENCES users(id)
      )
    `;

    // ✅ REMOVED: call_participants table - not needed for 1-on-1 calls
    
    const createUserCallSettingsTable = `
      CREATE TABLE IF NOT EXISTS user_call_settings (
        user_id INTEGER PRIMARY KEY,
        call_notifications BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const tables = [
      createUsersTable,
      createRoomsTable,
      createMessagesTable,
      createReportsTable,
      createMatchingQueueTable,
      createIcebreakersTable,
      createCallSessionsTable,
      createUserCallSettingsTable
    ];

    for (const table of tables) {
      await this.run(table);
    }

    console.log('✅ Database tables created successfully');
    
    // Run migrations after creating base tables
    await this.runMigrations();
  }

  async runMigrations() {
    try {
      const migrationRunner = new MigrationRunner(this);
      await migrationRunner.runMigrations();
    } catch (error) {
      console.error('❌ Migration error:', error);
      // Don't throw - allow app to continue with base tables
      console.log('⚠️ Continuing with base database schema');
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('❌ Database error:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('❌ Database error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ Database error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Database close error:', err);
          } else {
            console.log('✅ Database connection closed');
          }
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Get database statistics
  getStats() {
    return {
      connected: this.db !== null,
      path: this.dbPath
    };
  }
}

module.exports = Database;
