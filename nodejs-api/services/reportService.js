const ExcelJS = require('exceljs');
const { formatToLocal } = require('../utils/timezoneUtils');

/**
 * Generate an Excel report buffer for a list of orders.
 */
async function generateOrdersExcel(orders, title = 'Orders Report') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders');

    // Header defining columns
    worksheet.columns = [
        { header: 'Order Number', key: 'orderNumber', width: 25 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Customer Email', key: 'customerEmail', width: 30 },
        { header: 'Order Date', key: 'datePST', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Total Amount ($)', key: 'totalAmount', width: 18 },
        { header: 'Item Count', key: 'itemCount', width: 12 },
        { header: 'Sales Channel', key: 'salesChannel', width: 25 },
        { header: 'Payment Status', key: 'paymentStatus', width: 18 },
    ];

    // Add rows
    orders.forEach(order => {
        worksheet.addRow({
            orderNumber: order.orderNumber || order.id,
            customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Guest',
            customerEmail: order.customer?.email || 'N/A',
            datePST: formatToLocal(order.createdAt),
            status: order.status,
            totalAmount: Number(order.totalAmount || 0).toFixed(2),
            itemCount: order.items?.length || 0,
            salesChannel: order.salesChannel?.companyName || (order.partnerOrderId ? 'Partner' : 'Ascendra Bio'),
            paymentStatus: order.payments && order.payments.length > 0 ? order.payments[0].status : 'PENDING',
        });
    });

    // Make the header row bold
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' } // Dark blue header
    };

    // Auto-filter
    worksheet.autoFilter = 'A1:I1';

    // Return the buffer
    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate a Sales Analytics report buffer.
 */
async function generateSalesAnalyticsExcel(data, rangeDescription) {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Sales Analytics Report Summary']);
    summarySheet.addRow(['Period:', rangeDescription]);
    summarySheet.addRow(['Generated At (Local):', formatToLocal(new Date())]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Revenue:', `$${Number(data.totalRevenue || 0).toFixed(2)}`]);
    summarySheet.addRow(['Total Orders:', data.totalOrders || 0]);

    summarySheet.getRow(1).font = { size: 16, bold: true };
    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 25;

    // Sheet 2: Daily Breakdown
    const dailySheet = workbook.addWorksheet('Daily Breakdown');
    dailySheet.columns = [
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Revenue ($)', key: 'revenue', width: 15 },
        { header: 'Orders', key: 'orders', width: 15 },
    ];

    if (data.daily) {
        data.daily.forEach(d => {
            dailySheet.addRow({
                date: d.date,
                revenue: Number(d.revenue || 0).toFixed(2),
                orders: d.orders || 0
            });
        });
    }

    dailySheet.getRow(1).font = { bold: true };

    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate an Excel report buffer for a list of customers.
 */
async function generateCustomersExcel(customers, title = 'Customers Report') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    worksheet.columns = [
        { header: 'ID', key: 'id', width: 25 },
        { header: 'First Name', key: 'firstName', width: 15 },
        { header: 'Last Name', key: 'lastName', width: 15 },
        { header: 'Company', key: 'companyName', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Type', key: 'customerType', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Approval', key: 'approvalStatus', width: 15 },
        { header: 'Orders', key: 'orderCount', width: 10 },
        { header: 'Created', key: 'createdAt', width: 25 },
    ];

    customers.forEach(customer => {
        worksheet.addRow({
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            companyName: customer.companyName || 'N/A',
            email: customer.email,
            mobile: customer.mobile || 'N/A',
            customerType: customer.customerType,
            status: customer.isActive ? 'Active' : 'Inactive',
            approvalStatus: customer.approvalStatus,
            orderCount: customer._count?.orders || 0,
            createdAt: formatToLocal(customer.createdAt),
        });
    });

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' }
    };
    worksheet.autoFilter = 'A1:K1';

    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate an Excel report buffer for a list of products.
 */
async function generateProductsExcel(products, title = 'Products Report') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    worksheet.columns = [
        { header: 'Product Name', key: 'name', width: 30 },
        { header: 'ShipStation SKU', key: 'shipstationSku', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Categories', key: 'categories', width: 25 },
        { header: 'Tags', key: 'tags', width: 25 },
        { header: 'Variants Count', key: 'variantCount', width: 15 },
        { header: 'Price Range ($)', key: 'priceRange', width: 20 },
        { header: 'Created', key: 'createdAt', width: 25 },
    ];

    products.forEach(product => {
        const categories = (product.categories || []).map(c => c.name).join(', ');
        const tags = (product.tags || []).map(t => t.tag).join(', ');
        const variantCount = product.variants?.length || 0;

        let priceRange = 'N/A';
        if (product.variants && product.variants.length > 0) {
            const prices = product.variants.map(v => Number(v.regularPrice || 0));
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            priceRange = minPrice === maxPrice ? minPrice.toFixed(2) : `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`;
        }

        worksheet.addRow({
            name: product.name,
            shipstationSku: product.shipstationSku || 'N/A',
            status: product.status,
            categories,
            tags,
            variantCount,
            priceRange,
            createdAt: formatToLocal(product.createdAt),
        });
    });

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' }
    };
    worksheet.autoFilter = 'A1:H1';

    return await workbook.xlsx.writeBuffer();
}

/**
 * Generate an Excel report buffer for a list of transactions.
 */
async function generateTransactionsExcel(transactions, title = 'Transactions Report') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transactions');

    worksheet.columns = [
        { header: 'ID', key: 'id', width: 25 },
        { header: 'Order Number', key: 'orderNumber', width: 20 },
        { header: 'Customer', key: 'customerName', width: 25 },
        { header: 'Amount ($)', key: 'amount', width: 15 },
        { header: 'Status', key: 'paymentStatus', width: 15 },
        { header: 'Gateway', key: 'paymentGatewayName', width: 20 },
        { header: 'Gateway Transaction ID', key: 'gatewayTxId', width: 25 },
        { header: 'Date', key: 'createdAt', width: 25 },
    ];

    transactions.forEach(tx => {
        worksheet.addRow({
            id: tx.id,
            orderNumber: tx.order?.orderNumber || tx.orderId,
            customerName: tx.order?.customer ? `${tx.order.customer.firstName} ${tx.order.customer.lastName}` : 'N/A',
            amount: Number(tx.amount || 0).toFixed(2),
            paymentStatus: tx.paymentStatus,
            paymentGatewayName: tx.paymentGatewayName,
            gatewayTxId: tx.paymentGatewayTransactionId || 'N/A',
            createdAt: formatToLocal(tx.createdAt),
        });
    });

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' }
    };
    worksheet.autoFilter = 'A1:H1';

    return await workbook.xlsx.writeBuffer();
}

module.exports = {
    generateOrdersExcel,
    generateSalesAnalyticsExcel,
    generateCustomersExcel,
    generateProductsExcel,
    generateTransactionsExcel
};
