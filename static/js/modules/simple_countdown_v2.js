/**
 * Simple Countdown Module V2 - Logic đơn giản hóa
 * Chỉ dựa vào Backend, không có frontend timer
 */

export class SimpleCountdownModuleV2 {
    constructor(app) {
        this.app = app;
        this.currentRoomId = null;
        this.countdownElement = null;
        this.notificationModal = null;
        
        console.log('⏰ SimpleCountdownModuleV2 initialized');
    }
    
    /**
     * Xử lý WebSocket message từ backend
     */
    handleWebSocketMessage(data) {
        try {
            // ✅ SỬA: data đã là object, không cần parse
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            
            console.log('⏰ SimpleCountdownModuleV2 received message:', data.type, data);
            
            switch (data.type) {
                case 'countdown_start':
                    this.handleCountdownStart(data);
                    break;
                case 'countdown_update':
                    this.handleCountdownUpdate(data);
                    break;
                case 'notification_show':
                    this.handleNotificationShow(data);
                    break;
                case 'notification_update':
                    this.handleNotificationUpdate(data);
                    break;
                case 'room_kept':
                    this.handleRoomKept(data);
                    break;
                case 'waiting_for_other':
                    this.handleWaitingForOther(data);
                    break;
                case 'room_ended':
                    this.handleRoomEnded(data);
                    break;
                default:
                    console.log('⏰ Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('⏰ Error handling WebSocket message:', error);
        }
    }
    
    /**
     * Xử lý countdown start
     */
    handleCountdownStart(data) {
        console.log('⏰ Countdown started:', data);
        this.currentRoomId = data.room_id;
        this.showCountdown(data.duration);
    }
    
    /**
     * Xử lý countdown update
     */
    handleCountdownUpdate(data) {
        console.log('⏰ Countdown update:', data.remaining);
        this.updateCountdownDisplay(data.remaining);
        
        if (data.remaining <= 0) {
            this.hideCountdown();
        }
    }
    
    /**
     * Xử lý notification show
     */
    handleNotificationShow(data) {
        console.log('⏰ Notification show:', data);
        
        // ✅ THÊM: Check xem user đã ấn "Giữ hoạt động" chưa
        if (this.app && this.app.chatModule && this.app.chatModule.hasUserKeptActive()) {
            console.log('⏰ User has already kept active, skipping notification');
            return;
        }
        
        // Đảm bảo ẩn countdown trước khi hiển thị notification
        this.hideCountdown();
        
        this.showNotification({
            message: 'Bạn có muốn tiếp tục cuộc trò chuyện không?',
            timeout: data.timeout || 30,
            users_to_notify: data.users_to_notify || []  // Truyền users_to_notify
        });
    }
    
    /**
     * Xử lý notification update
     */
    handleNotificationUpdate(data) {
        console.log('⏰ Notification update:', data.remaining);
        
        // Cập nhật timeout trong notification nếu đang hiển thị
        if (this.notificationModal) {
            const timeElement = this.notificationModal.querySelector('#notification-time');
            if (timeElement) {
                timeElement.textContent = data.remaining;
            }
            
            // Cập nhật progress bar
            const progressElement = this.notificationModal.querySelector('#notification-progress');
            if (progressElement) {
                const totalTime = 30; // 30 giây
                const percentage = (data.remaining / totalTime) * 100;
                progressElement.style.width = `${percentage}%`;
            }
        }
    }
    
    /**
     * Xử lý room kept
     */
    handleRoomKept(data) {
        console.log('⏰ Room kept:', data);
        this.hideCountdown();
        this.hideNotification();
        
        // Đồng bộ trạng thái nút "Giữ hoạt động" khi cả 2 user đã đồng ý
        if (this.app && this.app.chatModule && this.app.chatModule.updateKeepActiveButton) {
            this.app.chatModule.updateKeepActiveButton();
        }
        
        this.showToast(data.message, 'success');
    }
    
    /**
     * Xử lý waiting for other user
     */
    handleWaitingForOther(data) {
        console.log('⏰ Waiting for other user:', data);
        
        // Chỉ hiển thị toast thông báo, không thay đổi trạng thái nút
        this.showToast(data.message, 'info');
    }
    
    /**
     * Xử lý room ended
     */
    handleRoomEnded(data) {
        console.log('⏰ Room ended:', data);
        this.hideCountdown();
        this.hideNotification();
        this.showToast(data.message, 'error');
        
        // Reset trạng thái nút "Giữ hoạt động"
        if (this.app && this.app.chatModule && this.app.chatModule.resetKeepActiveButton) {
            this.app.chatModule.resetKeepActiveButton();
        }
        
        // Reset chat state
        if (this.app && this.app.chatModule) {
            this.app.chatModule.resetChatState();
        }
    }
    
    /**
     * Hiển thị countdown thay thế chữ "Đang nhập..."
     */
    showCountdown(duration) {
        console.log('⏰ Showing countdown:', duration);
        
        // Clean up existing
        this.hideCountdown();
        
        // Tìm element "Đang nhập..." trong chat header
        const chatHeader = document.querySelector('#chatRoom .border-b.border-gray-200.dark\\:border-gray-700.p-4');
        if (chatHeader) {
            const typingElement = chatHeader.querySelector('.text-sm.text-gray-500.dark\\:text-gray-400');
            if (typingElement) {
                // Lưu text gốc
                typingElement.dataset.originalText = typingElement.textContent;
                
                // Tạo countdown element
                this.createCountdownElement(typingElement, duration);
                this.countdownElement = typingElement;
                
                console.log('⏰ Countdown displayed in chat header');
            } else {
                console.warn('⏰ Could not find typing element');
                this.createFloatingCountdown(duration);
            }
        } else {
            console.warn('⏰ Could not find chat header');
            this.createFloatingCountdown(duration);
        }
    }
    
    /**
     * Tạo countdown element
     */
    createCountdownElement(typingElement, duration) {
        const timeStr = this.formatTime(duration);
        typingElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; color: #3B82F6; font-weight: 600;">
                <span id="countdown-number">${timeStr}</span>
            </div>
        `;
    }
    
    /**
     * Cập nhật hiển thị countdown
     */
    updateCountdownDisplay(remaining) {
        if (!this.countdownElement) return;
        
        const timeStr = this.formatTime(remaining);
        const numberEl = this.countdownElement.querySelector('#countdown-number');
        
        if (numberEl) {
            numberEl.textContent = timeStr;
        }
    }
    
    /**
     * Ẩn countdown
     */
    hideCountdown() {
        if (this.countdownElement) {
            if (this.countdownElement.id === 'floating-countdown') {
                this.countdownElement.remove();
            } else {
                // Restore text gốc
                const originalText = this.countdownElement.dataset.originalText || 'Đang nhập...';
                this.countdownElement.textContent = originalText;
                this.countdownElement.style.color = '';
                this.countdownElement.style.fontWeight = '';
                this.countdownElement.innerHTML = originalText;
            }
            this.countdownElement = null;
        }
    }
    
    /**
     * Tạo floating countdown
     */
    createFloatingCountdown(duration) {
        const element = document.createElement('div');
        element.id = 'floating-countdown';
        element.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3B82F6;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        const timeStr = this.formatTime(duration);
        element.innerHTML = `<span id="countdown-number">${timeStr}</span>`;
        
        document.body.appendChild(element);
        this.countdownElement = element;
    }
    
    /**
     * Hiển thị notification
     */
    showNotification(data) {
        console.log('⏰ showNotification called with data:', data);
        
        // Kiểm tra xem user hiện tại có cần hiển thị notification không
        if (data.users_to_notify && data.users_to_notify.length > 0) {
            console.log('⏰ users_to_notify found, checking current user...');
            
            // Lấy current user ID từ nhiều nguồn
            let currentUserId = null;
            
            // Thử lấy từ app.currentUser
            if (this.app && this.app.currentUser && this.app.currentUser.id) {
                currentUserId = this.app.currentUser.id;
                console.log('⏰ Got user ID from app.currentUser:', currentUserId);
            }
            
            // Thử lấy từ localStorage nếu không có
            if (!currentUserId) {
                const userData = localStorage.getItem('user_data');
                if (userData) {
                    try {
                        const user = JSON.parse(userData);
                        currentUserId = user.id;
                        console.log('⏰ Got user ID from localStorage:', currentUserId);
                    } catch (e) {
                        console.warn('⏰ Could not parse user data from localStorage');
                    }
                }
            }
            
            // Thử lấy từ token nếu không có
            if (!currentUserId) {
                const token = localStorage.getItem('access_token');
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        currentUserId = payload.user_id;
                        console.log('⏰ Got user ID from token:', currentUserId);
                    } catch (e) {
                        console.warn('⏰ Could not parse user ID from token');
                    }
                }
            }
            
            console.log('⏰ Final current user ID:', currentUserId);
            console.log('⏰ Users to notify:', data.users_to_notify);
            
            if (currentUserId) {
                // Convert currentUserId to integer for comparison
                const currentUserIdInt = parseInt(currentUserId);
                const usersToNotifyInts = data.users_to_notify.map(id => parseInt(id));
                
                console.log('⏰ Current user ID (int):', currentUserIdInt);
                console.log('⏰ Users to notify (ints):', usersToNotifyInts);
                
                if (!usersToNotifyInts.includes(currentUserIdInt)) {
                    console.log('⏰ User already kept active, skipping notification display');
                    return;
                } else {
                    console.log('⏰ User needs notification, showing...');
                }
            } else {
                console.warn('⏰ Could not get current user ID, showing notification anyway');
            }
        } else {
            console.log('⏰ No users_to_notify or empty array, showing notification for all users');
        }
        
        this.hideNotification();
        
        const modal = document.createElement('div');
        modal.id = 'simple-notification-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        `;
        
        modalContent.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #1F2937; font-size: 24px;">
                Tiếp tục cuộc trò chuyện
            </h3>
            <p style="margin: 0 0 30px 0; color: #6B7280; font-size: 16px;">
                ${data.message || 'Bạn có muốn tiếp tục cuộc trò chuyện với người này không?'}
            </p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="simple-notification-yes" style="
                    background: #10B981;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    min-width: 200px;
                ">
                    ✅ Có - Tôi muốn tiếp tục
                </button>
                <button id="simple-notification-no" style="
                    background: #EF4444;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    min-width: 200px;
                ">
                    ❌ Không - Kết thúc cuộc trò chuyện
                </button>
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <div style="background: #F3F4F6; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div id="notification-progress" style="background: #3B82F6; height: 100%; width: 100%; transition: width 1s linear;"></div>
                </div>
                <p style="margin: 10px 0 0 0; color: #6B7280; font-size: 14px;">
                    Thời gian còn lại: <span id="notification-time">${data.timeout || 30}</span>s
                </p>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // ✅ SỬA: Đợi DOM được render trước khi thêm event listeners
        setTimeout(() => {
            const yesButton = document.getElementById('simple-notification-yes');
            const noButton = document.getElementById('simple-notification-no');
            
            if (yesButton && noButton) {
                console.log('⏰ Adding event listeners to notification buttons');
                
                // ✅ SỬA: Sử dụng arrow functions để bind this context
                const handleYesClick = () => {
                    console.log('⏰ Yes button clicked');
                    this.handleResponse(true);
                };
                
                const handleNoClick = () => {
                    console.log('⏰ No button clicked');
                    this.handleResponse(false);
                };
                
                // ✅ SỬA: Thêm event listeners với proper cleanup
                yesButton.addEventListener('click', handleYesClick, { once: true });
                noButton.addEventListener('click', handleNoClick, { once: true });
                
                // ✅ SỬA: Thêm visual feedback
                yesButton.addEventListener('mousedown', () => {
                    yesButton.style.transform = 'scale(0.95)';
                });
                yesButton.addEventListener('mouseup', () => {
                    yesButton.style.transform = 'scale(1)';
                });
                yesButton.addEventListener('mouseleave', () => {
                    yesButton.style.transform = 'scale(1)';
                });
                
                noButton.addEventListener('mousedown', () => {
                    noButton.style.transform = 'scale(0.95)';
                });
                noButton.addEventListener('mouseup', () => {
                    noButton.style.transform = 'scale(1)';
                });
                noButton.addEventListener('mouseleave', () => {
                    noButton.style.transform = 'scale(1)';
                });
                
                console.log('⏰ Event listeners added successfully');
            } else {
                console.error('⏰ Could not find notification buttons:', { yesButton, noButton });
            }
        }, 100); // Đợi 100ms để DOM được render
        
        this.notificationModal = modal;
        console.log('⏰ Notification displayed');
    }
    
    /**
     * Ẩn notification
     */
    hideNotification() {
        if (this.notificationModal) {
            console.log('⏰ Hiding notification modal');
            
            // ✅ SỬA: Cleanup event listeners trước khi remove
            const yesButton = this.notificationModal.querySelector('#simple-notification-yes');
            const noButton = this.notificationModal.querySelector('#simple-notification-no');
            
            if (yesButton) {
                yesButton.replaceWith(yesButton.cloneNode(true)); // Remove all event listeners
            }
            if (noButton) {
                noButton.replaceWith(noButton.cloneNode(true)); // Remove all event listeners
            }
            
            this.notificationModal.remove();
            this.notificationModal = null;
            console.log('⏰ Notification modal removed');
        }
    }
    
    /**
     * Disable notification buttons
     */
    disableNotificationButtons() {
        if (this.notificationModal) {
            const yesButton = this.notificationModal.querySelector('#simple-notification-yes');
            const noButton = this.notificationModal.querySelector('#simple-notification-no');
            
            if (yesButton) {
                yesButton.disabled = true;
                yesButton.style.opacity = '0.5';
                yesButton.style.cursor = 'not-allowed';
            }
            if (noButton) {
                noButton.disabled = true;
                noButton.style.opacity = '0.5';
                noButton.style.cursor = 'not-allowed';
            }
            console.log('⏰ Notification buttons disabled');
        }
    }
    
    /**
     * Enable notification buttons
     */
    enableNotificationButtons() {
        if (this.notificationModal) {
            const yesButton = this.notificationModal.querySelector('#simple-notification-yes');
            const noButton = this.notificationModal.querySelector('#simple-notification-no');
            
            if (yesButton) {
                yesButton.disabled = false;
                yesButton.style.opacity = '1';
                yesButton.style.cursor = 'pointer';
            }
            if (noButton) {
                noButton.disabled = false;
                noButton.style.opacity = '1';
                noButton.style.cursor = 'pointer';
            }
            console.log('⏰ Notification buttons enabled');
        }
    }
    
    /**
     * Xử lý phản hồi từ user
     */
    async handleResponse(isYes) {
        console.log('⏰ handleResponse called with:', isYes);
        
        if (!this.currentRoomId) {
            console.error('⏰ No room ID available for response');
            this.showToast('Lỗi: Không tìm thấy phòng chat', 'error');
            return;
        }
        
        // ✅ SỬA: Disable buttons ngay lập tức để tránh double click
        this.disableNotificationButtons();
        
        console.log('⏰ User response:', isYes ? 'Yes' : 'No');
        
        if (isYes) {
            // Nếu user chọn "Có" - đồng bộ với nút "Giữ hoạt động"
            console.log('⏰ User chose "Có" - syncing with keep active button');
            
            // ✅ THÊM: Cập nhật trạng thái "Giữ hoạt động" trước
            if (this.app && this.app.chatModule) {
                this.app.chatModule.updateKeepActiveButton();
            }
            
            // Gọi endpoint response để xử lý logic notification
            try {
                const response = await fetch(`/simple-countdown/response/${this.currentRoomId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    },
                    body: JSON.stringify({ response: "yes" })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('⏰ Response sent successfully:', result);
                    
                    this.hideNotification();
                    
                    if (result.room_ended) {
                        this.showToast(result.message, 'error');
                    } else if (result.room_kept) {
                        this.showToast(result.message, 'success');
                    } else if (result.waiting_for_other) {
                        this.showToast(result.message, 'info');
                    }
                } else {
                    const error = await response.text();
                    console.error('⏰ Error sending response:', response.status, error);
                    
                    this.enableNotificationButtons();
                    this.showToast('Lỗi gửi phản hồi. Vui lòng thử lại.', 'error');
                }
            } catch (error) {
                console.error('⏰ Error sending response:', error);
                this.enableNotificationButtons();
                this.showToast('Lỗi gửi phản hồi. Vui lòng thử lại.', 'error');
            }
            return;
        }
        
        // Nếu user chọn "Không" - gọi endpoint kết thúc room
        if (!isYes) {
            try {
                const response = await fetch(`/chat/end/${this.currentRoomId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('⏰ Room ended successfully:', result);
                    
                    this.hideNotification();
                    this.showToast(result.message, 'error');
                } else {
                    const error = await response.text();
                    console.error('⏰ Error ending room:', response.status, error);
                    
                    this.enableNotificationButtons();
                    this.showToast('Lỗi kết thúc phòng. Vui lòng thử lại.', 'error');
                }
            } catch (error) {
                console.error('⏰ Error ending room:', error);
                this.enableNotificationButtons();
                this.showToast('Lỗi kết thúc phòng. Vui lòng thử lại.', 'error');
            }
            return;
        }
    }
    
    // Các method này đã được chuyển sang chat module để đồng bộ tốt hơn
    
    /**
     * Bắt đầu countdown cho room
     */
    async startCountdown(roomId) {
        try {
            const response = await fetch(`/simple-countdown/start/${roomId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('⏰ Countdown started:', result);
                return true;
            } else {
                const error = await response.text();
                console.error('⏰ Error starting countdown:', response.status, error);
                return false;
            }
        } catch (error) {
            console.error('⏰ Error starting countdown:', error);
            return false;
        }
    }
    
    /**
     * Sync với backend (đơn giản hóa)
     */
    async syncWithBackend(roomId) {
        try {
            const response = await fetch(`/simple-countdown/status/${roomId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });
            
            if (response.ok) {
                const status = await response.json();
                console.log('⏰ Sync status:', status);
                
                // Chỉ hiển thị nếu có active countdown/notification
                if (status.phase === 'countdown' && status.countdown_remaining > 0) {
                    this.showCountdown(status.countdown_remaining);
                } else if (status.phase === 'notification' && status.notification_remaining > 0) {
                    this.showNotification({ 
                        message: 'Bạn có muốn tiếp tục cuộc trò chuyện với người này không?',
                        timeout: status.notification_remaining
                    });
                }
            }
        } catch (error) {
            console.error('⏰ Error syncing with backend:', error);
        }
    }
    
    /**
     * Format thời gian
     */
    formatTime(seconds) {
        const totalSeconds = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Hiển thị toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
    
    /**
     * Cleanup
     */
    cleanup() {
        this.hideCountdown();
        this.hideNotification();
        this.resetKeepActiveButton();
        this.currentRoomId = null;
        console.log('⏰ SimpleCountdownModuleV2 cleaned up');
    }
}
