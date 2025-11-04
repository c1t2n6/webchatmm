// Test script for basic voice call functionality
const { VoiceCallManager } = require('./static/js/modules/voice_call_manager.js');

class VoiceCallTester {
    constructor() {
        this.testResults = [];
        this.mockApp = {
            token: 'test-token',
            currentRoom: { id: 1 },
            utilsModule: {
                showError: (msg) => console.log('Error:', msg),
                showWarning: (msg) => console.log('Warning:', msg)
            }
        };
        this.mockWebSocketManager = {
            isConnected: () => true,
            websocket: {
                on: () => {},
                emit: () => {}
            },
            send: () => {}
        };
    }

    async runAllTests() {
        console.log('🧪 Starting Voice Call Basic Functionality Tests...\n');

        await this.testInitialization();
        await this.testStateManagement();
        await this.testWebRTCConfiguration();
        await this.testErrorHandling();
        await this.testConnectionMonitoring();

        this.printResults();
    }

    async testInitialization() {
        console.log('📞 Testing VoiceCallManager Initialization...');
        
        try {
            const voiceCallManager = new VoiceCallManager(this.mockApp, this.mockWebSocketManager);
            
            // Check if initialized properly
            if (voiceCallManager.isInitialized) {
                this.addTestResult('Initialization', 'PASS', 'VoiceCallManager initialized successfully');
            } else {
                this.addTestResult('Initialization', 'FAIL', 'VoiceCallManager not initialized');
            }

            // Check call states
            if (voiceCallManager.CALL_STATES && voiceCallManager.CALL_STATES.IDLE) {
                this.addTestResult('Call States', 'PASS', 'Call states defined correctly');
            } else {
                this.addTestResult('Call States', 'FAIL', 'Call states not defined');
            }

        } catch (error) {
            this.addTestResult('Initialization', 'ERROR', error.message);
        }
    }

    async testStateManagement() {
        console.log('🔄 Testing State Management...');
        
        try {
            const voiceCallManager = new VoiceCallManager(this.mockApp, this.mockWebSocketManager);
            
            // Test initial state
            if (voiceCallManager.callState === voiceCallManager.CALL_STATES.IDLE) {
                this.addTestResult('Initial State', 'PASS', 'Initial state is IDLE');
            } else {
                this.addTestResult('Initial State', 'FAIL', `Expected IDLE, got ${voiceCallManager.callState}`);
            }

            // Test state synchronization method exists
            if (typeof voiceCallManager.syncStateWithBackend === 'function') {
                this.addTestResult('State Sync Method', 'PASS', 'syncStateWithBackend method exists');
            } else {
                this.addTestResult('State Sync Method', 'FAIL', 'syncStateWithBackend method missing');
            }

        } catch (error) {
            this.addTestResult('State Management', 'ERROR', error.message);
        }
    }

    async testWebRTCConfiguration() {
        console.log('📡 Testing WebRTC Configuration...');
        
        try {
            const voiceCallManager = new VoiceCallManager(this.mockApp, this.mockWebSocketManager);
            
            // Check RTC configuration
            if (voiceCallManager.rtcConfiguration && voiceCallManager.rtcConfiguration.iceServers) {
                this.addTestResult('RTC Config', 'PASS', 'RTC configuration exists with ICE servers');
            } else {
                this.addTestResult('RTC Config', 'FAIL', 'RTC configuration missing or invalid');
            }

            // Check audio processing settings
            if (voiceCallManager.noiseSuppression !== undefined) {
                this.addTestResult('Audio Processing', 'PASS', 'Audio processing settings configured');
            } else {
                this.addTestResult('Audio Processing', 'FAIL', 'Audio processing settings missing');
            }

        } catch (error) {
            this.addTestResult('WebRTC Configuration', 'ERROR', error.message);
        }
    }

    async testErrorHandling() {
        console.log('❌ Testing Error Handling...');
        
        try {
            const voiceCallManager = new VoiceCallManager(this.mockApp, this.mockWebSocketManager);
            
            // Check error handling methods
            if (typeof voiceCallManager.handleCallError === 'function') {
                this.addTestResult('Error Handler', 'PASS', 'handleCallError method exists');
            } else {
                this.addTestResult('Error Handler', 'FAIL', 'handleCallError method missing');
            }

            // Check error mapping
            if (typeof voiceCallManager.mapErrorToUserMessage === 'function') {
                this.addTestResult('Error Mapping', 'PASS', 'mapErrorToUserMessage method exists');
            } else {
                this.addTestResult('Error Mapping', 'FAIL', 'mapErrorToUserMessage method missing');
            }

            // Test error mapping
            const testError = new Error('NotAllowedError');
            testError.name = 'NotAllowedError';
            const mappedMessage = voiceCallManager.mapErrorToUserMessage(testError);
            
            if (mappedMessage && mappedMessage.includes('microphone')) {
                this.addTestResult('Error Mapping Logic', 'PASS', 'Error mapping works correctly');
            } else {
                this.addTestResult('Error Mapping Logic', 'FAIL', 'Error mapping not working');
            }

        } catch (error) {
            this.addTestResult('Error Handling', 'ERROR', error.message);
        }
    }

    async testConnectionMonitoring() {
        console.log('📊 Testing Connection Monitoring...');
        
        try {
            const voiceCallManager = new VoiceCallManager(this.mockApp, this.mockWebSocketManager);
            
            // Check monitoring methods
            if (typeof voiceCallManager.startConnectionMonitoring === 'function') {
                this.addTestResult('Start Monitoring', 'PASS', 'startConnectionMonitoring method exists');
            } else {
                this.addTestResult('Start Monitoring', 'FAIL', 'startConnectionMonitoring method missing');
            }

            if (typeof voiceCallManager.stopConnectionMonitoring === 'function') {
                this.addTestResult('Stop Monitoring', 'PASS', 'stopConnectionMonitoring method exists');
            } else {
                this.addTestResult('Stop Monitoring', 'FAIL', 'stopConnectionMonitoring method missing');
            }

            // Check connection stats
            if (voiceCallManager.connectionStats && voiceCallManager.connectionStats.quality) {
                this.addTestResult('Connection Stats', 'PASS', 'Connection stats object exists');
            } else {
                this.addTestResult('Connection Stats', 'FAIL', 'Connection stats object missing');
            }

        } catch (error) {
            this.addTestResult('Connection Monitoring', 'ERROR', error.message);
        }
    }

    addTestResult(testName, status, message) {
        this.testResults.push({
            test: testName,
            status: status,
            message: message,
            timestamp: new Date().toISOString()
        });
        
        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`  ${statusIcon} ${testName}: ${message}`);
    }

    printResults() {
        console.log('\n📋 Test Results Summary:');
        console.log('========================');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const errors = this.testResults.filter(r => r.status === 'ERROR').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⚠️ Errors: ${errors}`);
        console.log(`📊 Total: ${this.testResults.length}`);
        
        if (failed > 0 || errors > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL' || r.status === 'ERROR')
                .forEach(r => {
                    console.log(`  - ${r.test}: ${r.message}`);
                });
        }
        
        console.log('\n🎯 Overall Status:', 
            (failed === 0 && errors === 0) ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'
        );
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new VoiceCallTester();
    tester.runAllTests().catch(console.error);
}

module.exports = VoiceCallTester;
