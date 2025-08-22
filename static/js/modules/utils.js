// Utilities Module
export class UtilsModule {
    constructor(app) {
        this.app = app;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    showError(message) {
        alert(`Lỗi: ${message}`);
    }

    showSuccess(message) {
        alert(`Thành công: ${message}`);
    }

    handleImageReveal(data) {
        console.log('Image reveal event:', data);
    }

    handleChatEnded() {
        console.log('Chat ended');
        this.app.uiModule.showEndChatModal();
    }
}
