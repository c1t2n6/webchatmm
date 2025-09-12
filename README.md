# WebChat Node.js Application

A real-time chat application built with Node.js, Express, Socket.io, and SQLite.

## Features

- 🔐 **Authentication** - JWT-based auth with bcrypt password hashing
- 💬 **Real-time Chat** - WebSocket-based messaging with Socket.io
- 🏠 **Room Management** - Dynamic chat room creation and management
- 👥 **User Management** - User profiles, status tracking, and online presence
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🚀 **Render.com Ready** - Optimized for cloud deployment

## Tech Stack

- **Backend**: Node.js, Express.js
- **WebSocket**: Socket.io
- **Database**: SQLite3
- **Authentication**: JWT, bcrypt
- **Deployment**: Render.com

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd webchat-nodejs
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:8000`

### Production

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Chat
- `POST /chat/search` - Search for chat partner
- `POST /chat/cancel-search` - Cancel search
- `GET /chat/current-room` - Get current room info
- `GET /chat/room/:roomId/messages` - Get room messages
- `POST /chat/end/:roomId` - End chat session
- `GET /chat/check-room-status` - Check room status

### Health
- `GET /health` - Health check

## WebSocket Events

### Client to Server
- `join-room` - Join a chat room
- `join-status` - Join status WebSocket
- `message` - Send chat message
- `typing` - Send typing indicator
- `like_response` - Send like response
- `heartbeat` - Keep connection alive

### Server to Client
- `message` - Receive chat message
- `typing` - Receive typing indicator
- `like_response` - Receive like response
- `room_ended` - Room ended notification
- `error` - Error message
- `heartbeat` - Heartbeat response

## Environment Variables

```env
# Server
PORT=8000
NODE_ENV=development

# Database
DATABASE_URL=sqlite:///./app.db

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Security
SECRET_KEY=your-secret-key
BCRYPT_ROUNDS=12

# Features
ENABLE_VOICE=false
ENABLE_CAPTCHA=false
ENABLE_DARK_MODE=true

# Rate Limiting
RATE_LIMIT_SEARCH=5
RATE_LIMIT_UPLOAD=10
RATE_LIMIT_LOGIN=3

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# Logging
LOG_LEVEL=INFO
LOG_FILE=./logs/app.log
```

## Deployment

### Render.com

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Use the following settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node.js 18.x

The `render.yaml` file is included for easy deployment.

### Other Platforms

The application can be deployed to any Node.js hosting platform:
- Heroku
- Railway
- DigitalOcean App Platform
- AWS Elastic Beanstalk

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `password_hash` - Hashed password
- `email` - User email
- `nickname` - Display name
- `dob` - Date of birth
- `gender` - User gender
- `preferred_gender` - Preferred chat partner gender
- `needs` - User needs (JSON)
- `interests` - User interests (JSON)
- `profile_completed` - Profile completion status
- `status` - Current status (idle, searching, connected)
- `online_status` - Online presence
- `current_room_id` - Current active room
- `avatar_url` - Profile picture URL
- `role` - User role (free, premium, admin)
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

### Rooms Table
- `id` - Primary key
- `type` - Room type (chat, voice)
- `user1_id` - First user ID
- `user2_id` - Second user ID
- `start_time` - Room start timestamp
- `end_time` - Room end timestamp
- `like_responses` - Like responses (JSON)
- `keep_active_responses` - Keep active responses (JSON)
- `reveal_level` - Profile reveal level
- `keep_active` - Keep active status
- `last_message_time` - Last message timestamp
- `created_at` - Room creation timestamp

### Messages Table
- `id` - Primary key
- `room_id` - Room ID
- `user_id` - User ID
- `content` - Message content
- `timestamp` - Message timestamp

## Development

### Project Structure

```
webchat-nodejs/
├── src/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   └── server.js        # Main server file
├── config.js            # Configuration
├── package.json         # Dependencies
├── render.yaml          # Render.com config
└── README.md           # This file
```

### Adding New Features

1. Create new models in `src/models/`
2. Add routes in `src/routes/`
3. Implement business logic in `src/services/`
4. Update WebSocket handlers if needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support, please open an issue on GitHub or contact the development team.
