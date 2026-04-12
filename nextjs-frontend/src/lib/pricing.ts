/**
 * Standard utility for calculating product prices based on customer type.
 * Ensures consistent pricing across Catalog, Carousels, and Detail Views.
 */

export type CustomerType = 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2';

export interface PriceResult {
  price: number;
  original?: number | null;
}

export function priceForCustomerType(
  product: any,
  customerType?: CustomerType
): PriceResult {
  // Extract variants (checking multiple possible data structures from API)
  const variants = product._variantsPricing || product.variants || [];
  const variant = variants[0];

  // FALLBACK: If no variants exist, use product-level pricing
  if (!variant) {
    return {
      price: Number(product.price || product.basePrice || 0),
      original: product.originalPrice ? Number(product.originalPrice) : null
    };
  }

  // Segment Pricing Logic
  if (customerType && variant.segmentPrices) {
    let targetType = customerType;
    
    // Internal Mapping Logic:
    // B2B customers see B2C pricing
    // ENTERPRISE_2 customers see ENTERPRISE_1 pricing
    if (targetType === 'B2B') targetType = 'B2C';
    if (targetType === 'ENTERPRISE_2') targetType = 'ENTERPRISE_1';

    const seg = variant.segmentPrices.find((sp: any) => sp.customerType === targetType);
    if (seg) {
      const price = seg.salePrice && seg.salePrice > 0 ? Number(seg.salePrice) : Number(seg.regularPrice);
      return { price, original: null };
    }
  }

  // Default Variant Pricing
  const regularPrice = Number(variant.regularPrice ?? product.basePrice ?? 0);
  const salePrice = Number(variant.salePrice ?? regularPrice);

  return {
    price: salePrice,
    original: salePrice < regularPrice ? regularPrice : null
  };
}
