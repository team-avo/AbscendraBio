/**
 * Utility for replacing placeholders in email templates with actual data
 */

// Define all available placeholders and their data sources
const PLACEHOLDER_MAPPINGS = {
  // Customer Information
  "{{customerName}}": (data) =>
    data.customer?.firstName && data.customer?.lastName
      ? `${data.customer.firstName} ${data.customer.lastName}`
      : data.customer?.firstName || "Customer",
  "{{customerEmail}}": (data) => data.customer?.email || "customer@example.com",
  "{{customerPhone}}": (data) => data.customer?.mobile || "N/A",

  // Order Information
  "{{orderNumber}}": (data) => data.order?.id || "N/A",
  "{{orderDate}}": (data) =>
    data.order?.createdAt
      ? new Date(data.order.createdAt).toLocaleDateString()
      : new Date().toLocaleDateString(),
  "{{orderTotal}}": (data) =>
    data.order?.total ? `$${parseFloat(data.order.total).toFixed(2)}` : "$0.00",
  "{{orderItems}}": (data) => {
    if (!data.order?.items || !Array.isArray(data.order.items)) {
      return "No items";
    }
    return data.order.items
      .map((item) => `${item.product?.name || "Product"} (${item.quantity}x)`)
      .join(", ");
  },
  "{{orderStatus}}": (data) => data.order?.status || "Pending",

  // Payment Information
  "{{amountPaid}}": (data) => {
    if (data.payment?.amount) return `$${Number(data.payment.amount).toFixed(2)}`;
    if (data.amountPaid) return `${data.amountPaid}`; // already formatted
    return "$0.00";
  },
  "{{paymentMethod}}": (data) => data.payment?.method || data.paymentMethod || "Manual",

  // Shipping Information
  "{{trackingNumber}}": (data) => data.shipment?.trackingNumber || "N/A",
  "{{carrier}}": (data) => data.shipment?.carrier?.name || "N/A",
  "{{estimatedDelivery}}": (data) => {
    if (!data.shipment?.estimatedDelivery) return "3-5 business days";
    return new Date(data.shipment.estimatedDelivery).toLocaleDateString();
  },
  "{{shippingAddress}}": (data) => {
    const address = data.order?.shippingAddress;
    if (!address) return "N/A";
    return `${address.address1}, ${address.city}, ${address.state} ${address.postalCode}`;
  },

  // Store Information (from settings or environment)
  "{{storeName}}": (data) =>
    data.store?.name || process.env.STORE_NAME || "Centre Physician Directed",
  "{{storeEmail}}": (data) =>
    data.store?.email ||
    process.env.STORE_EMAIL ||
    "support@centreresearch.com",
  "{{storePhone}}": (data) =>
    data.store?.phone || process.env.STORE_PHONE || "+1-555-0123",
  "{{storeAddress}}": (data) =>
    data.store?.address ||
    process.env.STORE_ADDRESS ||
    "123 Research Ave, Science City, SC 12345",
  "{{storeWebsite}}": (data) =>
    data.store?.website ||
    process.env.STORE_WEBSITE ||
    "https://centrelabs.org",

  // Account & Security
  "{{verificationLink}}": (data) =>
    data.verificationLink ||
    `${process.env.FRONTEND_URL}/verify?token=${data.verificationToken || "token"
    }`,
  "{{resetPasswordLink}}": (data) =>
    data.resetPasswordLink ||
    `${process.env.FRONTEND_URL}/reset-password?token=${data.resetToken || "token"
    }`,
  "{{loginLink}}": (data) =>
    data.loginLink || `${process.env.FRONTEND_URL}/login`,

  // Promotions & Discounts
  "{{discountCode}}": (data) => data.promotion?.code || "SAVE10",
  "{{discountAmount}}": (data) => data.promotion?.amount || "10%",
  "{{expiryDate}}": (data) => {
    if (!data.promotion?.expiryDate) return "30 days";
  },

  // Partner Billing Information
  "{{statementId}}": (data) => data.statementId || data.statement?.referenceId || "N/A",
  "{{totalAmount}}": (data) => data.totalAmount ? `$${parseFloat(data.totalAmount).toFixed(2)}` : (data.statement?.totalAmount ? `$${parseFloat(data.statement.totalAmount).toFixed(2)}` : "$0.00"),
  "{{dueDate}}": (data) => data.dueDate ? new Date(data.dueDate).toLocaleDateString() : (data.statement?.dueDate ? new Date(data.statement.dueDate).toLocaleDateString() : "N/A"),
  "{{paymentInstructions}}": (data) => data.paymentInstructions || "Please pay via Bank Transfer.",
  "{{companyName}}": (data) => data.companyName || "N/A",
};

/**
 * Replace placeholders in content with actual data
 * @param {string} content - The template content with placeholders
 * @param {object} data - The data object containing values to replace placeholders
 * @returns {string} - Content with placeholders replaced
 */
function replacePlaceholders(content, data = {}) {
  if (!content || typeof content !== "string") {
    return content;
  }

  let result = content;

  // Replace each placeholder
  Object.keys(PLACEHOLDER_MAPPINGS).forEach((placeholder) => {
    const replacement = PLACEHOLDER_MAPPINGS[placeholder](data);
    result = result.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      replacement
    );
  });

  return result;
}

/**
 * Extract all placeholders from content
 * @param {string} content - The template content
 * @returns {string[]} - Array of found placeholders
 */
function extractPlaceholders(content) {
  if (!content || typeof content !== "string") {
    return [];
  }

  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const placeholders = [];
  let match;

  while ((match = placeholderRegex.exec(content)) !== null) {
    placeholders.push(match[0]); // Full placeholder with {{}}
  }

  return [...new Set(placeholders)]; // Remove duplicates
}

/**
 * Validate placeholders in content
 * @param {string} content - The template content
 * @returns {object} - Validation result with valid/invalid placeholders
 */
function validatePlaceholders(content) {
  const foundPlaceholders = extractPlaceholders(content);
  const validPlaceholders = Object.keys(PLACEHOLDER_MAPPINGS);
  const invalidPlaceholders = foundPlaceholders.filter(
    (p) => !validPlaceholders.includes(p)
  );

  return {
    valid: invalidPlaceholders.length === 0,
    invalid: invalidPlaceholders,
    found: foundPlaceholders,
  };
}

/**
 * Generate sample data for preview
 * @param {string} templateType - Type of email template
 * @returns {object} - Sample data object
 */
function generateSampleData(templateType) {
  const baseData = {
    customer: {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      mobile: "+1-555-0123",
    },
    store: {
      name: "Centre Physician Directed",
      email: "support@centreresearch.com",
      phone: "+1-555-0123",
      address: "123 Research Ave, Science City, SC 12345",
      website: "https://centrelabs.org",
    },
  };

  switch (templateType) {
    case "ORDER_CONFIRMATION":
      return {
        ...baseData,
        order: {
          id: "ORD-2024-001",
          createdAt: new Date(),
          total: 299.99,
          status: "Confirmed",
          items: [
            { product: { name: "Peptide-001" }, quantity: 2 },
            { product: { name: "Peptide-002" }, quantity: 1 },
          ],
          shippingAddress: {
            address1: "123 Main St",
            city: "New York",
            state: "NY",
            postalCode: "10001",
          },
        },
        shipment: {
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        },
      };

    case "SHIPPING_NOTIFICATION":
      return {
        ...baseData,
        order: {
          id: "ORD-2024-001",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        shipment: {
          trackingNumber: "TRK123456789",
          carrier: { name: "FedEx" },
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        },
      };

    case "WELCOME_EMAIL":
      return {
        ...baseData,
        verificationLink: "https://centrelabs.org/verify?token=abc123",
        promotion: {
          code: "WELCOME10",
          amount: "10%",
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      };

    case "PASSWORD_RESET":
      return {
        ...baseData,
        resetPasswordLink:
          "https://centrelabs.org/reset-password?token=reset123",
      };

    case "PARTNER_STATEMENT_GENERATED":
    case "PARTNER_PAYMENT_REMINDER":
    case "PARTNER_OVERDUE_ALERT":
      return {
        ...baseData,
        companyName: "Test Partner Corp",
        statementId: "STMT-2024-005",
        totalAmount: "1250.50",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        paymentInstructions: "Bank: National Bank\nAccount: 123456789\nSwift: NATLUS33",
      };

    default:
      return baseData;
  }
}

const DEFAULT_BILLING_TEMPLATES = {
  PARTNER_STATEMENT_GENERATED: {
    name: "Partner Statement Generated",
    subject: "Statement Generated for {{companyName}} - {{statementId}}",
    htmlContent: `
      <h2>New Statement Available</h2>
      <p>Dear {{companyName}},</p>
      <p>A new billing statement has been generated for your account.</p>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p><strong>Statement ID:</strong> {{statementId}}</p>
          <p><strong>Total Amount:</strong> {{totalAmount}}</p>
          <p><strong>Due Date:</strong> {{dueDate}}</p>
      </div>
      <h3>Payment Instructions:</h3>
      <p>{{paymentInstructions}}</p>
      <p>You can view and pay your statement by logging into the partner portal.</p>
      <p style="text-align: center;"><a href="{{loginLink}}" class="button" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Log In to Portal</a></p>
    `
  },
  PARTNER_PAYMENT_REMINDER: {
    name: "Partner Payment Reminder",
    subject: "Payment Reminder: Statement {{statementId}} for {{companyName}}",
    htmlContent: `
      <h2>Payment Reminder</h2>
      <p>Dear {{companyName}},</p>
      <p>This is a friendly reminder that payment for statement <strong>{{statementId}}</strong> is due soon.</p>
      <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border: 1px solid #ffeeba;">
          <p><strong>Statement ID:</strong> {{statementId}}</p>
          <p><strong>Amount Due:</strong> {{totalAmount}}</p>
          <p><strong>Due Date:</strong> {{dueDate}}</p>
      </div>
      <p>Please ensure payment is made by the due date to avoid any service interruptions.</p>
      <p style="text-align: center;"><a href="{{loginLink}}" class="button" style="display: inline-block; background: #212529; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Make Payment</a></p>
    `
  },
  PARTNER_OVERDUE_ALERT: {
    name: "Partner Overdue Alert",
    subject: "URGENT: Overdue Payment for Statement {{statementId}} - {{companyName}}",
    htmlContent: `
      <h2>URGENT: Overdue Payment</h2>
      <p>Dear {{companyName}},</p>
      <p>Our records indicate that payment for statement <strong>{{statementId}}</strong> is now overdue.</p>
      <div style="background: #f8d7da; padding: 15px; border-radius: 4px; margin: 20px 0; border: 1px solid #f5c6cb; color: #721c24;">
          <p><strong>Statement ID:</strong> {{statementId}}</p>
          <p><strong>Amount Overdue:</strong> {{totalAmount}}</p>
          <p><strong>Was Due On:</strong> {{dueDate}}</p>
      </div>
      <p>Please settle this balance immediately to maintain your account in good standing.</p>
      <p style="text-align: center;"><a href="{{loginLink}}" class="button" style="display: inline-block; background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Pay Now</a></p>
    `
  }
};

module.exports = {
  replacePlaceholders,
  extractPlaceholders,
  validatePlaceholders,
  generateSampleData,
  PLACEHOLDER_MAPPINGS,
  DEFAULT_BILLING_TEMPLATES,
};
