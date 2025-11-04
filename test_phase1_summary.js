// Voice Call Phase 1 - Production Test Suite
// Use this script to verify Phase 1 implementation before proceeding to Phase 2
const Database = require('./src/models/database');
const CallSession = require('./src/models/CallSession');
const UserCallSettings = require('./src/models/UserCallSettings');
const VoiceCallService = require('./src/services/VoiceCallService');

class MockConnectionManager {
  sendToUser(userId, message) {
    return true;
  }
  isUserConnected(userId) {
    return true;
  }
}

async function runComprehensiveTest() {
  console.log('🧪 Voice Call Phase 1 - Comprehensive Test\n');
  
  const results = {
    database: false,
    models: false,
    service: false,
    integration: false
  };

  try {
    // Test 1: Database & Schema
    console.log('=== 1. Database & Schema Test ===');
    const database = new Database();
    await database.connect();
    await database.createTables();
    
    // Check if voice call tables exist
    const tables = ['call_sessions', 'call_participants', 'user_call_settings'];
    for (const table of tables) {
      const result = await database.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
      if (result) {
        console.log(`✅ Table ${table} exists`);
      } else {
        console.log(`❌ Table ${table} missing`);
        throw new Error(`Missing table: ${table}`);
      }
    }
    results.database = true;
    console.log('✅ Database test passed\n');

    // Test 2: Models
    console.log('=== 2. Models Test ===');
    const userCallSettings = new UserCallSettings(database);
    const callSession = new CallSession(database);
    
    // Test UserCallSettings
    await userCallSettings.createDefaultSettings(999);
    const settings = await userCallSettings.getSettings(999);
    console.log(`✅ UserCallSettings model working: ${settings.user_id}`);
    
    // Test CallSession 
    const session = await callSession.create({
      roomId: 999,
      callerId: 999,
      calleeId: 998,
      status: 'test'
    });
    console.log(`✅ CallSession model working: ${session.id}`);
    
    results.models = true;
    console.log('✅ Models test passed\n');

    // Test 3: VoiceCallService
    console.log('=== 3. VoiceCallService Test ===');
    const mockConnectionManager = new MockConnectionManager();
    const voiceCallService = new VoiceCallService(database, mockConnectionManager);
    
    // Test service status
    const status = voiceCallService.getStatus();
    console.log(`✅ VoiceCallService status:`, status);
    
    // Test validation
    const validation = await voiceCallService.validateCallInitiation(999, 998, 999);
    console.log(`✅ Call validation working: ${validation.valid}`);
    
    results.service = true;
    console.log('✅ VoiceCallService test passed\n');

    // Test 4: Integration
    console.log('=== 4. Integration Test ===');
    
    // Create test users
    await database.run(`INSERT OR IGNORE INTO users (id, username, password_hash, email, nickname, dob, gender) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [997, 'testcaller', 'hash', 'caller@test.com', 'TestCaller', '1990-01-01', 'Nam']);
    await database.run(`INSERT OR IGNORE INTO users (id, username, password_hash, email, nickname, dob, gender) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [996, 'testcallee', 'hash', 'callee@test.com', 'TestCallee', '1990-01-01', 'Nữ']);
    
    // Create test room
    await database.run(`INSERT OR IGNORE INTO rooms (id, user1_id, user2_id, type) VALUES (?, ?, ?, ?)`, 
      [998, 997, 996, 'chat']);
    
    // Test full call flow
    const initiateResult = await voiceCallService.initiateCall(997, 996, 998);
    if (initiateResult.success) {
      console.log(`✅ Call initiation successful: ${initiateResult.callId}`);
      
      const acceptResult = await voiceCallService.acceptCall(initiateResult.callId, 996);
      if (acceptResult.success) {
        console.log(`✅ Call acceptance successful`);
        
        const endResult = await voiceCallService.endCall(initiateResult.callId, 997, 'test_complete');
        if (endResult.success) {
          console.log(`✅ Call ending successful: ${endResult.duration}s`);
          results.integration = true;
        }
      }
    }
    
    if (results.integration) {
      console.log('✅ Integration test passed\n');
    } else {
      console.log('❌ Integration test failed\n');
    }

    await database.close();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  // Final Summary
  console.log('=== 🎯 Phase 1 Test Results ===');
  console.log(`Database & Schema: ${results.database ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Models: ${results.models ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`VoiceCallService: ${results.service ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Integration: ${results.integration ? '✅ PASSED' : '❌ FAILED'}`);
  
  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n📊 Overall Score: ${totalPassed}/${totalTests} tests passed`);
  
  if (totalPassed === totalTests) {
    console.log('\n🎉 Phase 1 Implementation: ✅ READY FOR PRODUCTION');
    console.log('\n🚀 Ready to proceed to Phase 2: Frontend WebRTC Implementation');
  } else {
    console.log('\n⚠️  Some components need attention before proceeding to Phase 2');
  }
}

runComprehensiveTest();
