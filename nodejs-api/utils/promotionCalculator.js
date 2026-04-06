const prisma = require('../prisma/client');

/**
 * Calculate discount for a promotion based on order items
 * @param {Object} promotion - The promotion object with rules
 * @param {Array} orderItems - Array of order items
 * @param {Object} customer - Customer object
 * @param {Number} subtotal - Order subtotal
 * @param {Number} shippingAmount - Shipping amount
 * @returns {Object} - Discount calculation result
 */
async function calculatePromotionDiscount(promotion, orderItems, customer, subtotal, shippingAmount = 0) {
  // Check customer eligibility
  if (!isCustomerEligible(promotion, customer)) {
    return { discount: 0, error: 'Customer not eligible for this promotion' };
  }

  // Check minimum order amount
  if (promotion.minOrderAmount && subtotal < parseFloat(promotion.minOrderAmount)) {
    return { discount: 0, error: `Minimum order amount of $${promotion.minOrderAmount} required` };
  }

  let discount = 0;
  let appliedItems = [];

  switch (promotion.type) {
    case 'PERCENTAGE':
      discount = calculatePercentageDiscount(promotion, subtotal);
      break;

    case 'FIXED_AMOUNT':
      discount = calculateFixedAmountDiscount(promotion, subtotal);
      break;

    case 'FREE_SHIPPING':
      discount = shippingAmount;
      break;

    case 'BOGO':
      const bogoResult = await calculateBogoDiscount(promotion, orderItems);
      discount = bogoResult.discount;
      appliedItems = bogoResult.appliedItems;
      break;

    case 'VOLUME_DISCOUNT':
      const volumeResult = await calculateVolumeDiscount(promotion, orderItems);
      discount = volumeResult.discount;
      appliedItems = volumeResult.appliedItems;
      break;

    default:
      return { discount: 0, error: 'Unknown promotion type' };
  }

  // Apply maximum discount limit
  if (promotion.maxDiscount) {
    discount = Math.min(discount, parseFloat(promotion.maxDiscount));
  }

  // Don't exceed subtotal
  discount = Math.min(discount, subtotal);

  return {
    discount: Math.max(0, discount),
    appliedItems,
    promotionId: promotion.id,
    promotionCode: promotion.code
  };
}

/**
 * Check if customer is eligible for promotion
 */
function isCustomerEligible(promotion, customer) {
  // Check if customer is eligible for promotion
  console.log(`Checking eligibility for promo ${promotion.code}. IsIndiv: ${promotion.isForIndividualCustomer} Cust: ${customer?.id}`);

  // ROBUST LOGIC: Treat as Private if Flag is True OR if Specific Customers are defined
  const hasSpecificCustomers = promotion.specificCustomers && promotion.specificCustomers.length > 0;

  if (promotion.isForIndividualCustomer || hasSpecificCustomers) {
    if (!customer) {
      console.log('❌ Eligibility failed: Private coupon but no customer provided');
      return false;
    }

    // Check if customer ID is in specificCustomers list
    // Handle specificCustomers whether it's an array of objects or IDs (depending on how it was loaded)
    const specificCustomers = promotion.specificCustomers || [];
    const allowedIds = specificCustomers.map(sc => sc.customerId || sc);

    const isAllowed = allowedIds.includes(customer.id);
    if (!isAllowed) {
      console.log(`❌ Eligibility failed: Customer ${customer.id} not in allowed list [${allowedIds.join(', ')}]`);
    } else {
      console.log(`✅ Eligibility passed: Customer ${customer.id} is in allowed list`);
    }

    if (!isAllowed) {
      return false;
    }
  }

  // If no customer type restrictions, all customers are eligible (unless individual restricted)
  if (!promotion.customerTypes || promotion.customerTypes.length === 0) {
    return true;
  }

  // Check if customer type is in allowed types
  if (customer && customer.customerType) {
    return promotion.customerTypes.includes(customer.customerType);
  }

  return false;
}

/**
 * Calculate percentage discount
 */
function calculatePercentageDiscount(promotion, subtotal) {
  return subtotal * (parseFloat(promotion.value) / 100);
}

/**
 * Calculate fixed amount discount
 */
function calculateFixedAmountDiscount(promotion, subtotal) {
  return Math.min(parseFloat(promotion.value), subtotal);
}

/**
 * Calculate BOGO discount
 */
async function calculateBogoDiscount(promotion, orderItems) {
  // Get promotion rules
  const productRules = await prisma.promotionProductRule.findMany({
    where: { promotionId: promotion.id },
    include: {
      product: true,
      variant: true
    }
  });

  const categoryRules = await prisma.promotionCategoryRule.findMany({
    where: { promotionId: promotion.id },
    include: {
      category: true
    }
  });

  // Separate buy and get rules
  const buyRules = productRules.filter(rule => rule.ruleType === 'BUY');
  const getRules = productRules.filter(rule => rule.ruleType === 'GET');

  // If no specific rules, apply to all items
  if (buyRules.length === 0 && getRules.length === 0) {
    return calculateSimpleBogo(promotion, orderItems);
  }

  // Calculate complex BOGO with specific product rules
  return calculateComplexBogo(promotion, orderItems, buyRules, getRules, categoryRules);
}

/**
 * Calculate simple BOGO (no specific product rules)
 */
function calculateSimpleBogo(promotion, orderItems) {
  const buyQty = promotion.buyQuantity || 2; // Default to buy 2
  const getQty = promotion.getQuantity || 1;  // Default to get 1
  const getDiscount = promotion.getDiscount ? parseFloat(promotion.getDiscount) / 100 : 1; // Default 100% off

  let totalDiscount = 0;
  let appliedItems = [];

  // Calculate total quantity across all items
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate how many free items customer gets
  const freeItemsEarned = Math.floor(totalQuantity / buyQty) * getQty;

  if (freeItemsEarned > 0) {
    // Apply discount to cheapest items first
    const sortedItems = [...orderItems].sort((a, b) => parseFloat(a.unitPrice) - parseFloat(b.unitPrice));
    let remainingFreeItems = freeItemsEarned;

    for (const item of sortedItems) {
      if (remainingFreeItems <= 0) break;

      const freeQtyForThisItem = Math.min(remainingFreeItems, item.quantity);
      const discountPerItem = parseFloat(item.unitPrice) * getDiscount;
      const itemDiscount = freeQtyForThisItem * discountPerItem;

      totalDiscount += itemDiscount;
      appliedItems.push({
        variantId: item.variantId,
        quantity: freeQtyForThisItem,
        discount: itemDiscount
      });

      remainingFreeItems -= freeQtyForThisItem;
    }
  }

  return { discount: totalDiscount, appliedItems };
}

/**
 * Calculate complex BOGO with product-specific rules
 */
async function calculateComplexBogo(promotion, orderItems, buyRules, getRules, categoryRules) {
  // This is a simplified implementation
  // In a real-world scenario, this would be much more complex

  let totalDiscount = 0;
  let appliedItems = [];

  // For now, implement basic buy X get Y logic
  const buyQty = promotion.buyQuantity || 1;
  const getQty = promotion.getQuantity || 1;
  const getDiscount = promotion.getDiscount ? parseFloat(promotion.getDiscount) / 100 : 1;

  // Check if items match buy rules
  const eligibleBuyItems = orderItems.filter(item =>
    buyRules.some(rule =>
      (rule.variantId && rule.variantId === item.variantId) ||
      (rule.productId && item.variant?.productId === rule.productId)
    )
  );

  // Check if items match get rules (or use same items if no get rules)
  const eligibleGetItems = getRules.length > 0
    ? orderItems.filter(item =>
      getRules.some(rule =>
        (rule.variantId && rule.variantId === item.variantId) ||
        (rule.productId && item.variant?.productId === rule.productId)
      )
    )
    : eligibleBuyItems;

  // Calculate total buy quantity
  const totalBuyQty = eligibleBuyItems.reduce((sum, item) => sum + item.quantity, 0);
  const eligibleSets = Math.floor(totalBuyQty / buyQty);

  if (eligibleSets > 0 && eligibleGetItems.length > 0) {
    // Apply discount to get items
    let remainingGetQty = eligibleSets * getQty;

    for (const item of eligibleGetItems) {
      if (remainingGetQty <= 0) break;

      const discountQty = Math.min(remainingGetQty, item.quantity);
      const itemDiscount = discountQty * parseFloat(item.unitPrice) * getDiscount;

      totalDiscount += itemDiscount;
      appliedItems.push({
        variantId: item.variantId,
        quantity: discountQty,
        discount: itemDiscount
      });

      remainingGetQty -= discountQty;
    }
  }

  return { discount: totalDiscount, appliedItems };
}

/**
 * Calculate volume discount
 */
async function calculateVolumeDiscount(promotion, orderItems) {
  // Get volume tiers
  const volumeTiers = await prisma.promotionVolumeTier.findMany({
    where: { promotionId: promotion.id },
    orderBy: { minQuantity: 'asc' }
  });

  if (volumeTiers.length === 0) {
    // Fallback to simple percentage discount
    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = orderItems.reduce((sum, item) => sum + (item.quantity * parseFloat(item.unitPrice)), 0);

    return {
      discount: subtotal * (parseFloat(promotion.value) / 100),
      appliedItems: orderItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        discount: item.quantity * parseFloat(item.unitPrice) * (parseFloat(promotion.value) / 100)
      }))
    };
  }

  // Calculate total quantity
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Find applicable tier
  let applicableTier = null;
  for (const tier of volumeTiers) {
    if (totalQuantity >= tier.minQuantity &&
      (!tier.maxQuantity || totalQuantity <= tier.maxQuantity)) {
      applicableTier = tier;
    }
  }

  if (!applicableTier) {
    return { discount: 0, appliedItems: [] };
  }

  // Calculate discount based on tier
  let totalDiscount = 0;
  let appliedItems = [];

  for (const item of orderItems) {
    let itemDiscount = 0;
    const itemSubtotal = item.quantity * parseFloat(item.unitPrice);

    switch (applicableTier.discountType) {
      case 'PERCENTAGE':
        itemDiscount = itemSubtotal * (parseFloat(applicableTier.discountValue) / 100);
        break;
      case 'FIXED_AMOUNT':
        itemDiscount = Math.min(parseFloat(applicableTier.discountValue), itemSubtotal);
        break;
      case 'FIXED_PRICE':
        const newPrice = parseFloat(applicableTier.discountValue);
        itemDiscount = Math.max(0, itemSubtotal - (item.quantity * newPrice));
        break;
    }

    totalDiscount += itemDiscount;
    appliedItems.push({
      variantId: item.variantId,
      quantity: item.quantity,
      discount: itemDiscount
    });
  }

  return { discount: totalDiscount, appliedItems };
}

module.exports = {
  calculatePromotionDiscount,
  isCustomerEligible
};
