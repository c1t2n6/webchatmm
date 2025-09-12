// Profile Edit Module
import { ProfileDataUtils } from './profile-data.js';

export class ProfileEditModule {
    constructor(app) {
        this.app = app;
        this.isLoading = false;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Close profile edit
        const closeBtn = document.getElementById('closeProfileEdit');
        const cancelBtn = document.getElementById('cancelProfileEdit');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideProfileEdit());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideProfileEdit());

        // Avatar upload
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const avatarInput = document.getElementById('avatarInput');
        if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', () => avatarInput.click());
        if (avatarInput) avatarInput.addEventListener('change', (e) => this.handleAvatarUpload(e));

        // Profile form submit
        const profileForm = document.getElementById('profileEditForm');
        if (profileForm) profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));

        // Delete account
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDeleteAccount());
    }

    async showProfileEdit() {
        console.log('🔍 ProfileEdit - Showing profile edit modal');
        
        // Load current profile data
        await this.loadCurrentProfile();
        
        // Show UI
        this.app.uiModule.hideAllSections();
        const profileEdit = document.getElementById('profileEdit');
        if (profileEdit) profileEdit.classList.remove('hidden');
    }

    hideProfileEdit() {
        console.log('🔍 ProfileEdit - Hiding profile edit modal');
        const profileEdit = document.getElementById('profileEdit');
        if (profileEdit) profileEdit.classList.add('hidden');
        
        // Return to previous section (waiting room or chat)
        if (this.app.currentUser.status === 'connected' && this.app.currentUser.current_room_id) {
            this.app.uiModule.showChatRoom();
        } else {
            this.app.uiModule.showWaitingRoom();
        }
    }

    async loadCurrentProfile() {
        console.log('🔍 ProfileEdit - Loading current profile data');
        
        try {
            const response = await fetch('/user/profile', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.user || data;
                this.populateForm(user);
                await this.loadUserStats(user.id);
            } else {
                console.error('Failed to load profile:', response.status);
                this.app.utilsModule.showError('Không thể tải thông tin hồ sơ');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            this.app.utilsModule.showError('Lỗi kết nối khi tải hồ sơ');
        }
    }

    populateForm(user) {
        console.log('🔍 ProfileEdit - Populating form with user data:', user);

        // ✅ SỬ DỤNG: Shared form population
        ProfileDataUtils.populateEditForm(user);

        // Additional UI updates specific to edit form
        const statusDisplay = document.getElementById('editStatus');
        if (statusDisplay) statusDisplay.textContent = this.getStatusText(user.status);

        // Avatar
        const avatarDiv = document.getElementById('currentAvatar');
        if (avatarDiv && user.avatar_url) {
            avatarDiv.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" class="w-full h-full object-cover rounded-full">`;
        }

        // Join date
        const joinDateStat = document.getElementById('statJoinDate');
        if (joinDateStat && user.created_at) {
            const joinDate = new Date(user.created_at);
            joinDateStat.textContent = joinDate.toLocaleDateString('vi-VN');
        }
    }

    async loadUserStats(userId) {
        console.log('🔍 ProfileEdit - Loading user stats');
        
        try {
            const response = await fetch('/user/stats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (response.ok) {
                const stats = await response.json();
                this.populateStats(stats);
            } else {
                console.log('Stats endpoint not available, using defaults');
                this.populateStats({});
            }
        } catch (error) {
            console.log('Error loading stats, using defaults:', error);
            this.populateStats({});
        }
    }

    populateStats(stats) {
        const statTotalChats = document.getElementById('statTotalChats');
        const statTotalLikes = document.getElementById('statTotalLikes');
        const statLastActive = document.getElementById('statLastActive');

        if (statTotalChats) statTotalChats.textContent = stats.total_chats || 0;
        if (statTotalLikes) statTotalLikes.textContent = stats.total_likes || 0;
        if (statLastActive) {
            if (stats.last_active) {
                const lastActive = new Date(stats.last_active);
                statLastActive.textContent = lastActive.toLocaleDateString('vi-VN');
            } else {
                statLastActive.textContent = 'Hôm nay';
            }
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'idle': return 'Sẵn sàng';
            case 'searching': return 'Đang tìm kiếm';
            case 'connected': return 'Đang trò chuyện';
            default: return 'Không xác định';
        }
    }

    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('🔍 ProfileEdit - Uploading avatar:', file.name);

        // Validate file
        if (file.size > 5 * 1024 * 1024) { // 5MB
            this.app.utilsModule.showError('File ảnh quá lớn (tối đa 5MB)');
            return;
        }

        if (!file.type.startsWith('image/')) {
            this.app.utilsModule.showError('Vui lòng chọn file ảnh');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch('/user/profile/avatar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                console.log('🔍 ProfileEdit - Avatar uploaded successfully:', data);
                
                // Update avatar display
                const avatarDiv = document.getElementById('currentAvatar');
                if (avatarDiv && data.avatar_url) {
                    avatarDiv.innerHTML = `<img src="${data.avatar_url}" alt="Avatar" class="w-full h-full object-cover rounded-full">`;
                }

                // Update current user data
                if (this.app.currentUser) {
                    this.app.currentUser.avatar_url = data.avatar_url;
                }

                this.app.utilsModule.showSuccess('Cập nhật ảnh đại diện thành công!');
            } else {
                const error = await response.json();
                this.app.utilsModule.showError(error.detail || 'Không thể upload ảnh đại diện');
            }
        } catch (error) {
            console.error('Avatar upload error:', error);
            this.app.utilsModule.showError('Lỗi kết nối khi upload ảnh');
        }
    }

    async handleProfileSubmit(event) {
        event.preventDefault();
        
        if (this.isLoading) return;
        this.isLoading = true;

        console.log('🔍 ProfileEdit - Submitting profile update');

        try {
            // ✅ SỬ DỤNG: Shared data collection và validation
            const rawData = ProfileDataUtils.collectEditData();
            const profileData = ProfileDataUtils.formatForAPI(rawData);

            console.log('🔍 ProfileEdit - Profile data to update:', profileData);

            // ✅ SỬ DỤNG: Shared validation
            const validationErrors = ProfileDataUtils.validateProfileData(profileData, false);
            if (validationErrors.length > 0) {
                this.app.utilsModule.showError(validationErrors[0]);
                return;
            }

            // ✅ THÊM: Interests limit validation (same as wizard)
            if (profileData.interests.length > 5) {
                this.app.utilsModule.showError('Chỉ được chọn tối đa 5 sở thích');
                return;
            }

            // Submit
            const response = await fetch('/user/profile/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify(profileData)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('🔍 ProfileEdit - Profile updated successfully:', data);

                // Update token if provided
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                    console.log('🔄 ProfileEdit - Token refreshed after profile update');
                }

                // Update current user data
                if (data.user && this.app.currentUser) {
                    this.app.currentUser = { ...this.app.currentUser, ...data.user };
                    console.log('🔄 ProfileEdit - User data updated:', this.app.currentUser);
                }

                this.app.utilsModule.showSuccess('Cập nhật hồ sơ thành công!');
                
                // Close modal after a delay
                setTimeout(() => {
                    this.hideProfileEdit();
                }, 1500);

            } else {
                const error = await response.json();
                this.app.utilsModule.showError(error.detail || 'Không thể cập nhật hồ sơ');
            }

        } catch (error) {
            console.error('Profile update error:', error);
            this.app.utilsModule.showError('Lỗi kết nối khi cập nhật hồ sơ');
        } finally {
            this.isLoading = false;
        }
    }

    async handleDeleteAccount() {
        const confirmed = confirm('⚠️ Bạn có chắc chắn muốn xóa tài khoản?\n\nHành động này không thể hoàn tác!');
        if (!confirmed) return;

        const doubleConfirm = confirm('🚨 XÁC NHẬN LẦN CUỐI\n\nXóa tài khoản sẽ:\n• Xóa tất cả dữ liệu cá nhân\n• Xóa lịch sử chat\n• Không thể phục hồi\n\nBạn có THỰC SỰ muốn xóa?');
        if (!doubleConfirm) return;

        console.log('🔍 ProfileEdit - Deleting account');

        try {
            const response = await fetch('/user/delete', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });

            if (response.ok) {
                console.log('🔍 ProfileEdit - Account deleted successfully');
                
                // Clear local data
                localStorage.removeItem('access_token');
                this.app.currentUser = null;
                
                // Show success and redirect
                this.app.utilsModule.showSuccess('Tài khoản đã được xóa thành công');
                
                setTimeout(() => {
                    this.hideProfileEdit();
                    this.app.uiModule.showLandingPage();
                }, 2000);

            } else {
                const error = await response.json();
                this.app.utilsModule.showError(error.detail || 'Không thể xóa tài khoản');
            }

        } catch (error) {
            console.error('Delete account error:', error);
            this.app.utilsModule.showError('Lỗi kết nối khi xóa tài khoản');
        }
    }
}
