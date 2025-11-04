# Project Brief: Mapmo.vn - Anonymous Web Chat

## Project Overview
Mapmo.vn is an anonymous web chat application that connects strangers for meaningful conversations through two main features: anonymous text chat and anonymous voice calls. Users are matched based on gender preferences, relationship needs, and shared interests, with a unique "like" system that gradually reveals photos and unlocks additional features.

## Core Requirements

### 1. Anonymous Communication
- **Text Chat**: Real-time anonymous messaging without revealing photos initially
- **Voice Calls**: Anonymous voice calls with WebRTC technology
- **Progressive Photo Reveal**: Photos revealed gradually based on mutual interest

### 2. Smart Matching System
- **Gender-based Matching**: Match users based on gender preferences
- **Interest Matching**: Connect users with shared interests and hobbies
- **Need-based Matching**: Match based on relationship goals (casual, serious, marriage, etc.)
- **Fallback Random Matching**: Random pairing when no compatible matches found

### 3. Unique Like System
- **5-minute Timer**: Ask "Do you like this person?" after 5 minutes
- **Mutual Like**: Both users like → photos revealed gradually + unlock voice call
- **One-sided Like**: Continue for 5 more minutes → ask again
- **No Match**: Auto-end conversation after second round

### 4. Progressive Photo Reveal
- **3 Levels**: Blur → Semi-clear → Full photo
- **Mutual Consent**: Photos only revealed when both users like each other
- **Gradual Unlock**: Each mutual like increases reveal level

### 5. User Experience Features
- **Landing Page**: Video background with interactive easter eggs
- **Waiting Room**: Immersive experience with zoom effects and blur
- **Auto-end**: Conversations end after 15 minutes of inactivity
- **Keep Option**: Users can choose to continue conversations permanently

## Technical Stack

### Backend
- **Framework**: Node.js + Express.js
- **Real-time**: Socket.IO for WebSocket communication
- **Database**: SQLite3 with comprehensive user/room/message models
- **Authentication**: JWT-based secure authentication
- **Voice Calls**: WebRTC with STUN servers

### Frontend
- **Technology**: Vanilla JavaScript (ES6+) with modular architecture
- **UI**: HTML5 + CSS3 with responsive design
- **Real-time**: Socket.IO client for instant communication
- **Voice**: WebRTC API for peer-to-peer audio calls

### Security & Performance
- **Password Security**: bcrypt hashing with salt
- **CORS Protection**: Cross-origin request security
- **Rate Limiting**: Request throttling for security
- **Connection Management**: Efficient WebSocket handling

## Key Features

### 1. User Management
- **Registration & Login**: Google Sign-in or username/password
- **Profile Setup**: Comprehensive profile with preferences and interests
- **Status Management**: Idle, Searching, Connected states

### 2. Matching & Discovery
- **Smart Algorithm**: Gender + interests + needs matching
- **Entry Modes**: Chat or Voice Call entry preferences
- **Queue Management**: Efficient user matching queue
- **Compatibility Check**: Multi-factor compatibility validation

### 3. Communication Features
- **Real-time Messaging**: Instant text communication
- **Voice Calls**: High-quality audio calls
- **Typing Indicators**: Real-time typing status
- **Message History**: Persistent conversation storage

### 4. Like & Reveal System
- **Timer-based Questions**: 5-minute intervals for like questions
- **Progressive Reveal**: 3-level photo revelation system
- **Mutual Consent**: Both users must like to unlock features
- **Auto-end Logic**: Automatic conversation termination

### 5. User Experience
- **Immersive Landing**: Video background with interactive elements
- **Smooth Transitions**: Seamless UI transitions between states
- **Responsive Design**: Works on desktop and mobile
- **Accessibility**: Cross-browser compatibility

## Success Criteria

### Functional Requirements
- ✅ Anonymous text chat with real-time messaging
- ✅ Anonymous voice calls with WebRTC
- ✅ Smart matching based on preferences
- ✅ Progressive photo reveal system
- ✅ Like system with 5-minute timers
- ✅ Auto-end after inactivity
- ✅ User authentication and profiles

### Non-functional Requirements
- ✅ Real-time performance (< 100ms message delivery)
- ✅ Secure user data and communication
- ✅ Responsive and intuitive UI
- ✅ Cross-platform compatibility
- ✅ Scalable architecture for growth

### User Experience Goals
- ✅ Smooth and engaging user journey
- ✅ Intuitive interface requiring no learning curve
- ✅ Fast and reliable matching system
- ✅ High-quality voice call experience
- ✅ Meaningful connection facilitation

## Current Status
**Phase**: Production Ready with Core Features Complete
**Deployment**: Live on Render.com
**Next Phase**: User Testing and Feature Refinement

The application successfully implements the core Mapmo.vn concept with anonymous chat, voice calls, smart matching, and the unique like/reveal system. The foundation is solid and ready for user testing and iterative improvements.