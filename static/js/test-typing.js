// Test typing indicator functionality
class TypingIndicatorTest {
    constructor() {
        this.testResults = [];
    }
    
    // Test typing indicator display
    testTypingDisplay() {
        console.log('🧪 Testing typing indicator display...');
        
        // Create test typing indicator
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            this.testResults.push('❌ Chat messages container not found');
            return false;
        }
        
        // Create typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'flex justify-start typing-indicator';
        typingDiv.innerHTML = `
            <div class="px-4 py-2 typing-bubble rounded-lg">
                <p class="text-sm">Đang nhập<span class="typing-dots"></span></p>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        
        // Check if it's visible
        const isVisible = typingDiv.offsetHeight > 0;
        this.testResults.push(isVisible ? '✅ Typing indicator displayed' : '❌ Typing indicator not visible');
        
        // Remove after 3 seconds
        setTimeout(() => {
            typingDiv.remove();
        }, 3000);
        
        return isVisible;
    }
    
    // Test typing animation
    testTypingAnimation() {
        console.log('🧪 Testing typing animation...');
        
        const typingDots = document.querySelector('.typing-dots');
        if (!typingDots) {
            this.testResults.push('❌ Typing dots not found');
            return false;
        }
        
        // Check if animation is running
        const computedStyle = window.getComputedStyle(typingDots, '::after');
        const animation = computedStyle.animation;
        
        const hasAnimation = animation && animation !== 'none';
        this.testResults.push(hasAnimation ? '✅ Typing animation running' : '❌ Typing animation not working');
        
        return hasAnimation;
    }
    
    // Test typing indicator with video background
    testVideoBackgroundCompatibility() {
        console.log('🧪 Testing video background compatibility...');
        
        const typingBubble = document.querySelector('.typing-bubble');
        if (!typingBubble) {
            this.testResults.push('❌ Typing bubble not found');
            return false;
        }
        
        const computedStyle = window.getComputedStyle(typingBubble);
        const backdropFilter = computedStyle.backdropFilter;
        const backgroundColor = computedStyle.backgroundColor;
        
        const hasBackdropFilter = backdropFilter && backdropFilter !== 'none';
        const hasTransparentBg = backgroundColor.includes('rgba');
        
        this.testResults.push(hasBackdropFilter ? '✅ Backdrop filter applied' : '❌ Backdrop filter missing');
        this.testResults.push(hasTransparentBg ? '✅ Transparent background' : '❌ Solid background');
        
        return hasBackdropFilter && hasTransparentBg;
    }
    
    // Run all tests
    runAllTests() {
        console.log('🧪 Starting typing indicator tests...');
        
        this.testTypingDisplay();
        this.testTypingAnimation();
        this.testVideoBackgroundCompatibility();
        
        console.log('🧪 Test Results:');
        this.testResults.forEach(result => console.log(result));
        
        const passedTests = this.testResults.filter(result => result.startsWith('✅')).length;
        const totalTests = this.testResults.length;
        
        console.log(`🧪 Tests passed: ${passedTests}/${totalTests}`);
        
        return passedTests === totalTests;
    }
}

// Make it available globally for testing
window.TypingIndicatorTest = TypingIndicatorTest;

// Auto-run tests when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add test button to UI
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Typing Indicator';
    testButton.className = 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors';
    testButton.style.position = 'fixed';
    testButton.style.top = '10px';
    testButton.style.right = '10px';
    testButton.style.zIndex = '9999';
    
    testButton.addEventListener('click', () => {
        const tester = new TypingIndicatorTest();
        tester.runAllTests();
    });
    
    document.body.appendChild(testButton);
    
    console.log('🧪 Typing indicator test button added to page');
});
