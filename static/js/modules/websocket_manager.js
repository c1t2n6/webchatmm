// WebSocket Connection Manager
export class WebSocketManager {
    constructor(app) {
        this.app = app;
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isReconnecting = false;
    }

    connect() {
        // Debug: Track connection attempts
        const stack = new Error().stack;
        console.log('🔌 WebSocket - connect() called from:', stack.split('\n')[2]?.trim());
        
        // Prevent multiple connections
        if (this.websocket && this.websocket.connected) {
            console.log('🔌 WebSocket - Already connected, skipping');
            return;
        }

        if (this.websocket) {
            console.log('🔌 WebSocket - Closing existing connection');
            this.websocket.disconnect();
            this.websocket = null;
        }

        const token = localStorage.getItem('access_token');
        if (!token) {
            console.error('🔌 WebSocket - No access token found');
            this.app.utilsModule.showError('Vui lòng đăng nhập lại');
            return;
        }
        
        console.log('🔌 WebSocket - Connecting to server...');
        
        this.websocket = io({
            auth: { token: token },
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: false, // Change to false to reuse existing connection
            reconnection: false, // Disable auto-reconnection to prevent duplicates
            upgrade: true,
            rememberUpgrade: false
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.websocket.on('connect', () => {
            console.log('🔌 WebSocket - Connected successfully');
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            
            // Join status WebSocket
            this.websocket.emit('join-status');
            
            // Auto-join room if in one (but don't setup here, let caller handle it)
            if (this.app.currentRoom && this.app.currentRoom.id) {
                console.log('🔌 WebSocket - Auto-joining room:', this.app.currentRoom.id);
                this.websocket.emit('join-room', { roomId: this.app.currentRoom.id });
            }
        });

        this.websocket.on('message', (data) => {
            // Debug typing messages
            if (data.type === 'typing' || data.type === 'stop_typing') {
                console.log('🔌 WebSocket - Received typing message:', data);
            }
            // ATOMIC MESSAGE HANDLING - Direct pass, no logging spam
            this.app.chatModule.handleWebSocketMessage(data);
        });

        this.websocket.on('disconnect', (reason) => {
            console.log('🔌 WebSocket - Disconnected:', reason);
            if (reason !== 'io client disconnect' && !this.isReconnecting) {
                this.scheduleReconnection();
            }
            this.handleDisconnect();
        });

        this.websocket.on('connect_error', (error) => {
            console.error('🔌 WebSocket - Connection error:', error);
            if (!this.isReconnecting) {
                this.scheduleReconnection();
            }
        });
        
        this.websocket.on('error', (error) => {
            console.error('🔌 WebSocket - Error:', error);
            this.app.utilsModule.showError('Lỗi kết nối WebSocket');
        });
    }

    scheduleReconnection() {
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('🔌 WebSocket - Max reconnection attempts reached');
            return;
        }
        
        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        console.log(`🔌 WebSocket - Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (this.isReconnecting) {
                console.log(`🔌 WebSocket - Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                this.connect();
            }
        }, delay);
    }

    handleDisconnect() {
        console.log('🔌 WebSocket - Handling disconnect');
        // Notify app about disconnect
        if (this.app.chatModule) {
            this.app.chatModule.handleWebSocketDisconnect();
        }
    }

    joinRoom(roomId) {
        if (!this.websocket || !this.websocket.connected) {
            console.log('🔌 WebSocket - Not connected, cannot join room');
            return false;
        }

        console.log('🔌 WebSocket - Joining room:', roomId);
        this.websocket.emit('join-room', { roomId: roomId });
        return true;
    }

    sendMessage(messageData, callback) {
        if (!this.websocket || !this.websocket.connected) {
            console.log('🔌 WebSocket - Not connected, cannot send message');
            if (callback) callback({ status: 'error', message: 'Not connected' });
            return false;
        }

        // Debug typing messages
        if (messageData.type === 'typing' || messageData.type === 'stop_typing') {
            console.log('🔌 WebSocket - Sending typing message:', messageData);
        } else {
            console.log('🔌 WebSocket - Sending message:', messageData);
        }
        this.websocket.emit('message', messageData, callback);
        return true;
    }

    isConnected() {
        return this.websocket && this.websocket.connected;
    }

    disconnect() {
        if (this.websocket) {
            this.websocket.disconnect();
            this.websocket = null;
        }
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
    }

    getStatus() {
        return {
            connected: this.isConnected(),
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            isReconnecting: this.isReconnecting
        };
    }

    // Check if WebSocket is ready to send messages
    isReadyToSend() {
        return this.isConnected() && this.websocket && this.websocket.connected;
    }

    // Wait for WebSocket to be ready
    async waitForReady(timeout = 5000) {
        const startTime = Date.now();
        
        while (!this.isReadyToSend() && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return this.isReadyToSend();
    }
}
