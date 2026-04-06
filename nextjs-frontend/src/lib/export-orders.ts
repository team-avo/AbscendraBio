import * as XLSX from 'xlsx';
import { Order } from './api';

function formatToPST(dateVal?: string | Date | null) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-CA', options);
        return formatter.format(d).replace(', ', ' ') + ' PST';
    } catch {
        return '';
    }
}

/**
 * Standardizes the order data for Excel export.
 * @param orders Array of orders to export
 * @returns XLSX.WorkBook object
 */
export function ordersToExcel(orders: Order[]) {
    const exportData = orders.map(order => {
        // Get sales rep from salesAssignments if available
        const salesAssignment = order.customer?.salesAssignments?.[0];
        const salesRep = salesAssignment?.salesRep;
        const salesRepName = salesRep?.user
            ? `${salesRep.user.firstName} ${salesRep.user.lastName}`
            : 'N/A';

        return {
            'Order ID': order.orderNumber || order.id,
            'Customer Name': order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Guest',
            'Customer Email': order.customer?.email || 'N/A',
            'Sales Rep': salesRepName,
            'Status': order.status,
            'Payment Status': order.payments && order.payments.length > 0 ? order.payments[0].status : 'PENDING',
            'Total Amount': `$${Number(order.totalAmount || 0).toFixed(2)}`,
            'Items Count': order.items?.length || 0,
            'Created Date': formatToPST(order.createdAt),
            'Notes': order.notes && Array.isArray(order.notes) && order.notes.length > 0 ? order.notes[0].note : '',
            'Sales Channel': order.salesChannel?.companyName || (order.partnerOrderId ? 'Partner Order' : 'Centre Research'),
            'Partner Order ID': order.partnerOrderId || 'N/A'
        };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');

    return wb;
}

/**
 * Triggers a download of the orders Excel file.
 * @param orders Array of orders to export
 * @param fileName Name of the file to be saved
 */
export function downloadOrdersExcel(orders: Order[], fileName: string) {
    const wb = ordersToExcel(orders);
    XLSX.writeFile(wb, fileName);
}
