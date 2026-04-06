const express = require('express');
const { body, param } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// ========================================
// CUSTOM LOCATION MANAGEMENT (Country/State/City)
// Must come BEFORE /:id route to avoid conflicts
// ========================================

// Public: Get all unique countries
router.get(
  '/custom/countries',
  asyncHandler(async (req, res) => {
    const countries = await prisma.customStateCity.findMany({
      where: {
        isActive: true,
        state: null,
        city: null
      },
      select: { country: true },
      orderBy: { country: 'asc' }
    });

    const uniqueCountries = [...new Set(countries.map(c => c.country))];
    res.json({ success: true, data: uniqueCountries });
  })
);

// Public: Get states for a country
router.get(
  '/custom/states',
  asyncHandler(async (req, res) => {
    const { country } = req.query;

    if (!country) {
      return res.status(400).json({ success: false, error: 'Country parameter is required' });
    }

    const states = await prisma.customStateCity.findMany({
      where: {
        isActive: true,
        country: country,
        state: { not: null },
        city: null
      },
      select: { state: true },
      orderBy: { state: 'asc' }
    });

    const uniqueStates = [...new Set(states.map(s => s.state).filter(Boolean))];
    res.json({ success: true, data: uniqueStates });
  })
);

// Public: Get cities for a country and state
router.get(
  '/custom/cities',
  asyncHandler(async (req, res) => {
    const { country, state } = req.query;

    if (!country) {
      return res.status(400).json({ success: false, error: 'Country parameter is required' });
    }

    const where = {
      isActive: true,
      country: country,
      city: { not: null }
    };

    if (state) {
      where.state = state;
    }

    const cities = await prisma.customStateCity.findMany({
      where,
      select: { city: true },
      orderBy: { city: 'asc' }
    });

    const uniqueCities = [...new Set(cities.map(c => c.city).filter(Boolean))];
    res.json({ success: true, data: uniqueCities });
  })
);

// Admin: List all custom locations (with pagination and search)
router.get(
  '/custom',
  requirePermission('SETTINGS', 'READ'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, country, state, isActive } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (search) {
      where.OR = [
        { country: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (country) where.country = country;
    if (state) where.state = state;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [locations, total] = await Promise.all([
      prisma.customStateCity.findMany({
        where,
        skip,
        take,
        orderBy: [
          { country: 'asc' },
          { state: 'asc' },
          { city: 'asc' }
        ]
      }),
      prisma.customStateCity.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        locations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  })
);

// Admin: Create a new custom location
router.post(
  '/custom',
  requirePermission('SETTINGS', 'CREATE'),
  [
    body('country').isString().trim().notEmpty().withMessage('Country is required'),
    body('state').optional({ nullable: true }).isString().trim(),
    body('city').optional({ nullable: true }).isString().trim(),
    body('isActive').optional().isBoolean(),
    validateRequest
  ],
  asyncHandler(async (req, res) => {
    const { country, state, city, isActive = true } = req.body;

    // Check for duplicate
    const existing = await prisma.customStateCity.findFirst({
      where: {
        country,
        state: state || null,
        city: city || null
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'This location combination already exists'
      });
    }

    const location = await prisma.customStateCity.create({
      data: {
        country,
        state: state || null,
        city: city || null,
        isActive
      }
    });

    res.status(201).json({ success: true, data: location });
  })
);

// Admin: Bulk delete custom locations
router.post(
  '/custom/bulk-delete',
  requirePermission('SETTINGS', 'DELETE'),
  [
    body('ids').isArray().withMessage('IDs must be an array'),
    body('ids.*').isString().withMessage('Each ID must be a string'),
    validateRequest
  ],
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    const result = await prisma.customStateCity.deleteMany({
      where: { id: { in: ids } }
    });

    res.json({ success: true, data: { count: result.count } });
  })
);

// Admin: Update a custom location
router.put(
  '/custom/:id',
  requirePermission('SETTINGS', 'UPDATE'),
  [
    param('id').isString().withMessage('Location ID is required'),
    body('country').optional().isString().trim(),
    body('state').optional({ nullable: true }).isString().trim(),
    body('city').optional({ nullable: true }).isString().trim(),
    body('isActive').optional().isBoolean(),
    validateRequest
  ],
  asyncHandler(async (req, res) => {
    const { country, state, city, isActive } = req.body;

    const updateData = {};
    if (country !== undefined) updateData.country = country;
    if (state !== undefined) updateData.state = state || null;
    if (city !== undefined) updateData.city = city || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const location = await prisma.customStateCity.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({ success: true, data: location });
  })
);

// Admin: Delete a custom location
router.delete(
  '/custom/:id',
  requirePermission('SETTINGS', 'DELETE'),
  [param('id').isString().withMessage('Location ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    await prisma.customStateCity.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

// ========================================
// WAREHOUSE LOCATION MANAGEMENT
// ========================================

// List all warehouse locations
router.get(
  '/',
  requirePermission('INVENTORY', 'READ'),
  asyncHandler(async (req, res) => {
    const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: locations });
  })
);

// Create a new warehouse location
router.post(
  '/',
  requirePermission('INVENTORY', 'CREATE'),
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('address').optional({ nullable: true }).isString(),
    body('city').optional({ nullable: true }).isString(),
    body('state').optional({ nullable: true }).isString(),
    body('country').optional({ nullable: true }).isString(),
    body('postalCode').optional({ nullable: true }).isString(),
    body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
    body('mobile').optional({ nullable: true }).isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { name, address, city, state, country, postalCode, email, mobile } = req.body;
    const location = await prisma.location.create({
      data: {
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || 'US',
        postalCode: postalCode || null,
        email: email || null,
        mobile: mobile || null,
      }
    });
    res.status(201).json({ success: true, data: location });
  })
);

// Get a single warehouse location (MUST come after all /custom routes)
router.get(
  '/:id',
  requirePermission('INVENTORY', 'READ'),
  [param('id').isString().withMessage('Location ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    const location = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });
    res.json({ success: true, data: location });
  })
);

// Update a warehouse location
router.put(
  '/:id',
  requirePermission('INVENTORY', 'UPDATE'),
  [
    param('id').isString().withMessage('Location ID is required'),
    body('name').optional().isString(),
    body('address').optional({ nullable: true }).isString(),
    body('city').optional({ nullable: true }).isString(),
    body('state').optional({ nullable: true }).isString(),
    body('country').optional({ nullable: true }).isString(),
    body('postalCode').optional({ nullable: true }).isString(),
    body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
    body('mobile').optional({ nullable: true }).isString(),
    body('isActive').optional().isBoolean(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { name, address, city, state, country, postalCode, email, mobile, isActive } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (country !== undefined) updateData.country = country || 'US';
    if (postalCode !== undefined) updateData.postalCode = postalCode || null;
    if (email !== undefined) updateData.email = email || null;
    if (mobile !== undefined) updateData.mobile = mobile || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const location = await prisma.location.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json({ success: true, data: location });
  })
);

// Delete a warehouse location
router.delete(
  '/:id',
  requirePermission('INVENTORY', 'DELETE'),
  [param('id').isString().withMessage('Location ID is required'), validateRequest],
  asyncHandler(async (req, res) => {
    await prisma.location.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

module.exports = router;