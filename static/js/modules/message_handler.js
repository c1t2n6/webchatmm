// Message Handler for chat functionality
export class MessageHandler {
    constructor(app) {
        this.app = app;
        this.typingTimer = null;
        this.isTyping = false;
        
        // ✅ THÊM: Debouncing cho sendMessage
        this.sendMessageTimeout = null;
        this.isSending = false;
    }

    async sendMessage() {
        // ✅ THÊM: Debouncing để tránh gửi nhiều lần
        if (this.isSending) {
            console.log('💬 Message - Already sending, ignoring duplicate. isSending:', this.isSending);
            return;
        }
        
        console.log('💬 Message - Starting to send message');
        
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // ✅ THÊM: Clear input ngay lập tức để tránh duplicate
        input.value = '';
        
        // ✅ THÊM: Set sending flag
        this.isSending = true;
        
        if (!this.app.currentRoom || !this.app.currentRoom.id) {
            this.app.utilsModule.showError('Bạn chưa vào phòng chat');
            this.isSending = false; // ✅ THÊM: Reset flag
            return;
        }
        
        if (!this.app.websocketManager.isReadyToSend()) {
            this.app.utilsModule.showToast('Đang kết nối lại...', 'info');
            await this.app.chatModule.connectChatWebSocket(this.app.currentRoom.id);
            
            if (!this.app.websocketManager.isReadyToSend()) {
                this.app.utilsModule.showToast('Không thể kết nối. Vui lòng thử lại sau.', 'error');
                this.isSending = false; // ✅ THÊM: Reset flag
                return;
            }
        }

        try {
            
            // Send stop typing indicator before sending message
            this.sendStopTypingIndicator();

            // Send message with callback
            const success = this.app.websocketManager.sendMessage({
                type: 'message',
                content: message
            }, (response) => {
                // ✅ THÊM: Reset sending flag
                this.isSending = false;
                
                if (response && response.status === 'success') {
                    // Input đã được clear ở trên
                    console.log('💬 Message - Sent successfully');
                } else {
                    this.app.utilsModule.showError(response?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
                }
            });

            if (!success) {
                this.app.utilsModule.showError('Không thể gửi tin nhắn. Vui lòng thử lại.');
                this.isSending = false; // ✅ THÊM: Reset flag
            }

        } catch (error) {
            console.error('💬 Message - Send error:', error);
            this.app.utilsModule.showError('Không thể gửi tin nhắn. Vui lòng thử lại.');
            this.isSending = false; // ✅ THÊM: Reset flag
        }
    }

    sendTypingIndicator() {
        // Clear existing timer
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // Send typing indicator
        if (this.app.websocketManager.isConnected() && this.app.currentRoom) {
            const typingData = {
                type: 'typing',
                is_typing: true,
                user_id: this.app.currentUser.id,
                room_id: this.app.currentRoom.id
            };
            this.app.websocketManager.sendMessage(typingData);
        }

        // Auto-stop typing after 3 seconds
        this.typingTimer = setTimeout(() => {
            this.sendStopTypingIndicator();
        }, 3000);
    }

    sendStopTypingIndicator() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }

        if (this.app.websocketManager.isConnected() && this.isTyping && this.app.currentRoom) {
            this.isTyping = false;
            this.app.websocketManager.sendMessage({
                type: 'stop_typing',
                is_typing: false,
                user_id: this.app.currentUser.id,
                room_id: this.app.currentRoom.id
            });
        }
    }

    setupTypingListeners() {
        // Remove existing listeners first
        this.removeTypingListeners();
        
        const input = document.getElementById('messageInput');
        if (!input) {
            setTimeout(() => this.setupTypingListeners(), 100);
            return;
        }

        // Store timeout reference for cleanup
        this.typingTimeout = null;

        // Debounced typing indicator
        const handleTyping = () => {
            if (!this.app.websocketManager.isConnected() || !this.app.currentRoom) {
                return;
            }
            
            if (!this.isTyping) {
                this.isTyping = true;
                this.sendTypingIndicator();
            } else {
                // Still send typing indicator to keep it alive
                this.sendTypingIndicator();
            }
            
            // Reset timer on each keystroke
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.sendStopTypingIndicator();
            }, 1000);
        };

        // Store handlers for proper cleanup
        this.typingHandler = handleTyping;
        this.enterKeyHandler = (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                this.sendMessage();
            }
        };

        // Send typing indicator when starting to type
        input.addEventListener('input', this.typingHandler);
        input.addEventListener('keypress', this.enterKeyHandler);
        input.addEventListener('keydown', this.enterKeyHandler);
    }

    removeTypingListeners() {
        const input = document.getElementById('messageInput');
        if (input && this.typingHandler && this.enterKeyHandler) {
            // Remove specific event listeners
            input.removeEventListener('input', this.typingHandler);
            input.removeEventListener('keypress', this.enterKeyHandler);
            input.removeEventListener('keydown', this.enterKeyHandler);
            console.log('💬 Message - Removed existing typing listeners');
        }
        
        // Clear typing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }


    addMessageToChat(message) {
        // ATOMIC MESSAGE ADDING - No complex validation
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !message?.content || !message?.user_id) return;
        
        // Create unique message ID
        const messageId = message.message_id || `msg_${message.user_id}_${Date.now()}`;
        
        // ATOMIC DUPLICATE CHECK - Check DOM directly
        if (document.querySelector(`[data-message-id="${messageId}"]`)) {
            return; // Silent ignore
        }
        
        // ATOMIC MESSAGE CREATION - Single operation
        const messageDiv = this.createMessageElement(message, messageId);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    createMessageElement(message, messageId) {
        // SIMPLE MESSAGE ELEMENT CREATION
        const isOwnMessage = message.user_id === this.app.currentUser.id;
        const messageDiv = document.createElement('div');
        
        messageDiv.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        messageDiv.setAttribute('data-message-id', messageId);
        
        const bubbleClass = isOwnMessage 
            ? 'bg-primary text-white' 
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white';
        
        const timeString = new Date(message.timestamp).toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg chat-bubble ${bubbleClass}">
                <p class="text-sm">${message.content}</p>
                <p class="text-xs opacity-75 mt-1">${timeString}</p>
            </div>
        `;
        
        return messageDiv;
    }

    showTypingIndicator(userId) {
        if (userId === this.app.currentUser.id) {
            return;
        }
        
        const typingElement = document.querySelector('.typing-indicator');
        if (!typingElement) {
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) {
                return;
            }
            
            const typingDiv = document.createElement('div');
            typingDiv.className = 'flex justify-start typing-indicator';
            typingDiv.innerHTML = `
                <div class="px-4 py-2 typing-bubble rounded-lg">
                    <p class="text-sm">Đang nhập<span class="typing-dots"></span></p>
                </div>
            `;
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    hideTypingIndicator(userId) {
        if (userId === this.app.currentUser.id) {
            return;
        }
        
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }
    
    // Test function for typing indicator
    testTypingIndicator() {
        console.log('🧪 Testing typing indicator...');
        
        // Test 1: Check if input element exists
        const input = document.getElementById('messageInput');
        console.log('🧪 Input element:', input);
        
        // Test 2: Check if WebSocket is connected
        console.log('🧪 WebSocket connected:', this.app.websocketManager.isConnected());
        
        // Test 3: Check current user
        console.log('🧪 Current user:', this.app.currentUser);
        
        // Test 4: Simulate typing from another user
        setTimeout(() => {
            console.log('🧪 Simulating typing from another user...');
            this.showTypingIndicator('test_user_123');
        }, 1000);
        
        // Hide after 3 seconds
        setTimeout(() => {
            console.log('🧪 Hiding typing indicator...');
            this.hideTypingIndicator('test_user_123');
            console.log('🧪 Typing indicator test completed');
        }, 4000);
    }

    clearTypingState() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
        this.isTyping = false;
        
        // Clear any existing typing indicators in UI
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
        
        console.log('💬 Message - Typing state cleared');
    }

    resetSendingState() {
        this.isSending = false;
        console.log('💬 Message - Sending state reset');
    }

    clearChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            console.log('💬 Message - Chat messages cleared');
        }
    }
}

// Global test functions
window.testTypingIndicator = function() {
    if (window.app && window.app.messageHandler) {
        window.app.messageHandler.testTypingIndicator();
    }
};

// Quick test function for typing indicator
window.quickTypingTest = function() {
    console.log('🧪 Quick typing test...');
    
    // Test 1: Check if typing listeners are setup
    const input = document.getElementById('messageInput');
    if (!input) {
        console.error('❌ Input element not found');
        return;
    }
    
    // Test 2: Simulate typing
    console.log('🧪 Simulating typing...');
    input.value = 'Test message';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Test 3: Check if typing indicator shows
    setTimeout(() => {
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            console.log('✅ Typing indicator is showing');
        } else {
            console.log('❌ Typing indicator not showing');
        }
        
        // Clean up
        input.value = '';
    }, 1000);
};

// Test function to simulate typing from another user
window.testTypingFromOtherUser = function() {
    console.log('🧪 Testing typing from other user...');
    
    if (window.app && window.app.chatModule) {
        const mockTypingData = {
            type: 'typing',
            user_id: '999',
            username: 'Test User',
            is_typing: true,
            timestamp: new Date().toISOString()
        };
        
        window.app.chatModule.handleWebSocketMessage(mockTypingData);
        console.log('✅ Simulated typing from other user');
    } else {
        console.error('❌ App or chat module not found');
    }
};


// Global reset function
window.resetSendingState = function() {
    if (window.app && window.app.messageHandler) {
        window.app.messageHandler.resetSendingState();
    } else {
        console.error('💬 Message - App or messageHandler not available');
    }
};
