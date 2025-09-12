// Script để tạo user thực sự
const fetch = require('node-fetch');

async function createRealUser() {
    console.log('🧪 Creating real user...');
    
    try {
        // Create user
        const response = await fetch('http://localhost:8000/auth/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'realtestuser',
                password: 'password123',
                email: 'realtest@example.com'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Real user created:', data);
            console.log('🔑 Token:', data.access_token);
            return data.access_token;
        } else {
            const error = await response.text();
            console.log('❌ User creation failed:', error);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error creating user:', error);
        return null;
    }
}

createRealUser();
