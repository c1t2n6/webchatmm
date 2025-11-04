# Technical Context: Mapmo.vn Technology Stack

## Core Technologies

### Backend Framework
- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Web application framework for Node.js
- **Socket.IO**: Real-time bidirectional event-based communication
- **FastAPI**: Python web framework for high-performance APIs (future consideration)

### Database
- **SQLite3**: Lightweight, serverless SQL database for development
- **PostgreSQL**: Production-ready relational database (migration path)
- **ACID Compliance**: Reliable data transactions and consistency
- **JSON Support**: Native JSON column support for user preferences

### Authentication & Security
- **JWT (JSON Web Tokens)**: Stateless authentication
- **bcrypt**: Password hashing and salting (12 rounds)
- **CORS**: Cross-origin resource sharing protection
- **Rate Limiting**: Request throttling for security
- **Input Validation**: Comprehensive data sanitization

### Frontend Technologies
- **Vanilla JavaScript**: ES6+ with modular architecture
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern styling with responsive design
- **WebRTC API**: Peer-to-peer audio communication
- **Socket.IO Client**: Real-time communication

### Real-time Communication
- **WebSocket**: Low-latency bidirectional communication
- **Socket.IO**: WebSocket abstraction with fallbacks
- **WebRTC**: Peer-to-peer audio streaming
- **STUN Servers**: NAT traversal for WebRTC

## Development Environment

### Node.js Configuration
- **Version**: Node.js 18.x (LTS)
- **Package Manager**: npm
- **Scripts**: 
  - `npm start`: Production server
  - `npm run dev`: Development with nodemon
  - `npm test`: Run test suite

### Dependencies
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^2.0.2",
    "socket.io": "^4.7.4",
    "socket.io-client": "^4.8.1",
    "sqlite3": "^5.1.6"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### Environment Configuration
- **Environment Variables**: dotenv for configuration management
- **Port**: Configurable via PORT environment variable (default: 8000)
- **Database URL**: SQLite file path configuration
- **JWT Settings**: Secret key and expiration configuration
- **WebRTC Config**: STUN server configuration

## File Structure

### Backend Structure
```
src/
├── server.js              # Main application entry point
├── models/                # Database models
│   ├── database.js        # Database connection and setup
│   ├── User.js           # User model with preferences
│   ├── Room.js           # Room model for conversations
│   ├── Message.js        # Message model for chat history
│   ├── CallSession.js    # Voice call session tracking
│   └── UserCallSettings.js # User voice call preferences
├── routes/                # API routes
│   ├── auth.js           # Authentication endpoints
│   ├── chat.js           # Chat and matching endpoints
│   ├── user.js           # User profile management
│   ├── voice_call.js     # Voice call endpoints
│   └── simple_countdown.js # Timer and notification system
├── services/              # Business logic services
│   ├── ConnectionManager.js    # WebSocket connection management
│   ├── WebSocketHandler.js     # Real-time message handling
│   ├── MatchingService.js      # User matching algorithm
│   └── VoiceCallService.js     # Voice call management
├── middleware/            # Express middleware
│   ├── auth.js           # JWT authentication
│   ├── rateLimiter.js    # Rate limiting
│   ├── validation.js     # Input validation
│   └── errorHandler.js   # Error handling
└── utils/                 # Utility functions
    └── logger.js          # Logging utilities
```

### Frontend Structure
```
static/
├── js/
│   ├── app.js            # Main application controller
│   └── modules/          # Modular JavaScript components
│       ├── auth.js       # Authentication handling
│       ├── profile.js    # Profile management
│       ├── profile-edit.js # Profile editing interface
│       ├── chat_refactored.js # Chat functionality
│       ├── voice_call_manager.js # Voice call WebRTC handling
│       ├── like.js       # Like system and photo reveal
│       ├── websocket_manager.js # WebSocket communication
│       ├── ui.js         # UI interactions
│       ├── utils.js      # Utility functions
│       ├── timer_manager.js # Timer management
│       ├── call_screen_manager.js # Call screen interface
│       └── error_handler.js # Error handling
├── css/                  # Stylesheets
├── images/               # Static images
└── uploads/              # File upload directory
```

### Templates
```
templates/
├── index.html            # Main application template
└── components/           # Reusable HTML components
```

## Configuration Management

### Environment Variables
```bash
# Server Configuration
PORT=8000
NODE_ENV=production

# Database Configuration
DATABASE_URL=./app.db

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# WebRTC Configuration
STUN_SERVER_1=stun:stun.l.google.com:19302
STUN_SERVER_2=stun:stun1.l.google.com:19302

# Security Configuration
BCRYPT_ROUNDS=12
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Configuration File (`config.js`)
```javascript
module.exports = {
  port: process.env.PORT || 8000,
  database: {
    url: process.env.DATABASE_URL || './app.db'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  webrtc: {
    iceServers: [
      { urls: process.env.STUN_SERVER_1 || 'stun:stun.l.google.com:19302' },
      { urls: process.env.STUN_SERVER_2 || 'stun:stun1.l.google.com:19302' }
    ]
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    }
  }
};
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE,
  nickname VARCHAR(50),
  dob DATE,
  gender VARCHAR(20),
  preferred_gender TEXT, -- JSON array
  needs TEXT, -- JSON array
  interests TEXT, -- JSON array
  profile_completed BOOLEAN DEFAULT FALSE,
  role VARCHAR(20) DEFAULT 'free',
  status VARCHAR(20) DEFAULT 'idle',
  current_room_id INTEGER,
  avatar_url VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  banned_until DATETIME,
  FOREIGN KEY (current_room_id) REFERENCES rooms(id)
);
```

### Rooms Table
```sql
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER NOT NULL,
  entry_mode VARCHAR(20) DEFAULT 'chat',
  reveal_level INTEGER DEFAULT 0,
  like_responses TEXT, -- JSON object
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id)
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Call Sessions Table
```sql
CREATE TABLE call_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  caller_id INTEGER NOT NULL,
  callee_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'initiated',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME,
  ended_at DATETIME,
  duration INTEGER, -- in seconds
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (caller_id) REFERENCES users(id),
  FOREIGN KEY (callee_id) REFERENCES users(id)
);
```

## API Endpoints

### Authentication Endpoints
```
POST /auth/register     # User registration
POST /auth/login        # User login
POST /auth/logout       # User logout
GET  /auth/verify       # Token verification
```

### User Management Endpoints
```
GET  /user/profile      # Get user profile
PUT  /user/profile      # Update user profile
GET  /user/stats        # Get user statistics
POST /user/upload-avatar # Upload avatar image
```

### Chat Endpoints
```
POST /chat/search       # Start matching search
POST /chat/cancel-search # Cancel matching search
POST /chat/like/:roomId # Submit like response
POST /chat/keep/:roomId # Keep conversation active
POST /chat/end/:roomId  # End conversation
```

### Voice Call Endpoints
```
POST /voice-call/invite  # Send voice call invitation
POST /voice-call/accept  # Accept voice call
POST /voice-call/reject  # Reject voice call
POST /voice-call/end     # End voice call
```

## WebSocket Events

### Client to Server Events
```javascript
// Authentication
'join_room'           // Join a chat room
'leave_room'          // Leave a chat room

// Chat Events
'send_message'        // Send text message
'typing_start'        // Start typing indicator
'typing_stop'         // Stop typing indicator

// Voice Call Events
'voice_call_invitation'    // Send voice call invitation
'voice_call_accept'        // Accept voice call
'voice_call_reject'        // Reject voice call
'webrtc_offer'            // WebRTC offer
'webrtc_answer'           // WebRTC answer
'ice_candidate'           // ICE candidate

// Like System Events
'like_response'       // Submit like response
'keep_conversation'   // Keep conversation active
```

### Server to Client Events
```javascript
// Room Events
'room_joined'         // Successfully joined room
'room_left'           // Left room
'user_joined'         // User joined room
'user_left'           // User left room

// Message Events
'message_received'    // New message received
'typing_indicator'    // User typing status

// Voice Call Events
'voice_call_invitation'    // Incoming voice call
'voice_call_accepted'      // Voice call accepted
'voice_call_rejected'      // Voice call rejected
'voice_call_ended'         // Voice call ended

// Like System Events
'like_question'       // Show like question modal
'photo_revealed'      // Photo reveal level updated
'conversation_ended'  // Conversation auto-ended

// System Events
'error'               // Error message
'notification'        // System notification
```

## Deployment Configuration

### Render.com Configuration
```yaml
# render.yaml
services:
  - type: web
    name: mapmo-webchat
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8000
      - key: JWT_SECRET
        generateValue: true
      - key: DATABASE_URL
        value: ./app.db
```

### Environment-Specific Settings
```javascript
// Production optimizations
if (process.env.NODE_ENV === 'production') {
  app.use(compression());
  app.use(helmet());
  app.use(morgan('combined'));
}
```

## Performance Optimizations

### Database Performance
- **Indexing**: Optimized indexes on frequently queried columns
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Prepared statements and efficient queries
- **Caching**: In-memory caching for frequently accessed data

### WebSocket Performance
- **Connection Management**: Efficient connection lifecycle management
- **Room-based Broadcasting**: Targeted message delivery
- **Event Batching**: Batch multiple events for efficiency
- **Memory Management**: Proper cleanup of disconnected users

### Frontend Performance
- **Module Loading**: Lazy loading of non-critical modules
- **Event Delegation**: Efficient event handling
- **DOM Optimization**: Minimal DOM manipulation
- **Resource Optimization**: Compressed assets and images

## Security Measures

### Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Token Expiration**: Time-based token validity
- **Session Management**: Secure session handling

### Data Protection
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: Cross-site request forgery prevention

### Communication Security
- **HTTPS**: SSL/TLS encryption in production
- **WebSocket Security**: Secure WebSocket connections
- **CORS Configuration**: Proper cross-origin settings
- **Rate Limiting**: Request throttling and abuse prevention

## Monitoring & Logging

### Application Logging
```javascript
// Structured logging
console.log(`🔍 User ${userId} started search for ${entryMode}`);
console.error(`❌ Matching failed: ${error.message}`);
console.info(`📞 Voice call initiated between ${callerId} and ${calleeId}`);
```

### Health Monitoring
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: connectionManager.getConnectionCount()
  });
});
```

### Performance Metrics
- **Response Times**: API endpoint performance
- **WebSocket Latency**: Real-time communication speed
- **Database Performance**: Query execution times
- **Memory Usage**: Application memory consumption
- **Connection Count**: Active WebSocket connections

## Development Workflow

### Local Development
1. **Setup**: `npm install` to install dependencies
2. **Environment**: Copy `.env.example` to `.env`
3. **Database**: SQLite database auto-created on first run
4. **Development**: `npm run dev` for hot reloading
5. **Testing**: Manual testing via browser

### Production Deployment
1. **Build**: No build step required (Node.js)
2. **Environment**: Set production environment variables
3. **Database**: SQLite file created automatically
4. **Start**: `npm start` to run production server
5. **Monitoring**: Health check endpoints available

### Code Quality
- **ESLint**: JavaScript code linting
- **Prettier**: Code formatting
- **Git Hooks**: Pre-commit code quality checks
- **Code Review**: Peer review process