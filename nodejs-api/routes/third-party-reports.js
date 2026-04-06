const express = require('express');
const { body, param, query } = require('express-validator');
const prisma = require('../prisma/client');
const path = require('path');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const { s3Client, uploadSingleThirdPartyReportFile, extractKeyFromUrl, deleteFileFromS3 } = require('../utils/s3Service');

const router = express.Router();

// Upload a single report file to S3 (any file type)
router.post(
  '/upload',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  uploadSingleThirdPartyReportFile,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    return res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: req.file.location,
        key: req.file.key,
        filename: req.file.originalname,
      },
    });
  })
);

// Admin: list reports
router.get(
  '/',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [
    query('category').optional().isIn(['PURITY', 'ENDOTOXICITY', 'STERILITY']),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { category } = req.query;

    const where = {};
    if (category) where.category = String(category);

    const reports = await prisma.thirdPartyReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        products: { select: { id: true, name: true } },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    // Flatten variant.product.name to variant.productName for the frontend
    const flattened = reports.map(r => ({
      ...r,
      variants: (r.variants || []).map(v => ({
        ...v,
        productName: v.product?.name,
        product: undefined,
      })),
    }));

    return res.json({ success: true, data: flattened });
  })
);

// Admin: create report record
router.post(
  '/',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [
    body('category').isIn(['PURITY', 'ENDOTOXICITY', 'STERILITY']),
    body('name').isString().trim().notEmpty(),
    body('description').optional({ nullable: true }).isString(),
    body('url').optional({ nullable: true }).isString().trim().notEmpty(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { category, name, description, url } = req.body;

    const created = await prisma.thirdPartyReport.create({
      data: {
        category: String(category),
        name: String(name),
        description: description ? String(description) : null,
        url: url ? String(url) : null,
      },
      include: {
        products: { select: { id: true, name: true } },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    const flattened = {
      ...created,
      variants: (created.variants || []).map(v => ({
        ...v,
        productName: v.product?.name,
        product: undefined,
      })),
    };

    return res.json({ success: true, data: flattened });
  })
);

// Admin: get report by ID
router.get(
  '/:id',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [param('id').isString().trim().notEmpty(), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const report = await prisma.thirdPartyReport.findUnique({
      where: { id },
      include: {
        products: { select: { id: true, name: true } },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const flattened = {
      ...report,
      variants: (report.variants || []).map(v => ({
        ...v,
        productName: v.product?.name,
        product: undefined,
      })),
    };

    return res.json({ success: true, data: flattened });
  })
);

// Admin: update report record
router.put(
  '/:id',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [
    param('id').isString().trim().notEmpty(),
    body('category').optional().isIn(['PURITY', 'ENDOTOXICITY', 'STERILITY']),
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional({ nullable: true }).isString(),
    body('url').optional({ nullable: true }).isString().trim().notEmpty(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { category, name, description, url } = req.body;

    const updated = await prisma.thirdPartyReport.update({
      where: { id },
      data: {
        ...(category ? { category: String(category) } : {}),
        ...(name ? { name: String(name) } : {}),
        ...(typeof description !== 'undefined' ? { description: description ? String(description) : null } : {}),
        ...(typeof url !== 'undefined' ? { url: url ? String(url) : null } : {}),
      },
      include: {
        products: { select: { id: true, name: true } },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    const flattened = {
      ...updated,
      variants: (updated.variants || []).map(v => ({
        ...v,
        productName: v.product?.name,
        product: undefined,
      })),
    };

    return res.json({ success: true, data: flattened });
  })
);

// Admin: get a presigned download URL (forces attachment)
router.get(
  '/:id/download-url',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [param('id').isString().trim().notEmpty(), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const report = await prisma.thirdPartyReport.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    if (!report.url) {
      return res.status(400).json({ success: false, error: 'No file available' });
    }

    const key = extractKeyFromUrl(report.url);
    if (!key) {
      return res.status(400).json({ success: false, error: 'Invalid file URL' });
    }

    const ext = path.extname(key);
    const base = (report.name || 'report').replace(/\"/g, '');
    const filename = `${base}${ext || ''}`;

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    return res.json({ success: true, data: { url } });
  })
);

// Admin: replace report file (delete old S3 object if possible, upload new, update url)
router.put(
  '/:id/file',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [param('id').isString().trim().notEmpty(), validateRequest],
  uploadSingleThirdPartyReportFile,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const existing = await prisma.thirdPartyReport.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const oldKey = extractKeyFromUrl(existing.url);
    if (oldKey) {
      await deleteFileFromS3(oldKey);
    }

    const updated = await prisma.thirdPartyReport.update({
      where: { id },
      data: {
        url: req.file.location,
      },
    });

    return res.json({
      success: true,
      message: 'File replaced successfully',
      data: {
        report: updated,
        file: {
          url: req.file.location,
          key: req.file.key,
          filename: req.file.originalname,
        },
      },
    });
  })
);

// Admin: delete only the file (keep report record, set url null)
router.delete(
  '/:id/file',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [param('id').isString().trim().notEmpty(), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.thirdPartyReport.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const key = extractKeyFromUrl(existing.url);
    if (key) {
      await deleteFileFromS3(key);
    }

    const updated = await prisma.thirdPartyReport.update({
      where: { id },
      data: { url: null },
    });

    return res.json({ success: true, message: 'File deleted successfully', data: updated });
  })
);

// Admin: delete report record (also attempts to delete the S3 object if url matches configured base)
router.delete(
  '/:id',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [param('id').isString().trim().notEmpty(), validateRequest],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.thirdPartyReport.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const key = extractKeyFromUrl(existing.url);
    if (key) {
      await deleteFileFromS3(key);
    }

    await prisma.thirdPartyReport.delete({ where: { id } });

    return res.json({ success: true, message: 'Report deleted successfully' });
  })
);

// Admin: link report to products/variants
router.post(
  '/:id/links',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [
    param('id').isString().trim().notEmpty(),
    body('productIds').optional().isArray(),
    body('variantIds').optional().isArray(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { productIds = [], variantIds = [] } = req.body;

    const updated = await prisma.thirdPartyReport.update({
      where: { id },
      data: {
        products: {
          connect: productIds.map((pId) => ({ id: pId })),
        },
        variants: {
          connect: variantIds.map((vId) => ({ id: vId })),
        },
      },
      include: {
        products: { select: { id: true, name: true } },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    const flattened = {
      ...updated,
      variants: (updated.variants || []).map(v => ({
        ...v,
        productName: v.product?.name,
        product: undefined,
      })),
    };

    return res.json({ success: true, data: flattened });
  })
);

// Admin: unlink report from products/variants
router.delete(
  '/:id/links',
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  [
    param('id').isString().trim().notEmpty(),
    body('productIds').optional().isArray(),
    body('variantIds').optional().isArray(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { productIds = [], variantIds = [] } = req.body;

    const updated = await prisma.thirdPartyReport.update({
      where: { id },
      data: {
        products: {
          disconnect: productIds.map((pId) => ({ id: pId })),
        },
        variants: {
          disconnect: variantIds.map((vId) => ({ id: vId })),
        },
      },
      include: {
        products: { select: { id: true, name: true } },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    const flattened = {
      ...updated,
      variants: (updated.variants || []).map(v => ({
        ...v,
        productName: v.product?.name,
        product: undefined,
      })),
    };

    return res.json({ success: true, data: flattened });
  })
);

module.exports = router;
