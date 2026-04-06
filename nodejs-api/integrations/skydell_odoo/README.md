# Odoo Inventory Sync Integration (Skydell)

Real-time inventory synchronization with Skydell's Odoo system via their Vendor API.

## Overview

This integration automatically syncs product inventory to Odoo whenever:
1. **Manual Full Sync** - Triggered via API endpoint for initial setup or bulk updates
2. **Order Shipped** - When an order status changes to `SHIPPED`, affected variants are synced
3. **Inventory Adjusted** - When inventory is manually updated through the admin panel

All syncs are processed asynchronously using Bull queue with Redis, and comprehensive logs are maintained in the database.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Trigger Points                          │
├─────────────────────────────────────────────────────────────┤
│  1. POST /api/odoo/sync/full (Manual)                      │
│  2. Order Status → SHIPPED (Automatic)                      │
│  3. Inventory Update (Automatic)                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Bull Queue (Redis-backed)                      │
│  - Job Types: FULL_SYNC, VARIANT_SYNC                      │
│  - 3 retry attempts with exponential backoff                │
│  - Rate limit: 5 ops/second                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Sync Service Logic                             │
│  1. Calculate available stock (quantity - reservedQty)      │
│  2. Build payload (name, SKU, stock, price)                │
│  3. Check if product exists in Odoo                         │
│  4. Create or Update via Odoo API                           │
│  5. Log result to OdooSyncLog table                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Odoo Vendor API                                │
│  - POST /vendor_api/product/create                         │
│  - POST /vendor_api/product/read                           │
│  - POST /vendor_api/product/update                         │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
nodejs-api/integrations/skydell_odoo/
├── README.md                # This file
├── index.js                 # Public exports
├── odooClient.js            # HTTP client for Odoo API
├── odooSyncService.js       # Core sync logic
├── odooSyncQueue.js         # Bull queue setup
├── odooRoutes.js            # Express API routes
└── testOdooSync.js          # Test script
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Odoo Integration Configuration
ODOO_API_BASE_URL=https://bol9967-odoo18-tk.odoo.com
ODOO_API_TOKEN=Y8i9NaJJdMDT32qPyXcuz8Zlm6xVa9EjFoFtpLbPe_Y
ODOO_PARTNER_ID=7
```

### Database Schema

The integration adds the `OdooSyncLog` model to track all sync attempts:

```prisma
model OdooSyncLog {
  id              String          @id @default(cuid())
  triggerType     OdooSyncTrigger // MANUAL_FULL, ORDER_SHIPPED, INVENTORY_ADJUSTMENT, TEST
  variantId       String?
  variantSku      String
  requestPayload  Json
  responsePayload Json?
  status          OdooSyncStatus  // SUCCESS, FAILED
  errorMessage    String?
  createdAt       DateTime        @default(now())
}
```

## API Endpoints

All endpoints require authentication (`authMiddleware`).

### 1. Trigger Full Sync

```http
POST /api/odoo/sync/full
```

Queues a sync for all active product variants.

**Response:**
```json
{
  "success": true,
  "message": "Full inventory sync has been queued",
  "jobId": "12345",
  "triggerType": "MANUAL_FULL"
}
```

### 2. Get Job Status

```http
GET /api/odoo/sync/job/:jobId
```

Check the status of a queued sync job.

**Response:**
```json
{
  "success": true,
  "job": {
    "found": true,
    "id": "12345",
    "state": "completed",
    "progress": 100,
    "result": { ... }
  }
}
```

### 3. Get Queue Statistics

```http
GET /api/odoo/sync/queue/stats
```

View current queue status.

**Response:**
```json
{
  "success": true,
  "stats": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3,
    "delayed": 0,
    "total": 160
  }
}
```

### 4. Get Sync Logs

```http
GET /api/odoo/sync/logs
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)
- `status` - Filter by status (`SUCCESS` or `FAILED`)
- `triggerType` - Filter by trigger type
- `variantSku` - Search by SKU (partial match)
- `startDate` - Filter by date range (ISO format)
- `endDate` - Filter by date range (ISO format)

**Response:**
```json
{
  "success": true,
  "logs": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### 5. Get Single Log

```http
GET /api/odoo/sync/logs/:id
```

Retrieve detailed information for a specific sync log.

### 6. Get Sync Statistics

```http
GET /api/odoo/sync/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 500,
    "successful": 485,
    "failed": 15,
    "successRate": "97.00",
    "byTrigger": {
      "MANUAL_FULL": 10,
      "ORDER_SHIPPED": 300,
      "INVENTORY_ADJUSTMENT": 190
    }
  },
  "recent": [ ... ]
}
```

## Testing

### Local Testing with Test Script

Run the test script to create a test product and sync it to Odoo:

```bash
cd nodejs-api
node integrations/skydell_odoo/testOdooSync.js
```

**What it does:**
1. Creates `test_local_product` with variant SKU `TEST-LOCAL-001`
2. Sets up inventory (100 units, 10 reserved = 90 available)
3. Tests direct Odoo API calls (read, create/update)
4. Tests sync service with logging
5. Verifies sync log was created in database

**Expected output:**
```
========================================
Odoo Integration Test Script
========================================

Configuration:
  Base URL: https://bol9967-odoo18-tk.odoo.com
  Partner ID: 7
  API Token: Y8i9NaJJdM...

Step 1: Checking for existing test product...
  ✓ Test product created: clxxx123

Step 2: Checking for existing test variant...
  ✓ Test variant created: clxxx456

Step 3: Setting up inventory...
  ✓ Available stock: 90 units

Step 4: Testing Direct Odoo API
  Result: SUCCESS
  ✓ Product created successfully

Step 5: Testing Sync Service
  Sync Result: SUCCESS
  ✓ Sync completed successfully

Step 6: Verifying sync log...
  ✓ Sync log created successfully

========================================
Test Complete!
========================================
```

### Manual Testing via API

1. **Start the API server:**
```bash
cd nodejs-api
npm run dev
```

2. **Trigger a full sync:**
```bash
curl -X POST http://localhost:3001/api/odoo/sync/full \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

3. **Check sync logs:**
```bash
curl http://localhost:3001/api/odoo/sync/logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

4. **View queue stats:**
```bash
curl http://localhost:3001/api/odoo/sync/queue/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Testing Automatic Triggers

**Test Order Shipment Trigger:**
1. Create an order with products in the admin panel
2. Change order status to `SHIPPED`
3. Check logs: `GET /api/odoo/sync/logs?triggerType=ORDER_SHIPPED`

**Test Inventory Adjustment Trigger:**
1. Update inventory for a variant in the admin panel
2. Check logs: `GET /api/odoo/sync/logs?triggerType=INVENTORY_ADJUSTMENT`

## Data Mapping

### Our System → Odoo

| Our Field | Odoo Field | Description |
|-----------|------------|-------------|
| `Product.name + Variant.name` | `name` | Combined: "BPC-157 - 5mg" |
| `Variant.sku` | `default_code` | Unique SKU |
| `SUM(quantity - reservedQty)` | `vendor_on_hand_qty` | Net available across all locations |
| `0` (fixed) | `supplier.price` | Currently hardcoded to 0 |

### Stock Calculation

```javascript
availableStock = SUM across all active locations:
  MAX(0, inventory.quantity - inventory.reservedQty)
```

**Example:**
- Location A: 100 qty, 10 reserved = 90 available
- Location B: 50 qty, 5 reserved = 45 available
- **Total sent to Odoo: 135**

## Monitoring & Debugging

### Check Queue Health

```bash
# View queue statistics
curl http://localhost:3001/api/odoo/sync/queue/stats -H "Authorization: Bearer TOKEN"
```

### View Recent Failures

```bash
# Get failed sync attempts
curl "http://localhost:3001/api/odoo/sync/logs?status=FAILED&limit=10" \
  -H "Authorization: Bearer TOKEN"
```

### Inspect Specific Log

```bash
# Get detailed log entry
curl http://localhost:3001/api/odoo/sync/logs/LOG_ID \
  -H "Authorization: Bearer TOKEN"
```

### Database Queries

```sql
-- View sync success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM odoo_sync_logs
GROUP BY status;

-- Recent failures
SELECT 
  variant_sku,
  trigger_type,
  error_message,
  created_at
FROM odoo_sync_logs
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 10;

-- Sync activity by trigger type
SELECT 
  trigger_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'SUCCESS') as successful,
  COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM odoo_sync_logs
GROUP BY trigger_type;
```

## Troubleshooting

### Issue: Sync jobs not processing

**Check:**
1. Is Redis running? `docker ps | grep redis`
2. Is queue initialized? Check server logs for "Queue initialized"
3. Check queue stats: `GET /api/odoo/sync/queue/stats`

**Solution:**
```bash
# Restart Redis
docker restart peptides_dev_redis

# Restart API server
npm run dev
```

### Issue: All syncs failing with authentication error

**Check:**
1. Verify `ODOO_API_TOKEN` in `.env`
2. Check token hasn't expired
3. Verify `ODOO_PARTNER_ID` is correct (should be `7`)

**Test:**
```bash
curl -X POST https://bol9967-odoo18-tk.odoo.com/vendor_api/product/read?partner_id=7 \
  -H "Authorization: Bearer Y8i9NaJJdMDT32qPyXcuz8Zlm6xVa9EjFoFtpLbPe_Y" \
  -H "Content-Type: application/json" \
  -d '{"default_code": "TEST-SKU"}'
```

### Issue: Product not appearing in Odoo

**Check:**
1. View sync log for that SKU: `GET /api/odoo/sync/logs?variantSku=YOUR_SKU`
2. Check `responsePayload` in log for Odoo's response
3. Verify variant is active: `isActive = true`
4. Verify product is active: `status = 'ACTIVE'`

### Issue: Stock mismatch

**Debug:**
1. Check inventory calculation in logs
2. Verify `quantity` and `reservedQty` values in database
3. Sum should exclude inactive locations

**Manual calculation:**
```sql
SELECT 
  pv.sku,
  SUM(GREATEST(0, i.quantity - COALESCE(i.reserved_qty, 0))) as available_stock
FROM product_variants pv
JOIN inventory i ON i.variant_id = pv.id
JOIN locations l ON l.id = i.location_id
WHERE pv.sku = 'YOUR_SKU'
  AND l.is_active = true
GROUP BY pv.sku;
```

## Performance Considerations

### Queue Rate Limiting

The queue is configured to process **5 operations per second** to avoid overwhelming the Odoo API.

To adjust:
```javascript
// In odooSyncQueue.js
limiter: {
  max: 5,        // Change this
  duration: 1000 // per second
}
```

### Retry Strategy

- **Attempts:** 3 retries for VARIANT_SYNC, 1 for FULL_SYNC
- **Backoff:** Exponential starting at 2 seconds
- **Timeouts:** 30s for API calls, 10 minutes for full sync jobs

### Job Retention

- **Completed jobs:** Keep last 100
- **Failed jobs:** Keep last 500 for debugging

To adjust:
```javascript
// In odooSyncQueue.js
removeOnComplete: 100,  // Change this
removeOnFail: 500       // Change this
```

## Production Deployment

### Prerequisites

1. Redis must be running and accessible
2. Environment variables set in production `.env`
3. Database migrated with OdooSyncLog table

### Staging Testing

Before production deployment:

1. **Test with staging Odoo environment** (if available):
   ```bash
   ODOO_API_BASE_URL=https://staging-odoo.example.com
   ```

2. **Run full sync in staging:**
   ```bash
   curl -X POST https://staging-api.example.com/api/odoo/sync/full \
     -H "Authorization: Bearer TOKEN"
   ```

3. **Monitor logs for 24 hours:**
   - Check success rate
   - Review any failures
   - Validate stock accuracy in Odoo

### Production Deployment Checklist

- [ ] Environment variables configured
- [ ] Redis running and healthy
- [ ] Database migration applied
- [ ] Test script executed successfully
- [ ] Manual API endpoints tested
- [ ] Order shipment trigger tested
- [ ] Inventory adjustment trigger tested
- [ ] Monitoring/alerting configured
- [ ] Stakeholders notified

## Support

For issues or questions:
1. Check sync logs via API
2. Review server logs for error messages
3. Verify Odoo API connectivity
4. Contact Skydell support for Odoo-side issues

## Future Enhancements

Potential improvements:
- [ ] Webhook from Odoo for bidirectional sync
- [ ] Support for price syncing (currently hardcoded to 0)
- [ ] Batch sync API for multiple SKUs
- [ ] Real-time sync monitoring dashboard
- [ ] Alerting for consecutive failures
- [ ] Archive old sync logs (>90 days)
