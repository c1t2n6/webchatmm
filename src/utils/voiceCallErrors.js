// Voice Call Error Codes and Messages
// Centralized error handling for voice call system

const VOICE_CALL_ERRORS = {
  // System Errors (5xx)
  SYSTEM_ERROR: {
    code: 'SYSTEM_ERROR',
    status: 500,
    message: 'Lỗi hệ thống',
    description: 'Đã có lỗi xảy ra, vui lòng thử lại sau'
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE', 
    status: 503,
    message: 'Dịch vụ không khả dụng',
    description: 'Hệ thống voice call đang bảo trì'
  },
  
  // Authentication/Authorization Errors (4xx)
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    status: 401,
    message: 'Không có quyền truy cập',
    description: 'Vui lòng đăng nhập lại'
  },
  
  // Call State Errors (4xx)
  USER_ALREADY_IN_CALL: {
    code: 'USER_ALREADY_IN_CALL',
    status: 400,
    message: 'Đang trong cuộc gọi khác',
    description: 'Bạn đang có cuộc gọi đang hoạt động'
  },
  TARGET_USER_BUSY: {
    code: 'TARGET_USER_BUSY',
    status: 400,
    message: 'Người dùng đang bận',
    description: 'Người bạn muốn gọi đang trong cuộc gọi khác'
  },
  NO_ACTIVE_CALL: {
    code: 'NO_ACTIVE_CALL',
    status: 400,
    message: 'Không có cuộc gọi nào',
    description: 'Không tìm thấy cuộc gọi đang hoạt động'
  },
  CALL_NOT_FOUND: {
    code: 'CALL_NOT_FOUND',
    status: 404,
    message: 'Không tìm thấy cuộc gọi',
    description: 'Cuộc gọi này không tồn tại hoặc đã kết thúc'
  },
  INVALID_CALL_STATE: {
    code: 'INVALID_CALL_STATE',
    status: 400,
    message: 'Trạng thái cuộc gọi không hợp lệ',
    description: 'Không thể thực hiện thao tác này ở trạng thái hiện tại'
  },
  
  // User/Room Validation Errors (4xx)
  CANNOT_CALL_SELF: {
    code: 'CANNOT_CALL_SELF',
    status: 400,
    message: 'Không thể gọi cho chính mình',
    description: 'Bạn không thể tự gọi cho mình'
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    status: 404,
    message: 'Không tìm thấy người dùng',
    description: 'Người dùng không tồn tại trong hệ thống'
  },
  USERS_NOT_IN_SAME_ROOM: {
    code: 'USERS_NOT_IN_SAME_ROOM',
    status: 400,
    message: 'Không cùng phòng chat',
    description: 'Bạn và người được gọi không trong cùng phòng chat'
  },
  ROOM_ENDED: {
    code: 'ROOM_ENDED',
    status: 400,
    message: 'Phòng chat đã kết thúc',
    description: 'Không thể gọi trong phòng chat đã kết thúc'
  },
  
  // User Settings Errors (4xx)
  CALL_NOTIFICATIONS_DISABLED: {
    code: 'CALL_NOTIFICATIONS_DISABLED',
    status: 400,
    message: 'Đã tắt thông báo cuộc gọi',
    description: 'Người dùng đã tắt thông báo cuộc gọi'
  },
  
  // Call Timeout/Network Errors (4xx)
  CALL_TIMEOUT: {
    code: 'CALL_TIMEOUT',
    status: 408,
    message: 'Cuộc gọi hết thời gian chờ',
    description: 'Không có phản hồi trong thời gian quy định'
  },
  CALL_REJECTED: {
    code: 'CALL_REJECTED',
    status: 400,
    message: 'Cuộc gọi bị từ chối',
    description: 'Người được gọi đã từ chối cuộc gọi'
  },
  CONNECTION_FAILED: {
    code: 'CONNECTION_FAILED',
    status: 500,
    message: 'Kết nối thất bại',
    description: 'Không thể thiết lập kết nối WebRTC'
  },
  
  // Permission Errors (4xx)
  MICROPHONE_PERMISSION_DENIED: {
    code: 'MICROPHONE_PERMISSION_DENIED',
    status: 400,
    message: 'Không có quyền truy cập microphone',
    description: 'Vui lòng cho phép truy cập microphone để thực hiện cuộc gọi'
  },
  MICROPHONE_NOT_FOUND: {
    code: 'MICROPHONE_NOT_FOUND',
    status: 400,
    message: 'Không tìm thấy microphone',
    description: 'Thiết bị của bạn không có microphone'
  },
  
  // Validation Errors (4xx)
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    status: 400,
    message: 'Dữ liệu không hợp lệ',
    description: 'Vui lòng kiểm tra lại thông tin đầu vào'
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    status: 400,
    message: 'Thiếu thông tin bắt buộc',
    description: 'Vui lòng cung cấp đầy đủ thông tin'
  }
};

// Helper function to create error response
function createErrorResponse(errorCode, customMessage = null, customDescription = null) {
  const error = VOICE_CALL_ERRORS[errorCode];
  if (!error) {
    return VOICE_CALL_ERRORS.SYSTEM_ERROR;
  }
  
  return {
    ...error,
    message: customMessage || error.message,
    description: customDescription || error.description,
    timestamp: new Date().toISOString()
  };
}

// Helper function to create success response
function createSuccessResponse(data = {}, message = 'Thành công') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

// Helper function to handle async operations with proper error handling
async function handleAsyncOperation(operation, errorCode = 'SYSTEM_ERROR') {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Async operation failed:', error);
    return { 
      success: false, 
      error: createErrorResponse(errorCode, null, error.message) 
    };
  }
}

module.exports = {
  VOICE_CALL_ERRORS,
  createErrorResponse,
  createSuccessResponse,
  handleAsyncOperation
};
