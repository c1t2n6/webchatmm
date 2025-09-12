// Logging utility for WebChat
const config = require('../../config');

class Logger {
  constructor() {
    this.logLevel = config.logging.level || 'INFO';
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const log = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    return JSON.stringify(log);
  }

  error(message, data = null) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  // Specialized logging methods
  api(method, path, status, duration, user = null) {
    this.info('API Request', {
      method,
      path,
      status,
      duration: `${duration}ms`,
      user: user ? user.id : null
    });
  }

  matching(action, userId, data = null) {
    this.info(`Matching: ${action}`, {
      userId,
      ...data
    });
  }

  websocket(event, socketId, data = null) {
    this.debug(`WebSocket: ${event}`, {
      socketId,
      ...data
    });
  }

  database(operation, table, duration, error = null) {
    if (error) {
      this.error(`Database ${operation} failed`, {
        table,
        duration: `${duration}ms`,
        error: error.message
      });
    } else {
      this.debug(`Database ${operation}`, {
        table,
        duration: `${duration}ms`
      });
    }
  }
}

module.exports = new Logger();
