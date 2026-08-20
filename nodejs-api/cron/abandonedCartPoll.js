/**
 * abandonedCartPoll.js
 *
 * Finds active carts that have sat with items and no recent activity, and fires
 * a GHL "abandoned cart" contact tag so a GoHighLevel workflow can run the
 * follow-up sequence. The actual emailing is owned by GHL, not by us — this cron
 * only supplies the trigger.
 *
 * Abandonment definition matches the existing admin view (routes/cart.js
 * GET /cart/abandoned): an active cart with at least one item, where no item has
 * been touched within the idle window.
 *
 * Idempotency: each cart carries abandonedSyncedAt. We only fire when the cart
 * has never been synced, or has been touched (cart.updatedAt) since the last
 * sync — so a cart that is emptied and re-abandoned fires again, but a cart that
 * simply keeps sitting there does not re-fire every run.
 *
 * DORMANT BY DEFAULT. Set ABANDONED_CART_GHL_ENABLED=true to switch it on (do
 * this only once Peter's GHL abandoned-cart workflow exists). Also a no-op if
 * GHL_API_TOKEN is unset.
 *
 * Env:
 *   ABANDONED_CART_GHL_ENABLED  "true" to enable (default off).
 *   ABANDONED_CART_MINUTES      idle window in minutes before a cart counts as
 *                               abandoned (default 60).
 *   ABANDONED_CART_MAX          safety cap on carts processed per run (default 200).
 *   ABANDONED_CART_CRON         schedule override (see server.js; default every 15 minutes).
 */

const prisma = require("../prisma/client");
const logger = require("../utils/logger");
const { syncAbandonedCart } = require("../services/ghl");

function cartValue(items) {
  return (items || []).reduce(
    (sum, it) => sum + Number(it.unitPrice || 0) * Number(it.quantity || 0),
    0,
  );
}

async function run() {
  if (process.env.ABANDONED_CART_GHL_ENABLED !== "true") {
    return { skipped: "abandoned-cart-disabled" };
  }
  if (!process.env.GHL_API_TOKEN) {
    return { skipped: "ghl-not-configured" };
  }

  const minutes = parseInt(process.env.ABANDONED_CART_MINUTES, 10) || 60;
  const max = parseInt(process.env.ABANDONED_CART_MAX, 10) || 200;
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  // Same shape as routes/cart.js GET /cart/abandoned: active cart, has items,
  // no item touched within the idle window.
  const carts = await prisma.cart.findMany({
    where: {
      isActive: true,
      items: {
        some: {},
        none: { updatedAt: { gte: cutoff } },
      },
    },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          mobile: true,
          // brand lives on the linked User, not the Customer
          user: { select: { brand: true } },
        },
      },
      items: { select: { unitPrice: true, quantity: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: max + 1,
  });

  const capped = carts.length > max;
  const batch = capped ? carts.slice(0, max) : carts;

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const cart of batch) {
    // Re-arm guard: only fire on first abandonment or after fresh activity.
    if (cart.abandonedSyncedAt && cart.abandonedSyncedAt >= cart.updatedAt) {
      skipped++;
      continue;
    }
    const c = cart.customer;
    if (!c || !c.email) {
      skipped++;
      continue;
    }
    try {
      await syncAbandonedCart({
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        mobile: c.mobile,
        brand: c.user?.brand || null,
        cartValue: cartValue(cart.items),
      });
      await prisma.cart.update({
        where: { id: cart.id },
        data: { abandonedSyncedAt: new Date() },
      });
      synced++;
    } catch (err) {
      errors++;
      logger.warn(
        `[abandoned-cart] sync failed for cart ${cart.id}: ${err.message}`,
      );
    }
  }

  if (capped) {
    logger.warn(
      `[abandoned-cart] processed ${max} carts this run but more remain (cap ABANDONED_CART_MAX=${max}); they will be picked up next run`,
    );
  }

  return { synced, skipped, errors, capped };
}

module.exports = { run };
