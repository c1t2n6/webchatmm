// Video Optimization Script
const fs = require('fs');
const path = require('path');

console.log('🎬 Video Optimization Script');
console.log('============================');

const videoPath = path.join(__dirname, '../static/videos/background-loop.mp4');
const optimizedPath = path.join(__dirname, '../static/videos/background-loop-optimized.mp4');

// Check if video exists
if (!fs.existsSync(videoPath)) {
    console.error('❌ Video file not found:', videoPath);
    process.exit(1);
}

// Get file size
const stats = fs.statSync(videoPath);
const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`📁 Current file size: ${fileSizeInMB} MB`);
console.log(`📁 File path: ${videoPath}`);

if (fileSizeInMB > 10) {
    console.log('⚠️  File is quite large (>10MB)');
    console.log('💡 Recommendations:');
    console.log('   1. Use FFmpeg to compress:');
    console.log('      ffmpeg -i background-loop.mp4 -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 64k -movflags +faststart background-loop-optimized.mp4');
    console.log('   2. Or use online tools like HandBrake');
    console.log('   3. Target size: < 5MB for better performance');
} else if (fileSizeInMB > 5) {
    console.log('⚠️  File is moderately large (>5MB)');
    console.log('💡 Consider compressing for better performance');
} else {
    console.log('✅ File size is good!');
}

console.log('\n🎯 Next steps:');
console.log('1. Test the video in browser');
console.log('2. If too slow, compress the video');
console.log('3. Deploy to production');

// Check if optimized version exists
if (fs.existsSync(optimizedPath)) {
    const optimizedStats = fs.statSync(optimizedPath);
    const optimizedSizeInMB = (optimizedStats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ Optimized version found: ${optimizedSizeInMB} MB`);
    console.log(`📊 Size reduction: ${(fileSizeInMB - optimizedSizeInMB).toFixed(2)} MB`);
}
