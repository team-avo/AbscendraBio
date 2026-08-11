/**
 * Ship-from (origin) address for ShipStation V2 rates & labels.
 *
 * ⚠️  PLACEHOLDER VALUES for integration testing. This is a valid, deliverable
 * US address so rate/label calls succeed, but it is NOT the real Ascendra Bio
 * warehouse. Before go-live, set the SHIP_FROM_* env vars (or update the
 * "Main Warehouse" Location record) with the real origin address.
 *
 * Returns an object already shaped for the ShipStation V2 API
 * (address_line1 / city_locality / state_province / postal_code / country_code).
 */
/* Build a ship-from origin from an env prefix. IDENTITY fields (name/company) are brand-specific and
   NEVER fall back across brands, so a Lineará label can never print "Ascendra Bio". ADDRESS fields
   fall back `prefix -> addressFallback -> placeholder`, so Lineará ships from the shared warehouse
   until a Lineará-specific origin is set via LINEARA_SHIP_FROM_*. */
function buildOrigin(prefix, addressFallback, brandName, brandCompany) {
  const addr = (k, d) =>
    process.env[`${prefix}_${k}`] || (addressFallback ? process.env[`${addressFallback}_${k}`] : undefined) || d;
  const line2 = process.env[`${prefix}_STREET2`] || (addressFallback ? process.env[`${addressFallback}_STREET2`] : undefined);
  return {
    name: process.env[`${prefix}_NAME`] || brandName,
    company_name: process.env[`${prefix}_COMPANY`] || brandCompany,
    phone: addr('PHONE', '512-555-0123'),
    address_line1: addr('STREET1', '4301 Bull Creek Rd'),
    ...(line2 ? { address_line2: line2 } : {}),
    city_locality: addr('CITY', 'Austin'),
    state_province: addr('STATE', 'TX'),
    postal_code: addr('POSTAL', '78731'),
    country_code: addr('COUNTRY', 'US'),
    address_residential_indicator: 'no',
  };
}

/* Ship-from (label sender / return address) for a brand. Lineará ("lineara") is a SEPARATE sender —
   its own company name and, once LINEARA_SHIP_FROM_* is set, its own address; Ascendra is the default
   and unchanged. Called with order.brand so a Lineará order's label ships as Lineará. */
function getShipFrom(brand) {
  if (brand === 'lineara') {
    return buildOrigin('LINEARA_SHIP_FROM', 'SHIP_FROM', 'Lineará Fulfillment', 'Lineará');
  }
  return buildOrigin('SHIP_FROM', null, 'Ascendra Bio Fulfillment', 'Ascendra Bio');
}

/* Store block for the packing-slip header ("ships from" company). Ascendra reads the DB
   StoreInformation record (passed in); Lineará uses its own identity + LINEARA_STORE_* env, falling
   back to the shared address so the slip is complete before Lineará-specific details are set. */
function getStoreBlock(brand, storeInfo) {
  if (brand === 'lineara') {
    return {
      name: process.env.LINEARA_STORE_NAME || 'Lineará',
      email: process.env.LINEARA_STORE_EMAIL || 'info@lineara.co',
      phone: process.env.LINEARA_STORE_PHONE || storeInfo?.phone || '',
      addressLine1: process.env.LINEARA_STORE_STREET1 || storeInfo?.addressLine1 || '5825 W Sunset Blvd',
      addressLine2: process.env.LINEARA_STORE_STREET2 || storeInfo?.addressLine2 || 'Suite 401',
      city: process.env.LINEARA_STORE_CITY || storeInfo?.city || 'Los Angeles',
      state: process.env.LINEARA_STORE_STATE || storeInfo?.state || 'CA',
      postalCode: process.env.LINEARA_STORE_POSTAL || storeInfo?.postalCode || '90028',
    };
  }
  return {
    name: storeInfo?.name || 'Ascendra Bio, LLC',
    email: storeInfo?.email || 'accounts@ascendrabio.com',
    phone: storeInfo?.phone || '',
    addressLine1: storeInfo?.addressLine1 || '5825 W Sunset Blvd',
    addressLine2: storeInfo?.addressLine2 || 'Suite 401',
    city: storeInfo?.city || 'Los Angeles',
    state: storeInfo?.state || 'CA',
    postalCode: storeInfo?.postalCode || '90028',
  };
}

/** True when the origin is still the built-in placeholder (no SHIP_FROM_* set). */
function isPlaceholderOrigin() {
  return !process.env.SHIP_FROM_STREET1 && !process.env.SHIP_FROM_POSTAL;
}

/**
 * Default package dimensions (inches). Required by some carriers (e.g. FedEx
 * rejects labels without dimensions). Override per-package via env once real
 * box sizes are known.
 */
function getDefaultDimensions() {
  return {
    unit: 'inch',
    length: parseFloat(process.env.SHIP_PKG_LENGTH_IN || '6'),
    width: parseFloat(process.env.SHIP_PKG_WIDTH_IN || '4'),
    height: parseFloat(process.env.SHIP_PKG_HEIGHT_IN || '3'),
  };
}

module.exports = { getShipFrom, getStoreBlock, isPlaceholderOrigin, getDefaultDimensions };
