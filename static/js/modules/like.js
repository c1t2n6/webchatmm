// Like System Module
export class LikeModule {
    constructor(app) {
        this.app = app;
        this.likeTimer = null;
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

    async handleLike(liked) {
        if (this.likeTimer) {
            clearInterval(this.likeTimer);
        }
        
        try {
            const response = await fetch(`/chat/like/${this.app.currentRoom.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}` 
                },
                body: JSON.stringify({ liked })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.both_liked) {
                    this.showImageReveal();
                } else if (result.need_second_round) {
                    setTimeout(() => {
                        this.showLikeModal();
                    }, 5 * 60 * 1000);
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
        this.app.showSuccess('Cả hai đều thích nhau! Ảnh sẽ được mở khóa dần dần.');
    }
}
