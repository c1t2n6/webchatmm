// Authentication routes
const express = require('express');
const router = express.Router();
const { generateToken } = require('../middleware/auth');
const { validateSignup, validateLogin } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const User = require('../models/User');
const config = require('../../config');

// Initialize User model
let userModel;
const initUserModel = (db) => {
  userModel = new User(db);
};

// Signup endpoint
router.post('/signup', authLimiter, validateSignup, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validate input
    if (!username || username.trim() === '') {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Tên đăng nhập không được để trống'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Check if username already exists
    const existingUser = await userModel.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Tên đăng nhập đã tồn tại'
      });
    }

    // Create new user
    const userData = {
      username,
      password,
      email,
      nickname: `user_${username}`,
      dob: '1990-01-01',
      gender: 'Khác',
      preferred_gender: [],
      needs: [],
      interests: [],
      profile_completed: false,
      role: 'free'
    };

    const newUser = await userModel.create(userData);

    // Generate token
    const token = generateToken(newUser);

    // Return response
    res.status(201).json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: newUser.id,
        username: newUser.username,
        nickname: newUser.nickname,
        profile_completed: newUser.profile_completed,
        status: newUser.status || 'idle',
        online_status: newUser.online_status,
        avatar_url: newUser.avatar_url,
        role: newUser.role,
        created_at: newUser.created_at,
        current_room_id: newUser.current_room_id || null
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi tạo tài khoản: ' + error.message
    });
  }
});

// Login endpoint
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await userModel.findByUsername(username);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        detail: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    // Check if user is banned
    if (await userModel.isBanned(user)) {
      return res.status(403).json({
        error: 'Account banned',
        detail: `Tài khoản bị tạm khóa đến ${user.banned_until}`
      });
    }

    // Verify password
    const isValidPassword = await userModel.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        detail: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    // Update online status
    await userModel.updateOnlineStatus(user.id, true);

    // Generate token
    const token = generateToken(user);

    // Return response
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        dob: user.dob,
        gender: user.gender,
        preferred_gender: user.preferred_gender,
        needs: user.needs,
        interests: user.interests,
        profile_completed: user.profile_completed,
        status: user.status,
        online_status: true,
        avatar_url: user.avatar_url,
        role: user.role,
        created_at: user.created_at,
        current_room_id: user.current_room_id
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi đăng nhập: ' + error.message
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // In a real app, you might want to blacklist the token
    // For now, we'll just return success
    res.json({
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi đăng xuất: ' + error.message
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    // This would typically verify the refresh token
    // For now, we'll return an error as we don't have refresh tokens
    res.status(501).json({
      error: 'Not implemented',
      detail: 'Refresh token chưa được implement'
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: 'Lỗi refresh token: ' + error.message
    });
  }
});

module.exports = { router, initUserModel };
