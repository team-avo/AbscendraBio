/**
 * Report Generation Worker
 * 
 * Processes jobs from the 'report-queue'.
 * Generates Excel files and sends them via email.
 */

const prisma = require("../prisma/client");
const { reportQueue } = require("../services/reportQueue");
const {
    generateOrdersExcel,
    generateSalesAnalyticsExcel,
    generateCustomersExcel,
    generateProductsExcel,
    generateTransactionsExcel
} = require('../services/reportService');
const { processRawEmailResend } = require("../utils/emailService");
const logger = require("../utils/logger");
const { getPSTFinancialRange } = require("../utils/timezoneUtils");

// Process jobs
reportQueue.process(async (job) => {
    const { type, email, filters = {}, user } = job.data;
    logger.info(`[ReportWorker] Processing job ${job.id} of type ${type} for ${email}`);

    try {
        switch (type.toUpperCase()) {
            case 'ORDERS':
                await processOrdersReport(job.data);
                break;
            case 'ANALYTICS':
                await processAnalyticsReport(job.data);
                break;
            case 'CUSTOMERS':
                await processCustomersReport(job.data);
                break;
            case 'PRODUCTS':
                await processProductsReport(job.data);
                break;
            case 'TRANSACTIONS':
                await processTransactionsReport(job.data);
                break;
            default:
                logger.warn(`Unknown report type: ${type}`);
                throw new Error(`Unknown report type: ${type}`);
        }

        logger.info(`[ReportWorker] Job ${job.id} completed successfully`);
        return { success: true };
    } catch (error) {
        logger.error(`[ReportWorker] Job ${job.id} failed:`, error);
        throw error;
    }
});

/**
 * Handle Orders Report Data Fetching
 */
async function processOrdersReport(data) {
    const { email, filters = {}, user } = data;
    const where = {};
    const filtersToProcess = { ...filters };

    // 1. Process failedPayments filter
    if (filtersToProcess.failedPayments === "true" || filtersToProcess.failedPayments === true) {
        where.AND = [...(where.AND || []), { payments: { some: { status: "FAILED" } } }];
        delete filtersToProcess.failedPayments;
    }

    // 2. Process search filter
    if (filtersToProcess.search) {
        const searchTerms = filtersToProcess.search.split(/\s+/).filter(Boolean);
        if (searchTerms.length > 0) {
            const searchConditions = searchTerms.map((term) => ({
                OR: [
                    { orderNumber: { contains: term, mode: "insensitive" } },
                    { customer: { email: { contains: term, mode: "insensitive" } } },
                    { customer: { firstName: { contains: term, mode: "insensitive" } } },
                    { customer: { lastName: { contains: term, mode: "insensitive" } } },
                ],
            }));
            where.AND = [...(where.AND || []), ...searchConditions];
        }
        delete filtersToProcess.search;
    }

    // 3. Process date filters
    if (filtersToProcess.dateFrom || filtersToProcess.dateTo) {
        where.createdAt = {};
        if (filtersToProcess.dateFrom) where.createdAt.gte = new Date(filtersToProcess.dateFrom);
        if (filtersToProcess.dateTo) where.createdAt.lte = new Date(filtersToProcess.dateTo);
    }

    // Role-based restrictions
    if (user.role === "SALES_REP") {
        where.customer = {
            salesAssignments: { some: { salesRep: { userId: user.id } } },
        };
    } else if (user.role === "SALES_MANAGER") {
        where.customer = {
            salesManagerAssignments: { some: { salesManager: { userId: user.id } } },
        };
    }

    const orders = await prisma.order.findMany({
        where,
        include: {
            customer: true,
            salesChannel: true,
            payments: { take: 1, orderBy: { createdAt: "desc" } },
            items: true,
        },
        orderBy: { createdAt: "desc" },
    });

    const buffer = await generateOrdersExcel(orders);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `orders-report-${timestamp}.xlsx`;

    await processRawEmailResend({
        to: email,
        subject: 'Your Orders Report',
        text: 'Please find attached the orders report you requested.',
        html: '<p>Please find attached the orders report you requested.</p>',
        attachments: [
            {
                filename,
                content: buffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        ]
    });

    logger.info(`Orders report sent to ${email}`);
}

/**
 * Handle Analytics Report Data Fetching
 */
async function processAnalyticsReport(data) {
    const { email, filters = {}, user } = data;
    const { range = "last_30_days", from, to, salesChannelId } = filters;

    logger.info(`Processing analytics report for ${email}, range: ${range}`);

    const fromParam = from ? new Date(from) : null;
    const toParam = to ? new Date(to) : null;
    let start, end;
    const now = new Date();

    // Range logic (copied from analytics route)
    if (range === "day" && fromParam) {
        const r = getPSTFinancialRange(fromParam, fromParam);
        start = r.start; end = r.end;
    } else if (range === "last_7_days") {
        const startDay = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
        const r = getPSTFinancialRange(startDay, now);
        start = r.start; end = r.end;
    } else if (range === "last_30_days") {
        const startDay = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
        const r = getPSTFinancialRange(startDay, now);
        start = r.start; end = r.end;
    } else if (range === "last_90_days") {
        const startDay = new Date(now.getTime() - 89 * 24 * 3600 * 1000);
        const r = getPSTFinancialRange(startDay, now);
        start = r.start; end = r.end;
    } else {
        start = fromParam || new Date(now.getTime() - 29 * 24 * 3600 * 1000);
        end = toParam || now;
    }

    const where = {
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" }
    };

    if (salesChannelId === "research") where.salesChannelId = null;
    else if (salesChannelId === "channels") where.salesChannelId = { not: null };
    else if (salesChannelId) where.salesChannelId = salesChannelId;

    if (filters.managerId) {
        where.customer = { managerId: filters.managerId };
    } else if (filters.salesRepId) {
        where.customer = { salesRepId: filters.salesRepId };
    }

    const orders = await prisma.order.findMany({ where, select: { totalAmount: true, createdAt: true } });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalOrders = orders.length;

    const buffer = await generateSalesAnalyticsExcel({
        totalRevenue,
        totalOrders,
        daily: [] // Simplified breakdown
    }, `${range} (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sales-analytics-${timestamp}.xlsx`;

    await processRawEmailResend({
        to: email,
        subject: 'Your Sales Analytics Report',
        text: 'Please find attached the sales analytics report you requested.',
        html: '<p>Please find attached the sales analytics report you requested.</p>',
        attachments: [
            {
                filename,
                content: buffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        ]
    });

    logger.info(`Analytics report sent to ${email}`);
}

/**
 * Handle Customers Report Data Fetching
 */
async function processCustomersReport(data) {
    const { email, filters = {} } = data;
    const where = {};
    if (filters.customerType) where.customerType = filters.customerType;
    if (filters.isActive !== undefined) where.isActive = filters.isActive === "true" || filters.isActive === true;
    if (filters.isApproved !== undefined) where.isApproved = filters.isApproved === "true" || filters.isApproved === true;
    if (filters.approvalStatus) where.approvalStatus = filters.approvalStatus;

    const customers = await prisma.customer.findMany({
        where,
        include: {
            _count: { select: { orders: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    const buffer = await generateCustomersExcel(customers);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `customers-report-${timestamp}.xlsx`;

    await processRawEmailResend({
        to: email,
        subject: 'Your Customers Report',
        text: 'Please find attached the customers report you requested.',
        html: '<p>Please find attached the customers report you requested.</p>',
        attachments: [
            {
                filename,
                content: buffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        ]
    });

    logger.info(`Customers report sent to ${email}`);
}

/**
 * Handle Products Report Data Fetching
 */
async function processProductsReport(data) {
    const { email } = data;
    logger.info(`Processing products report for ${email}`);

    try {
        const products = await prisma.product.findMany({
            include: {
                variants: {
                    select: {
                        regularPrice: true,
                        salePrice: true,
                    }
                },
                categories: {
                    select: { name: true }
                },
                tags: {
                    select: { tag: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        const buffer = await generateProductsExcel(products);
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `products-export-${timestamp}.xlsx`;

        await processRawEmailResend({
            to: email,
            subject: 'Your Product Catalog Report',
            text: 'Please find attached the product catalog report you requested.',
            html: '<p>Please find attached the product catalog report you requested.</p>',
            attachments: [
                {
                    filename,
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            ]
        });

        logger.info(`Products report sent to ${email}`);
    } catch (error) {
        logger.error(`Error processing products report: ${error.message}`, { error });
        throw error;
    }
}

/**
 * Handle Transactions Report Data Fetching
 */
async function processTransactionsReport(data) {
    const { email, filters = {} } = data;
    const { orderId, paymentStatus, paymentGatewayName, search } = filters;

    logger.info(`Processing transactions report for ${email}`);

    const where = {};
    if (orderId) where.orderId = orderId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentGatewayName) where.paymentGatewayName = paymentGatewayName;

    if (search) {
        where.OR = [
            { id: { contains: search, mode: 'insensitive' } },
            { orderId: { contains: search, mode: 'insensitive' } },
            { paymentGatewayTransactionId: { contains: search, mode: 'insensitive' } },
            { order: { customer: { firstName: { contains: search, mode: 'insensitive' } } } },
            { order: { customer: { lastName: { contains: search, mode: 'insensitive' } } } },
            { order: { customer: { email: { contains: search, mode: 'insensitive' } } } },
        ];
    }

    try {
        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                order: {
                    include: {
                        customer: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const buffer = await generateTransactionsExcel(transactions);
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `transactions-report-${timestamp}.xlsx`;

        await processRawEmailResend({
            to: email,
            subject: 'Your Payment Transactions Report',
            text: 'Please find attached the payment transactions report you requested.',
            html: '<p>Please find attached the payment transactions report you requested.</p>',
            attachments: [
                {
                    filename,
                    content: buffer,
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            ]
        });

        logger.info(`Transactions report sent to ${email}`);
    } catch (error) {
        logger.error(`Error processing transactions report: ${error.message}`, { error });
        throw error;
    }
}

module.exports = {
    reportQueue
};
