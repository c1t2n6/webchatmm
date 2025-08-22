import os
from PIL import Image, ImageFilter
from typing import Tuple
from ..config import settings

class ImageProcessor:
    def __init__(self):
        self.upload_dir = settings.upload_dir
        self.max_file_size = settings.max_file_size
        self.allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
        
    def validate_image(self, file_path: str) -> Tuple[bool, str]:
        """Validate uploaded image file"""
        try:
            # Check file size
            if os.path.getsize(file_path) > self.max_file_size:
                return False, f"File quá lớn. Tối đa {self.max_file_size // 1024 // 1024}MB"
            
            # Check file extension
            file_ext = os.path.splitext(file_path)[1].lower()
            if file_ext not in self.allowed_extensions:
                return False, f"Chỉ chấp nhận file: {', '.join(self.allowed_extensions)}"
            
            # Try to open image
            with Image.open(file_path) as img:
                img.verify()
            
            return True, "OK"
            
        except Exception as e:
            return False, f"File không hợp lệ: {str(e)}"
    
    def process_avatar(self, original_path: str, filename: str) -> dict:
        """Process avatar image and create blur variants"""
        try:
            with Image.open(original_path) as img:
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize to standard avatar size (300x300)
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                
                # Save original
                original_filename = f"avatar_{filename}"
                original_path_final = os.path.join(self.upload_dir, original_filename)
                img.save(original_path_final, 'JPEG', quality=85)
                
                # Create blur variants
                blur_20 = self._create_blur_variant(img, 20)
                blur_5 = self._create_blur_variant(img, 5)
                
                # Save blur variants
                blur_20_filename = f"avatar_blur_{filename}"
                blur_5_filename = f"avatar_semi_{filename}"
                
                blur_20_path = os.path.join(self.upload_dir, blur_20_filename)
                blur_5_path = os.path.join(self.upload_dir, blur_5_filename)
                
                blur_20.save(blur_20_path, 'JPEG', quality=85)
                blur_5.save(blur_5_path, 'JPEG', quality=85)
                
                return {
                    'original': original_filename,
                    'blur_20': blur_20_filename,
                    'blur_5': blur_5_filename,
                    'success': True
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_blur_variant(self, img: Image.Image, blur_radius: int) -> Image.Image:
        """Create a blurred version of the image"""
        # Apply Gaussian blur
        blurred = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
        return blurred
    
    def get_avatar_url(self, filename: str, reveal_level: int = 0) -> str:
        """Get avatar URL based on reveal level"""
        base_name = filename.replace('avatar_', '').replace('.jpg', '').replace('.png', '')
        
        if reveal_level == 0:
            # Level 0: Blur (Gaussian 20px)
            return f"/static/uploads/avatar_blur_{base_name}.jpg"
        elif reveal_level == 1:
            # Level 1: Semi-blur (Gaussian 5px)
            return f"/static/uploads/avatar_semi_{base_name}.jpg"
        else:
            # Level 2: Full image
            return f"/static/uploads/avatar_{base_name}.jpg"
    
    def cleanup_temp_files(self, temp_path: str):
        """Clean up temporary uploaded files"""
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
    
    def delete_avatar_variants(self, filename: str):
        """Delete all avatar variants when user changes avatar"""
        try:
            base_name = filename.replace('avatar_', '').replace('.jpg', '').replace('.png', '')
            
            variants = [
                f"avatar_{base_name}.jpg",
                f"avatar_blur_{base_name}.jpg", 
                f"avatar_semi_{base_name}.jpg"
            ]
            
            for variant in variants:
                variant_path = os.path.join(self.upload_dir, variant)
                if os.path.exists(variant_path):
                    os.remove(variant_path)
                    
        except Exception:
            pass

# Global image processor instance
image_processor = ImageProcessor()
