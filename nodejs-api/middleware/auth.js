const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

const authMiddleware = async (req, res, next) => {
  try {
    let token = req.header("Authorization")?.replace("Bearer ", "");

    // Check for token in cookies if not in header
    if (!token && req.cookies) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        error: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        permissions: true,
        customer: {
          select: {
            id: true,
            customerType: true,
            isActive: true,
            isApproved: true,
          },
        },
        salesRepresentative: {
          select: {
            id: true,
          },
        },
        salesManager: {
          select: {
            id: true,
          },
        },
      },
    });

    // Map sales rep profile to salesRepId if exists
    if (user && user.salesRepresentative && user.salesRepresentative.id) {
      user.salesRepId = user.salesRepresentative.id;
    }

    // Map sales manager profile to salesManagerId if exists
    if (user && user.salesManager && user.salesManager.id) {
      user.salesManagerId = user.salesManager.id;
    }

    // Map customer ID if user has customer profile
    if (user && user.customer && user.customer.id) {
      user.customerId = user.customer.id;
    }

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Access denied. User not found or inactive.",
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Access denied. Invalid token.",
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Access denied. Token expired.",
      });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({
      error: "Internal server error.",
    });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Access denied. User not authenticated.",
      });
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

// Permission-based access control middleware
const requirePermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Access denied. User not authenticated.",
      });
    }

    // Admin has all permissions
    if (req.user.role === "ADMIN") {
      return next();
    }

    // Implicit role-based allowances (for roles without granular permissions stored)
    // This helps in deployments where SALES_REP users may not have explicit permission rows yet.
    // Allow read-only access to key modules for SALES_REP by default.
    if (req.user.role === "SALES_REP") {
      // Explicitly deny DELETE access on CUSTOMERS for sales reps
      if (
        String(action).toUpperCase() === "DELETE" &&
        String(module).toUpperCase() === "CUSTOMERS"
      ) {
        return res.status(403).json({
          error: `Access denied. Sales representatives cannot delete customers.`,
        });
      }

      const allowedReadModules = [
        "CUSTOMERS",
        "ORDERS",
        "TRANSACTIONS",
        "PRODUCTS",
        "PAYMENTS",
      ];
      const isRead = String(action).toUpperCase() === "READ";
      const isAllowedModule = allowedReadModules.includes(
        String(module).toUpperCase()
      );
      if (isRead && isAllowedModule) {
        return next();
      }

      // Allow CREATE and UPDATE access for specific modules for sales reps
      const allowedCreateModules = ["PAYMENTS", "CUSTOMERS", "ORDERS"];
      const isCreate = String(action).toUpperCase() === "CREATE";
      const isAllowedCreateModule = allowedCreateModules.includes(String(module).toUpperCase());
      if (isCreate && isAllowedCreateModule) {
        return next();
      }

      // Allow UPDATE access for PAYMENTS module for sales reps
      const allowedUpdateModules = ["PAYMENTS"];
      const isUpdate = String(action).toUpperCase() === "UPDATE";
      const isAllowedUpdateModule = allowedUpdateModules.includes(String(module).toUpperCase());
      if (isUpdate && isAllowedUpdateModule) {
        return next();
      }
    }

    // Allow read-only access for SALES_MANAGER by default
    if (req.user.role === "SALES_MANAGER") {
      const allowedReadModules = [
        "CUSTOMERS",
        "ORDERS",
        "TRANSACTIONS",
        "PRODUCTS",
        "PAYMENTS",
        "ANALYTICS"
      ];
      const isRead = String(action).toUpperCase() === "READ";
      const isAllowedModule = allowedReadModules.includes(
        String(module).toUpperCase()
      );
      if (isRead && isAllowedModule) {
        return next();
      }

      // Allow CREATE/UPDATE access for certain management tasks
      const allowedWriteModules = ["CUSTOMERS", "ORDERS"];
      const isWrite = ["CREATE", "UPDATE"].includes(String(action).toUpperCase());
      const isAllowedWriteModule = allowedWriteModules.includes(String(module).toUpperCase());
      if (isWrite && isAllowedWriteModule) {
        return next();
      }
    }

    // Allow broad access for STAFF by default to manage store ops
    if (req.user.role === "STAFF") {
      const staffModules = [
        "CUSTOMERS",
        "ORDERS",
        "TRANSACTIONS",
        "PRODUCTS",
        "PAYMENTS",
        "INVENTORY",
        "PROMOTIONS",
        "ANALYTICS"
      ];
      const isReadOrUpdate = ["READ", "UPDATE"].includes(String(action).toUpperCase());
      const isAllowedModule = staffModules.includes(String(module).toUpperCase());
      if (isReadOrUpdate && isAllowedModule) {
        return next();
      }
    }

    // Check specific permission (case-insensitive)
    const hasPermission = req.user.permissions.some(
      (permission) =>
        permission.module.toLowerCase() === module.toLowerCase() &&
        permission.action.toLowerCase() === action.toLowerCase() &&
        permission.granted
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: `Access denied. Missing ${action} permission for ${module}.`,
      });
    }

    next();
  };
};

// Optional auth middleware (for routes that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.header("Authorization")?.replace("Bearer ", "");

    // Check for token in cookies if not in header
    if (!token && req.cookies) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        permissions: true,
        customer: {
          select: {
            id: true,
            customerType: true,
            isActive: true,
            isApproved: true,
          },
        },
        salesRepresentative: {
          select: {
            id: true,
          },
        },
      },
    });

    // Map sales rep profile to salesRepId if exists
    if (user && user.salesRepresentative && user.salesRepresentative.id) {
      user.salesRepId = user.salesRepresentative.id;
    }

    // Map customer ID if user has customer profile
    if (user && user.customer && user.customer.id) {
      user.customerId = user.customer.id;
    }

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  requirePermission,
  optionalAuth,
};
