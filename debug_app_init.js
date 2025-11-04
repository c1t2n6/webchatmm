// Quick debug script to check app initialization
console.log('=== APP INIT DEBUG ===');

// Check if app exists
console.log('1. window.mapmoApp exists:', !!window.mapmoApp);

// If not, check if DOM is ready
console.log('2. DOM readyState:', document.readyState);

// Check if modules are loading
console.log('3. Checking module imports...');

// Try to manually create app if it doesn't exist
if (!window.mapmoApp) {
    console.log('4. App not found, checking for errors...');
    
    // Check if we can access the MapmoApp class
    if (typeof MapmoApp !== 'undefined') {
        console.log('5. MapmoApp class is available');
        try {
            const testApp = new MapmoApp();
            window.mapmoApp = testApp;
            console.log('6. ✅ Manually created app instance');
        } catch (error) {
            console.error('6. ❌ Error creating app:', error);
        }
    } else {
        console.log('5. ❌ MapmoApp class not available');
        console.log('   This suggests a module loading issue');
    }
} else {
    console.log('4. ✅ App exists!');
    console.log('   - currentUser:', !!window.mapmoApp.currentUser);
    console.log('   - chatModule:', !!window.mapmoApp.chatModule);
    console.log('   - voiceCallManager:', !!window.mapmoApp.voiceCallManager);
}

// Check for any JavaScript errors in console
console.log('=== END DEBUG ===');
