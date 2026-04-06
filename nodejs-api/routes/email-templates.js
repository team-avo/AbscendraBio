const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const { replacePlaceholders, generateSampleData, validatePlaceholders } = require('../utils/placeholderReplacer');
const { sendEmailWithTemplate } = require('../utils/emailService');
const { uploadSingleImage, uploadMultipleImages, deleteMultipleFilesFromS3, s3Client } = require('../utils/s3Service');

const router = express.Router();


// Test email configuration
router.post('/test', requirePermission('EMAIL_TEMPLATES', 'READ'), [
  body('email').isEmail().withMessage('Valid email is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    // Test with a simple template
    const testData = {
      customerName: 'Test User',
      storeName: 'Centre Labs',
      orderNumber: 'TEST-123',
      orderDate: new Date().toLocaleDateString(),
      orderTotal: '$99.99',
      orderItems: 'Test Product (1x)',
      estimatedDelivery: '3-5 business days',
      storeEmail: 'contact@centreresearch.com',
      storePhone: '+1 (555) 123-4567',
      storeAddress: '123 Research Ave, Science City, SC 12345'
    };

    const result = await sendEmailWithTemplate('ORDER_CONFIRMATION', email, testData);

    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error.message
    });
  }
}));

// Simple email service test
router.post('/test-service', requirePermission('EMAIL_TEMPLATES', 'READ'), [
  body('email').isEmail().withMessage('Valid email is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    console.log('Testing email service...');

    // First, check if template exists
    const template = await prisma.emailTemplate.findUnique({
      where: { type: 'ORDER_CONFIRMATION' }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_CONFIRMATION template not found in database'
      });
    }

    console.log('Template found:', template.name);

    // Test the email service
    const testData = {
      customerName: 'Test User',
      storeName: 'Centre Labs',
      orderNumber: 'TEST-123',
      orderDate: new Date().toLocaleDateString(),
      orderTotal: '$99.99',
      orderItems: 'Test Product (1x)',
      estimatedDelivery: '3-5 business days',
      storeEmail: 'contact@centreresearch.com',
      storePhone: '+1 (555) 123-4567',
      storeAddress: '123 Research Ave, Science City, SC 12345'
    };

    const result = await sendEmailWithTemplate('ORDER_CONFIRMATION', email, testData);

    res.json({
      success: true,
      message: 'Email service test successful',
      data: {
        template: template.name,
        result: result
      }
    });
  } catch (error) {
    console.error('Email service test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Email service test failed',
      details: error.message,
      stack: error.stack
    });
  }
}));

// Check email configuration
router.get('/config', requirePermission('EMAIL_TEMPLATES', 'READ'), asyncHandler(async (req, res) => {
  try {
    const config = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      user: process.env.EMAIL_USER ? '***configured***' : '***missing***',
      password: process.env.EMAIL_PASSWORD ? '***configured***' : '***missing***',
      from: process.env.EMAIL_FROM || 'noreply@centreresearch.com',
      isConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check email configuration',
      details: error.message
    });
  }
}));

// Check email templates in database
router.get('/templates-status', requirePermission('EMAIL_TEMPLATES', 'READ'), asyncHandler(async (req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        subject: true,
        hasHtmlContent: true,
        hasTextContent: true
      }
    });

    const templateStatus = templates.map(template => ({
      id: template.id,
      name: template.name,
      type: template.type,
      isActive: template.isActive,
      subject: template.subject,
      hasHtmlContent: !!template.htmlContent,
      hasTextContent: !!template.textContent
    }));

    res.json({
      success: true,
      data: {
        totalTemplates: templates.length,
        templates: templateStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check email templates',
      details: error.message
    });
  }
}));

// Get all email templates
router.get('/', requirePermission('SETTINGS', 'READ'), asyncHandler(async (req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    // If table doesn't exist yet, return empty array
    if (error.code === 'P2021' || error.message.includes('does not exist')) {
      res.json({
        success: true,
        data: []
      });
    } else {
      throw error;
    }
  }
}));

// Get email template by type
router.get('/:type', requirePermission('SETTINGS', 'READ'), [
  param('type').isIn(['ORDER_CONFIRMATION', 'SHIPPING_NOTIFICATION', 'WELCOME_EMAIL', 'LOW_INVENTORY_ALERT', 'ORDER_CANCELLED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PASSWORD_RESET', 'ACCOUNT_VERIFICATION', 'MARKETING_GENERIC', 'BULK_QUOTE', 'BLACK_FRIDAY', 'PARTNER_STATEMENT_GENERATED', 'PARTNER_PAYMENT_REMINDER', 'PARTNER_OVERDUE_ALERT']).withMessage('Invalid template type'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { type } = req.params;

  const template = await prisma.emailTemplate.findUnique({
    where: { type }
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Email template not found'
    });
  }

  res.json({
    success: true,
    data: template
  });
}));

// Upload single image for email template
router.post('/upload-image', requirePermission('EMAIL_TEMPLATES', 'CREATE'), uploadSingleImage, asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const imageUrl = req.file.location; // S3 URL

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl,
        key: req.file.key,
        filename: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload image',
      details: error.message
    });
  }
}));

// Upload multiple images for email template
router.post('/upload-images', requirePermission('EMAIL_TEMPLATES', 'CREATE'), uploadMultipleImages, asyncHandler(async (req, res) => {
  try {
    console.log('Upload route - Request body:', req.body);
    console.log('Upload route - Request files:', req.files);
    console.log('Upload route - Request headers:', req.headers);

    if (!req.files || req.files.length === 0) {
      console.log('Upload route - No files found in request');
      return res.status(400).json({
        success: false,
        error: 'No image files provided'
      });
    }

    console.log('Upload route - Processing files:', req.files.length);
    const uploadedImages = req.files.map(file => {
      console.log('Upload route - File details:', {
        originalname: file.originalname,
        location: file.location,
        key: file.key,
        size: file.size
      });
      return {
        url: file.location,
        key: file.key,
        filename: file.originalname
      };
    });

    console.log('Upload route - Uploaded images:', uploadedImages);
    res.json({
      success: true,
      message: 'Images uploaded successfully',
      data: uploadedImages
    });
  } catch (error) {
    console.error('Multiple images upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload images',
      details: error.message
    });
  }
}));

// Create email template
router.post('/', requirePermission('EMAIL_TEMPLATES', 'CREATE'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('type').isIn(['ORDER_CONFIRMATION', 'SHIPPING_NOTIFICATION', 'WELCOME_EMAIL', 'LOW_INVENTORY_ALERT', 'ORDER_CANCELLED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PASSWORD_RESET', 'ACCOUNT_VERIFICATION', 'MARKETING_GENERIC', 'BULK_QUOTE', 'BLACK_FRIDAY', 'PARTNER_STATEMENT_GENERATED', 'PARTNER_PAYMENT_REMINDER', 'PARTNER_OVERDUE_ALERT']).withMessage('Invalid template type'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('contentType').isIn(['HTML_CONTENT', 'TEXT_CONTENT']).withMessage('Invalid content type'),
  body('htmlContent').optional().isString().withMessage('HTML content must be a string'),
  body('textContent').optional().isString().withMessage('Text content must be a string'),
  body('backgroundImages').optional().isArray().withMessage('Background images must be an array'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name, type, subject, contentType, htmlContent, textContent, backgroundImages = [], isActive = true } = req.body;

  // Check if template type already exists
  const existingTemplate = await prisma.emailTemplate.findUnique({
    where: { type }
  });

  if (existingTemplate) {
    return res.status(400).json({
      success: false,
      error: 'Template type already exists'
    });
  }

  // Prepare data based on content type
  const templateData = {
    name,
    type,
    subject,
    contentType,
    isActive,
    backgroundImages,
    htmlContent: contentType === 'HTML_CONTENT' ? (htmlContent || '') : '',
    textContent: contentType === 'TEXT_CONTENT' ? (textContent || '') : ''
  };

  const template = await prisma.emailTemplate.create({
    data: templateData
  });

  res.status(201).json({
    success: true,
    message: 'Email template created successfully',
    data: template
  });
}));

// Update email template
router.put('/:id', requirePermission('EMAIL_TEMPLATES', 'UPDATE'), [
  param('id').isString().withMessage('Template ID is required'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('subject').optional().notEmpty().withMessage('Subject cannot be empty'),
  body('contentType').optional().isIn(['HTML_CONTENT', 'TEXT_CONTENT']).withMessage('Invalid content type'),
  body('htmlContent').optional().isString().withMessage('HTML content must be a string'),
  body('textContent').optional().isString().withMessage('Text content must be a string'),
  body('backgroundImages').optional().isArray().withMessage('Background images must be an array'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, subject, contentType, htmlContent, textContent, backgroundImages, isActive } = req.body;

  // Check if template exists
  const existingTemplate = await prisma.emailTemplate.findUnique({
    where: { id }
  });

  if (!existingTemplate) {
    return res.status(404).json({
      success: false,
      error: 'Email template not found'
    });
  }

  // Prepare update data
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (subject !== undefined) updateData.subject = subject;
  if (contentType !== undefined) updateData.contentType = contentType;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (backgroundImages !== undefined) updateData.backgroundImages = backgroundImages;

  // Handle content based on content type
  if (contentType === 'HTML_CONTENT' && htmlContent !== undefined) {
    updateData.htmlContent = htmlContent;
    updateData.textContent = ''; // Clear text content when switching to HTML
  } else if (contentType === 'TEXT_CONTENT' && textContent !== undefined) {
    updateData.textContent = textContent;
    updateData.htmlContent = ''; // Clear HTML content when switching to text
  } else if (htmlContent !== undefined && existingTemplate.contentType === 'HTML_CONTENT') {
    updateData.htmlContent = htmlContent;
  } else if (textContent !== undefined && existingTemplate.contentType === 'TEXT_CONTENT') {
    updateData.textContent = textContent;
  }

  // If backgroundImages is being updated, delete old images from S3
  if (backgroundImages !== undefined && existingTemplate.backgroundImages) {
    try {
      await deleteMultipleFilesFromS3(existingTemplate.backgroundImages);
    } catch (error) {
      console.error('Error deleting old background images:', error);
      // Continue with update even if deletion fails
    }
  }

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: updateData
  });

  res.json({
    success: true,
    message: 'Email template updated successfully',
    data: template
  });
}));

// Delete email template
router.delete('/:id', requirePermission('SETTINGS', 'DELETE'), [
  param('id').isString().withMessage('Template ID is required'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  const template = await prisma.emailTemplate.findUnique({
    where: { id }
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Email template not found'
    });
  }

  // Delete background images from S3 before deleting template
  if (template.backgroundImages && template.backgroundImages.length > 0) {
    try {
      await deleteMultipleFilesFromS3(template.backgroundImages);
    } catch (error) {
      console.error('Error deleting background images:', error);
      // Continue with deletion even if image cleanup fails
    }
  }

  await prisma.emailTemplate.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Email template deleted successfully'
  });
}));

// Preview email template with sample data
router.post('/:type/preview', requirePermission('SETTINGS', 'READ'), [
  param('type').isIn(['ORDER_CONFIRMATION', 'SHIPPING_NOTIFICATION', 'WELCOME_EMAIL', 'LOW_INVENTORY_ALERT', 'ORDER_CANCELLED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PASSWORD_RESET', 'ACCOUNT_VERIFICATION', 'MARKETING_GENERIC', 'BULK_QUOTE', 'BLACK_FRIDAY', 'PARTNER_STATEMENT_GENERATED', 'PARTNER_PAYMENT_REMINDER', 'PARTNER_OVERDUE_ALERT']).withMessage('Invalid template type'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { sampleData = {} } = req.body;

  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { type }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
    }

    // Generate sample data based on template type
    const defaultSampleData = generateSampleData(type);
    const finalSampleData = { ...defaultSampleData, ...sampleData };

    // Replace placeholders in template using the new utility
    const contentToProcess = template.textContent || template.htmlContent;
    const processedContent = replacePlaceholders(contentToProcess, finalSampleData);
    const processedSubject = replacePlaceholders(template.subject, finalSampleData);

    // Validate placeholders
    const validation = validatePlaceholders(contentToProcess);

    res.json({
      success: true,
      data: {
        subject: processedSubject,
        content: processedContent,
        htmlContent: processedContent,
        textContent: template.textContent,
        backgroundImages: template.backgroundImages || [],
        validation: validation
      }
    });
  } catch (error) {
    // If table doesn't exist yet, use default template for preview
    if (error.code === 'P2021' || error.message.includes('does not exist')) {
      const defaultTemplate = getDefaultTemplate(type);
      if (!defaultTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Email template not found'
        });
      }

      // Generate sample data
      const defaultSampleData = generateSampleData(type);
      const finalSampleData = { ...defaultSampleData, ...sampleData };

      // Replace placeholders in template using the new utility
      const contentToProcess = defaultTemplate.htmlContent;
      const processedContent = replacePlaceholders(contentToProcess, finalSampleData);
      const processedSubject = replacePlaceholders(defaultTemplate.subject, finalSampleData);

      // Validate placeholders
      const validation = validatePlaceholders(contentToProcess);

      res.json({
        success: true,
        data: {
          subject: processedSubject,
          content: processedContent,
          htmlContent: processedContent,
          textContent: defaultTemplate.textContent || '',
          backgroundImages: defaultTemplate.backgroundImages || [],
          validation: validation
        }
      });
    } else {
      throw error;
    }
  }
}));



module.exports = router; 