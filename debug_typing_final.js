// Final debug script for typing indicator
// Run this in browser console

console.log('🔍 Final debug for typing indicator...');

// Test function to check current state
function checkCurrentState() {
    console.log('🔍 Checking current state...');
    
    if (!window.app) {
        console.error('❌ App not found');
        return false;
    }
    
    console.log('✅ App loaded');
    console.log('✅ Current user:', window.app.currentUser);
    console.log('✅ Current room:', window.app.currentRoom);
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
function testTypingWithMonitoring() {
    console.log('🧪 Testing typing with monitoring...');
    
    if (!checkCurrentState()) {
        return;
    }
    
    // Monitor incoming messages
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
    
    // Send typing indicator
    console.log('🧪 Sending typing indicator...');
    if (window.app.messageHandler) {
        window.app.messageHandler.sendTypingIndicator();
    }
    
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

// Test function to simulate typing from another user
function simulateTypingFromOtherUser() {
    console.log('🧪 Simulating typing from other user...');
    
    if (!window.app || !window.app.chatModule) {
        console.error('❌ App or chat module not found');
        return;
    }
    
    const mockTypingData = {
        type: 'typing',
        user_id: '999',
        username: 'Test User',
        is_typing: true,
        timestamp: new Date().toISOString()
    };
    
    console.log('🧪 Simulating typing data:', mockTypingData);
    window.app.chatModule.handleWebSocketMessage(mockTypingData);
    
    // Check if typing indicator appears
    setTimeout(() => {
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            console.log('✅ Typing indicator appeared in UI');
        } else {
            console.log('❌ Typing indicator did not appear in UI');
        }
    }, 1000);
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

// Test function to check if we're in the right room
function checkRoomStatus() {
    console.log('🔍 Checking room status...');
    
    if (!checkCurrentState()) {
        return;
    }
    
    console.log('✅ Room ID:', window.app.currentRoom.id);
    console.log('✅ User ID:', window.app.currentUser.id);
    
    // Check if we have a message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        console.log('✅ Message input is available');
    } else {
        console.log('❌ Message input is not available');
    }
    
    // Check if we have a chat messages container
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        console.log('✅ Chat messages container is available');
    } else {
        console.log('❌ Chat messages container is not available');
    }
}

// Test function to send a message and check if it works
function testMessageSending() {
    console.log('🧪 Testing message sending...');
    
    if (!checkCurrentState()) {
        return;
    }
    
    const input = document.getElementById('messageInput');
    if (!input) {
        console.error('❌ Input element not found');
        return;
    }
    
    input.value = 'Test message for debugging';
    
    if (window.app.messageHandler) {
        window.app.messageHandler.sendMessage();
        console.log('✅ Test message sent');
    } else {
        console.error('❌ Message handler not found');
    }
}

// Export functions
window.checkCurrentState = checkCurrentState;
window.testTypingWithMonitoring = testTypingWithMonitoring;
window.simulateTypingFromOtherUser = simulateTypingFromOtherUser;
window.checkWebSocketConnection = checkWebSocketConnection;
window.checkRoomStatus = checkRoomStatus;
window.testMessageSending = testMessageSending;

console.log('🔍 Debug functions available:');
console.log('- checkCurrentState()');
console.log('- testTypingWithMonitoring()');
console.log('- simulateTypingFromOtherUser()');
console.log('- checkWebSocketConnection()');
console.log('- checkRoomStatus()');
console.log('- testMessageSending()');
console.log('');
console.log('🧪 Run checkCurrentState() first to verify setup');

// Test function to verify typing handler is working
function verifyTypingHandler() {
    console.log('🔍 Verifying typing handler...');
    
    if (!checkCurrentState()) {
        return;
    }
    
    // Send typing indicator
    console.log('🧪 Sending typing indicator to test handler...');
    if (window.app.messageHandler) {
        window.app.messageHandler.sendTypingIndicator();
        console.log('✅ Typing indicator sent - should now appear in server logs');
    } else {
        console.error('❌ Message handler not found');
    }
}

// Test function for complete typing flow
function testCompleteTypingFlow() {
    console.log('🧪 Testing complete typing flow...');
    
    if (!checkCurrentState()) {
        return;
    }
    
    console.log('🧪 Step 1: Sending typing indicator...');
    if (window.app.messageHandler) {
        window.app.messageHandler.sendTypingIndicator();
    }
    
    console.log('🧪 Step 2: Monitoring for 5 seconds...');
    let messageCount = 0;
    const originalHandler = window.app.chatModule.handleWebSocketMessage;
    
    window.app.chatModule.handleWebSocketMessage = function(data) {
        messageCount++;
        console.log(`📨 Received message #${messageCount}:`, data);
        
        if (data.type === 'typing' || data.type === 'stop_typing') {
            console.log('🎯 TYPING MESSAGE RECEIVED:', data);
        }
        
        // Call original handler
        originalHandler.call(this, data);
    };
    
    setTimeout(() => {
        console.log(`📊 Total messages received: ${messageCount}`);
        window.app.chatModule.handleWebSocketMessage = originalHandler;
    }, 5000);
}

// Test function for stop typing
function testStopTyping() {
    console.log('🧪 Testing stop typing...');
    
    if (!checkCurrentState()) {
        return;
    }
    
    console.log('🧪 Step 1: Start typing...');
    if (window.app.messageHandler) {
        window.app.messageHandler.sendTypingIndicator();
    }
    
    setTimeout(() => {
        console.log('🧪 Step 2: Stop typing...');
        if (window.app.messageHandler) {
            window.app.messageHandler.sendStopTypingIndicator();
        }
    }, 2000);
    
    setTimeout(() => {
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            console.log('❌ Typing indicator still showing after stop');
        } else {
            console.log('✅ Typing indicator removed after stop');
        }
    }, 3000);
}

// Add to global scope
window.verifyTypingHandler = verifyTypingHandler;
window.testCompleteTypingFlow = testCompleteTypingFlow;
window.testStopTyping = testStopTyping;
console.log('- verifyTypingHandler()');
console.log('- testCompleteTypingFlow()');
console.log('- testStopTyping()');
