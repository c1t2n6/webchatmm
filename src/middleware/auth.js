// Authentication middleware
const jwt = require('jsonwebtoken');
const config = require('../../config');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      detail: 'Token không được cung cấp'
    });
  }

  jwt.verify(token, config.jwt.secretKey, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid token',
        detail: 'Token không hợp lệ'
      });
    }
    req.user = user;
    next();
  });
};

const generateToken = (user) => {
  return jwt.sign(
    { 
      sub: user.username,
      id: user.id,
      role: user.role 
    },
    config.jwt.secretKey,
    { 
      algorithm: config.jwt.algorithm,
      expiresIn: `${config.jwt.accessTokenExpireMinutes}m`
    }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secretKey);
  } catch (err) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  generateToken,
  verifyToken
};
