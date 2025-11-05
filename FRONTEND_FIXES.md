# 🔧 DANH SÁCH SỬA LỖI FRONTEND

## ✅ ĐÃ XÁC ĐỊNH

1. **UI Module tồn tại** - ✅ Có đầy đủ methods
2. **Event handlers được bind** - ✅ Code đã có
3. **BackgroundController** - ✅ Đã được init

## ⚠️ CẦN KIỂM TRA VÀ SỬA

### 1. Dark Mode Toggle
- **Status**: Có `setupDarkMode()` trong UI module
- **Cần verify**: Method có được gọi đúng không?

### 2. Waiting Room Display
- **Status**: HTML có class `hidden` mặc định
- **Cần verify**: `showWaitingRoom()` có được gọi khi user đăng nhập không?

### 3. Background Video
- **Status**: File path: `/static/videos/background-loop.mp4`
- **Cần verify**: File có tồn tại và load được không?

### 4. Buttons Event Handlers
- **Status**: `startChat` và `startVoice` đã có event listeners
- **Cần verify**: Click handlers có hoạt động đúng không?

### 5. Initial State
- **Vấn đề**: Trang có thể không hiển thị đúng section ban đầu
- **Cần**: Verify landing page hiển thị khi chưa đăng nhập
