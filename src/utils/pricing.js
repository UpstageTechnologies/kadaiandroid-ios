/**
 * Canonical Pricing Utility for Kadai Mobile App
 *
 * Provides consistent pricing, discount calculations, strike-through amounts,
 * and badge formatting across all screens (Offers Carousel, Product Grids,
 * Product Details, Cross-Shop Recommendations, Cart, and Checkout).
 */

/**
 * Calculates effective selling price, strike-through original price,
 * discount amount, percentage, and user-facing badge.
 *
 * Rules:
 * 1. If originalSalesPrice (or mrp/regularPrice) > salesPrice (or price) > 0:
 *    - Selling price is already discounted.
 *    - Never apply a second discount on top of salesPrice.
 *    - Discount = originalSalesPrice - salesPrice.
 * 2. If discountValue > 0 and originalSalesPrice is set but salesPrice is not yet discounted:
 *    - Calculate salesPrice based on percentage or flat discount.
 * 3. If salesPrice > 0 and discountValue > 0 and originalSalesPrice is missing / <= salesPrice:
 *    - Derive originalPrice based on discountValue.
 * 4. If no valid discount exists:
 *    - Do not show strike-through price (originalPrice = 0).
 *    - Do not show 0% or empty badge (discountBadge = '', hasDiscount = false).
 * 5. Negative prices or selling price > original price after discount are prevented.
 *
 * @param {Object} product - Product or offer data object
 * @returns {Object} Effective pricing details
 */
export function calculateEffectivePricing(product) {
  if (!product || typeof product !== 'object') {
    return {
      price: 0,
      originalPrice: 0,
      hasDiscount: false,
      discountPercent: 0,
      discountAmount: 0,
      discountBadge: '',
      discountType: 'percentage',
      savings: 0,
      formattedPrice: '₹0',
      formattedOriginalPrice: '',
    };
  }

  const parseNum = val => {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const rawSalesPrice = parseNum(
    product.salesPrice ?? product.price ?? product.sellingPrice ?? 0,
  );
  const rawOriginalPrice = parseNum(
    product.originalSalesPrice ??
      product.mrp ??
      product.originalPrice ??
      product.regularPrice ??
      0,
  );
  const rawDiscountVal = parseNum(
    product.discountValue ?? product.discount ?? 0,
  );
  const discountType = String(
    product.discountType || product.discount_type || 'percentage',
  )
    .toLowerCase()
    .trim();

  let price = rawSalesPrice;
  let originalPrice = rawOriginalPrice;
  let discountPercent = 0;
  let discountAmount = 0;
  let discountBadge = '';
  let hasDiscount = false;

  // Case 1: originalPrice > salesPrice > 0 (salesPrice already reflects the discount)
  if (originalPrice > 0 && price > 0 && originalPrice > price) {
    discountAmount = originalPrice - price;
    discountPercent = Math.round((discountAmount / originalPrice) * 100);
    hasDiscount = discountAmount > 0 && discountPercent > 0;

    if (hasDiscount) {
      if (
        discountType === 'flat' ||
        discountType === 'fixed' ||
        discountType === 'amount'
      ) {
        discountBadge = `₹${Math.round(discountAmount)} OFF`;
      } else {
        discountBadge = `${discountPercent}% OFF`;
      }
    }
  }
  // Case 2: originalPrice > 0, discountValue > 0, and salesPrice is not discounted yet
  else if (
    originalPrice > 0 &&
    rawDiscountVal > 0 &&
    (price === 0 || price >= originalPrice)
  ) {
    if (
      discountType === 'percentage' ||
      discountType === 'percent'
    ) {
      if (rawDiscountVal > 0 && rawDiscountVal < 100) {
        price = Math.max(1, Math.round(originalPrice * (1 - rawDiscountVal / 100)));
        discountAmount = originalPrice - price;
        discountPercent = Math.round(rawDiscountVal);
        hasDiscount = true;
        discountBadge = `${discountPercent}% OFF`;
      }
    } else if (
      discountType === 'flat' ||
      discountType === 'fixed' ||
      discountType === 'amount'
    ) {
      if (rawDiscountVal > 0 && rawDiscountVal < originalPrice) {
        price = Math.max(1, originalPrice - rawDiscountVal);
        discountAmount = rawDiscountVal;
        discountPercent = Math.round((discountAmount / originalPrice) * 100);
        hasDiscount = true;
        discountBadge = `₹${Math.round(discountAmount)} OFF`;
      }
    }
  }
  // Case 3: price > 0, discountValue > 0, but originalPrice is missing or <= price
  else if (
    price > 0 &&
    rawDiscountVal > 0 &&
    (originalPrice === 0 || originalPrice <= price)
  ) {
    if (
      discountType === 'percentage' ||
      discountType === 'percent'
    ) {
      if (rawDiscountVal > 0 && rawDiscountVal < 100) {
        originalPrice = Math.round((price / (100 - rawDiscountVal)) * 100);
        discountAmount = originalPrice - price;
        discountPercent = Math.round(rawDiscountVal);
        hasDiscount = discountAmount > 0 && discountPercent > 0;
        if (hasDiscount) {
          discountBadge = `${discountPercent}% OFF`;
        }
      }
    } else if (
      discountType === 'flat' ||
      discountType === 'fixed' ||
      discountType === 'amount'
    ) {
      originalPrice = price + rawDiscountVal;
      discountAmount = rawDiscountVal;
      discountPercent = Math.round((discountAmount / originalPrice) * 100);
      hasDiscount = discountAmount > 0 && discountPercent > 0;
      if (hasDiscount) {
        discountBadge = `₹${Math.round(discountAmount)} OFF`;
      }
    }
  }

  // Fallback: If no valid discount was identified
  if (!hasDiscount || price <= 0 || originalPrice <= price) {
    price = price > 0 ? price : (originalPrice > 0 ? originalPrice : 0);
    originalPrice = 0;
    discountAmount = 0;
    discountPercent = 0;
    discountBadge = '';
    hasDiscount = false;
  }

  // Ensure positive values
  price = Math.max(0, price);
  originalPrice = Math.max(0, originalPrice);
  discountAmount = Math.max(0, discountAmount);
  discountPercent = Math.max(0, discountPercent);

  return {
    price,
    originalPrice,
    hasDiscount,
    discountPercent,
    discountAmount,
    discountBadge,
    discountType,
    savings: discountAmount,
    formattedPrice: `₹${Number(price || 0).toLocaleString('en-IN')}`,
    formattedOriginalPrice:
      hasDiscount && originalPrice > price
        ? `₹${Number(originalPrice).toLocaleString('en-IN')}`
        : '',
  };
}

/**
 * Format currency in Indian Rupees
 * @param {number} val
 * @returns {string} e.g. "₹1,250"
 */
export function formatCurrency(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default {
  calculateEffectivePricing,
  formatCurrency,
};
