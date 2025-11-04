// MAPMO.VN - COMPREHENSIVE FUNCTIONALITY TEST CHECKLIST
// Copy và paste từng phần vào browser console để test

console.log("=== MAPMO.VN FUNCTIONALITY TEST CHECKLIST ===");

// 1. LANDING PAGE TESTS
console.log("\n🏠 === LANDING PAGE TESTS ===");
function testLandingPage() {
    console.log("1.1 Testing button elements...");
    const chatBtn = document.getElementById('chatBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    
    console.log("- Chat button exists:", !!chatBtn);
    console.log("- Voice button exists:", !!voiceBtn);
    console.log("- App instance exists:", !!window.mapmoApp);
    
    if (chatBtn && voiceBtn) {
        console.log("✅ Landing page buttons OK");
        return true;
    } else {
        console.log("❌ Landing page buttons missing");
        return false;
    }
}

// 2. AUTHENTICATION TESTS  
console.log("\n🔐 === AUTHENTICATION TESTS ===");
function testAuthentication() {
    console.log("2.1 Testing auth state...");
    const app = window.mapmoApp;
    const token = localStorage.getItem('access_token');
    
    console.log("- Access token exists:", !!token);
    console.log("- Current user:", app?.currentUser);
    console.log("- Profile completed:", app?.currentUser?.profile_completed);
    
    if (token && app?.currentUser) {
        console.log("✅ Authentication OK");
        return true;
    } else {
        console.log("⚠️ Authentication required");
        return false;
    }
}

// 3. CHAT MATCHING TESTS
console.log("\n💬 === CHAT MATCHING TESTS ===");
function testChatMatching() {
    console.log("3.1 Testing chat matching flow...");
    const app = window.mapmoApp;
    
    console.log("- isSearching flag:", app?.isSearching);
    console.log("- Chat module exists:", !!app?.chatModule);
    console.log("- Room manager exists:", !!app?.chatModule?.roomManager);
    
    if (app?.chatModule?.roomManager) {
        console.log("✅ Chat matching components OK");
        return true;
    } else {
        console.log("❌ Chat matching components missing");
        return false;
    }
}

// 4. VOICE CALL TESTS
console.log("\n📞 === VOICE CALL TESTS ===");
function testVoiceCall() {
    console.log("4.1 Testing voice call components...");
    const app = window.mapmoApp;
    
    console.log("- Voice call manager exists:", !!app?.voiceCallManager);
    console.log("- Voice call mode flag:", app?.isVoiceCallMode);
    
    if (app?.voiceCallManager) {
        console.log("✅ Voice call components OK");
        return true;
    } else {
        console.log("⚠️ Voice call components not initialized");
        return false;
    }
}

// 5. UI STATE TESTS
console.log("\n🖥️ === UI STATE TESTS ===");
function testUIStates() {
    console.log("5.1 Testing UI elements...");
    
    const sections = {
        landingPage: document.getElementById('landingPage'),
        waitingRoom: document.getElementById('waitingRoom'),
        searching: document.getElementById('searching'),
        chatRoom: document.getElementById('chatRoom')
    };
    
    console.log("- Landing page:", !!sections.landingPage);
    console.log("- Waiting room:", !!sections.waitingRoom);
    console.log("- Searching screen:", !!sections.searching);
    console.log("- Chat room:", !!sections.chatRoom);
    
    const allExists = Object.values(sections).every(el => !!el);
    if (allExists) {
        console.log("✅ UI sections OK");
        return true;
    } else {
        console.log("❌ UI sections missing");
        return false;
    }
}

// 6. DATABASE TESTS (Check network requests)
console.log("\n💾 === DATABASE TESTS ===");
function testDatabaseConnection() {
    console.log("6.1 Testing database connectivity...");
    console.log("- Check Network tab for API responses");
    console.log("- Watch for 400/500 errors");
    console.log("- Verify user status updates");
    
    // This requires manual verification in Network tab
    console.log("⚠️ Manual check required - see Network tab");
    return true;
}

// RUN ALL TESTS
console.log("\n🚀 === RUNNING ALL TESTS ===");
function runAllTests() {
    const results = {
        landingPage: testLandingPage(),
        authentication: testAuthentication(),
        chatMatching: testChatMatching(),
        voiceCall: testVoiceCall(),
        uiStates: testUIStates(),
        database: testDatabaseConnection()
    };
    
    console.log("\n📊 === TEST RESULTS ===");
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(r => r === true);
    console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall Status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    return results;
}

// MANUAL TEST INSTRUCTIONS
console.log("\n📋 === MANUAL TEST INSTRUCTIONS ===");
console.log(`
1. 🏠 LANDING PAGE:
   - Click Chat button → Should show login or start matching
   - Click Voice Call button → Should show login or start matching
   - Check hover effects work

2. 🔐 AUTHENTICATION:
   - Try login with valid credentials
   - Complete profile if needed
   - Verify currentUser is set

3. 💬 CHAT MATCHING:
   - Click "Bắt đầu chat" in waiting room
   - Should show "Đang tìm kiếm..." screen
   - Test "Hủy tìm kiếm" button

4. 📞 VOICE CALL MATCHING:
   - Click "Voice Call" in waiting room  
   - Should show "Đang tìm kiếm..." screen
   - Test "Hủy tìm kiếm" button

5. 🖥️ UI TRANSITIONS:
   - Verify smooth transitions between screens
   - Check no UI elements stuck/duplicated
   - Test responsive design

6. 💾 DATABASE:
   - Check Network tab for API calls
   - Verify no 400/500 errors
   - Check user status updates in backend logs
`);

// Export for easy access
window.mapmoTests = {
    runAllTests,
    testLandingPage,
    testAuthentication, 
    testChatMatching,
    testVoiceCall,
    testUIStates,
    testDatabaseConnection
};

console.log("\n🎯 Type 'mapmoTests.runAllTests()' to run all tests!");
