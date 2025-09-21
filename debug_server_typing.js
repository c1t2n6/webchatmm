// Debug script to check server-side typing indicator
// Run this in browser console

console.log('🔍 Debugging server-side typing indicator...');

// Test function to check if server is responding
function testServerResponse() {
    console.log('🧪 Testing server response...');
    
    // Send a simple message to test if server is working
    if (window.app && window.app.messageHandler) {
        const input = document.getElementById('messageInput');
        if (input) {
            input.value = 'Test server response';
            window.app.messageHandler.sendMessage();
            console.log('✅ Test message sent to server');
        } else {
            console.error('❌ Input element not found');
        }
    } else {
        console.error('❌ Message handler not found');
    }
}

// Test function to check WebSocket connection
function checkWebSocketConnection() {
    console.log('🔍 Checking WebSocket connection...');
    
    if (!window.app || !window.app.websocketManager) {
        console.error('❌ WebSocket manager not found');
        return false;
    }
    
    const ws = window.app.websocketManager.websocket;
    if (!ws) {
        console.error('❌ WebSocket not found');
        return false;
    }
    
    console.log('✅ WebSocket found:', ws);
    console.log('✅ WebSocket connected:', ws.connected);
    console.log('✅ WebSocket id:', ws.id);
    console.log('✅ WebSocket readyState:', ws.readyState);
    
    return ws.connected;
}

// Test function to check current room and user
function checkCurrentState() {
    console.log('🔍 Checking current state...');
    
    if (!window.app) {
        console.error('❌ App not found');
        return false;
    }
    
    console.log('✅ Current room:', window.app.currentRoom);
    console.log('✅ Current user:', window.app.currentUser);
    console.log('✅ WebSocket connected:', window.app.websocketManager?.isConnected());
    
    if (!window.app.currentRoom) {
        console.error('❌ No current room');
        return false;
    }
    
    if (!window.app.currentUser) {
        console.error('❌ No current user');
        return false;
    }
    
    return true;
}

// Test function to send typing indicator and monitor response
function testTypingIndicatorWithServerLogs() {
    console.log('🧪 Testing typing indicator with server logs...');
    
    // Check prerequisites
    if (!checkWebSocketConnection()) {
        console.error('❌ WebSocket not connected');
        return;
    }
    
    if (!checkCurrentState()) {
        console.error('❌ Invalid state');
        return;
    }
    
    console.log('✅ Prerequisites met, sending typing indicator...');
    
    // Send typing indicator
    if (window.app.messageHandler) {
        window.app.messageHandler.sendTypingIndicator();
        console.log('✅ Typing indicator sent');
    } else {
        console.error('❌ Message handler not found');
    }
    
    // Monitor for incoming messages
    let messageCount = 0;
    const originalHandler = window.app.chatModule.handleWebSocketMessage;
    
    window.app.chatModule.handleWebSocketMessage = function(data) {
        messageCount++;
        console.log(`📨 Message #${messageCount} received:`, data);
        
        if (data.type === 'typing' || data.type === 'stop_typing') {
            console.log('🎯 TYPING MESSAGE RECEIVED:', data);
        }
        
        // Call original handler
        originalHandler.call(this, data);
    };
    
    // Monitor for 5 seconds
    setTimeout(() => {
        console.log(`📊 Total messages received in 5 seconds: ${messageCount}`);
        
        if (messageCount === 0) {
            console.error('❌ No messages received - possible server issue');
        }
        
        // Restore original handler
        window.app.chatModule.handleWebSocketMessage = originalHandler;
    }, 5000);
}

// Test function to check if we're receiving any WebSocket messages at all
function testWebSocketMessageReception() {
    console.log('🧪 Testing WebSocket message reception...');
    
    if (!checkWebSocketConnection()) {
        console.error('❌ WebSocket not connected');
        return;
    }
    
    // Add listener to WebSocket directly
    const ws = window.app.websocketManager.websocket;
    let messageCount = 0;
    
    const messageListener = (data) => {
        messageCount++;
        console.log(`📨 Direct WebSocket message #${messageCount}:`, data);
    };
    
    ws.on('message', messageListener);
    
    console.log('✅ WebSocket message listener added');
    console.log('🔍 Send a message or type to see if messages are received...');
    
    // Stop monitoring after 10 seconds
    setTimeout(() => {
        console.log(`📊 Total direct WebSocket messages received in 10 seconds: ${messageCount}`);
        
        if (messageCount === 0) {
            console.error('❌ No WebSocket messages received - possible connection issue');
        }
        
        // Remove listener
        ws.off('message', messageListener);
    }, 10000);
}

// Test function to simulate server response
function simulateServerTypingResponse() {
    console.log('🧪 Simulating server typing response...');
    
    // Simulate receiving typing indicator from server
    const mockTypingData = {
        type: 'typing',
        user_id: '999',
        username: 'Test User',
        is_typing: true,
        timestamp: new Date().toISOString()
    };
    
    console.log('🧪 Simulating typing data:', mockTypingData);
    
    if (window.app && window.app.chatModule) {
        window.app.chatModule.handleWebSocketMessage(mockTypingData);
        console.log('✅ Simulated typing message sent to chat module');
        
        // Check if typing indicator appears
        setTimeout(() => {
            const typingElement = document.querySelector('.typing-indicator');
            if (typingElement) {
                console.log('✅ Typing indicator appeared in UI');
            } else {
                console.log('❌ Typing indicator did not appear in UI');
            }
        }, 1000);
    } else {
        console.error('❌ App or chat module not found');
    }
}

// Export functions
window.testServerResponse = testServerResponse;
window.checkWebSocketConnection = checkWebSocketConnection;
window.checkCurrentState = checkCurrentState;
window.testTypingIndicatorWithServerLogs = testTypingIndicatorWithServerLogs;
window.testWebSocketMessageReception = testWebSocketMessageReception;
window.simulateServerTypingResponse = simulateServerTypingResponse;

console.log('🔍 Debug functions available:');
console.log('- testServerResponse()');
console.log('- checkWebSocketConnection()');
console.log('- checkCurrentState()');
console.log('- testTypingIndicatorWithServerLogs()');
console.log('- testWebSocketMessageReception()');
console.log('- simulateServerTypingResponse()');
console.log('');
console.log('🧪 Run checkCurrentState() first to verify setup');
