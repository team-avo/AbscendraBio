const express = require('express');
const { query } = require('express-validator');
const prisma = require('../prisma/client');
const path = require('path');
const { param } = require('express-validator');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, extractKeyFromUrl } = require('../utils/s3Service');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Public: list third party reports (for customers)
router.get(
  '/',
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
    });

    return res.json({ success: true, data: reports });
  })
);

// Public: get a presigned download URL (forces attachment)
router.get(
  '/:id/download-url',
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

    const { mode } = req.query;
    const disposition = mode === 'inline' ? 'inline' : 'attachment';

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `${disposition}; filename="${filename}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    return res.json({ success: true, data: { url } });
  })
);

// Public: get reports linked to a specific product (or its variants)
router.get(
  '/product/:productId',
  [param('productId').isString().trim().notEmpty(), validateRequest],
  asyncHandler(async (req, res) => {
    const { productId } = req.params;

    // Get all reports linked to this product OR to any of its variants
    const reports = await prisma.thirdPartyReport.findMany({
      where: {
        OR: [
          { products: { some: { id: productId } } },
          { variants: { some: { product: { id: productId } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        url: true,
        category: true,
        createdAt: true,
        variants: {
          select: {
            id: true,
            name: true,
          },
        },
        products: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Add signed URLs for previews
    const reportsWithUrls = await Promise.all(
      reports.map(async (report) => {
        if (!report.url) return { ...report, previewUrl: null };

        const key = extractKeyFromUrl(report.url);
        if (!key) return { ...report, previewUrl: null };

        try {
          const ext = path.extname(key);
          const base = (report.name || 'report').replace(/\"/g, '');
          const filename = `${base}${ext || ''}`;

          const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ResponseContentDisposition: `inline; filename="${filename}"`,
          });

          const previewUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 mins
          return { ...report, previewUrl };
        } catch (e) {
          console.error('Error signing preview URL', e);
          return { ...report, previewUrl: null };
        }
      })
    );

    return res.json({ success: true, data: reportsWithUrls });
  })
);

module.exports = router;
