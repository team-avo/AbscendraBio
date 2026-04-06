const express = require('express');
const { uploadSingleImage } = require('../utils/s3Service');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// Upload a single product image to S3
// Requires PRODUCTS CREATE or UPDATE permission
router.post(
  '/image',
  requirePermission('PRODUCTS', 'CREATE'),
  uploadSingleImage,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    return res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: req.file.location,
        key: req.file.key,
        filename: req.file.originalname,
      },
    });
  })
);

module.exports = router;


