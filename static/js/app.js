// Mapmo.vn - Main Application using Modules
console.log("=== MAPMO APP LOADED ===");

// Import modules
import { AuthModule } from './modules/auth.js';
import { ProfileModule } from './modules/profile.js';
import { ProfileEditModule } from './modules/profile-edit.js';
// Import ChatModule
import { ChatModule } from './modules/chat_refactored.js';
import { LikeModule } from './modules/like.js';
// import { NotificationModule } from './modules/notification.js'; // Removed - replaced by SimpleCountdownModule
import { SimpleCountdownModuleV2 } from './modules/simple_countdown_v2.js';
import { UIModule } from './modules/ui.js';
import { UtilsModule } from './modules/utils.js';
import { TimerManager } from './modules/timer_manager.js';
import { VoiceCallManager } from './modules/voice_call_manager.js';
import { ErrorHandler } from './modules/error_handler.js';
import { CallScreenManager } from './modules/call_screen_manager.js';

class MapmoApp {
    constructor() {
        console.log('🔍 App - Constructor called');
        this.currentUser = null;
        this.currentRoom = null;
        
        // State management
        this.isSearching = false;
        
        // Initialize modules
        console.log('🔍 App - Initializing modules...');
        this.authModule = new AuthModule(this);
        this.profileModule = new ProfileModule(this);
        this.profileEditModule = new ProfileEditModule(this);
        
        // Initialize ChatModule
        console.log('✅ ChatModule found, initializing...');
        this.chatModule = new ChatModule(this);
        // Initialize ChatModule
        this.chatModule.init();
        
        this.likeModule = new LikeModule(this);
        // this.notificationModule = new NotificationModule(this); // Removed - replaced by SimpleCountdownModule
        this.simpleCountdownModule = new SimpleCountdownModuleV2(this);
        this.uiModule = new UIModule(this);
        this.utilsModule = new UtilsModule(this);
        this.errorHandler = new ErrorHandler(this);
        this.callScreenManager = new CallScreenManager(this);
        
        // ✅ THÊM: Khởi tạo TimerManager cho app
        this.timerManager = null;
        this.initTimerManager();
        
        // ✅ THÊM: Khởi tạo VoiceCallManager
        this.voiceCallManager = null;
        
        console.log('🔍 App - Modules initialized');
        
        console.log('🔍 App - Calling init()...');
        this.init();
        console.log('🔍 App - Constructor completed');
    }
    
    // ✅ THÊM: Khởi tạo TimerManager
    initTimerManager() {
        try {
            this.timerManager = new TimerManager();
            console.log('🔍 App - TimerManager initialized successfully');
        } catch (error) {
            console.error('🔍 App - Failed to initialize TimerManager:', error);
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

    init() {
        console.log('🔍 App - init() called');
        this.bindEvents();
        console.log('🔍 App - About to call checkAuthStatus()');
        this.authModule.checkAuthStatus();
        console.log('🔍 App - checkAuthStatus() called');
        this.uiModule.setupDarkMode();
        
        // ✅ THÊM: Initialize profile edit module
        this.profileEditModule.init();
        
        console.log('🔍 App - init() completed');
    }
    
    // ✅ SIMPLIFIED: Initialize VoiceCallManager
    async initVoiceCallManager() {
        try {
            console.log('📞 Initializing VoiceCallManager...');
            
            if (!this.chatModule?.websocketManager) {
                console.warn('⚠️ WebSocketManager not ready');
                return false;
            }

            // Ensure WebSocket connection
            this.chatModule.websocketManager.connect();
            const ready = await this.chatModule.websocketManager.waitForReady(5000);

            if (!ready) {
                console.warn('⚠️ WebSocket not available');
                return false;
            }

            // Create VoiceCallManager
            const { VoiceCallManager } = await import('./modules/voice_call_manager.js');
            this.voiceCallManager = new VoiceCallManager(this, this.chatModule.websocketManager);
            console.log('✅ VoiceCallManager initialized successfully');
            
            // Add voice call buttons
            setTimeout(() => this.addVoiceCallButtons(), 1000);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize VoiceCallManager:', error);
            return false;
        }
    }

    bindEvents() {
        // ✅ THÊM: Tránh duplicate event listeners
        if (this.eventsBound) {
            console.log('🔍 App - Events already bound, skipping');
            return;
        }
        
        console.log('🔍 App - Binding events...');
        
        // Landing page buttons
        const chatBtn = document.getElementById('chatBtn');
        const voiceBtn = document.getElementById('voiceBtn');
        
        if (chatBtn) {
            chatBtn.addEventListener('click', () => this.handleChatClick());
        }
        
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                console.log('🔥 VOICE BUTTON CLICKED! 🔥');
                this.handleVoiceClick();
            });
        }

        // Modal controls
        const closeLoginModal = document.getElementById('closeLoginModal');
        const closeSignupModal = document.getElementById('closeSignupModal');
        const showSignup = document.getElementById('showSignup');
        const showLogin = document.getElementById('showLogin');

        if (closeLoginModal) {
            closeLoginModal.addEventListener('click', () => this.uiModule.hideModal('loginModal'));
        }
        if (closeSignupModal) {
            closeSignupModal.addEventListener('click', () => this.uiModule.hideModal('signupModal'));
        }
        if (showSignup) {
            showSignup.addEventListener('click', () => this.uiModule.showModal('signupModal'));
        }
        if (showLogin) {
            showLogin.addEventListener('click', () => this.uiModule.showModal('loginModal'));
        }

        // Waiting room buttons
        const startChat = document.getElementById('startChat');
        const startVoice = document.getElementById('startVoice');
        
        if (startChat) {
            startChat.addEventListener('click', () => {
                console.log('📱 Start Chat button clicked');
                console.log('📱 isSearching:', this.isSearching);
                if (this.isSearching) {
                    console.log('⚠️ Search already in progress, ignoring button click');
                    return;
                }
                this.handleChatClick();
            });
        }
        
        if (startVoice) {
            startVoice.addEventListener('click', () => {
                console.log('📞 Start Voice button clicked');
                console.log('📞 isSearching:', this.isSearching);
                if (this.isSearching) {
                    console.log('⚠️ Search already in progress, ignoring button click');
                    return;
                }
                this.handleVoiceClick();
            });
        }

        // Forms
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.authModule.handleLogin(e));
        }
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.authModule.handleSignup(e));
        }

        // Profile wizard
        const nextStep = document.getElementById('nextStep');
        const prevStep = document.getElementById('prevStep');
        const skipProfile = document.getElementById('skipProfile');

        if (nextStep) {
            nextStep.addEventListener('click', () => this.profileModule.nextWizardStep());
        }
        if (prevStep) {
            prevStep.addEventListener('click', () => this.profileModule.prevWizardStep());
        }
        if (skipProfile) {
            skipProfile.addEventListener('click', () => this.profileModule.skipProfile());
        }

        // Interest checkboxes
        document.querySelectorAll('.interest-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.profileModule.handleInterestSelection());
        });

        // Waiting room (handled in main bindEvents section above)
        
        // Cancel search button
        const cancelSearch = document.getElementById('cancelSearch');
        if (cancelSearch) {
            cancelSearch.addEventListener('click', async () => {
                console.log('🔍 Cancel search button clicked');
                
                // ✅ PREVENT DOUBLE CLICKS
                if (cancelSearch.disabled) {
                    console.log('⚠️ Cancel button already disabled, ignoring click');
                    return;
                }
                
                // Disable button and show feedback
                cancelSearch.disabled = true;
                const originalText = cancelSearch.innerHTML;
                cancelSearch.innerHTML = 'Đang hủy...';
                
                try {
                    await this.cancelSearch();
                } catch (error) {
                    console.error('❌ Cancel search failed:', error);
                } finally {
                    // Re-enable button
                    setTimeout(() => {
                        cancelSearch.disabled = false;
                        cancelSearch.innerHTML = originalText;
                    }, 1000);
                }
            });
        }

        // Chat controls
        const sendMessage = document.getElementById('sendMessage');
        const messageInput = document.getElementById('messageInput');
        const endChat = document.getElementById('endChat');
        const keepActive = document.getElementById('keepActive');
        const reportUser = document.getElementById('reportUser');

        if (sendMessage) {
            sendMessage.addEventListener('click', () => this.chatModule.sendMessage());
        }
        // Note: Enter key handling is now managed by message_handler.js
        // to avoid duplicate event listeners
        if (endChat) {
            endChat.addEventListener('click', () => this.chatModule.endChat());
        }
        if (keepActive) {
            keepActive.addEventListener('click', () => this.chatModule.keepActive());
        }
        if (reportUser) {
            reportUser.addEventListener('click', () => this.chatModule.reportUser());
        }

        // Voice call button
        const voiceCallBtn = document.getElementById('voice-call-btn');
        if (voiceCallBtn) {
            voiceCallBtn.addEventListener('click', () => this.requestVoiceCall());
        }

        // Like modal
        const likeYes = document.getElementById('likeYes');
        const likeNo = document.getElementById('likeNo');

        if (likeYes) {
            likeYes.addEventListener('click', () => this.likeModule.handleLike(true));
        }
        if (likeNo) {
            likeNo.addEventListener('click', () => this.likeModule.handleLike(false));
        }

        // Other buttons (cancelSearch handled above)
        const backToWaiting = document.getElementById('backToWaiting');
        const profileBtn = document.getElementById('profileBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        // cancelSearch event handled above
        if (backToWaiting) {
            backToWaiting.addEventListener('click', () => this.backToWaiting());
        }
        if (profileBtn) {
            profileBtn.addEventListener('click', () => this.showProfile());
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.authModule.logout());
        }
        
        // ✅ THÊM: Đánh dấu events đã được bind
        this.eventsBound = true;
        console.log('🔍 App - Events bound successfully');
    }

    // Note: Message input listeners are now handled by message_handler.js
    // to avoid duplicate event listeners and ensure proper typing indicator functionality

    // Navigation
    handleChatClick() {
        console.log('🔍 App - handleChatClick called');
        
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.log('🔍 App - No token, showing login modal');
            this.uiModule.showModal('loginModal');
        } else if (!this.currentUser) {
            console.log('🔍 App - No currentUser, checking auth status');
            this.authModule.checkAuthStatus().then(() => {
                if (this.currentUser) {
                    this.handleAuthenticatedChatClick();
                } else {
                    console.log('🔍 App - No user after auth check, showing login modal');
                    this.uiModule.showModal('loginModal');
                }
            });
        } else {
            this.handleAuthenticatedChatClick();
        }
    }

    // ✅ NEW: Handle chat click for authenticated users
    handleAuthenticatedChatClick() {
        console.log('🔍 App - Handling authenticated chat click');
        
        // Check if profile is completed (handle both boolean and number values)
        const isProfileComplete = this.currentUser && (this.currentUser.profile_completed === true || this.currentUser.profile_completed === 1);
        if (this.currentUser && !isProfileComplete) {
            console.log('🔍 App - Profile not completed. Value:', this.currentUser.profile_completed, 'Type:', typeof this.currentUser.profile_completed);
            this.showProfilePrompt();
        } else {
            console.log('🔍 App - Profile completed, starting chat matching');
            // ✅ NEW: Use startChatMatching instead of direct API call
            this.startChatMatching();
        }
    }

    // ✅ NEW: Show smart profile completion prompt
    showProfilePrompt() {
        // Create and show profile prompt modal
        const modal = document.createElement('div');
        modal.id = 'profilePromptModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
                <div class="text-center mb-6">
                    <div class="text-4xl mb-4">🎯</div>
                    <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Setup profile để chat hiệu quả hơn?
                    </h3>
                    <p class="text-gray-600 dark:text-gray-300">
                        Profile giúp bạn match với những người phù hợp hơn. Chỉ mất 2 phút thôi!
                    </p>
                </div>
                
                <div class="space-y-3">
                    <button id="setupProfileNow" class="w-full bg-primary text-white py-3 px-4 rounded-xl hover:bg-opacity-90 transition-colors font-semibold">
                        ✨ Setup ngay (2 phút)
                    </button>
                    <button id="skipProfileSetup" class="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        Chat với thông tin cơ bản
                    </button>
                </div>
                
                <p class="text-xs text-gray-500 text-center mt-4">
                    Bạn có thể setup profile sau trong phần cài đặt
                </p>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle buttons
        document.getElementById('setupProfileNow').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.uiModule.showProfileWizard();
        });
        
        document.getElementById('skipProfileSetup').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.uiModule.showWaitingRoom();
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                this.uiModule.showWaitingRoom();
            }
        });
    }

    async handleVoiceClick() {
        console.log('🔍 App - handleVoiceClick called');
        console.log('🔍 App - Current user:', this.currentUser);
        console.log('🔍 App - Current room:', this.currentRoom);
        
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.log('🔍 App - No token for voice, showing login modal');
            this.uiModule.showModal('loginModal');
            return;
        }
        
        // Check if user is authenticated
        if (!this.currentUser) {
            console.log('🔍 App - No currentUser, checking auth status first');
            this.authModule.checkAuthStatus().then(() => {
                if (this.currentUser) {
                    console.log('🔍 App - Auth successful, retrying voice click');
                    this.handleVoiceClick(); // Retry after auth
                } else {
                    console.log('🔍 App - Auth failed, showing login modal');
                    this.uiModule.showModal('loginModal');
                }
            });
            return;
        }
        
        // ✅ SIMPLIFIED: Always start voice matching (no room check needed)
        console.log('📞 Starting voice matching directly...');
        this.startVoiceMatching();
    }
    
    // ✅ MODIFIED: Direct voice call initiation (for voice entry mode and accepted invitations)
    startDirectVoiceCall() {
        try {
            console.log('📞 App - Starting direct voice call in room:', this.currentRoom.id);
            
            // Get the other user in the room
            const otherUserId = this.getOtherUserId();
            
            if (this.voiceCallManager) {
                this.voiceCallManager.initiateCall(otherUserId);
            } else {
                this.utilsModule.showError('Voice call chưa sẵn sàng');
            }
        } catch (error) {
            console.error('❌ App - Error starting direct voice call:', error);
            this.utilsModule.showError('Không thể thực hiện cuộc gọi');
        }
    }
    
    // ✅ NEW: Helper method to get other user ID
    getOtherUserId() {
        if (!this.currentRoom) return null;
        
        if (this.currentRoom.matched_user) {
            return this.currentRoom.matched_user.id;
        }
        
        // Fallback to room user IDs
        return this.currentRoom.user1_id === this.currentUser.id ? 
            this.currentRoom.user2_id : this.currentRoom.user1_id;
    }
    
    // ✅ REMOVED: Old addVoiceCallButton method - replaced by addVoiceCallButtons()
    
    // ✅ THÊM: Method to update voice call button state
    updateVoiceCallButton() {
        const voiceCallBtn = document.getElementById('voice-call-btn');
        if (voiceCallBtn && this.voiceCallManager) {
            if (this.voiceCallManager.canMakeCall()) {
                voiceCallBtn.classList.remove('disabled');
                voiceCallBtn.disabled = false;
            } else {
                voiceCallBtn.classList.add('disabled');
                voiceCallBtn.disabled = true;
            }
        }
    }

    backToWaiting() {
        const endChatModal = document.getElementById('endChatModal');
        if (endChatModal) endChatModal.classList.add('hidden');
        this.uiModule.showWaitingRoom();
    }

    showProfile() {
        console.log('🔍 App - showProfile() called');
        this.profileEditModule.showProfileEdit();
    }

    // Delegate methods to modules
    showAuthenticatedUI() {
        this.uiModule.showAuthenticatedUI();
        // ✅ THÊM: Initialize voice call manager when user is authenticated
        this.initVoiceCallManager();
        
        // Add voice call button after a delay to ensure UI is ready
        setTimeout(() => {
            this.addVoiceCallButtons();
        }, 5000);
    }

    showLandingPage() {
        this.uiModule.showLandingPage();
    }

    showProfileWizard() {
        this.uiModule.showProfileWizard();
    }

    hideProfileWizard() {
        this.uiModule.hideProfileWizard();
    }

    // Removed duplicate methods - using UIModule directly

    showEndChatModal() {
        this.uiModule.showEndChatModal();
    }

    showModal(modalId) {
        this.uiModule.showModal(modalId);
    }

    hideModal(modalId) {
        this.uiModule.hideModal(modalId);
    }
    
    
    // ✅ THÊM: Add voice call buttons to multiple locations
    addVoiceCallButtons() {
        console.log('📞 Adding voice call buttons to multiple locations...');
        
        // No buttons to add currently
    }
    
    
    
    
    // Add hover effects helper
    addHoverEffects(button) {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
        });
    }
    
    // ✅ THÊM: Voice matching from waiting room
    async startVoiceMatching() {
        if (this.isSearching) {
            console.log('⚠️ Voice matching already in progress, ignoring');
            return;
        }
        
        console.log('📞 Starting voice matching...');
        
        // Validate user state (handle both boolean and number values for profile_completed)
        const isProfileComplete = this.currentUser && (this.currentUser.profile_completed === true || this.currentUser.profile_completed === 1);
        // Allow matching when user is idle or searching (not connected yet)
        const isValidStatus = this.currentUser && (this.currentUser.status === 'idle' || this.currentUser.status === 'searching');
        if (!this.currentUser || !isProfileComplete || !isValidStatus) {
            console.error('📞 Invalid user state for voice matching. Profile completed:', isProfileComplete, 'Status:', this.currentUser?.status, 'Valid status:', isValidStatus);
            this.utilsModule.showError('Vui lòng hoàn thiện hồ sơ và kết nối lại');
            return;
        }
        
        // ✅ NEW: Ensure VoiceCallManager is ready before matching
        if (!this.voiceCallManager) {
            console.log('📞 VoiceCallManager not ready, initializing...');
            const initSuccess = await this.initVoiceCallManager();
            if (!initSuccess) {
                this.utilsModule.showError('Không thể khởi tạo voice call. Vui lòng thử lại.');
                return;
            }
        }
        
        this.isSearching = true;
        this.isVoiceCallMode = true;
        
        // Auto-reset search flag after timeout
        const timeoutId = setTimeout(() => {
            if (this.isSearching) {
                console.log('⏰ Auto-resetting voice search flag after timeout');
                this.isSearching = false;
            }
        }, 30000);

        try {
            // Use the existing search API with voice call type and entry_mode
            const response = await fetch('/chat/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    type: 'voice_call',
                    entry_mode: 'voice',  // ✅ NEW: Entry mode support
                    match_preference: 'same_entry_mode'  // ✅ NEW: Match với voice users
                })
            });
            
            const data = await response.json();
            console.log('📞 Voice matching API response:', { status: response.status, data });
            
            if (response.ok) {
                // Show waiting room UI
                console.log('📞 Showing waiting room and starting search...');
                this.uiModule.showWaitingRoom();
                // No popup needed - UI already shows searching state
                
                // If immediate match found
                if (data.room_id && data.matched_user) {
                    console.log('📞 Immediate voice match found!');
                    this.isSearching = false; // ✅ Reset flag on match
                    this.handleVoiceMatchFound(data);
                } else {
                    // Start searching UI
                    console.log('📞 No immediate match, starting search UI...');
                    console.log('📞 RoomManager exists:', !!this.roomManager);
                    console.log('📞 ChatModule exists:', !!this.chatModule);
                    console.log('📞 ChatModule.roomManager exists:', !!this.chatModule?.roomManager);
                    
                    // ✅ ALWAYS show searching UI first
                    this.uiModule.showSearching();
                    console.log('📞 Showing searching UI');
                    
                    if (this.roomManager) {
                        this.roomManager.startSearch();
                        console.log('✅ Voice matching search started');
                    } else if (this.chatModule && this.chatModule.roomManager) {
                        console.log('📞 Using chatModule.roomManager instead');
                        this.chatModule.roomManager.startSearch();
                        console.log('✅ Voice matching search started via chatModule');
                    } else {
                        console.error('❌ RoomManager not available, search UI already shown');
                    }
                }
            } else {
                console.error('📞 Voice matching failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                });
                this.utilsModule.showError(data.detail || 'Không thể tìm kiếm voice call');
            }
            
        } catch (error) {
            console.error('📞 Voice matching error:', error);
            this.errorHandler.handleError(error, 'voice_matching');
        } finally {
            clearTimeout(timeoutId);
            this.isSearching = false;
        }
    }
    
    // ✅ SIMPLIFIED: Chat matching with entry_mode
    async startChatMatching() {
        if (this.isSearching) {
            console.log('⚠️ Chat matching already in progress, ignoring');
            return;
        }
        
        console.log('💬 Starting chat matching...');
        
        // Validate user state (handle both boolean and number values for profile_completed)
        const isProfileComplete = this.currentUser && (this.currentUser.profile_completed === true || this.currentUser.profile_completed === 1);
        // Allow matching when user is idle or searching (not connected yet)
        const isValidStatus = this.currentUser && (this.currentUser.status === 'idle' || this.currentUser.status === 'searching');
        if (!this.currentUser || !isProfileComplete || !isValidStatus) {
            console.error('💬 Invalid user state for matching. Profile completed:', isProfileComplete, 'Status:', this.currentUser?.status, 'Valid status:', isValidStatus);
            this.utilsModule.showError('Vui lòng hoàn thiện hồ sơ và kết nối lại');
            return;
        }
        
        this.isSearching = true;
        
        // Auto-reset search flag after timeout
        const timeoutId = setTimeout(() => {
            if (this.isSearching) {
                console.log('⏰ Auto-resetting chat search flag after timeout');
                this.isSearching = false;
            }
        }, 30000);

        try {
            // Use the existing search API with chat entry_mode
            const response = await fetch('/chat/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    type: 'chat',
                    entry_mode: 'chat',  // ✅ Entry mode: chat
                    match_preference: 'same_entry_mode'  // ✅ Match với chat users
                })
            });
            
            const data = await response.json();
            console.log('💬 Chat matching API response:', { status: response.status, data });
            
            if (response.ok) {
                // Show waiting room UI
                console.log('💬 Showing waiting room and starting search...');
                this.uiModule.showWaitingRoom();
                // No popup needed - UI already shows searching state
                
                // If immediate match found
                if (data.room_id && data.matched_user) {
                    console.log('💬 Immediate chat match found!');
                    this.isSearching = false; // ✅ Reset flag on match
                    this.handleChatMatchFound(data);
                } else {
                    // Start searching UI
                    console.log('💬 No immediate match, starting search UI...');
                    console.log('💬 RoomManager exists:', !!this.roomManager);
                    console.log('💬 ChatModule exists:', !!this.chatModule);
                    console.log('💬 ChatModule.roomManager exists:', !!this.chatModule?.roomManager);
                    
                    // ✅ ALWAYS show searching UI first
                    this.uiModule.showSearching();
                    console.log('💬 Showing searching UI');
                    
                    if (this.roomManager) {
                        this.roomManager.startSearch();
                        console.log('✅ Chat matching search started');
                    } else if (this.chatModule && this.chatModule.roomManager) {
                        console.log('💬 Using chatModule.roomManager instead');
                        this.chatModule.roomManager.startSearch();
                        console.log('✅ Chat matching search started via chatModule');
                    } else {
                        console.error('❌ RoomManager not available, search UI already shown');
                    }
                }
            } else {
                console.error('💬 Chat matching failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: data
                });
                this.utilsModule.showError(data.detail || 'Không thể tìm kiếm chat');
            }
            
        } catch (error) {
            console.error('💬 Chat matching error:', error);
            this.errorHandler.handleError(error, 'chat_matching');
        } finally {
            clearTimeout(timeoutId);
            this.isSearching = false;
        }
    }
    
    // ✅ NEW: Cancel search functionality
    async cancelSearch() {
        console.log('🔍 Cancelling search...');
        
        // ✅ RESET SEARCH FLAG IMMEDIATELY
        this.isSearching = false;
        
        // ✅ IMMEDIATE UI FEEDBACK
        this.uiModule.showWaitingRoom();
        
        // ✅ SMALL DELAY: Give time for any pending search requests to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            // ✅ TRY TO CANCEL VIA ROOM MANAGER FIRST
            let cancelAttempted = false;
            
            if (this.roomManager) {
                console.log('🔍 Using this.roomManager.cancelSearch()');
                await this.roomManager.cancelSearch();
                cancelAttempted = true;
                console.log('✅ RoomManager cancel completed');
            } else if (this.chatModule && this.chatModule.roomManager) {
                console.log('🔍 Using this.chatModule.roomManager.cancelSearch()');
                await this.chatModule.roomManager.cancelSearch();
                cancelAttempted = true;
                console.log('✅ ChatModule.roomManager cancel completed');
            }
            
            // ✅ FALLBACK: DIRECT API CALL IF NO ROOM MANAGER
            if (!cancelAttempted) {
                console.log('🔍 No roomManager, making direct API call');
                const response = await fetch('/chat/cancel-search', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('❌ Cancel API failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorData
                    });
                    
                    // ✅ SHOW USER-FRIENDLY ERROR MESSAGE
                    if (response.status === 400 && errorData.detail) {
                        console.log('⚠️ Cancel API returned 400, but continuing with UI cleanup');
                        // Don't show error to user - backend did cleanup anyway
                    }
                } else {
                    const responseData = await response.json();
                    console.log('✅ Direct API cancel completed:', responseData);
                    
                    if (responseData.warning) {
                        console.log('⚠️ Backend warning:', responseData.warning);
                    }
                }
            }
            
            // No popup needed - UI change is sufficient feedback
            
        } catch (error) {
            console.error('❌ Error cancelling search:', error);
            // Just log error, no popup needed
        }
        
        console.log('🔍 Cancel search completed');
    }
    
    // ✅ NEW: Handle chat match found
    handleChatMatchFound(data) {
        console.log('💬 Chat match found:', data);
        
        // Set current room
        this.setCurrentRoom({
            id: data.room_id,
            matched_user: data.matched_user,
            icebreaker: data.icebreaker,
            entry_mode: data.entry_mode || 'chat'
        });
        
        // Enter chat mode
        this.enterChatMode();
        
        // Enter chat room
        if (this.chatModule) {
            this.chatModule.enterChatRoom(data.room_id);
        }
    }
    
    // ✅ THÊM: Handle voice match found - Direct to call mode
    async handleVoiceMatchFound(data) {
        console.log('📞 Voice match found - entering direct call mode:', data);
        
        // Set current room with voice call flag
        this.currentRoom = {
            id: data.room_id,
            matched_user: data.matched_user,
            icebreaker: data.icebreaker,
            isVoiceCall: true, // ✅ Mark as voice call room
            entry_mode: 'voice'
        };
        
        // ✅ CRITICAL FIX: Join room first before doing anything else
        console.log('📞 Joining room first:', data.room_id);
        await this.chatModule.enterChatRoom(data.room_id);
        
        // ✅ CRITICAL FIX: Ensure VoiceCallManager is initialized for both users
        if (!this.voiceCallManager) {
            console.log('📞 VoiceCallManager not ready, initializing immediately...');
            const initSuccess = await this.initVoiceCallManager();
            if (!initSuccess) {
                console.error('❌ Failed to initialize VoiceCallManager for voice call');
                this.utilsModule.showError('Không thể khởi tạo voice call');
                return;
            }
        }
        
        // ✅ NEW: Ensure VoiceCallManager is ready before proceeding
        if (!this.voiceCallManager) {
            console.log('📞 VoiceCallManager not ready, initializing...');
            const initSuccess = await this.initVoiceCallManager();
            if (!initSuccess) {
                console.error('❌ Failed to initialize VoiceCallManager for voice call');
                this.utilsModule.showError('Không thể khởi tạo voice call');
                return;
            }
        }
        
        // ✅ NEW: Show call interface immediately (skip chat interface)
        console.log('📞 Showing call interface directly...');
        this.voiceCallManager.showCallInterface('connecting', 'Đang kết nối với ' + data.matched_user.nickname);
        
        // ✅ NEW: Set voice mode and skip chat interface
        this.currentMode = 'voice';
        
        // ✅ NEW: Auto-initiate call immediately (both users agree by default)
        console.log('📞 Auto-initiating voice call for both users...');
        
        // Start call immediately (no delay)
        setTimeout(() => {
            this.startDirectVoiceCall();
        }, 500); // Reduced delay for faster call start
        
        // ✅ NEW: Skip chat room entry - go straight to call
        console.log('📞 Skipping chat room - going directly to voice call');
    }
    
    // ✅ THÊM: Method để set current room
    setCurrentRoom(roomData) {
        console.log('🏠 Setting current room:', roomData);
        this.currentRoom = roomData;
        
        // Update voice call button state
        this.updateVoiceCallButton();
        
    }
    
    
    // ✅ NEW: Mode Management Methods
    enterChatMode() {
        console.log('💬 Entering chat mode');
        this.currentMode = 'chat';
        this.uiModule.showChatInterface();
        
        // ✅ IMPROVED: Show voice call button when in chat room (if other user exists)
        if (this.currentRoom && this.getOtherUserId()) {
            this.showVoiceCallButton();
            this.updateVoiceCallButtonState();
            
            // Sync voice call state with backend when entering chat
            if (this.voiceCallManager) {
                this.voiceCallManager.syncStateWithBackend().then(backendState => {
                    if (backendState) {
                        this.updateVoiceCallButtonState();
                    }
                });
            }
        }
    }
    
    enterVoiceMode() {
        console.log('📞 Entering voice mode - showing call interface');
        this.currentMode = 'voice';
        
        // ✅ NEW: Show call interface instead of chat interface
        if (this.voiceCallManager) {
            this.voiceCallManager.showCallInterface('connecting', 'Đang chuẩn bị cuộc gọi...');
        } else {
            // Fallback to chat interface if voice call manager not ready
            this.uiModule.showChatInterface();
        }
        
        this.updateVoiceCallButtonState(); // Update button state during call
        
        // Start voice call immediately if not already active
        if (!this.voiceCallManager?.getCallStatus()?.isActive) {
            this.startDirectVoiceCall();
        }
    }
    
    // ✅ SIMPLIFIED: Direct Voice Call (like WhatsApp)
    async requestVoiceCall() {
        console.log('📞 Starting direct voice call...');
        
        try {
            // Prevent duplicate calls
            if (this.voiceCallManager && !this.voiceCallManager.canMakeCall()) {
                console.warn('⚠️ Cannot make call - already in call or invalid state');
                this.utilsModule.showError('Không thể gọi ngay lúc này');
                return;
            }
            
            // Check if we have a room and other user
                    const otherUserId = this.getOtherUserId();
            if (!otherUserId) {
                this.utilsModule.showError('Không thể gọi - không có người trong phòng. Hãy thử tìm kiếm chat mới.');
                        return;
                    }
                    
            console.log('📞 Calling user:', otherUserId);
            
            // Sync state with backend first to ensure consistency
            const backendState = await this.voiceCallManager.syncStateWithBackend();
            if (backendState && backendState.hasActiveCall) {
                console.warn('⚠️ Backend indicates active call exists');
                this.utilsModule.showError('Đã có cuộc gọi đang hoạt động');
                this.updateVoiceCallButtonState();
                return;
            }
            
            // Test microphone access first
            await this.testMicrophoneAccess();
            
            // Direct call via VoiceCallManager
                    if (this.voiceCallManager) {
                await this.voiceCallManager.initiateCall(otherUserId);
                this.updateVoiceCallButtonState(); // Update button state after initiating
            } else {
                throw new Error('Voice call manager không khả dụng');
            }
            
        } catch (error) {
            console.error('❌ Error requesting voice call:', error);
            this.errorHandler.handleError(error, 'voice_call_request');
            this.updateVoiceCallButtonState(); // Reset button state on error
        }
    }
    
    // ✅ NEW: Test microphone access
    async testMicrophoneAccess() {
        try {
            console.log('🎤 Testing microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            console.log('✅ Microphone access granted');
            // Stop the test stream
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('❌ Microphone access failed:', error);
            
            let errorMessage = 'Không thể truy cập microphone';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Vui lòng cho phép truy cập microphone để thực hiện cuộc gọi';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'Không tìm thấy microphone';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Trình duyệt không hỗ trợ voice call';
            }
            
            throw new Error(errorMessage);
        }
    }
    
    // ✅ REMOVED: Invitation popup functions - not needed for direct call
    
    // ✅ REMOVED: Direct call system doesn't need invitation handling
    
    // ✅ REMOVED: All invitation popup functions - using direct call system
    
    // ✅ SIMPLIFIED: Voice call button methods
    showVoiceCallButton() {
        const voiceBtn = document.getElementById('voice-call-btn');
        if (voiceBtn) {
            voiceBtn.classList.remove('hidden');
        }
    }
    
    hideVoiceCallButton() {
        const voiceBtn = document.getElementById('voice-call-btn');
        if (voiceBtn) {
            voiceBtn.classList.add('hidden');
        }
    }

    updateVoiceCallButtonState() {
        const voiceBtn = document.getElementById('voice-call-btn');
        if (!voiceBtn) return;

        // Check if we can make a call
        const canCall = this.currentRoom && 
                       this.getOtherUserId() && 
                       this.voiceCallManager && 
                       this.voiceCallManager.canMakeCall();

        if (canCall) {
            voiceBtn.disabled = false;
            voiceBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            voiceBtn.textContent = '📞 Gọi';
        } else {
            voiceBtn.disabled = true;
            voiceBtn.classList.add('opacity-50', 'cursor-not-allowed');
            
            // Update text based on state
            if (this.voiceCallManager && this.voiceCallManager.getCallStatus().isActive) {
                voiceBtn.textContent = '📞 Đang gọi...';
            } else {
                voiceBtn.textContent = '📞 Không thể gọi';
            }
        }
    }
    
    // ✅ MODIFIED: Enhanced end voice call - Always return to waiting room
    endVoiceCall() {
        console.log('📞 Ending voice call...');
        
        if (this.voiceCallManager) {
            this.voiceCallManager.endCall();
        }
        
        // ✅ NEW: For voice call entry mode, always return to waiting room
        console.log('📞 Voice call ended - returning to waiting room');
        this.backToWaiting();
        this.utilsModule.showSuccess('Đã kết thúc cuộc gọi, quay về trang chờ');
        
        // Update button state after call ends
        this.updateVoiceCallButtonState();
    }
    

    // Removed duplicate methods - using UtilsModule directly

    // Removed duplicate methods - using UtilsModule directly

    // Removed duplicate methods - using ChatModule directly

    // Removed duplicate methods - using modules directly
    
    // Removed waitForChatModule - no longer needed with direct import
}

// Initialize the application when DOM is loaded
console.log("=== DOM CONTENT LOADED ===");
document.addEventListener('DOMContentLoaded', () => {
    console.log("✓ DOM ready, creating MapmoApp...");
    const app = new MapmoApp();
    
    // Expose app instance to global scope for debugging
    window.mapmoApp = app;
    console.log("✓ MapmoApp exposed to global scope as 'mapmoApp'");
    
    // Initialize voice call manager when ready
    setTimeout(() => {
        if (!app.voiceCallManager) {
            app.initVoiceCallManager().catch(error => {
                console.error('❌ Failed to initialize voice call manager:', error);
            });
        }
        
        // Add test functions for Call Screen UI
        window.testCallScreen = () => {
            console.log('🧪 Testing Call Screen UI...');
            if (app.callScreenManager) {
                app.callScreenManager.showCallScreen({
                    caller: {
                        nickname: 'Test User',
                        username: 'testuser',
                        avatar: 'https://via.placeholder.com/150/8B5CF6/FFFFFF?text=T'
                    }
                });
                console.log('✅ Call Screen shown');
            } else {
                console.error('❌ Call Screen Manager not available');
            }
        };
        
        window.hideCallScreen = () => {
            console.log('🧪 Hiding Call Screen...');
            if (app.callScreenManager) {
                app.callScreenManager.hideCallScreen();
                console.log('✅ Call Screen hidden');
            }
        };
        
        window.testCallControls = () => {
            console.log('🧪 Testing Call Controls...');
            if (app.callScreenManager) {
                // Test mute toggle
                app.callScreenManager.toggleMute();
                setTimeout(() => app.callScreenManager.toggleMute(), 1000);
                
                // Test speaker toggle
                setTimeout(() => app.callScreenManager.toggleSpeaker(), 2000);
                setTimeout(() => app.callScreenManager.toggleSpeaker(), 3000);
                
                // Test quality updates
                setTimeout(() => app.callScreenManager.updateCallQuality('good'), 4000);
                setTimeout(() => app.callScreenManager.updateCallQuality('poor'), 5000);
                setTimeout(() => app.callScreenManager.updateCallQuality('excellent'), 6000);
                
                console.log('✅ Call Controls test started');
            }
        };
        
        // Add debug info for Call Screen
        window.debugCallScreen = () => {
            console.log('🔍 Call Screen Debug Info:');
            console.log('  - Call Screen Manager:', !!app.callScreenManager);
            console.log('  - Call Screen Element:', !!document.getElementById('call-screen'));
            console.log('  - Current State:', app.callScreenManager?.getCallState());
            console.log('  - Voice Call Manager:', !!app.voiceCallManager);
        };
        
        // Add audio test functions
        window.testAudioTransmission = async () => {
            console.log('🎵 Testing audio transmission...');
            try {
                // Test microphone access
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('✅ Microphone access granted');
                
                // Test audio context
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                source.connect(analyser);
                
                // Test audio levels
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                console.log('🎵 Audio level:', average);
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
                audioContext.close();
                
                return { success: true, audioLevel: average };
            } catch (error) {
                console.error('❌ Audio test failed:', error);
                return { success: false, error: error.message };
            }
        };
        
        window.testWebRTCConnection = async () => {
            console.log('🔗 Testing WebRTC connection...');
            try {
                // Create a simple peer connection
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                
                // Add audio track
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                });
                
                // Test ICE gathering
                const icePromise = new Promise((resolve) => {
                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            console.log('🔗 ICE candidate:', event.candidate);
                        } else {
                            console.log('🔗 ICE gathering complete');
                            resolve();
                        }
                    };
                });
                
                // Create offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log('🔗 Local description set');
                
                // Wait for ICE gathering
                await icePromise;
                
                // Clean up
                pc.close();
                stream.getTracks().forEach(track => track.stop());
                
                return { success: true };
            } catch (error) {
                console.error('❌ WebRTC test failed:', error);
                return { success: false, error: error.message };
            }
        };
        
        window.testFullCallFlow = async () => {
            console.log('📞 Testing full call flow...');
            try {
                // Test 1: Audio transmission
                console.log('🎵 Step 1: Testing audio transmission...');
                const audioTest = await testAudioTransmission();
                if (!audioTest.success) {
                    throw new Error('Audio test failed: ' + audioTest.error);
                }
                console.log('✅ Audio transmission OK');
                
                // Test 2: WebRTC setup
                console.log('🔗 Step 2: Testing WebRTC setup...');
                const webrtcTest = await testWebRTCConnection();
                if (!webrtcTest.success) {
                    throw new Error('WebRTC test failed: ' + webrtcTest.error);
                }
                console.log('✅ WebRTC setup OK');
                
                // Test 3: Voice Call Manager
                console.log('📞 Step 3: Testing Voice Call Manager...');
                if (!app.voiceCallManager) {
                    throw new Error('Voice Call Manager not initialized');
                }
                console.log('✅ Voice Call Manager OK');
                
                // Test 4: Call Screen Manager
                console.log('📱 Step 4: Testing Call Screen Manager...');
                if (!app.callScreenManager) {
                    throw new Error('Call Screen Manager not initialized');
                }
                console.log('✅ Call Screen Manager OK');
                
                // Test 5: WebSocket connection
                console.log('🔌 Step 5: Testing WebSocket connection...');
                if (!app.webSocketManager || !app.webSocketManager.websocket) {
                    throw new Error('WebSocket not connected');
                }
                console.log('✅ WebSocket connection OK');
                
                console.log('🎉 All tests passed! Call system is ready.');
                return { success: true, message: 'All tests passed!' };
                
            } catch (error) {
                console.error('❌ Full call flow test failed:', error);
                return { success: false, error: error.message };
            }
        };
        
        console.log('🔧 Test functions added:');
        console.log('  - testCallScreen() - Show call screen');
        console.log('  - hideCallScreen() - Hide call screen');
        console.log('  - testCallControls() - Test controls');
        console.log('  - debugCallScreen() - Debug info');
        console.log('  - testAudioTransmission() - Test audio input');
        console.log('  - testWebRTCConnection() - Test WebRTC setup');
        console.log('  - testFullCallFlow() - Test complete call system');
    }, 1000);
});
