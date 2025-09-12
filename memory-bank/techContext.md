# Technical Context: WebChat Technology Stack

## Core Technologies

### Backend Framework
- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Web application framework for Node.js
- **Socket.IO**: Real-time bidirectional event-based communication

### Database
- **SQLite3**: Lightweight, serverless SQL database
- **File-based**: Database stored as single file (app.db)
- **ACID Compliance**: Reliable data transactions

### Authentication & Security
- **JWT (JSON Web Tokens)**: Stateless authentication
- **bcrypt**: Password hashing and salting
- **CORS**: Cross-origin resource sharing protection
- **Rate Limiting**: Request throttling for security

### Frontend Technologies
- **Vanilla JavaScript**: No framework dependencies
- **HTML5**: Semantic markup
- **CSS3**: Modern styling and responsive design
- **WebSocket API**: Real-time communication client

## Development Environment

### Node.js Configuration
- **Version**: Node.js 18.x (as specified in package.json)
- **Package Manager**: npm
- **Scripts**: 
  - `npm start`: Production server
  - `npm run dev`: Development with nodemon

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
- **Environment Variables**: dotenv for configuration
- **Port**: Configurable via PORT environment variable
- **Database URL**: SQLite file path configuration
- **JWT Settings**: Secret key and expiration configuration

## File Structure

### Backend Structure
```
src/
├── server.js              # Main application entry point
├── models/                # Database models
│   ├── database.js        # Database connection
│   ├── User.js           # User model
│   ├── Room.js           # Room model
│   └── Message.js        # Message model
├── routes/                # API routes
│   ├── auth.js           # Authentication routes
│   ├── chat.js           # Chat functionality
│   ├── user.js           # User management
│   └── simple_countdown.js # Countdown features
├── services/              # Business logic services
│   ├── ConnectionManager.js
│   ├── WebSocketHandler.js
│   └── MatchingService.js
├── middleware/            # Express middleware
│   ├── auth.js
│   ├── rateLimiter.js
│   ├── validation.js
│   └── errorHandler.js
└── utils/                 # Utility functions
    └── logger.js
```

### Frontend Structure
```
static/
├── js/
│   ├── app.js            # Main application logic
│   └── modules/          # Modular JavaScript components
│       ├── auth.js       # Authentication handling
│       ├── chat_refactored.js # Chat functionality
│       ├── websocket_manager.js # WebSocket management
│       ├── ui.js         # UI interactions
│       └── ...
└── uploads/              # File upload directory
```

## Configuration Management

### Environment Variables
- **Development**: `.env` file for local development
- **Production**: Environment variables set by hosting platform
- **Security**: Sensitive data stored in environment variables

### Configuration File (`config.js`)
- **Centralized**: All configuration in one place
- **Environment-aware**: Different settings for dev/prod
- **Type-safe**: Proper data type conversion
- **Default values**: Fallback values for missing config

## Deployment Considerations

### Platform Requirements
- **Node.js**: Version 18.x or higher
- **Memory**: Minimum 512MB RAM
- **Storage**: SQLite file storage
- **Port**: Configurable port (default 8000)

### Production Optimizations
- **Environment**: NODE_ENV=production
- **Logging**: Structured logging with log levels
- **Error Handling**: Comprehensive error management
- **Graceful Shutdown**: Proper cleanup on termination

### Security Measures
- **HTTPS**: SSL/TLS encryption in production
- **CORS**: Proper cross-origin configuration
- **Rate Limiting**: Request throttling
- **Input Validation**: Data sanitization
- **JWT Security**: Secure token handling

## Performance Characteristics

### Database Performance
- **SQLite**: Fast for read-heavy workloads
- **File-based**: No network latency
- **ACID**: Reliable data consistency
- **Indexing**: Optimized query performance

### WebSocket Performance
- **Real-time**: Low-latency communication
- **Connection Management**: Efficient connection handling
- **Event-driven**: Asynchronous message processing
- **Scalability**: Horizontal scaling considerations

### Memory Usage
- **Node.js**: V8 JavaScript engine
- **Connection Pooling**: Efficient resource usage
- **Garbage Collection**: Automatic memory management
- **Memory Monitoring**: Built-in memory usage tracking

## Development Workflow

### Local Development
1. **Setup**: `npm install` to install dependencies
2. **Environment**: Copy `.env.example` to `.env`
3. **Database**: SQLite database auto-created
4. **Development**: `npm run dev` for hot reloading
5. **Testing**: Manual testing via browser

### Production Deployment
1. **Build**: No build step required (Node.js)
2. **Environment**: Set production environment variables
3. **Database**: SQLite file created automatically
4. **Start**: `npm start` to run production server
5. **Monitoring**: Health check endpoints available
