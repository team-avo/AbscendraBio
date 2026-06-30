/**
 * Public retail bulk-quantity discount tiers.
 *
 * A per-line-item quantity break (same product AND dosage) computed off the
 * REGULAR listed price. Intentionally SEPARATE from wholesale (account-based)
 * pricing — do not merge the two. The bands/percentages are uniform across the
 * whole catalog; only the base price varies per product.
 *
 *   qty 1-3  -> 0%   (regular listed price)
 *   qty 4-5  -> 10% off
 *   qty 6-9  -> 16% off
 *   qty 10+  -> 25% off
 */
const BULK_TIERS = [
  { min: 1, max: 3, discount: 0.0 },
  { min: 4, max: 5, discount: 0.1 },
  { min: 6, max: 9, discount: 0.16 },
  { min: 10, max: null, discount: 0.25 },
];

function bulkTierForQty(qty) {
  const q = Number(qty) || 0;
  return (
    BULK_TIERS.find((t) => q >= t.min && (t.max == null || q <= t.max)) ||
    BULK_TIERS[0]
  );
}

// Effective unit price = regular listed price * (1 - tier.discount).
function bulkUnitPrice(regularPrice, qty) {
  const base = Number(regularPrice) || 0;
  return base * (1 - bulkTierForQty(qty).discount);
}

// Retail buyers only (B2C / guest). Wholesale/enterprise account pricing is
// excluded so the two systems stay distinct.
function isRetailPricing(pricingCustomerType) {
  return !pricingCustomerType || pricingCustomerType === "B2C";
}

module.exports = { BULK_TIERS, bulkTierForQty, bulkUnitPrice, isRetailPricing };
