# 🧪 Voice Call Basic Functionality Test Checklist

## 📋 **Pre-Test Setup**
- [ ] Server is running (`npm start`)
- [ ] Database is initialized with call_sessions table
- [ ] WebSocket connection is established
- [ ] User is logged in and has valid JWT token
- [ ] Two users are available for testing (different browsers/tabs)

## 🔧 **Phase 1: Critical Fixes Testing**

### **1. VoiceCallManager Initialization**
- [ ] VoiceCallManager initializes without errors
- [ ] WebSocket connection is established before initialization
- [ ] All required properties are set (callState, connectionStats, etc.)
- [ ] Error handling works for initialization failures
- [ ] Retry mechanism works for failed initialization

### **2. State Synchronization**
- [ ] `syncStateWithBackend()` method exists and works
- [ ] `/voice-call/active` endpoint returns correct data
- [ ] Frontend state syncs with backend state
- [ ] Call state updates correctly (IDLE → CALLING → RINGING → ACTIVE)
- [ ] State persists across page refreshes

### **3. WebRTC Signaling**
- [ ] `initiateCall()` method works correctly
- [ ] WebRTC offer/answer exchange works
- [ ] ICE candidate exchange works
- [ ] Retry mechanism works for failed signaling
- [ ] Connection establishment is successful

### **4. Error Handling**
- [ ] User-friendly error messages are shown
- [ ] Technical errors are mapped to user messages
- [ ] Error reporting to backend works
- [ ] Graceful fallbacks for failed operations
- [ ] No unhandled promise rejections

## 🚀 **Phase 2: Enhanced Features Testing**

### **5. Connection Quality Monitoring**
- [ ] Connection monitoring starts when call is active
- [ ] Quality metrics are collected (packet loss, latency, jitter)
- [ ] Quality indicator shows correct status
- [ ] Quality warnings are shown when needed
- [ ] Monitoring stops when call ends

### **6. Automatic Reconnection**
- [ ] Reconnection attempts when connection is lost
- [ ] Maximum retry attempts are respected
- [ ] Reconnection UI feedback is shown
- [ ] Peer connection is recreated successfully
- [ ] Call continues after successful reconnection

### **7. Audio Processing**
- [ ] Microphone access is requested correctly
- [ ] Audio constraints are applied
- [ ] Audio level monitoring works
- [ ] Audio visualizer shows real-time data
- [ ] Audio enhancements are applied

## 🎯 **Integration Testing**

### **8. End-to-End Call Flow**
- [ ] User A initiates call to User B
- [ ] User B receives incoming call notification
- [ ] User B accepts call
- [ ] WebRTC connection is established
- [ ] Audio streams are exchanged
- [ ] Call quality monitoring starts
- [ ] Call can be ended by either party
- [ ] Call state is cleaned up properly

### **9. Error Scenarios**
- [ ] Call initiation fails (user busy, no room, etc.)
- [ ] Call is rejected by callee
- [ ] Network connection is lost during call
- [ ] Microphone permission is denied
- [ ] WebRTC connection fails
- [ ] Server errors are handled gracefully

### **10. UI/UX Testing**
- [ ] Call panel shows correct information
- [ ] Incoming call modal appears correctly
- [ ] Call controls work (mute, speaker, hangup)
- [ ] Quality indicator shows correct status
- [ ] Recording indicator works (if implemented)
- [ ] Responsive design works on mobile

## 🔍 **Manual Testing Steps**

### **Test 1: Basic Call Flow**
1. Open two browser tabs/windows
2. Login as different users in each tab
3. User A clicks "Voice Call" button
4. Verify User B receives incoming call
5. User B accepts call
6. Verify audio connection is established
7. Test mute/unmute functionality
8. End call and verify cleanup

### **Test 2: Call Rejection**
1. User A initiates call
2. User B rejects call
3. Verify User A receives rejection notification
4. Verify call state is cleaned up

### **Test 3: Network Issues**
1. Start a call between two users
2. Disconnect network on one side
3. Verify reconnection attempts
4. Reconnect network
5. Verify call continues

### **Test 4: Error Handling**
1. Try to call without microphone permission
2. Try to call when already in a call
3. Try to call non-existent user
4. Verify appropriate error messages

## 📊 **Performance Testing**

### **11. Resource Usage**
- [ ] Memory usage is reasonable during calls
- [ ] CPU usage is not excessive
- [ ] Network bandwidth usage is appropriate
- [ ] No memory leaks after call ends

### **12. Concurrent Calls**
- [ ] Multiple users can make calls simultaneously
- [ ] Server handles multiple concurrent calls
- [ ] Database operations don't conflict
- [ ] WebSocket connections are managed properly

## ✅ **Success Criteria**

All tests must pass for the voice call system to be considered working:

- **Critical Fixes**: 100% pass rate
- **Enhanced Features**: 90% pass rate
- **Integration Tests**: 100% pass rate
- **Error Scenarios**: All handled gracefully
- **Performance**: Within acceptable limits

## 🐛 **Known Issues to Watch For**

1. **Race Conditions**: WebSocket not ready when VoiceCallManager initializes
2. **State Sync**: Frontend/backend state mismatch
3. **WebRTC Issues**: ICE candidate exchange failures
4. **Memory Leaks**: Audio contexts not cleaned up
5. **UI Updates**: Call status not updating in real-time

## 📝 **Test Results Template**

```
Test Date: ___________
Tester: ___________
Browser: ___________
Server Version: ___________

Critical Fixes:
- Initialization: [PASS/FAIL]
- State Sync: [PASS/FAIL]
- WebRTC Signaling: [PASS/FAIL]
- Error Handling: [PASS/FAIL]

Enhanced Features:
- Connection Monitoring: [PASS/FAIL]
- Auto Reconnection: [PASS/FAIL]
- Audio Processing: [PASS/FAIL]

Integration:
- End-to-End Flow: [PASS/FAIL]
- Error Scenarios: [PASS/FAIL]
- UI/UX: [PASS/FAIL]

Overall Status: [READY/NOT READY]
Notes: ___________
```
