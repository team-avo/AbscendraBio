const axios = require("axios");
const prisma = require("../prisma/client");

/**
 * Notify all active Sales Channels (with a webhookUrl configured) about
 * inventory changes for the given variant IDs.
 *
 * This is a fire-and-forget helper — it never throws. Errors are logged
 * per-channel so one failing webhook doesn't block the others.
 *
 * @param {string[]} variantIds - Array of ProductVariant IDs whose inventory changed
 */
async function notifySalesChannelWebhooks(variantIds) {
  if (!variantIds || variantIds.length === 0) return;

  try {
    // Find all active channels that have a webhook URL configured
    const channels = await prisma.salesChannel.findMany({
      where: {
        status: "ACTIVE",
        webhookUrl: { not: null },
      },
      select: {
        id: true,
        companyName: true,
        webhookUrl: true,
      },
    });

    if (channels.length === 0) return;

    // Fetch current inventory for the affected variants
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
      include: {
        inventory: true,
        product: { select: { id: true, name: true } },
      },
    });

    if (variants.length === 0) return;

    const payload = {
      type: "inventory_update",
      timestamp: new Date().toISOString(),
      inventory: variants.map((v) => ({
        variantId: v.id,
        sku: v.sku,
        productId: v.product?.id,
        productName: v.product?.name,
        quantity: (v.inventory || []).reduce(
          (sum, inv) => sum + ((inv.quantity || 0) - (inv.reservedQty || 0)),
          0,
        ),
      })),
    };

    // POST to each channel's webhook URL in parallel
    const results = await Promise.allSettled(
      channels.map(async (channel) => {
        try {
          await axios.post(channel.webhookUrl, payload, {
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
          });
          console.log(
            `[WEBHOOK] Inventory update sent to "${channel.companyName}" (${channel.id})`,
          );
        } catch (err) {
          console.error(
            `[WEBHOOK] Failed to notify "${channel.companyName}" (${channel.id}) at ${channel.webhookUrl}:`,
            err.message,
          );
        }
      }),
    );
  } catch (err) {
    console.error(
      "[WEBHOOK] Error in notifySalesChannelWebhooks:",
      err.message,
    );
  }
}

module.exports = { notifySalesChannelWebhooks };
