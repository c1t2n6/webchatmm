# 💬 WebChat - Real-time Chat Application

A modern, real-time chat application built with FastAPI and WebSocket technology, featuring intelligent room management and user matching system.

## 🌟 Features

### **Core Chat Features**
- **Real-time Messaging**: Instant message delivery using WebSocket
- **User Authentication**: Secure JWT-based authentication system
- **Room Management**: Dynamic chat room creation and management
- **Message History**: Persistent message storage and retrieval
- **File Uploads**: Support for image and file sharing

### **Advanced Room Lifecycle Management**
- **Smart Room Keeping**: Users can choose to keep conversations active
- **Countdown System**: Automatic room termination with countdown timer
- **Notification System**: Interactive notifications for room decisions
- **Unified State Management**: Centralized room state handling

### **User Matching System**
- **Compatibility Scoring**: AI-powered user matching algorithm
- **Queue Management**: Efficient user pairing system
- **Profile Management**: User profile creation and management
- **Like System**: User preference tracking

## 🏗️ Architecture

### **Backend (FastAPI)**
```
app/
├── api/                    # API endpoints
│   ├── auth.py            # Authentication endpoints
│   ├── chat.py            # Chat and room management
│   ├── simple_countdown.py # Countdown and notification system
│   └── user.py            # User management
├── services/              # Business logic services
│   ├── chat_service.py    # Chat message handling
│   └── unified_room_service.py # Centralized room lifecycle
├── utils/                 # Utility functions
│   ├── auth_utils.py      # JWT authentication
│   ├── image_utils.py     # Image processing
│   └── matching/          # User matching algorithms
├── websocket/             # WebSocket handling
│   ├── connection_manager.py
│   ├── websocket_manager.py
│   └── websocket_routes.py
└── models/                # Database models
```

### **Frontend (Vanilla JavaScript)**
```
static/js/modules/
├── app.js                 # Main application controller
├── auth.js               # Authentication handling
├── chat.js               # Chat interface and room management
├── simple_countdown_v2.js # Countdown and notification UI
├── profile.js            # User profile management
├── like.js               # Like system
├── timer_manager.js      # Timer utilities
├── ui.js                 # UI utilities
└── utils.js              # General utilities
```

## 🚀 Quick Start

### **Prerequisites**
- Python 3.8+
- SQLite (or PostgreSQL for production)

### **Installation**

1. **Clone the repository**
```bash
git clone <repository-url>
cd webchat
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables**
```bash
cp env.example .env
# Edit .env with your configuration
```

5. **Initialize database**
```bash
python scripts/init_db.py
```

6. **Run the application**
```bash
uvicorn app.main:app --reload
```

The application will be available at `http://localhost:8000`

## 🔧 Configuration

### **Environment Variables**
```env
# Database
DATABASE_URL=sqlite:///./app.db

# JWT Settings
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
DEBUG=True
HOST=0.0.0.0
PORT=8000
```

## 📱 API Documentation

### **Authentication Endpoints**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### **Chat Endpoints**
- `GET /chat/rooms` - Get user's chat rooms
- `POST /chat/rooms` - Create new chat room
- `POST /chat/keep/{room_id}` - Keep room active
- `POST /chat/like/{room_id}` - Respond to keep active request

### **Countdown Endpoints**
- `POST /simple-countdown/start/{room_id}` - Start countdown
- `POST /simple-countdown/response/{room_id}` - Respond to notification
- `GET /simple-countdown/status/{room_id}` - Get room status

### **WebSocket Endpoints**
- `WS /ws/chat/{room_id}` - Chat room WebSocket
- `WS /ws/notifications` - Global notifications

## 🎯 Room Lifecycle System

### **Room States**
1. **IDLE**: Room is active, waiting for countdown
2. **COUNTDOWN**: 5-minute countdown before notification
3. **NOTIFICATION**: 30-second notification for user decision
4. **ENDED**: Room terminated

### **User Actions**
- **Keep Active**: User chooses to continue conversation
- **End Chat**: User chooses to end conversation
- **No Response**: User doesn't respond within timeout

### **Room Outcomes**
- **Room Kept**: Both users chose to keep active
- **Room Ended**: At least one user chose to end or didn't respond

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password hashing
- **CORS Protection**: Configured CORS policies
- **Input Validation**: Pydantic model validation
- **SQL Injection Protection**: SQLAlchemy ORM protection

## 🚀 Deployment

### **Render.com Deployment**

1. **Connect your repository** to Render.com
2. **Create a new Web Service**
3. **Configure build settings**:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Set environment variables** in Render dashboard
5. **Deploy!**

### **Environment Variables for Production**
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET_KEY=your-production-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=False
```

## 🧪 Testing

### **Run Tests**
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest
```

### **Manual Testing**
1. Register two test users
2. Create a chat room
3. Test message sending
4. Test room keeping functionality
5. Test countdown and notification system

## 📊 Monitoring

### **Logging**
- Structured logging with `structlog`
- Log levels: DEBUG, INFO, WARNING, ERROR
- Log files in `logs/` directory

### **Health Checks**
- `GET /health` - Application health check
- Database connection monitoring
- WebSocket connection tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/docs`
- Review the WebSocket documentation at `/ws/docs`

---

**Built with ❤️ using FastAPI, WebSocket, and modern web technologies**