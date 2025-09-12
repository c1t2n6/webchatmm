// Profile Data Utilities - Shared between Wizard and Edit
export class ProfileDataUtils {
    
    // Define standard profile options
    static getGenderOptions() {
        return ['Nam', 'Nữ', 'Khác'];
    }

    static getPreferredGenderOptions() {
        return ['Nam', 'Nữ', 'Tất cả'];
    }

    static getNeedsOptions() {
        return [
            'Nhẹ nhàng vui vẻ',
            'Nghiêm túc',
            'Khám phá',
            'Kết hôn',
            'Bạn đời lâu dài',
            'Bạn bè'
        ];
    }

    static getInterestsOptions() {
        return [
            'Gym',
            'Nhảy',
            'Ảnh',
            'Cafe',
            'Du lịch',
            'Game',
            'Đọc',
            'Nhạc',
            'Tình nguyện',
            'Phim',
            'Nấu ăn',
            'Thể thao'
        ];
    }

    // Collect profile data from wizard
    static collectWizardData() {
        return {
            nickname: document.getElementById('nickname')?.value?.trim() || '',
            dob: document.getElementById('dob')?.value || '',
            gender: document.getElementById('gender')?.value || '',
            preferred_gender: Array.from(document.querySelectorAll('#step2 input[type="checkbox"]:checked')).map(cb => cb.value),
            needs: Array.from(document.querySelectorAll('#step3 input[type="checkbox"]:checked')).map(cb => cb.value),
            interests: Array.from(document.querySelectorAll('#step4 input[type="checkbox"]:checked')).map(cb => cb.value),
            profile_completed: true
        };
    }

    // Collect profile data from edit form
    static collectEditData() {
        return {
            nickname: document.getElementById('editNickname')?.value?.trim() || '',
            dob: document.getElementById('editDob')?.value || '',
            gender: document.getElementById('editGender')?.value || '',
            preferred_gender: Array.from(document.querySelectorAll('input[name="editPreferredGender"]:checked')).map(cb => cb.value),
            needs: Array.from(document.querySelectorAll('input[name="editNeeds"]:checked')).map(cb => cb.value),
            interests: Array.from(document.querySelectorAll('input[name="editInterests"]:checked')).map(cb => cb.value)
        };
    }

    // Populate wizard form with data
    static populateWizardForm(userData) {
        // Basic info
        const nicknameInput = document.getElementById('nickname');
        const dobInput = document.getElementById('dob');
        const genderSelect = document.getElementById('gender');

        if (nicknameInput) nicknameInput.value = userData.nickname || '';
        if (dobInput) dobInput.value = userData.dob || '';
        if (genderSelect) genderSelect.value = userData.gender || '';

        // Preferred gender checkboxes (Step 2)
        const preferredGenderInputs = document.querySelectorAll('#step2 input[type="checkbox"]');
        preferredGenderInputs.forEach(input => {
            input.checked = userData.preferred_gender && userData.preferred_gender.includes(input.value);
        });

        // Needs checkboxes (Step 3)
        const needsInputs = document.querySelectorAll('#step3 input[type="checkbox"]');
        needsInputs.forEach(input => {
            input.checked = userData.needs && userData.needs.includes(input.value);
        });

        // Interests checkboxes (Step 4)
        const interestsInputs = document.querySelectorAll('#step4 input[type="checkbox"]');
        interestsInputs.forEach(input => {
            input.checked = userData.interests && userData.interests.includes(input.value);
        });
    }

    // Populate edit form with data
    static populateEditForm(userData) {
        // Basic info
        const nicknameInput = document.getElementById('editNickname');
        const dobInput = document.getElementById('editDob');
        const genderSelect = document.getElementById('editGender');

        if (nicknameInput) nicknameInput.value = userData.nickname || '';
        if (dobInput) dobInput.value = userData.dob || '';
        if (genderSelect) genderSelect.value = userData.gender || '';

        // Preferred gender checkboxes
        const preferredGenderInputs = document.querySelectorAll('input[name="editPreferredGender"]');
        preferredGenderInputs.forEach(input => {
            input.checked = userData.preferred_gender && userData.preferred_gender.includes(input.value);
        });

        // Needs checkboxes
        const needsInputs = document.querySelectorAll('input[name="editNeeds"]');
        needsInputs.forEach(input => {
            input.checked = userData.needs && userData.needs.includes(input.value);
        });

        // Interests checkboxes
        const interestsInputs = document.querySelectorAll('input[name="editInterests"]');
        interestsInputs.forEach(input => {
            input.checked = userData.interests && userData.interests.includes(input.value);
        });
    }

    // Validate profile data (shared validation)
    static validateProfileData(profileData, isWizard = false) {
        const errors = [];

        // Required fields
        if (!profileData.nickname || profileData.nickname.trim() === '') {
            errors.push('Vui lòng nhập biệt danh');
        }

        if (!profileData.dob) {
            errors.push('Vui lòng chọn ngày sinh');
        }

        if (!profileData.gender) {
            errors.push('Vui lòng chọn giới tính');
        }

        // Age validation
        if (profileData.dob) {
            const age = this.calculateAge(profileData.dob);
            if (age < 18) {
                errors.push('Bạn phải từ 18 tuổi trở lên');
            }
        }

        // Wizard-specific validations
        if (isWizard) {
            if (!profileData.preferred_gender || profileData.preferred_gender.length === 0) {
                errors.push('Vui lòng chọn ít nhất một giới tính mong muốn');
            }

            if (!profileData.needs || profileData.needs.length === 0) {
                errors.push('Vui lòng chọn ít nhất một nhu cầu kết nối');
            }

            if (!profileData.interests || profileData.interests.length === 0) {
                errors.push('Vui lòng chọn ít nhất một sở thích');
            }
        }

        return errors;
    }

    // Calculate age from date of birth
    static calculateAge(dob) {
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    // Format profile data for API
    static formatForAPI(profileData) {
        return {
            nickname: profileData.nickname?.trim() || '',
            dob: profileData.dob || null,
            gender: profileData.gender || 'Khác',
            preferred_gender: Array.isArray(profileData.preferred_gender) ? profileData.preferred_gender : [],
            needs: Array.isArray(profileData.needs) ? profileData.needs : [],
            interests: Array.isArray(profileData.interests) ? profileData.interests : [],
            profile_completed: profileData.profile_completed || false
        };
    }

    // Check if profile data is complete
    static isProfileComplete(profileData) {
        return !!(
            profileData.nickname?.trim() &&
            profileData.dob &&
            profileData.gender &&
            profileData.preferred_gender?.length > 0 &&
            profileData.needs?.length > 0 &&
            profileData.interests?.length > 0
        );
    }
}
