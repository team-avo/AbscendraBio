const prisma = require("../prisma/client");
const logger = require("./logger");

/**
 * Log a login attempt (fire-and-forget — never throws, never blocks login flow).
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string|null} [params.userId]
 * @param {"SUCCESS"|"FAILED"} params.status
 * @param {string|null} [params.failureReason] - e.g. USER_NOT_FOUND, INVALID_PASSWORD, ACCOUNT_INACTIVE, etc.
 * @param {string|null} [params.failureDetail] - human-readable extra detail
 * @param {string} params.portal - "admin" or "customer"
 * @param {string} [params.source="server"] - "server" or "client"
 * @param {Object|null} [params.deviceInfo]
 * @param {import('express').Request} [params.req] - Express request (for IP + userAgent)
 */
function logLoginAttempt({
  email,
  userId = null,
  status,
  failureReason = null,
  failureDetail = null,
  portal = "unknown",
  source = "server",
  deviceInfo = null,
  req = null,
}) {
  // Fire-and-forget: intentionally NOT awaited by callers
  prisma.loginAttempt
    .create({
      data: {
        email: email || "unknown",
        userId: userId || null,
        status,
        failureReason: failureReason || null,
        failureDetail: failureDetail || null,
        portal: (portal || "unknown").toLowerCase(),
        ipAddress: extractIp(req),
        userAgent: req?.headers?.["user-agent"] || null,
        deviceInfo: deviceInfo || undefined,
        source: source || "server",
      },
    })
    .catch((err) => {
      // Log to pino but NEVER propagate — login must never be affected
      logger.error(
        { err, email, status, failureReason },
        "Failed to write login audit log",
      );
    });
}

function extractIp(req) {
  if (!req) return null;
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    // x-forwarded-for can be comma-separated; take first
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || null;
}

module.exports = { logLoginAttempt };
