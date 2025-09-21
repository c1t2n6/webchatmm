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

class MapmoApp {
    constructor() {
        console.log('🔍 App - Constructor called');
        this.currentUser = null;
        this.currentRoom = null;
        
        // Clean state management
        
        // ✅ THÊM: Flag để tránh duplicate event listeners
        this.eventsBound = false;
        
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
        
        // ✅ THÊM: Khởi tạo TimerManager cho app
        this.timerManager = null;
        this.initTimerManager();
        
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
            voiceBtn.addEventListener('click', () => this.handleVoiceClick());
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

        // Waiting room
        const startChat = document.getElementById('startChat');
        if (startChat) {
            startChat.addEventListener('click', () => this.chatModule.startSearch());
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

        // Like modal
        const likeYes = document.getElementById('likeYes');
        const likeNo = document.getElementById('likeNo');

        if (likeYes) {
            likeYes.addEventListener('click', () => this.likeModule.handleLike(true));
        }
        if (likeNo) {
            likeNo.addEventListener('click', () => this.likeModule.handleLike(false));
        }

        // Other buttons
        const cancelSearch = document.getElementById('cancelSearch');
        const backToWaiting = document.getElementById('backToWaiting');
        const profileBtn = document.getElementById('profileBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (cancelSearch) {
            cancelSearch.addEventListener('click', () => this.chatModule.cancelSearch());
        }
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
        
        // Check if profile is completed
        if (this.currentUser && !this.currentUser.profile_completed) {
            console.log('🔍 App - Profile not completed, showing smart prompt');
            this.showProfilePrompt();
        } else {
            console.log('🔍 App - Profile completed, showing waiting room');
            this.uiModule.showWaitingRoom();
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

    handleVoiceClick() {
        console.log('🔍 App - handleVoiceClick called');
        
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.log('🔍 App - No token for voice, showing login modal');
            this.uiModule.showModal('loginModal');
        } else {
            this.utilsModule.showError('Tính năng Voice Call sẽ ra mắt sớm!');
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
});
