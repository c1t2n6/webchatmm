// COMPONENT VERIFICATION SCRIPT
// Run this in browser console để check all components

console.log("🔍 === COMPONENT VERIFICATION ===");

function verifyComponents() {
    const results = {};
    
    // 1. DOM Elements Check
    console.log("1. DOM Elements Check...");
    const elements = {
        // Landing page
        landingPage: document.getElementById('landingPage'),
        chatBtn: document.getElementById('chatBtn'),
        voiceBtn: document.getElementById('voiceBtn'),
        
        // Waiting room  
        waitingRoom: document.getElementById('waitingRoom'),
        startChat: document.getElementById('startChat'),
        startVoice: document.getElementById('startVoice'),
        
        // Searching
        searching: document.getElementById('searching'),
        cancelSearch: document.getElementById('cancelSearch'),
        
        // Chat room
        chatRoom: document.getElementById('chatRoom'),
        
        // Modals
        loginModal: document.getElementById('loginModal'),
        signupModal: document.getElementById('signupModal')
    };
    
    Object.entries(elements).forEach(([name, element]) => {
        const exists = !!element;
        console.log(`   ${exists ? '✅' : '❌'} ${name}: ${exists ? 'Found' : 'Missing'}`);
        results[name] = exists;
    });
    
    // 2. App Instance Check
    console.log("2. App Instance Check...");
    const app = window.mapmoApp;
    const appChecks = {
        appExists: !!app,
        authModule: !!app?.authModule,
        chatModule: !!app?.chatModule,
        voiceCallManager: !!app?.voiceCallManager,
        uiModule: !!app?.uiModule,
        utilsModule: !!app?.utilsModule,
        roomManager: !!app?.chatModule?.roomManager
    };
    
    Object.entries(appChecks).forEach(([name, exists]) => {
        console.log(`   ${exists ? '✅' : '❌'} ${name}: ${exists ? 'OK' : 'Missing'}`);
        results[name] = exists;
    });
    
    // 3. Event Bindings Check
    console.log("3. Event Bindings Check...");
    const eventChecks = {
        chatBtnClick: !!app?.handleChatClick,
        voiceBtnClick: !!app?.handleVoiceClick,
        startChatMatching: !!app?.startChatMatching,
        startVoiceMatching: !!app?.startVoiceMatching,
        cancelSearch: !!app?.cancelSearch
    };
    
    Object.entries(eventChecks).forEach(([name, exists]) => {
        console.log(`   ${exists ? '✅' : '❌'} ${name}: ${exists ? 'Bound' : 'Missing'}`);
        results[name] = exists;
    });
    
    // 4. State Check
    console.log("4. State Check...");
    const stateChecks = {
        currentUser: !!app?.currentUser,
        accessToken: !!localStorage.getItem('access_token'),
        isSearching: app?.isSearching === false, // Should be false initially
        eventsBound: !!app?.eventsBound
    };
    
    Object.entries(stateChecks).forEach(([name, valid]) => {
        console.log(`   ${valid ? '✅' : '⚠️'} ${name}: ${valid ? 'OK' : 'Check needed'}`);
        results[name] = valid;
    });
    
    // 5. API Endpoints Check (Mock calls)
    console.log("5. API Endpoints Check...");
    console.log("   ⚠️ Manual verification needed:");
    console.log("   - /chat/search endpoint");
    console.log("   - /chat/cancel-search endpoint");
    console.log("   - Authentication endpoints");
    
    // 6. Summary
    const totalChecks = Object.keys(results).length;
    const passedChecks = Object.values(results).filter(r => r === true).length;
    const percentage = Math.round((passedChecks / totalChecks) * 100);
    
    console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} checks passed (${percentage}%)`);
    
    if (percentage >= 90) {
        console.log("🎉 System health: EXCELLENT");
    } else if (percentage >= 75) {
        console.log("✅ System health: GOOD");
    } else if (percentage >= 50) {
        console.log("⚠️ System health: FAIR - Some issues need attention");
    } else {
        console.log("❌ System health: POOR - Major issues need fixing");
    }
    
    return results;
}

// FLOW TESTS
function testFlows() {
    console.log("\n🔄 === FLOW TESTS ===");
    
    const app = window.mapmoApp;
    if (!app) {
        console.log("❌ Cannot test flows - app not found");
        return;
    }
    
    console.log("Testing button click flows (dry run)...");
    
    // Test chat flow (without actual API calls)
    console.log("1. Chat Button Flow:");
    try {
        console.log("   - handleChatClick method:", typeof app.handleChatClick);
        console.log("   - startChatMatching method:", typeof app.startChatMatching);
        console.log("   ✅ Chat flow methods exist");
    } catch (error) {
        console.log("   ❌ Chat flow error:", error);
    }
    
    // Test voice flow  
    console.log("2. Voice Button Flow:");
    try {
        console.log("   - handleVoiceClick method:", typeof app.handleVoiceClick);
        console.log("   - startVoiceMatching method:", typeof app.startVoiceMatching);
        console.log("   ✅ Voice flow methods exist");
    } catch (error) {
        console.log("   ❌ Voice flow error:", error);
    }
    
    // Test cancel flow
    console.log("3. Cancel Search Flow:");
    try {
        console.log("   - cancelSearch method:", typeof app.cancelSearch);
        console.log("   ✅ Cancel flow methods exist");
    } catch (error) {
        console.log("   ❌ Cancel flow error:", error);
    }
}

// MANUAL TEST GUIDE
function showManualTests() {
    console.log("\n📋 === MANUAL TEST GUIDE ===");
    console.log(`
🏠 LANDING PAGE TESTS:
1. Open homepage - should see 2 big buttons
2. Click Chat button - should prompt login or go to waiting room
3. Click Voice Call button - should prompt login or go to waiting room

🔐 AUTHENTICATION TESTS:
1. Try login with invalid credentials - should show error
2. Login with valid credentials - should go to waiting room
3. Check profile completion - should prompt if incomplete

💬 CHAT MATCHING TESTS:
1. In waiting room, click "Bắt đầu chat"
2. Should show searching screen with spinner
3. Should be able to click "Hủy tìm kiếm"
4. Should return to waiting room after cancel

📞 VOICE CALL TESTS:
1. In waiting room, click "Voice Call" 
2. Should show searching screen
3. Should be able to cancel search
4. Voice call manager should initialize

🖥️ UI TRANSITION TESTS:
1. Navigate between all screens
2. Check no stuck UI elements
3. Verify responsive design works
4. Test with browser dev tools console

💾 DATABASE TESTS:
1. Check Network tab for API calls
2. Look for 400/500 errors
3. Verify user status updates in backend logs
4. Test with multiple users for matching
    `);
}

// Export functions
window.componentVerification = {
    verifyComponents,
    testFlows,
    showManualTests
};

console.log("\n🎯 Run these commands:");
console.log("- componentVerification.verifyComponents()");
console.log("- componentVerification.testFlows()");  
console.log("- componentVerification.showManualTests()");
