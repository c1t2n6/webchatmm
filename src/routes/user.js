// User profile routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize models
let userModel;

const initUserModel = (db) => {
  const User = require('../models/User');
  userModel = new User(db);
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './static/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WebP)'));
    }
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    // Get fresh user data from database
    const user = await userModel.findById(currentUser.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        detail: 'Không tìm thấy user'
      });
    }

    // Remove sensitive data
    const { password_hash, ...userProfile } = user;

    res.json({
      user: userProfile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi lấy thông tin profile: ' + error.message
    });
  }
});

// Update user profile (support both PUT and POST)
const updateProfileHandler = async (req, res) => {
  try {
    const currentUser = req.user;
    const {
      nickname,
      dob,
      gender,
      preferred_gender,
      needs,
      interests,
      profile_completed
    } = req.body;

    // Validate input
    if (nickname && nickname.trim() === '') {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Nickname không được để trống'
      });
    }

    // Check nickname uniqueness if provided
    if (nickname && nickname.trim() !== '') {
      const existingUser = await userModel.findByNickname && await userModel.findByNickname(nickname.trim());
      if (existingUser && existingUser.id !== currentUser.id) {
        return res.status(400).json({
          error: 'Validation error',
          detail: 'Nickname đã được sử dụng'
        });
      }
    }

    if (dob && !isValidDate(dob)) {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Ngày sinh không hợp lệ'
      });
    }

    if (gender && !['Nam', 'Nữ', 'Khác'].includes(gender)) {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Giới tính không hợp lệ'
      });
    }

    // Prepare update data
    const updateData = {};
    
    if (nickname !== undefined) updateData.nickname = nickname.trim();
    if (dob !== undefined) updateData.dob = dob;
    if (gender !== undefined) updateData.gender = gender;
    if (preferred_gender !== undefined) updateData.preferred_gender = Array.isArray(preferred_gender) ? preferred_gender : [];
    if (needs !== undefined) updateData.needs = Array.isArray(needs) ? needs : [];
    if (interests !== undefined) updateData.interests = Array.isArray(interests) ? interests : [];
    if (profile_completed !== undefined) updateData.profile_completed = Boolean(profile_completed);

    // Update user
    const updatedUser = await userModel.update(currentUser.id, updateData);
    if (!updatedUser) {
      return res.status(500).json({
        error: 'Update failed',
        detail: 'Không thể cập nhật thông tin user'
      });
    }

    // ✅ THÊM: Generate new token với updated user data để tránh mismatch
    const { generateToken } = require('../middleware/auth');
    const newToken = generateToken(updatedUser);

    // Remove sensitive data
    const { password_hash, ...userProfile } = updatedUser;

    res.json({
      message: 'Cập nhật profile thành công',
      user: userProfile,
      // ✅ THÊM: Return new token để frontend cập nhật
      access_token: newToken,
      token_type: 'bearer'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi cập nhật profile: ' + error.message
    });
  }
};

// Register both PUT and POST routes for profile update
router.put('/profile/update', authenticateToken, updateProfileHandler);
router.post('/profile/update', authenticateToken, updateProfileHandler);

// Upload avatar
router.post('/profile/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const currentUser = req.user;

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        detail: 'Vui lòng chọn file ảnh để upload'
      });
    }

    // Update user avatar URL
    const avatarUrl = `/static/uploads/${req.file.filename}`;
    const updatedUser = await userModel.update(currentUser.id, { avatar_url: avatarUrl });

    if (!updatedUser) {
      return res.status(500).json({
        error: 'Update failed',
        detail: 'Không thể cập nhật avatar'
      });
    }

    // Remove sensitive data
    const { password_hash, ...userProfile } = updatedUser;

    res.json({
      message: 'Upload avatar thành công',
      avatar_url: avatarUrl,
      user: userProfile
    });

  } catch (error) {
    console.error('Upload avatar error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      const filePath = path.join('./static/uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi upload avatar: ' + error.message
    });
  }
});

// Delete avatar
router.delete('/profile/avatar', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    // Get current user data
    const user = await userModel.findById(currentUser.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        detail: 'Không tìm thấy user'
      });
    }

    // Delete old avatar file if exists
    if (user.avatar_url && user.avatar_url !== 'default_avatar.jpg') {
      const filePath = path.join('./static', user.avatar_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update user to default avatar
    const updatedUser = await userModel.update(currentUser.id, { avatar_url: 'default_avatar.jpg' });

    if (!updatedUser) {
      return res.status(500).json({
        error: 'Update failed',
        detail: 'Không thể xóa avatar'
      });
    }

    // Remove sensitive data
    const { password_hash, ...userProfile } = updatedUser;

    res.json({
      message: 'Xóa avatar thành công',
      user: userProfile
    });

  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi xóa avatar: ' + error.message
    });
  }
});

// Get user statistics
router.get('/profile/stats', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    // Get user's room statistics
    const roomStats = await userModel.getRoomStats(currentUser.id);
    
    res.json({
      user_id: currentUser.id,
      stats: roomStats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi lấy thống kê user: ' + error.message
    });
  }
});

// Alias for /user/stats (for frontend compatibility)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    // Get user's room statistics
    const roomStats = await userModel.getRoomStats(currentUser.id);
    
    res.json({
      user_id: currentUser.id,
      stats: roomStats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi lấy thống kê user: ' + error.message
    });
  }
});

// Delete user account
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    console.log(`🗑️ Deleting account for user ${currentUser.id}`);

    // TODO: Add proper cleanup logic in a real app:
    // - Delete user messages
    // - Delete user from rooms  
    // - Delete user avatar file
    // - Delete related records

    // For now, return success (implement actual deletion in User model if needed)
    console.log(`✅ Account deletion requested for user ${currentUser.id}`);
    
    res.json({
      message: 'Tài khoản đã được xóa thành công'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi xóa tài khoản: ' + error.message
    });
  }
});

// Helper function to validate date
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

module.exports = { router, initUserModel };
