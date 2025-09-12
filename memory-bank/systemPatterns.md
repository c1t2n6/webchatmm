# System Patterns: WebChat Architecture

## Overall Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ - HTML/CSS/JS   │    │ - Express.js    │    │ - Users         │
│ - Socket.IO     │    │ - Socket.IO     │    │ - Rooms         │
│ - WebSocket     │    │ - JWT Auth      │    │ - Messages      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Server Layer (`src/server.js`)
- **Express.js** application setup
- **Socket.IO** WebSocket server
- **CORS** configuration
- **Middleware** integration
- **Route** mounting
- **Error handling**

### 2. Database Layer (`src/models/`)
- **Database.js**: SQLite connection and table management
- **User.js**: User model with authentication methods
- **Room.js**: Room model for chat room management
- **Message.js**: Message model for chat history

### 3. Service Layer (`src/services/`)
- **ConnectionManager.js**: WebSocket connection management
- **WebSocketHandler.js**: Real-time message handling
- **MatchingService.js**: User matching and room assignment

### 4. Route Layer (`src/routes/`)
- **auth.js**: Authentication endpoints (login, register)
- **chat.js**: Chat functionality and room management
- **user.js**: User profile management
- **simple_countdown.js**: Countdown timer functionality

### 5. Middleware Layer (`src/middleware/`)
- **auth.js**: JWT authentication middleware
- **rateLimiter.js**: Rate limiting for security
- **validation.js**: Input validation
- **errorHandler.js**: Centralized error handling

## Key Design Patterns

### 1. Model-View-Controller (MVC)
- **Models**: Database entities and business logic
- **Views**: HTML templates and static files
- **Controllers**: Route handlers and business logic

### 2. Service Layer Pattern
- **ConnectionManager**: Manages WebSocket connections
- **WebSocketHandler**: Handles real-time communication
- **MatchingService**: Manages user matching logic

### 3. Middleware Pattern
- **Authentication**: JWT token validation
- **Rate Limiting**: Request throttling
- **Error Handling**: Centralized error management
- **CORS**: Cross-origin request handling

### 4. Event-Driven Architecture
- **WebSocket Events**: Real-time communication
- **Socket.IO**: Event-based messaging
- **Connection Management**: User connection/disconnection events

## Data Flow

### 1. User Authentication Flow
```
User → Frontend → /auth/login → JWT Middleware → User Model → Database
```

### 2. Message Sending Flow
```
User → Frontend → WebSocket → WebSocketHandler → Message Model → Database
                ↓
            Broadcast to Room
```

### 3. Room Management Flow
```
User → Frontend → /chat/rooms → Room Model → Database
                ↓
            WebSocket Update
```

## Security Patterns

### 1. Authentication
- **JWT Tokens**: Stateless authentication
- **Password Hashing**: bcrypt for security
- **Token Expiration**: Time-based token validity

### 2. Authorization
- **Middleware**: Route-level access control
- **User Context**: Request-scoped user data
- **Permission Checks**: Feature-level access control

### 3. Input Validation
- **Request Validation**: Input sanitization
- **Rate Limiting**: Request throttling
- **CORS**: Cross-origin protection

## Error Handling Patterns

### 1. Centralized Error Handling
- **Error Middleware**: Global error handler
- **Error Types**: Categorized error responses
- **Logging**: Structured error logging

### 2. WebSocket Error Handling
- **Connection Errors**: Connection failure handling
- **Message Errors**: Message processing errors
- **Reconnection**: Automatic reconnection logic

## Performance Patterns

### 1. Connection Management
- **Connection Pooling**: Efficient connection reuse
- **Connection Cleanup**: Automatic cleanup of dead connections
- **Connection Recovery**: Reconnection handling

### 2. Database Optimization
- **Indexing**: Database query optimization
- **Connection Pooling**: Database connection management
- **Query Optimization**: Efficient database queries

### 3. Caching
- **In-Memory Caching**: User session caching
- **Connection Caching**: WebSocket connection caching
- **Room State Caching**: Room state management
