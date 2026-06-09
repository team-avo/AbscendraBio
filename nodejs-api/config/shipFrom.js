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
function getShipFrom() {
  return {
    name: process.env.SHIP_FROM_NAME || 'Ascendra Bio Fulfillment',
    company_name: process.env.SHIP_FROM_COMPANY || 'Ascendra Bio',
    phone: process.env.SHIP_FROM_PHONE || '512-555-0123',
    address_line1: process.env.SHIP_FROM_STREET1 || '4301 Bull Creek Rd',
    ...(process.env.SHIP_FROM_STREET2
      ? { address_line2: process.env.SHIP_FROM_STREET2 }
      : {}),
    city_locality: process.env.SHIP_FROM_CITY || 'Austin',
    state_province: process.env.SHIP_FROM_STATE || 'TX',
    postal_code: process.env.SHIP_FROM_POSTAL || '78731',
    country_code: process.env.SHIP_FROM_COUNTRY || 'US',
    address_residential_indicator: 'no',
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

module.exports = { getShipFrom, isPlaceholderOrigin, getDefaultDimensions };
