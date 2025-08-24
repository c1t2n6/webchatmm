// Mapmo.vn - Main Application using Modules
console.log("=== MAPMO APP LOADED ===");

// Import modules
import { AuthModule } from './modules/auth.js';
import { ProfileModule } from './modules/profile.js';
// ChatModule is loaded as a global script
import { LikeModule } from './modules/like.js';
import { UIModule } from './modules/ui.js';
import { UtilsModule } from './modules/utils.js';

class MapmoApp {
    constructor() {
        console.log('🔍 App - Constructor called');
        this.currentUser = null;
        this.currentRoom = null;
        
        // Initialize modules
        console.log('🔍 App - Initializing modules...');
        this.authModule = new AuthModule(this);
        this.profileModule = new ProfileModule(this);
        
        // Check if ChatModule is available
        if (typeof window.ChatModule !== 'undefined') {
            console.log('✅ ChatModule found, initializing...');
            this.chatModule = new window.ChatModule(this);
            // Khởi tạo ChatModule
            this.chatModule.init();
        } else {
            console.error('❌ ChatModule not found! Waiting for it...');
            // Wait for ChatModule to be available
            this.waitForChatModule();
        }
        
        this.likeModule = new LikeModule(this);
        this.uiModule = new UIModule(this);
        this.utilsModule = new UtilsModule(this);
        console.log('🔍 App - Modules initialized');
        
        console.log('🔍 App - Calling init()...');
        this.init();
        console.log('🔍 App - Constructor completed');
    }

    init() {
        console.log('🔍 App - init() called');
        this.bindEvents();
        console.log('🔍 App - About to call checkAuthStatus()');
        this.authModule.checkAuthStatus();
        console.log('🔍 App - checkAuthStatus() called');
        this.uiModule.setupDarkMode();
        console.log('🔍 App - init() completed');
    }

    bindEvents() {
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
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.chatModule.sendMessage();
            });
        }
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
    }

    // Navigation
    handleChatClick() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            this.uiModule.showModal('loginModal');
        } else if (!this.currentUser) {
            this.authModule.checkAuthStatus().then(() => {
                if (this.currentUser) {
                    this.uiModule.showWaitingRoom();
                } else {
                    this.uiModule.showModal('loginModal');
                }
            });
        } else {
            this.uiModule.showWaitingRoom();
        }
    }

    handleVoiceClick() {
        const token = localStorage.getItem('access_token');
        if (!token) {
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
        this.utilsModule.showError('Tính năng chỉnh sửa hồ sơ sẽ ra mắt sớm!');
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

    showWaitingRoom() {
        this.uiModule.showWaitingRoom();
    }

    showSearching() {
        this.uiModule.showSearching();
    }

    showChatRoom() {
        console.log('🔍 App - showChatRoom called');
        this.uiModule.showChatRoom();
    }

    showEndChatModal() {
        this.uiModule.showEndChatModal();
    }

    showModal(modalId) {
        this.uiModule.showModal(modalId);
    }

    hideModal(modalId) {
        this.uiModule.hideModal(modalId);
    }

    showError(message) {
        this.utilsModule.showError(message);
    }

    showSuccess(message) {
        this.utilsModule.showSuccess(message);
    }

    escapeHtml(text) {
        return this.utilsModule.escapeHtml(text);
    }

    formatTime(timestamp) {
        return this.utilsModule.formatTime(timestamp);
    }

    connectChatWebSocket(roomId) {
        console.log('🔍 App - connectChatWebSocket called with roomId:', roomId);
        this.chatModule.connectChatWebSocket(roomId);
    }

    disconnectWebSocket() {
        this.chatModule.disconnectWebSocket();
    }

    showLikeModal() {
        this.likeModule.showLikeModal();
    }

    handleImageReveal(data) {
        this.utilsModule.handleImageReveal(data);
    }

    handleChatEnded() {
        this.utilsModule.handleChatEnded();
    }
    
    // Wait for ChatModule to be available
    waitForChatModule() {
        console.log('🔍 Waiting for ChatModule...');
        const checkInterval = setInterval(() => {
            if (typeof window.ChatModule !== 'undefined') {
                console.log('✅ ChatModule found! Initializing...');
                clearInterval(checkInterval);
                this.chatModule = new window.ChatModule(this);
                // Khởi tạo ChatModule
                this.chatModule.init();
                console.log('✅ ChatModule initialized successfully!');
            }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.chatModule || typeof this.chatModule.startSearch === 'undefined') {
                console.error('❌ ChatModule still not available after timeout!');
                // Create fallback
                this.chatModule = {
                    startSearch: () => this.utilsModule.showError('ChatModule not loaded'),
                    cancelSearch: () => this.utilsModule.showError('ChatModule not loaded'),
                    handleWebSocketMessage: () => console.error('ChatModule not loaded'),
                    handleRoomEndedByUser: () => console.error('ChatModule not loaded')
                };
            }
        }, 5000);
    }
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
