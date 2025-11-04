// Test API endpoints
const http = require('http');

console.log('=== API ENDPOINT TEST ===');

// Test 1: Check if server is running
function testServer() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8000,
            path: '/',
            method: 'GET'
        }, (res) => {
            console.log('✅ Server is running on port 8000');
            console.log('Status:', res.statusCode);
            resolve();
        });
        
        req.on('error', (err) => {
            console.error('❌ Server not running:', err.message);
            reject(err);
        });
        
        req.end();
    });
}

// Test 2: Test chat search API
function testChatSearchAPI() {
    return new Promise((resolve, reject) => {
        console.log('\n🔍 Testing /chat/search API...');
        
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
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Response status:', res.statusCode);
                console.log('Response headers:', res.headers);
                console.log('Response body:', data);
                
                if (res.statusCode === 401) {
                    console.log('✅ API endpoint exists (401 = unauthorized, expected)');
                } else if (res.statusCode === 404) {
                    console.log('❌ API endpoint not found (404)');
                } else {
                    console.log('✅ API endpoint exists');
                }
                
                resolve();
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ API test failed:', err.message);
            reject(err);
        });
        
        req.write(postData);
        req.end();
    });
}

// Test 3: Test other endpoints
function testOtherEndpoints() {
    return new Promise((resolve, reject) => {
        console.log('\n🔍 Testing other endpoints...');
        
        const endpoints = [
            '/auth/login',
            '/user/profile',
            '/voice-call/settings'
        ];
        
        let completed = 0;
        
        endpoints.forEach(endpoint => {
            const req = http.request({
                hostname: 'localhost',
                port: 8000,
                path: endpoint,
                method: 'GET'
            }, (res) => {
                console.log(`${endpoint}: ${res.statusCode}`);
                completed++;
                
                if (completed === endpoints.length) {
                    resolve();
                }
            });
            
            req.on('error', (err) => {
                console.error(`${endpoint}: Error - ${err.message}`);
                completed++;
                
                if (completed === endpoints.length) {
                    resolve();
                }
            });
            
            req.end();
        });
    });
}

// Run all tests
async function runTests() {
    try {
        await testServer();
        await testChatSearchAPI();
        await testOtherEndpoints();
        
        console.log('\n✅ All tests completed');
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

runTests();
