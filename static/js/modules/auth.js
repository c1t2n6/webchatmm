// Authentication Module
export class AuthModule {
    constructor(app) {
        this.app = app;
    }

    async checkAuthStatus() {
        console.log('🔍 Auth - checkAuthStatus() called');
        const token = localStorage.getItem('access_token');
        console.log('🔍 Auth - Token found:', !!token);
        if (token) {
            console.log('🔍 Auth - Token exists, checking profile...');
            try {
                const response = await fetch('/user/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log('🔍 Auth - Profile response status:', response.status);
                if (response.ok) {
                    this.app.currentUser = await response.json();
                    console.log('🔍 Auth check - User data:', this.app.currentUser);
                    console.log('🔍 Auth check - Status:', this.app.currentUser.status);
                    console.log('🔍 Auth check - Room ID:', this.app.currentUser.current_room_id);
                    
                    this.app.showAuthenticatedUI();
                    
                    const hasCompletedProfile = localStorage.getItem(`profile_completed_${this.app.currentUser.id}`);
                    
                    if (!this.app.currentUser.profile_completed && !hasCompletedProfile) {
                        console.log('🔍 Auth check - Showing profile wizard');
                        this.app.showProfileWizard();
                    } else {
                        console.log('🔍 Auth check - Profile completed, checking room status');
                        console.log('🔍 Auth check - Status comparison:', this.app.currentUser.status, '===', 'Connected', '=', this.app.currentUser.status === 'Connected');
                        console.log('🔍 Auth check - Room ID check:', this.app.currentUser.current_room_id, 'truthy =', !!this.app.currentUser.current_room_id);
                        console.log('🔍 Auth check - Status toLowerCase:', this.app.currentUser.status.toLowerCase());
                        console.log('🔍 Auth check - Status comparison (case-insensitive):', this.app.currentUser.status.toLowerCase(), '===', 'connected', '=', this.app.currentUser.status.toLowerCase() === 'connected');
                        
                        if (this.app.currentUser.status.toLowerCase() === 'connected' && this.app.currentUser.current_room_id) {
                            console.log('🔍 Auth check - User connected to room, redirecting to chat');
                            this.app.currentRoom = { id: this.app.currentUser.current_room_id };
                            this.app.showChatRoom();
                            
                            // Đảm bảo ChatModule đã được khởi tạo trước khi kết nối WebSocket
                            if (this.app.chatModule && typeof this.app.chatModule.connectChatWebSocket === 'function') {
                                console.log('🔍 Auth check - ChatModule ready, connecting to chat WebSocket');
                                this.app.chatModule.connectChatWebSocket(this.app.currentUser.current_room_id);
                            } else {
                                console.log('🔍 Auth check - ChatModule not ready yet, will connect later');
                                // Lưu thông tin room để kết nối sau khi ChatModule sẵn sàng
                                this.app.pendingChatConnection = {
                                    roomId: this.app.currentUser.current_room_id,
                                    timestamp: Date.now()
                                };
                            }
                        } else {
                            console.log('🔍 Auth check - User not connected, showing waiting room');
                            console.log('🔍 Auth check - Reason: status !== Connected OR no room_id');
                            console.log('🔍 Auth check - Status check failed:', this.app.currentUser.status.toLowerCase() !== 'connected');
                            console.log('🔍 Auth check - Room ID check failed:', !this.app.currentUser.current_room_id);
                            this.app.showWaitingRoom();
                        }
                    }
                } else {
                    console.log('🔍 Auth check - Profile fetch failed');
                    localStorage.removeItem('access_token');
                    this.app.showLandingPage();
                }
            } catch (error) {
                console.error('🔍 Auth check - Error:', error);
                localStorage.removeItem('access_token');
                this.app.showLandingPage();
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.app.showError('Vui lòng điền đầy đủ thông tin');
            return;
        }

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('access_token', data.access_token);
                this.app.currentUser = data.user;
                console.log('🔍 Login - User data:', this.app.currentUser);
                console.log('🔍 Login - Status:', this.app.currentUser.status);
                console.log('🔍 Login - Room ID:', this.app.currentUser.current_room_id);
                
                this.app.hideModal('loginModal');
                this.app.showAuthenticatedUI();
                
                const hasCompletedProfile = localStorage.getItem(`profile_completed_${this.app.currentUser.id}`);
                
                if (!this.app.currentUser.profile_completed && !hasCompletedProfile) {
                    console.log('🔍 Login - Showing profile wizard');
                    this.app.showProfileWizard();
                } else {
                    console.log('🔍 Login - Profile completed, checking room status');
                    if (this.app.currentUser.status.toLowerCase() === 'connected' && this.app.currentUser.current_room_id) {
                        console.log('🔍 Login - User connected to room, redirecting to chat');
                        this.app.currentRoom = { id: this.app.currentUser.current_room_id };
                        this.app.showChatRoom();
                        
                        // Đảm bảo ChatModule đã được khởi tạo trước khi kết nối WebSocket
                        if (this.app.chatModule && typeof this.app.chatModule.connectChatWebSocket === 'function') {
                            console.log('🔍 Login - ChatModule ready, connecting to chat WebSocket');
                            this.app.chatModule.connectChatWebSocket(this.app.currentUser.current_room_id);
                        } else {
                            console.log('🔍 Login - ChatModule not ready yet, will connect later');
                            // Lưu thông tin room để kết nối sau khi ChatModule sẵn sàng
                            this.app.pendingChatConnection = {
                                roomId: this.app.currentUser.current_room_id,
                                timestamp: Date.now()
                            };
                        }
                    } else {
                        console.log('🔍 Login - User not connected, showing waiting room');
                        this.app.showWaitingRoom();
                    }
                }
            } else {
                const error = await response.json();
                this.app.showError(error.detail || 'Đăng nhập thất bại');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.app.showError('Lỗi kết nối');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const username = document.getElementById('signupUsername').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        if (!username || !password) {
            this.app.showError('Vui lòng điền đầy đủ thông tin');
            return;
        }

        if (password.length < 6) {
            this.app.showError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        if (password !== confirmPassword) {
            this.app.showError('Mật khẩu xác nhận không khớp');
            return;
        }

        try {
            const response = await fetch('/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('access_token', data.access_token);
                this.app.currentUser = data.user;
                this.app.hideModal('signupModal');
                this.app.showAuthenticatedUI();
                this.app.showProfileWizard();
            } else {
                const error = await response.json();
                this.app.showError(error.detail || 'Đăng ký thất bại');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.app.showError('Lỗi kết nối');
        }
    }

    async logout() {
        try {
            await fetch('/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        localStorage.removeItem('access_token');
        this.app.currentUser = null;
        this.app.disconnectWebSocket();
        this.app.showLandingPage();
    }
}
