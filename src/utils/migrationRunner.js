// Migration Runner - Execute database migrations
const path = require('path');
const fs = require('fs').promises;

class MigrationRunner {
  constructor(database) {
    this.db = database;
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.db.run(sql);
    console.log('✅ Migrations table created/verified');
  }

  async runMigrations() {
    console.log('🔄 Starting database migrations...');
    
    try {
      // ✅ FIRST: Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
      // Ensure migrations directory exists
      await this.ensureMigrationsDir();
      
      // Get all migration files
      const migrationFiles = await this.getMigrationFiles();
      
      if (migrationFiles.length === 0) {
        console.log('✅ No migrations to run');
        return;
      }

      // Execute each migration
      for (const file of migrationFiles) {
        await this.executeMigration(file);
      }

      console.log('✅ All migrations completed successfully');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async ensureMigrationsDir() {
    try {
      await fs.access(this.migrationsPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.migrationsPath, { recursive: true });
      console.log('✅ Created migrations directory');
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.js'))
        .sort(); // Ensure migrations run in order
    } catch (error) {
      console.log('⚠️ No migrations directory found');
      return [];
    }
  }

  async executeMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    
    try {
      // Dynamically import migration
      const MigrationClass = require(migrationPath);
      const migration = new MigrationClass(this.db);

      // Check if already executed
      if (migration.isMigrationExecuted && await migration.isMigrationExecuted()) {
        console.log(`⏭️ Migration already executed: ${filename}`);
        return;
      }

      console.log(`🔄 Executing migration: ${filename}`);
      
      // Run the migration
      await migration.up();
      
      console.log(`✅ Migration completed: ${filename}`);

    } catch (error) {
      console.error(`❌ Migration failed: ${filename}`, error);
      throw error;
    }
  }

  async rollbackMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    
    try {
      const MigrationClass = require(migrationPath);
      const migration = new MigrationClass(this.db);

      console.log(`🔄 Rolling back migration: ${filename}`);
      await migration.down();
      console.log(`✅ Migration rolled back: ${filename}`);

    } catch (error) {
      console.error(`❌ Rollback failed: ${filename}`, error);
      throw error;
    }
  }

  async getMigrationStatus() {
    try {
      // Get executed migrations from database
      const executedMigrations = await this.db.all(
        'SELECT name, executed_at FROM migrations ORDER BY executed_at'
      );

      // Get available migration files
      const availableMigrations = await this.getMigrationFiles();

      return {
        executed: executedMigrations,
        available: availableMigrations,
        pending: availableMigrations.filter(file => 
          !executedMigrations.some(m => m.name === file.replace('.js', ''))
        )
      };
    } catch (error) {
      console.log('⚠️ Could not get migration status:', error.message);
      return {
        executed: [],
        available: [],
        pending: []
      };
    }
  }
}

module.exports = MigrationRunner;
