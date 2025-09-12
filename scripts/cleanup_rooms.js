// Script to cleanup orphaned rooms and users
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');

async function cleanupRooms() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Connected to database');
        });

        let cleanupCount = 0;

        // Cleanup 1: Reset orphaned users
        console.log('\n🧹 Cleanup 1: Resetting orphaned users...');
        db.run(`
            UPDATE users 
            SET status = 'idle', current_room_id = NULL, online_status = 0
            WHERE current_room_id IS NOT NULL 
            AND current_room_id NOT IN (
                SELECT id FROM rooms WHERE end_time IS NULL
            )
        `, function(err) {
            if (err) {
                console.error('❌ Error cleaning up orphaned users:', err.message);
            } else {
                console.log(`✅ Reset ${this.changes} orphaned users`);
                cleanupCount += this.changes;
            }
        });

        // Cleanup 2: End old rooms (older than 24 hours)
        console.log('\n🧹 Cleanup 2: Ending old rooms...');
        db.run(`
            UPDATE rooms 
            SET end_time = CURRENT_TIMESTAMP
            WHERE end_time IS NULL 
            AND created_at < datetime('now', '-24 hours')
        `, function(err) {
            if (err) {
                console.error('❌ Error ending old rooms:', err.message);
            } else {
                console.log(`✅ Ended ${this.changes} old rooms`);
                cleanupCount += this.changes;
            }
        });

        // Cleanup 3: Reset users in ended rooms
        console.log('\n🧹 Cleanup 3: Resetting users in ended rooms...');
        db.run(`
            UPDATE users 
            SET status = 'idle', current_room_id = NULL
            WHERE current_room_id IN (
                SELECT id FROM rooms WHERE end_time IS NOT NULL
            )
        `, function(err) {
            if (err) {
                console.error('❌ Error resetting users in ended rooms:', err.message);
            } else {
                console.log(`✅ Reset ${this.changes} users in ended rooms`);
                cleanupCount += this.changes;
            }
        });

        // Cleanup 4: Delete very old messages (older than 30 days)
        console.log('\n🧹 Cleanup 4: Deleting old messages...');
        db.run(`
            DELETE FROM messages 
            WHERE timestamp < datetime('now', '-30 days')
        `, function(err) {
            if (err) {
                console.error('❌ Error deleting old messages:', err.message);
            } else {
                console.log(`✅ Deleted ${this.changes} old messages`);
                cleanupCount += this.changes;
            }
        });

        // Cleanup 5: Delete very old rooms (older than 30 days)
        console.log('\n🧹 Cleanup 5: Deleting old rooms...');
        db.run(`
            DELETE FROM rooms 
            WHERE end_time IS NOT NULL 
            AND end_time < datetime('now', '-30 days')
        `, function(err) {
            if (err) {
                console.error('❌ Error deleting old rooms:', err.message);
            } else {
                console.log(`✅ Deleted ${this.changes} old rooms`);
                cleanupCount += this.changes;
            }
        });

        // Close database
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err.message);
                    reject(err);
                } else {
                    console.log(`\n✅ Cleanup completed! Total changes: ${cleanupCount}`);
                    resolve();
                }
            });
        }, 1000); // Wait 1 second for all operations to complete
    });
}

// Run the cleanup
cleanupRooms()
    .then(() => {
        console.log('🎉 Room cleanup completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Room cleanup failed:', error);
        process.exit(1);
    });
