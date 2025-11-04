// Test Voice Call with Authentication
const http = require('http');

console.log('=== VOICE CALL AUTHENTICATION TEST ===');

// Test user credentials
const testUser = {
    username: 'testuser',
    password: 'testpass'
};

let accessToken = null;

// Step 1: Login to get access token
function login() {
    return new Promise((resolve, reject) => {
        console.log('🔐 Step 1: Logging in...');
        
        const postData = JSON.stringify(testUser);
        
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
                console.log('Login response status:', res.statusCode);
                
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    accessToken = response.access_token;
                    console.log('✅ Login successful');
                    console.log('Access token:', accessToken.substring(0, 20) + '...');
                    resolve();
                } else {
                    console.log('❌ Login failed:', data);
                    reject(new Error('Login failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ Login request failed:', err.message);
            reject(err);
        });
        
        req.write(postData);
        req.end();
    });
}

// Step 2: Test voice call search with authentication
function testVoiceCallSearch() {
    return new Promise((resolve, reject) => {
        console.log('\n📞 Step 2: Testing voice call search...');
        
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
                'Authorization': `Bearer ${accessToken}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Voice call search response status:', res.statusCode);
                console.log('Response:', data);
                
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    console.log('✅ Voice call search successful');
                    console.log('Room ID:', response.room_id);
                    console.log('Matched user:', response.matched_user);
                    resolve(response);
                } else {
                    console.log('❌ Voice call search failed');
                    reject(new Error('Voice call search failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ Voice call search request failed:', err.message);
            reject(err);
        });
        
        req.write(postData);
        req.end();
    });
}

// Step 3: Test user profile
function testUserProfile() {
    return new Promise((resolve, reject) => {
        console.log('\n👤 Step 3: Testing user profile...');
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/user/profile',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('User profile response status:', res.statusCode);
                
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    console.log('✅ User profile retrieved');
                    console.log('User:', response.user.username);
                    console.log('Profile completed:', response.user.profile_completed);
                    resolve(response);
                } else {
                    console.log('❌ User profile failed:', data);
                    reject(new Error('User profile failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ User profile request failed:', err.message);
            reject(err);
        });
        
        req.end();
    });
}

// Step 4: Test voice call settings
function testVoiceCallSettings() {
    return new Promise((resolve, reject) => {
        console.log('\n⚙️ Step 4: Testing voice call settings...');
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/voice-call/settings',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Voice call settings response status:', res.statusCode);
                
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    console.log('✅ Voice call settings retrieved');
                    console.log('Settings:', response.settings);
                    resolve(response);
                } else {
                    console.log('❌ Voice call settings failed:', data);
                    reject(new Error('Voice call settings failed'));
                }
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ Voice call settings request failed:', err.message);
            reject(err);
        });
        
        req.end();
    });
}

// Run all tests
async function runTests() {
    try {
        await login();
        await testUserProfile();
        await testVoiceCallSettings();
        await testVoiceCallSearch();
        
        console.log('\n✅ All voice call tests completed successfully!');
        console.log('\n🎯 Next steps:');
        console.log('1. Open http://localhost:8000 in browser');
        console.log('2. Login with testuser/testpass');
        console.log('3. Click "Voice Call" button');
        console.log('4. Check browser console for logs');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

runTests();
