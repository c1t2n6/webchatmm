# Media Requirements - Background & Entry Mode Buttons

## Tổng quan
Dự án sử dụng **3 files** để thay thế:
1. Background video (toàn màn hình) - `background-loop.mp4`
2. Chat entry mode button GIF
3. Voice call entry mode button GIF

## Files Cần Thiết

### 1. Background Video
**File**: `background-loop.mp4`
**Vị trí**: `/static/videos/background-loop.mp4`
**Mục đích**: Video nền cho toàn bộ ứng dụng

**Yêu cầu kỹ thuật**:
- **Duration**: 5-10 giây (khuyến nghị)
- **Resolution**: 1920x1080 (Full HD) hoặc 1280x720 (HD)
- **Format**: MP4 (H.264 codec)
- **File Size**: < 10MB (tối ưu < 5MB)
- **FPS**: 24-30fps
- **Audio**: Không có audio hoặc muted
- **Loop**: Seamless loop (khởi đầu và kết thúc phải khớp mượt mà)
- **Aspect Ratio**: 16:9

### 2. Chat Entry Mode GIF
**File**: `chat-entry.gif`
**Vị trí**: `/static/videos/chat-entry.gif`
**Mục đích**: GIF cho button "Bắt đầu chat" trong Waiting Room

**Yêu cầu kỹ thuật**:
- **Duration**: 3-5 giây (khuyến nghị)
- **Resolution**: 640x360 (360p) hoặc 854x480 (480p) - đủ cho button size
- **Format**: GIF (animated)
- **File Size**: < 2MB (tối ưu < 1MB)
- **FPS**: 15-24fps
- **Loop**: Infinite loop
- **Aspect Ratio**: 16:9 hoặc tương tự
- **Content**: Nên có chủ đề liên quan đến chat/messaging (ví dụ: emoji, chat bubbles, typing animation...)

### 3. Voice Call Entry Mode GIF
**File**: `voice-entry.gif`
**Vị trí**: `/static/videos/voice-entry.gif`
**Mục đích**: GIF cho button "Voice Call" trong Waiting Room

**Yêu cầu kỹ thuật**:
- **Duration**: 3-5 giây (khuyến nghị)
- **Resolution**: 640x360 (360p) hoặc 854x480 (480p) - đủ cho button size
- **Format**: GIF (animated)
- **File Size**: < 2MB (tối ưu < 1MB)
- **FPS**: 15-24fps
- **Loop**: Infinite loop
- **Aspect Ratio**: 16:9 hoặc tương tự
- **Content**: Nên có chủ đề liên quan đến voice call/phone (ví dụ: phone icon, sound waves, microphone...)

## Tối ưu hóa Files

### Video Optimization:
```bash
# Background video (tối ưu chất lượng cao hơn)
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p background-loop.mp4
```

### GIF Optimization:
```bash
# Sử dụng gifsicle để optimize GIF
# Download từ: https://www.lcdf.org/gifsicle/

# Optimize GIF (giảm màu và kích thước)
gifsicle -O3 --colors 256 chat-entry.gif -o chat-entry-optimized.gif
gifsicle -O3 --colors 256 voice-entry.gif -o voice-entry-optimized.gif

# Hoặc sử dụng FFmpeg để convert video sang GIF
ffmpeg -i input.mp4 -vf "fps=15,scale=854:480:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 chat-entry.gif
```

### Tạo seamless loop cho GIF:
1. Chọn đoạn animation có khởi đầu và kết thúc giống nhau
2. Sử dụng crossfade để chuyển tiếp mượt
3. Test loop để đảm bảo không có "nhảy" giữa các lần lặp

## Nội dung Gợi ý

### Background Video:
- Abstract gradients
- Geometric patterns
- Soft particle effects
- Subtle animations
- Minimalist designs

### Chat Entry GIF:
- Chat bubbles floating
- Typing animation
- Message icons
- Conversation visuals
- Emoji animations

### Voice Call Entry GIF:
- Phone icon animations
- Sound wave visualizations
- Microphone graphics
- Call connection effects
- Audio frequency displays

## Lưu ý

1. **Performance**: 
   - Video sẽ tự động play và loop
   - GIF sẽ tự động loop khi load
2. **Mobile**: Video và GIF hiển thị trên cả mobile và desktop (không tắt)
3. **Accessibility**: Đảm bảo text overlay đọc được trên GIF
4. **Loading**: 
   - Video sẽ tự động play khi load xong
   - GIF sẽ tự động play khi load xong
5. **Fallback**: 
   - Nếu video không load được, sẽ hiển thị gradient background
   - Nếu GIF không load được, browser sẽ hiển thị alt text

## File Structure

```
static/
  videos/
    background-loop.mp4
    chat-entry.gif
    voice-entry.gif
    VIDEO_REQUIREMENTS.md (file này)
```
