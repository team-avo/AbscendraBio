const prisma = require('../prisma/client');
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { Resend } = require("resend");
const resend = require('../config/resend');

// Initialize Resend client (now handled via config/resend.js)
// const resend = new Resend(process.env.RESEND_API_KEY);
const Queue = require('bull');

// Initialize Bull Queue
const redisConfig = process.env.REDIS_URL || {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const emailQueue = new Queue('email-queue', {
  redis: redisConfig,
  limiter: {
    max: 2, // 2 emails
    duration: 1100 // per 1.1 seconds (slightly over 1s to be safe)
  }
});

console.log('Email Queue initialized with Redis config:', redisConfig);

// Process jobs
emailQueue.process(async (job) => {
  const { type, ...data } = job.data;
  console.log(`Processing email job ${job.id} of type ${type}`);

  try {
    if (type === 'TEMPLATE') {
      return await processEmailWithTemplateResend(data.templateType, data.recipientEmail, data.data);
    } else if (type === 'RAW') {
      return await processRawEmailResend(data);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});
// Add a job to the email queue
const queueEmail = async (data) => {
  try {
    const job = await emailQueue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true
    });
    console.log(`Email job ${job.id} queued successfully`);
    return job;
  } catch (error) {
    console.error('Error queuing email job:', error);
    throw error;
  }
};


// Create transporter (configure based on your email provider)
const createTransporter = () => {
  // Validate required environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error(
      "Email configuration missing: EMAIL_USER and EMAIL_PASSWORD are required"
    );
  }

  const config = {
    pool: true, // Use connection pooling
    maxConnections: 5, // Limit concurrent connections
    maxMessages: 100, // Limit messages per connection
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true",
    tls: {
      ciphers: 'SSLv3',
      minVersion: 'TLSv1',
      rejectUnauthorized: false
    },
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  };

  console.log("Email configuration:", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    from: process.env.EMAIL_FROM || "noreply@centreresearch.com",
  });

  return nodemailer.createTransport(config);
};

// ===== RESEND EMAIL FUNCTIONS =====

const getFromEmail = (templateType) => {
  const mapping = {
    'ORDER_CONFIRMATION': 'Ascendra Bio | Orders <orders@ascendrabio.com>',
    'SHIPPING_NOTIFICATION': 'Ascendra Bio | Shipping <shipping@ascendrabio.com>',
    'ORDER_CANCELLED': 'Ascendra Bio | Orders <orders@ascendrabio.com>',
    'PAYMENT_SUCCESS': 'Ascendra Bio | Orders <orders@ascendrabio.com>',
    'PASSWORD_RESET': 'Ascendra Bio | Notifications <notifications@ascendrabio.com>',
    'ACCOUNT_VERIFICATION': 'Ascendra Bio | Notifications <notifications@ascendrabio.com>',
    'WELCOME_EMAIL': 'Ascendra Bio | Notifications <notifications@ascendrabio.com>',
    'LOW_INVENTORY_ALERT': 'Ascendra Bio | Notifications <notifications@ascendrabio.com>',
    'BULK_QUOTE': 'Ascendra Bio | Orders <orders@ascendrabio.com>',
    'MARKETING_GENERIC': 'Ascendra Bio <leadership@ascendrabio.com>',
    'PARTNER_STATEMENT_GENERATED': 'Ascendra Bio | Billing <billing@ascendrabio.com>',
    'PARTNER_PAYMENT_REMINDER': 'Ascendra Bio | Billing <billing@ascendrabio.com>',
    'PARTNER_OVERDUE_ALERT': 'Ascendra Bio | Billing <billing@ascendrabio.com>',
    'ABANDONED_CART': 'Ascendra Bio | Notifications <notifications@ascendrabio.com>',
  };
  return mapping[templateType] || 'Ascendra Bio <info@ascendrabio.com>';
};

// Process email with template using Resend (Internal function called by Queue)
const processEmailWithTemplateResend = async (
  templateType,
  recipientEmail,
  data = {}
) => {
  try {
    console.log(`[Resend] Getting email template for type: ${templateType}`);
    const template = await getEmailTemplate(templateType);
    console.log(
      `[Resend] Template found: ${template.name}, Active: ${template.isActive}, ContentType: ${template.contentType}`
    );

    // Replace placeholders in subject and content
    console.log("[Resend] Replacing placeholders in template...");
    const subject = replacePlaceholders(template.subject, data);

    // Use the appropriate content based on contentType
    let htmlContent = "";
    let textContent = null;

    if (template.contentType === "HTML_CONTENT") {
      htmlContent = replacePlaceholders(template.htmlContent, data);
      textContent = template.textContent
        ? replacePlaceholders(template.textContent, data)
        : null;
    } else if (template.contentType === "TEXT_CONTENT") {
      // For TEXT_CONTENT, convert the rich text content to HTML
      htmlContent = replacePlaceholders(template.textContent || "", data);
      textContent = replacePlaceholders(template.textContent || "", data);
    }

    // Create email header with logo
    const emailHeader = `
      <div style="text-align: center; padding: 20px 0; background-color: #ffffff; display: flex; justify-content: center; align-items: center; width: 100%;">
        <img src="https://centrelabs.org/logo.png" alt="Centre Labs" style="max-width: 60px; width: auto; height: auto; display: block; margin: 0 auto;">
      </div>
    `;

    // Create email footer with dynamic content
    const emailFooter = `
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; margin-top: 30px;">
        <p>If you have any queries, please contact us at ${data.storeEmail || "{{storeEmail}}"
      }</p>
        <p>${data.storeAddress || "{{storeAddress}}"}</p>
      </div>
    `;

    // Wrap the content with header and footer
    const wrappedHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          /* Reset and base styles */
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          
          /* Container styles */
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff; 
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          
          /* Header styles */
          .email-header { 
            text-align: center; 
            padding: 20px 0; 
            background-color: #ffffff; 
            display: flex; 
            justify-content: center; 
            align-items: center;
            width: 100%;
          }
          
          .email-header img {
            max-width: 60px; 
            width: auto; 
            height: auto; 
            display: block;
            margin: 0 auto;
          }
          
          /* Responsive logo sizing */
          @media screen and (max-width: 480px) {
            .email-header img {
              max-width: 50px;
              width: auto;
            }
          }
          
          @media screen and (min-width: 768px) {
            .email-header img {
              max-width: 70px;
              width: auto;
            }
          }
          
          /* Content styles */
          .content { 
            padding: 30px; 
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          
          /* Footer styles */
          .email-footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
            margin-top: 30px;
          }
          
          /* Responsive typography */
          h1 { font-size: 24px; margin: 0 0 16px 0; }
          h2 { font-size: 20px; margin: 0 0 14px 0; }
          h3 { font-size: 18px; margin: 0 0 12px 0; }
          p { margin: 0 0 16px 0; }
          
          /* Button styles */
          .button, a[style*="display: inline-block"] {
            display: inline-block !important;
            padding: 12px 24px !important;
            background-color: #667eea !important;
            color: #ffffff !important;
            text-decoration: none !important;
            border-radius: 6px !important;
            font-weight: 500 !important;
            text-align: center !important;
            align-items: center !important;
            margin: 10px 0 !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
          }
          
          /* Table styles */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 16px 0 !important;
          }
          
          table td, table th {
            padding: 8px !important;
            border: 1px solid #ddd !important;
            text-align: left !important;
          }
          
          table th {
            background-color: #f8f9fa !important;
            font-weight: bold !important;
          }
          
          /* Image styles */
          img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
          }
          
          /* Mobile responsive styles */
          @media only screen and (max-width: 600px) {
            .container {
              width: 100% !important;
              margin: 0 !important;
            }
            
            .content {
              padding: 20px !important;
            }
            
            .email-header {
              padding: 15px 0 !important;
            }
            
            .email-header img {
              max-width: 150px !important;
            }
            
            .email-footer {
              padding: 15px !important;
              font-size: 12px !important;
            }
            
            h1 { font-size: 20px !important; }
            h2 { font-size: 18px !important; }
            h3 { font-size: 16px !important; }
            
            .button, a[style*="display: inline-block"] {
              padding: 10px 20px !important;
              font-size: 13px !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }
          }
          
          /* Dark mode support for email clients that support it */
          @media (prefers-color-scheme: dark) {
            body {
              background-color: #1a1a1a;
              color: #ffffff;
            }
            
            .container {
              background: #2d2d2d;
            }
            
            .email-footer {
              background-color: #3d3d3d;
              color: #cccccc;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-header">
            <img src="https://centrelabs.org/logo.png" alt="Centre Labs">
          </div>
          <div class="content">
            ${htmlContent}
          </div>
          <div class="email-footer">
            <p>If you have any queries, please contact us at {{storeEmail}}</p>
            <p>{{storeAddress}}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Replace placeholders in the wrapped HTML content (including footer)
    const finalHtml = replacePlaceholders(wrappedHtmlContent, data);

    console.log("[Resend] Template processed:", {
      subject: subject,
      htmlContentLength: htmlContent.length,
      hasTextContent: !!textContent,
      contentType: template.contentType,
    });

    // Send email using Resend
    console.log("[Resend] Attempting to send email...");
    const response = await resend.emails.send({
      from: getFromEmail(templateType),
      to: recipientEmail,
      subject: subject,
      html: finalHtml,
      ...(textContent && { text: textContent }),
    });

    if (response.error) {
      console.error("[Resend] API returned error:", response.error);
      throw response.error;
    }

    const messageId = response.data?.id || response.id;
    console.log("[Resend] Email sent successfully:", messageId);

    return {
      success: true,
      messageId: messageId,
      template: template.name,
    };
  } catch (error) {
    console.error("[Resend] Error sending email:", error);
    console.error("[Resend] Error details:", {
      message: error.message,
      stack: error.stack,
      templateType,
      recipientEmail,
    });
    throw error;
  }
};

// Helper: Send raw email using Resend (Internal)
const processRawEmailResend = async ({ to, subject, html, text, from, attachments }) => {
  try {
    console.log("[Resend] Sending raw email...");

    const response = await resend.emails.send({
      from: from || 'Ascendra Bio <info@ascendrabio.com>',
      to: to,
      subject: subject,
      html: html,
      ...(text && { text: text }),
      ...(attachments && { attachments }),
    });

    if (response.error) {
      console.error("[Resend] Raw API returned error:", response.error);
      throw response.error;
    }

    const messageId = response.data?.id || response.id;
    console.log("[Resend] Raw email sent successfully:", messageId);

    return {
      success: true,
      messageId: messageId,
    };
  } catch (error) {
    console.error("[Resend] Error sending raw email:", error);
    throw error;
  }
};

// Replace placeholders in template
const replacePlaceholders = (template, data) => {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, "g"), value || "");
  });
  return result;
};

// Get email template by type from database
const getEmailTemplate = async (templateType) => {
  try {
    console.log(`Looking for email template with type: ${templateType}`);

    const template = await prisma.emailTemplate.findUnique({
      where: { type: templateType },
    });

    console.log(
      "Database query result:",
      template
        ? {
          id: template.id,
          name: template.name,
          type: template.type,
          isActive: template.isActive,
          hasHtmlContent: !!template.htmlContent,
          hasTextContent: !!template.textContent,
        }
        : "Template not found"
    );

    if (!template) {
      throw new Error(`Email template not found for type: ${templateType}`);
    }

    if (!template.isActive) {
      throw new Error(`Email template is inactive for type: ${templateType}`);
    }

    console.log(`Template found and active: ${template.name}`);
    return template;
  } catch (error) {
    console.error("Error getting email template:", error);
    throw error;
  }
};

// Process email with template (Internal function called by Queue)
const processEmailWithTemplate = async (
  templateType,
  recipientEmail,
  data = {}
) => {
  try {
    console.log(`Getting email template for type: ${templateType}`);
    const template = await getEmailTemplate(templateType);
    console.log(
      `Template found: ${template.name}, Active: ${template.isActive}, ContentType: ${template.contentType}`
    );

    console.log("Creating email transporter...");
    const transporter = createTransporter();
    console.log("Email transporter created successfully");

    // Replace placeholders in subject and content
    console.log("Replacing placeholders in template...");
    const subject = replacePlaceholders(template.subject, data);

    // Use the appropriate content based on contentType
    let htmlContent = "";
    let textContent = null;

    if (template.contentType === "HTML_CONTENT") {
      htmlContent = replacePlaceholders(template.htmlContent, data);
      textContent = template.textContent
        ? replacePlaceholders(template.textContent, data)
        : null;
    } else if (template.contentType === "TEXT_CONTENT") {
      // For TEXT_CONTENT, convert the rich text content to HTML
      htmlContent = replacePlaceholders(template.textContent || "", data);
      textContent = replacePlaceholders(template.textContent || "", data);
    }

    // Create email header with logo
    const emailHeader = `
      <div style="text-align: center; padding: 20px 0; background-color: #ffffff; display: flex; justify-content: center; align-items: center; width: 100%;">
        <img src="https://centrelabs.org/logo.png" alt="Centre Labs" style="max-width: 60px; width: auto; height: auto; display: block; margin: 0 auto;">
      </div>
    `;

    // Create email footer with dynamic content
    const emailFooter = `
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; margin-top: 30px;">
        <p>If you have any queries, please contact us at ${data.storeEmail || "{{storeEmail}}"
      }</p>
        <p>${data.storeAddress || "{{storeAddress}}"}</p>
      </div>
    `;

    // Wrap the content with header and footer
    const wrappedHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          /* Reset and base styles */
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          
          /* Container styles */
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff; 
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          
          /* Header styles */
          .email-header { 
            text-align: center; 
            padding: 20px 0; 
            background-color: #ffffff; 
            display: flex; 
            justify-content: center; 
            align-items: center;
            width: 100%;
          }
          
          .email-header img {
            max-width: 60px; 
            width: auto; 
            height: auto; 
            display: block;
            margin: 0 auto;
          }
          
          /* Responsive logo sizing */
          @media screen and (max-width: 480px) {
            .email-header img {
              max-width: 50px;
              width: auto;
            }
          }
          
          @media screen and (min-width: 768px) {
            .email-header img {
              max-width: 70px;
              width: auto;
            }
          }
          
          /* Content styles */
          .content { 
            padding: 30px; 
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          
          /* Footer styles */
          .email-footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
            margin-top: 30px;
          }
          
          /* Responsive typography */
          h1 { font-size: 24px; margin: 0 0 16px 0; }
          h2 { font-size: 20px; margin: 0 0 14px 0; }
          h3 { font-size: 18px; margin: 0 0 12px 0; }
          p { margin: 0 0 16px 0; }
          
          /* Button styles */
          .button, a[style*="display: inline-block"] {
            display: inline-block !important;
            padding: 12px 24px !important;
            background-color: #667eea !important;
            color: #ffffff !important;
            text-decoration: none !important;
            border-radius: 6px !important;
            font-weight: 500 !important;
            text-align: center !important;
            align-items: center !important;
            margin: 10px 0 !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
          }
          
          /* Table styles */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 16px 0 !important;
          }
          
          table td, table th {
            padding: 8px !important;
            border: 1px solid #ddd !important;
            text-align: left !important;
          }
          
          table th {
            background-color: #f8f9fa !important;
            font-weight: bold !important;
          }
          
          /* Image styles */
          img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
          }
          
          /* Mobile responsive styles */
          @media only screen and (max-width: 600px) {
            .container {
              width: 100% !important;
              margin: 0 !important;
            }
            
            .content {
              padding: 20px !important;
            }
            
            .email-header {
              padding: 15px 0 !important;
            }
            
            .email-header img {
              max-width: 150px !important;
            }
            
            .email-footer {
              padding: 15px !important;
              font-size: 12px !important;
            }
            
            h1 { font-size: 20px !important; }
            h2 { font-size: 18px !important; }
            h3 { font-size: 16px !important; }
            
            .button, a[style*="display: inline-block"] {
              padding: 10px 20px !important;
              font-size: 13px !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }
          }
          
          /* Dark mode support for email clients that support it */
          @media (prefers-color-scheme: dark) {
            body {
              background-color: #1a1a1a;
              color: #ffffff;
            }
            
            .container {
              background: #2d2d2d;
            }
            
            .email-footer {
              background-color: #3d3d3d;
              color: #cccccc;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-header">
            <img src="https://centrelabs.org/logo.png" alt="Centre Labs">
          </div>
          <div class="content">
            ${htmlContent}
          </div>
          <div class="email-footer">
            <p>If you have any queries, please contact us at {{storeEmail}}</p>
            <p>{{storeAddress}}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Replace placeholders in the wrapped HTML content (including footer)
    const finalHtml = replacePlaceholders(wrappedHtmlContent, data);

    console.log("Template processed:", {
      subject: subject,
      htmlContentLength: htmlContent.length,
      hasTextContent: !!textContent,
      contentType: template.contentType,
    });

    // Prepare email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@ascendrabio.com",
      to: recipientEmail,
      subject: subject,
      html: finalHtml,
      ...(textContent && { text: textContent }),
    };

    console.log("Email options prepared:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    // Send email
    console.log("Attempting to send email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      template: template.name,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      templateType,
      recipientEmail,
    });
    throw error;
  }


};

// Helper: Send raw email (Internal)
const processRawEmail = async ({ to, subject, html, text, from }) => {
  try {
    console.log("Creating email transporter for raw email...");
    const transporter = createTransporter();

    // Prepare email options
    const mailOptions = {
      from: from || process.env.EMAIL_FROM || "noreply@centreresearch.com",
      to: to,
      subject: subject,
      html: html,
      text: text
    };

    console.log("Attempting to send raw email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Raw email sent successfully:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending raw email:", error);
    throw error;
  }
};


// Public API: Queue an email with template
const sendEmailWithTemplate = async (templateType, recipientEmail, data = {}) => {
  try {
    const job = await emailQueue.add({
      type: 'TEMPLATE',
      templateType,
      recipientEmail,
      data
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true
    });

    console.log(`Email queued (TEMPLATE): ${job.id}`);
    return { success: true, message: 'Email queued', jobId: job.id };
  } catch (error) {
    console.error("Failed to queue email:", error);
    throw error;
  }
};

// Public API: Queue a raw email
const sendRawEmail = async (to, subject, html, text, from) => {
  try {
    const job = await emailQueue.add({
      type: 'RAW',
      to,
      subject,
      html,
      text,
      from
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true
    });

    console.log(`Email queued (RAW): ${job.id}`);
    return { success: true, message: 'Email queued', jobId: job.id };
  } catch (error) {
    console.error("Failed to queue raw email:", error);
    throw error;
  }
};

// Send order confirmation email using database template
const sendOrderConfirmation = async (order, customer) => {
  try {
    console.log("Starting order confirmation email process...");
    console.log("Order data:", {
      orderNumber: order.orderNumber,
      customerEmail: customer.email,
    });
    console.log("Order total field:", {
      total: order.total,
      totalAmount: order.totalAmount,
    });

    const orderItems = order.items
      .map((item) => `${item.variant.product.name} (${item.quantity}x)`)
      .join(", ");

    // Use the correct field name for order total
    const orderTotal = order.totalAmount
      ? order.totalAmount.toFixed(2)
      : "0.00";

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const orderLink = `${frontendUrl}/account/orders/${order.id}`;

    const data = {
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      orderTotal: `$${orderTotal}`,
      orderItems: orderItems,
      estimatedDelivery: "3-5 business days",
      storeName: "Centre Labs",
      storeEmail: "info@centreresearch.org",
      storePhone: "+1 (323) 299-6900",
      storeAddress: "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028",
      orderLink: orderLink,
    };

    console.log("Email data prepared:", data);
    console.log(
      "Attempting to send email with template type: ORDER_CONFIRMATION"
    );

    const result = await sendEmailWithTemplate(
      "ORDER_CONFIRMATION",
      customer.email,
      data
    );
    console.log("Order confirmation email sent successfully:", result);
    return result;
  } catch (error) {
    console.error("Error sending order confirmation:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

// Send shipping notification email using database template
const sendShippingNotification = async (order, customer, shipment) => {
  try {
    const orderItems = order.items
      .map((item) => `${item.variant.product.name} (${item.quantity}x)`)
      .join(", ");

    // Handle shipment being null (when called from order update)
    const trackingNumber = shipment?.trackingNumber || "N/A";
    const carrier = shipment?.carrier || "N/A";
    const trackingUrl = shipment?.trackingUrl || "";
    const estimatedDelivery =
      shipment?.estimatedDelivery || "2-3 business days";

    const data = {
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      orderNumber: order.orderNumber,
      trackingNumber,
      carrier,
      trackingUrl,
      estimatedDelivery,
      orderItems: orderItems,
      storeName: "Centre Labs",
      storeEmail: "info@centreresearch.org",
      storePhone: "+1 (323) 299-6900",
      storeAddress: "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028",
    };

    return await sendEmailWithTemplate(
      "SHIPPING_NOTIFICATION",
      customer.email,
      data
    );
  } catch (error) {
    console.error("Error sending shipping notification:", error);
    throw error;
  }
};

// Send order cancellation email using database template
const sendOrderCancellation = async (
  order,
  customer,
  cancellationReason = "Order cancelled"
) => {
  try {
    const orderItems = order.items
      .map((item) => `${item.variant.product.name} (${item.quantity}x)`)
      .join(", ");

    // Use the correct field name for order total
    const orderTotal = order.totalAmount
      ? order.totalAmount.toFixed(2)
      : "0.00";

    const data = {
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      orderTotal: `$${orderTotal}`,
      orderItems: orderItems,
      cancellationReason: cancellationReason,
      storeName: "Centre Labs",
      storeEmail: "info@centreresearch.org",
      storePhone: "+1 (323) 299-6900",
      storeAddress: "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028",
    };

    return await sendEmailWithTemplate("ORDER_CANCELLED", customer.email, data);
  } catch (error) {
    console.error("Error sending order cancellation:", error);
    throw error;
  }
};

// Send payment success email using database template
const sendPaymentSuccess = async (order, customer, amount, method = 'Manual') => {
  try {
    const orderTotal = order.totalAmount ? order.totalAmount.toFixed(2) : '0.00';
    const data = {
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      orderTotal: `$${orderTotal}`,
      amountPaid: `$${Number(amount || 0).toFixed(2)}`,
      paymentMethod: method,
      storeName: 'Centre Labs',
      storeEmail: 'info@centreresearch.org',
      storePhone: '+1 (323) 299-6900',
      storeAddress: '5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028',
    };
    return await sendEmailWithTemplate('PAYMENT_SUCCESS', customer.email, data);
  } catch (error) {
    console.error('Error sending payment success email:', error);
    throw error;
  }
};

// Send welcome email using database template
const sendWelcomeEmail = async (customer, verificationToken = null) => {
  try {
    const data = {
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      verificationLink: verificationToken
        ? `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`
        : `${process.env.FRONTEND_URL}/login`,
      discountCode: "WELCOME10",
      discountAmount: "10%",
      storeName: "Centre Labs",
      storeEmail: "info@centreresearch.org",
      storePhone: "+1 (323) 299-6900",
      storeAddress: "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028",
    };

    return await sendEmailWithTemplate("WELCOME_EMAIL", customer.email, data);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
};

// Send low inventory alert using database template
const sendLowInventoryAlert = async (product, currentStock, reorderPoint) => {
  try {
    const data = {
      productName: product.name,
      currentStock: currentStock.toString(),
      reorderPoint: reorderPoint.toString(),
      supplierName: "Peptide Supply Co.",
      storeName: "Centre Labs",
      storeEmail: "info@centreresearch.org",
      storePhone: "+1 (323) 299-6900",
      storeAddress: "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028",
    };

    // Send to admin email
    const adminEmail = process.env.ADMIN_EMAIL || "admin@centreresearch.com";
    return await sendEmailWithTemplate("LOW_INVENTORY_ALERT", adminEmail, data);
  } catch (error) {
    console.error("Error sending low inventory alert:", error);
    throw error;
  }
};

/**
 * Send comprehensive stock alert email with out of stock and low stock items
 * @param {string} recipientEmail - Email address to send to
 * @param {Array} lowStockItems - Array of low stock inventory items
 * @param {Array} outOfStockItems - Array of out of stock inventory items
 * @param {Object} storeInfo - Store information object
 */
const sendStockAlertEmail = async (recipientEmail, lowStockItems = [], outOfStockItems = [], storeInfo = {}) => {
  try {
    console.log(`Preparing stock alert email for: ${recipientEmail}`);

    // Format out of stock items table rows
    const outOfStockRows = outOfStockItems.map(item => {
      const productName = item.variant?.product?.name || 'Unknown Product';
      const variantName = item.variant?.name || '';
      const sku = item.variant?.sku || 'N/A';
      const location = item.location?.name || 'Unassigned';

      return `<tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <span style="font-weight: 600; color: #333;">${productName}</span>
          ${variantName ? `<br><small style="color: #666;">${variantName}</small>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <span style="background: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: monospace;">${sku}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${location}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <span style="color: #c62828; font-weight: bold; background: #ffebee; padding: 4px 8px; border-radius: 4px;">OUT OF STOCK</span>
        </td>
      </tr>`;
    }).join('');

    // Format low stock items table rows
    const lowStockRows = lowStockItems.map(item => {
      const total = item.quantity || 0;
      const reserved = item.reservedQty || 0;
      const available = Math.max(0, total - reserved);
      const threshold = item.lowStockAlert || 10;
      const productName = item.variant?.product?.name || 'Unknown Product';
      const variantName = item.variant?.name || '';
      const sku = item.variant?.sku || 'N/A';
      const location = item.location?.name || 'Unassigned';

      return `<tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <span style="font-weight: 600; color: #333;">${productName}</span>
          ${variantName ? `<br><small style="color: #666;">${variantName}</small>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <span style="background: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: monospace;">${sku}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="color: #d32f2f; font-weight: 600;">${available}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
          ${threshold}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${location}
        </td>
      </tr>`;
    }).join('');

    // Prepare email data
    const now = new Date();
    const alertDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const alertTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const data = {
      storeName: storeInfo.name || 'Centre Labs',
      storeEmail: storeInfo.email || 'info@centreresearch.org',
      storePhone: storeInfo.phone || '+1 (323) 299-6900',
      storeAddress: storeInfo.address || '5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028',
      outOfStockCount: outOfStockItems.length.toString(),
      lowStockCount: lowStockItems.length.toString(),
      totalAlerts: (outOfStockItems.length + lowStockItems.length).toString(),
      outOfStockItems: outOfStockRows || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #999;">No out of stock items</td></tr>',
      lowStockItems: lowStockRows || '<tr><td colspan="5" style="padding: 12px; text-align: center; color: #999;">No low stock items</td></tr>',
      alertDate: alertDate,
      alertTime: alertTime,
      adminDashboardLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory`,
    };

    console.log(`Stock alert data prepared: ${data.outOfStockCount} out of stock, ${data.lowStockCount} low stock`);
    console.log(`Out of stock rows: ${outOfStockRows.length} chars, Low stock rows: ${lowStockRows.length} chars`);

    // Send email using template
    return await sendEmailWithTemplate('LOW_INVENTORY_ALERT', recipientEmail, data);
  } catch (error) {
    console.error('Error sending stock alert email:', error);
    throw error;
  }
};

// Send password reset email using database template
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const data = {
      customerName: `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      resetPasswordLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      storeName: "Centre Labs",
      storeEmail: "info@centreresearch.org",
      storePhone: "+1 (323) 299-6900",
      storeAddress: "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028",
    };

    return await sendEmailWithTemplate("PASSWORD_RESET", user.email, data);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
};

// Send account verification email using database template
const sendAccountVerificationEmail = async (user, verificationToken) => {
  try {
    const data = {
      customerName: `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      verificationLink: `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`,
      storeName: "Centre Labs",
      storeEmail: "info@centreresearch.org",
      storePhone: "+1 (323) 299-6900",
      storeAddress: "5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028",
    };

    return await sendEmailWithTemplate(
      "ACCOUNT_VERIFICATION",
      user.email,
      data
    );
  } catch (error) {
    console.error("Error sending account verification email:", error);
    throw error;
  }
};

// Send abandoned cart email using Nodemailer/SMTP (NOT Resend)
// This is the ONLY email type that uses Nodemailer instead of Resend
const sendAbandonedCartEmail = async (cart, customer, checkoutUrl) => {
  try {
    const itemsHtml = cart.items.map(item =>
      `<tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <strong>${item.variant.product.name}</strong> 
            <span style="color: #666;">(${item.variant.name})</span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">
            <span style="font-size: 14px;">Qty: ${item.quantity}</span>
          </td>
      </tr>`
    ).join('');

    const subject = "You left something behind at Centre Labs";

    // Hardcoded HTML Template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
         <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
          .header { text-align: center; padding: 20px; background-color: #ffffff; }
          .content { padding: 30px; color: #333333; }
          .button { display: inline-block; padding: 12px 24px; background-color: #000000; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
             <img src="https://centrelabs.org/logo.png" alt="Centre Labs" style="max-width: 150px; height: auto;">
          </div>
          
          <div class="content">
            <h2 style="text-align: center; margin-bottom: 30px;">You left something behind!</h2>
            
            <p>Hi ${customer.firstName},</p>
            <p>We noticed you left some items in your cart. They are waiting for you!</p>
            
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px;">Your Cart Items:</h3>
              <table>
                ${itemsHtml}
              </table>
            </div>

            <div style="text-align: center;">
              <a href="${checkoutUrl}" class="button">Complete Your Purchase</a>
            </div>

            <p style="text-align: center; font-size: 14px; color: #888; margin-top: 20px;">
              Or copy this link: <br>
              <a href="${checkoutUrl}" style="color: #666;">${checkoutUrl}</a>
            </p>
          </div>

          <div class="footer">
            <p>If you have any queries, please contact us at info@centreresearch.org</p>
            <p>5815 W Sunset Blvd, Suite 401, Los Angeles, CA 90028</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = 'Centre Research | Notifications <notifications@centreresearch.org>';
    console.log("Queuing abandoned cart email via Resend...");

    return await sendRawEmail(customer.email, subject, htmlContent, null, from);

  } catch (error) {
    console.error('Error queuing abandoned cart email:', error);
    throw error;
  }
};

module.exports = {
  sendEmailWithTemplate,
  sendOrderConfirmation,
  sendShippingNotification,
  sendOrderCancellation,
  sendWelcomeEmail,
  sendLowInventoryAlert,
  sendStockAlertEmail,
  sendPasswordResetEmail,
  sendAccountVerificationEmail,
  sendPaymentSuccess,
  sendAbandonedCartEmail,
  getEmailTemplate,
  replacePlaceholders,
};

// ===== Additional notifications (shipping manager and sales reps) =====
// Note: These now use Resend API (same as other transactional emails)
// Kept at bottom to avoid disrupting existing exports; explicitly export below.

// Build a professional, minimal HTML table of order items
const buildOrderItemsTableHtml = (order) => {
  try {
    const rows = (order.items || [])
      .map(
        (it) => `
      <tr>
        <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb;">
          ${it.variant?.product?.name || it.variant?.sku || "Item"}
        </td>
        <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb;">${it.quantity}</td>
        <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb;">$${Number(
          it.unitPrice || 0
        ).toFixed(2)}</td>
        <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb;">$${Number(
          (it.unitPrice || 0) * (it.quantity || 0)
        ).toFixed(2)}</td>
      </tr>`
      )
      .join("");

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr>
            <th align="left" style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Item</th>
            <th align="left" style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Qty</th>
            <th align="left" style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Unit</th>
            <th align="left" style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch {
    return "";
  }
};

const sendNewOrderToShippingManager = async (order, customer) => {
  const to = (process.env.SHIPPING_MANAGER_EMAIL || 'noreply@centreresearch.com').trim();
  if (!to) return;

  const total = Number(order.totalAmount || 0).toFixed(2);
  const itemsTable = buildOrderItemsTableHtml(order);
  const shippingAddr = order.shippingAddress || {};

  const html = `
    <div style="background:#f4f4f5; padding: 24px 0; margin:0;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <div style="text-align:center; padding: 20px 0; background:#ffffff;">
          <img src="https://centrelabs.org/logo.png" alt="Centre Labs" style="max-width: 80px; width:auto; height:auto; display:block; margin:0 auto;" />
        </div>

        <div style="padding: 0 24px 8px 24px;">
          <h2 style="margin:0; font-size:20px; line-height:28px; font-weight:700; color:#111827;">New Order Placed</h2>
          <p style="margin:8px 0 0 0; color:#374151; font-size:14px; line-height:22px;">
            A new order has been placed and is ready for processing.
          </p>
        </div>

        <div style="height:1px; background:#e5e7eb; margin:16px 0;"></div>

        <div style="padding: 0 24px 8px 24px;">
          <h3 style="margin:0 0 8px 0; font-size:16px; line-height:24px; font-weight:600; color:#111827;">Order</h3>
          <div style="display:block; width:100%;">
            <div style="padding:6px 0; font-size:14px; color:#111827;"><strong>Order Number:</strong> ${order.orderNumber}</div>
            <div style="padding:6px 0; font-size:14px; color:#111827;"><strong>Total:</strong> $${total}</div>
          </div>
        </div>

        <div style="padding: 0 24px 8px 24px;">
          <h3 style="margin:16px 0 8px 0; font-size:16px; line-height:24px; font-weight:600; color:#111827;">Customer</h3>
          <div style="font-size:14px; line-height:22px; color:#111827;">
            ${customer?.firstName || ''} ${customer?.lastName || ''} (${customer?.email || ''})
          </div>
        </div>

        <div style="padding: 0 24px 8px 24px;">
          <h3 style="margin:16px 0 8px 0; font-size:16px; line-height:24px; font-weight:600; color:#111827;">Shipping Address</h3>
          <div style="font-size:14px; line-height:22px; color:#111827;">
            ${shippingAddr.line1 || ''}${shippingAddr.line2 ? ', ' + shippingAddr.line2 : ''}<br/>
            ${shippingAddr.city || ''}, ${shippingAddr.state || ''} ${shippingAddr.postalCode || ''}<br/>
            ${shippingAddr.country || ''}
          </div>
        </div>

        <div style="padding: 0 24px 24px 24px;">
          <h3 style="margin:16px 0 8px 0; font-size:16px; line-height:24px; font-weight:600; color:#111827;">Items</h3>
          ${itemsTable}
        </div>
      </div>
    </div>
  `;

  console.log('[Resend] Sending shipping manager notification...');
  await resend.emails.send({
    from: 'Notifications | Centre Research <notifications@centreresearch.org>',
    to,
    subject: `New Order: ${order.orderNumber}`,
    html,
  });
  console.log('[Resend] Shipping manager notification sent successfully');
};

const sendNewOrderToSalesRep = async (order, customer, salesRepUser) => {
  const to = (salesRepUser && salesRepUser.email) ? salesRepUser.email.trim() : '';
  if (!to) return;

  const total = Number(order.totalAmount || 0).toFixed(2);
  const itemsTable = buildOrderItemsTableHtml(order);

  const html = `
    <div style="background:#f4f4f5; padding: 24px 0; margin:0;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <div style="text-align:center; padding: 20px 0; background:#ffffff;">
          <img src="https://centrelabs.org/logo.png" alt="Centre Labs" style="max-width: 80px; width:auto; height:auto; display:block; margin:0 auto;" />
        </div>

        <div style="padding: 0 24px 8px 24px;">
          <h2 style="margin:0; font-size:20px; line-height:28px; font-weight:700; color:#111827;">Assigned Customer Order</h2>
          <p style="margin:8px 0 0 0; color:#374151; font-size:14px; line-height:22px;">
            ${customer?.firstName || ""} ${customer?.lastName || ""} (${customer?.email || ""}) placed a new order.
          </p>
        </div>

        <div style="height:1px; background:#e5e7eb; margin:16px 0;"></div>

        <div style="padding: 0 24px 8px 24px;">
          <h3 style="margin:0 0 8px 0; font-size:16px; line-height:24px; font-weight:600; color:#111827;">Order</h3>
          <div style="display:block; width:100%;">
            <div style="padding:6px 0; font-size:14px; color:#111827;"><strong>Order Number:</strong> ${order.orderNumber}</div>
            <div style="padding:6px 0; font-size:14px; color:#111827;"><strong>Total:</strong> $${total}</div>
          </div>
        </div>

        <div style="padding: 0 24px 24px 24px;">
          <h3 style="margin:16px 0 8px 0; font-size:16px; line-height:24px; font-weight:600; color:#111827;">Items</h3>
          ${itemsTable}
        </div>
      </div>
    </div>
  `;

  console.log('[Resend] Sending sales rep notification...');
  await resend.emails.send({
    from: 'Notifications | Centre Research <notifications@centreresearch.org>',
    to,
    subject: `Assigned Customer Order: ${order.orderNumber}`,
    html,
  });
  console.log('[Resend] Sales rep notification sent successfully');
};

// Send login OTP email for passwordless authentication
const sendLoginOtpEmail = async (toEmail, code, firstName = '') => {
  try {
    console.log('[Resend] Sending login OTP email to:', toEmail);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Login Code</title>
      </head>
      <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;">
        <table align="center" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;margin:24px auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
          <tr>
            <td style="padding:24px 24px 0 24px;text-align:center;background:#ffffff;border-bottom:1px solid #f0f0f0;">
              <img src="https://centrelabs.org/logo.png" alt="Centre Labs" width="80" height="60" style="display:block;margin:0 auto;"/>
              <h1 style="margin:16px 0 8px 0;color:#111827;font-size:22px;">Your Login Code</h1>
              <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">Hi ${firstName || 'there'}, use the code below to log in to your account.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <div style="background:#f3f4f6;border-radius:8px;padding:24px;display:inline-block;">
                <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;font-family:monospace;">${code}</span>
              </div>
              <p style="margin:24px 0 0 0;color:#6b7280;font-size:14px;">This code will expire in <strong>15 minutes</strong>.</p>
              <p style="margin:12px 0 0 0;color:#9ca3af;font-size:12px;">If you didn't request this code, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px 24px;color:#9ca3af;font-size:12px;text-align:center;border-top:1px solid #f0f0f0;">
              © ${new Date().getFullYear()} Centre Labs. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const response = await resend.emails.send({
      from: 'Centre Research | Notifications <notifications@centreresearch.org>',
      to: toEmail,
      subject: `Your login code is ${code} for centre Labs login`,
      html,
    });

    if (response.error) {
      console.error('[Resend] Login OTP email error:', response.error);
      throw response.error;
    }

    console.log('[Resend] Login OTP email sent successfully:', response.data?.id || response.id);
    return { success: true, messageId: response.data?.id || response.id };
  } catch (error) {
    console.error('[Resend] Error sending login OTP email:', error);
    throw error;
  }
};

module.exports.sendNewOrderToShippingManager = sendNewOrderToShippingManager;
module.exports.sendNewOrderToSalesRep = sendNewOrderToSalesRep;
module.exports.sendRawEmail = sendRawEmail;
module.exports.emailQueue = emailQueue;
module.exports.sendEmailWithTemplate = sendEmailWithTemplate;
module.exports.sendOrderConfirmation = sendOrderConfirmation;
module.exports.sendShippingNotification = sendShippingNotification;
module.exports.sendOrderCancellation = sendOrderCancellation;
module.exports.sendPaymentSuccess = sendPaymentSuccess;
module.exports.sendWelcomeEmail = sendWelcomeEmail;
module.exports.sendLowInventoryAlert = sendLowInventoryAlert;
module.exports.sendStockAlertEmail = sendStockAlertEmail;
module.exports.sendPasswordResetEmail = sendPasswordResetEmail;
module.exports.sendAccountVerificationEmail = sendAccountVerificationEmail;
module.exports.sendAbandonedCartEmail = sendAbandonedCartEmail;
module.exports.processEmailWithTemplate = processEmailWithTemplate;
module.exports.processEmailWithTemplateResend = processEmailWithTemplateResend;
module.exports.processRawEmailResend = processRawEmailResend;
module.exports.queueEmail = queueEmail;
module.exports.sendLoginOtpEmail = sendLoginOtpEmail;
