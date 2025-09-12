// Main server file for WebChat Node.js Application
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('../config');
const Database = require('./models/database');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const ConnectionManager = require('./services/ConnectionManager');
const WebSocketHandler = require('./services/WebSocketHandler');

// Import routes
const { router: authRouter, initUserModel } = require('./routes/auth');
const { router: chatRouter, initModels: initChatModels } = require('./routes/chat');
const { router: userRouter, initUserModel: initUserProfileModel } = require('./routes/user');
const { 
  router: simpleCountdownRouter, 
  initModels: initSimpleCountdownModels,
  handleUserDisconnect,
  handleUserReconnect
} = require('./routes/simple_countdown');

// Import middleware
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8000', 'http://127.0.0.1:8000'],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"]
  },
  // ✅ THÊM: WebSocket configuration để tăng stability
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  allowEIO3: true,
  // ✅ THÊM: Connection options
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Initialize database
const database = new Database();
let userModel, roomModel, messageModel, connectionManager, webSocketHandler, matchingService;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8000', 'http://127.0.0.1:8000'],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general rate limiting
app.use(generalLimiter);

// Serve static files
app.use('/static', express.static(path.join(__dirname, '../static')));

// Serve test files
app.use(express.static(path.join(__dirname, '..')));

// Initialize models and services
const initModels = () => {
  userModel = new User(database);
  roomModel = new Room(database);
  messageModel = new Message(database);
  connectionManager = new ConnectionManager();
  webSocketHandler = new WebSocketHandler(connectionManager, userModel, roomModel, messageModel);
  initUserModel(database);
  initChatModels(database, connectionManager);
  initUserProfileModel(database);
  initSimpleCountdownModels(database, connectionManager);
  
  // Get matching service from chat routes after initialization
  const { getMatchingService } = require('./routes/chat');
  matchingService = getMatchingService();
};

// Root endpoint (must be before other routes)
app.get('/', (req, res) => {
  try {
    const indexPath = path.join(__dirname, '../templates/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({
        message: 'WebChat Node.js API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/auth',
          chat: '/chat',
          user: '/user'
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      service: 'WebChat Node.js API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: database.getStats(),
      matching: matchingService ? matchingService.getStats() : null
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/auth', authRouter);
app.use('/chat', chatRouter);
app.use('/user', userRouter);
app.use('/simple-countdown', simpleCountdownRouter);

// Error handling middleware (must be last)
app.use(errorHandler.notFoundHandler);
app.use(errorHandler.handleError.bind(errorHandler));

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 New WebSocket connection:', socket.id);
  console.log('🔌 Auth data:', socket.handshake.auth);

  // ✅ THÊM: Connection error handling
  socket.on('error', (error) => {
    console.error('🔌 WebSocket error:', error);
  });

  // ✅ THÊM: Connection timeout handling
  socket.on('connect_timeout', () => {
    console.log('🔌 WebSocket connection timeout:', socket.id);
  });

  // Handle chat room joining
  socket.on('join-room', async (data) => {
    try {
      const { roomId } = data;
      console.log(`👤 User joining room ${roomId}`);
      
      if (webSocketHandler) {
        await webSocketHandler.handleChatConnection(socket, roomId);
        
        // ✅ THÊM: Xử lý reconnect cho countdown/notification states
        if (socket.userId) {
          handleUserReconnect(socket.userId);
        }
      } else {
        socket.emit('error', { message: 'WebSocket handler not initialized' });
        socket.disconnect();
      }
    } catch (error) {
      console.error('❌ Error handling join-room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle status WebSocket
  socket.on('join-status', async () => {
    try {
      console.log(`👤 User joining status WebSocket`);
      
      if (webSocketHandler) {
        await webSocketHandler.handleStatusConnection(socket);
      } else {
        socket.emit('error', { message: 'WebSocket handler not initialized' });
        socket.disconnect();
      }
    } catch (error) {
      console.error('❌ Error handling join-status:', error);
      socket.emit('error', { message: 'Failed to join status WebSocket' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log('🔌 WebSocket disconnected:', socket.id, 'Reason:', reason);
    
    // ✅ THÊM: Xử lý disconnect cho countdown/notification states
    if (socket.userId) {
      handleUserDisconnect(socket.userId);
    }
  });
});

// ✅ REMOVED: Duplicate error handlers - using centralized errorHandler instead

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    await database.createTables();
    
    // Initialize models
    initModels();
    
    // Start server
    const PORT = config.port;
    server.listen(PORT, () => {
      console.log(`🚀 WebChat Node.js API running on port ${PORT}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🗄️  Database: Connected`);
      console.log(`🔌 WebSocket: Ready`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully`);
  
  try {
    // Shutdown matching service
    if (matchingService) {
      await matchingService.shutdown();
    }
    
    // Close database
    await database.close();
    
    // Close server
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.log('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();

module.exports = { app, server, io };
