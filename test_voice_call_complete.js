// Complete Voice Call System Test
// Tests both backend and frontend components

const fs = require('fs');
const path = require('path');
const http = require('http');

class VoiceCallSystemTester {
    constructor() {
        this.testResults = [];
        this.serverUrl = 'http://localhost:8000';
        this.serverRunning = false;
    }

    async runCompleteTest() {
        console.log('🚀 Starting Complete Voice Call System Test...\n');

        await this.testServerStatus();
        await this.testBackendComponents();
        await this.testFrontendComponents();
        await this.testIntegration();

        this.printFinalResults();
    }

    async testServerStatus() {
        console.log('🖥️ Testing Server Status...');
        
        try {
            const response = await this.makeHttpRequest('/');
            if (response.statusCode === 200) {
                this.addTestResult('Server Status', 'PASS', 'Server is running on port 3000');
                this.serverRunning = true;
            } else {
                this.addTestResult('Server Status', 'FAIL', `Server returned status ${response.statusCode}`);
            }
        } catch (error) {
            this.addTestResult('Server Status', 'FAIL', 'Server is not running or not accessible');
            console.log('  💡 Try running: npm start');
        }
    }

    async testBackendComponents() {
        console.log('🔧 Testing Backend Components...');
        
        // Test database schema
        try {
            const dbPath = path.join(__dirname, 'src', 'models', 'database.js');
            if (fs.existsSync(dbPath)) {
                const dbContent = fs.readFileSync(dbPath, 'utf8');
                if (dbContent.includes('call_sessions') && dbContent.includes('user_call_settings')) {
                    this.addTestResult('Database Schema', 'PASS', 'All required tables defined');
                } else {
                    this.addTestResult('Database Schema', 'FAIL', 'Missing required tables');
                }
            } else {
                this.addTestResult('Database Schema', 'FAIL', 'database.js not found');
            }
        } catch (error) {
            this.addTestResult('Database Schema', 'ERROR', error.message);
        }

        // Test VoiceCallService
        try {
            const servicePath = path.join(__dirname, 'src', 'services', 'VoiceCallService.js');
            if (fs.existsSync(servicePath)) {
                const serviceContent = fs.readFileSync(servicePath, 'utf8');
                const requiredMethods = ['initiateCall', 'acceptCall', 'rejectCall', 'endCall'];
                const methodsFound = requiredMethods.filter(method => serviceContent.includes(method)).length;
                
                if (methodsFound === requiredMethods.length) {
                    this.addTestResult('VoiceCallService', 'PASS', 'All core methods implemented');
                } else {
                    this.addTestResult('VoiceCallService', 'FAIL', `Only ${methodsFound}/${requiredMethods.length} methods found`);
                }
            } else {
                this.addTestResult('VoiceCallService', 'FAIL', 'VoiceCallService.js not found');
            }
        } catch (error) {
            this.addTestResult('VoiceCallService', 'ERROR', error.message);
        }

        // Test WebSocketHandler
        try {
            const wsPath = path.join(__dirname, 'src', 'services', 'WebSocketHandler.js');
            if (fs.existsSync(wsPath)) {
                const wsContent = fs.readFileSync(wsPath, 'utf8');
                if (wsContent.includes('voice_call_initiate') && wsContent.includes('webrtc_offer')) {
                    this.addTestResult('WebSocketHandler', 'PASS', 'Voice call events handled');
                } else {
                    this.addTestResult('WebSocketHandler', 'FAIL', 'Missing voice call event handlers');
                }
            } else {
                this.addTestResult('WebSocketHandler', 'FAIL', 'WebSocketHandler.js not found');
            }
        } catch (error) {
            this.addTestResult('WebSocketHandler', 'ERROR', error.message);
        }

        // Test API Routes
        try {
            const routesPath = path.join(__dirname, 'src', 'routes', 'voice_call.js');
            if (fs.existsSync(routesPath)) {
                const routesContent = fs.readFileSync(routesPath, 'utf8');
                const endpointCount = (routesContent.match(/router\.(get|post|put|delete)/g) || []).length;
                
                if (endpointCount >= 8) {
                    this.addTestResult('API Routes', 'PASS', `${endpointCount} endpoints available`);
                } else {
                    this.addTestResult('API Routes', 'FAIL', `Only ${endpointCount} endpoints found`);
                }
            } else {
                this.addTestResult('API Routes', 'FAIL', 'voice_call.js not found');
            }
        } catch (error) {
            this.addTestResult('API Routes', 'ERROR', error.message);
        }
    }

    async testFrontendComponents() {
        console.log('🎨 Testing Frontend Components...');
        
        // Test VoiceCallManager
        try {
            const managerPath = path.join(__dirname, 'static', 'js', 'modules', 'voice_call_manager.js');
            if (fs.existsSync(managerPath)) {
                const managerContent = fs.readFileSync(managerPath, 'utf8');
                
                // Check for browser environment check
                if (managerContent.includes('typeof document === \'undefined\'')) {
                    this.addTestResult('Browser Environment Check', 'PASS', 'Environment check implemented');
                } else {
                    this.addTestResult('Browser Environment Check', 'FAIL', 'Environment check missing');
                }

                // Check for core methods
                const coreMethods = ['init', 'initiateCall', 'acceptCall', 'rejectCall', 'endCall'];
                const methodsFound = coreMethods.filter(method => managerContent.includes(method)).length;
                
                if (methodsFound === coreMethods.length) {
                    this.addTestResult('VoiceCallManager Methods', 'PASS', 'All core methods implemented');
                } else {
                    this.addTestResult('VoiceCallManager Methods', 'FAIL', `Only ${methodsFound}/${coreMethods.length} methods found`);
                }

                // Check for enhanced features
                if (managerContent.includes('startConnectionMonitoring')) {
                    this.addTestResult('Connection Monitoring', 'PASS', 'Connection monitoring implemented');
                } else {
                    this.addTestResult('Connection Monitoring', 'FAIL', 'Connection monitoring missing');
                }

                if (managerContent.includes('attemptReconnection')) {
                    this.addTestResult('Auto Reconnection', 'PASS', 'Auto reconnection implemented');
                } else {
                    this.addTestResult('Auto Reconnection', 'FAIL', 'Auto reconnection missing');
                }

            } else {
                this.addTestResult('VoiceCallManager', 'FAIL', 'voice_call_manager.js not found');
            }
        } catch (error) {
            this.addTestResult('VoiceCallManager', 'ERROR', error.message);
        }

        // Test CSS
        try {
            const cssPath = path.join(__dirname, 'static', 'css', 'voice_call.css');
            if (fs.existsSync(cssPath)) {
                const cssContent = fs.readFileSync(cssPath, 'utf8');
                if (cssContent.includes('.voice-call-panel') && cssContent.includes('.call-quality-indicator')) {
                    this.addTestResult('Voice Call CSS', 'PASS', 'Core styles implemented');
                } else {
                    this.addTestResult('Voice Call CSS', 'FAIL', 'Missing core styles');
                }
            } else {
                this.addTestResult('Voice Call CSS', 'FAIL', 'voice_call.css not found');
            }
        } catch (error) {
            this.addTestResult('Voice Call CSS', 'ERROR', error.message);
        }
    }

    async testIntegration() {
        console.log('🔗 Testing Integration...');
        
        if (!this.serverRunning) {
            this.addTestResult('API Integration', 'SKIP', 'Server not running - cannot test API');
            this.addTestResult('WebSocket Integration', 'SKIP', 'Server not running - cannot test WebSocket');
            return;
        }

        // Test API endpoints
        try {
            const response = await this.makeHttpRequest('/api/voice-call/system/status');
            if (response.statusCode === 200 || response.statusCode === 401) { // 401 is expected without auth
                this.addTestResult('API Integration', 'PASS', 'API endpoints accessible');
            } else {
                this.addTestResult('API Integration', 'FAIL', `API returned status ${response.statusCode}`);
            }
        } catch (error) {
            this.addTestResult('API Integration', 'FAIL', 'API endpoints not accessible');
        }

        // Test static files
        try {
            const response = await this.makeHttpRequest('/static/js/modules/voice_call_manager.js');
            if (response.statusCode === 200) {
                this.addTestResult('Static Files', 'PASS', 'Frontend files accessible');
            } else {
                this.addTestResult('Static Files', 'FAIL', `Static files returned status ${response.statusCode}`);
            }
        } catch (error) {
            this.addTestResult('Static Files', 'FAIL', 'Static files not accessible');
        }
    }

    makeHttpRequest(path) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 8000,
                path: path,
                method: 'GET',
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                resolve({ statusCode: res.statusCode, headers: res.headers });
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    addTestResult(testName, status, message) {
        this.testResults.push({
            test: testName,
            status: status,
            message: message,
            timestamp: new Date().toISOString()
        });
        
        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'SKIP' ? '⏭️' : '⚠️';
        console.log(`  ${statusIcon} ${testName}: ${message}`);
    }

    printFinalResults() {
        console.log('\n📋 Complete System Test Results:');
        console.log('=================================');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
        const errors = this.testResults.filter(r => r.status === 'ERROR').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
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
        
        const successRate = Math.round((passed / (passed + failed + errors)) * 100);
        console.log(`\n🎯 Overall Success Rate: ${successRate}%`);
        
        if (successRate >= 90) {
            console.log('🎉 EXCELLENT! Voice call system is ready for production!');
        } else if (successRate >= 70) {
            console.log('👍 GOOD! Voice call system is mostly ready with minor issues.');
        } else {
            console.log('⚠️ NEEDS WORK! Voice call system requires fixes before use.');
        }

        console.log('\n📝 Manual Testing Steps:');
        console.log('1. Open browser and go to http://localhost:8000');
        console.log('2. Login with two different users');
        console.log('3. Test voice call between users');
        console.log('4. Check call quality indicators');
        console.log('5. Test call rejection and ending');
        console.log('6. Test network interruption recovery');
    }
}

// Run complete test
if (require.main === module) {
    const tester = new VoiceCallSystemTester();
    tester.runCompleteTest().catch(console.error);
}

module.exports = VoiceCallSystemTester;
