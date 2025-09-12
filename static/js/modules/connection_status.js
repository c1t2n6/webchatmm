// Connection Status Manager
export class ConnectionStatus {
    constructor(app) {
        this.app = app;
    }

    checkConnectionStatus() {
        const status = {
            websocket: this.app.websocketManager ? this.app.websocketManager.isConnected() : false,
            user: !!this.app.currentUser,
            room: !!this.app.currentRoom,
            token: !!localStorage.getItem('access_token')
        };
        
        console.log('🔍 Status - Connection status:', status);
        
        // Display status for user
        let statusMessage = '';
        if (status.websocket && status.user && status.room && status.token) {
            statusMessage = '✅ Kết nối ổn định - Có thể gửi tin nhắn';
        } else if (!status.websocket) {
            statusMessage = '❌ Mất kết nối WebSocket - Đang thử kết nối lại...';
        } else if (!status.user) {
            statusMessage = '❌ Chưa đăng nhập - Vui lòng đăng nhập lại';
        } else if (!status.room) {
            statusMessage = '❌ Chưa vào phòng chat - Vui lòng tìm kiếm người chat';
        } else if (!status.token) {
            statusMessage = '❌ Token hết hạn - Vui lòng đăng nhập lại';
        }
        
        if (statusMessage) {
            this.showToast(statusMessage, status.websocket && status.user && status.room && status.token ? 'success' : 'error');
        }
        
        return status;
    }

    showToast(message, type = 'info') {
        // Use toast from simple_countdown_module if available
        if (this.app.simpleCountdownModule && this.app.simpleCountdownModule.showToast) {
            this.app.simpleCountdownModule.showToast(message, type);
        } else {
            // Fallback toast
            console.log(`Toast (${type}): ${message}`);
            this.showSimpleToast(message, type);
        }
    }

    showSimpleToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'info' ? 'bg-blue-500 text-white' :
            'bg-gray-500 text-white'
        }`;
        toast.textContent = message;
        
        // Add to DOM
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    async checkRoomStatusOnDisconnect() {
        if (!this.app.currentRoom || !this.app.currentUser) {
            console.log('🔍 Status - No current room or user, skipping status check');
            return;
        }

        try {
            console.log('🔍 Status - Checking room status after disconnect...');
            const response = await fetch('/chat/check-room-status', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('🔍 Status - Room status check result:', data);
                
                if (data.status === 'no_active_room' || !data.room_id) {
                    console.log('🔍 Status - Room no longer active, returning to waiting room');
                    this.showToast('Phòng chat đã kết thúc', 'info');
                    this.app.chatModule.resetChatState();
                } else {
                    console.log('🔍 Status - Room still active, will reconnect');
                }
            } else {
                console.log('🔍 Status - Failed to check room status, assuming room ended');
                this.showToast('Phòng chat đã kết thúc', 'info');
                this.app.chatModule.resetChatState();
            }
        } catch (error) {
            console.error('🔍 Status - Error checking room status:', error);
            console.log('🔍 Status - Assuming room ended due to error');
            this.showToast('Phòng chat đã kết thúc', 'info');
            this.app.chatModule.resetChatState();
        }
    }

    async syncRoomStateWithBackend() {
        if (!this.app.currentUser || !this.app.currentUser.current_room_id) {
            console.log('🔍 Status - No current room to sync');
            return;
        }
        
        try {
            const response = await fetch(`/chat/room/${this.app.currentUser.current_room_id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            
            if (response.ok) {
                const roomData = await response.json();
                console.log('🔍 Status - Room state from backend:', roomData);
                
                if (roomData.end_time) {
                    console.log('🔍 Status - Room has ended in backend, resetting state');
                    this.app.currentUser.current_room_id = null;
                    this.app.currentUser.status = 'idle';
                    this.app.currentRoom = null;
                    this.app.roomManager.roomEnded = true;
                    this.app.uiModule.showWaitingRoom();
                } else {
                    console.log('🔍 Status - Room is active in backend, syncing state');
                    this.app.currentRoom = {
                        id: roomData.id,
                        matched_user: roomData.matched_user,
                        icebreaker: roomData.icebreaker
                    };
                }
            } else {
                console.log('🔍 Status - Failed to get room state from backend:', response.status);
            }
        } catch (error) {
            console.error('🔍 Status - Error syncing room state with backend:', error);
        }
    }

    async startRoomStatusCheck() {
        // Clear existing interval
        if (this.roomStatusCheckInterval) {
            clearInterval(this.roomStatusCheckInterval);
        }
        
        // Check room status every 5 seconds
        this.roomStatusCheckInterval = setInterval(async () => {
            if (!this.app.currentRoom || !this.app.currentUser) {
                console.log('🔍 Status - No current room or user, stopping status check');
                clearInterval(this.roomStatusCheckInterval);
                this.roomStatusCheckInterval = null;
                return;
            }
            
            try {
                const response = await fetch('/chat/check-room-status', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'no_active_room' || !data.room_id) {
                        console.log('🔍 Status - Room no longer active, returning to waiting room');
                        this.showToast('Phòng chat đã kết thúc', 'info');
                        this.app.chatModule.resetChatState();
                    }
                } else {
                    // If API fails, assume room ended
                    console.log('🔍 Status - Room status check failed, assuming room ended');
                    this.showToast('Phòng chat đã kết thúc', 'info');
                    this.app.chatModule.resetChatState();
                }
            } catch (error) {
                console.error('🔍 Status - Error checking room status:', error);
                // Don't reset on network errors, just log
            }
        }, 5000);
        
        console.log('🔍 Status - Started periodic room status check');
    }

    stopRoomStatusCheck() {
        if (this.roomStatusCheckInterval) {
            clearInterval(this.roomStatusCheckInterval);
            this.roomStatusCheckInterval = null;
            console.log('🔍 Status - Stopped periodic room status check');
        }
    }
}
