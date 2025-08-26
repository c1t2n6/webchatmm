# 🔍 PHÂN TÍCH LOGIC COUNTDOWN 5 PHÚT CỦA PHÒNG CHAT

## 📋 TỔNG QUAN LOGIC

### **🎯 Mục đích:**
- Sau khi user được match vào phòng chat, hệ thống sẽ hiển thị modal "Like" sau **5 phút**
- Modal này cho phép user đánh giá người chat (thích/không thích)
- Timer countdown 30 giây để user đưa ra quyết định

## 🔄 LUỒNG HOẠT ĐỘNG

### **1. Khởi tạo phòng chat (Frontend)**
```javascript
// Trong chat.js - handleMatchFound()
async handleMatchFound(data) {
    // ... existing logic ...
    
    // ✅ TIMER 5 PHÚT: Hiển thị like modal sau 5 phút
    setTimeout(() => {
        this.app.showLikeModal();
    }, 5 * 60 * 1000);  // 5 phút = 300,000ms
}
```

### **2. Hiển thị Like Modal (Frontend)**
```javascript
// Trong app.js
showLikeModal() {
    this.likeModule.showLikeModal();
}

// Trong like.js
showLikeModal() {
    const likeModal = document.getElementById('likeModal');
    if (likeModal) {
        likeModal.classList.remove('hidden');
        this.startLikeTimer();  // Bắt đầu countdown 30s
    }
}
```

### **3. Countdown Timer 30 giây (Frontend)**
```javascript
// Trong like.js
startLikeTimer() {
    let timeLeft = 30;  // 30 giây
    const timerBar = document.getElementById('likeTimer');
    const timeDisplay = document.getElementById('likeTimeLeft');
    
    this.likeTimer = setInterval(() => {
        timeLeft--;
        const percentage = (timeLeft / 30) * 100;
        timerBar.style.width = `${percentage}%`;
        timeDisplay.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            this.handleLike(false);  // Tự động "không thích" nếu hết thời gian
        }
    }, 1000);  // Cập nhật mỗi giây
}
```

### **4. Xử lý Like Response (Frontend)**
```javascript
// Trong like.js
async handleLike(liked) {
    if (this.likeTimer) {
        clearInterval(this.likeTimer);  // Dừng timer
    }
    
    try {
        const response = await fetch(`/chat/like/${this.app.currentRoom.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}` 
            },
            body: JSON.stringify({ liked })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.both_liked) {
                this.showImageReveal();  // Cả 2 đều thích
            } else if (result.need_second_round) {
                // ✅ TIMER 5 PHÚT LẦN 2: Hiển thị lại modal sau 5 phút
                setTimeout(() => {
                    this.showLikeModal();
                }, 5 * 60 * 1000);
            }
        }
    } catch (error) {
        console.error('Like error:', error);
    }
    
    // Ẩn modal
    const likeModal = document.getElementById('likeModal');
    if (likeModal) {
        likeModal.classList.add('hidden');
    }
}
```

## 🎨 GIAO DIỆN LIKE MODAL

### **HTML Structure:**
```html
<!-- Like Modal -->
<div id="likeModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Bạn có thích người ấy không?
        </h3>
        <p class="text-gray-600 dark:text-gray-300 mb-6">
            Sau 5 phút trò chuyện, hãy cho biết cảm nhận của bạn
        </p>
        
        <!-- Buttons -->
        <div class="flex space-x-4 justify-center">
            <button id="likeYes" class="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-lg">
                ❤️ Có
            </button>
            <button id="likeNo" class="px-8 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-lg">
                ❌ Không
            </button>
        </div>
        
        <!-- Timer Bar -->
        <div class="mt-6">
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div id="likeTimer" class="bg-red-500 h-2 rounded-full transition-all duration-1000" style="width: 100%"></div>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Thời gian còn lại: <span id="likeTimeLeft">30</span>s
            </p>
        </div>
    </div>
</div>
```

### **Event Listeners:**
```javascript
// Trong app.js
const likeYes = document.getElementById('likeYes');
const likeNo = document.getElementById('likeNo');

if (likeYes) {
    likeYes.addEventListener('click', () => this.likeModule.handleLike(true));
}
if (likeNo) {
    likeNo.addEventListener('click', () => this.likeModule.handleLike(false));
}
```

## 🔧 LOGIC BACKEND

### **1. API Like Response:**
```python
# Trong app/api/chat.py
@router.post("/like/{room_id}")
async def like_response(room_id: int, like_data: ChatLike, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Parse existing like responses
    like_responses = json.loads(room.like_responses) if room.like_responses else {}
    
    # Add current user's response
    user_key = "user1" if current_user.id == room.user1_id else "user2"
    like_responses[user_key] = like_data.response
    
    room.like_responses = json.dumps(like_responses)
    
    # Check if both users have responded
    if len(like_responses) == 2:
        user1_response = like_responses.get("user1")
        user2_response = like_responses.get("user2")
        
        if user1_response == "yes" and user2_response == "yes":
            # Both like each other - increase reveal level
            room.reveal_level = min(room.reveal_level + 1, 2)
        elif user1_response == "no" or user2_response == "no":
            # One or both don't like - schedule room end
            # This will be handled by a background task
            pass
    
    db.commit()
    return {"message": "Đã gửi phản hồi", "reveal_level": room.reveal_level}
```

### **2. WebSocket Like Response:**
```python
# Trong app/websocket_handlers.py
async def _handle_like_response(self, message_data: dict) -> bool:
    response = message_data.get("response")
    if response not in ["yes", "no"]:
        return False
    
    # Update room like responses
    like_responses = json.loads(self.room.like_responses) if self.room.like_responses else {}
    user_key = "user1" if self.user_id == self.room.user1_id else "user2"
    like_responses[user_key] = response
    
    self.room.like_responses = json.dumps(like_responses)
    
    # Check if both users have responded
    if len(like_responses) == 2:
        user1_response = like_responses.get("user1")
        user2_response = like_responses.get("user2")
        
        if user1_response == "yes" and user2_response == "yes":
            # Both like each other - increase reveal level
            self.room.reveal_level = min(self.room.reveal_level + 1, 2)
        elif user1_response == "no" or user2_response == "no":
            # One or both don't like - room will be ended
            pass
    
    self.db.commit()
    
    # Broadcast like response to room
    like_message = json.dumps({
        "type": "like_response",
        "user_id": self.user_id,
        "username": self.username,
        "response": response,
        "reveal_level": self.room.reveal_level,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    await manager.broadcast_to_room(like_message, self.room_id)
    return True
```

## ⏰ TIMING LOGIC

### **📅 Timeline:**
1. **T = 0:** User được match vào phòng chat
2. **T = 5 phút:** Hiển thị Like Modal lần đầu
3. **T = 5 phút + 30s:** Timer countdown kết thúc (tự động "không thích" nếu chưa chọn)
4. **T = 10 phút:** Hiển thị Like Modal lần 2 (nếu cần second round)

### **🔄 Second Round Logic:**
- Nếu user chưa đưa ra quyết định trong 30s đầu tiên
- Hoặc nếu cả 2 user chưa cùng thích nhau
- Hệ thống sẽ hiển thị lại Like Modal sau 5 phút nữa

## 🚨 VẤN ĐỀ TIỀM ẨN

### **1. Timer Conflict:**
- Timer 5 phút có thể bị conflict với logic end phòng
- Nếu user end phòng trước 5 phút, timer vẫn chạy

### **2. Memory Leak:**
- `setTimeout` và `setInterval` không được clear khi user rời phòng
- Có thể gây ra memory leak

### **3. Race Condition:**
- Nếu user reload page hoặc reconnect, timer có thể bị duplicate
- Multiple timers chạy cùng lúc

### **4. Backend Sync:**
- Frontend timer không sync với backend
- Backend không biết khi nào hiển thị modal

## 💡 GIẢI PHÁP ĐỀ XUẤT

### **1. Clear Timer khi End Phòng:**
```javascript
// Trong chat.js
resetChatState() {
    // Clear all timers
    if (this.likeTimer) {
        clearTimeout(this.likeTimer);
        this.likeTimer = null;
    }
    
    // ... existing logic ...
}
```

### **2. Backend-driven Timer:**
```python
# Backend gửi notification để hiển thị modal
async def schedule_like_prompt(room_id: int, delay_minutes: int = 5):
    await asyncio.sleep(delay_minutes * 60)
    
    # Gửi WebSocket notification
    like_prompt = {
        "type": "like_prompt",
        "room_id": room_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await manager.broadcast_to_room(json.dumps(like_prompt), room_id)
```

### **3. Frontend Timer Management:**
```javascript
class TimerManager {
    constructor() {
        this.timers = new Map();
    }
    
    setTimer(id, callback, delay) {
        this.clearTimer(id);
        const timer = setTimeout(callback, delay);
        this.timers.set(id, timer);
        return timer;
    }
    
    clearTimer(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
    }
    
    clearAll() {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
    }
}
```

## 📊 KẾT LUẬN

Logic countdown 5 phút của phòng chat hoạt động như sau:

1. **Timer 5 phút:** Hiển thị Like Modal sau khi match
2. **Timer 30 giây:** Countdown để user đưa ra quyết định
3. **Second round:** Hiển thị lại modal sau 5 phút nữa nếu cần
4. **Auto-response:** Tự động "không thích" nếu hết thời gian

**Vấn đề chính:** Timer không được quản lý tốt, có thể gây memory leak và race condition khi user end phòng hoặc reload page.

**Giải pháp:** Implement TimerManager để quản lý tất cả timer, clear timer khi end phòng, và sử dụng backend-driven notification thay vì frontend timer.
