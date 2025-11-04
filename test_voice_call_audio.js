// Test Voice Call Audio Functionality
const fs = require('fs');
const path = require('path');

console.log('🎤 Testing Voice Call Audio Functionality...\n');

// Test 1: Check VoiceCallManager methods
console.log('📋 Test 1: VoiceCallManager Methods');
const voiceCallManagerPath = path.join(__dirname, 'static/js/modules/voice_call_manager.js');
const voiceCallManagerContent = fs.readFileSync(voiceCallManagerPath, 'utf8');

const requiredMethods = [
    'createPeerConnection',
    'createOffer', 
    'createAnswer',
    'handleWebRTCOffer',
    'handleWebRTCAnswer',
    'handleICECandidate',
    'requestMicrophonePermission',
    'setupAudioElements',
    'onCallConnected',
    'onCallDisconnected'
];

let methodsFound = 0;
requiredMethods.forEach(method => {
    if (voiceCallManagerContent.includes(`${method}(`)) {
        console.log(`✅ ${method} - Found`);
        methodsFound++;
    } else {
        console.log(`❌ ${method} - Missing`);
    }
});

console.log(`📊 Methods found: ${methodsFound}/${requiredMethods.length}\n`);

// Test 2: Check WebRTC Configuration
console.log('📋 Test 2: WebRTC Configuration');
const webrtcConfigs = [
    'iceServers',
    'offerToReceiveAudio',
    'voiceActivityDetection',
    'audioContext',
    'getUserMedia',
    'addTrack',
    'setLocalDescription',
    'setRemoteDescription'
];

let configsFound = 0;
webrtcConfigs.forEach(config => {
    if (voiceCallManagerContent.includes(config)) {
        console.log(`✅ ${config} - Found`);
        configsFound++;
    } else {
        console.log(`❌ ${config} - Missing`);
    }
});

console.log(`📊 Configs found: ${configsFound}/${webrtcConfigs.length}\n`);

// Test 3: Check Audio Elements
console.log('📋 Test 3: Audio Elements');
const audioElements = [
    'remoteAudio',
    'localAudio',
    'audioContext',
    'audioProcessor',
    'createAudioElements',
    'setupAudioElements'
];

let audioElementsFound = 0;
audioElements.forEach(element => {
    if (voiceCallManagerContent.includes(element)) {
        console.log(`✅ ${element} - Found`);
        audioElementsFound++;
    } else {
        console.log(`❌ ${element} - Missing`);
    }
});

console.log(`📊 Audio elements found: ${audioElementsFound}/${audioElements.length}\n`);

// Test 4: Check WebSocket Events
console.log('📋 Test 4: WebSocket Events');
const websocketEvents = [
    'webrtc_offer',
    'webrtc_answer', 
    'ice_candidate',
    'voice_call_start_webrtc',
    'voice_call_connected',
    'voice_call_ended'
];

let eventsFound = 0;
websocketEvents.forEach(event => {
    if (voiceCallManagerContent.includes(event)) {
        console.log(`✅ ${event} - Found`);
        eventsFound++;
    } else {
        console.log(`❌ ${event} - Missing`);
    }
});

console.log(`📊 WebSocket events found: ${eventsFound}/${websocketEvents.length}\n`);

// Test 5: Check Backend Voice Call Service
console.log('📋 Test 5: Backend Voice Call Service');
const voiceCallServicePath = path.join(__dirname, 'src/services/VoiceCallService.js');
const voiceCallServiceContent = fs.readFileSync(voiceCallServicePath, 'utf8');

const backendMethods = [
    'initiateCall',
    'acceptCall',
    'rejectCall',
    'endCall',
    'handleWebRTCOffer',
    'handleWebRTCAnswer',
    'handleICECandidate'
];

let backendMethodsFound = 0;
backendMethods.forEach(method => {
    if (voiceCallServiceContent.includes(`${method}(`)) {
        console.log(`✅ ${method} - Found`);
        backendMethodsFound++;
    } else {
        console.log(`❌ ${method} - Missing`);
    }
});

console.log(`📊 Backend methods found: ${backendMethodsFound}/${backendMethods.length}\n`);

// Test 6: Check CSS for Voice Call UI
console.log('📋 Test 6: Voice Call UI CSS');
const voiceCallCSSPath = path.join(__dirname, 'static/css/voice_call.css');
if (fs.existsSync(voiceCallCSSPath)) {
    const cssContent = fs.readFileSync(voiceCallCSSPath, 'utf8');
    const cssClasses = [
        'voice-call-panel',
        'call-controls',
        'mute-btn',
        'hangup-btn',
        'call-status',
        'audio-visualizer'
    ];
    
    let cssClassesFound = 0;
    cssClasses.forEach(cssClass => {
        if (cssContent.includes(cssClass)) {
            console.log(`✅ ${cssClass} - Found`);
            cssClassesFound++;
        } else {
            console.log(`❌ ${cssClass} - Missing`);
        }
    });
    
    console.log(`📊 CSS classes found: ${cssClassesFound}/${cssClasses.length}\n`);
} else {
    console.log('❌ voice_call.css not found\n');
}

// Test 7: Check HTML Template
console.log('📋 Test 7: HTML Template');
const htmlPath = path.join(__dirname, 'templates/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const htmlElements = [
    'voice-call-panel',
    'mute-btn',
    'hangup-btn',
    'call-status',
    'remote-audio'
];

let htmlElementsFound = 0;
htmlElements.forEach(element => {
    if (htmlContent.includes(element)) {
        console.log(`✅ ${element} - Found`);
        htmlElementsFound++;
    } else {
        console.log(`❌ ${element} - Missing`);
    }
});

console.log(`📊 HTML elements found: ${htmlElementsFound}/${htmlElements.length}\n`);

// Overall Score
const totalTests = 7;
const scores = [
    methodsFound / requiredMethods.length,
    configsFound / webrtcConfigs.length,
    audioElementsFound / audioElements.length,
    eventsFound / websocketEvents.length,
    backendMethodsFound / backendMethods.length,
    fs.existsSync(voiceCallCSSPath) ? 1 : 0,
    htmlElementsFound / htmlElements.length
];

const overallScore = scores.reduce((sum, score) => sum + score, 0) / totalTests;
const percentage = Math.round(overallScore * 100);

console.log('🎯 OVERALL VOICE CALL AUDIO TEST RESULTS:');
console.log(`📊 Overall Score: ${percentage}%`);

if (percentage >= 90) {
    console.log('🎉 EXCELLENT: Voice call audio functionality is well implemented!');
} else if (percentage >= 75) {
    console.log('✅ GOOD: Voice call audio functionality is mostly complete');
} else if (percentage >= 60) {
    console.log('⚠️ FAIR: Voice call audio functionality needs some improvements');
} else {
    console.log('❌ POOR: Voice call audio functionality needs significant work');
}

console.log('\n🔍 DETAILED ANALYSIS:');
console.log(`- Frontend Methods: ${Math.round(scores[0] * 100)}%`);
console.log(`- WebRTC Config: ${Math.round(scores[1] * 100)}%`);
console.log(`- Audio Elements: ${Math.round(scores[2] * 100)}%`);
console.log(`- WebSocket Events: ${Math.round(scores[3] * 100)}%`);
console.log(`- Backend Methods: ${Math.round(scores[4] * 100)}%`);
console.log(`- CSS Styling: ${Math.round(scores[5] * 100)}%`);
console.log(`- HTML Template: ${Math.round(scores[6] * 100)}%`);

console.log('\n📝 RECOMMENDATIONS:');
if (scores[0] < 0.9) {
    console.log('- Add missing frontend methods for complete WebRTC functionality');
}
if (scores[1] < 0.9) {
    console.log('- Improve WebRTC configuration for better audio quality');
}
if (scores[2] < 0.9) {
    console.log('- Ensure all audio elements are properly set up');
}
if (scores[3] < 0.9) {
    console.log('- Add missing WebSocket event handlers');
}
if (scores[4] < 0.9) {
    console.log('- Complete backend voice call service methods');
}
if (scores[5] < 1) {
    console.log('- Add voice call CSS styling');
}
if (scores[6] < 0.9) {
    console.log('- Add missing HTML elements for voice call UI');
}

console.log('\n🎤 To test audio transmission:');
console.log('1. Open 2 browser tabs at http://localhost:8000');
console.log('2. Login with 2 different users');
console.log('3. Select "Voice Call" entry mode');
console.log('4. Start matching');
console.log('5. Check browser console for WebRTC logs');
console.log('6. Test microphone permission and audio transmission');
console.log('7. Verify both users can hear each other');
