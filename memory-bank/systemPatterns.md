# System Patterns: Mapmo.vn Architecture

## Overall Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ - MapmoApp      │    │ - Express.js    │    │ - Users         │
│ - Modules       │    │ - Socket.IO     │    │ - Rooms         │
│ - WebRTC        │    │ - Matching      │    │ - Messages      │
│ - Voice Calls   │    │ - Voice Service │    │ - CallSessions  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Frontend Architecture (`static/js/`)

#### Main Application (`app.js`)
- **MapmoApp Class**: Central application controller
- **Module Management**: Orchestrates all frontend modules
- **State Management**: Manages user state, room state, and UI state
- **Event Handling**: Centralized event binding and handling

#### Modular Components
```
static/js/modules/
├── auth.js                 # Authentication handling
├── profile.js              # Profile management
├── profile-edit.js         # Profile editing interface
├── chat_refactored.js      # Chat functionality
├── voice_call_manager.js   # Voice call WebRTC handling
├── like.js                 # Like system and photo reveal
├── websocket_manager.js    # WebSocket communication
├── ui.js                   # UI interactions and transitions
├── utils.js                # Utility functions
├── timer_manager.js        # Timer management
├── call_screen_manager.js  # Call screen interface
└── error_handler.js        # Error handling
```

### 2. Backend Architecture (`src/`)

#### Server Layer (`server.js`)
- **Express.js Application**: Main server setup
- **Socket.IO Integration**: Real-time communication
- **Route Mounting**: API endpoint organization
- **Middleware Integration**: Authentication, CORS, rate limiting

#### Service Layer (`src/services/`)
```
src/services/
├── ConnectionManager.js    # WebSocket connection management
├── WebSocketHandler.js     # Real-time message handling
├── MatchingService.js      # User matching algorithm
└── VoiceCallService.js     # Voice call management
```

#### Model Layer (`src/models/`)
```
src/models/
├── database.js             # Database connection and setup
├── User.js                 # User model with preferences
├── Room.js                 # Room model for conversations
├── Message.js              # Message model for chat history
├── CallSession.js          # Voice call session tracking
└── UserCallSettings.js     # User voice call preferences
```

#### Route Layer (`src/routes/`)
```
src/routes/
├── auth.js                 # Authentication endpoints
├── chat.js                 # Chat and matching endpoints
├── user.js                 # User profile management
├── voice_call.js           # Voice call endpoints
└── simple_countdown.js     # Timer and notification system
```

## Key Design Patterns

### 1. Module Pattern (Frontend)
**Purpose**: Encapsulate related functionality into reusable modules
**Implementation**:
```javascript
export class VoiceCallManager {
    constructor(app, webSocketManager) {
        this.app = app;
        this.webSocketManager = webSocketManager;
        // Module-specific initialization
    }
}
```

**Benefits**:
- Clear separation of concerns
- Reusable components
- Easy testing and maintenance
- Loose coupling between modules

### 2. Service Layer Pattern (Backend)
**Purpose**: Separate business logic from API endpoints
**Implementation**:
```javascript
class MatchingService {
    async addToSearchQueue(userId, searchData) {
        // Business logic for matching
    }
    
    async tryMatch() {
        // Matching algorithm
    }
}
```

**Benefits**:
- Reusable business logic
- Easier testing
- Clear API boundaries
- Centralized data access

### 3. Event-Driven Architecture
**Purpose**: Decouple components through events
**Implementation**:
```javascript
// Frontend: Event emission
this.webSocketManager.send('webrtc_offer', offerData);

// Backend: Event handling
socket.on('webrtc_offer', async (data) => {
    await this.handleWebRTCOffer(socket, data);
});
```

**Benefits**:
- Loose coupling
- Scalable communication
- Easy to add new features
- Real-time responsiveness

### 4. State Machine Pattern
**Purpose**: Manage complex user states and transitions
**Implementation**:
```javascript
// User states
const USER_STATES = {
    IDLE: 'idle',
    SEARCHING: 'searching', 
    CONNECTED: 'connected'
};

// Call states
const CALL_STATES = {
    IDLE: 'idle',
    CALLING: 'calling',
    RINGING: 'ringing',
    CONNECTING: 'connecting',
    ACTIVE: 'active',
    ENDING: 'ending'
};
```

**Benefits**:
- Clear state transitions
- Prevents invalid states
- Easy debugging
- Predictable behavior

## Data Flow Patterns

### 1. User Authentication Flow
```
User → Frontend → /auth/login → JWT Middleware → User Model → Database
                ↓
            Set Token → Update UI → Initialize Modules
```

### 2. Matching Flow
```
User Search → MatchingService → Compatibility Check → Room Creation → WebSocket Notification
                ↓
            Update User Status → Broadcast to Users → Initialize Communication
```

### 3. Message Flow
```
User Input → Frontend → WebSocket → WebSocketHandler → Message Model → Database
                ↓
            Broadcast to Room → Update UI → Typing Indicators
```

### 4. Voice Call Flow
```
Call Initiation → VoiceCallService → WebRTC Setup → Peer Connection → Audio Stream
                ↓
            Call Session Tracking → Status Updates → Call Management
```

### 5. Like System Flow
```
5-minute Timer → Like Modal → User Response → Like Handler → Photo Reveal Logic
                ↓
            Update Room State → Broadcast Changes → UI Updates
```

## Communication Patterns

### 1. WebSocket Communication
**Bidirectional Real-time Communication**:
```javascript
// Client to Server
socket.emit('webrtc_offer', offerData);
socket.emit('like_response', { response: 'yes' });

// Server to Client
socket.on('voice_call_invitation', (data) => {
    this.handleIncomingCall(data);
});
```

**Event Types**:
- `webrtc_offer/answer`: Voice call signaling
- `ice_candidate`: WebRTC connection setup
- `like_response`: Like system responses
- `typing_indicator`: Real-time typing status
- `room_update`: Room state changes

### 2. REST API Communication
**Standard HTTP Requests**:
```javascript
// Authentication
POST /auth/login
POST /auth/register

// User Management
GET /user/profile
PUT /user/profile

// Chat Operations
POST /chat/search
POST /chat/cancel-search
POST /chat/like/:roomId
```

### 3. WebRTC Peer-to-Peer
**Direct Audio Communication**:
```javascript
// Create peer connection
const peerConnection = new RTCPeerConnection(rtcConfiguration);

// Handle audio streams
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        localStream = stream;
        peerConnection.addStream(stream);
    });
```

## Security Patterns

### 1. Authentication & Authorization
**JWT-based Authentication**:
```javascript
// Token validation middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
};
```

### 2. Input Validation
**Data Sanitization**:
```javascript
// Message validation
const validateMessage = (message) => {
    if (!message || typeof message !== 'string') return false;
    if (message.length > 1000) return false;
    return true;
};
```

### 3. Rate Limiting
**Request Throttling**:
```javascript
const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
```

## Performance Patterns

### 1. Connection Management
**Efficient WebSocket Handling**:
```javascript
class ConnectionManager {
    constructor() {
        this.activeConnections = new Map();
        this.roomConnections = new Map();
    }
    
    addConnection(userId, socket) {
        this.activeConnections.set(userId, socket);
    }
    
    removeConnection(userId) {
        this.activeConnections.delete(userId);
    }
}
```

### 2. Database Optimization
**Query Optimization**:
```javascript
// Efficient user lookup
async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return await this.db.get(sql, [id]);
}

// Batch operations
async updateMultipleUsers(updates) {
    const sql = 'UPDATE users SET status = ? WHERE id = ?';
    const stmt = await this.db.prepare(sql);
    for (const update of updates) {
        await stmt.run(update.status, update.id);
    }
}
```

### 3. Caching Strategy
**In-Memory Caching**:
```javascript
// Room state caching
const roomStates = new Map();

// User session caching
const userSessions = new Map();
```

## Error Handling Patterns

### 1. Centralized Error Handling
**Global Error Handler**:
```javascript
app.use((error, req, res, next) => {
    console.error('Global error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});
```

### 2. WebSocket Error Handling
**Connection Error Recovery**:
```javascript
socket.on('disconnect', (reason) => {
    console.log('User disconnected:', reason);
    this.handleUserDisconnect(socket.userId);
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
    this.handleSocketError(socket, error);
});
```

### 3. Frontend Error Handling
**Graceful Degradation**:
```javascript
try {
    await this.startVoiceCall();
} catch (error) {
    console.error('Voice call error:', error);
    this.showError('Không thể bắt đầu cuộc gọi');
    this.fallbackToChat();
}
```

## Scalability Patterns

### 1. Horizontal Scaling
**Stateless Design**:
- JWT tokens for stateless authentication
- Database as single source of truth
- WebSocket connections can be distributed

### 2. Database Scaling
**SQLite to PostgreSQL Migration Path**:
- Abstracted database layer
- Easy to switch database engines
- Connection pooling ready

### 3. Real-time Scaling
**Socket.IO Clustering**:
- Redis adapter for multi-instance support
- Room-based message distribution
- Efficient connection management

## Monitoring & Observability

### 1. Logging Strategy
**Structured Logging**:
```javascript
console.log(`🔍 User ${userId} started search for ${entryMode}`);
console.error(`❌ Matching failed for user ${userId}: ${error.message}`);
```

### 2. Health Checks
**System Monitoring**:
```javascript
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
```

### 3. Performance Metrics
**Key Metrics**:
- WebSocket connection count
- Message delivery latency
- Matching success rate
- Voice call quality
- User engagement metrics