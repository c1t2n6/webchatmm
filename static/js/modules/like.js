// Like System Module
export class LikeModule {
    constructor(app) {
        this.app = app;
        this.likeTimer = null;
        
        // ✅ THÊM: TimerManager để quản lý timer
        this.timerManager = null;
        this.initTimerManager();
    }

    // ✅ THÊM: Khởi tạo TimerManager
    async initTimerManager() {
        try {
            // Import TimerManager module
            const { TimerManager } = await import('./timer_manager.js');
            this.timerManager = new TimerManager();
            console.log('🔍 Like - TimerManager initialized successfully');
        } catch (error) {
            console.error('🔍 Like - Failed to initialize TimerManager:', error);
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

    showLikeModal() {
        const likeModal = document.getElementById('likeModal');
        if (likeModal) {
            likeModal.classList.remove('hidden');
            this.startLikeTimer();
        }
    }

    startLikeTimer() {
        let timeLeft = 30;
        const timerBar = document.getElementById('likeTimer');
        const timeDisplay = document.getElementById('likeTimeLeft');
        
        if (!timerBar || !timeDisplay) return;
        
        // ✅ SỬA: Sử dụng TimerManager để quản lý interval
        if (this.timerManager) {
            this.likeTimer = this.timerManager.setInterval('like_countdown_30s', () => {
                timeLeft--;
                const percentage = (timeLeft / 30) * 100;
                timerBar.style.width = `${percentage}%`;
                timeDisplay.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    this.handleLike(false);
                }
            }, 1000);
        } else {
            // Fallback nếu TimerManager chưa sẵn sàng
            this.likeTimer = setInterval(() => {
                timeLeft--;
                const percentage = (timeLeft / 30) * 100;
                timerBar.style.width = `${percentage}%`;
                timeDisplay.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    this.handleLike(false);
                }
            }, 1000);
        }
    }

    async handleLike(liked) {
        // ✅ SỬA: Clear timer sử dụng TimerManager
        if (this.timerManager) {
            this.timerManager.clearInterval('like_countdown_30s');
        } else if (this.likeTimer) {
            clearInterval(this.likeTimer);
        }
        
        // Sử dụng currentRoomId từ chat module hoặc fallback
        const roomId = this.app.chatModule?.currentRoomId || (this.app.currentRoom && this.app.currentRoom.id);
        if (!roomId) {
            console.error('🔍 Like - No room ID available for like response');
            return;
        }
        
        console.log('🔍 Like - Sending like response for room:', roomId);
        
        try {
            const response = await fetch(`/chat/like/${roomId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}` 
                },
                body: JSON.stringify({ response: liked ? "yes" : "no" })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.both_liked) {
                    this.showImageReveal();
                } else if (result.need_second_round) {
                    // ✅ SỬA: Sử dụng TimerManager cho second round
                    if (this.timerManager) {
                        this.timerManager.setTimer('like_modal_second_round', () => {
                            this.showLikeModal();
                        }, 5 * 60 * 1000);
                    } else {
                        setTimeout(() => {
                            this.showLikeModal();
                        }, 5 * 60 * 1000);
                    }
                }
            }
        } catch (error) {
            console.error('Like error:', error);
        }
        
        const likeModal = document.getElementById('likeModal');
        if (likeModal) {
            likeModal.classList.add('hidden');
        }
    }

    showImageReveal() {
        this.app.utilsModule.showSuccess('Cả hai đều thích nhau! Ảnh sẽ được mở khóa dần dần.');
    }
}
