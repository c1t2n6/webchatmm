/**
 * Keep Active State Manager - Centralized state management
 * Quản lý tập trung tất cả logic "giữ hoạt động" và notification
 */
export class KeepActiveStateManager {
    constructor(app) {
        this.app = app;
        
        // Centralized state
        this.state = {
            currentRoomId: null,
            userResponses: new Map(), // roomId -> { userId: response, timestamp }
            activeNotifications: new Set(), // Set of roomIds with active notifications
            keepActiveButtons: new Map(), // roomId -> button state
            lastSyncTime: 0,
            isOnline: navigator.onLine
        };
        
        // Cache settings
        this.cacheSettings = {
            maxAge: 30000, // 30 seconds
            syncInterval: 5000, // 5 seconds
            retryAttempts: 3,
            retryDelay: 1000
        };
        
        // Event listeners
        this.setupEventListeners();
        
        console.log('🔧 KeepActiveStateManager initialized');
    }
    
    /**
     * Setup event listeners for online/offline and storage sync
     */
    setupEventListeners() {
        // Online/offline detection
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.syncWithBackend();
            console.log('🔧 Network online, syncing state');
        });
        
        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            console.log('🔧 Network offline, using cached state');
        });
        
        // Storage change detection (for multi-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('keepActive_')) {
                this.handleStorageChange(e);
            }
        });
        
        // Periodic sync
        this.syncInterval = setInterval(() => {
            if (this.state.isOnline && this.state.currentRoomId && !this.state.roomEnded) {
                this.syncWithBackend();
            }
        }, this.cacheSettings.syncInterval);
    }
    
    /**
     * Set current room and initialize state
     */
    setCurrentRoom(roomId) {
        console.log('🔧 Setting current room:', roomId);
        this.state.currentRoomId = roomId;
        
        // Load cached state for this room
        this.loadCachedState(roomId);
        
        // Sync with backend
        this.syncWithBackend();
    }
    
    /**
     * Load cached state from localStorage
     */
    loadCachedState(roomId) {
        const cacheKey = `keepActive_${roomId}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
            try {
                const data = JSON.parse(cachedData);
                
                // Check if cache is still valid
                if (Date.now() - data.timestamp < this.cacheSettings.maxAge) {
                    console.log('🔧 Loading cached state for room:', roomId, data);
                    
                    // Restore user responses
                    if (data.userResponses) {
                        this.state.userResponses.set(roomId, data.userResponses);
                    }
                    
                    // Restore button state
                    if (data.buttonState) {
                        this.state.keepActiveButtons.set(roomId, data.buttonState);
                    }
                    
                    return true;
                } else {
                    console.log('🔧 Cache expired, clearing for room:', roomId);
                    localStorage.removeItem(cacheKey);
                }
            } catch (error) {
                console.error('🔧 Error parsing cached state:', error);
                localStorage.removeItem(cacheKey);
            }
        }
        
        return false;
    }
    
    /**
     * Save state to localStorage
     */
    saveCachedState(roomId) {
        const cacheKey = `keepActive_${roomId}`;
        const data = {
            roomId: roomId,
            userResponses: this.state.userResponses.get(roomId) || {},
            buttonState: this.state.keepActiveButtons.get(roomId) || {},
            timestamp: Date.now()
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(data));
        console.log('🔧 State cached for room:', roomId, data);
    }
    
    /**
     * Check if user has already kept active for current room
     */
    hasUserKeptActive(roomId = null) {
        const targetRoomId = roomId || this.state.currentRoomId;
        if (!targetRoomId) return false;
        
        const currentUserId = this.getCurrentUserId();
        if (!currentUserId) return false;
        
        const roomResponses = this.state.userResponses.get(targetRoomId);
        if (!roomResponses) return false;
        
        const userResponse = roomResponses[currentUserId];
        return userResponse && userResponse.response === 'yes';
    }
    
    /**
     * Get current user ID from multiple sources
     */
    getCurrentUserId() {
        // Try app.currentUser first
        if (this.app?.currentUser?.id) {
            return this.app.currentUser.id;
        }
        
        // Try localStorage
        const userData = localStorage.getItem('user_data');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                return user.id;
            } catch (e) {
                console.warn('🔧 Could not parse user data from localStorage');
            }
        }
        
        // Try token
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.user_id;
            } catch (e) {
                console.warn('🔧 Could not parse user ID from token');
            }
        }
        
        return null;
    }
    
    /**
     * Record user response
     */
    async recordUserResponse(roomId, response) {
        console.log('🔧 Recording user response:', { roomId, response });
        
        const currentUserId = this.getCurrentUserId();
        if (!currentUserId) {
            throw new Error('No current user ID available');
        }
        
        // Update local state
        if (!this.state.userResponses.has(roomId)) {
            this.state.userResponses.set(roomId, {});
        }
        
        this.state.userResponses.get(roomId)[currentUserId] = {
            response: response,
            timestamp: Date.now()
        };
        
        // Update button state
        this.state.keepActiveButtons.set(roomId, {
            hasResponded: true,
            response: response,
            timestamp: Date.now()
        });
        
        // Save to cache
        this.saveCachedState(roomId);
        
        // Sync with backend
        await this.syncWithBackend();
        
        console.log('🔧 User response recorded successfully');
    }
    
    /**
     * Check if notification should be shown for user
     */
    shouldShowNotification(roomId, usersToNotify = []) {
        console.log('🔧 Checking if should show notification:', { roomId, usersToNotify });
        
        // If no users specified, show for all
        if (!usersToNotify || usersToNotify.length === 0) {
            return !this.hasUserKeptActive(roomId);
        }
        
        const currentUserId = this.getCurrentUserId();
        if (!currentUserId) {
            console.log('🔧 No current user ID, showing notification');
            return true;
        }
        
        // Check if current user is in the list and hasn't responded
        const shouldShow = usersToNotify.includes(parseInt(currentUserId)) && 
                          !this.hasUserKeptActive(roomId);
        
        console.log('🔧 Should show notification:', shouldShow);
        return shouldShow;
    }
    
    /**
     * Update keep active button state
     */
    updateKeepActiveButton(roomId = null) {
        const targetRoomId = roomId || this.state.currentRoomId;
        if (!targetRoomId) return;
        
        // Kiểm tra xem user đã kept active chưa
        const hasKeptActive = this.hasUserKeptActive(targetRoomId);
        
        const keepActiveBtn = document.getElementById('keepActive');
        if (keepActiveBtn) {
            if (hasKeptActive) {
                keepActiveBtn.textContent = 'Đã giữ hoạt động';
                keepActiveBtn.disabled = true;
                keepActiveBtn.style.background = '#10B981';
                keepActiveBtn.style.cursor = 'not-allowed';
                console.log('🔧 Keep active button updated (kept active) for room:', targetRoomId);
            } else {
                keepActiveBtn.textContent = 'Giữ hoạt động';
                keepActiveBtn.disabled = false;
                keepActiveBtn.style.background = '';
                keepActiveBtn.style.cursor = '';
                console.log('🔧 Keep active button updated (not kept active) for room:', targetRoomId);
            }
        }
    }
    
    /**
     * Reset keep active button
     */
    resetKeepActiveButton(roomId = null) {
        const targetRoomId = roomId || this.state.currentRoomId;
        if (!targetRoomId) return;
        
        // Clear button state
        this.state.keepActiveButtons.delete(targetRoomId);
        
        const keepActiveBtn = document.getElementById('keepActive');
        if (keepActiveBtn) {
            keepActiveBtn.textContent = 'Giữ hoạt động';
            keepActiveBtn.disabled = false;
            keepActiveBtn.style.background = '';
            keepActiveBtn.style.cursor = '';
            
            console.log('🔧 Keep active button reset for room:', targetRoomId);
        }
    }
    
    /**
     * Sync with backend
     */
    async syncWithBackend() {
        if (!this.state.currentRoomId || !this.state.isOnline) {
            return;
        }
        
        try {
            console.log('🔧 Syncing with backend for room:', this.state.currentRoomId);
            
            const response = await this.apiCallWithRetry(
                `/simple-countdown/status/${this.state.currentRoomId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                }
            );
            
            if (response.ok) {
                const status = await response.json();
                console.log('🔧 Backend status:', status);
                
                // Update local state based on backend
                this.updateStateFromBackend(status);
                
                this.state.lastSyncTime = Date.now();
            }
        } catch (error) {
            console.error('🔧 Error syncing with backend:', error);
        }
    }
    
    /**
     * Update local state from backend response
     */
    updateStateFromBackend(status) {
        if (status.phase === 'notification' && status.users_to_notify) {
            // Check if we should show notification
            if (this.shouldShowNotification(this.state.currentRoomId, status.users_to_notify)) {
                this.state.activeNotifications.add(this.state.currentRoomId);
            } else {
                this.state.activeNotifications.delete(this.state.currentRoomId);
            }
        } else {
            this.state.activeNotifications.delete(this.state.currentRoomId);
        }
    }
    
    /**
     * API call with retry mechanism
     */
    async apiCallWithRetry(url, options, maxRetries = null) {
        const retries = maxRetries || this.cacheSettings.retryAttempts;
        
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                
                if (i === retries - 1) throw new Error('Max retries reached');
                
                await new Promise(resolve => 
                    setTimeout(resolve, this.cacheSettings.retryDelay * (i + 1))
                );
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(`🔧 API call failed, retrying in ${this.cacheSettings.retryDelay * (i + 1)}ms...`);
            }
        }
    }
    
    /**
     * Handle storage change from other tabs
     */
    handleStorageChange(event) {
        if (event.key.startsWith('keepActive_')) {
            const roomId = event.key.replace('keepActive_', '');
            
            if (roomId === this.state.currentRoomId?.toString()) {
                console.log('🔧 Storage changed for current room, reloading state');
                this.loadCachedState(roomId);
            }
        }
    }
    
    /**
     * Clear state for room
     */
    clearRoomState(roomId) {
        console.log('🔧 Clearing state for room:', roomId);
        
        this.state.userResponses.delete(roomId);
        this.state.activeNotifications.delete(roomId);
        this.state.keepActiveButtons.delete(roomId);
        
        // Clear from localStorage
        localStorage.removeItem(`keepActive_${roomId}`);
        
        // Reset button
        this.resetKeepActiveButton(roomId);
        
        // Stop sync interval if this is the current room
        if (this.state.currentRoomId === roomId) {
            this.state.roomEnded = true;
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
        }
    }
    
    /**
     * Get current state for debugging
     */
    getState() {
        return {
            currentRoomId: this.state.currentRoomId,
            userResponses: Object.fromEntries(this.state.userResponses),
            activeNotifications: Array.from(this.state.activeNotifications),
            keepActiveButtons: Object.fromEntries(this.state.keepActiveButtons),
            lastSyncTime: this.state.lastSyncTime,
            isOnline: this.state.isOnline
        };
    }
}
