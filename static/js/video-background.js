// Background Controller - Supports Video, GIF, or Image
class BackgroundController {
    constructor() {
        this.video = document.getElementById('backgroundVideo');
        this.gif = document.getElementById('backgroundGif');
        this.image = document.getElementById('backgroundImage');
        this.container = document.getElementById('backgroundContainer');
        this.isLoaded = false;
        this.isPlaying = false;
        this.mediaType = null; // 'video', 'gif', or 'image'
        
        this.init();
    }
    
    init() {
        // Determine which media type is being used
        if (this.video && this.video.offsetParent !== null) {
            this.mediaType = 'video';
            this.setupVideoListeners();
            this.preloadVideo();
        } else if (this.gif && this.gif.offsetParent !== null) {
            this.mediaType = 'gif';
            this.setupImageListeners(this.gif);
        } else if (this.image && this.image.offsetParent !== null) {
            this.mediaType = 'image';
            this.setupImageListeners(this.image);
        } else {
            console.warn('No background media element found');
            return;
        }
        
        console.log(`Background type: ${this.mediaType}`);
    }
    
    setupImageListeners(element) {
        if (element.complete) {
            this.handleLoad();
        } else {
            element.addEventListener('load', () => this.handleLoad());
            element.addEventListener('error', () => this.handleError());
        }
    }
    
    setupVideoListeners() {
        if (!this.video) return;
        
        this.setupEventListeners();
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
        if (this.container) {
            this.container.classList.add('video-loading');
        }
    }
    
    hideLoading() {
        if (this.container) {
            this.container.classList.remove('video-loading');
        }
    }
    
    handleVideoError() {
        console.warn('Background media failed to load, using fallback');
        this.showFallbackBackground();
    }
    
    handleError() {
        console.warn('Background media failed to load, using fallback');
        this.showFallbackBackground();
    }
    
    handleLoad() {
        this.isLoaded = true;
        console.log(`✅ Background ${this.mediaType} loaded successfully`);
    }
    
    showFallbackBackground() {
        if (this.container) {
            this.container.style.background = 'linear-gradient(135deg, #2a1f1a 0%, #1a0f0a 100%)';
            if (this.video) this.video.style.display = 'none';
            if (this.gif) this.gif.style.display = 'none';
            if (this.image) this.image.style.display = 'none';
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
    // Initialize background controller (automatically detects video/gif/image)
    window.backgroundController = new BackgroundController();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackgroundController;
}

// Keep VideoBackgroundController alias for backward compatibility
if (typeof window !== 'undefined') {
    window.VideoBackgroundController = BackgroundController;
    window.videoBackground = window.backgroundController;
}

