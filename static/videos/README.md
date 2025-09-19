# Video Background Files

## Required Files:

### 1. background-loop.mp4
- **Duration**: 5 seconds (exactly)
- **Resolution**: 1920x1080 (Full HD) or 1280x720 (HD)
- **Format**: MP4 (H.264 codec)
- **File Size**: < 5MB
- **FPS**: 24-30fps
- **Audio**: Muted or no audio
- **Loop**: Seamless loop (start and end should connect smoothly)

### 2. background-poster.jpg (Optional)
- **Resolution**: 1920x1080
- **Format**: JPEG
- **File Size**: < 500KB
- **Purpose**: Thumbnail shown while video loads

## Video Content Suggestions:

### Theme Ideas:
1. **Abstract/Geometric**: Subtle geometric patterns, flowing lines
2. **Nature**: Gentle waves, clouds, leaves
3. **Tech**: Subtle code rain, digital particles
4. **Minimalist**: Simple color gradients, soft animations

### Technical Requirements:
- **Loop-friendly**: First and last frame should be identical
- **Subtle**: Not too distracting from main content
- **Performance**: Optimized for web playback
- **Mobile-friendly**: Consider disabling on mobile devices

## Tools for Creating Video:

### Free Tools:
- **DaVinci Resolve**: Professional video editing
- **OpenShot**: Simple video editor
- **Blender**: 3D animation (free)
- **After Effects**: Professional (paid)

### Online Tools:
- **Canva**: Simple video creation
- **Loom**: Screen recording
- **Kapwing**: Online video editor

## Optimization Tips:

1. **Compress video**: Use HandBrake or FFmpeg
2. **Multiple formats**: Create WebM version for better compression
3. **Poster image**: Create thumbnail for faster loading
4. **Mobile optimization**: Consider lighter version for mobile

## Example FFmpeg Commands:

```bash
# Convert to optimized MP4
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart background-loop.mp4

# Create WebM version
ffmpeg -i input.mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k -c:a libopus background-loop.webm

# Create poster image
ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 -q:v 2 background-poster.jpg
```
