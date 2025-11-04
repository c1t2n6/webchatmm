// Voice Call API Routes - REST endpoints for voice call management
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { createErrorResponse, createSuccessResponse, VOICE_CALL_ERRORS } = require('../utils/voiceCallErrors');

// Models will be initialized later
let database, voiceCallService, userCallSettingsModel;

// Initialize models
const initModels = (db, vcs) => {
  database = db;
  voiceCallService = vcs;
  const UserCallSettings = require('../models/UserCallSettings');
  userCallSettingsModel = new UserCallSettings(db);
};

// === USER CALL SETTINGS ===

// Get user call settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await userCallSettingsModel.getSettings(userId);
    
    res.json({
      success: true,
      settings
    });
    
  } catch (error) {
    console.error('❌ Error getting call settings:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể lấy cài đặt cuộc gọi'
    });
  }
});

// Update user call settings
router.put('/settings', authenticateToken, generalLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;
    
    // Validate input (simplified)
    const allowedFields = [
      'callNotifications'
    ];
    
    const filteredData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }
    
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Không có dữ liệu hợp lệ để cập nhật'
      });
    }
    
    const settings = await userCallSettingsModel.updateSettings(userId, filteredData);
    
    res.json({
      success: true,
      settings,
      message: 'Cài đặt đã được cập nhật'
    });
    
  } catch (error) {
    console.error('❌ Error updating call settings:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        error: 'Validation error',
        detail: error.message
      });
    }
    
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể cập nhật cài đặt'
    });
  }
});

// Reset call settings to default
router.post('/settings/reset', authenticateToken, generalLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await userCallSettingsModel.resetToDefault(userId);
    
    res.json({
      success: true,
      settings,
      message: 'Cài đặt đã được reset về mặc định'
    });
    
  } catch (error) {
    console.error('❌ Error resetting call settings:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể reset cài đặt'
    });
  }
});

// === CALL HISTORY ===

// Get call history for user
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    
    const CallSession = require('../models/CallSession');
    const callSessionModel = new CallSession(database);
    
    const history = await callSessionModel.getCallHistoryForUser(userId, limit, offset);
    
    res.json({
      success: true,
      history,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting call history:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể lấy lịch sử cuộc gọi'
    });
  }
});

// Get call statistics for user
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const CallSession = require('../models/CallSession');
    const callSessionModel = new CallSession(database);
    
    const stats = await callSessionModel.getCallStatsForUser(userId);
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error getting call stats:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể lấy thống kê cuộc gọi'
    });
  }
});

// === ACTIVE CALL MANAGEMENT ===

// Get current active call for user (for state sync)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!voiceCallService) {
      const error = createErrorResponse('SERVICE_UNAVAILABLE');
      return res.status(error.status).json(error);
    }
    
    const activeCall = voiceCallService.getActiveCallForUser(userId);
    const isInCall = voiceCallService.isUserInCall(userId);
    
    // Return detailed state for sync
    res.json({
      success: true,
      state: {
        hasActiveCall: !!activeCall,
        isInCall,
        callId: activeCall?.id || null,
        callStatus: activeCall?.status || null,
        otherUserId: activeCall ? (
          activeCall.caller_id === userId ? activeCall.callee_id : activeCall.caller_id
        ) : null,
        startedAt: activeCall?.started_at || null,
        roomId: activeCall?.room_id || null
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting active call:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể lấy thông tin cuộc gọi hiện tại'
    });
  }
});

// End current call (alternative to WebSocket)
router.post('/end', authenticateToken, generalLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason = 'user_hangup' } = req.body;
    
    if (!voiceCallService) {
      const error = createErrorResponse('SERVICE_UNAVAILABLE');
      return res.status(error.status).json(error);
    }
    
    const activeCall = voiceCallService.getActiveCallForUser(userId);
    if (!activeCall) {
      return res.status(400).json({
        error: 'No active call',
        detail: 'Bạn không có cuộc gọi nào đang hoạt động'
      });
    }
    
    const result = await voiceCallService.endCall(activeCall.id, userId, reason);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cuộc gọi đã kết thúc',
        duration: result.duration
      });
    } else {
      res.status(400).json({
        error: 'Failed to end call',
        detail: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error ending call:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể kết thúc cuộc gọi'
    });
  }
});

// === CALL QUALITY RATING ===

// Rate a completed call
router.post('/rate/:callId', authenticateToken, generalLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const callId = parseInt(req.params.callId);
    const { rating, feedback } = req.body;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Validation error',
        detail: 'Đánh giá phải từ 1 đến 5 sao'
      });
    }
    
    const CallSession = require('../models/CallSession');
    const callSessionModel = new CallSession(database);
    
    // Check if user was part of this call
    const callSession = await callSessionModel.findById(callId);
    if (!callSession || (callSession.caller_id !== userId && callSession.callee_id !== userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        detail: 'Bạn không có quyền đánh giá cuộc gọi này'
      });
    }
    
    // Check if call is completed
    if (callSession.status !== 'ended') {
      return res.status(400).json({
        error: 'Invalid call state',
        detail: 'Chỉ có thể đánh giá cuộc gọi đã kết thúc'
      });
    }
    
    // Update call rating
    await callSessionModel.update(callId, { qualityRating: rating });
    
    // TODO: Store feedback in a separate table if needed
    
    res.json({
      success: true,
      message: 'Cảm ơn bạn đã đánh giá cuộc gọi'
    });
    
  } catch (error) {
    console.error('❌ Error rating call:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể lưu đánh giá'
    });
  }
});

// === ERROR REPORTING ===

// Report voice call errors (for debugging)
router.post('/error-report', authenticateToken, generalLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { error, context, userAgent, timestamp } = req.body;
    
    console.error('📞 Voice call error report:', {
      userId,
      error,
      context,
      userAgent,
      timestamp
    });
    
    // TODO: Store error reports in database for analysis
    // For now, just log them
    
    res.json({
      success: true,
      message: 'Error report received'
    });
    
  } catch (error) {
    console.error('❌ Error processing error report:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể xử lý báo cáo lỗi'
    });
  }
});

// === SYSTEM STATUS ===

// Get voice call system status (for debugging)
router.get('/system/status', authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to access this endpoint
    const user = await database.get('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        detail: 'Chỉ admin mới có thể truy cập'
      });
    }
    
    const status = voiceCallService ? voiceCallService.getStatus() : null;
    
    res.json({
      success: true,
      status: {
        voiceCallServiceAvailable: !!voiceCallService,
        ...status
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting system status:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể lấy trạng thái hệ thống'
    });
  }
});

// === ADMIN ENDPOINTS ===

// Get system-wide call statistics (admin only)
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    const user = await database.get('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        detail: 'Chỉ admin mới có thể truy cập'
      });
    }
    
    // Get overall statistics
    const totalCalls = await database.get(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'ended' AND duration > 0 THEN 1 END) as completed_calls,
        COUNT(CASE WHEN status = 'missed' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_calls,
        AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration,
        MAX(duration) as max_duration,
        SUM(duration) as total_duration
      FROM call_sessions
    `);
    
    const settingsStats = await userCallSettingsModel.getSettingsStatistics();
    
    res.json({
      success: true,
      stats: {
        calls: totalCalls,
        settings: settingsStats,
        system: voiceCallService ? voiceCallService.getStatus() : null
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting admin stats:', error);
    res.status(500).json({
      error: 'Lỗi hệ thống',
      detail: 'Không thể lấy thống kê admin'
    });
  }
});

module.exports = { 
  router, 
  initModels 
};
