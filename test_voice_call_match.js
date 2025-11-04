// Test Voice Call Matching with 2 Users
const http = require('http');

console.log('=== VOICE CALL MATCHING TEST ===');

let accessToken1 = null;
let accessToken2 = null;

// Login user 1
function loginUser1() {
    return new Promise((resolve, reject) => {
        console.log('🔐 Logging in user 1...');
        
        const postData = JSON.stringify({
            username: 'testuser',
            password: 'testpass'
        });
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    accessToken1 = response.access_token;
                    console.log('✅ User 1 logged in');
                    resolve();
                } else {
                    console.log('❌ User 1 login failed:', data);
                    reject(new Error('User 1 login failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ User 1 login request failed:', err.message);
            reject(err);
        });
        
        req.write(postData);
        req.end();
    });
}

// Login user 2
function loginUser2() {
    return new Promise((resolve, reject) => {
        console.log('🔐 Logging in user 2...');
        
        const postData = JSON.stringify({
            username: 'testuser1',
            password: 'testpass'
        });
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    accessToken2 = response.access_token;
                    console.log('✅ User 2 logged in');
                    resolve();
                } else {
                    console.log('❌ User 2 login failed:', data);
                    reject(new Error('User 2 login failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ User 2 login request failed:', err.message);
            reject(err);
        });
        
        req.write(postData);
        req.end();
    });
}

// Start voice call search for user 1
function startVoiceSearch1() {
    return new Promise((resolve, reject) => {
        console.log('📞 User 1 starting voice call search...');
        
        const postData = JSON.stringify({
            type: 'voice_call',
            entry_mode: 'voice',
            match_preference: 'same_entry_mode'
        });
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/chat/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken1}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('User 1 search response status:', res.statusCode);
                console.log('User 1 search response:', data);
                
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    if (response.room_id && response.matched_user) {
                        console.log('🎉 MATCH FOUND!');
                        console.log('Room ID:', response.room_id);
                        console.log('Matched user:', response.matched_user);
                        resolve(response);
                    } else {
                        console.log('⏳ No immediate match, waiting...');
                        resolve(response);
                    }
                } else {
                    console.log('❌ User 1 search failed');
                    reject(new Error('User 1 search failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ User 1 search request failed:', err.message);
            reject(err);
        });
        
        req.write(postData);
        req.end();
    });
}

// Start voice call search for user 2
function startVoiceSearch2() {
    return new Promise((resolve, reject) => {
        console.log('📞 User 2 starting voice call search...');
        
        const postData = JSON.stringify({
            type: 'voice_call',
            entry_mode: 'voice',
            match_preference: 'same_entry_mode'
        });
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/chat/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken2}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('User 2 search response status:', res.statusCode);
                console.log('User 2 search response:', data);
                
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    if (response.room_id && response.matched_user) {
                        console.log('🎉 MATCH FOUND!');
                        console.log('Room ID:', response.room_id);
                        console.log('Matched user:', response.matched_user);
                        resolve(response);
                    } else {
                        console.log('⏳ No immediate match, waiting...');
                        resolve(response);
                    }
                } else {
                    console.log('❌ User 2 search failed');
                    reject(new Error('User 2 search failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ User 2 search request failed:', err.message);
            reject(err);
        });
        
        req.write(postData);
        req.end();
    });
}

// Run the test
async function runTest() {
    try {
        // Reset user status first
        console.log('🔄 Resetting user status...');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('mapmo.db');
        
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET status = ? WHERE username IN (?, ?)', ['idle', 'testuser', 'testuser1'], function(err) {
                if (err) {
                    console.error('Error resetting status:', err.message);
                    reject(err);
                } else {
                    console.log('✅ User status reset to idle');
                    resolve();
                }
            });
        });
        
        db.close();
        
        // Login both users
        await loginUser1();
        await loginUser2();
        
        // Start voice search for both users
        console.log('\n📞 Starting voice call search for both users...');
        
        const [result1, result2] = await Promise.all([
            startVoiceSearch1(),
            startVoiceSearch2()
        ]);
        
        console.log('\n🎯 Results:');
        console.log('User 1 result:', result1);
        console.log('User 2 result:', result2);
        
        if (result1.room_id && result1.matched_user) {
            console.log('\n🎉 VOICE CALL MATCH SUCCESSFUL!');
            console.log('Room ID:', result1.room_id);
            console.log('Matched users:', result1.matched_user, 'and', result2.matched_user);
        } else {
            console.log('\n⏳ No match found yet, but both users are in queue');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

runTest();

