// Refactored Chat Module - Main coordinator
import { WebSocketManager } from './websocket_manager.js';
import { MessageHandler } from './message_handler.js';
import { RoomManager } from './room_manager.js';
import { ConnectionStatus } from './connection_status.js';
import { DebugTools } from './debug_tools.js';

class ChatModule {
    constructor(app) {
        this.app = app;
        
        // Initialize sub-modules
        this.websocketManager = new WebSocketManager(app);
        this.messageHandler = new MessageHandler(app);
        this.roomManager = new RoomManager(app);
        this.connectionStatus = new ConnectionStatus(app);
        this.debugTools = new DebugTools(app);
        
        // Set references for sub-modules
        this.app.websocketManager = this.websocketManager;
        this.app.roomManager = this.roomManager;
        this.app.messageHandler = this.messageHandler;
        
        // Message deduplication
        this.processedMessages = new Set();
        
        // ✅ THÊM: Flag để tránh duplicate loadChatHistory
        this.isLoadingHistory = false;
        
        // ✅ THÊM: Flag để tránh duplicate setupAfterJoinRoom
        this.isSettingUpRoom = false;
        
        // ✅ THÊM: Flag để tránh duplicate connectChatWebSocket
        this.isConnectingWebSocket = false;
        
        // Initialize debug tools
        this.debugTools.setupGlobalDebugFunctions();
        
        console.log('🔍 Chat - ChatModule initialized with sub-modules');
    }

    async init() {
        console.log('🔍 Chat - ChatModule init called');
        
        // Wait a bit to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check and restore chat state if needed
        if (this.app.currentUser) {
            await this.restoreChatState();
        }
        
        // Add event listener to check state when page loads
        window.addEventListener('load', () => {
            console.log('🔍 Chat - Page loaded, checking chat state...');
            if (this.app.currentUser) {
                this.restoreChatState();
            }
        });
        
        // Check state immediately if DOM is already ready
        if (document.readyState === 'complete') {
            console.log('🔍 Chat - DOM already complete, checking chat state immediately...');
            if (this.app.currentUser) {
                this.restoreChatState();
            }
        }
        
        // Auto-restore once after delay
        setTimeout(async () => {
            if (this.app.currentUser && !this.roomManager.isRestoringState && !this.roomManager.roomEnded) {
                console.log('🔍 Chat - Auto-restoring chat state after delay...');
                await this.restoreChatState();
            }
        }, 2000);
    }

    async restoreChatState() {
        if (this.roomManager.isRestoringState) {
            console.log('🔍 Chat - restoreChatState already in progress, skipping');
            return false;
        }
        
        this.roomManager.isRestoringState = true;
        console.log('🔍 Chat - restoreChatState called');
        
        if (this.roomManager.roomEnded) {
            console.log('🔍 Chat - Room was ended, skipping restore to prevent re-entry');
            this.roomManager.isRestoringState = false;
            return false;
        }
        
        // Sync state with backend first
        await this.connectionStatus.syncRoomStateWithBackend();
        
        // Check if user is in chat room
        if (this.app.currentUser && this.app.currentUser.status && 
            this.app.currentUser.status.toLowerCase() === 'connected' && 
            this.app.currentUser.current_room_id) {
            console.log('🔍 Chat - User is in chat room, checking if room is still active...');
            
            if (this.roomManager.roomEnded) {
                console.log('🔍 Chat - Room was ended during sync, staying in waiting room');
                this.roomManager.isRestoringState = false;
                return false;
            }
            
            // Check current UI state
            const chatRoom = document.getElementById('chatRoom');
            const waitingRoom = document.getElementById('waitingRoom');
            const searching = document.getElementById('searching');
            
            // If in waiting room or searching, redirect to chat room
            if ((waitingRoom && !waitingRoom.classList.contains('hidden')) || 
                (searching && !searching.classList.contains('hidden'))) {
                console.log('🔍 Chat - User is in waiting/searching, redirecting to chat room...');
                await this.enterChatRoom(this.app.currentUser.current_room_id);
            }
            
            this.roomManager.isRestoringState = false;
            return true;
        }
        
        // If user doesn't have current_room_id or status is not connected
        if (this.app.currentUser) {
            console.log('🔍 Chat - User status is not connected or no current_room_id, checking for active rooms...');
            
            try {
                const response = await fetch('/chat/check-room-status', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                });
                
                console.log('🔍 Chat - Check room status API response status:', response.status);
                
                if (response.ok) {
                    const roomData = await response.json();
                    console.log('🔍 Chat - Check room status API response:', roomData);
                    
                    if (roomData.room_id && roomData.status === 'active') {
                        console.log('🔍 Chat - Found active room for user:', roomData.room_id);
                        
                        // Update user status
                        this.app.currentUser.current_room_id = roomData.room_id;
                        this.app.currentUser.status = 'connected';
                        
                        // Go to chat room
                        await this.enterChatRoom(roomData.room_id);
                        
                        this.roomManager.isRestoringState = false;
                        return true;
                    }
                } else {
                    console.error('🔍 Chat - Check room status API failed:', response.status);
                    const errorData = await response.json();
                    console.error('🔍 Chat - Error details:', errorData);
                }
            } catch (error) {
                console.error('🔍 Chat - Error checking room status:', error);
            }
        }
        
        console.log('🔍 Chat - No chat state to restore');
        this.roomManager.isRestoringState = false;
        return false;
    }

    async loadChatHistory(roomId) {
        // ✅ THÊM: Tránh duplicate loadChatHistory
        if (this.isLoadingHistory) {
            console.log('🔍 Chat - Already loading history, skipping duplicate');
            return;
        }
        
        console.log('🔍 Chat - Loading chat history for room:', roomId);
        this.isLoadingHistory = true;
        
        // Reset keep active button when loading new room history
        this.resetKeepActiveButton();
        console.log('🔍 Chat - Reset keep active button for new room history');
        
        try {
            const response = await fetch(`/chat/${roomId}/history`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔍 Chat - Chat history loaded:', data);
                
                // Clear existing messages
                this.messageHandler.clearChatMessages();
                
                // Add messages to chat
                if (data.messages && data.messages.length > 0) {
                    console.log('🔍 Chat - Adding', data.messages.length, 'messages to chat');
                    data.messages.forEach(message => {
                        this.messageHandler.addMessageToChat(message);
                    });
                } else {
                    console.log('🔍 Chat - No messages in history');
                }
                
                // Scroll to bottom
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
            } else {
                console.error('🔍 Chat - Failed to load chat history:', response.status);
                const errorData = await response.json();
                console.error('🔍 Chat - Error details:', errorData);
            }
            
        } catch (error) {
            console.error('🔍 Chat - Error loading chat history:', error);
        } finally {
            // ✅ THÊM: Reset flag sau khi load xong
            this.isLoadingHistory = false;
        }
    }

    async refreshUserStatus() {
        try {
            const response = await fetch('/user/profile', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.app.currentUser = data.user || data;
                console.log('User status refreshed:', this.app.currentUser.status, this.app.currentUser.current_room_id);
                
                // Sync room state with backend
                await this.connectionStatus.syncRoomStateWithBackend();
            }
        } catch (error) {
            console.error('Failed to refresh user status:', error);
        }
    }

    // Delegate methods to sub-modules
    startSearch() {
        return this.roomManager.startSearch();
    }

    cancelSearch() {
        return this.roomManager.cancelSearch();
    }

    sendMessage() {
        return this.messageHandler.sendMessage();
    }

    endChat() {
        return this.roomManager.endChat();
    }

    connectWebSocket() {
        return this.websocketManager.connect();
    }

    async connectChatWebSocket(roomId) {
        // ✅ THÊM: Tránh duplicate connectChatWebSocket
        if (this.isConnectingWebSocket) {
            console.log('🔍 Chat - Already connecting WebSocket, skipping duplicate');
            return;
        }
        
        console.log('🔍 Chat - connectChatWebSocket called with roomId:', roomId);
        this.isConnectingWebSocket = true;
        
        // Set currentRoom first
        this.app.currentRoom = { id: roomId };
        
        if (!this.websocketManager.isConnected()) {
            console.log('🔍 Chat - WebSocket not connected, connecting first...');
            this.websocketManager.connect();
            
            // Wait for connection to be established
            const isReady = await this.websocketManager.waitForReady(5000);
            if (!isReady) {
                console.error('🔍 Chat - WebSocket connection failed');
                this.connectionStatus.showToast('Không thể kết nối WebSocket', 'error');
                this.isConnectingWebSocket = false; // ✅ THÊM: Reset flag
                return;
            }
        }
        
        // Join room and setup (only once)
        console.log('🔍 Chat - Joining room and setting up:', roomId);
        this.websocketManager.joinRoom(roomId);
        this.setupAfterJoinRoom(roomId);
        
        // ✅ THÊM: Reset flag sau khi connect xong
        setTimeout(() => {
            this.isConnectingWebSocket = false;
        }, 2000);
    }

    setupAfterJoinRoom(roomId) {
        // ✅ THÊM: Tránh duplicate setupAfterJoinRoom
        if (this.isSettingUpRoom) {
            console.log('🔍 Chat - Already setting up room, skipping duplicate');
            return;
        }
        
        console.log('🔍 Chat - Setting up after join room:', roomId);
        this.isSettingUpRoom = true;
        
        // Reset keep active button for new room
        this.resetKeepActiveButton();
        
        // Load chat history
        this.loadChatHistory(roomId);
        
        // Setup typing listeners
        this.messageHandler.setupTypingListeners();
        
        // Sync with backend
        this.syncChatRoomState(roomId);
        
        console.log('🔍 Chat - Room setup completed');
        
        // ✅ THÊM: Reset flag sau khi setup xong
        setTimeout(() => {
            this.isSettingUpRoom = false;
        }, 1000);
    }


    async syncChatRoomState(roomId) {
        try {
            console.log('🔍 Chat - Syncing chat room state for room:', roomId);
            
            // Check room status from backend
            const response = await fetch(`/chat/room/${roomId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            
            if (response.ok) {
                const roomData = await response.json();
                console.log('🔍 Chat - Room state from backend:', roomData);
                
                if (roomData.end_time) {
                    console.log('🔍 Chat - Room has ended, returning to waiting room');
                    this.connectionStatus.showToast('Phòng chat đã kết thúc', 'info');
                    this.resetChatState();
                    return;
                }
                
                // Room is still active, continue
                console.log('🔍 Chat - Room is active, proceeding with chat');
            } else {
                console.log('🔍 Chat - Failed to get room state, proceeding anyway');
            }
        } catch (error) {
            console.error('🔍 Chat - Error syncing room state:', error);
        }
    }

    async showChatRoomWithSync() {
        console.log('🔍 Chat - showChatRoomWithSync called');
        
        // Show chat room UI
        this.app.uiModule.showChatRoom();
        
        // Start periodic room status check
        this.connectionStatus.startRoomStatusCheck();
        
        // Wait a bit for DOM to render
        setTimeout(() => {
            this.syncCountdownStatus();
        }, 500);
    }

    // Unified method to enter chat room
    async enterChatRoom(roomId) {
        console.log('🔍 Chat - enterChatRoom called with roomId:', roomId);
        
        // Set current room
        this.app.currentRoom = { id: roomId };
        
        // Show chat room UI
        await this.showChatRoomWithSync();
        
        // Connect WebSocket and setup
        await this.connectChatWebSocket(roomId);
        
        // ✅ THÊM: Restore trạng thái "Giữ hoạt động" từ localStorage
        this.restoreKeepActiveState();
        
        console.log('🔍 Chat - Successfully entered chat room:', roomId);
    }

    async syncCountdownStatus() {
        try {
            if (!this.app.currentRoom?.id) {
                console.log('🔍 Chat - No current room, skipping countdown sync');
                return;
            }
            
            // Check room ended flag before syncing
            if (this.roomManager.roomEnded) {
                console.log('🔍 Chat - Room already ended locally, skipping countdown sync');
                return;
            }
            
            // Simple sync once when entering room
            if (this.app.simpleCountdownModule) {
                console.log('🔍 Chat - Syncing countdown status for room:', this.app.currentRoom.id);
                this.app.simpleCountdownModule.syncWithBackend(this.app.currentRoom.id);
            }
            
        } catch (error) {
            console.error('🔍 Chat - Error syncing countdown status:', error);
        }
    }

    handleWebSocketMessage(data) {
        // ATOMIC MESSAGE PROCESSING - Single source of truth
        if (!data || typeof data !== 'object') {
            console.warn('🔍 Chat - Invalid message data:', data);
            return;
        }

        // ✅ THÊM: Handle countdown/notification messages
        if (data.type && ['countdown_start', 'countdown_update', 'notification_show', 'notification_update', 'room_kept', 'waiting_for_other', 'room_ended'].includes(data.type)) {
            console.log('🔍 Chat - Routing countdown/notification message to SimpleCountdownModuleV2:', data.type);
            if (this.app.simpleCountdownModule) {
                // ✅ SỬA: Truyền data object trực tiếp thay vì JSON.stringify
                this.app.simpleCountdownModule.handleWebSocketMessage(data);
            }
            return;
        }

        // Create unique message fingerprint
        const fingerprint = this.createMessageFingerprint(data);
        
        // ATOMIC CHECK: If already processed, ignore completely
        if (this.processedMessages.has(fingerprint)) {
            return; // Silent ignore - no logging spam
        }
        
        // ATOMIC MARK: Mark as processed immediately
        this.processedMessages.add(fingerprint);
        
        // Cleanup old fingerprints (keep only last 20)
        if (this.processedMessages.size > 20) {
            const fingerprints = Array.from(this.processedMessages);
            this.processedMessages.clear();
            fingerprints.slice(-10).forEach(fp => this.processedMessages.add(fp));
        }
        
        // DIRECT ROUTING - No complex switch, direct calls
        this.routeMessage(data);
    }

    createMessageFingerprint(data) {
        // Create unique fingerprint for message deduplication
        const content = data.content || '';
        const timestamp = data.timestamp || Date.now();
        const userId = data.user_id || 'unknown';
        const type = data.type || 'unknown';
        const messageId = data.message_id || '';
        
        // ✅ THÊM: Sử dụng message_id nếu có để tránh duplicate khi reload
        if (messageId) {
            return `${type}_${userId}_${messageId}`;
        }
        
        return `${type}_${userId}_${timestamp}_${content.substring(0, 10)}`;
    }

    routeMessage(data) {
        // Direct message routing - no complex logic
        const type = data.type;
        
        if (type === 'message' || type === 'chat_message') {
            this.processMessage(data);
        } else if (type === 'typing' || type === 'typing_indicator') {
            this.processTyping(data);
        } else if (type === 'stop_typing') {
            this.processStopTyping(data);
        } else if (type === 'match_found') {
            this.roomManager.handleMatchFound(data);
        } else if (type === 'like_prompt') {
            this.hideCountdownTimer();
            this.app.showLikeModal();
        } else if (type === 'image_reveal') {
            this.app.handleImageReveal(data);
        } else if (type === 'chat_ended') {
            this.app.handleChatEnded();
        } else if (type === 'room_ended_by_user') {
            this.handleRoomEndedByUser(data);
        } else if (type === 'room_closed') {
            this.handleRoomClosed(data);
        } else if (type === 'room_ended') {
            if (this.app.simpleCountdownModule) {
                this.app.simpleCountdownModule.handleWebSocketMessage(JSON.stringify(data));
            }
            this.handleRoomEndedByUser(data);
        } else if (type === 'connection') {
            if (data.message === 'Connected to chat room') {
                console.log('🔍 Chat - Connected to chat room:', data.room_id);
            }
        } else if (type === 'status_update') {
            this.handleStatusUpdate(data);
        } else if (type === 'room_kept') {
            this.hideCountdownTimer();
        } else if (type === 'countdown_start') {
            this.handleCountdownStart(data);
        } else if (type === 'countdown_update' || type === 'notification_show' || type === 'notification_update') {
            if (this.app.simpleCountdownModule) {
                this.app.simpleCountdownModule.handleWebSocketMessage(JSON.stringify(data));
            }
        } else if (type === 'countdown_cancel') {
            this.hideCountdownTimer();
        }
    }

    processMessage(data) {
        // SIMPLE MESSAGE PROCESSING - No complex logic
        if (!data.content || !data.user_id) {
            return;
        }
        
        // ✅ THÊM: Kiểm tra nếu đang load history hoặc setup room thì skip WebSocket message
        if (this.isLoadingHistory || this.isSettingUpRoom) {
            console.log('🔍 Chat - Skipping WebSocket message while loading history or setting up room');
            return;
        }
        
        // Direct add to chat - no validation spam
        this.messageHandler.addMessageToChat(data);
    }

    processTyping(data) {
        // SIMPLE TYPING PROCESSING
        if (data.user_id && data.user_id !== this.app.currentUser.id) {
            this.messageHandler.handleTypingIndicator(data);
        }
    }

    processStopTyping(data) {
        // SIMPLE STOP TYPING PROCESSING
        if (data.user_id && data.user_id !== this.app.currentUser.id) {
            this.messageHandler.hideTypingIndicator(data.user_id);
        }
    }


    handleRoomEndedByUser(data) {
        console.log('🔍 Chat - Room ended by user notification received:', data);
        
        if (this.app.currentRoom && this.app.currentRoom.id == data.room_id) {
            console.log('🔍 Chat - Room ended is current room, processing...');
            
            // Show modal notification
            this.showRoomEndedModal(data.message || 'Phòng chat đã được kết thúc');
            
            // Reset chat state
            this.resetChatState();
            
            console.log('🔍 Chat - Successfully handled room ended, user returned to waiting room');
        } else {
            console.log('🔍 Chat - Room ended notification for different room, ignoring');
        }
    }

    handleRoomClosed(data) {
        console.log('🔍 Chat - Room closed notification received:', data);
        
        if (this.app.currentRoom && this.app.currentRoom.id == data.room_id) {
            console.log('🔍 Chat - Room closed is current room, processing...');
            
            // Show modal notification
            this.showRoomEndedModal(data.message || 'Phòng chat đã được đóng');
            
            // Reset chat state
            this.resetChatState();
            
            console.log('🔍 Chat - Successfully handled room closed, user returned to waiting room');
        } else {
            console.log('🔍 Chat - Room closed notification for different room, ignoring');
        }
    }

    showRoomEndedModal(message) {
        console.log('🔍 Chat - Showing room ended modal with message:', message);
        
        // Create modal HTML
        const modalHTML = `
            <div id="roomEndedModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
                    <div class="text-6xl mb-4">💬</div>
                    <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Phòng Chat Đã Kết Thúc</h3>
                    <p class="text-gray-600 dark:text-gray-300 mb-6">${message}</p>
                    
                    <button id="backToWaitingBtn" class="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-lg">
                        Về Phòng Chờ
                    </button>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Handle back to waiting button
        const backToWaitingBtn = document.getElementById('backToWaitingBtn');
        if (backToWaitingBtn) {
            backToWaitingBtn.addEventListener('click', () => {
                console.log('🔍 Chat - Back to waiting button clicked');
                
                // Close modal
                const modal = document.getElementById('roomEndedModal');
                if (modal) {
                    modal.remove();
                }
                
                // Reset chat state
                this.resetChatState();
            });
        }
        
        // Auto-close modal after 10 seconds
        setTimeout(() => {
            const modal = document.getElementById('roomEndedModal');
            if (modal) {
                console.log('🔍 Chat - Auto-closing room ended modal after 10 seconds');
                modal.remove();
                this.resetChatState();
            }
        }, 10000);
    }

    // Delegate methods for compatibility with other modules
    addMessageToChat(message) {
        this.messageHandler.addMessageToChat(message);
    }

    disconnectWebSocket() {
        this.websocketManager.disconnect();
    }

    handleWebSocketDisconnect() {
        this.handleDisconnect();
    }

    showToast(message, type = 'info') {
        this.connectionStatus.showToast(message, type);
    }

    handleDisconnect() {
        console.log('🔍 Chat - Handling disconnect');
        this.resetChatState();
    }

    async resetChatState() {
        console.log('🔍 Chat - Resetting chat state...');
        
        // Clear all timers
        if (this.app.timerManager) {
            console.log('🔍 Chat - Clearing all timers...');
            this.app.timerManager.clearAll();
        }
        
        // Hide countdown timer
        this.hideCountdownTimer();
        
        // Reset keep active button
        this.resetKeepActiveButton();
        console.log('🔍 Chat - Reset keep active button in resetChatState');
        
        // ✅ THÊM: Clear keep active state từ localStorage
        this.clearKeepActiveState();
        
        // Clear typing state
        this.messageHandler.clearTypingState();
        
        // Clear search state
        this.roomManager.clearSearchState();
        
        // Disconnect WebSocket
        this.websocketManager.disconnect();
        
        // Stop room status check
        this.connectionStatus.stopRoomStatusCheck();
        
        // Reset app state
        this.app.currentRoom = null;
        
        if (this.app.currentUser) {
            this.app.currentUser.current_room_id = null;
            this.app.currentUser.status = 'idle';
            console.log('🔍 Chat - User status reset to idle');
        }
        
        // Set room ended flag
        this.roomManager.roomEnded = true;
        console.log('🔍 Chat - Room ended flag set to true');
        
        // Reset last match room ID
        this.roomManager.lastMatchRoomId = null;
        
        // Clear chat messages
        this.messageHandler.clearChatMessages();
        
        // Go to waiting room
        this.app.uiModule.showWaitingRoom();
        
        console.log('🔍 Chat - Chat state reset completed');
    }

    // Keep active functionality
    async keepActive() {
        if (!this.app.currentRoom) return;

        try {
            await this.handleKeepActiveRequest();
        } catch (error) {
            console.error('Keep active error:', error);
        }
    }

    async handleKeepActiveRequest() {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                console.error('❌ No access token found');
                this.connectionStatus.showToast('Vui lòng đăng nhập lại', 'error');
                this.app.authModule.logout();
                return;
            }
            
            console.log('🔍 Sending keep active request to room:', this.app.currentRoom.id);
            
            const response = await fetch(`/chat/keep/${this.app.currentRoom.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ keep_active: true })
            });
            
            console.log('🔍 Keep active response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Keep active request sent successfully:', result);
                
                // Update UI immediately
                this.updateKeepActiveButton();
                
                // Hide countdown
                this.hideCountdownTimer();
                
                // Handle result
                if (result.room_kept) {
                    this.connectionStatus.showToast(result.message, 'success');
                } else if (result.waiting_for_other) {
                    this.connectionStatus.showToast(result.message, 'info');
                }
            } else if (response.status === 401) {
                console.error('❌ Authentication failed - token expired or invalid');
                this.connectionStatus.showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
                this.app.authModule.logout();
            } else {
                const error = await response.text();
                console.error('❌ Keep active request failed:', response.status, error);
                this.connectionStatus.showToast('Lỗi gửi yêu cầu giữ hoạt động', 'error');
            }
        } catch (error) {
            console.error('❌ Error sending keep active request:', error);
            this.connectionStatus.showToast('Lỗi kết nối', 'error');
        }
    }

    updateKeepActiveButton() {
        const keepActiveBtn = document.getElementById('keepActive');
        if (keepActiveBtn) {
            keepActiveBtn.textContent = 'Đã giữ hoạt động';
            keepActiveBtn.disabled = true;
            keepActiveBtn.style.background = '#10B981';
            keepActiveBtn.style.cursor = 'not-allowed';
            
            // ✅ THÊM: Lưu trạng thái vào localStorage
            if (this.app.currentRoom && this.app.currentRoom.id) {
                const roomId = this.app.currentRoom.id;
                const keepActiveState = {
                    roomId: roomId,
                    userId: this.app.currentUser?.id,
                    timestamp: Date.now(),
                    status: 'kept_active'
                };
                localStorage.setItem(`keepActive_${roomId}`, JSON.stringify(keepActiveState));
                console.log('🔍 Keep active state saved to localStorage:', keepActiveState);
            }
        }
    }

    resetKeepActiveButton() {
        const keepActiveBtn = document.getElementById('keepActive');
        if (keepActiveBtn) {
            keepActiveBtn.textContent = 'Giữ hoạt động';
            keepActiveBtn.disabled = false;
            keepActiveBtn.style.background = '';
            keepActiveBtn.style.cursor = '';
        }
    }

    // ✅ THÊM: Restore trạng thái "Giữ hoạt động" từ localStorage
    restoreKeepActiveState() {
        if (!this.app.currentRoom || !this.app.currentRoom.id) {
            return false;
        }
        
        const roomId = this.app.currentRoom.id;
        const keepActiveData = localStorage.getItem(`keepActive_${roomId}`);
        
        if (keepActiveData) {
            try {
                const state = JSON.parse(keepActiveData);
                const currentUserId = this.app.currentUser?.id;
                
                // Kiểm tra xem state có thuộc về user hiện tại không
                if (state.userId === currentUserId && state.roomId === roomId) {
                    console.log('🔍 Restoring keep active state:', state);
                    this.updateKeepActiveButton();
                    return true;
                } else {
                    // State không thuộc về user hiện tại, xóa
                    localStorage.removeItem(`keepActive_${roomId}`);
                    console.log('🔍 Removed invalid keep active state');
                }
            } catch (error) {
                console.error('🔍 Error parsing keep active state:', error);
                localStorage.removeItem(`keepActive_${roomId}`);
            }
        }
        
        return false;
    }

    // ✅ THÊM: Check xem user đã ấn "Giữ hoạt động" chưa
    hasUserKeptActive() {
        if (!this.app.currentRoom || !this.app.currentRoom.id) {
            return false;
        }
        
        const roomId = this.app.currentRoom.id;
        const keepActiveData = localStorage.getItem(`keepActive_${roomId}`);
        
        if (keepActiveData) {
            try {
                const state = JSON.parse(keepActiveData);
                const currentUserId = this.app.currentUser?.id;
                return state.userId === currentUserId && state.roomId === roomId;
            } catch (error) {
                console.error('🔍 Error parsing keep active state:', error);
                return false;
            }
        }
        
        return false;
    }

    // ✅ THÊM: Clear keep active state từ localStorage
    clearKeepActiveState() {
        if (this.app.currentRoom && this.app.currentRoom.id) {
            const roomId = this.app.currentRoom.id;
            localStorage.removeItem(`keepActive_${roomId}`);
            console.log('🔍 Cleared keep active state for room:', roomId);
        }
    }

    // Countdown timer methods
    showCountdownTimer(duration = 15) {
        console.log('🔍 Chat - Showing countdown timer with duration:', duration);
        
        let countdownEl = document.getElementById('like-countdown');
        if (countdownEl) {
            console.log('🔍 Chat - Countdown already exists, updating duration');
            const numberEl = document.getElementById('countdown-number');
            if (numberEl) {
                numberEl.textContent = duration;
            }
            return;
        }
        
        // Create countdown element
        countdownEl = document.createElement('div');
        countdownEl.id = 'like-countdown';
        countdownEl.className = 'fixed top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium z-50';
        countdownEl.innerHTML = `⏰ Đánh giá sau: <span id="countdown-number">${duration}</span>s`;
        document.body.appendChild(countdownEl);
        
        console.log('🔍 Chat - Countdown element created and added to DOM');
        
        // Start countdown
        let timeLeft = duration;
        const updateCountdown = () => {
            const numberEl = document.getElementById('countdown-number');
            if (numberEl) {
                numberEl.textContent = timeLeft;
                timeLeft--;
                
                if (timeLeft >= 0) {
                    this.app.timerManager.setTimer('countdown', updateCountdown, 1000);
                } else {
                    this.hideCountdownTimer();
                }
            }
        };
        
        updateCountdown();
    }

    hideCountdownTimer() {
        console.log('🔍 Chat - Hiding countdown timer');
        
        const countdownEl = document.getElementById('like-countdown');
        if (countdownEl) {
            countdownEl.remove();
        }
        
        // Clear countdown timer
        if (this.app.timerManager) {
            this.app.timerManager.clearTimer('countdown');
        }
    }

    handleCountdownStart(data) {
        console.log('🔍 Chat - handleCountdownStart called with:', data);
        const duration = data.duration || 15;
        
        const existingCountdown = document.getElementById('like-countdown');
        if (existingCountdown) {
            console.log('🔍 Chat - Countdown already exists, updating duration');
            const timeElement = existingCountdown.querySelector('.countdown-time');
            if (timeElement) {
                timeElement.textContent = `${duration}s`;
            }
        } else {
            console.log('🔍 Chat - Creating new countdown with duration:', duration);
            this.showCountdownTimer(duration);
        }
    }

    // Other utility methods
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
            
            this.app.utilsModule.showSuccess('Đã báo cáo người dùng');
        } catch (error) {
            console.error('Report error:', error);
            this.app.utilsModule.showError('Không thể báo cáo');
        }
    }

    handleStatusUpdate(data) {
        console.log('🔍 Chat - Status update received:', data);
        
        if (this.app.currentUser && data.user_id === this.app.currentUser.id) {
            console.log('🔍 Chat - Updating user status from server');
            this.app.currentUser.status = data.status;
            this.app.currentUser.current_room_id = data.current_room_id;
            
            if (data.status === 'connected' && data.current_room_id) {
                console.log('🔍 Chat - User connected to room, restoring chat state...');
                this.restoreChatState();
            }
        }
    }

    // API call with retry
    async apiCallWithRetry(url, options, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                
                if (i === maxRetries - 1) throw new Error('Max retries reached');
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                console.log(`🔍 Chat - API call failed, retrying in ${1000 * (i + 1)}ms...`);
            }
        }
    }

    // Loading state methods
    showLoadingState(message = 'Đang xử lý...') {
        this.hideLoadingState();
        
        const loadingEl = document.createElement('div');
        loadingEl.id = 'chat-loading-indicator';
        loadingEl.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        loadingEl.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p class="text-gray-700 dark:text-gray-300">${message}</p>
            </div>
        `;
        
        document.body.appendChild(loadingEl);
        console.log('🔍 Chat - Loading state shown:', message);
    }

    hideLoadingState() {
        const loadingEl = document.getElementById('chat-loading-indicator');
        if (loadingEl) {
            loadingEl.remove();
            console.log('🔍 Chat - Loading state hidden');
        }
    }

    // Check pending chat connection
    async checkPendingChatConnection() {
        if (this.app.pendingChatConnection) {
            console.log('🔍 Chat - Found pending chat connection:', this.app.pendingChatConnection);
            const { roomId, timestamp } = this.app.pendingChatConnection;
            
            const now = Date.now();
            if (now - timestamp < 30000) { // 30 seconds
                console.log('🔍 Chat - Pending connection still valid, connecting to room:', roomId);
                
                delete this.app.pendingChatConnection;
                
                if (this.app.currentUser && this.app.currentUser.status.toLowerCase() === 'connected') {
                    await this.enterChatRoom(roomId);
                }
            } else {
                console.log('🔍 Chat - Pending connection expired, removing');
                delete this.app.pendingChatConnection;
            }
        } else {
            if (!this.roomManager.isRestoringState && !this.roomManager.roomEnded) {
                this.restoreChatState();
            }
        }
    }

    // Delegate debug methods
    debug() {
        return this.debugTools.debug();
    }

    testRestore() {
        return this.debugTools.testRestore();
    }

    testRoomEndedLogic() {
        return this.debugTools.testRoomEndedLogic();
    }

    async testRoomStatusCheck() {
        return this.debugTools.testRoomStatusCheck();
    }

    checkConnectionStatus() {
        return this.connectionStatus.checkConnectionStatus();
    }

    testSendMessage() {
        return this.debugTools.testSendMessage();
    }

    healthCheck() {
        return this.debugTools.healthCheck();
    }
}

// Export ChatModule for ES modules
export { ChatModule };

