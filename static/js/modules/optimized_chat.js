/**
 * Optimized Chat Module
 * =====================
 * 
 * Advanced chat functionality with:
 * - WebSocket reconnection logic
 * - Message queuing and retry
 * - Performance optimizations
 * - Better error handling
 * - Offline support
 */

class OptimizedChat {
    constructor(app) {
        this.app = app;
        this.websocket = null;
        this.connectionState = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.messageQueue = [];
        this.sentMessages = new Map();
        this.typingTimer = null;
        this.typingUsers = new Set();
        this.messageCache = new Map();
        this.lastMessageId = null;
        this.isTyping = false;
        this.connectionId = null;
        this.roomId = null;
        this.userId = null;
        
        // Performance settings
        this.maxCacheSize = 100;
        this.messageBatchSize = 10;
        this.debounceDelay = 300;
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Initialize
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupMessageHandlers();
        this.setupPerformanceOptimizations();
    }
    
    setupEventListeners() {
        // Message input events
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', this.debounce(this.handleTyping.bind(this), this.debounceDelay));
            messageInput.addEventListener('keypress', this.handleKeyPress.bind(this));
        }
        
        // Send button
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            sendButton.addEventListener('click', this.sendMessage.bind(this));
        }
        
        // Room actions
        this.setupRoomActionListeners();
        
        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }
    
    setupMessageHandlers() {
        // Register message handlers
        this.messageHandlers = {
            'welcome': this.handleWelcome.bind(this),
            'message': this.handleIncomingMessage.bind(this),
            'typing': this.handleTypingIndicator.bind(this),
            'reaction': this.handleReaction.bind(this),
            'presence_update': this.handlePresenceUpdate.bind(this),
            'room_ended': this.handleRoomEnded.bind(this),
            'heartbeat': this.handleHeartbeat.bind(this),
            'error': this.handleError.bind(this)
        };
    }
    
    setupPerformanceOptimizations() {
        // Intersection Observer for lazy loading
        this.setupIntersectionObserver();
        
        // Message virtualization for large chat histories
        this.setupMessageVirtualization();
        
        // Debounced scroll handling
        this.setupScrollOptimization();
    }
    
    // Connection Management
    async connect(roomId, token) {
        try {
            this.roomId = roomId;
            this.userId = this.app.currentUser?.id;
            
            if (!this.userId) {
                throw new Error('User not authenticated');
            }
            
            const wsUrl = this.buildWebSocketUrl(roomId, token);
            this.websocket = new WebSocket(wsUrl);
            
            this.setupWebSocketHandlers();
            await this.waitForConnection();
            
            this.connectionState = 'connected';
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            
            // Process queued messages
            this.processMessageQueue();
            
            this.app.showSuccess('Connected to chat room');
            this.log('Connected to chat room', 'info');
            
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
            this.handleConnectionError(error);
        }
    }
    
    buildWebSocketUrl(roomId, token) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws/chat/${roomId}?token=${token}`;
    }
    
    setupWebSocketHandlers() {
        this.websocket.onopen = this.handleWebSocketOpen.bind(this);
        this.websocket.onmessage = this.handleWebSocketMessage.bind(this);
        this.websocket.onclose = this.handleWebSocketClose.bind(this);
        this.websocket.onerror = this.handleWebSocketError.bind(this);
    }
    
    async waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);
            
            this.websocket.onopen = () => {
                clearTimeout(timeout);
                resolve();
            };
            
            this.websocket.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
        });
    }
    
    disconnect() {
        if (this.websocket) {
            this.websocket.close(1000, 'User disconnected');
            this.websocket = null;
        }
        
        this.connectionState = 'disconnected';
        this.stopHeartbeat();
        this.clearTypingIndicator();
        
        this.log('Disconnected from chat room', 'info');
    }
    
    // Message Handling
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input?.value?.trim();
        
        if (!content || !this.websocket || this.connectionState !== 'connected') {
            return;
        }
        
        try {
            const message = {
                type: 'message',
                content: content,
                timestamp: new Date().toISOString(),
                message_id: this.generateMessageId()
            };
            
            // Add to sent messages map
            this.sentMessages.set(message.message_id, {
                ...message,
                status: 'sending',
                retryCount: 0
            });
            
            // Send via WebSocket
            if (this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify(message));
                this.sentMessages.get(message.message_id).status = 'sent';
                
                // Add to UI immediately
                this.addMessageToChat(message, true);
                
                // Clear input
                input.value = '';
                
                // Send typing indicator
                this.sendTypingIndicator(false);
                
                this.log('Message sent successfully', 'info');
                
            } else {
                // Queue message if WebSocket is not ready
                this.queueMessage(message);
                this.app.showWarning('Message queued - reconnecting...');
            }
            
        } catch (error) {
            this.log(`Error sending message: ${error.message}`, 'error');
            this.app.showError('Failed to send message');
        }
    }
    
    handleIncomingMessage(data) {
        try {
            const message = {
                id: data.message_id,
                content: data.content,
                user_id: data.user_id,
                timestamp: data.timestamp,
                content_type: data.content_type || 'text',
                reactions: data.reactions || []
            };
            
            // Add to UI
            this.addMessageToChat(message, false);
            
            // Update message cache
            this.updateMessageCache(message);
            
            // Mark as delivered
            this.markMessageDelivered(data.message_id);
            
            // Play notification sound if not from current user
            if (data.user_id !== this.userId) {
                this.playNotificationSound();
            }
            
        } catch (error) {
            this.log(`Error handling incoming message: ${error.message}`, 'error');
        }
    }
    
    addMessageToChat(message, isOwnMessage) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-container ${isOwnMessage ? 'own-message' : 'other-message'}`;
        messageDiv.dataset.messageId = message.id;
        
        // Add user info for other messages
        let userInfo = '';
        if (!isOwnMessage) {
            userInfo = `
                <div class="message-user-info">
                    <span class="username">${this.getUsername(message.user_id)}</span>
                    <span class="timestamp">${this.formatTime(message.timestamp)}</span>
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            ${userInfo}
            <div class="message-content ${isOwnMessage ? 'own' : 'other'}">
                <div class="message-bubble">
                    <p class="message-text">${this.escapeHtml(message.content)}</p>
                    <div class="message-meta">
                        <span class="time">${this.formatTime(message.timestamp)}</span>
                        ${isOwnMessage ? '<span class="status">✓</span>' : ''}
                    </div>
                </div>
                ${message.reactions.length > 0 ? this.renderReactions(message.reactions) : ''}
            </div>
        `;
        
        // Add to chat
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
        
        // Update last message ID
        this.lastMessageId = message.id;
    }
    
    renderReactions(reactions) {
        const reactionGroups = this.groupReactionsByEmoji(reactions);
        
        return `
            <div class="message-reactions">
                ${Object.entries(reactionGroups).map(([emoji, users]) => `
                    <span class="reaction" title="${users.join(', ')}">
                        ${emoji} <span class="count">${users.length}</span>
                    </span>
                `).join('')}
            </div>
        `;
    }
    
    groupReactionsByEmoji(reactions) {
        const groups = {};
        reactions.forEach(reaction => {
            if (!groups[reaction.emoji]) {
                groups[reaction.emoji] = [];
            }
            groups[reaction.emoji].push(reaction.username || 'Unknown');
        });
        return groups;
    }
    
    // Typing Indicators
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.sendTypingIndicator(true);
        }
        
        // Reset typing timer
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }
        
        this.typingTimer = setTimeout(() => {
            this.isTyping = false;
            this.sendTypingIndicator(false);
        }, 1000);
    }
    
    sendTypingIndicator(isTyping) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const typingMessage = {
                type: 'typing',
                is_typing: isTyping,
                timestamp: new Date().toISOString()
            };
            
            this.websocket.send(JSON.stringify(typingMessage));
        }
    }
    
    handleTypingIndicator(data) {
        if (data.user_id === this.userId) return;
        
        if (data.is_typing) {
            this.typingUsers.add(data.user_id);
        } else {
            this.typingUsers.delete(data.user_id);
        }
        
        this.updateTypingIndicator();
    }
    
    updateTypingIndicator() {
        let typingElement = document.querySelector('.typing-indicator');
        
        if (this.typingUsers.size > 0) {
            if (!typingElement) {
                typingElement = document.createElement('div');
                typingElement.className = 'typing-indicator';
                document.getElementById('chatMessages')?.appendChild(typingElement);
            }
            
            const usernames = Array.from(this.typingUsers).map(id => this.getUsername(id));
            typingElement.innerHTML = `
                <div class="typing-content">
                    <span class="typing-dots">●●●</span>
                    <span class="typing-text">${usernames.join(', ')} ${usernames.length === 1 ? 'is' : 'are'} typing...</span>
                </div>
            `;
        } else if (typingElement) {
            typingElement.remove();
        }
    }
    
    clearTypingIndicator() {
        this.typingUsers.clear();
        this.updateTypingIndicator();
    }
    
    // Reactions
    async addReaction(messageId, emoji) {
        try {
            const reactionMessage = {
                type: 'reaction',
                message_id: messageId,
                emoji: emoji,
                timestamp: new Date().toISOString()
            };
            
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify(reactionMessage));
                
                // Add reaction to UI immediately
                this.addReactionToUI(messageId, emoji, this.userId);
                
            } else {
                this.queueMessage(reactionMessage);
            }
            
        } catch (error) {
            this.log(`Error adding reaction: ${error.message}`, 'error');
        }
    }
    
    handleReaction(data) {
        this.addReactionToUI(data.message_id, data.emoji, data.user_id);
    }
    
    addReactionToUI(messageId, emoji, userId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;
        
        let reactionsContainer = messageElement.querySelector('.message-reactions');
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            messageElement.querySelector('.message-content').appendChild(reactionsContainer);
        }
        
        // Check if reaction already exists
        const existingReaction = reactionsContainer.querySelector(`[data-emoji="${emoji}"]`);
        if (existingReaction) {
            const countElement = existingReaction.querySelector('.count');
            const count = parseInt(countElement.textContent) + 1;
            countElement.textContent = count;
        } else {
            const reactionElement = document.createElement('span');
            reactionElement.className = 'reaction';
            reactionElement.dataset.emoji = emoji;
            reactionElement.innerHTML = `${emoji} <span class="count">1</span>`;
            reactionsContainer.appendChild(reactionElement);
        }
    }
    
    // Message Queuing and Retry
    queueMessage(message) {
        this.messageQueue.push({
            ...message,
            timestamp: new Date().toISOString(),
            retryCount: 0
        });
        
        this.log(`Message queued: ${message.type}`, 'info');
    }
    
    async processMessageQueue() {
        if (this.messageQueue.length === 0 || this.connectionState !== 'connected') {
            return;
        }
        
        const batch = this.messageQueue.splice(0, this.messageBatchSize);
        
        for (const message of batch) {
            try {
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.send(JSON.stringify(message));
                    this.log(`Queued message sent: ${message.type}`, 'info');
                } else {
                    // Put message back in queue
                    this.messageQueue.unshift(message);
                    break;
                }
            } catch (error) {
                this.log(`Error processing queued message: ${error.message}`, 'error');
                // Put message back in queue
                this.messageQueue.unshift(message);
            }
        }
    }
    
    // Reconnection Logic
    async reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.log('Max reconnection attempts reached', 'error');
            this.app.showError('Failed to reconnect. Please refresh the page.');
            return;
        }
        
        this.reconnectAttempts++;
        this.connectionState = 'reconnecting';
        
        this.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, 'info');
        this.app.showWarning(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        // Wait before attempting reconnection
        await this.sleep(this.reconnectDelay * this.reconnectAttempts);
        
        try {
            // Get fresh token
            const token = await this.getAuthToken();
            await this.connect(this.roomId, token);
            
        } catch (error) {
            this.log(`Reconnection failed: ${error.message}`, 'error');
            // Try again
            setTimeout(() => this.reconnect(), this.reconnectDelay);
        }
    }
    
    // Heartbeat and Connection Monitoring
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                const heartbeat = {
                    type: 'heartbeat',
                    timestamp: new Date().toISOString()
                };
                
                this.websocket.send(JSON.stringify(heartbeat));
            }
        }, 30000); // 30 seconds
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    handleHeartbeat(data) {
        // Send heartbeat response
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const response = {
                type: 'heartbeat_response',
                timestamp: new Date().toISOString()
            };
            
            this.websocket.send(JSON.stringify(response));
        }
    }
    
    // Performance Optimizations
    setupIntersectionObserver() {
        const options = {
            root: document.getElementById('chatMessages'),
            rootMargin: '100px',
            threshold: 0.1
        };
        
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageId = entry.target.dataset.messageId;
                    this.loadMessageContent(messageId);
                }
            });
        }, options);
    }
    
    setupMessageVirtualization() {
        // Implement virtual scrolling for large message lists
        this.virtualScroller = {
            itemHeight: 80,
            visibleItems: 20,
            startIndex: 0,
            endIndex: 0
        };
    }
    
    setupScrollOptimization() {
        let scrollTimeout;
        const chatMessages = document.getElementById('chatMessages');
        
        if (chatMessages) {
            chatMessages.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    this.handleScroll();
                }, 100);
            });
        }
    }
    
    handleScroll() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const { scrollTop, scrollHeight, clientHeight } = chatMessages;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        // Load more messages if scrolling up
        if (scrollTop < 100) {
            this.loadMoreMessages();
        }
        
        // Auto-scroll to bottom if user is near bottom
        if (isNearBottom) {
            this.enableAutoScroll = true;
        } else {
            this.enableAutoScroll = false;
        }
    }
    
    // Utility Methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    getUsername(userId) {
        // Get username from cache or API
        return this.app.currentUser?.id === userId ? 'You' : `User ${userId}`;
    }
    
    scrollToBottom() {
        if (!this.enableAutoScroll) return;
        
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    playNotificationSound() {
        // Play notification sound
        const audio = new Audio('/static/sounds/notification.mp3');
        audio.play().catch(() => {
            // Ignore errors if audio fails to play
        });
    }
    
    // Event Handlers
    handleWebSocketOpen(event) {
        this.log('WebSocket connection established', 'info');
        this.connectionState = 'connected';
    }
    
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            const handler = this.messageHandlers[data.type];
            
            if (handler) {
                handler(data);
            } else {
                this.log(`Unknown message type: ${data.type}`, 'warn');
            }
            
        } catch (error) {
            this.log(`Error parsing WebSocket message: ${error.message}`, 'error');
        }
    }
    
    handleWebSocketClose(event) {
        this.log(`WebSocket closed: ${event.code} - ${event.reason}`, 'info');
        this.connectionState = 'disconnected';
        this.stopHeartbeat();
        
        if (event.code !== 1000) { // Not a normal closure
            this.reconnect();
        }
    }
    
    handleWebSocketError(error) {
        this.log(`WebSocket error: ${error.message}`, 'error');
        this.connectionState = 'error';
    }
    
    handleConnectionError(error) {
        this.log(`Connection error: ${error.message}`, 'error');
        this.app.showError('Failed to connect to chat room');
        
        // Try to reconnect
        setTimeout(() => this.reconnect(), this.reconnectDelay);
    }
    
    handleWelcome(data) {
        this.connectionId = data.connection_id;
        this.log('Welcome message received', 'info');
    }
    
    handleRoomEnded(data) {
        this.app.showWarning(`Room ended: ${data.reason}`);
        this.disconnect();
        
        // Redirect to room list or show room ended message
        this.handleRoomEndedUI(data);
    }
    

    
    handleRoomEndedUI(data) {
        // Show room ended message
        this.app.showWarning(data.message || 'Phòng chat đã kết thúc');
        
        // Redirect to waiting room after a short delay
        setTimeout(() => {
            // Check if we're in a chat room
            if (this.roomId) {
                // Redirect to waiting room
                window.location.href = '/waiting-room';
            }
        }, 2000); // 2 second delay to show message
    }
    
    handleError(data) {
        this.log(`Server error: ${data.message}`, 'error');
        this.app.showError(data.message);
    }
    
    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }
    
    handleBeforeUnload(event) {
        this.disconnect();
    }
    
    handleOnline() {
        this.log('Network connection restored', 'info');
        if (this.connectionState === 'disconnected') {
            this.reconnect();
        }
    }
    
    handleOffline() {
        this.log('Network connection lost', 'warn');
        this.connectionState = 'offline';
        this.app.showWarning('Network connection lost. Messages will be queued.');
    }
    
    // Logging
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] Chat: ${message}`);
        
        // Also log to server if needed
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const logMessage = {
                type: 'log',
                level: level,
                message: message,
                timestamp: timestamp
            };
            
            this.websocket.send(JSON.stringify(logMessage));
        }
    }
    
    // Public API
    getConnectionState() {
        return this.connectionState;
    }
    
    getMessageQueueLength() {
        return this.messageQueue.length;
    }
    
    getCacheStats() {
        return {
            messageCacheSize: this.messageCache.size,
            sentMessagesSize: this.sentMessages.size,
            typingUsersCount: this.typingUsers.size
        };
    }
    
    clearCache() {
        this.messageCache.clear();
        this.sentMessages.clear();
        this.log('Cache cleared', 'info');
    }
}

// Export for use in other modules
window.OptimizedChat = OptimizedChat;
