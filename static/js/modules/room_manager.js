// Room Manager for chat room functionality
export class RoomManager {
    constructor(app) {
        this.app = app;
        this.roomEnded = false;
        this.isSearching = false;
        this.isRestoringState = false;
        this.lastSearchTime = 0;
        this.searchStartTime = null;
        this.searchTimeout = null;
        this.searchProgressInterval = null;
        this.maxSearchTime = 30000; // 30 seconds
        this.lastMatchRoomId = null;
        this.countdownStarted = false; // ✅ THÊM: Flag để tránh duplicate countdown
        this.searchPromise = null; // ✅ THÊM: Promise để tránh concurrent searches
    }

    async startSearch() {
        const now = Date.now();
        if (this.isSearching || (now - this.lastSearchTime < 3000)) {
            console.log('🏠 Room - Search already in progress or too soon, skipping');
            return;
        }
        
        // Additional check to prevent rapid successive calls
        if (this.searchPromise) {
            console.log('🏠 Room - Search promise already exists, waiting for completion');
            return this.searchPromise;
        }
        
        this.isSearching = true;
        this.lastSearchTime = now;
        this.searchStartTime = now;
        
        // Update user status to searching
        if (this.app.currentUser) {
            this.app.currentUser.status = 'searching';
        }
        
        // Create search promise to prevent concurrent searches
        this.searchPromise = this.performSearch();
        
        try {
            await this.searchPromise;
        } finally {
            this.searchPromise = null;
        }
    }
    
    async performSearch() {
        // Clear any existing timeout
        this.clearSearchTimeout();
        
        // Set search timeout
        this.searchTimeout = setTimeout(() => {
            this.handleSearchTimeout();
        }, this.maxSearchTime);
        
        // Start progress feedback
        this.startSearchProgress();
        
        await this.app.chatModule.refreshUserStatus();
        
        // Reset room ended flag for new search
        this.resetRoomEndedFlag();
        
        // Check pending chat connection first
        if (this.app.pendingChatConnection) {
            console.log('🏠 Room - Processing pending chat connection in startSearch');
            await this.app.chatModule.checkPendingChatConnection();
            this.isSearching = false;
            return;
        }
        
        // Check if user is already in chat room
        if (await this.app.chatModule.restoreChatState()) {
            console.log('🏠 Room - Chat state restored, no need to search');
            this.isSearching = false;
            return;
        }
        
        // If user already has room_id and status connected, redirect to chat
        if (this.app.currentUser && this.app.currentUser.status && 
            this.app.currentUser.status.toLowerCase() === 'connected' && 
            this.app.currentUser.current_room_id) {
            console.log('🏠 Room - User already connected to room, redirecting to chat...');
            this.app.currentRoom = { id: this.app.currentUser.current_room_id };
            this.app.chatModule.showChatRoomWithSync();
            // ✅ SỬA: Chỉ join room, không gọi connectChatWebSocket để tránh duplicate
            this.app.websocketManager.joinRoom(this.app.currentUser.current_room_id);
            this.isSearching = false;
            return;
        }
        
        try {
            const response = await this.app.chatModule.apiCallWithRetry('/chat/search', {
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
                    this.app.uiModule.showSearching();
                    this.app.websocketManager.connect();
                }
            } else {
                const error = await response.json();
                this.app.utilsModule.showError(error.detail || 'Không thể bắt đầu tìm kiếm');
            }
        } catch (error) {
            console.error('🏠 Room - Search error:', error);
            this.app.utilsModule.showError('Lỗi kết nối');
        } finally {
            this.isSearching = false;
            this.clearSearchTimeout();
            this.stopSearchProgress();
            
            // Reset user status if search failed
            if (this.app.currentUser && this.app.currentUser.status === 'searching') {
                this.app.currentUser.status = 'idle';
            }
        }
    }

    async cancelSearch() {
        try {
            this.clearSearchTimeout();
            this.stopSearchProgress();
            
            await fetch('/chat/cancel-search', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
        } catch (error) {
            console.error('🏠 Room - Cancel search error:', error);
        }
        
        this.app.websocketManager.disconnect();
        this.app.uiModule.showWaitingRoom();
    }

    handleSearchTimeout() {
        console.log('⏰ Room - Search timeout reached');
        
        // Reset user status
        if (this.app.currentUser && this.app.currentUser.status === 'searching') {
            this.app.currentUser.status = 'idle';
        }
        
        this.cancelSearch();
        this.app.utilsModule.showError('Không tìm thấy người chat. Vui lòng thử lại sau.');
    }

    clearSearchTimeout() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
    }

    startSearchProgress() {
        this.stopSearchProgress();
        
        this.searchProgressInterval = setInterval(() => {
            if (this.searchStartTime) {
                const elapsed = Date.now() - this.searchStartTime;
                const remaining = Math.max(0, this.maxSearchTime - elapsed);
                this.updateSearchProgress(remaining);
            }
        }, 1000);
    }

    stopSearchProgress() {
        if (this.searchProgressInterval) {
            clearInterval(this.searchProgressInterval);
            this.searchProgressInterval = null;
        }
    }

    updateSearchProgress(remainingMs) {
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const totalSeconds = Math.ceil(this.maxSearchTime / 1000);
        const elapsedSeconds = totalSeconds - remainingSeconds;
        
        const searchingElement = document.getElementById('searching');
        if (searchingElement) {
            const progressText = searchingElement.querySelector('.text-lg');
            if (progressText) {
                progressText.textContent = `Đang tìm kiếm người chat... (${elapsedSeconds}s/${totalSeconds}s)`;
            }
        }
        
        console.log(`🔍 Room - Search progress: ${elapsedSeconds}s/${totalSeconds}s (${remainingSeconds}s remaining)`);
    }

    async handleMatchFound(data) {
        console.log('🏠 Room - handleMatchFound called with data:', data);
        
        // Check duplicate match_found messages
        if (this.lastMatchRoomId === data.room_id) {
            console.log('🏠 Room - Duplicate match_found message ignored for room:', data.room_id);
            return;
        }
        
        // Check if already in chat room
        if (this.app.currentRoom && this.app.currentRoom.id === data.room_id) {
            console.log('🏠 Room - Already in room, ignoring match_found message');
            return;
        }
        
        this.lastMatchRoomId = data.room_id;
        
        // Clear search state when match found
        this.isSearching = false;
        this.clearSearchTimeout();
        this.stopSearchProgress();
        
        if (data.room_id && data.matched_user) {
            this.app.currentRoom = {
                id: data.room_id,
                matched_user: data.matched_user,
                icebreaker: data.icebreaker
            };
        } else if (data.room) {
            this.app.currentRoom = data.room;
        }
        
        // Reset room ended flag for new match
        this.roomEnded = false;
        console.log('🏠 Room - Room ended flag reset for new match');
        
        // Enter chat room using unified method
        await this.app.chatModule.enterChatRoom(this.app.currentRoom.id);
        
        // Start countdown flow after match - delay longer to ensure WebSocket connections are ready
        if (this.app.simpleCountdownModule && !this.countdownStarted) {
            this.countdownStarted = true; // ✅ THÊM: Flag để tránh duplicate
            setTimeout(() => {
                console.log('🏠 Room - Starting countdown after match, room ID:', this.app.currentRoom.id);
                this.app.simpleCountdownModule.startCountdown(this.app.currentRoom.id);
            }, 3000); // Tăng delay lên 3 giây
        }
    }

    async endChat() {
        if (!this.app.currentRoom) {
            console.log('🏠 Room - No current room to end');
            return;
        }

        const roomId = this.app.currentRoom.id;
        console.log('🏠 Room - Ending chat for room:', roomId);

        try {
            this.app.chatModule.showLoadingState('Đang kết thúc phòng chat...');

            const response = await fetch(`/chat/end/${roomId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('🏠 Room - Room ended successfully:', data);
                this.app.chatModule.showToast('Phòng chat đã được kết thúc', 'success');
            } else {
                const errorData = await response.json();
                console.error('🏠 Room - Failed to end room:', errorData);
                this.app.chatModule.showToast('Lỗi kết thúc phòng chat: ' + errorData.detail, 'error');
            }
        } catch (error) {
            console.error('🏠 Room - End chat error:', error);
            this.app.chatModule.showToast('Lỗi kết nối khi kết thúc phòng chat', 'error');
        } finally {
            this.app.chatModule.hideLoadingState();
            console.log('🏠 Room - Resetting chat state after end chat...');
            this.app.chatModule.resetChatState();
        }
    }

    resetRoomEndedFlag() {
        if (this.roomEnded) {
            console.log('🏠 Room - Resetting room ended flag for new search');
            this.roomEnded = false;
        }
    }

    clearSearchState() {
        this.isSearching = false;
        this.clearSearchTimeout();
        this.stopSearchProgress();
        console.log('🏠 Room - Search state cleared');
    }

    getStatus() {
        return {
            roomEnded: this.roomEnded,
            isSearching: this.isSearching,
            isRestoringState: this.isRestoringState,
            lastSearchTime: this.lastSearchTime,
            searchStartTime: this.searchStartTime,
            lastMatchRoomId: this.lastMatchRoomId
        };
    }
}
