// Chat and Matching Module
export class ChatModule {
    constructor(app) {
        this.app = app;
        this.websocket = null;
        this.chatWebSocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.typingTimer = null;
    }

    async refreshUserStatus() {
        try {
            const response = await fetch('/user/profile', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (response.ok) {
                this.app.currentUser = await response.json();
                console.log('User status refreshed:', this.app.currentUser.status, this.app.currentUser.current_room_id);
            }
        } catch (error) {
            console.error('Failed to refresh user status:', error);
        }
    }
    
    async startSearch() {
        await this.refreshUserStatus();
        
        if (this.app.currentUser && this.app.currentUser.status === 'Connected' && this.app.currentUser.current_room_id) {
            console.log('User already connected to room, redirecting to chat...');
            this.app.currentRoom = { id: this.app.currentUser.current_room_id };
            this.app.showChatRoom();
            this.connectChatWebSocket(this.app.currentUser.current_room_id);
            return;
        }
        
        try {
            const response = await fetch('/chat/search', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}` 
                },
                body: JSON.stringify({ type: 'chat' })
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.room_id && data.matched_user) {
                    this.handleMatchFound(data);
                } else {
                    this.app.showSearching();
                    this.connectWebSocket();
                }
            } else {
                const error = await response.json();
                this.app.showError(error.detail || 'Không thể bắt đầu tìm kiếm');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.app.showError('Lỗi kết nối');
        }
    }

    async cancelSearch() {
        try {
            await fetch('/chat/cancel-search', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
        } catch (error) {
            console.error('Cancel search error:', error);
        }
        
        this.disconnectWebSocket();
        this.app.showWaitingRoom();
    }

    connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        const token = localStorage.getItem('access_token');
        this.websocket = new WebSocket(`ws://${window.location.host}/ws/status?token=${token}`);

        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.websocket.onclose = () => {
            console.log('WebSocket disconnected');
            this.handleWebSocketDisconnect();
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'match_found':
                this.handleMatchFound(data);
                break;
            case 'chat_message':
                this.handleChatMessage(data);
                break;
            case 'typing_indicator':
                this.handleTypingIndicator(data);
                break;
            case 'like_prompt':
                this.app.showLikeModal();
                break;
            case 'image_reveal':
                this.app.handleImageReveal(data);
                break;
            case 'chat_ended':
                this.app.handleChatEnded();
                break;
        }
    }

    handleWebSocketDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            setTimeout(() => {
                console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connectWebSocket();
            }, delay);
        } else {
            this.app.showError('Mất kết nối. Vui lòng thử lại.');
            this.app.showWaitingRoom();
        }
    }

    async handleMatchFound(data) {
        if (data.room_id && data.matched_user) {
            this.app.currentRoom = {
                id: data.room_id,
                matched_user: data.matched_user
            };
        } else if (data.room) {
            this.app.currentRoom = data.room;
        }
        
        this.app.showChatRoom();
        this.connectChatWebSocket(this.app.currentRoom.id);
        
        setTimeout(() => {
            this.app.showLikeModal();
        }, 5 * 60 * 1000);
    }

    connectChatWebSocket(roomId) {
        console.log('🔍 Chat - connectChatWebSocket called with roomId:', roomId);
        const token = localStorage.getItem('access_token');
        const chatWs = new WebSocket(`ws://${window.location.host}/ws/chat/${roomId}?token=${token}`);

        chatWs.onopen = () => {
            console.log('🔍 Chat - WebSocket connected to room:', roomId);
        };

        chatWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleChatWebSocketMessage(data);
        };

        chatWs.onclose = () => {
            console.log('🔍 Chat - WebSocket disconnected from room:', roomId);
        };

        this.chatWebSocket = chatWs;
    }

    handleChatWebSocketMessage(data) {
        switch (data.type) {
            case 'message':
                this.addMessageToChat(data.message);
                break;
            case 'typing':
                this.showTypingIndicator(data.user_id);
                break;
            case 'stop_typing':
                this.hideTypingIndicator(data.user_id);
                break;
        }
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || !this.chatWebSocket) return;

        try {
            this.chatWebSocket.send(JSON.stringify({
                type: 'message',
                content: message
                // room_id and user_id are handled by backend WebSocket authentication
            }));

            this.addMessageToChat({
                content: message,
                user_id: this.app.currentUser.id,
                timestamp: new Date().toISOString()
            });

            input.value = '';
            this.sendTypingIndicator();
        } catch (error) {
            console.error('Send message error:', error);
            this.app.showError('Không thể gửi tin nhắn');
        }
    }

    sendTypingIndicator() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        if (this.chatWebSocket) {
            this.chatWebSocket.send(JSON.stringify({
                type: 'typing'
                // room_id is handled by backend WebSocket authentication
            }));
        }

        this.typingTimer = setTimeout(() => {
            if (this.chatWebSocket) {
                this.chatWebSocket.send(JSON.stringify({
                    type: 'stop_typing'
                    // room_id is handled by backend WebSocket authentication
                }));
            }
        }, 1000);
    }

    addMessageToChat(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        const isOwnMessage = message.user_id === this.app.currentUser.id;
        
        messageDiv.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        messageDiv.innerHTML = `
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg chat-bubble ${
                isOwnMessage 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            }">
                <p class="text-sm">${this.app.escapeHtml(message.content)}</p>
                <p class="text-xs opacity-75 mt-1">${this.app.formatTime(message.timestamp)}</p>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showTypingIndicator(userId) {
        if (userId === this.app.currentUser.id) return;
        
        const typingElement = document.querySelector('.typing-indicator');
        if (!typingElement) {
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) return;
            
            const typingDiv = document.createElement('div');
            typingDiv.className = 'flex justify-start typing-indicator';
            typingDiv.innerHTML = `
                <div class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Đang nhập...</p>
                </div>
            `;
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    hideTypingIndicator(userId) {
        if (userId === this.app.currentUser.id) return;
        
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }

    async endChat() {
        if (!this.app.currentRoom) return;

        try {
            await fetch(`/chat/end/${this.app.currentRoom.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
        } catch (error) {
            console.error('End chat error:', error);
        }

        this.disconnectWebSocket();
        this.app.currentRoom = null;
        this.app.showEndChatModal();
    }

    async keepActive() {
        if (!this.app.currentRoom) return;

        try {
            await fetch(`/chat/keep/${this.app.currentRoom.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            
            const keepActiveBtn = document.getElementById('keepActive');
            if (keepActiveBtn) {
                keepActiveBtn.textContent = 'Đã giữ hoạt động';
                keepActiveBtn.disabled = true;
            }
        } catch (error) {
            console.error('Keep active error:', error);
        }
    }

    async reportUser() {
        if (!this.app.currentRoom) return;

        const reason = prompt('Lý do báo cáo:');
        if (!reason) return;

        try {
            await fetch(`/chat/report/${this.app.currentRoom.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}` 
                },
                body: JSON.stringify({ reason })
            });
            
            this.app.showSuccess('Đã báo cáo người dùng');
        } catch (error) {
            console.error('Report error:', error);
            this.app.showError('Không thể báo cáo');
        }
    }

    disconnectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        if (this.chatWebSocket) {
            this.chatWebSocket.close();
            this.chatWebSocket = null;
        }
    }

    handleChatMessage(data) {
        console.log('Chat message received:', data);
    }
}
