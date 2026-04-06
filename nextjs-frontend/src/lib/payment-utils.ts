import { Order } from "./api";

/**
 * Robustly determines the display string for an order's payment method.
 * Checks `selectedPaymentType` first, then falls back to inspecting the `payments` array.
 */
export function getPaymentMethodDisplay(order: Partial<Order>): string {
    // 1. Check selectedPaymentType (primary source)
    if (order.selectedPaymentType) {
        if (order.selectedPaymentType === 'ZELLE') return 'Zelle';
        if (order.selectedPaymentType === 'BANK_WIRE') return 'Bank Wire';
        if (order.selectedPaymentType === 'AUTHORIZE_NET') return 'Authorize.Net';
        return order.selectedPaymentType;
    }

    // 2. Fallback: Check payments array
    if (order.payments && order.payments.length > 0) {
        // Look for successful or pending payments first
        const relevantPayment = order.payments.find(p =>
            p.status === 'COMPLETED' || p.status === 'PENDING'
        ) || order.payments[0];

        if (relevantPayment) {
            // Check for specific provider keywords
            const provider = (relevantPayment as any).provider?.toLowerCase() || '';
            const method = relevantPayment.paymentMethod?.toLowerCase() || '';

            if (provider.includes('authorize') || method.includes('card')) {
                return 'Authorize.Net';
            }
            if (provider.includes('zelle')) {
                return 'Zelle';
            }
            if (provider.includes('bank') || provider.includes('wire') || method.includes('bank')) {
                return 'Bank Wire';
            }

            // Return the raw method if no specific match
            return relevantPayment.paymentMethod || 'Unknown';
        }
    }

    return 'N/A';
}
