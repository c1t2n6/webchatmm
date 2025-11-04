// Call Screen Manager - Full-screen call interface
export class CallScreenManager {
    constructor(app) {
        this.app = app;
        this.callScreen = null;
        this.callDuration = 0;
        this.durationTimer = null;
        this.isMuted = false;
        this.isSpeakerOn = false;
        this.callStartTime = null;
        this.callQuality = 'excellent';
        this.networkStatus = 'excellent';
        
        this.init();
    }

    init() {
        this.callScreen = document.getElementById('call-screen');
        if (!this.callScreen) {
            console.error('❌ Call screen element not found');
            return;
        }

        this.setupEventListeners();
        console.log('✅ Call Screen Manager initialized');
    }

    setupEventListeners() {
        // Minimize button
        const minimizeBtn = document.getElementById('call-minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.minimizeCall());
        }

        // Mute button
        const muteBtn = document.getElementById('call-mute');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => this.toggleMute());
        }

        // Speaker button
        const speakerBtn = document.getElementById('call-speaker');
        if (speakerBtn) {
            speakerBtn.addEventListener('click', () => this.toggleSpeaker());
        }

        // End call button
        const endBtn = document.getElementById('call-end');
        if (endBtn) {
            endBtn.addEventListener('click', () => this.endCall());
        }

        // Footer buttons
        const keypadBtn = document.getElementById('call-keypad');
        if (keypadBtn) {
            keypadBtn.addEventListener('click', () => this.showKeypad());
        }

        const addBtn = document.getElementById('call-add');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddUser());
        }

        const moreBtn = document.getElementById('call-more');
        if (moreBtn) {
            moreBtn.addEventListener('click', () => this.showMoreOptions());
        }
    }

    // Show call screen
    showCallScreen(callData) {
        if (!this.callScreen) return;

        console.log('📞 Showing call screen:', callData);
        
        // Update caller info
        this.updateCallerInfo(callData);
        
        // Show screen with animation
        this.callScreen.classList.remove('hidden');
        this.callScreen.classList.add('show');
        
        // Start duration timer
        this.startDurationTimer();
        
        // Update call status
        this.updateCallStatus('connecting', 'Đang kết nối...');
    }

    // Hide call screen
    hideCallScreen() {
        if (!this.callScreen) return;

        console.log('📞 Hiding call screen');
        
        // Stop duration timer
        this.stopDurationTimer();
        
        // Hide with animation
        this.callScreen.classList.add('hide');
        
        setTimeout(() => {
            this.callScreen.classList.remove('show', 'hide');
            this.callScreen.classList.add('hidden');
        }, 300);
    }

    // Update caller information
    updateCallerInfo(callData) {
        const callerName = document.getElementById('caller-name');
        const callerStatus = document.getElementById('caller-status');
        const callerAvatar = document.getElementById('caller-avatar-img');
        const callerAvatarPlaceholder = document.getElementById('caller-avatar-placeholder');

        if (callerName) {
            callerName.textContent = callData.caller?.nickname || callData.caller?.username || 'Người dùng';
        }

        if (callerStatus) {
            callerStatus.textContent = 'Đang gọi...';
        }

        if (callData.caller?.avatar && callerAvatar) {
            callerAvatar.src = callData.caller.avatar;
            callerAvatar.style.display = 'block';
            if (callerAvatarPlaceholder) {
                callerAvatarPlaceholder.style.display = 'none';
            }
        } else {
            if (callerAvatar) callerAvatar.style.display = 'none';
            if (callerAvatarPlaceholder) callerAvatarPlaceholder.style.display = 'block';
        }
    }

    // Update call status
    updateCallStatus(status, message) {
        const callerStatus = document.getElementById('caller-status');
        const statusIndicator = document.getElementById('call-status-indicator');

        if (callerStatus) {
            callerStatus.textContent = message;
        }

        if (statusIndicator) {
            const icon = statusIndicator.querySelector('i');
            if (icon) {
                switch (status) {
                    case 'calling':
                        icon.className = 'fas fa-phone text-white text-sm';
                        statusIndicator.className = 'absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center';
                        break;
                    case 'connecting':
                        icon.className = 'fas fa-phone text-white text-sm';
                        statusIndicator.className = 'absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center';
                        break;
                    case 'active':
                        icon.className = 'fas fa-phone text-white text-sm';
                        statusIndicator.className = 'absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center';
                        break;
                    case 'ended':
                        icon.className = 'fas fa-phone-slash text-white text-sm';
                        statusIndicator.className = 'absolute -bottom-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center';
                        break;
                }
            }
        }
    }

    // Start call duration timer
    startDurationTimer() {
        this.callStartTime = Date.now();
        this.callDuration = 0;
        
        this.durationTimer = setInterval(() => {
            this.callDuration = Math.floor((Date.now() - this.callStartTime) / 1000);
            this.updateDuration();
        }, 1000);
    }

    // Stop call duration timer
    stopDurationTimer() {
        if (this.durationTimer) {
            clearInterval(this.durationTimer);
            this.durationTimer = null;
        }
    }

    // Update duration display
    updateDuration() {
        const durationElement = document.getElementById('call-duration');
        if (durationElement) {
            const minutes = Math.floor(this.callDuration / 60);
            const seconds = this.callDuration % 60;
            durationElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // Toggle mute
    toggleMute() {
        this.isMuted = !this.isMuted;
        const muteBtn = document.getElementById('call-mute');
        const icon = muteBtn?.querySelector('i');
        
        if (muteBtn) {
            if (this.isMuted) {
                muteBtn.classList.add('active');
                if (icon) icon.className = 'fas fa-microphone-slash text-white text-xl';
            } else {
                muteBtn.classList.remove('active');
                if (icon) icon.className = 'fas fa-microphone text-white text-xl';
            }
        }

        // Notify voice call manager
        if (this.app.voiceCallManager && this.app.voiceCallManager.toggleMute) {
            this.app.voiceCallManager.toggleMute(this.isMuted);
        }

        console.log('📞 Mute toggled:', this.isMuted);
    }

    // Toggle speaker
    toggleSpeaker() {
        this.isSpeakerOn = !this.isSpeakerOn;
        const speakerBtn = document.getElementById('call-speaker');
        const icon = speakerBtn?.querySelector('i');
        
        if (speakerBtn) {
            if (this.isSpeakerOn) {
                speakerBtn.classList.add('active');
                if (icon) icon.className = 'fas fa-volume-up text-white text-xl';
            } else {
                speakerBtn.classList.remove('active');
                if (icon) icon.className = 'fas fa-volume-down text-white text-xl';
            }
        }

        // Notify voice call manager
        if (this.app.voiceCallManager && this.app.voiceCallManager.toggleSpeaker) {
            this.app.voiceCallManager.toggleSpeaker(this.isSpeakerOn);
        }

        console.log('📞 Speaker toggled:', this.isSpeakerOn);
    }

    // End call
    endCall() {
        console.log('📞 Ending call from call screen');
        
        if (this.app.voiceCallManager) {
            this.app.voiceCallManager.endCall('user_hangup');
        }
        
        this.hideCallScreen();
    }

    // Minimize call
    minimizeCall() {
        console.log('📞 Minimizing call');
        this.hideCallScreen();
        
        // Show minimized call indicator
        this.showMinimizedCallIndicator();
    }

    // Show minimized call indicator
    showMinimizedCallIndicator() {
        // This would show a small floating call indicator
        // For now, just hide the full screen
        console.log('📞 Call minimized - showing floating indicator');
    }

    // Update call quality
    updateCallQuality(quality) {
        this.callQuality = quality;
        const qualityElement = document.getElementById('call-quality');
        const qualityText = document.getElementById('call-quality-text');
        
        if (qualityElement) {
            qualityElement.className = `flex items-center space-x-1 quality-${quality}`;
            const qualitySpan = qualityElement.querySelector('span');
            if (qualitySpan) {
                const qualityLabels = {
                    excellent: 'Tuyệt vời',
                    good: 'Tốt',
                    poor: 'Kém'
                };
                qualitySpan.textContent = qualityLabels[quality] || 'Tuyệt vời';
            }
        }

        if (qualityText) {
            const qualityLabels = {
                excellent: 'Chất lượng: Tuyệt vời',
                good: 'Chất lượng: Tốt',
                poor: 'Chất lượng: Kém'
            };
            qualityText.textContent = qualityLabels[quality] || 'Chất lượng: Tuyệt vời';
        }
    }

    // Update network status
    updateNetworkStatus(status) {
        this.networkStatus = status;
        const networkElement = document.getElementById('call-network');
        const networkInfo = document.getElementById('call-network-info');
        
        if (networkElement) {
            networkElement.className = `flex items-center space-x-1 network-${status}`;
            const networkSpan = networkElement.querySelector('span');
            if (networkSpan) {
                const networkLabels = {
                    excellent: '5G',
                    good: '4G',
                    poor: '3G'
                };
                networkSpan.textContent = networkLabels[status] || '4G';
            }
        }

        if (networkInfo) {
            const networkLabels = {
                excellent: 'Mạng: 5G - Rất tốt',
                good: 'Mạng: 4G - Ổn định',
                poor: 'Mạng: 3G - Chậm'
            };
            networkInfo.textContent = networkLabels[status] || 'Mạng: 4G - Ổn định';
        }
    }

    // Footer button handlers
    showKeypad() {
        console.log('📞 Keypad requested');
        // Future: Show DTMF keypad
    }

    showAddUser() {
        console.log('📞 Add user requested');
        // Future: Add user to call (for group calls)
    }

    showMoreOptions() {
        console.log('📞 More options requested');
        // Future: Show call options menu
    }

    // Get current call state
    getCallState() {
        return {
            isVisible: !this.callScreen?.classList.contains('hidden'),
            duration: this.callDuration,
            isMuted: this.isMuted,
            isSpeakerOn: this.isSpeakerOn,
            quality: this.callQuality,
            network: this.networkStatus
        };
    }
    
    updateAudioLevel(level) {
        // Update audio level indicator (0-100)
        const normalizedLevel = Math.min(100, Math.max(0, (level / 255) * 100));
        
        // Update call quality based on audio level
        if (normalizedLevel > 50) {
            this.updateCallQuality('Tuyệt vời', '4G', 'Ổn định');
        } else if (normalizedLevel > 20) {
            this.updateCallQuality('Tốt', '4G', 'Ổn định');
        } else {
            this.updateCallQuality('Kém', '3G', 'Chậm');
        }
        
        // Update audio level indicator in UI
        const audioLevelEl = document.getElementById('audio-level');
        if (audioLevelEl) {
            audioLevelEl.style.width = `${normalizedLevel}%`;
        }
    }
}

export default CallScreenManager;
