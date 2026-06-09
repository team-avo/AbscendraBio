# AscendraBio — Developer Reference

*A technical guide for engineers working on the AscendraBio platform.*

`Version 1.0` · `Last updated: May 2026`

---

## 1. Quick Start

### Prerequisites
- **Node.js** 20+ (24+ recommended)
- **PostgreSQL** 14+
- **Redis** 6+ (for Bull job queue)
- **npm** or **pnpm**
- A `.env` file in `nodejs-api/` (copy from `.env.example`)

### Clone and run

```bash
# 1. Clone
git clone https://github.com/team-avo/AbscendraBio.git
cd AbscendraBio

# 2. Backend
cd nodejs-api
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, etc.
npx prisma migrate dev      # apply migrations
npm run seed                # optional: seed demo data
npm run dev                 # starts on :3001

# 3. Frontend (new terminal)
cd ../nextjs-frontend
npm install
# create .env.local with NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run dev                 # starts on :3000
```

Default admin login after seeding: `admin@example.com` / `SecurePass123!`.

---

## 2. Architecture Overview

```
┌─────────────────────────┐         ┌──────────────────────┐
│   nextjs-frontend       │ HTTPS   │   nodejs-api         │
│   (Next.js 15.5 SSR)    │◄────────►   (Express 4)        │
│   Vercel                │  JSON   │   Railway            │
└─────────────────────────┘         └──────────┬───────────┘
                                               │
                                ┌──────────────┼──────────────┐
                                ▼              ▼              ▼
                         ┌──────────┐   ┌──────────┐   ┌──────────┐
                         │ Postgres │   │  Redis   │   │  S3      │
                         │ Railway  │   │ (Bull)   │   │  AWS     │
                         └──────────┘   └──────────┘   └──────────┘
```

- **Frontend**: Next.js 15 (App Router, React 19, Tailwind 4) → Vercel
- **Backend**: Express 4 + Prisma 6 + PostgreSQL → Railway
- **Job Queue**: Bull (Redis) for async report generation
- **Cron**: `node-cron` running in-process on the backend
- **Auth**: JWT, stored client-side; verified via `middleware/auth.js`
- **Storage**: AWS S3 for uploaded images / exports

---

## 3. Tech Stack

### Frontend (`nextjs-frontend/package.json`)

| Concern | Library |
|---|---|
| Framework | Next.js 15.5.9 (App Router, Turbopack in dev) |
| UI | React 19, Tailwind CSS 4, Radix UI, shadcn/ui patterns |
| Icons | lucide-react |
| Animation | motion (framer-motion successor) |
| Forms | react-hook-form + Zod |
| Tables / charts | Recharts |
| Editor | Tiptap 3 (rich text in admin) |
| File export | xlsx, jsPDF, file-saver, papaparse |
| Phone / address | react-phone-number-input, country-state-city |
| Toast | sonner |
| Date picker | react-day-picker, date-fns |

### Backend (`nodejs-api/package.json`)

| Concern | Library |
|---|---|
| Framework | Express 4 |
| ORM | Prisma 6.11.1 |
| DB | PostgreSQL |
| Auth | jsonwebtoken + bcryptjs |
| Email | Resend (primary), Nodemailer (fallback) |
| SMS | Twilio |
| Payments | Stripe SDK, Authorize.Net (custom integration) |
| Gmail | googleapis (supplier email poll) |
| File upload | Multer + multer-s3 |
| Job queue | Bull (Redis) |
| Cron | node-cron |
| Excel | exceljs |
| HTML parsing | cheerio (supplier email body extraction) |
| Validation | express-validator, Joi |
| Logging | Pino |

---

## 4. Repo Structure

### Frontend — `nextjs-frontend/src/`

```
app/
  landing/              # Public storefront pages (browse, PDP, checkout)
  account/              # Customer account pages (orders, profile, favorites)
  admin-dashboard/      # Admin home
  products/             # Admin product CRUD
  orders/               # Admin order management
  customers/            # Admin customer management
  inventory/            # Admin inventory + stock receipts
  payments/, shipping/  # Admin payments, shipping config
  analytics/            # Admin reports
  content/              # CMS (pages, blog, banners)
  login/, reset-password/, verify/  # Auth flows
components/             # Reusable UI (forms, modals, layouts)
contexts/               # auth-context, cart-context, dashboard-context
hooks/                  # custom React hooks
lib/                    # API client (split by domain: api-products.ts, api-orders.ts, ...)
utils/                  # discount.ts, pricingMapper.ts, deviceInfo.ts
config/                 # feature flags, constants
types/                  # TypeScript types
```

### Backend — `nodejs-api/`

```
app.js                  # Express app — middleware + route mounts
server.js               # HTTP server + cron scheduler entry point
routes/                 # 50+ route handlers (one file per domain)
middleware/             # auth, errorHandler, validateRequest
prisma/
  schema.prisma         # Complete data model (~2,150 lines)
  seed.js               # Seeder for demo data
  client.js             # Prisma singleton
services/               # Business logic + integrations
  supplier-parsers/     # Pluggable supplier email parsers (ion-peptide-v1, ...)
  gmail.service.js      # Gmail OAuth wrapper
  inventory.service.js  # Stock movement helper
  shipmentService.js    # ShipStation
  reportQueue.js        # Bull queue for async exports
cron/                   # node-cron scheduled jobs (see §8)
workers/                # Bull workers (reportWorker.js)
integrations/
  skydell_odoo/         # Partner Odoo ERP sync
scripts/                # One-off ops scripts (seeders, gmail-auth)
utils/                  # logger, emailService, stockAlertScheduler
views/                  # HTML email templates
public/                 # static assets + uploads/
```

---

## 5. Database Schema

The schema lives in [`nodejs-api/prisma/schema.prisma`](nodejs-api/prisma/schema.prisma) — 2,150+ lines, 70+ models. Use `npx prisma studio` to explore visually.

### Core domains

**Identity & Access**
- `User`, `UserPermission`, `EmailVerificationToken`, `EmailLoginOtp`, `LoginAttempt`
- Roles: `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`, `SALES_REP`, `SALES_MANAGER`

**Customer**
- `Customer` — types `B2C`, `B2B`, `ENTERPRISE_1`, `ENTERPRISE_2`; approval `PENDING` → `APPROVED` → `DEACTIVATED`
- `Address` (billing/shipping), `CustomerTag`, `MobileVerificationCode`

**Catalog**
- `Product` → `ProductVariant` (1:N)
- `SegmentPrice` (per customer type), `BulkPrice` (per qty tier)
- `ProductImage`, `VariantImage`, `ProductCategory`, `ProductTag`, `ProductCollection`
- `ProductReview`, `ProductRelation`, `PopularProductOrder`
- `ThirdPartyReport` — purity / endotoxicity / sterility certs

**Inventory**
- `Location` (warehouses) → `Inventory` (per variant × location)
- `InventoryBatch` (lot/expiry tracking)
- `InventoryMovement` — every stock change (sale, restock, transfer, adjustment)

**Supplier auto-import** *(important — see §10.3)*
- `SupplierEmailSource` — configured sender + parser key
- `SupplierProductMapping` — learned supplier-name → variant table
- `PendingStockReceipt` → `PendingStockReceiptLine` (matchStatus: `UNMATCHED` / `AUTO_MATCHED` / `MANUAL_MATCHED` / `REJECTED`)

**Cart & Orders**
- `Cart` → `CartItem`
- `Order` → `OrderItem`, `OrderNote`, `Shipment`, `ShipmentTrackingEvent`
- `Payment` → `Refund`, `Transaction`
- Order status: `PENDING` → `PROCESSING` → `LABEL_CREATED` → `SHIPPED` → `DELIVERED` (also `CANCELLED`, `REFUNDED`, `ON_HOLD`)
- Payment types: `AUTHORIZE_NET`, `ZELLE`, `BANK_WIRE`

**Promotions**
- `Promotion`, `PromotionProductRule`, `PromotionCategoryRule`, `PromotionVolumeTier`, `PromotionUsage`
- Types: `PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`, `BOGO`, `VOLUME_DISCOUNT`

**Marketing**
- `Campaign`, `CampaignEvent`
- `EmailTemplate` (typed: ORDER_CONFIRMATION, SHIPPING_NOTIFICATION, etc.)

**Sales team**
- `SalesRepresentative`, `SalesManager`
- `SalesRepCustomerAssignment`, `SalesManagerCustomerAssignment`

**Partner channels**
- `SalesChannel` (OWN / PARTNER), `SalesChannelPrice`, `SalesChannelShippingTier`
- `PartnerStatementConfig`, `PartnerLedgerEntry`, `PartnerStatement`

**Integrations**
- `OdooSyncLog`, `OdooIntegrationConfig` (Skydell partner)

**CMS**
- `PageContent`, `ContentVersion`, `PageView`, `NavigationMenu`, `FooterSettings`

**Other**
- `Cart`, `Favorite`, `BulkQuote`, `AuditLog`, `Notification`, `Comment`, `Setting`, `MediaFile`

---

## 6. Auth Model

### Backend
- JWT signed with `JWT_SECRET`, default expiry `365d` (configurable via `JWT_EXPIRE`)
- Hashed passwords with bcrypt (rounds: `BCRYPT_SALT_ROUNDS`, default 10)
- Middleware: `nodejs-api/middleware/auth.js` — extracts JWT from `Authorization: Bearer` header OR HttpOnly cookie, attaches `req.user`
- `authMiddleware` applied per-route in `app.js`; public routes are mounted before/without it

### Frontend
- `nextjs-frontend/src/contexts/auth-context.tsx` holds user state
- Token stored in `localStorage`; injected into all requests via `lib/api.ts`
- On app load: `GET /auth/profile` restores session
- Methods exposed: `login`, `register`, `logout`, `requestEmailOtp`, `loginWithEmailOtp`, `hasPermission(module, action)`, `hasRole(roles)`

### Passwordless flow
1. `POST /auth/request-email-otp { email }`
2. Backend stores `EmailLoginOtp`, sends code via Resend
3. `POST /auth/login-email-otp { email, code }` → JWT

### Approval flow (B2B / Enterprise)
- Signup creates `Customer` with `approvalStatus: PENDING`
- Login is blocked until admin sets `APPROVED` via `PATCH /customers/:id`

---

## 7. API Surface

Routes are mounted in `nodejs-api/app.js`. Base URL: `/api`.

**Note**: the public-products router is mounted at `/api/storefront/products` — *not* `/api/public/products`.

### Public (no auth)
| Path | Purpose |
|---|---|
| `GET /api/storefront/products` | Storefront catalog (search, filter, paginate) |
| `GET /api/storefront/products/:id` | Product detail (id or slug) |
| `GET /api/storefront/products/variants/batch?ids=...` | Bulk variant fetch (guest cart) |
| `GET /api/public-pages`, `GET /api/public-content` | Published CMS pages |
| `GET /api/public-third-party-reports` | Public COA library |
| `POST /api/contact-lab`, `POST /api/inquiries` | Inquiry forms |
| `POST /api/auth/login`, `/register`, `/request-email-otp`, `/login-email-otp`, `/refresh-token` | Auth |

### Protected (auth required)
- `/api/products`, `/api/products/:id/...` — admin catalog CRUD
- `/api/orders` — customer + admin
- `/api/cart` — current user's cart, merge endpoint
- `/api/customers` — admin customer management
- `/api/inventory`, `/api/inventory-batches`
- `/api/stock-receipts` — supplier email approval queue
- `/api/promotions`, `/api/bulk-quotes`
- `/api/sales-reps`, `/api/sales-managers`, `/api/sales-channels`
- `/api/payments`, `/api/shipping`, `/api/shipstation/webhooks`
- `/api/campaigns`, `/api/marketing`, `/api/analytics`
- `/api/content`, `/api/email-templates`, `/api/settings`
- `/api/notifications`, `/api/comments`
- `/api/integrations/odoo/...`
- `/api/uploads` — file upload to S3
- `/api/scripts/...` — dev-only utility endpoints

Each route file exports a router; check `app.js` for the canonical mount paths.

---

## 8. Cron Jobs

All registered in `server.js` using `node-cron`. Server timezone applies unless cron expressions are UTC-targeted.

| Schedule | Task | File | What it does |
|---|---|---|---|
| `* * * * *` | Publish scheduler | `cron/publishScheduler.js` | Auto-publishes `PageContent` with `SCHEDULED` status when `publishedAt` arrives |
| `*/2 * * * *` | Promotion expiry | `cron/promotionExpiryScheduler.js` | Deactivates expired promotions |
| `0 * * * *` | Supplier email poll | `cron/supplierEmailPoll.js` | Gmail OAuth: fetch unread from `SupplierEmailSource.senderEmail`, parse, create `PendingStockReceipt` |
| `0 * * * *` | Label tracking sync | `cron/labelTrackingSync.js` | ShipStation tracking reconciliation |
| `15 2 * * *` | Settlement checker | `cron/settlementChecker.js` | Authorize.Net settlement reconciliation |
| `30 2 * * *` | Inventory sync | `utils/inventorySyncService.js` | ShipStation → local inventory sync |
| `0 3,15 * * *` | Partner statement generator | `cron/partnerBillingScheduler.js` | Creates `PartnerStatement` per billing cycle |
| `0 4,16 * * *` | Partner payment reminders | `cron/partnerBillingScheduler.js` | Email reminders for overdue statements |

**Caveats**
- No deduplication or catch-up — if the backend is down, missed runs are skipped.
- Poll cadence for Gmail is overridable via `SUPPLIER_EMAIL_POLL_CRON` env var.
- For one-shot ops (reseed, send test email), use `/api/scripts/...` endpoints rather than triggering cron manually.

### Bull job queue
- `workers/reportWorker.js` consumes the report generation queue.
- Reports are written to S3; users get a download link via email.

---

## 9. Environment Variables

Full list (group by purpose). `.env.example` in `nodejs-api/` has the canonical template.

### Core
```
NODE_ENV                # development | production
PORT                    # default 3001 (api), 3000 (frontend)
DATABASE_URL            # postgresql://...
REDIS_URL               # redis://...
FRONTEND_CORS_URL       # e.g. https://www.ascendrabio.com
NEXT_PUBLIC_API_URL     # frontend → e.g. https://api.ascendrabio.com/api
BUILD_STANDALONE        # "true" only when building for Docker/Railway
```

### Auth & security
```
JWT_SECRET
JWT_EXPIRE              # default 365d
BCRYPT_SALT_ROUNDS      # default 10
SESSION_SECRET
```

### Email
```
RESEND_API_KEY          # primary transactional
EMAIL_HOST              # nodemailer fallback (SMTP)
EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
```

### Payments
```
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
AUTHORIZE_NET_LOGIN_ID
AUTHORIZE_NET_TRANSACTION_KEY
```

### Gmail (supplier email import)
```
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN     # obtained via scripts/gmail-auth.js
GMAIL_USER_EMAIL
GMAIL_PROCESSED_LABEL   # default "ascendra-processed"
SUPPLIER_EMAIL_POLL_CRON
```

### File storage
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION              # default ap-south-1
AWS_S3_BUCKET
UPLOAD_PATH             # local fallback
UPLOAD_MAX_SIZE         # bytes (10 MB default)
UPLOAD_ALLOWED_TYPES    # csv list of MIME types
```

### SMS
```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

### Odoo (partner)
```
ODOO_API_BASE_URL
ODOO_API_TOKEN
ODOO_PARTNER_ID
```

### Logging
```
LOG_LEVEL               # debug | info | warn | error
LOG_FORMAT
DEBUG
```

---

## 10. Key Business Logic

### 10.1 Pricing system (multi-tier)

The cart computes prices in priority order. Source: [`nextjs-frontend/src/contexts/cart-context.tsx`](nextjs-frontend/src/contexts/cart-context.tsx).

1. **Backend `unitPrice`** — if the cart API returned a calculated `unitPrice`, use it.
2. **Bulk pricing** — `BulkPrice` rows on the variant; pick the row where `minQty ≤ qty ≤ maxQty`.
3. **Segment pricing** — `SegmentPrice` row matching the customer's pricing tier *(see mapper below)*.
4. **Variant base price** — `salePrice > 0` ? `salePrice` : `regularPrice`.

**Pricing tier mapper** ([`nextjs-frontend/src/utils/pricingMapper.ts`](nextjs-frontend/src/utils/pricingMapper.ts)):

| Customer type | Pricing tier used |
|---|---|
| `B2C` | `B2C` |
| `B2B` | `B2C` |
| `ENTERPRISE_1` | `ENTERPRISE_1` |
| `ENTERPRISE_2` | `ENTERPRISE_1` |

This indirection lets you adjust pricing for a tier without renaming customer types.

**High-value discount** ([`nextjs-frontend/src/utils/discount.ts`](nextjs-frontend/src/utils/discount.ts)):
- Eligibility: B2B customer **AND** subtotal ≥ $5,000
- 10% off applied at checkout (before tax + shipping)

**Important**: prices are also calculated server-side in `GET /cart` so the client doesn't have the final word. Always re-verify on the backend when reading totals for payment.

### 10.2 Guest cart merge

- Guest items: `localStorage["guest_cart_items_v1"]`
- On login, `CartProvider` calls `POST /api/cart/merge` with the array
- Backend merges into authenticated cart (duplicate variants → quantities sum)
- localStorage cleared

### 10.3 Stock receipt approval (supply chain gate)

Source: [`nodejs-api/routes/stock-receipts.js`](nodejs-api/routes/stock-receipts.js).

A receipt becomes APPROVED only when at least one line is matched (`MANUAL_MATCHED` or `AUTO_MATCHED`). Lines left `UNMATCHED` remain pending and the receipt becomes `PARTIAL` rather than `APPROVED`.

Approval steps:
1. Validate receipt status is `PENDING`
2. For each matched line: create `InventoryMovement` (type `INBOUND`, qty = `effectiveQuantity`)
3. Stamp `appliedMovementId` on the line so it can't be double-applied
4. Update receipt: `status: APPROVED`, `processedBy`, `processedAt`

**Supplier parser registry** lives in `services/supplier-parsers/index.js`. Each supplier has a `parserKey` stored in `SupplierEmailSource.parserKey` (e.g. `ion_peptide_v1`). To add a new supplier:
1. Drop a new parser file in `services/supplier-parsers/`
2. Register it in the index
3. Create a `SupplierEmailSource` row pointing to it

### 10.4 Customer search + filtering

Search is **client-side** on `/landing/products` ([`products-client.tsx`](nextjs-frontend/src/app/landing/products/products-client.tsx)). The full catalog is loaded once, then the search box filters in JS using a token-based match against product name, fullName, and variant names. The backend `?search=` param is also implemented (see `routes/public-products.js`) for completeness, but the storefront does not use it currently.

When changing search behavior, remember to update both layers.

### 10.5 Partner billing

Each partner `SalesChannel` has a `PartnerStatementConfig` with cycle triggers:
- `billingCycleDays` (default 14)
- `balanceThreshold`, `orderCountThreshold`, `statementTotalThreshold` (any can trigger)

Twice-daily cron evaluates triggers and generates a `PartnerStatement` + `PartnerLedgerEntry` rows. Payment reconciliation is manual — admins create a `PartnerLedgerEntry` of type `PAYMENT` referencing the statement's `referenceId`.

---

## 11. Build & Deploy

### Frontend → Vercel
- Auto-deploys from `team-avo/AbscendraBio` `main` branch.
- Dashboard: [vercel.com/team-avos-projects/abscendra-bio](https://vercel.com/team-avos-projects/abscendra-bio)
- Build command: `npm run build` (Turbopack in dev only)
- Start: `npm run start`
- Env vars are set in the Vercel dashboard.
- Static assets in `public/` are served from `/`.

### Backend → Railway
- Project: AscendraBio (PostgreSQL + API).
- Auto-deploys from the same `team-avo/main` branch.
- Production DB URL is in Railway service vars.
- Pre-deploy migration: `npm run migrate:deploy`.
- Prisma binary targets include `linux-musl-openssl-3.0.x` for Railway containers.

### Build scripts

**Backend**
```
npm run dev               # nodemon server.js
npm start                 # node server.js
npm run migrate           # prisma migrate dev
npm run migrate:deploy    # production migrations
npm run db:generate       # prisma generate
npm run db:studio         # prisma studio
npm run seed              # prisma/seed.js
```

**Frontend**
```
npm run dev               # next dev (Turbopack)
npm run build             # next build
npm run start             # next start
npm run lint              # next lint
```

---

## 12. Operational Scripts

Located in `nodejs-api/scripts/`. Run with `node scripts/<name>.js` from the `nodejs-api/` directory so dependencies resolve.

| Script | Purpose |
|---|---|
| `gmail-auth.js` | One-time OAuth: prints a URL, you log in, paste the code, it stores a refresh token. Re-run when token is revoked. |
| `gmail-auth-loopback.js` | Same goal, different OAuth callback (loopback IP). Use when `urn:ietf:wg:oauth:2.0:oob` is rejected. |
| `e2e-stock-receipts.js` | End-to-end sanity check for the supplier-email import pipeline. |
| `seed-ion-peptide-products.js` | Seeds the 21 Ion Peptide products + 30 variants + matches receipt #141139 + approves it. Idempotent — skips existing rows. |
| `seed-ion-peptide-receipt-prod.js` | Seeds just the `PendingStockReceipt` for receipt #141139 (used before product seeder). |
| `smoke-test-modules.js` | Validates Prisma client, S3 connectivity, etc. Useful as a Railway healthcheck. |

To target production from a local script, prefix with `DATABASE_URL=...`:
```bash
DATABASE_URL="postgresql://..." node scripts/seed-ion-peptide-products.js
```

---

## 13. Known Issues & Follow-ups

- **Product images for the 21 Ion Peptide products are missing.** Frontend falls back to a `FlaskConical` placeholder; admin should upload images via the product editor.
- **Retail markup for Ion Peptide products** — they were created at supplier unit cost (e.g. BW 10ml at $424.02). Markup needs review.
- **Gmail OAuth consent screen** is set to *Internal* under the `peptide-agents` GCP project, blocking `devops@medoflow.com`. Switch to *External*, or create new credentials under the `medoflow.com` GCP project.
- **Rate limiting** (`express-rate-limit`) is wired but disabled. Re-enable after deciding window/limit.
- **No automated test suite.** Manual verification only. Smoke scripts in `scripts/` are the closest thing to integration tests.
- **Cron has no catch-up.** Restarts/downtime mean missed runs are dropped.

---

## 14. Adding a Feature — Checklist

For most new features touching the catalog, orders, or customers:

1. **Schema** — add/modify Prisma models in `prisma/schema.prisma`; run `npx prisma migrate dev --name <desc>`.
2. **Backend route** — drop a file in `nodejs-api/routes/`; mount in `app.js` under the right base path; protect with `authMiddleware` if non-public.
3. **API client** — add typed methods in `nextjs-frontend/src/lib/api-<domain>.ts`.
4. **UI** — page under `nextjs-frontend/src/app/...`; reuse components from `components/ui/`.
5. **Context** — only add to `auth-context.tsx` / `cart-context.tsx` if state is truly cross-cutting; prefer local state otherwise.
6. **Permissions** — for admin features, gate with `hasPermission(module, action)` on the frontend and check the role/permission on the backend.
7. **Email** — for transactional notifications, add a new `EmailTemplate` type, wire it via `utils/emailService.js`.
8. **Cron** — if scheduled, add to `cron/` and register in `server.js`.

---

## 15. Useful File References

| File | Why |
|---|---|
| [`nodejs-api/app.js`](nodejs-api/app.js) | All route mounts in one place |
| [`nodejs-api/server.js`](nodejs-api/server.js) | Cron registration |
| [`nodejs-api/prisma/schema.prisma`](nodejs-api/prisma/schema.prisma) | Source of truth for data model |
| [`nodejs-api/middleware/auth.js`](nodejs-api/middleware/auth.js) | JWT verification + role checks |
| [`nodejs-api/routes/stock-receipts.js`](nodejs-api/routes/stock-receipts.js) | Approval flow business rules |
| [`nodejs-api/cron/supplierEmailPoll.js`](nodejs-api/cron/supplierEmailPoll.js) | Gmail → PendingStockReceipt pipeline |
| [`nodejs-api/services/supplier-parsers/`](nodejs-api/services/supplier-parsers/) | Pluggable email parsers |
| [`nextjs-frontend/src/contexts/auth-context.tsx`](nextjs-frontend/src/contexts/auth-context.tsx) | Frontend auth state |
| [`nextjs-frontend/src/contexts/cart-context.tsx`](nextjs-frontend/src/contexts/cart-context.tsx) | Cart pricing logic |
| [`nextjs-frontend/src/utils/pricingMapper.ts`](nextjs-frontend/src/utils/pricingMapper.ts) | Customer-type → pricing-tier mapping |
| [`nextjs-frontend/src/utils/discount.ts`](nextjs-frontend/src/utils/discount.ts) | High-value discount logic |
| [`nextjs-frontend/next.config.js`](nextjs-frontend/next.config.js) | Image hosts, standalone mode |

---

*See Doc 1 — Product Overview — for the non-technical explanation of the platform.*
