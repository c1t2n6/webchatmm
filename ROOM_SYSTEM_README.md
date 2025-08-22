# Room Chat System - Tối ưu hóa hoàn toàn

## 🎯 Tổng quan

Hệ thống room chat đã được tối ưu hóa hoàn toàn với kiến trúc mới, xử lý lỗi robust, và quản lý lifecycle tự động. Hệ thống này giải quyết tất cả các vấn đề trước đó và cung cấp một nền tảng chat ổn định, có thể mở rộng.

## 🏗️ Kiến trúc mới

### 1. **WebSocket Manager** (`app/websocket_manager.py`)
- **Race condition protection**: Sử dụng `asyncio.Lock` cho mỗi room
- **State management**: Tracking user-room mapping và connection states
- **Connection validation**: Kiểm tra WebSocket state trước khi gửi message
- **Automatic cleanup**: Background task để dọn dẹp inactive rooms
- **Error recovery**: Xử lý failed connections và cleanup tự động

### 2. **WebSocket Handlers** (`app/websocket_handlers.py`)
- **Centralized validation**: Class `WebSocketHandler` với validation logic tập trung
- **Robust error handling**: Xử lý tất cả edge cases và exceptions
- **Message validation**: Kiểm tra format và content của messages
- **Database integration**: Lưu messages và cập nhật room state
- **Graceful cleanup**: Cleanup resources khi connection ends

### 3. **API Chat** (`app/api/chat.py`)
- **Room validation**: Class `RoomManager` với validation logic tập trung
- **Background tasks**: Sử dụng `BackgroundTasks` cho room cleanup
- **Error handling**: Consistent error handling và rollback
- **State consistency**: Đảm bảo user và room state luôn đồng bộ
- **New endpoints**: Thêm endpoint để lấy messages của room

### 4. **Room Creator** (`app/utils/matching/room_creator.py`)
- **User validation**: Kiểm tra users trước khi tạo room
- **Atomic operations**: Rollback nếu có lỗi trong quá trình tạo room
- **Status management**: Cập nhật user status một cách an toàn
- **Room lifecycle**: Methods để end room và cleanup
- **Expired room cleanup**: Tự động dọn dẹp rooms quá hạn

### 5. **Room Lifecycle Manager** (`app/utils/room_lifecycle_manager.py`)
- **Automatic cleanup**: Background tasks để dọn dẹp rooms
- **Health monitoring**: Kiểm tra sức khỏe của rooms định kỳ
- **Orphaned room detection**: Phát hiện rooms không có active connections
- **Graceful shutdown**: Cleanup an toàn khi shutdown
- **Configuration**: Có thể cấu hình timeout và cleanup intervals

## 🚀 Cách sử dụng

### 1. **Khởi động hệ thống**

```bash
# Chạy ứng dụng chính
python -m app.main

# Hoặc sử dụng uvicorn trực tiếp
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. **Chạy tests**

```bash
# Test hệ thống mock
python test_optimized_room_system.py

# Test hệ thống thực tế
python test_real_system.py

# Demo hệ thống
python demo_room_system.py
```

### 3. **Kiểm tra logs**

Hệ thống sử dụng `structlog` để logging chi tiết. Tất cả các hoạt động quan trọng đều được log lại với timestamp và context.

## 🔧 Cấu hình

### Room Lifecycle Manager

```python
# Trong app/utils/room_lifecycle_manager.py
class RoomLifecycleManager:
    def __init__(self):
        # Configuration
        self.room_timeout_hours = 24  # Rooms expire after 24 hours
        self.cleanup_interval_minutes = 30  # Run cleanup every 30 minutes
        self.maintenance_interval_minutes = 5  # Run maintenance every 5 minutes
```

### WebSocket Manager

```python
# Trong app/websocket_manager.py
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.room_connections: Dict[int, Dict[int, WebSocket]] = {}
        self.user_rooms: Dict[int, int] = {}  # user_id -> room_id mapping
        self.room_locks: Dict[int, asyncio.Lock] = {}  # Prevent race conditions
```

## 📡 API Endpoints

### Chat Endpoints

- `POST /chat/search` - Tìm kiếm người chat
- `POST /chat/cancel-search` - Hủy tìm kiếm
- `POST /chat/like/{room_id}` - Gửi phản hồi like
- `POST /chat/keep/{room_id}` - Giữ phiên chat
- `POST /chat/report/{room_id}` - Báo cáo người dùng
- `POST /chat/end/{room_id}` - Kết thúc phiên chat
- `GET /chat/room/{room_id}` - Lấy thông tin phòng
- `GET /chat/current-room` - Lấy phòng hiện tại
- `GET /chat/room/{room_id}/messages` - Lấy tin nhắn của phòng

### WebSocket Endpoints

- `WS /ws/chat/{room_id}` - Kết nối chat room
- `WS /ws/status` - Kết nối status updates

## 🔄 Room Lifecycle

### 1. **Room Creation**
```python
# Tạo room mới
success, room, error = room_creator.create_room_for_pair(db, user1, user2)
if success:
    print(f"Room {room.id} created successfully")
else:
    print(f"Failed to create room: {error}")
```

### 2. **User Connection**
```python
# Thêm user vào room
success = await manager.add_to_room(room_id, websocket, user_id)
if success:
    print(f"User {user_id} added to room {room_id}")
```

### 3. **Message Broadcasting**
```python
# Gửi message đến tất cả users trong room
await manager.broadcast_to_room(message_json, room_id)
```

### 4. **Room Cleanup**
```python
# Đóng room và cleanup
await manager.force_close_room(room_id)
```

## 🧪 Testing

### Mock Tests
```bash
python test_optimized_room_system.py
```
- Test room creation
- Test WebSocket connections
- Test message exchange
- Test room cleanup
- Test error handling

### Real System Tests
```bash
python test_real_system.py
```
- Test database connectivity
- Test WebSocket manager
- Test room creator
- Test room lifecycle manager
- Test API endpoints
- Test system integration

### Demo System
```bash
python demo_room_system.py
```
- Start lifecycle manager
- Create demo rooms
- Simulate user activity
- Show system monitoring
- Demonstrate cleanup processes

## 📊 Monitoring

### System Status
```python
from app.utils.room_lifecycle_manager import room_lifecycle_manager
from app.websocket_manager import manager

# Lifecycle manager status
lifecycle_status = room_lifecycle_manager.get_status()
print(f"Lifecycle Manager: {lifecycle_status['is_running']}")

# WebSocket manager status
active_rooms = len(manager.room_connections)
total_connections = sum(len(users) for users in manager.room_connections.values())
print(f"Active Rooms: {active_rooms}, Total Connections: {total_connections}")
```

### Room Status
```python
# Get room information
room_info = manager.get_room_info(room_id)
print(f"Room {room_id}: {room_info['status']}, {room_info['connection_count']} users")
```

## 🚨 Error Handling

### WebSocket Errors
- **4001**: Missing token
- **4002**: Account banned
- **4003**: Access denied to room
- **4004**: Room not found
- **4005**: Room has ended
- **4006**: Not authorized for room

### API Errors
- **400**: Bad request (validation errors)
- **403**: Forbidden (access denied)
- **404**: Not found (room/user not found)
- **500**: Internal server error

## 🔒 Security Features

### Authentication
- JWT token validation
- User permission checking
- Room access validation

### Input Validation
- Message content validation
- User input sanitization
- Rate limiting (có thể thêm)

### Room Isolation
- Users can only access their assigned rooms
- Automatic cleanup of expired rooms
- Protection against unauthorized access

## 📈 Performance Optimizations

### Async Operations
- All I/O operations are async
- Non-blocking message broadcasting
- Efficient room management

### Memory Management
- Automatic cleanup of inactive connections
- Efficient user-room mapping
- Background garbage collection

### Scalability
- Room-based isolation
- Stateless WebSocket handling
- Horizontal scaling support

## 🛠️ Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check token validity
   - Verify user permissions
   - Check room status

2. **Room Not Found**
   - Verify room exists in database
   - Check user's current_room_id
   - Ensure room hasn't ended

3. **Message Not Delivered**
   - Check WebSocket connection status
   - Verify user is in room
   - Check room permissions

### Debug Mode

```python
# Enable debug logging
import structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    level="DEBUG"
)
```

## 🔮 Future Enhancements

### Planned Features
- **Voice Chat Support**: WebRTC integration
- **File Sharing**: Secure file upload/download
- **Group Chats**: Multi-user rooms
- **Message Encryption**: End-to-end encryption
- **Analytics Dashboard**: Room usage statistics
- **Mobile App**: React Native app

### Performance Improvements
- **Redis Caching**: Session and message caching
- **Database Optimization**: Connection pooling
- **Load Balancing**: Multiple server instances
- **CDN Integration**: Static content delivery

## 📝 Changelog

### Version 2.0.0 (Current)
- ✅ Complete system rewrite
- ✅ Race condition protection
- ✅ Automatic room lifecycle management
- ✅ Robust error handling
- ✅ Comprehensive testing suite
- ✅ Performance optimizations

### Version 1.0.0 (Previous)
- ❌ Basic WebSocket implementation
- ❌ No race condition protection
- ❌ Manual room management
- ❌ Limited error handling
- ❌ No automated testing

## 🤝 Contributing

### Development Setup
```bash
# Clone repository
git clone <repository-url>
cd webchat

# Install dependencies
pip install -r requirements.txt

# Run tests
python test_optimized_room_system.py
python test_real_system.py

# Start development server
python -m app.main
```

### Code Standards
- Follow PEP 8 style guide
- Use type hints
- Add comprehensive docstrings
- Write unit tests for new features
- Update documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Getting Help
- Check the logs for error messages
- Review this documentation
- Run the test suite
- Check system status

### Reporting Issues
- Provide detailed error logs
- Include system configuration
- Describe steps to reproduce
- Attach relevant code snippets

---

**🎉 Hệ thống room chat đã được tối ưu hóa hoàn toàn và sẵn sàng cho production!**
