// UI Management Module
export class UIModule {
    constructor(app) {
        this.app = app;
    }

    showLandingPage() {
        this.hideAllSections();
        const landingPage = document.getElementById('landingPage');
        if (landingPage) landingPage.classList.remove('hidden');
        this.hideAuthenticatedUI();
    }

    showAuthenticatedUI() {
        const profileBtn = document.getElementById('profileBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (profileBtn) profileBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
    }

    hideAuthenticatedUI() {
        const profileBtn = document.getElementById('profileBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (profileBtn) profileBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }

    showProfileWizard() {
        this.hideAllSections();
        const profileWizard = document.getElementById('profileWizard');
        if (profileWizard) profileWizard.classList.remove('hidden');
    }

    hideProfileWizard() {
        const profileWizard = document.getElementById('profileWizard');
        if (profileWizard) profileWizard.classList.add('hidden');
    }

    showWaitingRoom() {
        console.log('🔍 UI - showWaitingRoom called');
        this.hideAllSections();
        const waitingRoom = document.getElementById('waitingRoom');
        if (waitingRoom) {
            waitingRoom.classList.remove('hidden');
            console.log('🔍 UI - Waiting room shown');
        } else {
            console.log('🔍 UI - Waiting room element not found');
        }
    }

    showSearching() {
        this.hideAllSections();
        const searching = document.getElementById('searching');
        if (searching) searching.classList.remove('hidden');
    }

    showChatRoom() {
        console.log('🔍 UI - showChatRoom called');
        this.hideAllSections();
        const chatRoom = document.getElementById('chatRoom');
        if (chatRoom) {
            chatRoom.classList.remove('hidden');
            console.log('🔍 UI - Chat room shown');
        } else {
            console.log('🔍 UI - Chat room element not found');
        }
        
        if (this.app.currentRoom && this.app.currentRoom.matched_user) {
            console.log('🔍 UI - Setting up matched user info');
            const matchedUser = this.app.currentRoom.matched_user;
            
            const matchedUserElement = document.getElementById('matchedUser');
            if (matchedUserElement) {
                matchedUserElement.textContent = matchedUser.nickname || matchedUser.username;
            }
            
            const avatarElement = document.getElementById('matchedUserAvatar');
            if (avatarElement && matchedUser.avatar_url) {
                avatarElement.src = matchedUser.avatar_url;
            }
            
            if (this.app.currentRoom.icebreaker) {
                this.app.chatModule.addMessageToChat({
                    content: this.app.currentRoom.icebreaker,
                    user_id: 'system',
                    timestamp: new Date().toISOString(),
                    isIcebreaker: true
                });
            }
        }
    }

    showEndChatModal() {
        const endChatModal = document.getElementById('endChatModal');
        if (endChatModal) endChatModal.classList.remove('hidden');
    }

    hideAllSections() {
        const sections = ['landingPage', 'profileWizard', 'waitingRoom', 'searching', 'chatRoom'];
        sections.forEach(section => {
            const element = document.getElementById(section);
            if (element) element.classList.add('hidden');
        });
    }

    showModal(modalId) {
        console.log('🔍 UI - showModal called for:', modalId);
        
        const modal = document.getElementById(modalId);
        if (modal) {
            console.log('🔍 UI - Showing modal:', modalId);
            modal.classList.remove('hidden');
        } else {
            console.log('🔍 UI - Modal not found:', modalId);
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }

    setupDarkMode() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            const isDark = localStorage.getItem('darkMode') === 'true';
            
            if (isDark) {
                document.documentElement.classList.add('dark');
            }
            
            darkModeToggle.addEventListener('click', () => {
                document.documentElement.classList.toggle('dark');
                const isDark = document.documentElement.classList.contains('dark');
                localStorage.setItem('darkMode', isDark);
            });
        }
    }
}
