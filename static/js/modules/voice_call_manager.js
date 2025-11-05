// Voice Call Manager - Frontend WebRTC Implementation
export class VoiceCallManager {
    constructor(app, webSocketManager) {
        this.app = app;
        this.webSocketManager = webSocketManager;
        
        // Enhanced WebRTC Configuration
        this.rtcConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 20, // More candidates for better connectivity
            iceTransportPolicy: 'all', // Allow both UDP and TCP
            bundlePolicy: 'max-bundle', // Bundle all media streams
            rtcpMuxPolicy: 'require', // Require RTCP multiplexing
            // Enhanced audio codec preferences
            sdpSemantics: 'unified-plan'
        };
        
        // Audio Processing
        this.audioContext = null;
        this.audioProcessor = null;
        this.noiseSuppression = true;
        this.echoCancellation = true;
        this.autoGainControl = true;
        
        // State Management
        this.currentCall = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isCallActive = false;
        this.isMuted = false;
        this.callStartTime = null;
        this.callTimer = null;
        
        // Audio Elements
        this.remoteAudio = null;
        this.ringtone = null;
        
        // Connection Quality Monitoring
        this.connectionMonitor = null;
        this.connectionStats = {
            audioLevel: 0,
            packetLoss: 0,
            latency: 0,
            jitter: 0,
            quality: 'good'
        };
        this.qualityHistory = [];
        
        // Auto Reconnection
        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 3;
        this.reconnectionTimeout = null;
        this.isReconnecting = false;
        
        // ✅ NEW: Cleanup guard to prevent race conditions
        this.isCleaningUp = false;
        
        // Call States
        this.CALL_STATES = {
            IDLE: 'idle',
            CALLING: 'calling',
            RINGING: 'ringing',
            CONNECTING: 'connecting',
            ACTIVE: 'active',
            ENDING: 'ending'
        };
        this.callState = this.CALL_STATES.IDLE;
        
        // Initialize
        this.init();
    }

    async init() {
        console.log('📞 Initializing VoiceCallManager...');
        
        try {
            // Wait for WebSocket to be ready with timeout
            await this.waitForWebSocket(10000); // 10 second timeout
            
            // Create audio elements
            this.createAudioElements();
            
            // Setup UI components
            this.createUIComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup WebSocket listeners
            this.setupWebSocketListeners();
            
            // Load user settings
            await this.loadUserSettings();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('✅ VoiceCallManager initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing VoiceCallManager:', error);
            this.handleInitError(error);
        }
    }
    
    async waitForWebSocket(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkWebSocket = () => {
                if (this.webSocketManager && this.webSocketManager.isConnected()) {
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    reject(new Error('WebSocket connection timeout'));
                    return;
                }
                
                setTimeout(checkWebSocket, 100);
            };
            
            checkWebSocket();
        });
    }
    
    handleInitError(error) {
        console.error('❌ VoiceCallManager init error:', error);
        
        // Show user-friendly error message
        if (this.app.utilsModule) {
            this.app.utilsModule.showError('Không thể khởi tạo voice call. Vui lòng tải lại trang.');
        }
        
        // Retry initialization after delay
        setTimeout(() => {
            console.log('🔄 Retrying VoiceCallManager initialization...');
            this.init();
        }, 5000);
    }

    // === AUDIO SETUP ===

    createAudioElements() {
        // Check if we're in a browser environment
        if (typeof document === 'undefined') {
            console.warn('⚠️ Not in browser environment, skipping audio elements creation');
            return;
        }

        // Remote audio element
        this.remoteAudio = document.createElement('audio');
        this.remoteAudio.autoplay = true;
        this.remoteAudio.playsInline = true;
        this.remoteAudio.controls = false;
        document.body.appendChild(this.remoteAudio);

        // Ringtone element
        this.ringtone = document.createElement('audio');
        this.ringtone.loop = true;
        this.ringtone.preload = 'auto';
        this.ringtone.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZCz2V2+/Da';
        document.body.appendChild(this.ringtone);
    }

    // === UI COMPONENTS ===

    createUIComponents() {
        // Call Panel
        const callPanel = document.createElement('div');
        callPanel.id = 'voice-call-panel';
        callPanel.className = 'voice-call-panel hidden';
        callPanel.innerHTML = `
            <div class="call-info">
                <div class="caller-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="caller-name">Kết nối...</div>
                <div class="call-status">Đang thiết lập kết nối</div>
                <div class="call-timer">00:00</div>
                
                <!-- Enhanced Quality Indicators -->
                <div class="call-quality-indicators">
                    <div class="call-quality-indicator good">
                        <i class="fas fa-signal"></i>
                        <span class="quality-text">Chất lượng tốt</span>
                    </div>
                    <div class="audio-level-indicator">
                        <div class="level-bar">
                            <div class="level-fill" style="width: 0%"></div>
                        </div>
                        <span class="level-text">Âm thanh</span>
                    </div>
                </div>
            </div>
            
            <div class="audio-visualizer hidden">
                ${Array(20).fill().map(() => '<div class="audio-bar"></div>').join('')}
            </div>
            
            <div class="call-controls">
                <button id="mute-btn" class="control-btn mute" title="Tắt/bật micro">
                    <i class="fas fa-microphone"></i>
                </button>
                <button id="speaker-btn" class="control-btn speaker" title="Loa">
                    <i class="fas fa-volume-up"></i>
                </button>
                <button id="settings-btn" class="control-btn settings" title="Cài đặt">
                    <i class="fas fa-cog"></i>
                </button>
                <button id="hangup-btn" class="control-btn hangup" title="Kết thúc cuộc gọi">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        `;
        document.body.appendChild(callPanel);

        // Incoming Call Modal
        const incomingModal = document.createElement('div');
        incomingModal.id = 'incoming-call-modal';
        incomingModal.className = 'incoming-call-modal hidden';
        incomingModal.innerHTML = `
            <div class="call-modal-content">
                <div class="caller-info">
                    <div class="caller-avatar-large">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="caller-name-large">Cuộc gọi đến</div>
                    <div class="incoming-call-text">Đang có cuộc gọi đến...</div>
                </div>
                <div class="call-actions">
                    <button id="reject-call-btn" class="call-action-btn reject" title="Từ chối">
                        <i class="fas fa-phone-slash"></i>
                    </button>
                    <button id="accept-call-btn" class="call-action-btn accept" title="Nhận cuộc gọi">
                        <i class="fas fa-phone"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(incomingModal);

        // Call Settings Panel
        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'call-settings-panel';
        settingsPanel.className = 'call-settings-panel hidden';
        settingsPanel.innerHTML = `
            <div class="settings-header">
                <h3>Cài đặt cuộc gọi</h3>
            </div>
            <div class="settings-content">
                <!-- ✅ REMOVED: Auto-answer setting - not needed -->
                <div class="setting-group">
                    <label class="setting-label">Thông báo cuộc gọi</label>
                    <label class="setting-switch">
                        <input type="checkbox" id="call-notifications-setting" checked>
                        <span class="setting-slider"></span>
                    </label>
                </div>
                <!-- ✅ REMOVED: Quality settings - using auto-detect -->
                <!-- ✅ REMOVED: Max duration - using default 30s timeout -->
            </div>
            <div class="settings-actions">
                <button id="cancel-settings-btn" class="settings-btn secondary">Hủy</button>
                <button id="save-settings-btn" class="settings-btn primary">Lưu</button>
            </div>
        `;
        document.body.appendChild(settingsPanel);
    }

    // === EVENT LISTENERS ===

    setupEventListeners() {
        // Call Panel Controls
        document.getElementById('mute-btn')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('speaker-btn')?.addEventListener('click', () => this.toggleSpeaker());
        document.getElementById('settings-btn')?.addEventListener('click', () => this.showSettings());
        document.getElementById('hangup-btn')?.addEventListener('click', () => this.endCall());

        // Incoming Call Actions
        document.getElementById('accept-call-btn')?.addEventListener('click', () => this.acceptIncomingCall());
        document.getElementById('reject-call-btn')?.addEventListener('click', () => this.rejectIncomingCall());

        // Settings Actions
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('cancel-settings-btn')?.addEventListener('click', () => this.hideSettings());

        // Click outside to close settings
        document.getElementById('call-settings-panel')?.addEventListener('click', (e) => {
            if (e.target.id === 'call-settings-panel') {
                this.hideSettings();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isCallActive) {
                switch (e.key) {
                    case 'm':
                    case 'M':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            this.toggleMute();
                        }
                        break;
                    case 'Escape':
                        if (this.callState === this.CALL_STATES.RINGING) {
                            this.rejectIncomingCall();
                        }
                        break;
                    case 'Enter':
                        if (this.callState === this.CALL_STATES.RINGING) {
                            e.preventDefault();
                            this.acceptIncomingCall();
                        }
                        break;
                }
            }
        });
    }

    // === WEBSOCKET INTEGRATION ===

    setupWebSocketListeners() {
        if (!this.webSocketManager || !this.webSocketManager.websocket) {
            console.warn('⚠️ WebSocket not available for voice call');
            return;
        }

        const socket = this.webSocketManager.websocket;

        // ✅ NEW: Handle call initiation response (success or error)
        socket.on('voice_call_initiate_response', async (data) => {
            console.log('📞 Call initiation response:', data);
            if (data.success) {
                console.log('✅ Call initiated successfully:', data.data);
                // Call will proceed with voice_call_incoming event
            } else {
                console.error('❌ Call initiation failed:', data.error);
                // Handle error
                let errorMessage = 'Không thể kết nối cuộc gọi. Vui lòng thử lại.';
                if (data.error) {
                    if (typeof data.error === 'string') {
                        errorMessage = data.error;
                    } else if (data.error.message) {
                        errorMessage = data.error.message;
                    } else if (data.error.code === 'USERS_NOT_IN_SAME_ROOM') {
                        errorMessage = 'Không tìm thấy người chat. Vui lòng thử lại sau.';
                    } else if (data.error.code === 'USER_NOT_FOUND') {
                        errorMessage = 'Không tìm thấy người dùng.';
                    }
                }
                this.app.utilsModule.showError(errorMessage);
                // ✅ FIX: Cleanup call state on initiation error
                await this.cleanupCall();
                this.hideCallUI();
            }
        });

        // Incoming call
        socket.on('voice_call_incoming', (data) => {
            console.log('📞 Incoming call:', data);
            this.handleIncomingCall(data);
        });

        // Call accepted
        socket.on('voice_call_accepted', (data) => {
            console.log('📞 Call accepted:', data);
            this.handleCallAccepted(data);
        });

        // Call rejected
        socket.on('voice_call_rejected', (data) => {
            console.log('📞 Call rejected:', data);
            this.handleCallRejected(data);
        });

        // Call connected
        socket.on('voice_call_connected', (data) => {
            console.log('📞 Call connected:', data);
            this.onCallConnected();
        });

        // Call ended
        socket.on('voice_call_ended', (data) => {
            console.log('📞 Call ended:', data);
            this.handleCallEnded(data);
        });

        // WebRTC Signaling
        socket.on('webrtc_offer', (data) => {
            console.log('📡 WebRTC offer received:', data);
            this.handleWebRTCOffer(data);
        });

        socket.on('webrtc_answer', (data) => {
            console.log('📡 WebRTC answer received:', data);
            this.handleWebRTCAnswer(data);
        });

        socket.on('ice_candidate', (data) => {
            console.log('📡 ICE candidate received:', data);
            this.handleICECandidate(data);
        });

        // Call control events
        socket.on('user_muted', (data) => {
            this.handleRemoteUserMuted(data);
        });

        socket.on('user_unmuted', (data) => {
            this.handleRemoteUserUnmuted(data);
        });

        // Error handling
        socket.on('webrtc_error', (data) => {
            console.error('📡 WebRTC error:', data);
            this.app.utilsModule.showError(`Lỗi WebRTC: ${data.error}`);
        });

        // ✅ REMOVED: Voice call invitation events - using direct call system

        // Optional: Server asks callee to start WebRTC stack
        socket.on('voice_call_start_webrtc', async (data) => {
            try {
                console.log('📞 Start WebRTC event received:', data);
                // Ensure we have a call context
                this.currentCall = this.currentCall || {};
                if (data?.callId) this.currentCall.callId = data.callId;
                
                // Ensure microphone access and peer connection ready
                if (!this.localStream) {
                    await this.requestMicrophonePermission();
                }
                if (!this.peerConnection) {
                    await this.createPeerConnection();
                }
                
                // ✅ CRITICAL FIX: Create and send WebRTC offer immediately
                console.log('📞 Creating WebRTC offer after start_webrtc event');
                await this.createOffer();
                
            } catch (err) {
                console.error('❌ Error preparing WebRTC on start event:', err);
                this.handleCallError(err, 'webrtc_start');
            }
        });
    }

    // === CONNECTION QUALITY MONITORING ===
    
    startConnectionMonitoring() {
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
        }
        
        this.connectionMonitor = setInterval(() => {
            this.checkConnectionQuality();
        }, 5000); // Check every 5 seconds
        
        console.log('📊 Started connection quality monitoring');
    }
    
    stopConnectionMonitoring() {
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
            this.connectionMonitor = null;
        }
        console.log('📊 Stopped connection quality monitoring');
    }
    
    async checkConnectionQuality() {
        if (!this.peerConnection || this.callState !== this.CALL_STATES.ACTIVE) {
            return;
        }
        
        try {
            const stats = await this.peerConnection.getStats();
            this.analyzeConnectionStats(stats);
        } catch (error) {
            console.warn('⚠️ Error getting connection stats:', error);
        }
    }
    
    analyzeConnectionStats(stats) {
        let audioLevel = 0;
        let packetLoss = 0;
        let latency = 0;
        let jitter = 0;
        
        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                // Audio level from remote stream
                audioLevel = report.audioLevel || 0;
                
                // Packet loss calculation
                const packetsLost = report.packetsLost || 0;
                const packetsReceived = report.packetsReceived || 1;
                packetLoss = (packetsLost / (packetsLost + packetsReceived)) * 100;
                
                // Jitter
                jitter = report.jitter || 0;
            }
            
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                // Latency
                latency = report.currentRoundTripTime * 1000 || 0; // Convert to ms
            }
        });
        
        // Update connection stats
        this.connectionStats = {
            audioLevel,
            packetLoss,
            latency,
            jitter,
            quality: this.calculateQualityScore(packetLoss, latency, jitter)
        };
        
        // Store in history
        this.qualityHistory.push({
            ...this.connectionStats,
            timestamp: Date.now()
        });
        
        // Keep only last 20 measurements
        if (this.qualityHistory.length > 20) {
            this.qualityHistory.shift();
        }
        
        // Update UI with quality info
        this.updateQualityIndicator();
        
        // Check for poor quality and suggest actions
        this.checkQualityThresholds();
    }
    
    calculateQualityScore(packetLoss, latency, jitter) {
        let score = 100;
        
        // Deduct points for packet loss
        score -= packetLoss * 2; // 2 points per 1% packet loss
        
        // Deduct points for high latency
        if (latency > 200) score -= 20;
        else if (latency > 100) score -= 10;
        
        // Deduct points for high jitter
        if (jitter > 0.05) score -= 15;
        else if (jitter > 0.02) score -= 5;
        
        // Determine quality level
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }
    
    updateQualityIndicator() {
        const qualityIndicator = document.querySelector('.call-quality-indicator');
        if (!qualityIndicator) return;
        
        const { quality, packetLoss, latency } = this.connectionStats;
        
        // Update quality icon and color
        qualityIndicator.className = `call-quality-indicator quality-${quality}`;
        
        // Update tooltip with detailed info
        qualityIndicator.title = `Chất lượng: ${this.getQualityText(quality)}\n` +
                               `Mất gói: ${packetLoss.toFixed(1)}%\n` +
                               `Độ trễ: ${latency.toFixed(0)}ms`;
    }
    
    getQualityText(quality) {
        const qualityMap = {
            'excellent': 'Xuất sắc',
            'good': 'Tốt',
            'fair': 'Trung bình',
            'poor': 'Kém'
        };
        return qualityMap[quality] || 'Không xác định';
    }
    
    checkQualityThresholds() {
        const { quality, packetLoss, latency } = this.connectionStats;
        
        // Show warning for poor quality
        if (quality === 'poor') {
            this.showQualityWarning('Chất lượng cuộc gọi kém. Kiểm tra kết nối mạng.');
        } else if (quality === 'fair' && packetLoss > 5) {
            this.showQualityWarning('Mất gói dữ liệu cao. Có thể ảnh hưởng đến chất lượng âm thanh.');
        }
    }
    
    showQualityWarning(message) {
        // Only show warning once per call
        if (this.qualityWarningShown) return;
        
        this.qualityWarningShown = true;
        
        if (this.app.utilsModule) {
            this.app.utilsModule.showWarning(message);
        }
        
        // Reset warning flag after 30 seconds
        setTimeout(() => {
            this.qualityWarningShown = false;
        }, 30000);
    }

    // === AUTO RECONNECTION ===
    
    handleConnectionLoss() {
        console.warn('⚠️ Connection lost, attempting reconnection...');
        
        if (this.isReconnecting) {
            console.log('🔄 Already attempting reconnection');
            return;
        }
        
        this.attemptReconnection();
    }
    
    handleConnectionFailure() {
        console.error('❌ Connection failed completely');
        
        if (this.reconnectionAttempts < this.maxReconnectionAttempts) {
            this.attemptReconnection();
        } else {
            this.endCall('connection_failed');
        }
    }
    
    async attemptReconnection() {
        if (this.isReconnecting || this.reconnectionAttempts >= this.maxReconnectionAttempts) {
            return;
        }
        
        this.isReconnecting = true;
        this.reconnectionAttempts++;
        
        console.log(`🔄 Attempting reconnection ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}`);
        
        // Show reconnection UI
        this.updateCallStatus('Đang kết nối lại...', `Lần thử ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}`);
        
        try {
            // Wait a bit before attempting reconnection
            await this.delay(2000 * this.reconnectionAttempts);
            
            // Try to recreate peer connection
            await this.recreatePeerConnection();
            
            // Send reconnection signal to other party
            await this.sendWithRetry('voice_call_reconnect', {
                callId: this.currentCall.callId
            }, 2);
            
            console.log('✅ Reconnection attempt completed');
            
        } catch (error) {
            console.error('❌ Reconnection attempt failed:', error);
            
            if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
                this.endCall('reconnection_failed');
            } else {
                // Try again after delay
                this.reconnectionTimeout = setTimeout(() => {
                    this.isReconnecting = false;
                    this.attemptReconnection();
                }, 5000);
            }
        }
    }
    
    async recreatePeerConnection() {
        try {
            // ✅ FIX: Properly close existing connection
            if (this.peerConnection) {
                console.log('🧹 Closing existing peer connection for reconnection');
                try {
                    // Remove all event listeners first
                    this.peerConnection.onicecandidate = null;
                    this.peerConnection.ontrack = null;
                    this.peerConnection.onconnectionstatechange = null;
                    
                    // Close the connection if not already closed
                    if (this.peerConnection.connectionState !== 'closed') {
                        this.peerConnection.close();
                    }
                } catch (error) {
                    console.warn('⚠️ Error closing peer connection during recreation:', error);
                }
                this.peerConnection = null;
                
                // Small delay to ensure cleanup completes
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Create new peer connection (will handle cleanup check internally)
            await this.createPeerConnection();
            
            // Re-add local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Create new offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Send new offer
            await this.sendWithRetry('webrtc_offer', {
                callId: this.currentCall.callId,
                offer: offer,
                isReconnection: true
            }, 2);
            
        } catch (error) {
            console.error('❌ Error recreating peer connection:', error);
            throw error;
        }
    }
    
    resetReconnectionState() {
        this.reconnectionAttempts = 0;
        this.isReconnecting = false;
        
        if (this.reconnectionTimeout) {
            clearTimeout(this.reconnectionTimeout);
            this.reconnectionTimeout = null;
        }
        
        console.log('✅ Reconnection state reset');
    }

    // === UTILITY METHODS ===
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async sendWithRetry(event, data, maxRetries = 3) {
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                this.webSocketManager.send(event, data);
                return; // Success
            } catch (error) {
                retryCount++;
                console.warn(`⚠️ Send attempt ${retryCount} failed for ${event}:`, error);
                
                if (retryCount >= maxRetries) {
                    throw error;
                }
                
                await this.delay(1000 * retryCount);
            }
        }
    }
    
    handleCallError(error, context) {
        console.error(`❌ Voice call error in ${context}:`, error);
        
        // Map technical errors to user-friendly messages
        const userMessage = this.mapErrorToUserMessage(error);
        
        // Show user-friendly error
        if (this.app.utilsModule) {
            this.app.utilsModule.showError(userMessage);
        }
        
        // Reset call state
        this.resetCallState();
        
        // Report error for debugging
        this.reportError(error, context);
    }
    
    mapErrorToUserMessage(error) {
        const errorMap = {
            'NotAllowedError': 'Vui lòng cho phép truy cập microphone',
            'NotFoundError': 'Không tìm thấy microphone',
            'NotReadableError': 'Microphone đang được sử dụng bởi ứng dụng khác',
            'OverconstrainedError': 'Microphone không hỗ trợ yêu cầu',
            'SecurityError': 'Lỗi bảo mật khi truy cập microphone',
            'AbortError': 'Cuộc gọi bị hủy',
            'NetworkError': 'Lỗi kết nối mạng',
            'WebSocket connection timeout': 'Kết nối WebSocket bị timeout',
            'WebRTC connection failed': 'Kết nối WebRTC thất bại'
        };
        
        return errorMap[error.name] || errorMap[error.message] || 'Đã có lỗi xảy ra, vui lòng thử lại';
    }
    
    reportError(error, context) {
        // Send error report to backend for debugging
        try {
            fetch('/voice-call/error-report', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.app.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: error.message,
                    context: context,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                })
            }).catch(err => console.warn('Failed to report error:', err));
        } catch (err) {
            console.warn('Failed to report error:', err);
        }
    }

    // === STATE SYNCHRONIZATION ===
    
    async syncStateWithBackend() {
        try {
            console.log('🔄 Syncing call state with backend...');
            
            const response = await fetch('/api/voice-call/active', {
                headers: {
                    'Authorization': `Bearer ${this.app.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.state.hasActiveCall) {
                console.log('📞 Found active call on backend, syncing...');
                this.syncCallState(data.state);
                return data.state;
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error syncing state with backend:', error);
            return null;
        }
    }
    
    syncCallState(backendState) {
        try {
            console.log('🔄 Syncing call state:', backendState);
            
            // Update current call info
            this.currentCall = {
                callId: backendState.callId,
                otherUserId: backendState.otherUserId,
                roomId: backendState.roomId,
                status: backendState.callStatus
            };
            
            // Update call state based on backend status
            switch (backendState.callStatus) {
                case 'ringing':
                    this.callState = this.CALL_STATES.RINGING;
                    this.showCallPanel('Đang gọi...', 'Đang kết nối...');
                    break;
                case 'accepted':
                    this.callState = this.CALL_STATES.CONNECTING;
                    this.showCallPanel('Đang kết nối...', 'Thiết lập cuộc gọi...');
                    break;
                case 'active':
                    this.callState = this.CALL_STATES.ACTIVE;
                    this.showCallPanel('Đang gọi', 'Kết nối thành công');
                    this.startCallTimer(backendState.startedAt);
                    break;
                default:
                    console.warn('⚠️ Unknown call status:', backendState.callStatus);
            }
            
            console.log('✅ Call state synced successfully');
            
        } catch (error) {
            console.error('❌ Error syncing call state:', error);
        }
    }

    // === CALL INITIATION ===

    async initiateCall(targetUserId) {
        try {
            console.log(`📞 Initiating call to user ${targetUserId}`);

            if (this.callState !== this.CALL_STATES.IDLE) {
                throw new Error('Đã có cuộc gọi đang diễn ra');
            }

            // Check if in a room with target user
            if (!this.app.currentRoom || !this.app.currentRoom.id) {
                throw new Error('Bạn cần ở trong phòng chat để gọi');
            }

            // ✅ IMPROVED: Show UI immediately (like WhatsApp)
            this.callState = this.CALL_STATES.CALLING;
            this.showCallPanel('Đang gọi...', 'Đang kết nối...');

            // ✅ IMPROVED: Request microphone permission in background
            this.requestMicrophonePermission().catch(error => {
                console.warn('⚠️ Microphone permission failed, continuing with call:', error);
                // Don't fail the call if mic permission fails - let user handle it
            });

            // Send call initiation request
            this.webSocketManager.send('voice_call_initiate', {
                targetUserId: targetUserId
            });

            // Set timeout for call initiation
            setTimeout(() => {
                if (this.callState === this.CALL_STATES.CALLING) {
                    console.log('⏰ Call initiation timeout after 30 seconds');
                    this.app.utilsModule.showError('Không thể kết nối cuộc gọi. Vui lòng thử lại.');
                    this.endCall('timeout');
                }
            }, 30000); // 30 seconds timeout

        } catch (error) {
            console.error('❌ Error initiating call:', error);
            if (this.app.errorHandler) {
                this.app.errorHandler.handleError(error, 'voice_call_initiate');
            } else {
                this.app.utilsModule.showError(error.message);
            }
            this.resetCallState();
        }
    }

    async requestMicrophonePermission() {
        try {
            // Enhanced audio constraints for better quality
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: this.echoCancellation,
                    noiseSuppression: this.noiseSuppression,
                    autoGainControl: this.autoGainControl,
                    sampleRate: 48000, // Higher sample rate for better quality
                    channelCount: 1, // Mono for voice calls
                    latency: 0.01, // Low latency
                    volume: 1.0,
                    // Advanced constraints for better quality
                    googEchoCancellation: this.echoCancellation,
                    googAutoGainControl: this.autoGainControl,
                    googNoiseSuppression: this.noiseSuppression,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googAudioMirroring: false
                }
            });

            console.log('🎤 Microphone access granted');
            
            // Initialize audio processing
            await this.initializeAudioProcessing();
            
            // Start audio level monitoring
            this.startAudioLevelMonitoring();
            
            return true;

        } catch (error) {
            console.error('❌ Microphone access denied:', error);
            
            let errorMessage = 'Không thể truy cập microphone';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Vui lòng cho phép truy cập microphone để thực hiện cuộc gọi';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'Không tìm thấy microphone';
            }
            
            throw new Error(errorMessage);
        }
    }
    
    async initializeAudioProcessing() {
        try {
            // Create audio context for processing
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Apply audio enhancements
            this.applyAudioEnhancements();
            
            console.log('🎵 Audio processing initialized');
            
        } catch (error) {
            console.warn('⚠️ Audio processing initialization failed:', error);
            // Continue without audio processing
        }
    }
    
    applyAudioEnhancements() {
        if (!this.audioContext || !this.localStream) return;
        
        try {
            // Create audio enhancement nodes
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            
            // High-pass filter to remove low-frequency noise
            const highPassFilter = this.audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.value = 80; // Remove frequencies below 80Hz
            
            // Low-pass filter to remove high-frequency noise
            const lowPassFilter = this.audioContext.createBiquadFilter();
            lowPassFilter.type = 'lowpass';
            lowPassFilter.frequency.value = 8000; // Keep frequencies below 8kHz
            
            // Compressor for dynamic range control
            const compressor = this.audioContext.createDynamicsCompressor();
            compressor.threshold.value = -24;
            compressor.knee.value = 30;
            compressor.ratio.value = 12;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.25;
            
            // Connect the audio processing chain
            source.connect(highPassFilter);
            highPassFilter.connect(lowPassFilter);
            lowPassFilter.connect(compressor);
            
            // Create new processed stream
            const destination = this.audioContext.createMediaStreamDestination();
            compressor.connect(destination);
            
            // Replace the original stream with processed stream
            this.localStream = destination.stream;
            
            console.log('🎵 Audio enhancements applied');
            
        } catch (error) {
            console.warn('⚠️ Audio enhancement failed:', error);
        }
    }
    
    toggleAudioEnhancement(enhancement, enabled) {
        switch (enhancement) {
            case 'noiseSuppression':
                this.noiseSuppression = enabled;
                break;
            case 'echoCancellation':
                this.echoCancellation = enabled;
                break;
            case 'autoGainControl':
                this.autoGainControl = enabled;
                break;
        }
        
        // Reinitialize audio processing if stream exists
        if (this.localStream) {
            this.initializeAudioProcessing();
        }
    }
    
    startAudioLevelMonitoring() {
        if (!this.localStream) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(this.localStream);
            const analyser = audioContext.createAnalyser();
            
            // Enhanced audio analysis settings
            analyser.fftSize = 512; // Higher resolution
            analyser.smoothingTimeConstant = 0.8; // Smoother visualization
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const timeDataArray = new Uint8Array(analyser.frequencyBinCount);
            
            // Audio quality metrics
            this.audioMetrics = {
                level: 0,
                peak: 0,
                rms: 0,
                isSpeaking: false,
                quality: 'good'
            };
            
            const checkAudioLevel = () => {
                if (this.callState === this.CALL_STATES.IDLE) {
                    audioContext.close();
                    return;
                }
                
                // Get frequency data for visualization
                analyser.getByteFrequencyData(dataArray);
                
                // Get time domain data for level calculation
                analyser.getByteTimeDomainData(timeDataArray);
                
                // Calculate RMS (Root Mean Square) for more accurate level
                let sum = 0;
                for (let i = 0; i < timeDataArray.length; i++) {
                    const normalized = (timeDataArray[i] - 128) / 128;
                    sum += normalized * normalized;
                }
                const rms = Math.sqrt(sum / timeDataArray.length);
                
                // Calculate average frequency level
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                
                // Update metrics
                this.audioMetrics.level = average;
                this.audioMetrics.rms = rms;
                this.audioMetrics.peak = Math.max(this.audioMetrics.peak * 0.95, average);
                this.audioMetrics.isSpeaking = rms > 0.01; // Threshold for speaking detection
                
                // Determine audio quality
                if (rms > 0.1) {
                    this.audioMetrics.quality = 'excellent';
                } else if (rms > 0.05) {
                    this.audioMetrics.quality = 'good';
                } else if (rms > 0.02) {
                    this.audioMetrics.quality = 'fair';
                } else {
                    this.audioMetrics.quality = 'poor';
                }
                
                // Update UI with enhanced audio level
                if (this.app.callScreenManager) {
                    this.app.callScreenManager.updateAudioLevel({
                        level: average,
                        rms: rms,
                        peak: this.audioMetrics.peak,
                        isSpeaking: this.audioMetrics.isSpeaking,
                        quality: this.audioMetrics.quality
                    });
                }
                
                // Update local audio level indicator
                this.updateAudioLevelIndicator(average);
                
                // Update audio visualizer with real data
                this.updateAudioVisualizer(dataArray);
                
                requestAnimationFrame(checkAudioLevel);
            };
            
            checkAudioLevel();
            
        } catch (error) {
            console.warn('⚠️ Audio level monitoring failed:', error);
        }
    }
    
    updateAudioVisualizer(frequencyData) {
        const visualizer = document.querySelector('.audio-visualizer');
        if (!visualizer || !this.isCallActive) return;
        
        const bars = visualizer.querySelectorAll('.audio-bar');
        const barCount = bars.length;
        const dataPerBar = Math.floor(frequencyData.length / barCount);
        
        bars.forEach((bar, index) => {
            let sum = 0;
            for (let i = index * dataPerBar; i < (index + 1) * dataPerBar; i++) {
                sum += frequencyData[i];
            }
            const average = sum / dataPerBar;
            const height = Math.max(2, (average / 255) * 50); // Scale to 0-50px
            bar.style.height = `${height}px`;
            
            // Add color based on level
            if (average > 200) {
                bar.style.backgroundColor = '#ff4444'; // Red for high levels
            } else if (average > 150) {
                bar.style.backgroundColor = '#ffaa00'; // Orange for medium-high
            } else if (average > 100) {
                bar.style.backgroundColor = '#44ff44'; // Green for medium
            } else {
                bar.style.backgroundColor = '#4444ff'; // Blue for low
            }
        });
    }

    // === WEBRTC IMPLEMENTATION ===

    async createPeerConnection() {
        try {
            // ✅ FIX: Wait if cleanup is in progress
            if (this.isCleaningUp) {
                console.log('⏳ Waiting for cleanup to complete before creating new peer connection');
                let waitCount = 0;
                while (this.isCleaningUp && waitCount < 50) { // Max 5 seconds
                    await new Promise(resolve => setTimeout(resolve, 100));
                    waitCount++;
                }
                if (this.isCleaningUp) {
                    throw new Error('Cleanup timeout: Could not create peer connection');
                }
            }
            
            // ✅ FIX: Close existing peer connection before creating new one
            // This prevents "m-lines order mismatch" errors
            if (this.peerConnection) {
                console.log('🧹 Closing existing peer connection before creating new one');
                try {
                    // Remove all event listeners first
                    this.peerConnection.onicecandidate = null;
                    this.peerConnection.ontrack = null;
                    this.peerConnection.onconnectionstatechange = null;
                    
                    // Close the connection
                    if (this.peerConnection.connectionState !== 'closed') {
                        this.peerConnection.close();
                    }
                } catch (error) {
                    console.warn('⚠️ Error closing existing peer connection:', error);
                }
                this.peerConnection = null;
                
                // Small delay to ensure cleanup completes
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Create new peer connection
            this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.currentCall) {
                    console.log('📡 Sending ICE candidate');
                    this.webSocketManager.send('ice_candidate', {
                        callId: this.currentCall.callId,
                        candidate: event.candidate
                    });
                }
            };

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                console.log('📡 Remote stream received');
                this.remoteStream = event.streams[0];
                this.remoteAudio.srcObject = this.remoteStream;
                this.updateCallStatus('Đang gọi', 'Kết nối thành công');
            };

            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log('📡 Connection state:', this.peerConnection.connectionState);
                
                switch (this.peerConnection.connectionState) {
                    case 'connected':
                        this.onCallConnected();
                        this.resetReconnectionState();
                        break;
                    case 'disconnected':
                        this.handleConnectionLoss();
                        break;
                    case 'failed':
                        this.handleConnectionFailure();
                        break;
                }
            };

            // Add local stream to peer connection
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }

            console.log('📡 PeerConnection created successfully');
            return true;

        } catch (error) {
            console.error('❌ Error creating PeerConnection:', error);
            throw error;
        }
    }

    async createOffer() {
        try {
            if (!this.peerConnection) {
                await this.createPeerConnection();
            }

            // Enhanced offer options for better audio quality
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false, // Voice only
                voiceActivityDetection: true,
                iceRestart: false
            });

            // Modify SDP to prefer high-quality audio codecs
            const modifiedOffer = this.modifySDPForAudioQuality(offer);
            
            await this.peerConnection.setLocalDescription(modifiedOffer);

            console.log('📡 Sending WebRTC offer with enhanced audio quality');
            this.webSocketManager.send('webrtc_offer', {
                callId: this.currentCall.callId,
                offer: modifiedOffer
            });

        } catch (error) {
            console.error('❌ Error creating offer:', error);
            throw error;
        }
    }
    
    modifySDPForAudioQuality(offer) {
        try {
            let sdp = offer.sdp;
            
            // Prefer Opus codec (best for voice)
            const opusRegex = /m=audio \d+ RTP\/SAVPF (\d+)/;
            const match = sdp.match(opusRegex);
            
            if (match) {
                // Reorder codecs to prefer Opus
                sdp = sdp.replace(
                    /a=rtpmap:(\d+) opus\/48000\/2/g,
                    'a=rtpmap:111 opus/48000/2'
                );
                sdp = sdp.replace(
                    /a=rtpmap:(\d+) PCMA\/8000/g,
                    'a=rtpmap:8 PCMA/8000'
                );
                sdp = sdp.replace(
                    /a=rtpmap:(\d+) PCMU\/8000/g,
                    'a=rtpmap:0 PCMU/8000'
                );
                
                // Add Opus-specific parameters for better quality
                sdp = sdp.replace(
                    /a=rtpmap:111 opus\/48000\/2/g,
                    'a=rtpmap:111 opus/48000/2\n' +
                    'a=fmtp:111 minptime=10; useinbandfec=1; stereo=0; maxplaybackrate=48000'
                );
            }
            
            // Add bandwidth constraints for better audio
            sdp = sdp.replace(
                /m=audio \d+ RTP\/SAVPF/g,
                'm=audio 9 RTP/SAVPF'
            );
            
            // Add audio bandwidth
            if (!sdp.includes('b=AS:')) {
                sdp = sdp.replace(
                    /m=audio \d+ RTP\/SAVPF \d+/g,
                    '$&\nb=AS:64' // 64 kbps for audio
                );
            }
            
            return {
                type: offer.type,
                sdp: sdp
            };
            
        } catch (error) {
            console.warn('⚠️ Error modifying SDP, using original:', error);
            return offer;
        }
    }

    async handleWebRTCOffer(data) {
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                if (!this.currentCall || data.callId !== this.currentCall.callId) {
                    console.warn('⚠️ Received offer for unknown call');
                    return;
                }

                if (!this.peerConnection) {
                    await this.createPeerConnection();
                }

                await this.peerConnection.setRemoteDescription(data.offer);
                
                // Enhanced answer creation
                const answer = await this.peerConnection.createAnswer({
                    voiceActivityDetection: true
                });
                
                // Modify answer SDP for better audio quality
                const modifiedAnswer = this.modifySDPForAudioQuality(answer);
                await this.peerConnection.setLocalDescription(modifiedAnswer);

                console.log('📡 Sending WebRTC answer with enhanced audio quality');
                
                // Send answer with retry mechanism
                await this.sendWithRetry('webrtc_answer', {
                    callId: this.currentCall.callId,
                    answer: modifiedAnswer
                }, 3);
                
                return; // Success, exit retry loop
                
            } catch (error) {
                retryCount++;
                console.warn(`⚠️ WebRTC offer attempt ${retryCount} failed:`, error);
                
                if (retryCount >= maxRetries) {
                    console.error('❌ Error handling WebRTC offer after all retries:', error);
                    this.endCall('webrtc_error');
                    return;
                }
                
                // Wait before retry with exponential backoff
                await this.delay(1000 * retryCount);
            }
        }
    }

    async handleWebRTCAnswer(data) {
        try {
            if (!this.currentCall || data.callId !== this.currentCall.callId) {
                console.warn('⚠️ Received answer for unknown call');
                return;
            }

            if (!this.peerConnection) {
                console.error('❌ No peer connection for answer');
                return;
            }

            await this.peerConnection.setRemoteDescription(data.answer);
            console.log('📡 WebRTC answer processed successfully');

        } catch (error) {
            console.error('❌ Error handling WebRTC answer:', error);
            this.endCall('webrtc_error');
        }
    }

    async handleICECandidate(data) {
        try {
            if (!this.currentCall || data.callId !== this.currentCall.callId) {
                console.warn('⚠️ Received ICE candidate for unknown call');
                return;
            }

            if (!this.peerConnection) {
                console.warn('⚠️ No peer connection for ICE candidate');
                return;
            }

            await this.peerConnection.addIceCandidate(data.candidate);
            console.log('📡 ICE candidate added successfully');

        } catch (error) {
            console.error('❌ Error handling ICE candidate:', error);
            // Don't end call for ICE candidate errors, they're not critical
        }
    }

    // === CALL CONTROL METHODS ===

    toggleMute() {
        if (!this.localStream) return;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;

            // Update UI
            const muteBtn = document.getElementById('mute-btn');
            const muteIcon = muteBtn.querySelector('i');
            
            if (this.isMuted) {
                muteBtn.classList.add('muted');
                muteIcon.className = 'fas fa-microphone-slash';
                muteBtn.title = 'Bật micro';
            } else {
                muteBtn.classList.remove('muted');
                muteIcon.className = 'fas fa-microphone';
                muteBtn.title = 'Tắt micro';
            }

            // Notify other user
            if (this.currentCall) {
                this.webSocketManager.send('voice_call_mute', {
                    callId: this.currentCall.callId
                });
            }

            console.log(`🔇 Microphone ${this.isMuted ? 'muted' : 'unmuted'}`);
        }
    }

    toggleSpeaker() {
        // This is more of a UI toggle since we can't control system speaker directly
        const speakerBtn = document.getElementById('speaker-btn');
        const speakerIcon = speakerBtn.querySelector('i');
        
        const isOff = speakerBtn.classList.contains('speaker-off');
        
        if (isOff) {
            speakerBtn.classList.remove('speaker-off');
            speakerIcon.className = 'fas fa-volume-up';
            speakerBtn.title = 'Tắt loa';
            if (this.remoteAudio) {
                this.remoteAudio.volume = 1.0;
            }
        } else {
            speakerBtn.classList.add('speaker-off');
            speakerIcon.className = 'fas fa-volume-mute';
            speakerBtn.title = 'Bật loa';
            if (this.remoteAudio) {
                this.remoteAudio.volume = 0.0;
            }
        }
        
        console.log(`🔊 Speaker ${isOff ? 'on' : 'off'}`);
    }

    // === CALL STATE MANAGEMENT ===

    onCallConnected() {
        this.callState = this.CALL_STATES.ACTIVE;
        this.isCallActive = true;
        this.callStartTime = new Date();
        
        // Initialize call quality monitoring
        this.callQualityMetrics = {
            startTime: this.callStartTime,
            audioLevel: 0,
            connectionQuality: 'good',
            packetLoss: 0,
            jitter: 0,
            latency: 0,
            codec: 'unknown'
        };
        
        // Start quality monitoring
        this.startCallQualityMonitoring();
        
        // Start connection quality monitoring
        this.startConnectionMonitoring();
        
        // Reset reconnection state
        this.resetReconnectionState();
        
        // Update call screen
        if (this.app.callScreenManager) {
            this.app.callScreenManager.updateCallStatus('active', 'Cuộc gọi đang diễn ra');
        }
        
        this.updateCallStatus(this.currentCall.otherUserName || 'Người dùng', 'Đang gọi');
        this.startCallTimer();
        this.startAudioVisualizer();
        
        console.log('✅ Call connected successfully');
    }
    
    startCallQualityMonitoring() {
        if (!this.peerConnection) return;
        
        // Monitor connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('📊 Connection state changed:', state);
            
            switch (state) {
                case 'connected':
                    this.callQualityMetrics.connectionQuality = 'excellent';
                    break;
                case 'connecting':
                    this.callQualityMetrics.connectionQuality = 'good';
                    break;
                case 'disconnected':
                    this.callQualityMetrics.connectionQuality = 'poor';
                    break;
                case 'failed':
                    this.callQualityMetrics.connectionQuality = 'failed';
                    this.endCall('connection_failed');
                    break;
            }
            
            // Update UI with quality status
            this.updateCallQualityUI();
        };
        
        // Monitor ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            const iceState = this.peerConnection.iceConnectionState;
            console.log('🧊 ICE connection state:', iceState);
            
            if (iceState === 'connected' || iceState === 'completed') {
                this.callQualityMetrics.connectionQuality = 'excellent';
            } else if (iceState === 'checking' || iceState === 'connected') {
                this.callQualityMetrics.connectionQuality = 'good';
            } else if (iceState === 'disconnected' || iceState === 'failed') {
                this.callQualityMetrics.connectionQuality = 'poor';
            }
        };
        
        // Monitor stats for quality metrics
        this.monitorCallStats();
    }
    
    async monitorCallStats() {
        if (!this.peerConnection || !this.isCallActive) return;
        
        try {
            const stats = await this.peerConnection.getStats();
            let audioStats = null;
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                    audioStats = report;
                }
            });
            
            if (audioStats) {
                // Calculate packet loss
                const packetsLost = audioStats.packetsLost || 0;
                const packetsReceived = audioStats.packetsReceived || 0;
                const totalPackets = packetsLost + packetsReceived;
                
                if (totalPackets > 0) {
                    this.callQualityMetrics.packetLoss = (packetsLost / totalPackets) * 100;
                }
                
                // Get jitter
                this.callQualityMetrics.jitter = audioStats.jitter || 0;
                
                // Get codec
                this.callQualityMetrics.codec = audioStats.codecId || 'unknown';
                
                // Determine overall quality
                if (this.callQualityMetrics.packetLoss < 1 && this.callQualityMetrics.jitter < 20) {
                    this.callQualityMetrics.connectionQuality = 'excellent';
                } else if (this.callQualityMetrics.packetLoss < 3 && this.callQualityMetrics.jitter < 50) {
                    this.callQualityMetrics.connectionQuality = 'good';
                } else if (this.callQualityMetrics.packetLoss < 5 && this.callQualityMetrics.jitter < 100) {
                    this.callQualityMetrics.connectionQuality = 'fair';
                } else {
                    this.callQualityMetrics.connectionQuality = 'poor';
                }
                
                // Update UI
                this.updateCallQualityUI();
            }
            
        } catch (error) {
            console.warn('⚠️ Error getting call stats:', error);
        }
        
        // Continue monitoring every 5 seconds
        if (this.isCallActive) {
            setTimeout(() => this.monitorCallStats(), 5000);
        }
    }
    
    updateCallQualityUI() {
        const qualityIndicator = document.querySelector('.call-quality-indicator');
        if (!qualityIndicator) return;
        
        const quality = this.callQualityMetrics.connectionQuality;
        qualityIndicator.className = `call-quality-indicator ${quality}`;
        
        // Update quality text
        const qualityText = qualityIndicator.querySelector('.quality-text');
        if (qualityText) {
            const qualityLabels = {
                'excellent': 'Chất lượng tuyệt vời',
                'good': 'Chất lượng tốt',
                'fair': 'Chất lượng trung bình',
                'poor': 'Chất lượng kém',
                'failed': 'Kết nối thất bại'
            };
            qualityText.textContent = qualityLabels[quality] || 'Đang kiểm tra...';
        }
    }
    
    updateAudioLevelIndicator(level) {
        const levelFill = document.querySelector('.level-fill');
        if (!levelFill) return;
        
        // Convert level (0-255) to percentage (0-100)
        const percentage = Math.min(100, (level / 255) * 100);
        levelFill.style.width = `${percentage}%`;
        
        // Change color based on level
        if (percentage > 80) {
            levelFill.style.backgroundColor = '#ff4444'; // Red for high
        } else if (percentage > 60) {
            levelFill.style.backgroundColor = '#ffaa00'; // Orange for medium-high
        } else if (percentage > 30) {
            levelFill.style.backgroundColor = '#44ff44'; // Green for medium
        } else {
            levelFill.style.backgroundColor = '#4444ff'; // Blue for low
        }
    }

    startCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
        }

        this.callTimer = setInterval(() => {
            if (this.callStartTime) {
                const duration = Math.floor((new Date() - this.callStartTime) / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                
                const timerElement = document.querySelector('.call-timer');
                if (timerElement) {
                    timerElement.textContent = 
                        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }, 1000);
    }

    startAudioVisualizer() {
        // Simple audio visualizer animation
        const visualizer = document.querySelector('.audio-visualizer');
        if (visualizer && this.isCallActive) {
            visualizer.classList.remove('hidden');
            
            const bars = visualizer.querySelectorAll('.audio-bar');
            setInterval(() => {
                if (this.isCallActive) {
                    bars.forEach(bar => {
                        const height = Math.random() * 30 + 5;
                        bar.style.height = `${height}px`;
                    });
                }
            }, 200);
        }
    }

    // === UI MANAGEMENT ===

    showCallPanel(callerName, status) {
        // Get caller info from current room
        const callerInfo = this.getCallerInfo();
        
        // Use call screen manager for full-screen experience
        if (this.app.callScreenManager) {
            this.app.callScreenManager.showCallScreen({
                caller: {
                    nickname: callerName || callerInfo.nickname || 'Người dùng',
                    username: callerInfo.username || 'user',
                    avatar: callerInfo.avatar || null
                }
            });
        } else {
            // Fallback to simple panel
            this.showSimpleCallPanel(callerName, status);
        }
    }
    
    getCallerInfo() {
        // Try to get caller info from current room
        if (this.app.currentRoom && this.app.currentRoom.otherUser) {
            return {
                nickname: this.app.currentRoom.otherUser.nickname,
                username: this.app.currentRoom.otherUser.username,
                avatar: this.app.currentRoom.otherUser.avatar_url
            };
        }
        
        // Fallback to current user info
        if (this.app.currentUser) {
            return {
                nickname: this.app.currentUser.nickname,
                username: this.app.currentUser.username,
                avatar: this.app.currentUser.avatar_url
            };
        }
        
        return {
            nickname: 'Người dùng',
            username: 'user',
            avatar: null
        };
    }

    showSimpleCallPanel(callerName, status) {
        const panel = document.getElementById('voice-call-panel');
        if (panel) {
            const callerNameEl = panel.querySelector('.caller-name');
            const statusEl = panel.querySelector('.call-status');
            
            if (callerNameEl) callerNameEl.textContent = callerName;
            if (statusEl) statusEl.textContent = status;
            
            panel.classList.remove('hidden');
            panel.classList.add('slide-in');
        }
    }

    hideCallPanel() {
        // Hide call screen
        if (this.app.callScreenManager) {
            this.app.callScreenManager.hideCallScreen();
        }
        
        // Hide simple panel fallback
        const panel = document.getElementById('voice-call-panel');
        if (panel) {
            panel.classList.add('slide-out');
            setTimeout(() => {
                panel.classList.add('hidden');
                panel.classList.remove('slide-in', 'slide-out');
            }, 500);
        }
    }

    updateCallStatus(name, status) {
        const panel = document.getElementById('voice-call-panel');
        const callerNameEl = panel.querySelector('.caller-name');
        const statusEl = panel.querySelector('.call-status');
        
        if (callerNameEl) callerNameEl.textContent = name;
        if (statusEl) statusEl.textContent = status;
    }

    showIncomingCallModal(callData) {
        const modal = document.getElementById('incoming-call-modal');
        const callerNameEl = modal.querySelector('.caller-name-large');
        const callerAvatarEl = modal.querySelector('.caller-avatar-large');
        
        callerNameEl.textContent = callData.caller.nickname || callData.caller.username;
        
        // Set avatar if available
        if (callData.caller.avatar && callData.caller.avatar !== 'default_avatar.jpg') {
            callerAvatarEl.innerHTML = `<img src="/static/uploads/${callData.caller.avatar}" alt="Avatar">`;
        } else {
            callerAvatarEl.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        modal.classList.remove('hidden');
        
        // Play ringtone
        if (this.ringtone) {
            this.ringtone.play().catch(e => console.warn('Cannot play ringtone:', e));
        }
    }

    hideIncomingCallModal() {
        const modal = document.getElementById('incoming-call-modal');
        modal.classList.add('hidden');
        
        // Stop ringtone
        if (this.ringtone) {
            this.ringtone.pause();
            this.ringtone.currentTime = 0;
        }
    }

    showSettings() {
        const panel = document.getElementById('call-settings-panel');
        panel.classList.remove('hidden');
        this.loadSettingsUI();
    }

    hideSettings() {
        const panel = document.getElementById('call-settings-panel');
        panel.classList.add('hidden');
    }

    // === SETTINGS MANAGEMENT ===

    async loadUserSettings() {
        try {
            const response = await fetch('/api/voice-call/settings', {
                headers: {
                    'Authorization': `Bearer ${this.app.authModule.getToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.userSettings = data.settings;
                console.log('📋 User settings loaded:', this.userSettings);
            }
        } catch (error) {
            console.error('❌ Error loading user settings:', error);
        }
    }

    loadSettingsUI() {
        if (!this.userSettings) return;
        
        const notifications = document.getElementById('call-notifications-setting');
        
        if (notifications) notifications.checked = this.userSettings.call_notifications === 1;
    }

    async saveSettings() {
        try {
            const notifications = document.getElementById('call-notifications-setting').checked;
            
            const response = await fetch('/api/voice-call/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.app.authModule.getToken()}`
                },
                body: JSON.stringify({
                    callNotifications: notifications
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.userSettings = data.settings;
                this.hideSettings();
                this.app.utilsModule.showSuccess('Cài đặt đã được lưu');
            } else {
                throw new Error('Failed to save settings');
            }
            
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            this.app.utilsModule.showError('Không thể lưu cài đặt');
        }
    }

    // === CALL EVENT HANDLERS ===

    handleIncomingCall(data) {
        console.log('📞 Handling incoming call:', data);
        
        this.currentCall = data;
        this.callState = this.CALL_STATES.RINGING;
        
        this.showIncomingCallModal(data);
        
        // ✅ REMOVED: Auto-answer logic - not needed
    }

    async acceptIncomingCall() {
        try {
            console.log('📞 Accepting incoming call');
            
            this.hideIncomingCallModal();
            
            // Request microphone permission
            await this.requestMicrophonePermission();
            
            // Update state
            this.callState = this.CALL_STATES.CONNECTING;
            this.showCallPanel(this.currentCall.caller.nickname, 'Đang kết nối...');
            
            // Accept the call
            this.webSocketManager.send('voice_call_accept', {
                callId: this.currentCall.callId
            });
            
        } catch (error) {
            console.error('❌ Error accepting call:', error);
            this.app.utilsModule.showError(error.message);
            this.rejectIncomingCall();
        }
    }

    rejectIncomingCall() {
        console.log('📞 Rejecting incoming call');
        
        this.hideIncomingCallModal();
        
        if (this.currentCall) {
            this.webSocketManager.send('voice_call_reject', {
                callId: this.currentCall.callId,
                reason: 'user_rejected'
            });
        }
        
        this.resetCallState();
    }

    handleCallAccepted(data) {
        console.log('📞 Call was accepted:', data);
        
        // Ensure currentCall exists and has callId for signaling
        this.currentCall = this.currentCall || {};
        this.currentCall.callId = data.callId;
        if (data.callee?.nickname) {
            this.currentCall.otherUserName = data.callee.nickname;
        }
        
        this.callState = this.CALL_STATES.CONNECTING;
        this.updateCallStatus(this.currentCall.otherUserName || data.callee?.nickname || 'Người dùng', 'Đang kết nối...');
        
        // Start WebRTC negotiation as caller
        setTimeout(() => {
            this.createOffer();
        }, 1000);
    }

    handleCallRejected(data) {
        console.log('📞 Call was rejected:', data);
        
        this.app.utilsModule.showError('Cuộc gọi bị từ chối');
        this.endCall('rejected');
    }

    async handleCallEnded(data) {
        console.log('📞 Call ended event received:', data);
        
        if (data.duration > 0) {
            const minutes = Math.floor(data.duration / 60);
            const seconds = data.duration % 60;
            this.app.utilsModule.showSuccess(
                `Cuộc gọi kết thúc. Thời gian: ${minutes}:${seconds.toString().padStart(2, '0')}`
            );
        }
        
        // ✅ FIX: Cleanup call properly
        await this.cleanupCall();
        this.hideCallUI();
        
        // ✅ LOGIC: Check backend flags để quyết định UI
        if (data.roomClosed === true || data.roomStillActive === false) {
            // Room đã bị đóng → Back to waiting room
            console.log('📞 Call ended, room closed → Back to waiting');
            this.app.backToWaiting();
        } else if (data.roomStillActive === true) {
            // Room vẫn active → Auto chuyển vào chat UI
            console.log('📞 Call ended, room still active → Switching to chat');
            if (this.app.chatModule) {
                this.app.chatModule.showChatRoom();
            }
            if (this.app.uiModule) {
                this.app.uiModule.showChatRoom();
            }
        } else {
            // Fallback: Check frontend state (nếu backend không gửi flags)
            const isKeptActive = this.app.chatModule?.isRoomKeptActive?.() || false;
            if (isKeptActive) {
                console.log('📞 Call ended, frontend shows kept active → Switching to chat');
                if (this.app.chatModule) {
                    this.app.chatModule.showChatRoom();
                }
                if (this.app.uiModule) {
                    this.app.uiModule.showChatRoom();
                }
            } else {
                console.log('📞 Call ended, no flags → Back to waiting');
                this.app.backToWaiting();
            }
        }
    }

    handleRemoteUserMuted(data) {
        console.log('🔇 Remote user muted');
        // Could show a visual indicator that the other user is muted
    }

    handleRemoteUserUnmuted(data) {
        console.log('🔇 Remote user unmuted');
        // Remove muted indicator
    }

    // === CLEANUP ===

    async acceptCall() {
        if (!this.currentCall || this.callState !== this.CALL_STATES.RINGING) {
            console.warn('⚠️ No incoming call to accept');
            return false;
        }

        try {
            console.log('📞 Accepting call...');
            this.callState = this.CALL_STATES.CONNECTING;
            this.updateCallStatus('Đang kết nối...', 'Chấp nhận cuộc gọi');

            // Request microphone permission
            await this.requestMicrophonePermission();

            // Create peer connection
            await this.createPeerConnection();

            // Send acceptance to backend
            this.webSocketManager.send('voice_call_accept', {
                callId: this.currentCall.callId
            });

            console.log('✅ Call accepted');
            return true;

        } catch (error) {
            console.error('❌ Error accepting call:', error);
            this.handleCallError(error, 'accept_call');
            return false;
        }
    }

    async rejectCall() {
        if (!this.currentCall || this.callState !== this.CALL_STATES.RINGING) {
            console.warn('⚠️ No incoming call to reject');
            return false;
        }

        try {
            console.log('📞 Rejecting call...');
            
            // Send rejection to backend
            this.webSocketManager.send('voice_call_reject', {
                callId: this.currentCall.callId
            });

            // ✅ FIX: Clean up properly
            await this.cleanupCall();
            this.hideIncomingCallModal();

            console.log('✅ Call rejected');
            return true;

        } catch (error) {
            console.error('❌ Error rejecting call:', error);
            this.handleCallError(error, 'reject_call');
            return false;
        }
    }

    async endCall(reason = 'user_hangup') {
        try {
            console.log(`📞 Ending call, reason: ${reason}`);
            
            // ✅ FIX: Send hangup event to backend first
            if (this.currentCall) {
                this.webSocketManager.send('voice_call_hangup', {
                    callId: this.currentCall.callId,
                    reason: reason
                });
            }
            
            // ✅ FIX: Cleanup local resources immediately
            await this.cleanupCall();
            
        } catch (error) {
            console.error('❌ Error ending call:', error);
            // Ensure cleanup even on error
            await this.cleanupCall();
        }
    }

    resetCallState() {
        console.log('🧹 Resetting call state');
        
        // ✅ FIX: Stop streams first
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            this.localStream = null;
        }
        
        // ✅ FIX: Properly close peer connection
        if (this.peerConnection) {
            try {
                // Remove all event listeners first
                this.peerConnection.onicecandidate = null;
                this.peerConnection.ontrack = null;
                this.peerConnection.onconnectionstatechange = null;
                
                // Close the connection if not already closed
                if (this.peerConnection.connectionState !== 'closed') {
                    this.peerConnection.close();
                }
            } catch (error) {
                console.warn('⚠️ Error closing peer connection:', error);
            }
            this.peerConnection = null;
        }
        
        // ✅ FIX: Clear remote audio
        if (this.remoteAudio) {
            this.remoteAudio.srcObject = null;
            this.remoteAudio.pause();
        }
        
        // ✅ FIX: Clear local audio if exists
        if (this.localAudio) {
            this.localAudio.srcObject = null;
            this.localAudio.pause();
        }
        
        // Stop timers
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        // Reset state
        this.currentCall = null;
        this.remoteStream = null;
        this.isCallActive = false;
        this.isMuted = false;
        this.callStartTime = null;
        this.callState = this.CALL_STATES.IDLE;
        
        // Hide UI
        this.hideCallPanel();
        this.hideIncomingCallModal();
        
        // ✅ FIX: Reset cleanup flag (fallback for direct calls)
        // Note: cleanupCall() will handle this, but this ensures it's reset if called directly
        this.isCleaningUp = false;
        
        console.log('✅ Call state reset complete');
    }
    
    // ✅ NEW: cleanupCall method (wrapper for resetCallState with additional cleanup)
    async cleanupCall() {
        // ✅ FIX: Set cleanup flag to prevent race conditions
        if (this.isCleaningUp) {
            console.log('⚠️ Cleanup already in progress, skipping duplicate cleanup');
            return;
        }
        
        this.isCleaningUp = true;
        try {
            console.log('🧹 Cleaning up call resources');
            this.resetCallState();
        } finally {
            // ✅ FIX: Clear cleanup flag after a short delay to ensure all async operations complete
            await new Promise(resolve => setTimeout(resolve, 200));
            this.isCleaningUp = false;
        }
    }

    // === STATE SYNCHRONIZATION ===

    async syncStateWithBackend() {
        try {
            console.log('🔄 Syncing call state with backend...');
            
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch('/api/voice-call/active', {
                headers: {
                    'Authorization': `Bearer ${this.app.authModule.getToken()}`
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const backendState = data.state;
                
                console.log('📊 Backend call state:', backendState);
                
                // Sync state if there's a mismatch
                if (backendState.hasActiveCall && this.callState === this.CALL_STATES.IDLE) {
                    console.log('⚠️ State mismatch: Backend has call, frontend is idle');
                    this.restoreCallState(backendState);
                } else if (!backendState.hasActiveCall && this.callState !== this.CALL_STATES.IDLE) {
                    console.log('⚠️ State mismatch: Frontend has call, backend is idle');
                    this.resetCallState();
                }
                
                return backendState;
            } else {
                console.error('❌ Failed to sync state with backend');
                return null;
            }
        } catch (error) {
            console.error('❌ Error syncing state with backend:', error);
            return null;
        }
    }

    restoreCallState(backendState) {
        console.log('🔄 Restoring call state from backend:', backendState);
        
        // Update local state to match backend
        this.currentCall = {
            callId: backendState.callId,
            otherUserId: backendState.otherUserId,
            roomId: backendState.roomId
        };
        
        // Set appropriate state based on backend status
        switch (backendState.callStatus) {
            case 'initiated':
            case 'ringing':
                this.callState = this.CALL_STATES.CALLING;
                this.showCallPanel('Đang gọi...', 'Kết nối lại...');
                break;
            case 'accepted':
            case 'active':
                this.callState = this.CALL_STATES.ACTIVE;
                this.isCallActive = true;
                this.onCallConnected();
                break;
            default:
                this.resetCallState();
        }
    }

    // === PUBLIC API ===

    // Check if user can make a call
    canMakeCall() {
        return this.callState === this.CALL_STATES.IDLE && 
               this.app.currentRoom && 
               this.app.currentRoom.id;
    }

    // Get current call status
    getCallStatus() {
        return {
            state: this.callState,
            isActive: this.isCallActive,
            currentCall: this.currentCall,
            duration: this.callStartTime ? Math.floor((new Date() - this.callStartTime) / 1000) : 0
        };
    }

    // Cleanup on page unload
    cleanup() {
        console.log('🧹 Cleaning up VoiceCallManager');
        this.resetCallState();
        
        // Remove audio elements
        if (this.remoteAudio) {
            document.body.removeChild(this.remoteAudio);
        }
        if (this.ringtone) {
            document.body.removeChild(this.ringtone);
        }
    }

    // Lightweight wrapper for backward compatibility
    showCallInterface(statusTitle, statusMessage) {
        // statusTitle used as name/title, statusMessage as status text
        this.showCallPanel(statusTitle || 'Đang gọi...', statusMessage || 'Đang kết nối...');
    }

    // ✅ NEW: Setup audio elements method
    setupAudioElements() {
        console.log('🎵 Setting up audio elements');
        
        // Get remote audio element from HTML
        this.remoteAudio = document.getElementById('remote-audio');
        if (!this.remoteAudio) {
            console.warn('⚠️ Remote audio element not found in HTML');
        }
        
        // Create local audio element for monitoring (optional)
        if (!this.localAudio) {
            this.localAudio = document.createElement('audio');
            this.localAudio.id = 'local-audio';
            this.localAudio.muted = true; // Prevent feedback
            this.localAudio.style.display = 'none';
            document.body.appendChild(this.localAudio);
        }
        
        console.log('✅ Audio elements setup completed');
    }

    // ✅ NEW: On call disconnected method
    onCallDisconnected() {
        console.log('📞 Call disconnected');
        
        // Stop audio streams
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Clear audio elements
        if (this.remoteAudio) {
            this.remoteAudio.srcObject = null;
        }
        if (this.localAudio) {
            this.localAudio.srcObject = null;
        }
        
        // Reset call state
        this.resetCallState();
        
        // Hide call interface
        this.hideCallInterface();
    }
}

export default VoiceCallManager;
