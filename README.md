# Mapmo.vn - Anonymous Web Chat Application

Ứng dụng web chat ẩn danh thông minh, tập trung vào ghép đôi người dùng dựa trên giới tính, nhu cầu và sở thích.

## 🚀 Tính Năng Chính

- **Chat Ẩn Danh**: Trò chuyện text mà không lộ danh tính ban đầu
- **Ghép Đôi Thông Minh**: Thuật toán matching dựa trên preferences và interests
- **Reveal Image System**: 3 cấp độ blur (20px → 5px → full) khi cả 2 đồng ý
- **Like System**: Sau 5 phút chat, hỏi "Bạn có thích người ấy không?"
- **Privacy First**: Tin nhắn bị xóa hoàn toàn khi kết thúc session
- **Admin Dashboard**: Quản lý users, reports, và moderation

## 🛠️ Tech Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: HTML + Tailwind CSS + Vanilla JavaScript
- **Real-time**: WebSocket native
- **Authentication**: JWT + bcrypt
- **Image Processing**: Pillow (PIL)
- **Logging**: structlog

## 📋 Yêu Cầu Hệ Thống

- Python 3.8+
- pip
- Virtual environment (khuyến nghị)

## 🚀 Cài Đặt & Chạy

### 1. Clone Repository
```bash
git clone <repository-url>
cd webchat
```

### 2. Tạo Virtual Environment
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 3. Cài Đặt Dependencies
```bash
pip install -r requirements.txt
```

### 4. Tạo File .env
```bash
cp env.example .env
# Chỉnh sửa .env với các giá trị thực tế
```

### 5. Khởi Tạo Database
```bash
python scripts/init_db.py
```

### 6. Chạy Ứng Dụng
```bash
python -m app.main
# Hoặc
uvicorn app.main:app --reload
```

Ứng dụng sẽ chạy tại: http://localhost:8000

## 🔐 Admin Access

- **Username**: Admin
- **Password**: Passwordnaoday123

## 📱 API Endpoints

### Authentication
- `POST /auth/signup` - Đăng ký tài khoản
- `POST /auth/login` - Đăng nhập
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Đăng xuất

### User Management
- `GET /user/profile` - Lấy thông tin profile
- `PUT /user/profile/update` - Cập nhật profile
- `POST /user/avatar/upload` - Upload avatar
- `GET /user/status` - Lấy trạng thái user

### Chat & Matching
- `POST /chat/search` - Tìm kiếm chat partner
- `POST /chat/cancel-search` - Hủy tìm kiếm
- `POST /chat/like/{room_id}` - Gửi like response
- `POST /chat/keep/{room_id}` - Giữ session active
- `POST /chat/report/{room_id}` - Báo cáo user
- `POST /chat/end/{room_id}` - Kết thúc session

### Admin
- `GET /admin/dashboard` - Dashboard thống kê
- `GET /admin/users` - Danh sách users
- `GET /admin/users/{user_id}` - Chi tiết user
- `PUT /admin/users/{user_id}` - Cập nhật user
- `POST /admin/users/{user_id}/ban` - Ban user
- `POST /admin/users/{user_id}/unban` - Unban user
- `GET /admin/reports` - Danh sách reports
- `GET /admin/rooms` - Danh sách rooms

### WebSocket
- `ws://localhost:8000/ws/chat/{room_id}` - Chat room
- `ws://localhost:8000/ws/status` - Status updates

## 🗄️ Database Schema

### Users
- Thông tin cơ bản: username, nickname, email, dob, gender
- Preferences: preferred_gender, needs, interests
- Status: profile_completed, status, online_status, current_room_id
- Moderation: reports_count, banned_until, role

### Rooms
- Chat sessions: user1_id, user2_id, start_time, end_time
- Like system: like_responses, reveal_level
- Session control: keep_active, last_message_time

### Messages
- Chat content: room_id, user_id, content, timestamp
- **Lưu ý**: Messages bị xóa hoàn toàn khi session kết thúc

### Reports
- User reports: reporter_id, reported_user_id, room_id, reason
- Auto-ban system: >=5 reports → ban 1 ngày

## 🔒 Security Features

- JWT authentication với expiry 1 giờ
- Password hashing với bcrypt
- Rate limiting: Search (5/min), Upload (10/min), Login (3/min)
- Input validation nghiêm ngặt
- Age verification (>18 tuổi)
- No self-matching
- Content moderation system

## 🎯 Business Logic

### Matching Algorithm
1. **Gender Preference**: Kiểm tra giới tính mong muốn
2. **Needs Matching**: Phải có >=1 nhu cầu trùng
3. **Interests Scoring**: Tính điểm dựa trên số sở thích chung
4. **Fallback**: Random matching sau 30s timeout

### Chat Session Flow
1. **Match** → Tạo room, cả 2 = CONNECTED
2. **5 phút** → Hiện modal "Bạn có thích người ấy không?"
3. **Like Response**:
   - Cả 2 "Có" → Reveal ảnh dần, mở voice
   - 1 "Không" → +5 phút, hỏi lại
   - Vẫn không đồng thuận → Auto end
4. **Inactivity**: 15 phút không tin nhắn → auto end (trừ khi Keep)

### Image Reveal System
- **Level 0**: Blur (Gaussian 20px) - Mặc định
- **Level 1**: Semi-blur (Gaussian 5px) - Sau like round 1
- **Level 2**: Full image - Sau like round 2 thành công

## 🧪 Testing

### Backend Testing
```bash
pytest tests/
```

### Performance Testing
```bash
python scripts/fake_users.py --num=100
```

## 🚀 Deployment

### Render.com (Recommended)
1. Connect GitHub repository
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment Variables: Copy từ .env

### Local Production
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📊 Monitoring

- **Logs**: `logs/app.log` (structlog)
- **Health Check**: `GET /health`
- **Admin Dashboard**: `/admin/dashboard`

## 🔮 Future Extensions

- Voice Call (WebRTC)
- Premium Features
- Multilingual Support
- Push Notifications
- Mobile App
- AI-powered Matching

## 📝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: Xem LOGIC.md và DEVELOPMENT_PLAN.md
- **Admin**: Sử dụng admin dashboard tại `/admin`

---

**Lưu ý**: Đây là ứng dụng chat ẩn danh, mọi thay đổi code phải tuân thủ logic trong LOGIC.md để đảm bảo privacy và security.
