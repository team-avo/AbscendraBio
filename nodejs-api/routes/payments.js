const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { ssRequest } = require("../utils/shipstationClient");
const {
  requireRole,
  requirePermission,
  optionalAuth,
} = require("../middleware/auth");
const {
  findOptimalWarehouse,
  reserveInventoryFromWarehouse,
} = require("../services/warehouseService");

/**
 * Build denormalized address snapshot fields for an order.
 */
const buildAddressSnapshot = (address, prefix) => {
  if (!address) return {};
  return {
    [`${prefix}FirstName`]: address.firstName || null,
    [`${prefix}LastName`]: address.lastName || null,
    [`${prefix}Company`]: address.company || null,
    [`${prefix}Address1`]: address.address1 || null,
    [`${prefix}Address2`]: address.address2 || null,
    [`${prefix}City`]: address.city || null,
    [`${prefix}State`]: address.state || null,
    [`${prefix}PostalCode`]: address.postalCode || null,
    [`${prefix}Country`]: address.country || null,
    [`${prefix}Phone`]: address.phone || null,
  };
};
const { queueProductSync } = require("../integrations/skydell_odoo");

const router = express.Router();

// Simple credentials verification against Authorize.Net authenticateTestRequest
router.post(
  "/authorize/test-credentials",
  optionalAuth,
  [
    body("apiLoginId").optional().isString(),
    body("transactionKey").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const apiLoginId = (
      req.body.apiLoginId ||
      process.env.ANET_API_LOGIN_ID ||
      ""
    ).trim();
    const transactionKey = (
      req.body.transactionKey ||
      process.env.ANET_TRANSACTION_KEY ||
      ""
    ).trim();
    const endpoint =
      process.env.ANET_ENV === "production"
        ? "https://api2.authorize.net/xml/v1/request.api"
        : "https://apitest.authorize.net/xml/v1/request.api";

    if (!apiLoginId || !transactionKey) {
      return res.status(400).json({
        success: false,
        error: "Missing API Login ID or Transaction Key",
      });
    }

    const shortRefId = `auth-${Date.now().toString().slice(-12)}`.slice(0, 20);
    const payload = {
      authenticateTestRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey,
        },
        refId: shortRefId,
      },
    };

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      const ok = data?.messages?.resultCode === "Ok";
      return res.json({
        success: ok,
        data,
        error: ok
          ? undefined
          : data?.messages?.message?.[0]?.text || "Authentication failed",
      });
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Failed to reach Authorize.Net",
        details: String(e),
      });
    }
  }),
);

// Public config for Accept.js (safe to expose clientKey + apiLoginId via backend)
router.get(
  "/authorize/public-config",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const apiLoginId = (process.env.ANET_API_LOGIN_ID || "").trim();
    const clientKey = (process.env.ANET_CLIENT_KEY || "").trim();
    const env = (process.env.ANET_ENV || "sandbox").toLowerCase();

    if (!apiLoginId || !clientKey) {
      return res.status(500).json({
        success: false,
        error: "Authorize.Net public configuration missing",
        debug: {
          apiLoginIdMissing: !apiLoginId,
          clientKeyMissing: !clientKey,
          nodeEnv: process.env.NODE_ENV,
          anetEnv: process.env.ANET_ENV,
        },
      });
    }

    return res.json({ success: true, data: { apiLoginId, clientKey, env } });
  }),
);

// Authorize card directly with Authorize.Net API (without Accept.js)
router.post(
  "/authorize-card",
  optionalAuth,
  [
    body("orderId").isString().optional(),
    body("amount")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Amount must be a valid decimal"),
    body("cardNumber").isString().withMessage("Card number is required"),
    body("expirationDate")
      .isString()
      .withMessage("Expiration date is required"),
    body("cardCode").isString().withMessage("Card code (CVV) is required"),
    body("cardholderName").isString().optional(),
    body("billingAddress").optional().isObject(),
    body("shippingAddress").optional().isObject(),
    body("shippingAmount").optional().isDecimal({ decimal_digits: "0,2" }),
    body("paymentFeePct").optional().isFloat({ min: 0, max: 100 }),
    body("discountAmount").optional().isDecimal({ decimal_digits: "0,2" }),
    body("subtotal").optional().isDecimal({ decimal_digits: "0,2" }),
    body("taxAmount").optional().isDecimal({ decimal_digits: "0,2" }),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      orderId,
      amount,
      cardNumber,
      expirationDate,
      cardCode,
      cardholderName,
      billingAddress,
      shippingAddress,
      shippingAmount,
      paymentFeePct,
      discountAmount,
      subtotal,
      taxAmount,
    } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Check for duplicate transactions within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const duplicateTransaction = await prisma.transaction.findFirst({
      where: {
        amount: parseFloat(amount),
        paymentGatewayName: "AUTHORIZE_NET",
        createdAt: {
          gte: fiveMinutesAgo,
        },
        paymentGatewayResponse: {
          contains: cardNumber.slice(-4), // Check if last 4 digits match
        },
      },
    });

    if (duplicateTransaction) {
      return res.status(400).json({
        success: false,
        error:
          "Duplicate transaction detected. Please wait a moment before trying again.",
      });
    }

    // Verify order if orderId provided, or prepare order data if not provided (but don't create yet)
    let order = null;
    let orderDataToCreate = null; // Store order data to create after successful payment
    let cart = null;

    if (orderId) {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found" });
      }
      // Verify customer owns this order
      if (
        req.user.role === "CUSTOMER" &&
        req.user.customerId !== order.customerId
      ) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: cannot pay for this order",
        });
      }
    } else {
      // Prepare order data from cart if no orderId provided (but don't create it yet)
      if (!req.user.customerId) {
        // Fallback: If role is CUSTOMER but customerId is missing, try to find by email
        if (req.user.role === "CUSTOMER") {
          const fallbackCustomer = await prisma.customer.findFirst({
            where: { email: req.user.email },
          });
          if (fallbackCustomer) {
            req.user.customerId = fallbackCustomer.id;
          }
        }

        if (!req.user.customerId) {
          return res.status(400).json({
            success: false,
            error: "Customer ID required for payment without order",
          });
        }
      }

      // Get customer data
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.customerId },
      });

      if (!customer) {
        return res
          .status(404)
          .json({ success: false, error: "Customer not found" });
      }

      // Get cart items with bulk pricing data
      cart = await prisma.cart.findFirst({
        where: { customerId: req.user.customerId, isActive: true },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                  bulkPrices: {
                    orderBy: { minQty: "asc" },
                  },
                },
              },
            },
          },
        },
      });

      if (!cart || !cart.items.length) {
        return res.status(400).json({ success: false, error: "Cart is empty" });
      } else {
        // Calculate order totals with bulk pricing
        let cartSubtotal = 0;
        const orderItems = cart.items.map((item) => {
          // Check for bulk pricing
          let effectiveUnitPrice = parseFloat(item.unitPrice);
          let bulkUnitPrice = null;
          let bulkTotalPrice = null;

          if (
            item.variant?.bulkPrices &&
            Array.isArray(item.variant.bulkPrices)
          ) {
            const applicableBulk = item.variant.bulkPrices.find((bp) => {
              const minQty = Number(bp.minQty);
              const maxQty = bp.maxQty ? Number(bp.maxQty) : Infinity;
              return item.quantity >= minQty && item.quantity <= maxQty;
            });

            if (applicableBulk) {
              effectiveUnitPrice = Number(applicableBulk.price);
              bulkUnitPrice = effectiveUnitPrice;
              bulkTotalPrice = effectiveUnitPrice * item.quantity;
            }
          }

          const itemTotal = effectiveUnitPrice * item.quantity;
          cartSubtotal += itemTotal;

          return {
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice), // Keep regular price for comparison
            totalPrice: parseFloat(item.unitPrice) * item.quantity, // Regular total
            ...(bulkUnitPrice !== null
              ? { bulkUnitPrice, bulkTotalPrice }
              : {}),
          };
        });

        const isB2B = customer.customerType === "B2B";
        const highValueDiscount =
          isB2B && cartSubtotal >= 5000 ? cartSubtotal * 0.1 : 0;

        // Use coupon discount from request if provided, otherwise use high-value discount
        const finalDiscountAmount =
          discountAmount !== undefined && discountAmount > 0
            ? Math.round(parseFloat(String(discountAmount)) * 100) / 100
            : Math.round(highValueDiscount * 100) / 100;

        const finalSubtotal = cartSubtotal - finalDiscountAmount;
        const resolvedTaxAmount =
          taxAmount !== undefined
            ? Math.round(parseFloat(String(taxAmount)) * 100) / 100
            : 0;

        // Calculate dynamic shipping cost for all orders
        let resolvedShipping = 0; // Default fallback to 0

        // Look up dynamic tiers
        const matchedTier = await prisma.shippingTier.findFirst({
          where: {
            isActive: true,
            minSubtotal: { lte: finalSubtotal },
            OR: [{ maxSubtotal: null }, { maxSubtotal: { gt: finalSubtotal } }],
          },
          orderBy: { minSubtotal: "desc" }, // Most specific range first
        });

        if (matchedTier) {
          resolvedShipping = parseFloat(matchedTier.shippingRate);
        }

        // Override with manual shipping amount if provided
        if (
          typeof shippingAmount === "string" ||
          typeof shippingAmount === "number"
        ) {
          resolvedShipping = parseFloat(String(shippingAmount));
        }
        const feeBase =
          Math.round(
            (finalSubtotal + resolvedTaxAmount + resolvedShipping) * 100,
          ) / 100;
        const paymentFee = paymentFeePct
          ? Math.round(feeBase * Number(paymentFeePct)) / 100
          : 0;
        const totalAmount = Math.round((feeBase + paymentFee) * 100) / 100;

        // Prepare order data (but don't create it yet)
        orderDataToCreate = {
          customerId: req.user.customerId,
          userId: req.user.id,
          status: "PROCESSING", // Will be set to PROCESSING after successful payment
          subtotal: cartSubtotal,
          totalAmount: totalAmount,
          taxAmount: resolvedTaxAmount,
          shippingAmount: resolvedShipping,
          discountAmount: finalDiscountAmount,
          billingAddress: {
            customerId: req.user.customerId,
            type: "BILLING",
            firstName:
              billingAddress?.firstName || customer.firstName || "Temp",
            lastName:
              billingAddress?.lastName || customer.lastName || "Customer",
            company: billingAddress?.company || customer.companyName || "",
            address1: billingAddress?.addressLine1 || "Temporary Address",
            address2: billingAddress?.addressLine2 || "",
            city: billingAddress?.city || "Temporary City",
            state: billingAddress?.state || "CA",
            postalCode: billingAddress?.postalCode || "00000",
            country: billingAddress?.country || "US",
            phone: billingAddress?.phoneNumber || customer.mobile || "",
            isDefault: false,
          },
          shippingAddress: {
            customerId: req.user.customerId,
            type: "SHIPPING",
            firstName:
              shippingAddress?.firstName ||
              billingAddress?.firstName ||
              customer.firstName ||
              "Temp",
            lastName:
              shippingAddress?.lastName ||
              billingAddress?.lastName ||
              customer.lastName ||
              "Customer",
            company:
              shippingAddress?.company ||
              billingAddress?.company ||
              customer.companyName ||
              "",
            address1:
              shippingAddress?.addressLine1 ||
              billingAddress?.addressLine1 ||
              "Temporary Address",
            address2:
              shippingAddress?.addressLine2 ||
              billingAddress?.addressLine2 ||
              "",
            city:
              shippingAddress?.city || billingAddress?.city || "Temporary City",
            state: shippingAddress?.state || billingAddress?.state || "CA",
            postalCode:
              shippingAddress?.postalCode ||
              billingAddress?.postalCode ||
              "00000",
            country:
              shippingAddress?.country || billingAddress?.country || "US",
            phone:
              shippingAddress?.phoneNumber ||
              billingAddress?.phoneNumber ||
              customer.mobile ||
              "",
            isDefault: false,
          },
          items: orderItems,
          cartId: cart.id, // Store cart ID to clear it after order creation
          paymentFee: paymentFeePct
            ? {
                percentage: Number(paymentFeePct),
                amount: paymentFee,
              }
            : null,
        };
      }
    }

    // Authorize.Net credentials and endpoint
    const apiLoginId = (process.env.ANET_API_LOGIN_ID || "").trim();
    const transactionKey = (process.env.ANET_TRANSACTION_KEY || "").trim();
    const endpoint =
      process.env.ANET_ENV === "production"
        ? "https://api2.authorize.net/xml/v1/request.api"
        : "https://apitest.authorize.net/xml/v1/request.api";

    if (!apiLoginId || !transactionKey) {
      return res.status(500).json({
        success: false,
        error: "Authorize.Net credentials are not configured",
      });
    }

    // Generate unique reference ID to prevent duplicates (max 20 chars for Authorize.Net)
    const refId = `txn-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6)}`;

    // Log received billing address from frontend
    console.log(
      "[Authorize.Net] Received billingAddress from frontend:",
      JSON.stringify(billingAddress, null, 2),
    );

    // Prepare billing address
    const billTo = billingAddress
      ? {
          firstName: billingAddress.firstName || "",
          lastName: billingAddress.lastName || "",
          company: billingAddress.company || "",
          address: billingAddress.addressLine1 || "",
          city: billingAddress.city || "",
          state: billingAddress.state || "",
          zip: billingAddress.postalCode || "",
          country: billingAddress.country || "US",
          phoneNumber: billingAddress.phoneNumber || "",
        }
      : null;

    const shipTo = shippingAddress
      ? {
          firstName: shippingAddress.firstName || "",
          lastName: shippingAddress.lastName || "",
          company: shippingAddress.company || "",
          address: shippingAddress.addressLine1 || "",
          city: shippingAddress.city || "",
          state: shippingAddress.state || "",
          zip: shippingAddress.postalCode || "",
          country: shippingAddress.country || "US",
        }
      : null;

    console.log(
      "[Authorize.Net] Constructed billTo object:",
      JSON.stringify(billTo, null, 2),
    );

    // Prepare line items for Authorize.Net
    const lineItems = [];
    try {
      const sourceItems = order ? order.items : cart ? cart.items : [];
      if (sourceItems && sourceItems.length > 0) {
        sourceItems.forEach((item) => {
          const variant = item.variant;
          const product = variant?.product;
          // Calculate unit price - use effective price (bulk/sale) if available via orderDataToCreate logic,
          // but for now we'll use the unitPrice stored in item (cart/order).
          // Authorize.Net expects strictly formatted values.

          let price = item.unitPrice;
          // If it's a cart item, unitPrice is a Decimal/string.

          // Truncate name/description to meet Authorize.Net limits (31 chars for id, 31 for name, 255 for desc)
          lineItems.push({
            itemId: (variant?.sku || item.variantId).substring(0, 31),
            name: (product?.name || variant?.name || "Item").substring(0, 31),
            description: (variant?.name || "").substring(0, 255),
            quantity: String(item.quantity),
            unitPrice: parseFloat(String(price)).toFixed(2),
          });
        });
      }
    } catch (err) {
      console.error("Error preparing line items:", err);
    }

    // Prepare tax and shipping objects
    // Use orderDataToCreate values if available (calculated from cart), otherwise req.body values

    // Resolve amounts
    let resolvedShippingAmount = shippingAmount;
    let resolvedTaxAmount = taxAmount;

    if (orderDataToCreate) {
      resolvedShippingAmount = orderDataToCreate.shippingAmount;
      resolvedTaxAmount = orderDataToCreate.taxAmount;
    } else if (order) {
      resolvedShippingAmount = order.shippingAmount;
      resolvedTaxAmount = order.taxAmount;
    }

    const taxDetails =
      resolvedTaxAmount && parseFloat(String(resolvedTaxAmount)) > 0
        ? {
            amount: parseFloat(String(resolvedTaxAmount)).toFixed(2),
            name: "Tax",
            description: "Order Tax",
          }
        : undefined;

    const shippingDetails =
      resolvedShippingAmount && parseFloat(String(resolvedShippingAmount)) > 0
        ? {
            amount: parseFloat(String(resolvedShippingAmount)).toFixed(2),
            name: "Shipping",
            description: "Shipping Charge",
          }
        : undefined;

    // Prepare customer info for Authorize.Net
    // Note: Authorize.Net limits Customer ID to 20 characters.
    const customerIdVal = (
      order?.customerId ||
      req.user.customerId ||
      ""
    ).substring(0, 20);
    const customerEmailVal = (
      order?.customer?.email ||
      req.user.email ||
      ""
    ).substring(0, 255);

    const customerInfo = {};
    if (customerIdVal) customerInfo.id = customerIdVal;
    if (customerEmailVal) customerInfo.email = customerEmailVal;

    // Build Authorize.Net request payload - minimal valid structure
    const requestPayload = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey,
        },
        refId: refId,
        transactionRequest: {
          transactionType: "authCaptureTransaction", // Authorize and capture immediately
          amount: parseFloat(amount).toFixed(2),
          payment: {
            creditCard: {
              cardNumber: cardNumber.replace(/\s/g, ""),
              expirationDate: expirationDate,
              cardCode: cardCode,
            },
          },
          ...(lineItems.length > 0
            ? { lineItems: { lineItem: lineItems } }
            : {}),
          ...(taxDetails ? { tax: taxDetails } : {}),
          ...(shippingDetails ? { shipping: shippingDetails } : {}),
          ...(Object.keys(customerInfo).length > 0
            ? { customer: customerInfo }
            : {}), // customer must be before billTo
          ...(billTo ? { billTo } : {}),
          ...(shipTo ? { shipTo } : {}),
          customerIP: req.ip || "127.0.0.1",
        },
      },
    };

    // Log the full request payload (mask card number for security)
    const maskedPayload = JSON.parse(JSON.stringify(requestPayload));
    if (
      maskedPayload.createTransactionRequest?.transactionRequest?.payment
        ?.creditCard?.cardNumber
    ) {
      const cardNum =
        maskedPayload.createTransactionRequest.transactionRequest.payment
          .creditCard.cardNumber;
      maskedPayload.createTransactionRequest.transactionRequest.payment.creditCard.cardNumber =
        "****" + cardNum.slice(-4);
    }
    console.log(
      "[Authorize.Net] Full request payload being sent:",
      JSON.stringify(maskedPayload, null, 2),
    );

    try {
      // Call Authorize.Net API
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const gatewayResponse = await resp.json();

      // Log the full response from Authorize.Net
      console.log(
        "[Authorize.Net] Full response received:",
        JSON.stringify(gatewayResponse, null, 2),
      );

      /**
       * Authorize.Net Response Codes:
       * 1   - Approved
       * 2   - Declined
       * 3   - Error
       * 4   - Held for Review
       * 252 - Authorized/Pending Review (transaction authorized but held)
       * 253 - Pending (transaction is pending)
       *
       * AVS Result Codes:
       * Y - Address and ZIP match
       * X - Address and 9-digit ZIP match
       * A - Address matches, ZIP does not
       * Z - ZIP matches, address does not
       * N - Neither address nor ZIP match
       *
       * CVV Result Codes:
       * M - Match
       * N - No match
       * P - Not processed
       * S - Should be on card but not indicated
       * U - Issuer unable to process
       */

      const resultCode = gatewayResponse?.messages?.resultCode;
      const trans = gatewayResponse?.transactionResponse;
      const transId = trans?.transId || null;
      const responseCode = trans?.responseCode;
      const authCode = trans?.authCode;

      const gatewaySummary = {
        resultCode,
        responseCode,
        transId,
        authCode,
        message:
          trans?.messages?.[0]?.description ||
          gatewayResponse?.messages?.message?.[0]?.text,
        error:
          trans?.errors?.[0]?.errorText ||
          gatewayResponse?.messages?.message?.[0]?.text,
        avsResultCode: trans?.avsResultCode,
        cvvResultCode: trans?.cvvResultCode,
      };

      // More comprehensive approval check to handle all successful transaction states
      const isApproved =
        resultCode === "Ok" &&
        transId &&
        (String(responseCode) === "1" || // Approved
          String(responseCode) === "4" || // Held for review
          String(responseCode) === "252" || // Authorized/Pending Review
          String(responseCode) === "253"); // Pending

      // Add detailed logging for monitoring and debugging
      console.log("[Authorize.Net] Transaction validation:", {
        resultCode,
        responseCode,
        transId,
        authCode,
        isApproved,
        avsResult: trans?.avsResultCode,
        cvvResult: trans?.cvvResultCode,
        hasErrors: Boolean(trans?.errors?.length),
        errorText: trans?.errors?.[0]?.errorText,
      });

      // Log AVS/CVV warnings for approved transactions
      if (isApproved) {
        // AVS: Only Y and X indicate full address+ZIP match. Other codes like A, Z, N, P, U
        // may indicate partial matches or unverified data and should be logged for review.
        // Business may adjust accepted codes based on fraud tolerance.
        if (trans?.avsResultCode && !["Y", "X"].includes(trans.avsResultCode)) {
          console.warn("[Authorize.Net] AVS validation warning:", {
            orderId: orderId || "new-order",
            avsResultCode: trans.avsResultCode,
            transId,
          });
        }
        // CVV: Only M indicates a match. Other codes warrant logging for fraud review.
        if (trans?.cvvResultCode && !["M"].includes(trans.cvvResultCode)) {
          console.warn("[Authorize.Net] CVV validation warning:", {
            orderId: orderId || "new-order",
            cvvResultCode: trans.cvvResultCode,
            transId,
          });
        }
      }

      if (!isApproved) {
        const failureReason =
          gatewaySummary.error ||
          gatewaySummary.message ||
          "Payment authorization failed";

        if (!order && orderDataToCreate) {
          const tempBillingAddress = await prisma.address.create({
            data: orderDataToCreate.billingAddress,
          });

          const tempShippingAddress = await prisma.address.create({
            data: orderDataToCreate.shippingAddress,
          });

          const orderNumber = `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          order = await prisma.order.create({
            data: {
              customerId: orderDataToCreate.customerId,
              userId: orderDataToCreate.userId,
              orderNumber: orderNumber,
              status: "PENDING",
              subtotal: orderDataToCreate.subtotal,
              totalAmount: orderDataToCreate.totalAmount,
              taxAmount: orderDataToCreate.taxAmount,
              shippingAmount: orderDataToCreate.shippingAmount,
              discountAmount: orderDataToCreate.discountAmount,
              billingAddressId: tempBillingAddress.id,
              shippingAddressId: tempShippingAddress.id,
              ...buildAddressSnapshot(
                orderDataToCreate.billingAddress,
                "billing",
              ),
              ...buildAddressSnapshot(
                orderDataToCreate.shippingAddress,
                "shipping",
              ),
              ...(orderDataToCreate.items
                ? {
                    items: {
                      create: orderDataToCreate.items,
                    },
                  }
                : {}),
            },
            include: {
              customer: true,
              items: {
                include: {
                  variant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          });

          await prisma.orderNote.create({
            data: {
              orderId: order.id,
              userId: orderDataToCreate.userId,
              note: orderDataToCreate.note || "Order created from cart payment",
              isInternal: true,
            },
          });

          if (orderDataToCreate.paymentFee) {
            await prisma.orderNote.create({
              data: {
                orderId: order.id,
                userId: orderDataToCreate.userId,
                note: `Credit card fee applied: ${orderDataToCreate.paymentFee.percentage}% = $${orderDataToCreate.paymentFee.amount.toFixed(2)} (included in total)`,
                isInternal: true,
              },
            });
          }
        }

        if (order && order.status !== "PENDING") {
          order = await prisma.order.update({
            where: { id: order.id },
            data: { status: "PENDING" },
            include: {
              customer: true,
              items: {
                include: {
                  variant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          });
        }

        let failedTransaction = null;
        if (order) {
          failedTransaction = await prisma.transaction.create({
            data: {
              orderId: order.id,
              amount: parseFloat(amount),
              paymentStatus: "FAILED",
              paymentGatewayName: "AUTHORIZE_NET",
              paymentGatewayTransactionId: transId,
              paymentGatewayResponse: JSON.stringify(gatewayResponse).slice(
                0,
                95000,
              ),
            },
          });

          await prisma.payment.create({
            data: {
              orderId: order.id,
              paymentMethod: "CREDIT_CARD",
              provider: "authorize.net",
              transactionId: transId,
              amount: parseFloat(amount),
              currency: "USD",
              status: "FAILED",
              paidAt: null,
            },
          });

          await prisma.orderNote.create({
            data: {
              orderId: order.id,
              userId: orderDataToCreate?.userId || req.user.id,
              note: `Authorize.Net payment failed: ${failureReason}`,
              isInternal: true,
            },
          });
        }

        return res.status(400).json({
          success: false,
          error: failureReason,
          gatewayResponse: gatewaySummary,
          orderId: order?.id,
          transactionId: failedTransaction?.id,
        });
      }

      // Determine payment status based on response code
      let paymentStatus = "COMPLETED";
      let orderStatus = "PROCESSING"; // Default to PROCESSING for completed payments
      if (["4", "252", "253"].includes(String(responseCode))) {
        paymentStatus = "PENDING"; // Will be updated by settlement checker
        orderStatus = "PENDING"; // Keep order pending until payment settles
      }

      // Payment successful - now create order if it doesn't exist
      if (!order && orderDataToCreate) {
        // Create addresses first
        const tempBillingAddress = await prisma.address.create({
          data: orderDataToCreate.billingAddress,
        });

        const tempShippingAddress = await prisma.address.create({
          data: orderDataToCreate.shippingAddress,
        });

        // Generate order number
        const orderNumber = `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Create the order with appropriate status based on payment status
        order = await prisma.order.create({
          data: {
            customerId: orderDataToCreate.customerId,
            userId: orderDataToCreate.userId,
            orderNumber: orderNumber,
            status: orderStatus, // PROCESSING for completed payments, PENDING for held/pending
            subtotal: orderDataToCreate.subtotal,
            totalAmount: orderDataToCreate.totalAmount,
            taxAmount: orderDataToCreate.taxAmount,
            shippingAmount: orderDataToCreate.shippingAmount,
            discountAmount: orderDataToCreate.discountAmount,
            billingAddressId: tempBillingAddress.id,
            shippingAddressId: tempShippingAddress.id,
            ...buildAddressSnapshot(
              orderDataToCreate.billingAddress,
              "billing",
            ),
            ...buildAddressSnapshot(
              orderDataToCreate.shippingAddress,
              "shipping",
            ),
            ...(orderDataToCreate.items
              ? {
                  items: {
                    create: orderDataToCreate.items,
                  },
                }
              : {}),
          },
          include: {
            customer: true,
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        });

        // Add order note
        await prisma.orderNote.create({
          data: {
            orderId: order.id,
            userId: orderDataToCreate.userId,
            note: orderDataToCreate.note || "Order created from cart payment",
            isInternal: true,
          },
        });

        // Record payment fee details if applicable
        if (orderDataToCreate.paymentFee) {
          await prisma.orderNote.create({
            data: {
              orderId: order.id,
              userId: orderDataToCreate.userId,
              note: `Credit card fee applied: ${orderDataToCreate.paymentFee.percentage}% = $${orderDataToCreate.paymentFee.amount.toFixed(2)} (included in total)`,
              isInternal: true,
            },
          });
        }

        // Clear the cart after creating the order
        if (orderDataToCreate.cartId) {
          await prisma.cartItem.deleteMany({
            where: { cartId: orderDataToCreate.cartId },
          });
        }

        // Reserve inventory for the newly created order
        try {
          const itemsForReserve = orderDataToCreate.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          }));

          console.log(
            "[Payments] Finding optimal warehouse for CC order reservation...",
          );
          const warehouseResult = await findOptimalWarehouse(
            tempShippingAddress.id,
            itemsForReserve,
          );

          if (warehouseResult.stockAvailable) {
            console.log(
              `[Payments] Reserving inventory from warehouse ${warehouseResult.warehouse.id}`,
            );
            await reserveInventoryFromWarehouse(
              warehouseResult.warehouse.id,
              itemsForReserve,
            );
          } else {
            console.warn(
              "[Payments] No warehouse with sufficient stock found for CC order, attempting fallback reservation",
            );
            await reserveInventoryFromWarehouse(
              warehouseResult.warehouse.id,
              itemsForReserve,
            );
          }
        } catch (invError) {
          console.error(
            "[Payments] Failed to reserve inventory for CC order via warehouse service:",
            invError,
          );
          // Emergency Fallback: Reserve inventory on any available record to ensure Committed count matches Order
          try {
            console.log(
              "[Payments] Attempting emergency inventory reservation...",
            );
            const fallbackItems = orderDataToCreate.items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
            }));
            for (const item of fallbackItems) {
              const inv = await prisma.inventory.findFirst({
                where: { variantId: item.variantId },
              });
              if (inv) {
                await prisma.inventory.update({
                  where: { id: inv.id },
                  data: { reservedQty: { increment: item.quantity } },
                });
                console.log(
                  `[Payments] Emergency reservation success for item ${item.variantId}`,
                );
              } else {
                console.warn(
                  `[Payments] No inventory record found for item ${item.variantId} in emergency fallback`,
                );
              }
            }
          } catch (emergencyError) {
            console.error(
              "[Payments] Emergency reservation also failed:",
              emergencyError,
            );
          }

          // Queue Odoo sync for affected products (emergency fallback reservation)
          try {
            const affectedProductIds = [
              ...new Set(
                orderDataToCreate.items
                  .filter((i) => i.variantId)
                  .map((i) => i.variantId),
              ),
            ];
            // Need to look up productId from variantId
            if (affectedProductIds.length > 0) {
              const variants = await prisma.productVariant.findMany({
                where: { id: { in: affectedProductIds } },
                select: { productId: true },
              });
              const productIds = [...new Set(variants.map((v) => v.productId))];
              for (const productId of productIds) {
                queueProductSync(
                  productId,
                  "INVENTORY_UPDATE",
                  "Payment emergency inventory reservation",
                  {
                    orderId: order?.id,
                  },
                ).catch((err) =>
                  console.error(
                    "[ODOO SYNC] Failed to queue after emergency reservation:",
                    err.message,
                  ),
                );
              }
            }
          } catch (syncErr) {
            console.error(
              "[ODOO SYNC] Error queuing sync after emergency reservation:",
              syncErr.message,
            );
          }
        }
      } else if (order) {
        // Order already exists - update status based on payment status
        await prisma.order.update({
          where: { id: order.id },
          data: { status: orderStatus },
        });
      }

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          orderId: order.id,
          amount: parseFloat(amount),
          paymentStatus,
          paymentGatewayName: "AUTHORIZE_NET",
          paymentGatewayTransactionId: transId,
          paymentGatewayResponse: JSON.stringify(gatewayResponse).slice(
            0,
            95000,
          ),
        },
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          orderId: order.id,
          paymentMethod: "CREDIT_CARD",
          provider: "authorize.net",
          transactionId: transId,
          amount: parseFloat(amount),
          currency: "USD",
          status: paymentStatus,
          paidAt: paymentStatus === "COMPLETED" ? new Date() : null,
        },
      });

      return res.json({
        success: true,
        data: {
          transactionId: transaction.id,
          gatewayTransactionId: transId,
          authCode,
          gateway: gatewaySummary,
        },
      });
    } catch (e) {
      const failureReason = "Failed to reach Authorize.Net";

      if (!order && orderDataToCreate) {
        const tempBillingAddress = await prisma.address.create({
          data: orderDataToCreate.billingAddress,
        });

        const tempShippingAddress = await prisma.address.create({
          data: orderDataToCreate.shippingAddress,
        });

        const orderNumber = `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        order = await prisma.order.create({
          data: {
            customerId: orderDataToCreate.customerId,
            userId: orderDataToCreate.userId,
            orderNumber: orderNumber,
            status: "PENDING",
            subtotal: orderDataToCreate.subtotal,
            totalAmount: orderDataToCreate.totalAmount,
            taxAmount: orderDataToCreate.taxAmount,
            shippingAmount: orderDataToCreate.shippingAmount,
            discountAmount: orderDataToCreate.discountAmount,
            billingAddressId: tempBillingAddress.id,
            shippingAddressId: tempShippingAddress.id,
            ...buildAddressSnapshot(
              orderDataToCreate.billingAddress,
              "billing",
            ),
            ...buildAddressSnapshot(
              orderDataToCreate.shippingAddress,
              "shipping",
            ),
            ...(orderDataToCreate.items
              ? {
                  items: {
                    create: orderDataToCreate.items,
                  },
                }
              : {}),
          },
        });

        await prisma.orderNote.create({
          data: {
            orderId: order.id,
            userId: orderDataToCreate.userId,
            note: orderDataToCreate.note || "Order created from cart payment",
            isInternal: true,
          },
        });

        if (orderDataToCreate.paymentFee) {
          await prisma.orderNote.create({
            data: {
              orderId: order.id,
              userId: orderDataToCreate.userId,
              note: `Credit card fee applied: ${orderDataToCreate.paymentFee.percentage}% = $${orderDataToCreate.paymentFee.amount.toFixed(2)} (included in total)`,
              isInternal: true,
            },
          });
        }
      }

      if (order && order.status !== "PENDING") {
        order = await prisma.order.update({
          where: { id: order.id },
          data: { status: "PENDING" },
        });
      }

      let failedTransaction = null;
      if (order) {
        failedTransaction = await prisma.transaction.create({
          data: {
            orderId: order.id,
            amount: parseFloat(amount),
            paymentStatus: "FAILED",
            paymentGatewayName: "AUTHORIZE_NET",
            paymentGatewayResponse: JSON.stringify({
              error: failureReason,
              details: String(e),
            }).slice(0, 95000),
          },
        });

        await prisma.orderNote.create({
          data: {
            orderId: order.id,
            userId: orderDataToCreate?.userId || req.user.id,
            note: `${failureReason}: ${String(e)}`,
            isInternal: true,
          },
        });

        await prisma.payment.create({
          data: {
            orderId: order.id,
            paymentMethod: "CREDIT_CARD",
            provider: "authorize.net",
            transactionId: null,
            amount: parseFloat(amount),
            currency: "USD",
            status: "FAILED",
            paidAt: null,
          },
        });
      }

      return res.status(502).json({
        success: false,
        error: failureReason,
        details: String(e),
        orderId: order?.id,
        transactionId: failedTransaction?.id,
      });
    }
  }),
);

// Get all payments
router.get(
  "/",
  requirePermission("PAYMENTS", "READ"),
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Payments endpoint - To be implemented",
      data: [],
    });
  }),
);

// Process payment
router.post(
  "/",
  requirePermission("PAYMENTS", "CREATE"),
  [
    body("orderId").isString().withMessage("Order ID is required"),
    body("paymentMethod")
      .isIn(["CREDIT_CARD", "DEBIT_CARD", "PAYPAL", "STRIPE", "BANK_TRANSFER"])
      .withMessage("Invalid payment method"),
    body("amount")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Amount must be a valid decimal"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Process payment endpoint - To be implemented",
      data: {},
    });
  }),
);

// Authorize.Net sandbox charge using Accept.js opaqueData
// Client must first obtain opaqueData via Accept.dispatchData with clientKey+apiLoginID (sandbox)
// Then call this endpoint to create a transaction and persist it
router.post(
  "/authorize/charge",
  optionalAuth,
  [
    body("orderId").isString().withMessage("Order ID is required"),
    body("amount")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Amount must be a valid decimal"),
    body("opaqueData").isObject().withMessage("opaqueData is required"),
    body("opaqueData.dataDescriptor").isString(),
    body("opaqueData.dataValue").isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orderId, amount, opaqueData } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // AuthZ: Allow customers to pay their own orders without PAYMENTS permission.
    // Staff roles can also proceed. Block unauthenticated users.
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (req.user.role === "CUSTOMER") {
      if (!req.user.customerId || order.customerId !== req.user.customerId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: cannot pay for this order",
        });
      }
    }

    // Authorize.Net credentials and endpoint from environment
    const apiLoginId = (process.env.ANET_API_LOGIN_ID || "").trim();
    const transactionKey = (process.env.ANET_TRANSACTION_KEY || "").trim();
    const endpoint =
      process.env.ANET_ENV === "production"
        ? "https://api2.authorize.net/xml/v1/request.api"
        : "https://apitest.authorize.net/xml/v1/request.api";

    if (!apiLoginId || !transactionKey) {
      return res.status(500).json({
        success: false,
        error: "Authorize.Net credentials are not configured",
      });
    }

    const requestPayload = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey,
        },
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: parseFloat(amount),
          payment: {
            opaqueData: {
              dataDescriptor: opaqueData.dataDescriptor,
              dataValue: opaqueData.dataValue,
            },
          },
          order: {
            invoiceNumber: order.orderNumber || order.id,
          },
        },
      },
    };

    let gatewayResponse;
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      gatewayResponse = await resp.json();
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Failed to reach Authorize.Net",
        details: String(e),
      });
    }

    const resultCode = gatewayResponse?.messages?.resultCode;
    const trans = gatewayResponse?.transactionResponse;
    const transId = trans?.transId || null;
    const responseCode = trans?.responseCode;
    const gatewaySummary = {
      resultCode,
      responseCode,
      transId,
      message:
        trans?.messages?.[0]?.description ||
        gatewayResponse?.messages?.message?.[0]?.text,
      error:
        trans?.errors?.[0]?.errorText ||
        gatewayResponse?.messages?.message?.[0]?.text,
    };

    // Improved validation logic to accept all successful transaction states
    const isApproved =
      resultCode === "Ok" &&
      transId &&
      (String(responseCode) === "1" || // Approved
        String(responseCode) === "4" || // Held for review
        String(responseCode) === "252" || // Authorized/Pending Review
        String(responseCode) === "253"); // Pending

    // Add logging
    console.log("[Authorize.Net] Accept.js transaction validation:", {
      resultCode,
      responseCode,
      transId,
      isApproved,
      orderId,
    });

    if (!isApproved) {
      // Payment failed - return error without creating transaction or updating order
      return res.status(400).json({
        success: false,
        error: "Payment authorization failed",
        details: {
          resultCode,
          responseCode,
          message:
            trans?.messages?.[0]?.description ||
            gatewayResponse?.messages?.message?.[0]?.text,
          errors: trans?.errors || [],
        },
      });
    }

    // Determine payment status based on response code
    let paymentStatus = "COMPLETED";
    let orderStatus = "PROCESSING"; // Default to PROCESSING for completed payments
    if (["4", "252", "253"].includes(String(responseCode))) {
      paymentStatus = "PENDING"; // Will be updated by settlement checker
      orderStatus = "PENDING"; // Keep order pending until payment settles
    }

    // Payment successful - create transaction and update order status
    const transaction = await prisma.transaction.create({
      data: {
        orderId,
        amount: parseFloat(amount),
        paymentStatus,
        paymentGatewayName: "AUTHORIZE_NET",
        paymentGatewayTransactionId: transId,
        paymentGatewayResponse: JSON.stringify(gatewayResponse).slice(0, 95000), // guard size
      },
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        orderId: orderId,
        paymentMethod: "CREDIT_CARD",
        provider: "authorize.net",
        transactionId: transId,
        amount: parseFloat(amount),
        currency: "USD",
        status: paymentStatus,
        paidAt: paymentStatus === "COMPLETED" ? new Date() : null,
      },
    });

    // Update order status based on payment status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: orderStatus },
    });

    // Clear customer's active cart items after successful authorization/capture
    try {
      const customerId = order.customerId;
      const cart = await prisma.cart.findFirst({
        where: { customerId, isActive: true },
      });
      if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
    } catch (e) {
      // Cart clearing failed - non-fatal
      console.warn("Failed to clear cart after payment:", e);
    }

    return res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        gatewayTransactionId: transId,
        gateway: gatewaySummary,
        status: "COMPLETED",
      },
    });
  }),
);

// Customer-initiated Manual Payment (Zelle/Bank Wire)
// Allows a logged-in customer to record a MANUAL PENDING transaction for their own order
router.post(
  "/manual/initiate",
  optionalAuth,
  [
    body("orderId").isString().withMessage("Order ID is required"),
    body("amount")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Amount must be a valid decimal"),
    body("note").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { orderId, amount, note } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // Customers can only initiate manual payment for their own orders
    if (req.user.role === "CUSTOMER") {
      if (!req.user.customerId || order.customerId !== req.user.customerId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: cannot pay for this order",
        });
      }
    }

    // Create MANUAL pending transaction
    const tx = await prisma.transaction.create({
      data: {
        orderId,
        amount: parseFloat(amount),
        paymentStatus: "PENDING",
        paymentGatewayName: "MANUAL",
        paymentGatewayResponse:
          (note ? String(note) + " " : "") +
          "Manual payment initiated by customer",
      },
    });

    // Also create a Payment record (optional bookkeeping)
    try {
      await prisma.payment.create({
        data: {
          orderId: orderId,
          paymentMethod: "BANK_TRANSFER",
          provider: "manual",
          transactionId: tx.id,
          amount: parseFloat(amount),
          currency: "USD",
          status: "PENDING",
          paidAt: new Date(),
        },
      });
    } catch (e) {
      // Manual payment record creation failed
    }

    return res.json({
      success: true,
      data: { transactionId: tx.id, status: "PENDING" },
    });
  }),
);

// Process refund
router.post(
  "/:paymentId/refund",
  requirePermission("PAYMENTS", "CREATE"),
  [
    param("paymentId").isString().withMessage("Payment ID is required"),
    body("amount")
      .isDecimal({ decimal_digits: "0,2" })
      .withMessage("Amount must be a valid decimal"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Process refund endpoint - To be implemented",
      data: {},
    });
  }),
);

module.exports = router;
