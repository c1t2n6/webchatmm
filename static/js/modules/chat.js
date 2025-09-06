// Chat and Matching Module
class ChatModule {
    constructor(app) {
        this.app = app;
        this.websocket = null;
        this.chatWebSocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.typingTimer = null;
        
        // ✅ THÊM: Flag để track room đã ended
        this.roomEnded = false;
        
        // ✅ THÊM: TimerManager để quản lý tất cả timer
        this.timerManager = null;
        this.initTimerManager();
        
        // Kiểm tra xem có pending chat connection không
        this.checkPendingChatConnection();
    }
    
    // ✅ THÊM: Khởi tạo TimerManager
    async initTimerManager() {
        try {
            // Import TimerManager module
            const { TimerManager } = await import('./timer_manager.js');
            this.timerManager = new TimerManager();
            console.log('🔍 Chat - TimerManager initialized successfully');
        } catch (error) {
            console.error('🔍 Chat - Failed to initialize TimerManager:', error);
            // Fallback: tạo TimerManager đơn giản
            this.timerManager = {
                setTimer: (id, callback, delay) => setTimeout(callback, delay),
                clearTimer: (id) => {},
                clearAll: () => {},
                setInterval: (id, callback, interval) => setInterval(callback, interval),
                clearInterval: (id) => {}
            };
        }
    }
    
    async init() {
        console.log('🔍 Chat - ChatModule init called');
        
        // Đợi một chút để đảm bảo DOM đã sẵn sàng
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Kiểm tra và khôi phục trạng thái chat nếu cần
        if (this.app.currentUser) {
            await this.restoreChatState();
        }
        
        // Thêm event listener để kiểm tra trạng thái khi page load
        window.addEventListener('load', () => {
            console.log('🔍 Chat - Page loaded, checking chat state...');
            if (this.app.currentUser) {
                this.restoreChatState();
            }
        });
        
        // Kiểm tra trạng thái ngay lập tức nếu DOM đã sẵn sàng
        if (document.readyState === 'complete') {
            console.log('🔍 Chat - DOM already complete, checking chat state immediately...');
            if (this.app.currentUser) {
                this.restoreChatState();
            }
        }
        
        // Thêm logic để tự động khôi phục chat state sau khi user được load
        // Đợi một chút để đảm bảo user data đã được load
        setTimeout(async () => {
            if (this.app.currentUser) {
                console.log('🔍 Chat - Auto-restoring chat state after delay...');
                await this.restoreChatState();
            }
        }, 1000);
    }
    
    checkPendingChatConnection() {
        if (this.app.pendingChatConnection) {
            console.log('🔍 Chat - Found pending chat connection:', this.app.pendingChatConnection);
            const { roomId, timestamp } = this.app.pendingChatConnection;
            
            // Kiểm tra xem pending connection có còn hợp lệ không (trong vòng 30 giây)
            const now = Date.now();
            if (now - timestamp < 30000) { // 30 giây
                console.log('🔍 Chat - Pending connection still valid, connecting to room:', roomId);
                
                // Xóa pending connection
                delete this.app.pendingChatConnection;
                
                // Kết nối vào room
                if (this.app.currentUser && this.app.currentUser.status.toLowerCase() === 'connected') {
                    this.app.currentRoom = { id: roomId };
                    this.showChatRoomWithSync();
                    this.connectChatWebSocket(roomId);
                }
            } else {
                console.log('🔍 Chat - Pending connection expired, removing');
                delete this.app.pendingChatConnection;
            }
        } else {
            // Không có pending connection, kiểm tra xem có cần khôi phục chat state không
            this.restoreChatState();
        }
    }
    
    async restoreChatState() {
        console.log('🔍 Chat - restoreChatState called');
        console.log('🔍 Chat - Current user:', this.app.currentUser);
        console.log('🔍 Chat - User status:', this.app.currentUser?.status);
        console.log('🔍 Chat - User current_room_id:', this.app.currentUser?.current_room_id);
        
        // ✅ THÊM: Kiểm tra flag room đã ended
        if (this.roomEnded) {
            console.log('🔍 Chat - Room was ended, skipping restore to prevent re-entry');
            return false;
        }
        
        // Kiểm tra xem user có đang trong chat room không
        if (this.app.currentUser && this.app.currentUser.status.toLowerCase() === 'connected' && this.app.currentUser.current_room_id) {
            console.log('🔍 Chat - User is in chat room, checking if room is still active...');
            
            // ✅ THÊM: Kiểm tra room có còn active không từ backend
            try {
                const response = await fetch(`/chat/room/${this.app.currentUser.current_room_id}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                });
                
                if (response.ok) {
                    const roomData = await response.json();
                    console.log('🔍 Chat - Room status from backend:', roomData);
                    
                    // ✅ KIỂM TRA: Room có end_time không
                    if (roomData.end_time) {
                        console.log('🔍 Chat - Room has ended in backend, resetting user status...');
                        
                        // Room đã ended, reset user status và set flag
                        this.app.currentUser.current_room_id = null;
                        this.app.currentUser.status = 'idle';
                        this.app.currentRoom = null;
                        this.roomEnded = true;
                        
                        // Không restore, user sẽ ở waiting room
                        console.log('🔍 Chat - User status reset due to ended room, staying in waiting room');
                        return false;
                    }
                } else {
                    console.warning('🔍 Chat - Could not check room status from backend, proceeding with caution');
                }
            } catch (error) {
                console.error('🔍 Chat - Error checking room status from backend:', error);
                // Nếu không thể kiểm tra backend, tiếp tục với logic cũ
            }
            
            // Kiểm tra xem có đang ở chat room UI không
            const chatRoom = document.getElementById('chatRoom');
            const waitingRoom = document.getElementById('waitingRoom');
            const searching = document.getElementById('searching');
            
            // Nếu đang ở waiting room hoặc searching, chuyển về chat room
            if ((waitingRoom && !waitingRoom.classList.contains('hidden')) || 
                (searching && !searching.classList.contains('hidden'))) {
                console.log('🔍 Chat - User is in waiting/searching, redirecting to chat room...');
                this.app.currentRoom = { id: this.app.currentUser.current_room_id };
                this.showChatRoomWithSync();
            }
            
            // Load chat history trước khi kết nối WebSocket
            await this.loadChatHistory(this.app.currentUser.current_room_id);
            
            // Kết nối WebSocket nếu chưa có
            if (!this.chatWebSocket || this.chatWebSocket.readyState !== WebSocket.OPEN) {
                console.log('🔍 Chat - Connecting to chat WebSocket...');
                this.connectChatWebSocket(this.app.currentUser.current_room_id);
            }
            
            return true;
        }
        
        // Nếu user không có current_room_id hoặc status không phải connected, 
        // kiểm tra xem họ có đang trong room nào không
        if (this.app.currentUser) {
            console.log('🔍 Chat - User status is not connected or no current_room_id, checking for active rooms...');
            
            try {
                // Gọi API để kiểm tra xem user có đang trong room nào không
                const response = await fetch('/chat/check-room-status', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                });
                
                console.log('🔍 Chat - Check room status API response status:', response.status);
                
                if (response.ok) {
                    const roomData = await response.json();
                    console.log('🔍 Chat - Check room status API response:', roomData);
                    
                    if (roomData.room_id && roomData.status === 'active') {
                        console.log('🔍 Chat - Found active room for user:', roomData.room_id);
                        
                        // Cập nhật user status
                        this.app.currentUser.current_room_id = roomData.room_id;
                        this.app.currentUser.status = 'connected';
                        this.app.currentRoom = { id: roomData.room_id };
                        
                        // Chuyển về chat room
                        this.showChatRoomWithSync();
                        
                        // Load chat history trước khi kết nối WebSocket
                        await this.loadChatHistory(roomData.room_id);
                        
                        // Kết nối WebSocket
                        this.connectChatWebSocket(roomData.room_id);
                        
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
        return false;
    }
    
    async loadChatHistory(roomId) {
        console.log('🔍 Chat - Loading chat history for room:', roomId);
        
        // ✅ RESET: Reset trạng thái nút "Giữ hoạt động" khi load phòng mới
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
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.innerHTML = '';
                }
                
                // Add messages to chat
                if (data.messages && data.messages.length > 0) {
                    console.log('🔍 Chat - Adding', data.messages.length, 'messages to chat');
                    data.messages.forEach(message => {
                        this.addMessageToChat(message);
                    });
                } else {
                    console.log('🔍 Chat - No messages in history');
                }
                
                // Scroll to bottom
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
        }
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
    
    // ✅ THÊM: Method để reset flag room ended khi user bắt đầu search mới
    resetRoomEndedFlag() {
        if (this.roomEnded) {
            console.log('🔍 Chat - Resetting room ended flag for new search');
            this.roomEnded = false;
        }
    }

    async startSearch() {
        await this.refreshUserStatus();
        
        // ✅ THÊM: Reset flag room ended khi bắt đầu search mới
        this.resetRoomEndedFlag();
        
        // Kiểm tra pending chat connection trước
        if (this.app.pendingChatConnection) {
            console.log('🔍 Chat - Processing pending chat connection in startSearch');
            this.checkPendingChatConnection();
            return;
        }
        
        // Kiểm tra xem user có đang trong chat room không
        if (await this.restoreChatState()) {
            console.log('🔍 Chat - Chat state restored, no need to search');
            return;
        }
        
        // Nếu user đã có room_id và status connected, chuyển về chat room
        if (this.app.currentUser && this.app.currentUser.status.toLowerCase() === 'connected' && this.app.currentUser.current_room_id) {
            console.log('User already connected to room, redirecting to chat...');
            this.app.currentRoom = { id: this.app.currentUser.current_room_id };
            this.showChatRoomWithSync();
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
            console.log('🔍 Chat - Closing existing WebSocket connection');
            this.websocket.close();
        }

        const token = localStorage.getItem('access_token');
        console.log('🔍 Chat - Connecting to status WebSocket...');
        this.websocket = new WebSocket(`ws://${window.location.host}/ws/status?token=${token}`);

        this.websocket.onopen = () => {
            console.log('🔍 Chat - Status WebSocket connected successfully');
            this.reconnectAttempts = 0;
        };

        this.websocket.onmessage = (event) => {
            console.log('🔍 Chat - Status WebSocket message received:', event.data);
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.websocket.onclose = () => {
            console.log('🔍 Chat - Status WebSocket disconnected');
            this.handleWebSocketDisconnect();
        };

        this.websocket.onerror = (error) => {
            console.error('🔍 Chat - Status WebSocket error:', error);
        };
    }

    handleWebSocketMessage(data) {
        console.log('🔍 Chat - WebSocket message received:', data);
        console.log('🔍 Chat - Message type:', data.type);
        
        switch (data.type) {
            case 'match_found':
                console.log('🔍 Chat - Handling match_found');
                this.handleMatchFound(data);
                break;
            case 'chat_message':
                console.log('🔍 Chat - Handling chat_message');
                this.handleChatMessage(data);
                break;
            case 'typing_indicator':
                console.log('🔍 Chat - Handling typing_indicator');
                this.handleTypingIndicator(data);
                break;
            case 'like_prompt':
                console.log('🔍 Chat - Handling like_prompt');
                this.hideCountdownTimer(); // Ẩn countdown khi hiển thị like modal
                this.app.showLikeModal();
                break;
            case 'image_reveal':
                console.log('🔍 Chat - Handling image_reveal');
                this.app.handleImageReveal(data);
                break;
            case 'chat_ended':
                console.log('🔍 Chat - Handling chat_ended');
                this.app.handleChatEnded();
                break;
            case 'room_ended_by_user':
                console.log('🔍 Chat - Handling room_ended_by_user');
                this.handleRoomEndedByUser(data);
                break;
            case 'status_update':
                console.log('🔍 Chat - Handling status_update');
                this.handleStatusUpdate(data);
                break;
            case 'room_kept':
                console.log('🔍 Chat - Handling room_kept');
                this.hideCountdownTimer(); // Ẩn countdown khi cả 2 user đã giữ hoạt động
                break;
            case 'countdown_start':
                console.log('🔍 Chat - Handling countdown_start');
                this.handleCountdownStart(data);
                break;
            case 'countdown_cancel':
                console.log('🔍 Chat - Handling countdown_cancel');
                this.hideCountdownTimer(); // Ẩn countdown khi bị hủy
                break;
            default:
                console.log('🔍 Chat - Unknown message type:', data.type);
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
        
        // ✅ THÊM: Reset flag room ended khi user được match vào room mới
        this.roomEnded = false;
        console.log('🔍 Chat - Room ended flag reset for new match');
        
        // ✅ THÊM: Clear sync timeout khi bắt đầu room mới
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = null;
        }
        
        this.showChatRoomWithSync();
        
        // Load chat history trước khi kết nối WebSocket
        await this.loadChatHistory(this.app.currentRoom.id);
        
        this.connectChatWebSocket(this.app.currentRoom.id);
        
        // ✅ THÊM: Bắt đầu countdown flow sau khi match
        if (this.app.simpleCountdownModule) {
            // Đợi một chút để đảm bảo room đã sẵn sàng
            setTimeout(() => {
                this.app.simpleCountdownModule.startCountdown(this.app.currentRoom.id);
            }, 1000); // 1 giây sau khi match
        }
        
        // ✅ THÊM: Sync countdown status khi vào room
        this.syncCountdownStatus();
        
        // ✅ TẮT: Hệ thống cũ - không gọi scheduleBackendLikePrompt nữa
        // this.scheduleBackendLikePrompt(); // Commented out - using new system
        
        // ✅ SỬA: Sử dụng backend-driven timer thay vì frontend timer
        // Backend sẽ gửi countdown_start message và like_prompt message
        console.log('🔍 Chat - Backend will handle countdown and like modal timer');
        
        // ✅ REMOVED: Old backend like prompt scheduling - replaced by countdown notification system
    }
    
    // ✅ THÊM: Method helper để trigger countdown khi vào room
    async triggerCountdownForRoom(roomId) {
        console.log('🔍 Chat - triggerCountdownForRoom called for room:', roomId);
        
        // Chỉ trigger countdown nếu chưa có countdown active
        const countdownEl = document.getElementById('like-countdown');
        if (!countdownEl) {
            console.log('🔍 Chat - No active countdown, requesting from backend');
            // ✅ REMOVED: Old backend like prompt scheduling - replaced by countdown notification system
        } else {
            console.log('🔍 Chat - Countdown already active, skipping');
        }
    }

    // ✅ THÊM: Xử lý countdown start từ backend
    handleCountdownStart(data) {
        console.log('🔍 Chat - handleCountdownStart called with:', data);
        const duration = data.duration || 15;
        
        // Kiểm tra xem đã có countdown active chưa
        const existingCountdown = document.getElementById('like-countdown');
        if (existingCountdown) {
            console.log('🔍 Chat - Countdown already exists, updating duration');
            // Cập nhật duration nếu cần
            const timeElement = existingCountdown.querySelector('.countdown-time');
            if (timeElement) {
                timeElement.textContent = `${duration}s`;
            }
        } else {
            console.log('🔍 Chat - Creating new countdown with duration:', duration);
            this.showCountdownTimer(duration);
        }
    }

    handleLikePrompt(data) {
        console.log('🔍 Chat - handleLikePrompt called with:', data);
        // Ẩn countdown timer trước khi hiển thị like modal
        this.hideCountdownTimer();
        // Lưu room_id từ data để sử dụng trong handleLikeResponse
        this.currentRoomId = data.room_id;
        // Hiển thị like modal
        if (this.app && typeof this.app.showLikeModal === 'function') {
            console.log('🔍 Chat - Calling app.showLikeModal()');
            this.app.showLikeModal();
        } else {
            console.error('🔍 Chat - app.showLikeModal not available, app:', this.app);
            // Fallback: tạo like modal đơn giản
            this.createFallbackLikeModal(data);
        }
    }
    
    // ✅ THÊM: Tạo fallback like modal đơn giản
    createFallbackLikeModal(data) {
        console.log('🔍 Chat - Creating fallback like modal');
        
        // Sử dụng thông tin từ backend nếu có
        const message = data?.message || "Bạn có muốn tiếp tục cuộc trò chuyện với người này không?";
        const buttons = data?.buttons || {
            yes: "✅ Có - Tôi muốn tiếp tục",
            no: "❌ Không - Kết thúc cuộc trò chuyện"
        };
        
        // Tạo modal đơn giản
        const modal = document.createElement('div');
        modal.id = 'fallback-like-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
        `;
        
        modalContent.innerHTML = `
            <h3 style="margin-bottom: 20px; color: #333;">Tiếp tục cuộc trò chuyện</h3>
            <p style="margin-bottom: 20px; color: #666;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="like-btn" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">${buttons.yes}</button>
                <button id="dislike-btn" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">${buttons.no}</button>
            </div>
            ${data?.timeout_seconds ? `<div style="margin-top: 15px; font-size: 14px; color: #666;">Bạn có ${data.timeout_seconds} giây để quyết định</div>` : ''}
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Thêm event listeners
        document.getElementById('like-btn').addEventListener('click', () => {
            console.log('🔍 Chat - User clicked like');
            this.handleLikeResponse(true);
            this.closeFallbackModal();
        });
        
        document.getElementById('dislike-btn').addEventListener('click', () => {
            console.log('🔍 Chat - User clicked dislike');
            this.handleLikeResponse(false);
            this.closeFallbackModal();
        });
        
        // Đóng modal khi click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeFallbackModal();
            }
        });
    }
    
    closeFallbackModal() {
        const modal = document.getElementById('fallback-like-modal');
        if (modal) {
            modal.remove();
        }
    }
    
    async handleLikeResponse(isLike) {
        console.log('🔍 Chat - Handling like response:', isLike);
        
        // Sử dụng currentRoomId từ WebSocket message
        const roomId = this.currentRoomId || (this.app && this.app.currentRoom && this.app.currentRoom.id);
        if (!roomId) {
            console.error('🔍 Chat - No room ID available for like response');
            return;
        }
        
        console.log('🔍 Chat - Sending like response for room:', roomId);
        
        // Gọi API trực tiếp thay vì WebSocket
        try {
            const response = await fetch(`/chat/like/${roomId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}` 
                },
                body: JSON.stringify({ response: isLike ? "yes" : "no" })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('🔍 Chat - Like response sent successfully:', result);
            } else {
                console.error('🔍 Chat - Failed to send like response:', response.status, await response.text());
            }
        } catch (error) {
            console.error('🔍 Chat - Error sending like response:', error);
        }
    }
    
    // ✅ THÊM: Hiển thị đếm ngược với duration từ backend
    showCountdownTimer(duration = 15) {
        console.log('🔍 Chat - Showing countdown timer with duration:', duration);
        
        // Kiểm tra xem đã có countdown chưa
        let countdownEl = document.getElementById('like-countdown');
        if (countdownEl) {
            console.log('🔍 Chat - Countdown already exists, updating duration');
            // Cập nhật duration nếu đã có countdown
            const numberEl = document.getElementById('countdown-number');
            if (numberEl) {
                numberEl.textContent = duration;
            }
            return;
        }
        
        // Tạo countdown element
        countdownEl = document.createElement('div');
        countdownEl.id = 'like-countdown';
        countdownEl.className = 'fixed top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium z-50';
        countdownEl.innerHTML = `⏰ Đánh giá sau: <span id="countdown-number">${duration}</span>s`;
        document.body.appendChild(countdownEl);
        
        console.log('🔍 Chat - Countdown element created and added to DOM');
        
        // Bắt đầu đếm ngược
        let timeLeft = duration;
        const updateCountdown = () => {
            const numberEl = document.getElementById('countdown-number');
            if (numberEl) {
                numberEl.textContent = timeLeft;
                timeLeft--;
                
                if (timeLeft >= 0) {
                    this.timerManager.setTimer('countdown', updateCountdown, 1000);
                } else {
                    this.hideCountdownTimer();
                }
            }
        };
        
        // Bắt đầu đếm ngược
        updateCountdown();
    }
    
    // ✅ THÊM: Ẩn đếm ngược
    hideCountdownTimer() {
        console.log('🔍 Chat - Hiding countdown timer');
        
        const countdownEl = document.getElementById('like-countdown');
        if (countdownEl) {
            countdownEl.remove();
        }
        
        // Clear countdown timer
        if (this.timerManager) {
            this.timerManager.clearTimer('countdown');
        }
    }

    // ✅ THÊM: Method helper để reset chat state một cách an toàn
    resetChatState() {
        console.log('🔍 Chat - Resetting chat state...');
        
        // ✅ THÊM: Clear tất cả timer trước khi reset
        if (this.timerManager) {
            console.log('🔍 Chat - Clearing all timers...');
            this.timerManager.clearAll();
        }
        
        // ✅ THÊM: Ẩn countdown timer
        this.hideCountdownTimer();
        
        // ✅ THÊM: Reset trạng thái nút "Giữ hoạt động"
        this.resetKeepActiveButton();
        console.log('🔍 Chat - Reset keep active button in resetChatState');
        
        // Đóng WebSocket connections
        if (this.chatWebSocket) {
            console.log('🔍 Chat - Closing chat WebSocket');
            this.chatWebSocket.close();
            this.chatWebSocket = null;
        }
        
        // Reset app state
        this.app.currentRoom = null;
        
        if (this.app.currentUser) {
            this.app.currentUser.current_room_id = null;
            this.app.currentUser.status = 'idle';
            console.log('🔍 Chat - User status reset to idle');
        }
        
        // ✅ THÊM: Set flag room đã ended
        this.roomEnded = true;
        console.log('🔍 Chat - Room ended flag set to true');
        
        // ✅ THÊM: Clear sync timeout khi room ended
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = null;
        }
        
        // Chuyển về waiting room
        this.app.showWaitingRoom();
        
        console.log('🔍 Chat - Chat state reset completed');
    }
    
    // ✅ THÊM: Method để sync countdown hiện tại với backend
    async syncCountdownWithBackend(roomId) {
        console.log('🔍 Chat - Syncing countdown with backend for room:', roomId);
        
        try {
            // Gửi request để lấy thông tin countdown hiện tại từ backend
            const response = await fetch(`/simple-countdown/status/${roomId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔍 Chat - Countdown status from backend:', data);
                
                // Sử dụng API mới - kiểm tra phase và remaining time
                if (data.phase === 'countdown' && data.countdown_remaining > 0) {
                    console.log('🔍 Chat - Backend has active countdown, syncing with remaining time:', data.countdown_remaining);
                    if (this.app.simpleCountdownModule) {
                        this.app.simpleCountdownModule.syncWithBackend(roomId);
                    }
                } else if (data.phase === 'notification' && data.notification_remaining > 0) {
                    console.log('🔍 Chat - Backend has active notification, syncing with remaining time:', data.notification_remaining);
                    if (this.app.simpleCountdownModule) {
                        this.app.simpleCountdownModule.syncWithBackend(roomId);
                    }
                } else {
                    console.log('🔍 Chat - No active countdown/notification on backend');
                    // Ẩn countdown/notification nếu có
                    if (this.app.simpleCountdownModule) {
                        this.app.simpleCountdownModule.hideCountdown();
                        this.app.simpleCountdownModule.hideNotification();
                    }
                }
            } else {
                console.log('🔍 Chat - Failed to get countdown status from backend, checking local countdown');
                // Nếu không lấy được từ backend, kiểm tra local countdown
                const countdownEl = document.getElementById('like-countdown');
                if (!countdownEl) {
                    console.log('🔍 Chat - No local countdown, requesting new one from backend');
                    await this.triggerCountdownForRoom(roomId);
                }
            }
        } catch (error) {
            console.error('🔍 Chat - Error syncing countdown with backend:', error);
            // Nếu có lỗi, kiểm tra local countdown
            const countdownEl = document.getElementById('like-countdown');
            if (!countdownEl) {
                console.log('🔍 Chat - No local countdown, requesting new one from backend');
                await this.triggerCountdownForRoom(roomId);
            }
        }
    }
    
    // ✅ THÊM: Sync countdown status với backend
    async syncCountdownStatus() {
        try {
            if (!this.app.currentRoom?.id) {
                console.log('🔍 Chat - No current room, skipping countdown sync');
                return;
            }
            
            // ✅ THÊM: Kiểm tra room ended flag trước khi sync
            if (this.roomEnded) {
                console.log('🔍 Chat - Room already ended locally, skipping countdown sync');
                return;
            }
            
            // ✅ Đơn giản hóa: Chỉ sync một lần khi vào room
            if (this.app.simpleCountdownModule) {
                console.log('🔍 Chat - Syncing countdown status for room:', this.app.currentRoom.id);
                this.app.simpleCountdownModule.syncWithBackend(this.app.currentRoom.id);
            }
            
        } catch (error) {
            console.error('🔍 Chat - Error syncing countdown status:', error);
        }
    }
    
    // ✅ THÊM: Wrapper method để show chat room và sync countdown
    async showChatRoomWithSync() {
        this.app.showChatRoom();
        
        // ✅ RESET: Reset trạng thái nút "Giữ hoạt động" khi hiển thị phòng mới
        this.resetKeepActiveButton();
        console.log('🔍 Chat - Reset keep active button in showChatRoomWithSync');
        
        // Đợi một chút để DOM được render
        setTimeout(() => {
            this.syncCountdownStatus();
        }, 500);
    }

    // ✅ THÊM: Method để gửi request backend lên lịch like prompt
    // ✅ REMOVED: Old backend like prompt scheduling method - replaced by countdown notification system

    handleRoomEndedByUser(data) {
        console.log('🔍 Chat - Room ended by user notification received:', data);
        console.log('🔍 Chat - Current WebSocket state:', this.websocket?.readyState);
        console.log('🔍 Chat - Current chat WebSocket state:', this.chatWebSocket?.readyState);
        
        // ✅ BƯỚC 1: Hiển thị modal thông báo
        this.showRoomEndedModal(data.message || 'Phòng chat đã được kết thúc');
        
        // ✅ BƯỚC 2-4: Sử dụng method helper để reset state
        this.resetChatState();
        
        console.log('🔍 Chat - Successfully handled room ended, user returned to waiting room');
    }
    
    handleStatusUpdate(data) {
        console.log('🔍 Chat - Status update received:', data);
        
        // Cập nhật user status từ server
        if (this.app.currentUser && data.user_id === this.app.currentUser.id) {
            console.log('🔍 Chat - Updating user status from server');
            console.log('🔍 Chat - Old status:', this.app.currentUser.status, 'New status:', data.status);
            console.log('🔍 Chat - Old room_id:', this.app.currentUser.current_room_id, 'New room_id:', data.current_room_id);
            
            // Cập nhật trạng thái
            this.app.currentUser.status = data.status;
            this.app.currentUser.current_room_id = data.current_room_id;
            
            // Nếu user được kết nối vào room, khôi phục chat state
            if (data.status === 'connected' && data.current_room_id) {
                console.log('🔍 Chat - User connected to room, restoring chat state...');
                this.restoreChatState();
            }
        }
    }
    
    handleRoomClosed(data) {
        console.log('🔍 Chat - Room closed notification received:', data);
        console.log('🔍 Chat - Current WebSocket state:', this.websocket?.readyState);
        console.log('🔍 Chat - Current chat WebSocket state:', this.chatWebSocket?.readyState);
        
        // ✅ SỬA: Xử lý trực tiếp thay vì gọi showRoomEndedModal
        this.handleRoomEndedByUser({
            message: data.message || 'Phòng chat đã đóng',
            room_id: data.room_id
        });
    }
    
    showRoomEndedModal(message) {
        console.log('🔍 Chat - Showing room ended modal with message:', message);
        
        // Tạo modal HTML
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
        
        // Thêm modal vào body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // ✅ SỬA: Nút "Về Phòng Chờ" không reload page nữa
        const backToWaitingBtn = document.getElementById('backToWaitingBtn');
        if (backToWaitingBtn) {
            backToWaitingBtn.addEventListener('click', () => {
                console.log('🔍 Chat - Back to waiting button clicked');
                
                // ✅ Đóng modal
                const modal = document.getElementById('roomEndedModal');
                if (modal) {
                    modal.remove();
                }
                
                // ✅ Sử dụng method helper để reset state
                this.resetChatState();
            });
        }
        
        // ✅ SỬA: Auto-close modal sau 10 giây và tự động xử lý
        setTimeout(() => {
            const modal = document.getElementById('roomEndedModal');
            if (modal) {
                console.log('🔍 Chat - Auto-closing room ended modal after 10 seconds');
                modal.remove();
                
                // ✅ Sử dụng method helper để reset state
                this.resetChatState();
            }
        }, 10000);
    }

    connectChatWebSocket(roomId) {
        console.log('🔍 Chat - connectChatWebSocket called with roomId:', roomId);
        const token = localStorage.getItem('access_token');
        console.log('🔍 Chat - Connecting to chat WebSocket for room:', roomId);
        const chatWs = new WebSocket(`ws://${window.location.host}/ws/chat/${roomId}?token=${token}`);

        chatWs.onopen = async () => {
            console.log('🔍 Chat - Chat WebSocket connected successfully to room:', roomId);
            
            // ✅ RESET: Reset trạng thái nút "Giữ hoạt động" khi vào phòng mới
            this.resetKeepActiveButton();
            console.log('🔍 Chat - Reset keep active button for new room');
            
            // Load chat history khi WebSocket kết nối
            await this.loadChatHistory(roomId);
            
            // ✅ Setup typing listeners sau khi WebSocket kết nối
            this.setupTypingListeners();
            
            // ✅ KIỂM TRA: Luôn sync với backend trước khi quyết định
            console.log('🔍 Chat - Checking countdown status with backend...');
            console.log('🔍 Chat - Current countdown element exists:', !!document.getElementById('like-countdown'));
            await this.syncCountdownWithBackend(roomId);
            console.log('🔍 Chat - After sync, countdown element exists:', !!document.getElementById('like-countdown'));
        };

        chatWs.onmessage = (event) => {
            console.log('🔍 Chat - Chat WebSocket message received:', event.data);
            const data = JSON.parse(event.data);
            this.handleChatWebSocketMessage(data);
        };

        chatWs.onclose = () => {
            console.log('🔍 Chat - Chat WebSocket disconnected from room:', roomId);
        };

        chatWs.onerror = (error) => {
            console.error('🔍 Chat - Chat WebSocket error:', error);
        };

        this.chatWebSocket = chatWs;
    }

    handleChatWebSocketMessage(data) {
        console.log('🔍 Chat - handleChatWebSocketMessage called with:', data);
        
        switch (data.type) {
            case 'message':
                console.log('🔍 Chat - Message received:', data);
                this.addMessageToChat(data);  // ✅ Sửa: truyền data thay vì data.message
                break;
            case 'typing':
                console.log('🔍 Chat - Typing indicator received:', data);
                this.showTypingIndicator(data.user_id);
                break;
            case 'stop_typing':
                console.log('🔍 Chat - Stop typing indicator received:', data);
                this.hideTypingIndicator(data.user_id);
                break;
            case 'room_closed':
                console.log('🔍 Chat - Room closed notification received via chat WebSocket:', data);
                this.handleRoomClosed(data);
                break;
            case 'room_ended_by_user':
                console.log('🔍 Chat - Room ended by user notification received via chat WebSocket:', data);
                this.handleRoomEndedByUser(data);
                break;
            case 'room_ended':
                console.log('🔍 Chat - Room ended notification received via chat WebSocket:', data);
                // Chuyển cho countdown notification module mới xử lý
                if (this.app.simpleCountdownModule) {
                    this.app.simpleCountdownModule.handleWebSocketMessage(JSON.stringify(data));
                }
                // Fallback cho xử lý cũ
                this.handleRoomEndedByUser(data);
                break;
            case 'connection':
                console.log('🔍 Chat - Connection message received:', data);
                // Xử lý thông báo kết nối thành công
                if (data.message === 'Connected to chat room') {
                    console.log('🔍 Chat - Successfully connected to chat room:', data.room_id);
                }
                break;
            case 'countdown_start':
            case 'countdown_update':
            case 'notification_show':
            case 'notification_update':
            case 'room_kept':
                // Chuyển notification messages cho countdown notification module mới
                if (this.app.simpleCountdownModule) {
                    this.app.simpleCountdownModule.handleWebSocketMessage(JSON.stringify(data));
                }
                break;
            default:
                console.log('🔍 Chat - Unhandled message type:', data.type, data);
        }
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || !this.chatWebSocket) return;

        try {
            // ✅ Gửi stop typing indicator trước khi gửi tin nhắn
            this.sendStopTypingIndicator();

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
            // ✅ Gửi typing indicator với is_typing = true
            this.chatWebSocket.send(JSON.stringify({
                type: 'typing',
                is_typing: true
                // room_id is handled by backend WebSocket authentication
            }));
        }

        this.typingTimer = setTimeout(() => {
            if (this.chatWebSocket) {
                // ✅ Tự động gửi stop typing sau 1 giây
                this.sendStopTypingIndicator();
            }
        }, 1000);
    }

    sendStopTypingIndicator() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }

        if (this.chatWebSocket) {
            // ✅ Gửi stop typing indicator với is_typing = false
            this.chatWebSocket.send(JSON.stringify({
                type: 'typing',
                is_typing: false
                // room_id is handled by backend WebSocket authentication
            }));
        }
    }

    setupTypingListeners() {
        const input = document.getElementById('messageInput');
        if (!input) return;

        // ✅ Gửi typing indicator khi bắt đầu gõ
        input.addEventListener('input', () => {
            if (this.chatWebSocket) {
                this.sendTypingIndicator();
            }
        });

        // ✅ Gửi stop typing khi input mất focus
        input.addEventListener('blur', () => {
            if (this.chatWebSocket) {
                this.sendStopTypingIndicator();
            }
        });

        // ✅ Gửi stop typing khi nhấn Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.chatWebSocket) {
                this.sendStopTypingIndicator();
            }
        });
    }

    addMessageToChat(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Kiểm tra message object có đúng cấu trúc không
        if (!message || typeof message !== 'object') {
            console.error('🔍 Chat - Invalid message object:', message);
            return;
        }
        
        // Kiểm tra các trường bắt buộc
        if (!message.content || !message.user_id || !message.timestamp) {
            console.error('🔍 Chat - Message missing required fields:', message);
            return;
        }
        
        // Kiểm tra currentUser có tồn tại không
        if (!this.app.currentUser || !this.app.currentUser.id) {
            console.error('🔍 Chat - Current user not available:', this.app.currentUser);
            return;
        }
        
        const messageDiv = document.createElement('div');
        const isOwnMessage = message.user_id === this.app.currentUser.id;
        
        messageDiv.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        messageDiv.innerHTML = `
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg chat-bubble ${
                isOwnMessage 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            }">
                <p class="text-sm">${this.app.escapeHtml ? this.app.escapeHtml(message.content) : message.content}</p>
                <p class="text-xs opacity-75 mt-1">${this.app.formatTime ? this.app.formatTime(message.timestamp) : message.timestamp}</p>
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

        // ✅ SỬA: Sử dụng logic mới thay vì showEndChatModal
        console.log('🔍 Chat - User ended chat, resetting state...');
        this.resetChatState();
    }

    async keepActive() {
        if (!this.app.currentRoom) return;

        try {
            // Gọi method thống nhất để xử lý giữ hoạt động
            await this.handleKeepActiveRequest();
        } catch (error) {
            console.error('Keep active error:', error);
        }
    }
    
    async handleKeepActiveRequest() {
        // Method thống nhất để xử lý giữ hoạt động - được gọi từ cả 2 nút
        try {
            // Kiểm tra token trước khi gửi request
            const token = localStorage.getItem('access_token');
            if (!token) {
                console.error('❌ No access token found');
                this.showToast('Vui lòng đăng nhập lại', 'error');
                this.app.authModule.logout();
                return;
            }
            
            console.log('🔍 Sending keep active request to room:', this.app.currentRoom.id);
            console.log('🔍 Token exists:', !!token);
            
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
                
                // Cập nhật UI ngay lập tức
                this.updateKeepActiveButton();
                
                // Ẩn countdown
                this.hideCountdownTimer();
                
                // Xử lý kết quả
                if (result.room_kept) {
                    this.showToast(result.message, 'success');
                } else if (result.waiting_for_other) {
                    this.showToast(result.message, 'info');
                }
            } else if (response.status === 401) {
                // Token hết hạn hoặc không hợp lệ
                console.error('❌ Authentication failed - token expired or invalid');
                this.showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
                this.app.authModule.logout();
            } else {
                const error = await response.text();
                console.error('❌ Keep active request failed:', response.status, error);
                this.showToast('Lỗi gửi yêu cầu giữ hoạt động', 'error');
            }
        } catch (error) {
            console.error('❌ Error sending keep active request:', error);
            this.showToast('Lỗi kết nối', 'error');
        }
    }
    
    updateKeepActiveButton() {
        // Cập nhật trạng thái nút giữ hoạt động
        const keepActiveBtn = document.getElementById('keepActive');
        if (keepActiveBtn) {
            keepActiveBtn.textContent = 'Đã giữ hoạt động';
            keepActiveBtn.disabled = true;
            keepActiveBtn.style.background = '#10B981'; // Màu xanh lá
            keepActiveBtn.style.cursor = 'not-allowed';
        }
    }
    
    showToast(message, type = 'info') {
        // Hiển thị toast notification
        // Sử dụng toast từ simple_countdown_module nếu có
        if (this.app.simpleCountdownModule && this.app.simpleCountdownModule.showToast) {
            this.app.simpleCountdownModule.showToast(message, type);
        } else {
            // Fallback toast đơn giản
            console.log(`Toast (${type}): ${message}`);
        }
    }
    
    resetKeepActiveButton() {
        // Reset trạng thái nút giữ hoạt động về ban đầu
        const keepActiveBtn = document.getElementById('keepActive');
        if (keepActiveBtn) {
            keepActiveBtn.textContent = 'Giữ hoạt động';
            keepActiveBtn.disabled = false;
            keepActiveBtn.style.background = ''; // Reset màu
            keepActiveBtn.style.cursor = ''; // Reset cursor
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

    debug() {
        console.log('🔍 Chat - Debug info:');
        console.log('  - Current user:', this.app.currentUser);
        console.log('  - Current room:', this.app.currentRoom);
        console.log('  - Pending connection:', this.app.pendingChatConnection);
        console.log('  - Status WebSocket:', this.websocket?.readyState);
        console.log('  - Chat WebSocket:', this.chatWebSocket?.readyState);
        console.log('  - Room ended flag:', this.roomEnded);  // ✅ THÊM: Hiển thị flag
        console.log('  - DOM elements:');
        console.log('    - Chat room:', document.getElementById('chatRoom')?.classList.contains('hidden'));
        console.log('    - Waiting room:', document.getElementById('waitingRoom')?.classList.contains('hidden'));
        console.log('    - Searching:', document.getElementById('searching')?.classList.contains('hidden'));
    }
    
    testRestore() {
        console.log('🔍 Chat - Testing restore chat state...');
        this.debug();
        this.restoreChatState();
    }
    
    // ✅ THÊM: Method test cho logic mới
    testRoomEndedLogic() {
        console.log('🔍 Chat - Testing room ended logic...');
        console.log('🔍 Chat - Current state before test:');
        this.debug();
        
        // Simulate room ended notification
        const testData = {
            message: 'Test: Phòng chat đã được kết thúc',
            room_id: this.app.currentRoom?.id || 999
        };
        
        console.log('🔍 Chat - Simulating room ended notification:', testData);
        this.handleRoomEndedByUser(testData);
        
        console.log('🔍 Chat - State after test:');
        this.debug();
        
        // ✅ THÊM: Test restoreChatState với flag
        console.log('🔍 Chat - Testing restoreChatState with room ended flag...');
        this.restoreChatState();
    }
    
    // ✅ THÊM: Method test cho logic kiểm tra room status từ backend
    async testRoomStatusCheck() {
        console.log('🔍 Chat - Testing room status check from backend...');
        
        if (!this.app.currentUser || !this.app.currentUser.current_room_id) {
            console.log('🔍 Chat - No current room to test');
            return;
        }
        
        try {
            const response = await fetch(`/chat/room/${this.app.currentUser.current_room_id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            
            if (response.ok) {
                const roomData = await response.json();
                console.log('🔍 Chat - Room status from backend:', roomData);
                
                if (roomData.end_time) {
                    console.log('🔍 Chat - Room has ended in backend');
                } else {
                    console.log('🔍 Chat - Room is still active in backend');
                }
            } else {
                console.log('🔍 Chat - Failed to get room status:', response.status);
            }
        } catch (error) {
            console.error('🔍 Chat - Error testing room status check:', error);
        }
    }
}

// Make ChatModule globally accessible
window.ChatModule = ChatModule;

// Add debug methods to global scope for testing
window.debugChat = () => {
    if (window.mapmoApp && window.mapmoApp.chatModule) {
        window.mapmoApp.chatModule.debug();
    } else {
        console.log('🔍 Chat - MapmoApp or ChatModule not available');
    }
};

window.testRestore = () => {
    if (window.mapmoApp && window.mapmoApp.chatModule) {
        window.mapmoApp.chatModule.testRestore();
    } else {
        console.log('🔍 Chat - MapmoApp or ChatModule not available');
    }
};

// ✅ THÊM: Test method cho logic mới
window.testRoomEndedLogic = () => {
    if (window.mapmoApp && window.mapmoApp.chatModule) {
        window.mapmoApp.chatModule.testRoomEndedLogic();
    } else {
        console.log('🔍 Chat - MapmoApp or ChatModule not available');
    }
};

// ✅ THÊM: Test method cho logic kiểm tra room status từ backend
window.testRoomStatusCheck = () => {
    if (window.mapmoApp && window.mapmoApp.chatModule) {
        window.mapmoApp.chatModule.testRoomStatusCheck();
    } else {
        console.log('🔍 Chat - MapmoApp or ChatModule not available');
    }
};
