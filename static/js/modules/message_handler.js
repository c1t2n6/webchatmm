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
            console.log('💬 Message - Already sending, ignoring duplicate');
            return;
        }
        
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
        // Prevent spam - only send if not already typing
        if (this.isTyping) {
            console.log('💬 Message - Already typing, skipping');
            return;
        }
        
        // Clear existing timer
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // Send typing indicator
        if (this.app.websocketManager.isConnected()) {
            this.isTyping = true;
            console.log('💬 Message - Sending typing indicator');
            this.app.websocketManager.sendMessage({
                type: 'typing',
                is_typing: true,
                user_id: this.app.currentUser.id
            });
        } else {
            console.log('💬 Message - WebSocket not connected, cannot send typing indicator');
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

        if (this.app.websocketManager.isConnected() && this.isTyping) {
            this.isTyping = false;
            this.app.websocketManager.sendMessage({
                type: 'typing',
                is_typing: false,
                user_id: this.app.currentUser.id
            });
            console.log('💬 Message - Sent stop typing indicator');
        }
    }

    setupTypingListeners() {
        const input = document.getElementById('messageInput');
        if (!input) return;

        let typingTimeout;

        // Debounced typing indicator
        const handleTyping = () => {
            if (!this.app.websocketManager.isConnected()) return;
            
            if (!this.isTyping) {
                this.isTyping = true;
                this.sendTypingIndicator();
            }
            
            // Reset timer on each keystroke
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                this.isTyping = false;
                this.sendStopTypingIndicator();
            }, 1000);
        };

        // Send typing indicator when starting to type
        input.addEventListener('input', handleTyping);

        // Send stop typing when input loses focus
        input.addEventListener('blur', () => {
            clearTimeout(typingTimeout);
            this.isTyping = false;
            if (this.app.websocketManager.isConnected()) {
                this.sendStopTypingIndicator();
            }
        });

        // Send stop typing when pressing Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(typingTimeout);
                isTyping = false;
                if (this.app.websocketManager.isConnected()) {
                    this.sendStopTypingIndicator();
                }
            }
        });
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
        console.log('💬 Message - showTypingIndicator called for user:', userId);
        if (userId === this.app.currentUser.id) {
            console.log('💬 Message - Ignoring typing indicator for own user');
            return;
        }
        
        const typingElement = document.querySelector('.typing-indicator');
        if (!typingElement) {
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) {
                console.log('💬 Message - Chat messages container not found');
                return;
            }
            
            console.log('💬 Message - Creating typing indicator element');
            const typingDiv = document.createElement('div');
            typingDiv.className = 'flex justify-start typing-indicator';
            typingDiv.innerHTML = `
                <div class="px-4 py-2 typing-bubble rounded-lg">
                    <p class="text-sm">Đang nhập<span class="typing-dots"></span></p>
                </div>
            `;
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            console.log('💬 Message - Typing indicator added to chat');
        } else {
            console.log('💬 Message - Typing indicator already exists');
        }
    }

    hideTypingIndicator(userId) {
        if (userId === this.app.currentUser.id) return;
        
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }
    
    // Test function for typing indicator
    testTypingIndicator() {
        console.log('🧪 Testing typing indicator...');
        
        // Simulate typing from another user
        const testData = {
            user_id: 'test_user_123',
            is_typing: true
        };
        
        this.handleTypingIndicator(testData);
        
        // Hide after 3 seconds
        setTimeout(() => {
            this.hideTypingIndicator('test_user_123');
            console.log('🧪 Typing indicator test completed');
        }, 3000);
    }

    clearTypingState() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        this.isTyping = false;
        console.log('💬 Message - Typing state cleared');
    }

    clearChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            console.log('💬 Message - Chat messages cleared');
        }
    }

}
