/**
 * Maps a customer type to the pricing tier that should be used
 * @param customerType - The actual customer type
 * @returns The customer type to use for pricing lookups
 */
export function getPricingCustomerType(
    customerType: 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined
): 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2' | undefined {
    if (!customerType) return undefined;

    const mapping: Record<string, 'B2C' | 'B2B' | 'ENTERPRISE_1' | 'ENTERPRISE_2'> = {
        'B2C': 'B2C',
        'B2B': 'B2C',           // B2B uses B2C pricing
        'ENTERPRISE_1': 'ENTERPRISE_1',
        'ENTERPRISE_2': 'ENTERPRISE_1',  // Enterprise 2 uses Enterprise 1 pricing
    };

    return mapping[customerType] || customerType as any;
}
