// Profile Wizard Module
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
        
        switch (currentStep) {
            case 1:
                const nickname = document.getElementById('nickname')?.value;
                const dob = document.getElementById('dob')?.value;
                const gender = document.getElementById('gender')?.value;
                
                if (!nickname || !dob || !gender) {
                    this.app.showError('Vui lòng điền đầy đủ thông tin');
                    return false;
                }
                
                const age = this.calculateAge(dob);
                if (age < 18) {
                    this.app.showError('Bạn phải từ 18 tuổi trở lên');
                    return false;
                }
                break;
                
            case 2:
                const preferredGenders = document.querySelectorAll('#step2 input[type="checkbox"]:checked');
                if (preferredGenders.length === 0) {
                    this.app.showError('Vui lòng chọn ít nhất một giới tính');
                    return false;
                }
                break;
                
            case 3:
                const needs = document.querySelectorAll('#step3 input[type="checkbox"]:checked');
                if (needs.length === 0) {
                    this.app.showError('Vui lòng chọn ít nhất một nhu cầu');
                    return false;
                }
                break;
                
            case 4:
                const interests = document.querySelectorAll('#step4 input[type="checkbox"]:checked');
                if (interests.length === 0) {
                    this.app.showError('Vui lòng chọn ít nhất một sở thích');
                    return false;
                }
                if (interests.length > 5) {
                    this.app.showError('Chỉ được chọn tối đa 5 sở thích');
                    return false;
                }
                break;
        }
        
        return true;
    }

    skipProfile() {
        localStorage.setItem(`profile_completed_${this.app.currentUser.id}`, 'skipped');
        this.app.hideProfileWizard();
        this.app.showWaitingRoom();
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
        const profileData = {
            nickname: document.getElementById('nickname').value,
            dob: document.getElementById('dob').value,
            gender: document.getElementById('gender').value,
            preferred_gender: Array.from(document.querySelectorAll('#step2 input[type="checkbox"]:checked')).map(cb => cb.value),
            needs: Array.from(document.querySelectorAll('#step3 input[type="checkbox"]:checked')).map(cb => cb.value),
            interests: Array.from(document.querySelectorAll('#step4 input[type="checkbox"]:checked')).map(cb => cb.value)
        };

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
                this.app.currentUser.profile_completed = true;
                localStorage.setItem(`profile_completed_${this.app.currentUser.id}`, 'true');
                this.app.hideProfileWizard();
                this.app.showWaitingRoom();
            } else {
                const error = await response.json();
                this.app.showError(error.detail || 'Cập nhật hồ sơ thất bại');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.app.showError('Lỗi kết nối');
        }
    }

    handleInterestSelection() {
        const checkedBoxes = document.querySelectorAll('.interest-checkbox:checked');
        if (checkedBoxes.length > 5) {
            event.target.checked = false;
            this.app.showError('Chỉ được chọn tối đa 5 sở thích');
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
