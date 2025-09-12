// Debug Tools for chat functionality
export class DebugTools {
    constructor(app) {
        this.app = app;
    }

    debug() {
        console.log('🔍 Debug - Chat debug info:');
        console.log('  - Current user:', this.app.currentUser);
        console.log('  - Current room:', this.app.currentRoom);
        console.log('  - Pending connection:', this.app.pendingChatConnection);
        console.log('  - WebSocket:', this.app.websocketManager?.isConnected());
        console.log('  - Room ended flag:', this.app.roomManager?.roomEnded);
        console.log('  - DOM elements:');
        console.log('    - Chat room:', document.getElementById('chatRoom')?.classList.contains('hidden'));
        console.log('    - Waiting room:', document.getElementById('waitingRoom')?.classList.contains('hidden'));
        console.log('    - Searching:', document.getElementById('searching')?.classList.contains('hidden'));
    }

    logEvent(event, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: event,
            data: data,
            user: this.app.currentUser?.id || 'unknown',
            room: this.app.currentRoom?.id || 'none',
            websocket: this.app.websocketManager?.isConnected() || false
        };
        
        console.log(`🔍 Debug - Event: ${event}`, logEntry);
        
        // Store in localStorage for debugging
        try {
            const logs = JSON.parse(localStorage.getItem('chat_logs') || '[]');
            logs.push(logEntry);
            
            // Keep only last 100 logs
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            localStorage.setItem('chat_logs', JSON.stringify(logs));
        } catch (error) {
            console.error('🔍 Debug - Error storing log:', error);
        }
    }

    getLogs() {
        try {
            return JSON.parse(localStorage.getItem('chat_logs') || '[]');
        } catch (error) {
            console.error('🔍 Debug - Error getting logs:', error);
            return [];
        }
    }

    clearLogs() {
        localStorage.removeItem('chat_logs');
        console.log('🔍 Debug - Logs cleared');
    }

    startPerformanceTimer(name) {
        this.performanceTimers = this.performanceTimers || {};
        this.performanceTimers[name] = Date.now();
    }

    endPerformanceTimer(name) {
        if (this.performanceTimers && this.performanceTimers[name]) {
            const duration = Date.now() - this.performanceTimers[name];
            console.log(`🔍 Debug - Performance: ${name} took ${duration}ms`);
            this.logEvent('performance', { name, duration });
            delete this.performanceTimers[name];
        }
    }

    healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            websocket: this.app.websocketManager?.isConnected() || false,
            user: !!this.app.currentUser,
            room: !!this.app.currentRoom,
            roomEnded: this.app.roomManager?.roomEnded || false,
            isSearching: this.app.roomManager?.isSearching || false,
            isRestoringState: this.app.roomManager?.isRestoringState || false,
            reconnectAttempts: this.app.websocketManager?.reconnectAttempts || 0,
            maxReconnectAttempts: this.app.websocketManager?.maxReconnectAttempts || 0
        };
        
        console.log('🔍 Debug - Health check:', health);
        this.logEvent('health_check', health);
        
        return health;
    }

    testRestore() {
        console.log('🔍 Debug - Testing restore chat state...');
        this.debug();
        this.app.chatModule.restoreChatState();
    }

    testRoomEndedLogic() {
        console.log('🔍 Debug - Testing room ended logic...');
        console.log('🔍 Debug - Current state before test:');
        this.debug();
        
        // Simulate room ended notification
        const testData = {
            message: 'Test: Phòng chat đã được kết thúc',
            room_id: this.app.currentRoom?.id || 999
        };
        
        console.log('🔍 Debug - Simulating room ended notification:', testData);
        this.app.chatModule.handleRoomEndedByUser(testData);
        
        console.log('🔍 Debug - State after test:');
        this.debug();
        
        // Test restoreChatState with flag
        console.log('🔍 Debug - Testing restoreChatState with room ended flag...');
        this.app.chatModule.restoreChatState();
    }

    async testRoomStatusCheck() {
        console.log('🔍 Debug - Testing room status check from backend...');
        
        if (!this.app.currentUser || !this.app.currentUser.current_room_id) {
            console.log('🔍 Debug - No current room to test');
            return;
        }
        
        try {
            const response = await fetch(`/chat/room/${this.app.currentUser.current_room_id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            
            if (response.ok) {
                const roomData = await response.json();
                console.log('🔍 Debug - Room status from backend:', roomData);
                
                if (roomData.end_time) {
                    console.log('🔍 Debug - Room has ended in backend');
                } else {
                    console.log('🔍 Debug - Room is still active in backend');
                }
            } else {
                console.log('🔍 Debug - Failed to get room status:', response.status);
            }
        } catch (error) {
            console.error('🔍 Debug - Error testing room status check:', error);
        }
    }

    testSendMessage() {
        if (this.app.messageHandler) {
            const input = document.getElementById('messageInput');
            if (input) {
                input.value = 'Test message - ' + new Date().toLocaleTimeString();
                this.app.messageHandler.sendMessage();
            } else {
                console.log('🔍 Debug - Message input not found');
            }
        } else {
            console.log('🔍 Debug - MessageHandler not available');
        }
    }


    checkWebSocketConnections() {
        console.log('🔍 Debug - WebSocket status:');
        console.log('  - Connected:', this.app.websocketManager?.isConnected());
        console.log('  - Ready to send:', this.app.websocketManager?.isReadyToSend());
        console.log('  - WebSocket object:', this.app.websocketManager?.websocket);
        console.log('  - Current room:', this.app.currentRoom);
        
        // Check for multiple Socket.IO instances
        if (window.io) {
            console.log('🔍 Debug - Socket.IO instances:', window.io.instances || 'Unknown');
        }
    }

    // Setup global debug functions
    setupGlobalDebugFunctions() {
        // Make debug functions globally available
        window.debugChat = () => this.debug();
        window.testRestore = () => this.testRestore();
        window.testRoomEndedLogic = () => this.testRoomEndedLogic();
        window.testRoomStatusCheck = () => this.testRoomStatusCheck();
        window.checkConnectionStatus = () => this.app.connectionStatus?.checkConnectionStatus();
        window.testSendMessage = () => this.testSendMessage();
        window.checkWebSocketConnections = () => this.checkWebSocketConnections();
        window.getChatLogs = () => this.getLogs();
        window.clearChatLogs = () => this.clearLogs();
        window.healthCheck = () => this.healthCheck();
        
        console.log('🔍 Debug - Global debug functions setup complete');
        console.log('Available functions: debugChat, testRestore, testRoomEndedLogic, testRoomStatusCheck, checkConnectionStatus, testSendMessage, checkWebSocketConnections, getChatLogs, clearChatLogs, healthCheck');
    }
}
