// Manual Voice Call Test Script
// This script tests the backend components of voice call functionality

const fs = require('fs');
const path = require('path');

class VoiceCallBackendTester {
    constructor() {
        this.testResults = [];
        this.serverUrl = 'http://localhost:3000';
    }

    async runAllTests() {
        console.log('🧪 Starting Voice Call Backend Tests...\n');

        await this.testDatabaseSchema();
        await this.testBackendServices();
        await this.testAPIEndpoints();
        await this.testWebSocketHandlers();

        this.printResults();
    }

    async testDatabaseSchema() {
        console.log('📊 Testing Database Schema...');
        
        try {
            // Check if database.js exists and has call_sessions table
            const dbPath = path.join(__dirname, 'src', 'models', 'database.js');
            if (fs.existsSync(dbPath)) {
                const dbContent = fs.readFileSync(dbPath, 'utf8');
                
                if (dbContent.includes('call_sessions')) {
                    this.addTestResult('Database Schema', 'PASS', 'call_sessions table defined');
                } else {
                    this.addTestResult('Database Schema', 'FAIL', 'call_sessions table not found');
                }

                if (dbContent.includes('user_call_settings')) {
                    this.addTestResult('User Settings Table', 'PASS', 'user_call_settings table defined');
                } else {
                    this.addTestResult('User Settings Table', 'FAIL', 'user_call_settings table not found');
                }
            } else {
                this.addTestResult('Database File', 'FAIL', 'database.js not found');
            }

        } catch (error) {
            this.addTestResult('Database Schema', 'ERROR', error.message);
        }
    }

    async testBackendServices() {
        console.log('🔧 Testing Backend Services...');
        
        try {
            // Check VoiceCallService
            const servicePath = path.join(__dirname, 'src', 'services', 'VoiceCallService.js');
            if (fs.existsSync(servicePath)) {
                const serviceContent = fs.readFileSync(servicePath, 'utf8');
                
                const requiredMethods = [
                    'initiateCall',
                    'acceptCall',
                    'rejectCall',
                    'endCall',
                    'handleWebRTCOffer',
                    'handleWebRTCAnswer',
                    'handleICECandidate'
                ];

                let methodsFound = 0;
                requiredMethods.forEach(method => {
                    if (serviceContent.includes(method)) {
                        methodsFound++;
                    }
                });

                if (methodsFound === requiredMethods.length) {
                    this.addTestResult('VoiceCallService Methods', 'PASS', `All ${requiredMethods.length} required methods found`);
                } else {
                    this.addTestResult('VoiceCallService Methods', 'FAIL', `Only ${methodsFound}/${requiredMethods.length} methods found`);
                }

                // Check for enhanced features
                if (serviceContent.includes('handleReconnection')) {
                    this.addTestResult('Reconnection Support', 'PASS', 'Reconnection handling implemented');
                } else {
                    this.addTestResult('Reconnection Support', 'FAIL', 'Reconnection handling missing');
                }

            } else {
                this.addTestResult('VoiceCallService', 'FAIL', 'VoiceCallService.js not found');
            }

            // Check WebSocketHandler
            const wsPath = path.join(__dirname, 'src', 'services', 'WebSocketHandler.js');
            if (fs.existsSync(wsPath)) {
                const wsContent = fs.readFileSync(wsPath, 'utf8');
                
                const requiredEvents = [
                    'voice_call_initiate',
                    'voice_call_accept',
                    'voice_call_reject',
                    'webrtc_offer',
                    'webrtc_answer',
                    'ice_candidate'
                ];

                let eventsFound = 0;
                requiredEvents.forEach(event => {
                    if (wsContent.includes(event)) {
                        eventsFound++;
                    }
                });

                if (eventsFound === requiredEvents.length) {
                    this.addTestResult('WebSocket Events', 'PASS', `All ${requiredEvents.length} required events handled`);
                } else {
                    this.addTestResult('WebSocket Events', 'FAIL', `Only ${eventsFound}/${requiredEvents.length} events handled`);
                }

            } else {
                this.addTestResult('WebSocketHandler', 'FAIL', 'WebSocketHandler.js not found');
            }

        } catch (error) {
            this.addTestResult('Backend Services', 'ERROR', error.message);
        }
    }

    async testAPIEndpoints() {
        console.log('🌐 Testing API Endpoints...');
        
        try {
            // Check voice_call.js routes
            const routesPath = path.join(__dirname, 'src', 'routes', 'voice_call.js');
            if (fs.existsSync(routesPath)) {
                const routesContent = fs.readFileSync(routesPath, 'utf8');
                
                const requiredEndpoints = [
                    'router.get',
                    'router.post',
                    'router.put'
                ];

                let endpointsFound = 0;
                requiredEndpoints.forEach(endpoint => {
                    if (routesContent.includes(endpoint)) {
                        endpointsFound++;
                    }
                });

                // Count actual endpoints
                const endpointCount = (routesContent.match(/router\.(get|post|put|delete)/g) || []).length;

                if (endpointCount >= 8) {
                    this.addTestResult('API Endpoints', 'PASS', `${endpointCount} endpoints found`);
                } else {
                    this.addTestResult('API Endpoints', 'FAIL', `Only ${endpointCount} endpoints found`);
                }

                // Check for error reporting endpoint
                if (routesContent.includes('error-report')) {
                    this.addTestResult('Error Reporting', 'PASS', 'Error reporting endpoint exists');
                } else {
                    this.addTestResult('Error Reporting', 'FAIL', 'Error reporting endpoint missing');
                }

            } else {
                this.addTestResult('Voice Call Routes', 'FAIL', 'voice_call.js not found');
            }

        } catch (error) {
            this.addTestResult('API Endpoints', 'ERROR', error.message);
        }
    }

    async testWebSocketHandlers() {
        console.log('📡 Testing WebSocket Handlers...');
        
        try {
            // Check if WebSocketHandler has voice call events
            const wsPath = path.join(__dirname, 'src', 'services', 'WebSocketHandler.js');
            if (fs.existsSync(wsPath)) {
                const wsContent = fs.readFileSync(wsPath, 'utf8');
                
                // Check for voice call event handling
                if (wsContent.includes('voice_call_initiate') && wsContent.includes('socket.on')) {
                    this.addTestResult('Voice Call Events', 'PASS', 'Voice call events properly handled');
                } else {
                    this.addTestResult('Voice Call Events', 'FAIL', 'Voice call events not properly handled');
                }

                // Check for reconnection support
                if (wsContent.includes('voice_call_reconnect')) {
                    this.addTestResult('Reconnection Events', 'PASS', 'Reconnection events supported');
                } else {
                    this.addTestResult('Reconnection Events', 'FAIL', 'Reconnection events missing');
                }

            } else {
                this.addTestResult('WebSocket Handlers', 'FAIL', 'WebSocketHandler.js not found');
            }

        } catch (error) {
            this.addTestResult('WebSocket Handlers', 'ERROR', error.message);
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
        console.log('\n📋 Backend Test Results Summary:');
        console.log('================================');
        
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
        
        console.log('\n🎯 Backend Status:', 
            (failed === 0 && errors === 0) ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'
        );

        // Print next steps
        console.log('\n📝 Next Steps:');
        console.log('1. Open browser and go to http://localhost:3000');
        console.log('2. Open test_voice_call_browser.html in browser');
        console.log('3. Run frontend tests');
        console.log('4. Test actual voice call between two users');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new VoiceCallBackendTester();
    tester.runAllTests().catch(console.error);
}

module.exports = VoiceCallBackendTester;
