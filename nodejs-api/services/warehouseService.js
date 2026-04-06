const prisma = require('../prisma/client');
const logger = require('../utils/logger');
const { ssRequest } = require('../utils/shipstationClient');
const { State, Country } = require('country-state-city');

/**
 * Convert state name to ISO code
 * @param {string} stateName - Full state name (e.g., "California")
 * @param {string} countryCode - Country ISO code (e.g., "US")
 * @returns {string} - State ISO code (e.g., "CA")
 */
function getStateIsoCode(stateName, countryCode) {
  if (!stateName) return stateName;

  // If it's already a 2-letter code, return as is
  if (stateName.length === 2 && stateName.toUpperCase() === stateName) {
    return stateName;
  }

  // Try to find the state by name
  const states = State.getStatesOfCountry(countryCode || 'US');
  const state = states.find(s =>
    s.name.toLowerCase() === stateName.toLowerCase() ||
    s.isoCode.toLowerCase() === stateName.toLowerCase()
  );

  return state ? state.isoCode : stateName;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get coordinates for a location (city, state, country)
 * @param {string} city - City name
 * @param {string} state - State name
 * @param {string} country - Country code
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
async function getLocationCoordinates(city, state, country) {
  // For now, we'll use a simple mapping for major US cities
  // In production, you'd use a geocoding service like Google Maps API or OpenStreetMap

  const majorCities = {
    'New York': { lat: 40.7128, lng: -74.0060 },
    'Los Angeles': { lat: 34.0522, lng: -118.2437 },
    'Chicago': { lat: 41.8781, lng: -87.6298 },
    'Houston': { lat: 29.7604, lng: -95.3698 },
    'Phoenix': { lat: 33.4484, lng: -112.0740 },
    'Philadelphia': { lat: 39.9526, lng: -75.1652 },
    'San Antonio': { lat: 29.4241, lng: -98.4936 },
    'San Diego': { lat: 32.7157, lng: -117.1611 },
    'Dallas': { lat: 32.7767, lng: -96.7970 },
    'San Jose': { lat: 37.3382, lng: -121.8863 },
    'Austin': { lat: 30.2672, lng: -97.7431 },
    'Jacksonville': { lat: 30.3322, lng: -81.6557 },
    'Fort Worth': { lat: 32.7555, lng: -97.3308 },
    'Columbus': { lat: 39.9612, lng: -82.9988 },
    'Charlotte': { lat: 35.2271, lng: -80.8431 },
    'San Francisco': { lat: 37.7749, lng: -122.4194 },
    'Indianapolis': { lat: 39.7684, lng: -86.1581 },
    'Seattle': { lat: 47.6062, lng: -122.3321 },
    'Denver': { lat: 39.7392, lng: -104.9903 },
    'Washington': { lat: 38.9072, lng: -77.0369 },
    'Boston': { lat: 42.3601, lng: -71.0589 },
    'El Paso': { lat: 31.7619, lng: -106.4850 },
    'Nashville': { lat: 36.1627, lng: -86.7816 },
    'Detroit': { lat: 42.3314, lng: -83.0458 },
    'Oklahoma City': { lat: 35.4676, lng: -97.5164 },
    'Portland': { lat: 45.5152, lng: -122.6784 },
    'Las Vegas': { lat: 36.1699, lng: -115.1398 },
    'Memphis': { lat: 35.1495, lng: -90.0490 },
    'Louisville': { lat: 38.2527, lng: -85.7585 },
    'Baltimore': { lat: 39.2904, lng: -76.6122 },
    'Milwaukee': { lat: 43.0389, lng: -87.9065 },
    'Albuquerque': { lat: 35.0844, lng: -106.6504 },
    'Tucson': { lat: 32.2226, lng: -110.9747 },
    'Fresno': { lat: 36.7378, lng: -119.7871 },
    'Sacramento': { lat: 38.5816, lng: -121.4944 },
    'Mesa': { lat: 33.4152, lng: -111.8315 },
    'Kansas City': { lat: 39.0997, lng: -94.5786 },
    'Atlanta': { lat: 33.7490, lng: -84.3880 },
    'Long Beach': { lat: 33.7701, lng: -118.1937 },
    'Colorado Springs': { lat: 38.8339, lng: -104.8214 },
    'Raleigh': { lat: 35.7796, lng: -78.6382 },
    'Miami': { lat: 25.7617, lng: -80.1918 },
    'Virginia Beach': { lat: 36.8529, lng: -75.9780 },
    'Omaha': { lat: 41.2565, lng: -95.9345 },
    'Oakland': { lat: 37.8044, lng: -122.2712 },
    'Minneapolis': { lat: 44.9778, lng: -93.2650 },
    'Tulsa': { lat: 36.1540, lng: -95.9928 },
    'Arlington': { lat: 32.7357, lng: -97.1081 },
    'Tampa': { lat: 27.9506, lng: -82.4572 },
    'New Orleans': { lat: 29.9511, lng: -90.0715 }
  };

  // Try to find exact city match first
  if (majorCities[city]) {
    return majorCities[city];
  }

  // Try to find partial match
  for (const [cityName, coords] of Object.entries(majorCities)) {
    if (cityName.toLowerCase().includes(city.toLowerCase()) ||
      city.toLowerCase().includes(cityName.toLowerCase())) {
      return coords;
    }
  }

  // Default to center of US if no match found
  return { lat: 39.8283, lng: -98.5795 };
}

/**
 * Find the optimal warehouse for shipping based on customer location and stock availability
 * @param {string} customerAddressId - Customer's shipping address ID
 * @param {Array} orderItems - Array of order items with variantId and quantity
 * @returns {Promise<{warehouse: Object, distance: number, stockAvailable: boolean} | null>}
 */
async function findOptimalWarehouse(customerAddressId, orderItems) {
  try {
    // Get customer's shipping address
    const customerAddress = await prisma.address.findUnique({
      where: { id: customerAddressId },
      include: { customer: true }
    });

    if (!customerAddress) {
      throw new Error('Customer address not found');
    }

    // Get customer coordinates
    const customerCoords = await getLocationCoordinates(
      customerAddress.city,
      customerAddress.state,
      customerAddress.country
    );

    if (!customerCoords) {
      throw new Error('Could not determine customer location coordinates');
    }

    // Get all active warehouses
    const warehouses = await prisma.location.findMany({
      where: { isActive: true },
      include: {
        inventory: {
          include: {
            variant: true
          }
        }
      }
    });

    if (warehouses.length === 0) {
      throw new Error('No active warehouses found');
    }

    // Calculate distances and check stock availability for each warehouse
    const warehouseOptions = [];

    for (const warehouse of warehouses) {
      // Get warehouse coordinates
      const warehouseCoords = await getLocationCoordinates(
        warehouse.city,
        warehouse.state,
        warehouse.country
      );

      if (!warehouseCoords) continue;

      // Calculate distance
      const distance = calculateDistance(
        customerCoords.lat,
        customerCoords.lng,
        warehouseCoords.lat,
        warehouseCoords.lng
      );

      // Check if warehouse has sufficient stock for all items
      let stockAvailable = true;
      const stockDetails = {};

      for (const item of orderItems) {
        const inventoryRecord = warehouse.inventory.find(
          inv => inv.variantId === item.variantId
        );

        if (!inventoryRecord) {
          stockAvailable = false;
          stockDetails[item.variantId] = { available: 0, required: item.quantity };
          break;
        }

        const availableStock = Math.max(0,
          (inventoryRecord.quantity || 0) - (inventoryRecord.reservedQty || 0)
        );

        stockDetails[item.variantId] = {
          available: availableStock,
          required: item.quantity
        };

        if (availableStock < item.quantity && !inventoryRecord.sellWhenOutOfStock) {
          stockAvailable = false;
        }
      }

      warehouseOptions.push({
        warehouse,
        distance,
        stockAvailable,
        stockDetails,
        coordinates: warehouseCoords
      });
    }

    // Sort by distance (closest first) and filter by stock availability
    const warehousesWithStock = warehouseOptions.filter(w => w.stockAvailable);

    if (warehousesWithStock.length === 0) {
      // No warehouse has sufficient stock, return closest warehouse with partial stock
      const closestWarehouse = warehouseOptions.sort((a, b) => a.distance - b.distance)[0];
      return {
        warehouse: closestWarehouse.warehouse,
        distance: closestWarehouse.distance,
        stockAvailable: false,
        stockDetails: closestWarehouse.stockDetails,
        coordinates: closestWarehouse.coordinates
      };
    }

    // Return closest warehouse with sufficient stock
    const optimalWarehouse = warehousesWithStock.sort((a, b) => a.distance - b.distance)[0];

    return {
      warehouse: optimalWarehouse.warehouse,
      distance: optimalWarehouse.distance,
      stockAvailable: true,
      stockDetails: optimalWarehouse.stockDetails,
      coordinates: optimalWarehouse.coordinates
    };

  } catch (error) {
    logger.error('Error finding optimal warehouse', error);
    throw error;
  }
}

/**
 * Reserve inventory from a specific warehouse
 * @param {string} warehouseId - Warehouse ID
 * @param {Array} orderItems - Order items with variantId and quantity
 * @param {Object} [tx] - Optional Prisma transaction client
 * @returns {Promise<Array>} Array of reserved inventory records
 */
async function reserveInventoryFromWarehouse(warehouseId, orderItems, tx = prisma) {
  logger.info(`[WarehouseService] Reserving inventory from warehouse ${warehouseId}`);
  const reservedInventory = [];

  for (const item of orderItems) {
    logger.debug(`[WarehouseService] Processing item ${item.variantId}, qty: ${item.quantity}`);

    // Find or create inventory record for this variant at this warehouse
    let inventory = await tx.inventory.findFirst({
      where: {
        variantId: item.variantId,
        locationId: warehouseId
      }
    });

    if (!inventory) {
      logger.debug(`[WarehouseService] Inventory record not found, creating new one`);
      // Create inventory record if it doesn't exist
      inventory = await tx.inventory.create({
        data: {
          variantId: item.variantId,
          locationId: warehouseId,
          quantity: 0,
          reservedQty: 0,
          lowStockAlert: 10
        }
      });
    }

    logger.info(`[WarehouseService] Updating inventory ${inventory.id}`, {
      currentReserved: inventory.reservedQty,
      adding: item.quantity,
    });

    // Reserve the quantity
    const updatedInventory = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        reservedQty: { increment: item.quantity }
      },
      include: {
        variant: {
          include: { product: true }
        },
        location: true
      }
    });

    logger.info(`[WarehouseService] Updated inventory ${inventory.id}`, {
      newReserved: updatedInventory.reservedQty,
    });

    reservedInventory.push(updatedInventory);
  }

  return reservedInventory;
}

/**
 * Calculate shipping rate from a specific warehouse to customer address using ShipStation API
 * @param {string} warehouseId - Warehouse ID
 * @param {string} customerAddressId - Customer address ID
 * @param {number} orderWeight - Total order weight in ounces
 * @param {Object} dimensions - Package dimensions {length, width, height}
 * @param {string} carrierCode - Optional carrier code filter
 * @returns {Promise<Object>} Shipping rate information
 */
async function calculateShippingFromWarehouse(warehouseId, customerAddressId, orderWeight = 0, dimensions = null, carrierCode = null) {
  try {
    // Get warehouse and customer address details
    const [warehouse, customerAddress] = await Promise.all([
      prisma.location.findUnique({ where: { id: warehouseId } }),
      prisma.address.findUnique({ where: { id: customerAddressId } })
    ]);

    if (!warehouse || !customerAddress) {
      throw new Error('Warehouse or customer address not found');
    }

    // Get coordinates for both locations
    const [warehouseCoords, customerCoords] = await Promise.all([
      getLocationCoordinates(warehouse.city, warehouse.state, warehouse.country),
      getLocationCoordinates(customerAddress.city, customerAddress.state, customerAddress.country)
    ]);

    // Calculate distance
    const distance = calculateDistance(
      warehouseCoords.lat,
      warehouseCoords.lng,
      customerCoords.lat,
      customerCoords.lng
    );

    // Prepare ShipStation API request with proper state ISO codes
    const fromCountryCode = warehouse.country || 'US';
    const fromStateCode = getStateIsoCode(warehouse.state, fromCountryCode);

    const shipFrom = {
      country_code: fromCountryCode,
      postal_code: warehouse.postalCode || '10001',
      city_locality: warehouse.city || 'New York',
      state_province: fromStateCode,
      address_line1: warehouse.address || '123 Main St'
    };

    // Ensure country codes are in ISO format (not full names) and convert state names to codes
    const toCountryCode = customerAddress.country === 'United States' ? 'US' :
      (customerAddress.country || 'US');
    const toStateCode = getStateIsoCode(customerAddress.state, toCountryCode);

    const shipTo = {
      country_code: toCountryCode,
      postal_code: customerAddress.postalCode || '10001',
      city_locality: customerAddress.city || 'New York',
      state_province: toStateCode,
      address_line1: customerAddress.addressLine1 || '123 Main St',
      address_line2: customerAddress.addressLine2 || null,
      name: customerAddress.firstName && customerAddress.lastName
        ? `${customerAddress.firstName} ${customerAddress.lastName}`
        : '',
      email: customerAddress.email || ''
    };

    // Default dimensions if not provided
    const defaultDimensions = dimensions || {
      length: 10,
      width: 8,
      height: 4
    };

    // Default weight if not provided (1 lb = 16 oz)
    const weightOz = orderWeight || 16;

    try {
      // Fetch all carrier IDs so we can use carrier_ids array (for multi-carrier ShipStation request)
      let carrierIdsArr = [];
      try {
        const carriersResp = await ssRequest('GET', '/v2/carriers');
        const carriersList = Array.isArray(carriersResp.data?.carriers)
          ? carriersResp.data.carriers
          : Array.isArray(carriersResp.data)
            ? carriersResp.data
            : [];
        carrierIdsArr = carriersList.map((c) => c.carrier_id).filter(Boolean);
      } catch (e) {
        carrierIdsArr = [];
      }

      // Call ShipStation API for live rates using the /v2/rates/estimate endpoint
      // According to ShipStation docs: POST /v2/rates/estimate expects { shipment, rate_options }

      // Per mock error, use flat request shape (from_*/to_* and weight/ship_date)
      const shipstationRequest = {
        ...(carrierIdsArr.length > 0 ? { carrier_ids: carrierIdsArr } : {}),
        from_country_code: shipFrom.country_code,
        from_postal_code: shipFrom.postal_code,
        from_city_locality: shipFrom.city_locality,
        from_state_province: shipFrom.state_province,
        to_country_code: shipTo.country_code,
        to_postal_code: shipTo.postal_code,
        to_city_locality: shipTo.city_locality,
        to_state_province: shipTo.state_province,
        weight: {
          value: Math.max(Math.ceil(weightOz / 16), 3),
          unit: 'pound',
        },
        dimensions: {
          unit: 'inch',
          length: defaultDimensions.length,
          width: defaultDimensions.width,
          height: defaultDimensions.height
        },
        confirmation: 'none',
        address_residential_indicator: 'unknown',
        ship_date: new Date().toISOString()
      };

      logger.debug('ShipStation rates request', { shipstationRequest });

      // Mock sometimes only accepts POST /v2/rates with flat body; try that first
      let response;
      try {
        response = await ssRequest('POST', '/v2/rates', shipstationRequest);
      } catch (e) {
        response = await ssRequest('POST', '/v2/rates/estimate', shipstationRequest);
      }

      logger.info('ShipStation rates response', { response });

      // Handle ShipStation API response format according to documentation
      if (response.data && Array.isArray(response.data)) {
        // Response is an array of rates
        const rates = response.data;

        if (rates.length > 0) {
          // Sort rates by cost (ascending)
          const sortedRates = rates.sort((a, b) => parseFloat(a.shipping_amount?.amount || 0) - parseFloat(b.shipping_amount?.amount || 0));
          const bestRate = sortedRates[0];

          return {
            rate: parseFloat(bestRate.shipping_amount?.amount || 0),
            carrier: bestRate.carrier_friendly_name || bestRate.carrier_code || 'Unknown Carrier',
            service: bestRate.service_code || bestRate.service_type || 'standard',
            estimatedDays: bestRate.delivery_days || bestRate.estimated_delivery_date ?
              Math.ceil((new Date(bestRate.estimated_delivery_date) - new Date()) / (1000 * 60 * 60 * 24)) :
              Math.ceil(distance / 500),
            distance: distance,
            warehouse: warehouse.name,
            warehouseLocation: `${warehouse.city}, ${warehouse.state}`,
            shipstationRateId: bestRate.rate_id,
            guaranteed: bestRate.guaranteed_service || false,
            trackable: bestRate.trackable || true,
            allRates: sortedRates.map(rate => ({
              rate: parseFloat(rate.shipping_amount?.amount || 0),
              carrier: rate.carrier_friendly_name || rate.carrier_code || 'Unknown Carrier',
              service: rate.service_code || rate.service_type || 'standard',
              estimatedDays: rate.delivery_days || (rate.estimated_delivery_date ?
                Math.ceil((new Date(rate.estimated_delivery_date) - new Date()) / (1000 * 60 * 60 * 24)) :
                Math.ceil(distance / 500)),
              rateId: rate.rate_id,
              guaranteed: rate.guaranteed_service || false,
              trackable: rate.trackable || true,
              validationStatus: rate.validation_status || 'unknown'
            }))
          };
        }
      } else if (response.data && response.data.rates && Array.isArray(response.data.rates)) {
        // Response has rates nested in data.rates
        const rates = response.data.rates;

        if (rates.length > 0) {
          // Sort rates by cost (ascending)
          const sortedRates = rates.sort((a, b) => parseFloat(a.shipping_amount?.amount || 0) - parseFloat(b.shipping_amount?.amount || 0));
          const bestRate = sortedRates[0];

          return {
            rate: parseFloat(bestRate.shipping_amount?.amount || 0),
            carrier: bestRate.carrier_friendly_name || bestRate.carrier_code || 'Unknown Carrier',
            service: bestRate.service_code || bestRate.service_type || 'standard',
            estimatedDays: bestRate.delivery_days || bestRate.estimated_delivery_date ?
              Math.ceil((new Date(bestRate.estimated_delivery_date) - new Date()) / (1000 * 60 * 60 * 24)) :
              Math.ceil(distance / 500),
            distance: distance,
            warehouse: warehouse.name,
            warehouseLocation: `${warehouse.city}, ${warehouse.state}`,
            shipstationRateId: bestRate.rate_id,
            guaranteed: bestRate.guaranteed_service || false,
            trackable: bestRate.trackable || true,
            allRates: sortedRates.map(rate => ({
              rate: parseFloat(rate.shipping_amount?.amount || 0),
              carrier: rate.carrier_friendly_name || rate.carrier_code || 'Unknown Carrier',
              service: rate.service_code || rate.service_type || 'standard',
              estimatedDays: rate.delivery_days || (rate.estimated_delivery_date ?
                Math.ceil((new Date(rate.estimated_delivery_date) - new Date()) / (1000 * 60 * 60 * 24)) :
                Math.ceil(distance / 500)),
              rateId: rate.rate_id,
              guaranteed: rate.guaranteed_service || false,
              trackable: rate.trackable || true,
              validationStatus: rate.validation_status || 'unknown'
            }))
          };
        }
      }

      logger.warn('No rates returned from ShipStation, falling back to default calculation');
      throw new Error('No rates available from ShipStation');
    } catch (shipstationError) {
      logger.error('ShipStation API error', shipstationError);

      // Log detailed error information
      if (shipstationError.data && shipstationError.data.errors) {
        logger.error('ShipStation error details', { errors: shipstationError.data.errors });
      }

      // Don't provide fallback rates - only show ShipStation rates
      const errorMessage = shipstationError.data?.errors?.[0]?.message || shipstationError.message;
      throw new Error(`ShipStation API error: ${errorMessage}`);
    }

  } catch (error) {
    logger.error('Error calculating shipping from warehouse', error);
    throw error;
  }
}

module.exports = {
  findOptimalWarehouse,
  reserveInventoryFromWarehouse,
  calculateShippingFromWarehouse,
  calculateDistance,
  getLocationCoordinates
};
