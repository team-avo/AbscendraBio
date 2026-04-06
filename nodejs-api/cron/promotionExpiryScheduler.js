const prisma = require("../prisma/client");
const { processRawEmailResend } = require("../utils/emailService");
const logger = require("../utils/logger");

async function run() {
  const now = new Date();

  // Find expired promotions
  const expiredPromotions = await prisma.promotion.findMany({
    where: {
      expiresAt: {
        lt: now,
        not: null,
      },
    },
  });

  if (expiredPromotions.length === 0) {
    return { deleted: 0 };
  }

  logger.info(
    `[Cron] Found ${expiredPromotions.length} expired promotions to delete.`,
  );

  let deletedCount = 0;
  for (const promo of expiredPromotions) {
    try {
      // Send notification email
      const deactivationTime =
        new Date().toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
        }) + " PST";
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
                .header { background: #f82d2d; color: white; padding: 10px 20px; border-radius: 4px 4px 0 0; font-weight: bold; }
                .content { padding: 20px; }
                .footer { font-size: 12px; color: #777; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">Coupon Auto-Deleted</div>
                <div class="content">
                    <p>A coupon code has been automatically deleted because it reached its expiry date.</p>
                    <p><strong>Coupon Code:</strong> ${promo.code}</p>
                    <p><strong>Name:</strong> ${promo.name}</p>
                    <p><strong>Deletion Time:</strong> ${deactivationTime}</p>
                    <p><strong>Reason:</strong> Scheduled Expiry</p>
                </div>
                <div class="footer">
                    This is an automated notification from Centre Labs.
                </div>
            </div>
        </body>
        </html>
      `;

      await processRawEmailResend({
        to: [
          "nikhilranga43@gmail.com",
          "khush@advertout.in",
          "harshitdkanodia@gmail.com",

          "nick@centreresearch.org",
          "ben@centreresearch.org",
        ],
        subject: `[ALERT] Coupon Expired & Deleted: ${promo.code}`,
        html: html,
      });

      // Delete the promotion
      await prisma.promotion.delete({
        where: { id: promo.id },
      });

      logger.info(`[Cron] Auto-deleted expired promotion: ${promo.code}`);
      deletedCount++;
    } catch (err) {
      logger.error(`[Cron] Failed to process expired promotion ${promo.code}`, {
        error: err.message,
      });
    }
  }

  return { deleted: deletedCount };
}

module.exports = { run };
