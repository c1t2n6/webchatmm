// Video Background Controller
class VideoBackgroundController {
    constructor() {
        this.video = document.getElementById('backgroundVideo');
        this.videoContainer = document.getElementById('videoBackground');
        this.isLoaded = false;
        this.isPlaying = false;
        
        this.init();
    }
    
    init() {
        if (!this.video) {
            console.warn('Video background element not found');
            return;
        }
        
        this.setupEventListeners();
        this.preloadVideo();
    }
    
    setupEventListeners() {
        // Video load events
        this.video.addEventListener('loadeddata', () => {
            console.log('Video background loaded');
            this.isLoaded = true;
            this.hideLoading();
        });
        
        this.video.addEventListener('canplay', () => {
            console.log('Video background can play');
            this.playVideo();
        });
        
        this.video.addEventListener('error', (e) => {
            console.error('Video background error:', e);
            this.handleVideoError();
        });
        
        // Visibility change events
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseVideo();
            } else {
                this.playVideo();
            }
        });
        
        // Page focus events
        window.addEventListener('focus', () => {
            this.playVideo();
        });
        
        window.addEventListener('blur', () => {
            this.pauseVideo();
        });
    }
    
    preloadVideo() {
        // Show loading state
        this.showLoading();
        
        // Preload video
        this.video.load();
    }
    
    playVideo() {
        if (this.video && this.isLoaded && !this.isPlaying) {
            this.video.play().catch(error => {
                console.warn('Video autoplay failed:', error);
                // Fallback: show static background
                this.showFallbackBackground();
            });
            this.isPlaying = true;
        }
    }
    
    pauseVideo() {
        if (this.video && this.isPlaying) {
            this.video.pause();
            this.isPlaying = false;
        }
    }
    
    showLoading() {
        if (this.videoContainer) {
            this.videoContainer.classList.add('video-loading');
        }
    }
    
    hideLoading() {
        if (this.videoContainer) {
            this.videoContainer.classList.remove('video-loading');
        }
    }
    
    handleVideoError() {
        console.warn('Video background failed to load, using fallback');
        this.showFallbackBackground();
    }
    
    showFallbackBackground() {
        if (this.videoContainer) {
            this.videoContainer.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            this.video.style.display = 'none';
        }
    }
    
    // Public methods
    toggleVideo() {
        if (this.isPlaying) {
            this.pauseVideo();
        } else {
            this.playVideo();
        }
    }
    
    setVideoOpacity(opacity) {
        if (this.video) {
            this.video.style.opacity = opacity;
        }
    }
    
    // Check if video is supported
    static isVideoSupported() {
        const video = document.createElement('video');
        return !!(video.canPlayType && video.canPlayType('video/mp4'));
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if video is supported
    if (VideoBackgroundController.isVideoSupported()) {
        window.videoBackground = new VideoBackgroundController();
    } else {
        console.warn('Video not supported, using fallback background');
        // Show fallback background
        const videoContainer = document.getElementById('videoBackground');
        if (videoContainer) {
            videoContainer.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoBackgroundController;
}
