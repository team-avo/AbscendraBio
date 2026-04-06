/**
 * Maps a customer type to the pricing tier that should be used
 * @param {string} customerType - The actual customer type (B2C, B2B, ENTERPRISE_1, ENTERPRISE_2)
 * @returns {string} The customer type to use for pricing lookups
 */
function getPricingCustomerType(customerType) {
    const mapping = {
        'B2C': 'B2C',
        'B2B': 'B2C',           // B2B uses B2C pricing
        'ENTERPRISE_1': 'ENTERPRISE_1',
        'ENTERPRISE_2': 'ENTERPRISE_1',  // Enterprise 2 uses Enterprise 1 pricing
    };

    return mapping[customerType] || customerType;
}

module.exports = { getPricingCustomerType };
