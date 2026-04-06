/**
 * Discount utility functions for high-value purchases
 */

export interface DiscountInfo {
  isEligible: boolean;
  discountPercentage: number;
  discountAmount: number;
  originalTotal: number;
  discountedTotal: number;
}

/**
 * Calculate discount for high-value purchases
 * @param subtotal - The subtotal amount before any discounts
 * @returns Discount information
 */
export function calculateHighValueDiscount(subtotal: number, isB2B: boolean): DiscountInfo {
  const MINIMUM_AMOUNT = 5000; // $5000 minimum for discount
  const FIXED_DISCOUNT = 10; // fixed 10% discount per requirement

  // Only Tier 2 users (B2B) are eligible
  const meetsAmountThreshold = subtotal >= MINIMUM_AMOUNT;
  const isEligible = isB2B && meetsAmountThreshold;

  if (!isEligible) {
    return {
      isEligible: false,
      discountPercentage: 0,
      discountAmount: 0,
      originalTotal: subtotal,
      discountedTotal: subtotal,
    };
  }
  
  // Fixed 10% discount for orders >= $5000
  const discountPercentage = FIXED_DISCOUNT;
  const discountAmount = (subtotal * discountPercentage) / 100;
  const discountedTotal = subtotal - discountAmount;
  
  return {
    isEligible: true,
    discountPercentage: Math.round(discountPercentage * 100) / 100, // Round to 2 decimal places
    discountAmount: Math.round(discountAmount * 100) / 100,
    originalTotal: subtotal,
    discountedTotal: Math.round(discountedTotal * 100) / 100,
  };
}

/**
 * Format discount percentage for display
 */
export function formatDiscountPercentage(percentage: number): string {
  return `${percentage}%`;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
