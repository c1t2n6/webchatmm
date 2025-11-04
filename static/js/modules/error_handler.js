// Frontend Error Handler for Voice Call System
// Handles consistent error display and user feedback

export class ErrorHandler {
    constructor(app) {
        this.app = app;
        
        // Error code to user action mapping
        this.errorActions = {
            'USER_ALREADY_IN_CALL': () => this.handleUserInCall(),
            'TARGET_USER_BUSY': () => this.handleTargetBusy(),
            'USERS_NOT_IN_SAME_ROOM': () => this.handleNotInSameRoom(),
            'ROOM_ENDED': () => this.handleRoomEnded(),
            'CALL_NOTIFICATIONS_DISABLED': () => this.handleNotificationsDisabled(),
            'MICROPHONE_PERMISSION_DENIED': () => this.handleMicrophonePermission(),
            'CONNECTION_FAILED': () => this.handleConnectionFailed(),
            'CALL_TIMEOUT': () => this.handleCallTimeout(),
            'SYSTEM_ERROR': () => this.handleSystemError()
        };
    }

    // Main error handling method
    handleError(error, context = 'general') {
        console.error(`❌ Error in ${context}:`, error);
        
        // If error has structured format from backend
        if (error && error.code) {
            return this.handleStructuredError(error, context);
        }
        
        // Handle string errors (legacy)
        if (typeof error === 'string') {
            return this.handleStringError(error, context);
        }
        
        // Fallback for unknown error formats
        return this.handleUnknownError(error, context);
    }

    handleStructuredError(error, context) {
        const { code, message, description } = error;
        
        // Execute specific action for error code
        if (this.errorActions[code]) {
            this.errorActions[code]();
        } else {
            // Show generic error
            this.showErrorToUser(message, description);
        }
        
        // Log for debugging
        console.log(`📊 Structured error handled: ${code} in ${context}`);
        
        return {
            handled: true,
            code,
            userMessage: message
        };
    }

    handleStringError(errorString, context) {
        // Map common string errors to structured handling
        const errorMappings = {
            'Đang trong cuộc gọi khác': 'USER_ALREADY_IN_CALL',
            'Người dùng đang bận': 'TARGET_USER_BUSY',
            'Không có quyền truy cập microphone': 'MICROPHONE_PERMISSION_DENIED',
            'Không tìm thấy microphone': 'MICROPHONE_NOT_FOUND',
            'Lỗi hệ thống': 'SYSTEM_ERROR'
        };

        const errorCode = errorMappings[errorString];
        if (errorCode && this.errorActions[errorCode]) {
            this.errorActions[errorCode]();
        } else {
            this.showErrorToUser(errorString);
        }

        return {
            handled: true,
            code: errorCode || 'UNKNOWN',
            userMessage: errorString
        };
    }

    handleUnknownError(error, context) {
        console.error('❌ Unknown error format:', error);
        this.showErrorToUser('Đã có lỗi xảy ra', 'Vui lòng thử lại sau');
        
        return {
            handled: false,
            code: 'UNKNOWN_ERROR',
            userMessage: 'Lỗi không xác định'
        };
    }

    // Specific error handlers
    handleUserInCall() {
        this.showErrorToUser(
            'Đang có cuộc gọi khác', 
            'Vui lòng kết thúc cuộc gọi hiện tại trước khi gọi mới'
        );
        // Update UI state
        if (this.app.updateVoiceCallButtonState) {
            this.app.updateVoiceCallButtonState();
        }
    }

    handleTargetBusy() {
        this.showErrorToUser(
            'Người dùng đang bận', 
            'Người bạn muốn gọi đang trong cuộc gọi khác. Hãy thử lại sau.'
        );
    }

    handleNotInSameRoom() {
        this.showErrorToUser(
            'Không cùng phòng chat', 
            'Bạn và người được gọi không trong cùng phòng chat'
        );
        // Navigate back to waiting room
        setTimeout(() => {
            if (this.app.backToWaiting) {
                this.app.backToWaiting();
            }
        }, 2000);
    }

    handleRoomEnded() {
        this.showErrorToUser(
            'Phòng chat đã kết thúc', 
            'Không thể gọi trong phòng đã kết thúc'
        );
        // Navigate back to waiting room
        setTimeout(() => {
            if (this.app.backToWaiting) {
                this.app.backToWaiting();
            }
        }, 1500);
    }

    handleNotificationsDisabled() {
        this.showErrorToUser(
            'Không thể gọi', 
            'Người dùng đã tắt thông báo cuộc gọi'
        );
    }

    handleMicrophonePermission() {
        this.showErrorToUser(
            'Cần quyền truy cập microphone', 
            'Vui lòng cho phép truy cập microphone trong cài đặt trình duyệt'
        );
        // Show help modal or link
        this.showMicrophoneHelp();
    }

    handleConnectionFailed() {
        this.showErrorToUser(
            'Kết nối thất bại', 
            'Không thể thiết lập kết nối. Kiểm tra mạng và thử lại.'
        );
        // Offer retry option
        setTimeout(() => {
            if (this.app.updateVoiceCallButtonState) {
                this.app.updateVoiceCallButtonState();
            }
        }, 3000);
    }

    handleCallTimeout() {
        this.showErrorToUser(
            'Hết thời gian chờ', 
            'Người được gọi không phản hồi. Hãy thử lại sau.'
        );
    }

    handleSystemError() {
        this.showErrorToUser(
            'Lỗi hệ thống', 
            'Đã có lỗi xảy ra. Vui lòng thử lại sau.'
        );
        // Reset call state
        if (this.app.voiceCallManager) {
            this.app.voiceCallManager.resetCallState();
        }
    }

    // UI helpers
    showErrorToUser(title, description = null) {
        if (this.app.utilsModule && this.app.utilsModule.showError) {
            const message = description ? `${title}: ${description}` : title;
            this.app.utilsModule.showError(message);
        } else {
            // Fallback to alert
            const message = description ? `${title}\n${description}` : title;
            alert(message);
        }
    }

    showMicrophoneHelp() {
        // Could show a modal with instructions for enabling microphone
        console.log('💡 Show microphone help guide');
        // For now, just show additional info
        setTimeout(() => {
            this.showErrorToUser(
                'Hướng dẫn', 
                'Bấm vào biểu tượng micro trong thanh địa chỉ để cho phép quyền truy cập'
            );
        }, 2000);
    }

    // Success handler
    handleSuccess(message, description = null) {
        if (this.app.utilsModule && this.app.utilsModule.showSuccess) {
            const fullMessage = description ? `${message}: ${description}` : message;
            this.app.utilsModule.showSuccess(fullMessage);
        } else {
            console.log('✅ Success:', message, description);
        }
    }

    // Warning handler
    handleWarning(message, description = null) {
        if (this.app.utilsModule && this.app.utilsModule.showWarning) {
            const fullMessage = description ? `${message}: ${description}` : message;
            this.app.utilsModule.showWarning(fullMessage);
        } else {
            console.warn('⚠️ Warning:', message, description);
        }
    }
}

export default ErrorHandler;
