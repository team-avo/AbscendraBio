const { PrismaClientKnownRequestError } = require('@prisma/client/runtime/library');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Prisma errors
  if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        const target = err.meta?.target;
        error.message = `${target} already exists`;
        error.statusCode = 409;
        break;
      case 'P2025':
        // Record not found
        error.message = 'Record not found';
        error.statusCode = 404;
        break;
      case 'P2003':
        // Foreign key constraint violation
        error.message = 'Related record not found';
        error.statusCode = 400;
        break;
      case 'P2014':
        // Required relation violation
        error.message = 'Invalid data: missing required relation';
        error.statusCode = 400;
        break;
      default:
        error.message = 'Database error';
        error.statusCode = 500;
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.statusCode = 401;
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error.message = 'File too large';
    error.statusCode = 400;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error.message = 'Unexpected file field';
    error.statusCode = 400;
  }

  // Express validation errors
  if (err.type === 'entity.parse.failed') {
    error.message = 'Invalid JSON';
    error.statusCode = 400;
  }

  // Set default values
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't expose error details in production
  const errorResponse = {
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  };

  // Additional error details for development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.request = {
      url: req.originalUrl,
      method: req.method,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }

  res.status(statusCode).json(errorResponse);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  asyncHandler
};