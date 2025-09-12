// Profile Wizard Module
import { ProfileDataUtils } from './profile-data.js';

export class ProfileModule {
    constructor(app) {
        this.app = app;
    }

    async nextWizardStep() {
        const currentStep = this.getCurrentWizardStep();
        
        if (!this.validateCurrentStep()) {
            return;
        }

        if (currentStep === 4) {
            await this.completeProfile();
        } else {
            this.showWizardStep(currentStep + 1);
        }
    }

    prevWizardStep() {
        const currentStep = this.getCurrentWizardStep();
        if (currentStep > 1) {
            this.showWizardStep(currentStep - 1);
        }
    }

    getCurrentWizardStep() {
        for (let i = 1; i <= 4; i++) {
            const stepElement = document.getElementById(`step${i}`);
            if (stepElement && !stepElement.classList.contains('hidden')) {
                return i;
            }
        }
        return 1;
    }

    validateCurrentStep() {
        const currentStep = this.getCurrentWizardStep();
        
        // ✅ SỬ DỤNG: Shared validation logic
        const profileData = ProfileDataUtils.collectWizardData();
        
        switch (currentStep) {
            case 1:
                // Validate basic info using shared utils
                const basicErrors = ProfileDataUtils.validateProfileData({
                    nickname: profileData.nickname,
                    dob: profileData.dob, 
                    gender: profileData.gender
                }, false);
                
                if (basicErrors.length > 0) {
                    this.app.utilsModule.showError(basicErrors[0]);
                    return false;
                }
                break;
                
            case 2:
                if (profileData.preferred_gender.length === 0) {
                    this.app.utilsModule.showError('Vui lòng chọn ít nhất một giới tính mong muốn');
                    return false;
                }
                break;
                
            case 3:
                if (profileData.needs.length === 0) {
                    this.app.utilsModule.showError('Vui lòng chọn ít nhất một nhu cầu kết nối');
                    return false;
                }
                break;
                
            case 4:
                if (profileData.interests.length === 0) {
                    this.app.utilsModule.showError('Vui lòng chọn ít nhất một sở thích');
                    return false;
                }
                if (profileData.interests.length > 5) {
                    this.app.utilsModule.showError('Chỉ được chọn tối đa 5 sở thích');
                    return false;
                }
                break;
        }
        
        return true;
    }

    skipProfile() {
        // ✅ SỬA: Không dùng localStorage nữa, chỉ set profile_completed = true trong database
        this.app.currentUser.profile_completed = true;
        
        // ✅ THÊM: Reset flag khi kết thúc profile wizard
        this.app.showingProfileWizard = false;
        this.app.uiModule.hideProfileWizard();
        this.app.uiModule.showWaitingRoom();
    }

    calculateAge(dob) {
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    async completeProfile() {
        // ✅ SỬ DỤNG: Shared data collection
        const profileData = ProfileDataUtils.formatForAPI(ProfileDataUtils.collectWizardData());

        try {
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
                
                // ✅ THÊM: Cập nhật token mới nếu có
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                    console.log('🔄 Profile - Token refreshed after profile update');
                }
                
                // ✅ THÊM: Cập nhật user data từ server response
                if (data.user) {
                    this.app.currentUser = { ...this.app.currentUser, ...data.user };
                    console.log('🔄 Profile - User data updated:', this.app.currentUser);
                }
                
                this.app.currentUser.profile_completed = true;
                // ✅ SỬA: Xóa localStorage profile check, chỉ dùng database
                // ✅ THÊM: Reset flag khi hoàn thành profile wizard
                this.app.showingProfileWizard = false;
                this.app.uiModule.hideProfileWizard();
                this.app.uiModule.showWaitingRoom();
            } else {
                const error = await response.json();
                this.app.utilsModule.showError(error.detail || 'Cập nhật hồ sơ thất bại');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.app.utilsModule.showError('Lỗi kết nối');
        }
    }

    handleInterestSelection() {
        const checkedBoxes = document.querySelectorAll('.interest-checkbox:checked');
        if (checkedBoxes.length > 5) {
            event.target.checked = false;
            this.app.utilsModule.showError('Chỉ được chọn tối đa 5 sở thích');
        }
    }

    showWizardStep(step) {
        for (let i = 1; i <= 4; i++) {
            const stepElement = document.getElementById(`step${i}`);
            if (stepElement) stepElement.classList.add('hidden');
        }
        
        const currentStepElement = document.getElementById(`step${step}`);
        if (currentStepElement) currentStepElement.classList.remove('hidden');
        
        const progressBar = document.getElementById('wizardProgress');
        const stepText = document.getElementById('wizardStep');
        
        if (progressBar) {
            const progress = (step / 4) * 100;
            progressBar.style.width = `${progress}%`;
        }
        if (stepText) {
            stepText.textContent = `Bước ${step}/4`;
        }
        
        const prevButton = document.getElementById('prevStep');
        const nextButton = document.getElementById('nextStep');
        
        if (prevButton) {
            prevButton.classList.toggle('hidden', step === 1);
        }
        if (nextButton) {
            nextButton.textContent = step === 4 ? 'Hoàn thành' : 'Tiếp theo';
        }
    }
}
