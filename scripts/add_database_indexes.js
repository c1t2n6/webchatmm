// Script to add database indexes for performance optimization
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');

const indexes = [
    // Users table indexes
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
    'CREATE INDEX IF NOT EXISTS idx_users_current_room_id ON users(current_room_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_online_status ON users(online_status)',
    'CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed)',
    
    // Rooms table indexes
    'CREATE INDEX IF NOT EXISTS idx_rooms_user1_id ON rooms(user1_id)',
    'CREATE INDEX IF NOT EXISTS idx_rooms_user2_id ON rooms(user2_id)',
    'CREATE INDEX IF NOT EXISTS idx_rooms_end_time ON rooms(end_time)',
    'CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type)',
    'CREATE INDEX IF NOT EXISTS idx_rooms_start_time ON rooms(start_time)',
    
    // Messages table indexes
    'CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages(room_id, timestamp)',
    
    // Composite indexes for common queries
    'CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(user1_id, user2_id, end_time)',
    'CREATE INDEX IF NOT EXISTS idx_users_searching ON users(status, profile_completed)'
];

async function addIndexes() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Connected to database');
        });

        let completed = 0;
        const total = indexes.length;

        indexes.forEach((indexSQL, index) => {
            db.run(indexSQL, (err) => {
                if (err) {
                    console.error(`❌ Error creating index ${index + 1}:`, err.message);
                } else {
                    console.log(`✅ Created index ${index + 1}/${total}`);
                }
                
                completed++;
                if (completed === total) {
                    db.close((err) => {
                        if (err) {
                            console.error('❌ Error closing database:', err.message);
                            reject(err);
                        } else {
                            console.log('✅ All indexes created successfully!');
                            resolve();
                        }
                    });
                }
            });
        });
    });
}

// Run the script
addIndexes()
    .then(() => {
        console.log('🎉 Database optimization completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Database optimization failed:', error);
        process.exit(1);
    });
