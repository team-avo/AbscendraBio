const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole } = require("../middleware/auth");
const logger = require("../utils/logger");
const { uploadMultipleImages, generateS3Url } = require("../utils/s3Service");

const router = express.Router();

// ─── helpers ────────────────────────────────────────────────────────
const STAFF_ROLES = ["ADMIN", "MANAGER", "STAFF", "SALES_REP", "SALES_MANAGER"];

const userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    role: true,
};

// Recursively include replies (two levels deep to keep response size sane)
const repliesInclude = {
    replies: {
        include: {
            user: { select: userSelect },
            replies: {
                include: {
                    user: { select: userSelect },
                },
                orderBy: { createdAt: "asc" },
            },
        },
        orderBy: { createdAt: "asc" },
    },
};

// ─── CREATE COMMENT ─────────────────────────────────────────────────
// POST /comments
// Body: { type: "ORDER"|"CUSTOMER", content, orderId?, customerId? }
router.post(
    "/",
    [
        body("type")
            .isIn(["ORDER", "CUSTOMER"])
            .withMessage("type must be ORDER or CUSTOMER"),
        body("content")
            .notEmpty()
            .withMessage("content is required")
            .isLength({ max: 5000 })
            .withMessage("content must be under 5000 characters"),
        body("orderId").optional().isString(),
        body("customerId").optional().isString(),
        body("images").optional().isArray().withMessage("images must be an array of strings"),
        validateRequest,
    ],
    asyncHandler(async (req, res) => {
        const { type, content, orderId, customerId, images = [] } = req.body;
        const user = req.user;

        // ── Validate target ────────────────────────────────────────
        if (type === "ORDER") {
            if (!orderId) {
                return res
                    .status(400)
                    .json({ success: false, error: "orderId is required for ORDER comments" });
            }
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (!order) {
                return res
                    .status(404)
                    .json({ success: false, error: "Order not found" });
            }
            // Customers may only comment on their own orders
            if (user.role === "CUSTOMER") {
                if (!user.customerId || order.customerId !== user.customerId) {
                    return res
                        .status(403)
                        .json({ success: false, error: "You can only comment on your own orders" });
                }
            }
        }

        if (type === "CUSTOMER") {
            if (!customerId) {
                return res
                    .status(400)
                    .json({ success: false, error: "customerId is required for CUSTOMER comments" });
            }

            // Customers may only comment on their own profile
            if (user.role === "CUSTOMER") {
                if (!user.customerId || customerId !== user.customerId) {
                    return res
                        .status(403)
                        .json({ success: false, error: "You can only comment on your own profile" });
                }
            } else if (!STAFF_ROLES.includes(user.role)) {
                // Other non-staff roles cannot create customer comments
                return res
                    .status(403)
                    .json({ success: false, error: "Access denied" });
            }

            const customer = await prisma.customer.findUnique({ where: { id: customerId } });
            if (!customer) {
                return res
                    .status(404)
                    .json({ success: false, error: "Customer not found" });
            }
        }

        // ── Create ─────────────────────────────────────────────────
        const comment = await prisma.comment.create({
            data: {
                type,
                content,
                userId: user.id,
                orderId: type === "ORDER" ? orderId : null,
                customerId: type === "CUSTOMER" ? customerId : null,
                images,
            },
            include: {
                user: { select: userSelect },
                ...repliesInclude,
            },
        });

        res.status(201).json({
            success: true,
            message: "Comment created successfully",
            data: comment,
        });
    }),
);

// ─── REPLY TO COMMENT ───────────────────────────────────────────────
// POST /comments/:id/reply
// Body: { content }
router.post(
    "/:id/reply",
    [
        param("id").isString().withMessage("Comment ID is required"),
        body("content")
            .notEmpty()
            .withMessage("content is required")
            .isLength({ max: 5000 })
            .withMessage("content must be under 5000 characters"),
        body("images").optional().isArray().withMessage("images must be an array of strings"),
        validateRequest,
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { content, images = [] } = req.body;
        const user = req.user;

        // Find parent comment
        const parent = await prisma.comment.findUnique({
            where: { id },
        });
        if (!parent) {
            return res
                .status(404)
                .json({ success: false, error: "Comment not found" });
        }

        // Staff can reply to any comment
        // Customers can reply only on their own order comments
        if (user.role === "CUSTOMER") {
            if (parent.type === "ORDER") {
                if (!user.customerId) {
                    return res
                        .status(403)
                        .json({ success: false, error: "Access denied" });
                }
                const order = await prisma.order.findUnique({ where: { id: parent.orderId } });
                if (!order || order.customerId !== user.customerId) {
                    return res
                        .status(403)
                        .json({ success: false, error: "You can only reply on your own order comments" });
                }
            } else if (parent.type === "CUSTOMER") {
                if (!user.customerId || parent.customerId !== user.customerId) {
                    return res
                        .status(403)
                        .json({ success: false, error: "You can only reply on your own profile comments" });
                }
            } else {
                // Customers cannot reply on other types
                return res
                    .status(403)
                    .json({ success: false, error: "Access denied" });
            }
        }

        const reply = await prisma.comment.create({
            data: {
                type: parent.type,
                content,
                userId: user.id,
                orderId: parent.orderId,
                customerId: parent.customerId,
                parentId: id,
                images,
            },
            include: {
                user: { select: userSelect },
            },
        });

        res.status(201).json({
            success: true,
            message: "Reply added successfully",
            data: reply,
        });
    }),
);

// ─── LIST COMMENTS ──────────────────────────────────────────────────
// GET /comments?type=ORDER&orderId=xxx  or  ?type=CUSTOMER&customerId=xxx
// Also supports: page, limit
router.get(
    "/",
    [
        query("type").optional().isIn(["ORDER", "CUSTOMER"]),
        query("orderId").optional().isString(),
        query("customerId").optional().isString(),
        query("page").optional().isInt({ min: 1 }),
        query("limit").optional().isInt({ min: 1, max: 100 }),
        query("includeOrderComments").optional().isBoolean(),
        validateRequest,
    ],
    asyncHandler(async (req, res) => {
        const user = req.user;
        const {
            type,
            orderId,
            customerId,
            includeOrderComments,
            page = "1",
            limit = "20",
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build where clause — only top-level (non-reply) comments
        let where = { parentId: null };

        if (type) where.type = type;
        if (orderId) where.orderId = orderId;
        if (customerId) {
            if (includeOrderComments === "true") {
                // Fetch both customer comments and order comments for this customer
                where = {
                    parentId: null,
                    OR: [
                        { customerId: customerId },
                        { order: { customerId: customerId } }
                    ]
                };
            } else {
                where.customerId = customerId;
            }
        }

        // Customers can only see their own order comments or their own profile comments
        if (user.role === "CUSTOMER") {
            if (!user.customerId) {
                return res.json({
                    success: true,
                    data: { comments: [], pagination: { page: 1, limit: limitNum, total: 0, pages: 0 } },
                });
            }

            if (type === "CUSTOMER") {
                // Filter by their own customer ID
                where.customerId = customerId && customerId === user.customerId
                    ? customerId
                    : user.customerId;
            } else if (type === "ORDER") {
                // For ORDER type, filter by their own orders
                const customerOrders = await prisma.order.findMany({
                    where: { customerId: user.customerId },
                    select: { id: true },
                });
                const orderIds = customerOrders.map((o) => o.id);
                where.orderId = orderId && orderIds.includes(orderId)
                    ? orderId
                    : { in: orderIds };
            } else {
                // Generic list: either their customer ID OR their orders
                where = {
                    parentId: null,
                    OR: [
                        { customerId: user.customerId },
                        { order: { customerId: user.customerId } }
                    ]
                };
            }
        }

        const [comments, total] = await Promise.all([
            prisma.comment.findMany({
                where,
                include: {
                    user: { select: userSelect },
                    order: {
                        select: {
                            id: true,
                            orderNumber: true,
                            status: true,
                        },
                    },
                    customer: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    ...repliesInclude,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limitNum,
            }),
            prisma.comment.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                comments,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }),
);

// ─── GET COMMENTS COUNT FOR ORDERS AND CUSTOMERS (batch) ────────────────
// GET /comments/counts?orderIds=id1,id2&customerIds=c1,c2
// Returns { orders: { orderId: count }, customers: { customerId: count } }
router.get(
    "/counts",
    [
        query("orderIds").optional().isString(),
        query("customerIds").optional().isString(),
        validateRequest,
    ],
    asyncHandler(async (req, res) => {
        const { orderIds, customerIds } = req.query;
        const oIds = orderIds ? orderIds.split(",").map((id) => id.trim()).filter(Boolean) : [];
        const cIds = customerIds ? customerIds.split(",").map((id) => id.trim()).filter(Boolean) : [];

        const [orderCounts, customerCounts] = await Promise.all([
            oIds.length > 0
                ? prisma.comment.groupBy({
                    by: ["orderId"],
                    where: {
                        orderId: { in: oIds },
                    },
                    _count: { id: true },
                })
                : [],
            cIds.length > 0
                ? prisma.comment.groupBy({
                    by: ["customerId"],
                    where: {
                        customerId: { in: cIds },
                    },
                    _count: { id: true },
                })
                : [],
        ]);

        const orderCountMap = {};
        orderCounts.forEach((c) => {
            if (c.orderId) orderCountMap[c.orderId] = c._count.id;
        });

        const customerCountMap = {};
        customerCounts.forEach((c) => {
            if (c.customerId) customerCountMap[c.customerId] = c._count.id;
        });

        res.json({
            success: true,
            data: {
                orders: orderCountMap,
                customers: customerCountMap,
            },
        });
    }),
);

// ─── UPLOAD IMAGES ──────────────────────────────────────────────────
// POST /comments/upload
router.post(
    "/upload",
    requireRole(STAFF_ROLES),
    uploadMultipleImages,
    asyncHandler(async (req, res) => {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: "No files uploaded" });
        }

        const urls = req.files.map((file) => file.location);

        res.json({
            success: true,
            data: { urls },
        });
    }),
);

// ─── UPDATE COMMENT ─────────────────────────────────────────────────
// PATCH /comments/:id
// Body: { content }
router.patch(
    "/:id",
    [
        param("id").isString().withMessage("Comment ID is required"),
        body("content")
            .notEmpty()
            .withMessage("content is required")
            .isLength({ max: 5000 })
            .withMessage("content must be under 5000 characters"),
        body("images").optional().isArray().withMessage("images must be an array of strings"),
        validateRequest,
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { content, images } = req.body;
        const user = req.user;

        const comment = await prisma.comment.findUnique({ where: { id } });
        if (!comment) {
            return res.status(404).json({ success: false, error: "Comment not found" });
        }

        // Only comment owner can edit, or ADMIN/MANAGER
        if (comment.userId !== user.id && !["ADMIN", "MANAGER"].includes(user.role)) {
            return res.status(403).json({ success: false, error: "Access denied" });
        }

        const updated = await prisma.comment.update({
            where: { id },
            data: {
                content,
                ...(images && { images })
            },
            include: {
                user: { select: userSelect },
                ...repliesInclude,
            },
        });

        res.json({
            success: true,
            message: "Comment updated successfully",
            data: updated,
        });
    }),
);

// ─── DELETE COMMENT ─────────────────────────────────────────────────
// DELETE /comments/:id
// Owner or ADMIN/MANAGER can delete
router.delete(
    "/:id",
    [
        param("id").isString().withMessage("Comment ID is required"),
        validateRequest,
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const user = req.user;

        const comment = await prisma.comment.findUnique({ where: { id } });
        if (!comment) {
            return res
                .status(404)
                .json({ success: false, error: "Comment not found" });
        }

        // Only comment owner, ADMIN, or MANAGER can delete
        if (
            comment.userId !== user.id &&
            !["ADMIN", "MANAGER"].includes(user.role)
        ) {
            return res
                .status(403)
                .json({ success: false, error: "Access denied" });
        }

        // Cascade will handle deleting child replies
        await prisma.comment.delete({ where: { id } });

        res.json({
            success: true,
            message: "Comment deleted successfully",
        });
    }),
);

module.exports = router;
