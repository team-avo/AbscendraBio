# Product Requirements Document (PRD)

## Ascendra Bio — E-Commerce Platform

**Version:** 1.0
**Last Updated:** April 2026
**Brand:** Ascendra Bio (USA-based research peptide supplier)
**Domain Convention:** `ascendrabio.com` for all internal staff accounts

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Roles & Access Levels](#2-user-roles--access-levels)
3. [Researcher Storefront](#3-researcher-storefront)
4. [Researcher Account Portal](#4-researcher-account-portal)
5. [Back-Office Dashboard](#5-back-office-dashboard)
6. [Sales Director Portal](#6-sales-director-portal)
7. [Account Executive Portal](#7-account-executive-portal)
8. [Authentication & Security](#8-authentication--security)
9. [Naming Conventions & Demo Data](#9-naming-conventions--demo-data)
10. [Technical Architecture](#10-technical-architecture)
11. [Data Model Overview](#11-data-model-overview)
12. [Key Workflows & State Diagrams](#12-key-workflows--state-diagrams)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Integrations](#14-integrations)
15. [Analytics Events & KPIs](#15-analytics-events--kpis)
16. [Roadmap & Out of Scope](#16-roadmap--out-of-scope)

---

## 1. Product Overview

Ascendra Bio is a full-featured B2B/B2C e-commerce platform designed for the research peptide industry in the United States. The platform serves four distinct audiences through role-based portals:

- **Researchers** (customers) browse a public-facing storefront, place orders, and manage their lab accounts.
- **Admins & Operations Leads** operate a full back-office dashboard covering orders, products, researchers, analytics, content, marketing, and system settings.
- **Sales Directors** oversee account executive teams, track territory performance, and recruit new AEs.
- **Account Executives** (AEs) manage their assigned researcher portfolios and view orders.

### 1.1 Key Platform Capabilities

| Capability | Description |
|---|---|
| Multi-tier Researcher Pricing | Four researcher segments (Tier 1, Tier 2, Enterprise 1, Enterprise 2), each with independent pricing |
| Bulk & Volume Pricing | Automatic price breaks based on order quantity |
| Sales Team Hierarchy | Admin > Sales Director > Account Executive structure with researcher assignment |
| Quality & Compliance | Third-party lab test reports (purity, endotoxicity, sterility) publicly accessible |
| Multi-channel Sales | Sales channel management with per-channel pricing and Odoo ERP sync |
| Full CMS | Blog, static pages, navigation menus, and media library |
| Email Marketing | Campaign creation, targeted blasts, and transactional email templates |

### 1.2 Business Goals & Success Metrics

The platform exists to move Ascendra Bio from single-channel direct sales to a scalable, multi-tier B2B / B2C operation. Every feature in this PRD maps back to one of four business goals.

| Goal | Why It Matters | Primary Metrics |
|---|---|---|
| **Grow researcher acquisition** | Peptide buyers research for weeks before purchase; SEO + content + trust signals drive first orders | New verified accounts / month, first-order conversion rate, landing → product CTR |
| **Increase repeat orders** | The long-tail LTV of a verified researcher is 8–20× the first order value | Repeat purchase rate (90-day), researcher lifetime value (LTV), favorites → purchase conversion |
| **Scale the sales team efficiently** | Enterprise and Tier 2 relationships require human AEs; the platform must remove admin overhead | Revenue per AE, researchers-per-AE, AE response time to quote requests |
| **Maintain compliance & trust** | Research peptide industry is visibility-sensitive; any missing COA or compliance failure creates churn | % SKUs with current COA, complaint rate, audit-log completeness |

**North-star metric:** *Monthly Verified Researcher Revenue* — total revenue attributable to researchers whose accounts have passed verification and admin approval. This combines acquisition, repeat purchase, and average order value into one number the business can steer on.

### 1.3 User Personas

Concrete personas that every feature should serve. Personas drive UX decisions — when a feature conflicts, default to the persona with more frequent usage.

#### Persona 1 — "Dr. Harrison" (Tier 1 Researcher)
- **Role:** Independent biohacker / solo researcher
- **Volume:** 1–3 peptides per month, $50–$300 per order
- **Goals:** Find trustworthy peptides with published COAs; order quickly from their phone; track shipping
- **Pain points:** Distrust of suppliers who hide test reports; confusing bulk-vs-single pricing; slow shipping
- **Platform needs:** Fast product browse, clear COA access, mobile-first checkout, email order updates

#### Persona 2 — "Lisa Nakamura" (Tier 2 Wholesale / Small Lab)
- **Role:** Purchasing lead at a 5–20-person research lab
- **Volume:** 10–40 peptides per month, $1K–$10K per order
- **Goals:** Get volume pricing without per-order negotiation; place recurring orders efficiently; loop in a sales rep for special needs
- **Pain points:** Manually re-entering standard orders; tracking which COA batch shipped; purchase-order compatibility
- **Platform needs:** Favorites + reorder flow, bulk pricing transparency, assigned AE contact, downloadable invoices

#### Persona 3 — "Dr. Klein" (Enterprise)
- **Role:** Director of procurement at an academic research institute or commercial biotech
- **Volume:** Sporadic but very large ($10K–$100K per order)
- **Goals:** Custom bulk quotes, dedicated support, institutional billing (PO / net-30), procurement compliance
- **Pain points:** Most peptide sites are consumer-oriented and can't handle PO workflows; no contract pricing
- **Platform needs:** Bulk quote request flow, tier-specific pricing pre-negotiated with AE, flexible payment terms

#### Persona 4 — "Sarah Chen" (Account Executive)
- **Role:** Inside sales for Ascendra Bio, handles 20–50 assigned researchers
- **Goals:** See who to follow up with today, respond to quotes within hours, never miss a high-value order
- **Pain points:** Switching tabs between CRM / order system / email; no view of researcher's recent activity
- **Platform needs:** Unified researcher dashboard with order history, quote inbox, tier-upgrade alerts

#### Persona 5 — "Rachel Thornton" (Sales Director)
- **Role:** Leads the AE team; compensated on team revenue
- **Goals:** Distribute accounts fairly, spot underperforming AEs early, recruit replacements when territories open
- **Pain points:** No visibility into individual AE pipelines; hard to reassign researchers when an AE leaves
- **Platform needs:** Team analytics, AE performance comparison, drag-drop re-assignment

#### Persona 6 — "Marcus Whitfield" (Admin / Founder)
- **Role:** CEO / founder; looks at the business weekly
- **Goals:** Know this week's revenue at a glance, understand trend directions, catch compliance gaps
- **Pain points:** Scattered reports; no single source of truth on revenue
- **Platform needs:** Executive dashboard, drill-down analytics, full audit logs

### 1.4 Glossary

Standardized terminology used throughout this PRD and the product UI.

| Term | Definition |
|---|---|
| **Peptide** | A short chain of amino acids, the core product sold on the platform |
| **Variant** | A specific size / concentration of a peptide (e.g., BPC-157 at 5mg vs 10mg) — the unit a researcher actually buys |
| **SKU** | Stock-keeping unit — the unique identifier for a variant (e.g., `ASB-BPC157-5MG`) |
| **Batch / Lot** | A manufactured run of a specific variant, tied to a Certificate of Analysis (COA) |
| **COA** (Certificate of Analysis) | The third-party lab report certifying purity, endotoxicity, or sterility for a specific batch |
| **Segment / Tier** | A researcher's pricing bucket — Tier 1 (consumer), Tier 2 (small-lab B2B), Enterprise 1, Enterprise 2 |
| **Bulk Pricing** | Quantity-based discount tiers within a single order (e.g., 10–24 units = $X, 25+ = $Y) |
| **Segment Pricing** | Account-level discount pricing based on the researcher's assigned tier |
| **Sales Channel** | A distribution channel (direct storefront, Odoo ERP, Amazon, etc.) with its own pricing and commission rules |
| **Assigned AE** | The Account Executive responsible for a specific researcher's sales relationship |
| **Bulk Quote** | A researcher-initiated request for custom volume pricing outside standard tiers |
| **Tier Upgrade** | Automatic or manual promotion of a researcher from their current tier to a higher one |
| **NPI** | National Provider Identifier — a 10-digit code required from US healthcare-adjacent researchers |
| **PO / Net-30** | Purchase order with 30-day payment terms; used by Enterprise accounts |
| **Odoo** | The ERP system Ascendra Bio syncs to for inventory, invoicing, and fulfillment |
| **Authorize.Net** | The primary card payment gateway (stored as enum value `AUTHORIZE_NET`) |

---

## 2. User Roles & Access Levels

The platform defines six user roles. Each role determines which sections of the application are accessible.

### Role Hierarchy

```
ADMIN               (full access to every feature — lab owner / founder)
  │
OPERATIONS_LEAD         (all back-office features except user / role management)
  │
FULFILLMENT_ASSOCIATE   (order fulfillment, product management, inventory)
  │
SALES_DIRECTOR          (AE team management, team analytics, recruitment)
  │
ACCOUNT_EXECUTIVE       (researcher assignment, order viewing)
  │
RESEARCHER              (storefront, account portal, ordering)
```

> **Note on role naming:** These display names are brand-aligned for Ascendra Bio's biotech positioning. The underlying database enum values (`ADMIN`, `MANAGER`, `STAFF`, `SALES_MANAGER`, `SALES_REP`, `CUSTOMER`) are retained in the codebase for backward compatibility. The UI surfaces the branded names; the code references the enums. A future migration may fully rename the enums.

### Detailed Access Matrix

Column headers use the branded role names. Legend: **Admin** = founder / owner, **Ops Lead** = operations manager, **Fulfillment** = fulfillment associate, **Sales Dir.** = sales director, **AE** = account executive, **Researcher** = end researcher / lab client.

| Section | Admin | Ops Lead | Fulfillment | Sales Dir. | AE | Researcher |
|---|---|---|---|---|---|---|
| **Storefront & Shopping** | - | - | - | - | - | Full |
| **Account Portal** | Full | Full | Full | Full | Full | Full |
| **Back-Office Dashboard** | Full | Full | Full | - | - | - |
| **Order Management** | Full | Full | Full | View | View | Own only |
| **Product Management** | Full | Full | View | - | - | - |
| **Product Create/Edit** | Full | Full | - | - | - | - |
| **Researcher Management** | Full | Full | Full | View | View | - |
| **Researcher Approvals** | Full | Full | Full | - | - | - |
| **Analytics — Sales** | Full | Full | Full | - | - | - |
| **Analytics — AE Performance** | Full | Full | - | Full | - | - |
| **Analytics — Sales Directors** | Full | Full | - | - | - | - |
| **User Management** | Full | Full | - | - | - | - |
| **Coupons** | Full | Full | - | - | - | - |
| **Settings** | Full | Full | - | - | - | - |
| **Content (CMS)** | Full | Full | - | - | - | - |
| **Marketing** | Full | Full | - | - | - | - |
| **Third-Party Testing** | Full | Full | - | - | - | - |
| **Payments** | Full | Full | - | - | - | - |
| **Shipping Config** | Full | Full | Full | - | - | - |
| **Inventory** | Full | Full | Full | - | - | - |
| **Bulk Quotes** | Full | Full | Full | - | - | - |
| **Tier Upgrades** | Full | Full | - | - | - | - |
| **Sales Director Portal** | - | - | - | Full | - | - |
| **Researcher Self-Assignment** | - | - | - | Full | Full | - |

---

## 3. Researcher Storefront

The public-facing storefront is accessible without login. Ordering requires authentication (researcher account).

### 3.1 Landing Page

| Feature | Description |
|---|---|
| Hero Banner | Animated hero with headline, particle molecular background, and two CTAs ("Start Research", "Review Lab Reports") |
| Trust Metrics | Four badges: 99%+ Purity, 24hr Shipping, 30+ Peptides, Made in USA |
| Popular Peptides | Auto-advancing carousel (mobile) / paginated grid (desktop) showing top products. Requires login to view. |
| Why Choose Us | Three value proposition cards covering purity, shipping speed, and testing verification |
| Testimonials | Rotating carousel of practitioner reviews with star ratings |
| Inquiry Form | Contact modal with Name, Email, Phone, Message fields; sends email to the lab |

### 3.2 Product Catalog (`/landing/products`)

| Feature | Description |
|---|---|
| Product Grid | Paginated display (24 per page) with product image, name, price, purity badge, stock status, and star rating |
| Search | Real-time search by product name |
| Category Filters | Filter by product category |
| Sort Options | Featured, Alphabetical A-Z, Price Low-to-High, Price High-to-Low |
| Responsive Layout | Adapts from multi-column grid (desktop) to single-column list (mobile) |

### 3.3 Product Detail Page (`/landing/products/[id]`)

| Feature | Description |
|---|---|
| Product Info | Full name, description, images, pricing |
| Variant Selection | Choose between different concentrations/sizes |
| Segment Pricing | Prices displayed based on logged-in researcher tier |
| Reviews | Researcher reviews with star ratings |
| Add to Cart | Quantity selector + add-to-cart button |
| Add to Favorites | Heart icon to save to wishlist |
| Bulk Quote | Option to request a custom bulk quote |

### 3.4 Shopping Cart

| Feature | Description |
|---|---|
| Cart Sidebar | Slide-out panel showing all items with quantity adjusters and remove buttons |
| Guest Cart | Stored in localStorage for unauthenticated users |
| Authenticated Cart | Synced with backend; guest cart merges on login |
| Automatic Pricing | Bulk tiers, segment pricing, and high-value discounts applied automatically |
| Real-time Totals | Subtotal and total update on every change |

#### Pricing Engine — Resolution Order

For every line item, the displayed unit price is the result of this precedence chain. The first rule that applies wins.

```
1. Bulk Price         (if quantity falls inside a bulk tier for this variant)
         ↓ (if none)
2. Segment Price      (if researcher's tier has a price override for this variant)
         ↓ (if none)
3. Sale Price         (if variant has a sale price set and sale is active)
         ↓ (if none)
4. Regular Price      (fallback — always present)
```

Once the unit price is resolved for each line, order-level adjustments apply in this order:

1. **Coupon** — percentage or fixed-amount discount applied to the subtotal (after line prices)
2. **High-value discount** — automatic threshold discount (e.g., 5% off orders over $500)
3. **Shipping** — added based on shipping tier rules (weight, destination, free-shipping thresholds)
4. **Tax** — applied after subtotal + discounts, before shipping, per tax jurisdiction

**Worked example** — Tier 2 researcher orders 30 units of a variant:

| Step | Source | Amount |
|---|---|---|
| Regular Price | Variant | $20.00 / unit |
| Segment Price (Tier 2) | Variant segment config | $18.00 / unit |
| Bulk Price (25–49 units) | Variant bulk tier | $15.00 / unit ← **wins** |
| Line subtotal (30 × $15) | | $450.00 |
| Coupon `RESEARCH10` (10%) | Order-level | −$45.00 |
| Subtotal after discount | | $405.00 |
| Shipping (flat tier) | | $12.00 |
| Tax (estimated 8%) | Jurisdiction | $32.40 |
| **Total** | | **$449.40** |

#### Cart Business Rules

| Rule | Behavior |
|---|---|
| Out-of-stock add | Blocked with inline message; item stays on product page wishlist-only |
| Quantity exceeds stock | Cart silently caps to available stock and shows warning toast |
| Guest → login merge | Backend cart wins on conflicts; duplicate variants merge quantities |
| Cart abandonment | After 30 minutes of inactivity, cart flagged for abandoned-cart email (back-office feature) |
| Maximum line quantity | 500 per variant (configurable in settings) |
| Price change during checkout | Recalculated at order creation; user shown diff if final price changed |

### 3.5 Checkout (`/landing/checkout`)

A 4-step guided flow. Each step validates before advancing; the order is created only at the Payment step.

```
Step 1 — Items        → Step 2 — Shipping      → Step 3 — Payment      → Step 4 — Confirmation
(/landing/checkout)     (/landing/checkout        (/landing/checkout       (success page with
                         /items)                   /payment)                 order details)
```

| Step | Route | What Happens | Validation |
|---|---|---|---|
| 1. Items | `/landing/checkout` | Review cart, adjust quantities, apply coupon | Stock available, qty > 0, coupon valid |
| 2. Shipping | `/landing/checkout/items` | Pick or enter shipping address (Google Places autocomplete); same-as-shipping billing toggle | Address complete, within supported regions |
| 3. Payment | `/landing/checkout/payment` | Select payment method, enter details, review final total | Gateway success, no price drift |
| 4. Confirmation | Success page | Order number shown, email receipt sent, cart cleared | — |

| Feature | Description |
|---|---|
| Cart Review | Full item list with quantity adjustment |
| Shipping Address | Google Places autocomplete + manual entry; saved addresses selectable |
| Billing Address | Same-as-shipping toggle or separate entry |
| Promo Code | Coupon code input with validation |
| Order Summary | Itemized pricing, discounts, shipping, and final total |
| Payment | Payment method selection and processing |
| Order Confirmation | Success page with order details |

#### Payment Methods

The platform supports three payment types (enum values: `AUTHORIZE_NET`, `ZELLE`, `BANK_WIRE`).

| Method | Enum | Flow | Availability |
|---|---|---|---|
| Credit / Debit Card | `AUTHORIZE_NET` | Inline card form, real-time auth; order status → Processing on success | All researchers |
| Zelle | `ZELLE` | Instructions shown post-order; order status → Pending until payment confirmed manually | All researchers |
| Bank Wire | `BANK_WIRE` | Wire instructions shown; Net-30 eligible for Enterprise tiers with approved PO | Enterprise 1, Enterprise 2 |

#### Checkout Edge Cases & Error States

| Scenario | Behavior |
|---|---|
| Session expires mid-checkout | Guest data preserved in localStorage; auth users prompted to re-login |
| Payment declined | Show gateway error, remain on Payment step, allow retry with same or different method |
| Stock depleted during checkout | Line capped to available; user shown diff and asked to confirm new total |
| Coupon expired during checkout | Coupon silently removed; subtotal recalculated with warning toast |
| Address in unsupported region | Shipping step blocks advancement with "Contact your AE for international shipping" message |
| Duplicate submit | Idempotency key prevents duplicate order creation |

### 3.6 Third-Party Lab Reports (`/landing/third-party-testing`)

| Feature | Description |
|---|---|
| Report Browser | Searchable list of all testing certificates |
| Category Filter | Filter by Purity, Endotoxicity, or Sterility |
| View & Download | Open reports in-browser or download signed PDFs |
| Timestamps | Report creation and update dates displayed |

### 3.7 Collections (`/collections`)

| Feature | Description |
|---|---|
| Collection Pages | Curated groups of products with SEO metadata and JSON-LD structured data |

### 3.8 Dynamic Content Pages (`/p/[slug]`)

| Feature | Description |
|---|---|
| CMS Pages | Admin / Ops Lead–created pages rendered at custom slugs (e.g., `/p/about-us`, `/p/faq`) |

### 3.9 Global Navigation

| Element | Description |
|---|---|
| Header | Sticky navbar with logo, navigation links (Products, 3rd Party Testing, Contact), search bar, cart icon with count badge, and login/avatar dropdown |
| Footer | Brand info, inquiry email form, product showcase, navigation links, social links, copyright |
| Mobile | Hamburger menu with slide-out panel |

---

## 4. Researcher Account Portal

Authenticated researchers access their account portal at `/account`. It uses the same sidebar layout as the back-office dashboard.

### 4.1 Profile Management (`/account`)

| Feature | Description |
|---|---|
| Personal Info | Edit first name, last name, email, mobile, company, license number |
| Saved Addresses | Add, edit, delete shipping/billing addresses with Google Places autocomplete |
| Default Address | Set a default shipping and billing address |
| Rep Info | View assigned sales representative (if any) |

### 4.2 Order History (`/account/orders`)

| Feature | Description |
|---|---|
| Order List | All orders with search, status filter (Active/Delivered/Cancelled), and date range filter |
| Order Detail | Full breakdown with items, quantities, prices, shipping/billing info, payment status, and tracking |
| Invoice | Download order invoice |

### 4.3 Favorites (`/account/favorites`)

| Feature | Description |
|---|---|
| Saved Products | Grid of favorited items with quick links to product pages and remove buttons |

### 4.4 Bulk Quotes (`/account/bulk-quotes`)

| Feature | Description |
|---|---|
| Quote List | All submitted bulk quote requests with status (Pending Review / Reviewed) |
| Request Quote | Submit new bulk quote requests for specific products and quantities |

### 4.5 Comments (`/account/comments`)

| Feature | Description |
|---|---|
| Comment History | View all comments and reviews left on orders and products |

---

## 5. Back-Office Dashboard

The back-office is accessed at `/admin-dashboard` and uses a sidebar navigation layout. All features below are available to **Admin** and **Operations Lead** roles unless noted otherwise.

### 5.1 Dashboard Home (`/admin-dashboard`)

| Feature | Description |
|---|---|
| Revenue Metrics | 30-day revenue with trend comparison |
| Order Metrics | Total orders, pending, processing counts with change percentages |
| Researcher Metrics | Total and active researcher counts |
| Product Metrics | Active product count |
| Recent Orders | Table of latest orders with researcher, amount, status |
| Top Products | Best sellers by sales volume, revenue, and stock level |
| Researcher Distribution | Pie chart of Wholesale vs Enterprise researchers |
| Sales Trend | Monthly revenue and order volume chart |
| Stock Alerts | Low inventory item warnings |
| Quick Actions | Create researcher, create order buttons |

### 5.2 Order Management (`/orders`)

**Status-Specific Views:**

| Route | Status | Description |
|---|---|---|
| `/orders` | All | Complete order list with all statuses |
| `/orders/pending` | Pending | Orders awaiting confirmation |
| `/orders/processing` | Processing | Orders being prepared |
| `/orders/label-printed` | Label Printed | Shipping labels generated |
| `/orders/shipped` | Shipped | Orders in transit |
| `/orders/delivered` | Delivered | Successfully delivered orders |
| `/orders/cancelled` | Cancelled | Cancelled orders |
| `/orders/failed-payments` | Failed | Orders with payment failures (Admin / Ops Lead / Fulfillment only) |

**Capabilities (All Order Pages):**

| Feature | Description |
|---|---|
| Search | Full-text search by order number, researcher name, product |
| Filters | Status, date range (presets + custom), researcher type (Wholesale / Enterprise), payment method, account executive, sales channel |
| Create Order | Manual order creation dialog |
| Edit Order | Modify order details |
| Update Status | Change order status with tracking info |
| Delete Order | Permanently remove order |
| Export to Excel | Download current filtered results as .xlsx |
| Email Report | Send filtered order report to any email address |

#### Order State Machine

Orders move through these states. Transitions are logged in `status history` with actor, timestamp, and optional note. Only forward transitions are automatic; backward moves (e.g., Processing → Pending) are restricted to Admin / Ops Lead and require a reason.

```
                    ┌──────────────→ CANCELLED
                    │                    ▲
                    │                    │ (manual cancel)
  PENDING ──→ PROCESSING ──→ LABEL_CREATED ──→ SHIPPED ──→ DELIVERED
     │              │
     │              └──→ ON_HOLD (payment review, stock issue)
     │                      │
     │                      └──→ PROCESSING (after resolution)
     │
     └──→ FAILED_PAYMENT (gateway decline, awaiting retry)
```

| State | Trigger | Who Can Set | Side Effects |
|---|---|---|---|
| `PENDING` | Order created; payment not yet confirmed (Zelle / wire) | System, Admin, Ops Lead | Stock reserved, researcher email sent |
| `PROCESSING` | Payment confirmed OR card charged | System (auto), Fulfillment | AE notified, warehouse pick-list generated |
| `LABEL_CREATED` | Shipping label generated in carrier system | Fulfillment | Tracking number attached |
| `SHIPPED` | Package handed to carrier | Fulfillment | Researcher email w/ tracking |
| `DELIVERED` | Carrier confirms delivery | System (webhook), Fulfillment | Review request email after 3 days |
| `CANCELLED` | Researcher cancels, or Admin cancels | Admin, Ops Lead, Fulfillment | Stock released, refund initiated if paid |
| `FAILED_PAYMENT` | Gateway declines card | System | Retry email to researcher |
| `ON_HOLD` | Manual review required | Admin, Ops Lead | AE notified to contact researcher |

### 5.3 Product Management (`/products`)

**Main Product List:**

| Feature | Description |
|---|---|
| Product Grid | Paginated list with search, status filter (Active/Draft/Inactive/Archived), and category filter |
| Stats | Total, Active, Draft, Inactive, Archived counts |
| Create Product | Multi-tab form: Basic Info, Variants, Images, Categories/Tags |
| Edit Product | Full product editor with variant management, images, reviews, related products, SEO fields |
| Sort Management | Drag-and-drop product sort order; mark products as "Popular" |
| Delete Product | Remove product with confirmation |

**Product Sub-Sections:**

| Route | Feature | Description |
|---|---|---|
| `/products/create` | Product Creator | Multi-tab form with variants, segment pricing, bulk pricing, images, SEO |
| `/products/edit/[id]` | Product Editor | Same as creator but for existing products; includes reviews and related products tabs |
| `/products/categories` | Categories | Create, edit, delete product categories |
| `/products/collections` | Collections | Curated product groups for storefront display |
| `/products/inventory` | Inventory | Stock levels by variant across warehouse locations |
| `/products/locations` | Warehouse Locations | Manage physical storage locations |
| `/products/bulk-upload` | Bulk Upload | CSV/Excel import for batch product creation |

**Variant & Pricing Model:**

Each product can have multiple variants. Each variant supports:

| Pricing Feature | Description |
|---|---|
| Regular Price | Base price |
| Sale Price | Discounted price (optional) |
| Segment Prices | Per-researcher-tier pricing (Tier 1, Tier 2, Enterprise 1, Enterprise 2) |
| Bulk Prices | Volume-based price breaks (min qty, max qty, unit price) |

### 5.4 Researcher Management (`/customers`)

**Researcher Views:**

| Route | Segment | Description |
|---|---|---|
| `/customers` | All | Unified researcher list with type / status / AE / director filters |
| `/customers/b2c` | Tier 1 | Individual researchers (Consumer tier) |
| `/customers/b2b` | Tier 2 | Small-lab researchers (Business tier) |
| `/customers/enterprise-1` | Enterprise 1 | First enterprise tier |
| `/customers/enterprise-2` | Enterprise 2 | Second enterprise tier |
| `/customers/wholesale` | Wholesale | Combined Tier 1 + Tier 2 view |
| `/customers/enterprise` | Enterprise | Combined Enterprise 1 + 2 view |
| `/customers/approvals` | Pending | New registrations awaiting Admin / Ops Lead approval |
| `/customers/rejected` | Rejected | Denied registrations |

**Capabilities:**

| Feature | Description |
|---|---|
| Create Researcher | Manual researcher creation dialog |
| Edit Researcher | Modify profile, status, tier |
| Manage Addresses | Add/edit/delete researcher addresses |
| Deactivate/Delete | Soft-deactivate or permanently delete |
| Approve/Reject | Action pending researcher registrations |
| Export to Excel | Download researcher data |
| Assign Account Executive | Link researcher to an AE |
| Assign Sales Director | Link researcher to a sales director |

#### Researcher Lifecycle

```
          ┌────────────────────────────────────┐
          ▼                                    │
  SIGNUP ──→ EMAIL_UNVERIFIED ──→ PENDING_APPROVAL ──→ ACTIVE ──→ DEACTIVATED
                    │                      │
                    │                      └──→ REJECTED (cannot sign in)
                    │
                    └──→ (link expires 24h → can re-send)
```

| State | Description | Can Log In? | Can Order? |
|---|---|---|---|
| `EMAIL_UNVERIFIED` | Signed up but hasn't clicked verification link | No | No |
| `PENDING_APPROVAL` | Verified email; Admin / Ops Lead review required | No | No |
| `ACTIVE` | Approved; normal usage | Yes | Yes |
| `REJECTED` | Admin rejected with a reason | No (shown rejection message) | No |
| `DEACTIVATED` | Admin soft-deleted account | No | No |

#### Tier Assignment Rules

| Rule | Behavior |
|---|---|
| Default tier on signup | Tier 1 (individual) unless researcher registered with a company + NPI |
| Tier upgrade trigger | Automatic notification when 90-day spend crosses threshold (configurable per tier) |
| Manual tier change | Admin / Ops Lead can set any tier directly from researcher detail page |
| Tier downgrade | Requires reason; logged in audit trail |

### 5.5 Analytics (`/analytics`)

| Route | Section | Description |
|---|---|---|
| `/analytics` | Overview | Key metrics dashboard |
| `/analytics/sales` | Sales Reports | Revenue and order trends with charts, date filters, channel filters, email reports |
| `/analytics/products` | Product Performance | Top products by revenue and units; category distribution pie chart |
| `/analytics/customers` | Researcher Insights | Acquisition trends, lifetime value, segmentation |
| `/analytics/sku` | SKU Analytics | Variant-level sales performance |
| `/analytics/sales-reps` | AE Performance | Individual AE metrics and commission tracking |
| `/analytics/sales-managers` | Sales Director Performance | Team-level metrics and territory analysis |
| `/analytics/person` | Individual Analytics | Deep-dive into a specific AE or director |
| `/analytics/manager-customer-assignment` | Assignment Tracking | Researcher-to-director mapping overview |

### 5.6 Coupons & Promotions (`/coupons`)

| Feature | Description |
|---|---|
| Coupon List | All coupons with search, status filter (Active/Inactive), type filter |
| Stats | Total coupons, active count, total usage, total discount amount |
| Create Coupon | Code, discount type (percentage/fixed), conditions, product restrictions, volume tiers |
| Edit/Delete | Modify or remove existing coupons |
| Usage Tracking | View how many times each coupon has been used |

### 5.7 User Management (`/users`)

| Feature | Description |
|---|---|
| User List | All staff users with search, role filter, status filter |
| Stats | Total users, active, inactive, Admin count |
| Create User | New user with role assignment (Admin, Ops Lead, Fulfillment, AE, Sales Director) |
| Edit User | Modify details, role, activation status |
| Delete User | Remove user account |

**Sales Team Management:**

| Route | Feature | Description |
|---|---|---|
| `/users/sales_users` | AE Management | Select an account executive, manage their researcher assignments via two tabs (Assigned / Add Researchers) |
| `/users/assign-customers` | Bulk Assignment | Two-panel interface for assigning researchers to any AE |
| `/sales-managers` | Director Hierarchy | Assign AEs to directors and researchers to directors; dual-panel with tabs |
| `/admin/sales-manager-assignments` | Director Assignments | Admin view of all director-researcher mappings |

### 5.8 Inventory (`/inventory`)

| Feature | Description |
|---|---|
| Stock Overview | Real-time stock levels for all product variants |
| Tabs | All Items, Low Stock, Out of Stock |
| Search | By product name or SKU |
| Edit Stock | Modify on-hand, available, and committed quantities |
| Committed Orders | View which pending orders are holding committed stock |
| Low Stock Threshold | Configurable alert thresholds per variant |

### 5.9 Shipping (`/shipping`)

| Feature | Description |
|---|---|
| Shipping Zones | Geographic zone configuration |
| Shipping Rates | Weight-based and price-based rate tables |
| Free Shipping | Threshold configuration |
| Carrier Integration | Carrier setup and estimated delivery times |
| Shipping Tiers | (`/settings/shipping-tiers`) Tiered shipping cost rules |

### 5.10 Payments (`/payments`)

| Feature | Description |
|---|---|
| Transaction List | All payment transactions with status filtering |
| Refund Management | Issue refunds on completed payments |
| Payment Metrics | Revenue, successful, pending, and failed payment counts |
| Export | Download transaction data |

### 5.11 Content Management (CMS)

| Route | Feature | Description |
|---|---|---|
| `/content/pages` | Static Pages | Create, edit, publish/draft pages with rich text editor; pages appear at `/p/[slug]` |
| `/content/pages/new` | New Page | Page creation with title, body, SEO metadata, publish status |
| `/content/pages/[id]/edit` | Edit Page | Modify existing pages |
| `/content/blog` | Blog | Create and manage blog posts with categories and scheduling |
| `/content/blog/new` | New Post | Blog post editor |
| `/content/navigation` | Navigation | Manage header/footer menu structure and link hierarchy |
| `/content/media` | Media Library | Upload, organize, and manage images and files |

### 5.12 Marketing (`/marketing`)

| Route | Feature | Description |
|---|---|---|
| `/marketing` | Overview | Marketing dashboard |
| `/marketing/campaigns` | Campaigns | Create and track email/SMS campaigns with scheduling, audience filtering, and performance metrics (opens, clicks, revenue) |
| `/marketing/email` | Email Analytics | Campaign performance metrics over customizable time ranges |
| `/marketing/targeted-blast` | Targeted Blast | Send marketing emails to specific researcher segments |

### 5.13 Third-Party Testing (`/third-party-testing`)

| Route | Category | Description |
|---|---|---|
| `/third-party-testing` | All Reports | Searchable list of all lab reports across categories |
| `/third-party-testing/purity` | Purity | Purity and net peptide content test results and certifications |
| `/third-party-testing/endotoxicity` | Endotoxicity | Endotoxin level testing results |
| `/third-party-testing/sterility` | Sterility | Sterility test documentation and batch approvals |

### 5.14 Bulk Quotes (`/bulk-quotes`)

| Feature | Description |
|---|---|
| Quote List | All researcher quote requests with search and read / unread status |
| Quote Detail | Researcher info, requested products, quantities |
| Actions | Mark as reviewed, delete, respond via email |

### 5.15 Tier Upgrades (`/tier-upgrades`)

| Feature | Description |
|---|---|
| Upgrade Notifications | Researchers eligible for tier upgrades based on spending thresholds |
| Priority Filter | Urgent and high-priority upgrade candidates |
| One-Click Upgrade | Instantly upgrade researcher tier |

### 5.16 Abandoned Carts (`/admin/abandoned-carts`)

| Feature | Description |
|---|---|
| Cart List | Carts inactive for 30+ minutes with researcher info and item details |
| Send Reminder | Email individual researchers about their abandoned cart |
| Bulk Send | Email all researchers with abandoned carts at once |

### 5.17 Internal Comments (`/admin/comments`)

| Feature | Description |
|---|---|
| Comment List | All order and researcher comments system-wide |
| Filters | Type filter (Order/Researcher), full-text search |
| Actions | View threads, add replies, delete comments |

### 5.18 Settings (`/settings`)

| Route | Section | Description |
|---|---|---|
| `/settings/general` | General | Store name, description, contact info, logo, address |
| `/settings/taxes` | Taxes | Tax rates, jurisdictions, and rules |
| `/settings/payments` | Payments | Gateway configuration (Stripe, PayPal, Bank Transfer); API keys, currency, test mode |
| `/settings/shipping` | Shipping | Shipping zones, rates, carriers, free shipping thresholds |
| `/settings/shipping-tiers` | Shipping Tiers | Tiered shipping cost rules |
| `/settings/locations` | Locations | Warehouse location management |
| `/settings/notifications` | Notifications | System notification dashboard with auto-refresh; CSV export |
| `/settings/email-templates` | Email Templates | 14 transactional email templates (order confirmation, shipping, welcome, payment alerts, etc.) with HTML editor |
| `/settings/sales-channels` | Sales Channels | Configure sales channels with commission rates, channel-specific pricing, and Odoo ERP sync logs |

---

## 6. Sales Director Portal

Sales Directors log in and are redirected to `/sales-manager/analytics`. They operate within a restricted sidebar showing Orders, Researchers, and their team management tools.

### 6.1 Team Analytics (`/sales-manager/analytics`)

| Feature | Description |
|---|---|
| Revenue Metrics | Total team revenue with trend charts |
| Order Metrics | Total orders processed by team |
| Researcher Metrics | Assigned and active researcher counts |
| Performance Table | Sortable by revenue, orders, researcher count |
| Date Range Filter | 1d, 7d, 14d, 30d, 90d, 365d, custom |
| Charts | Area charts for revenue/order trends, bar charts for comparison |

### 6.2 Team Management (`/sales-manager/my-team`)

| Feature | Description |
|---|---|
| AE List | All account executives assigned to this director with name, email, status, researcher count |
| Add AE | Add existing account executives to team |
| Edit AE | Update AE information |
| Password Reset | Send password reset to AEs |
| Activate/Deactivate | Toggle AE status |
| Delete AE | Remove AE from team |

### 6.3 Recruitment (`/sales-manager/recruitment`)

| Feature | Description |
|---|---|
| Available AEs | Browse unassigned account executives |
| Search | Find AEs by name or email |
| Recruit | Assign an unassigned AE to your team |
| Create New | Create a brand new account executive account |

### 6.4 Order & Researcher Access

Sales Directors can view the Orders and Researchers sections in read mode through the main sidebar navigation.

---

## 7. Account Executive Portal

Account Executives (AEs) log in and are redirected to `/orders`. They have the most restricted back-office access.

### 7.1 Researcher Self-Assignment (`/assign-customers`)

| Feature | Description |
|---|---|
| Unassigned Researchers | Browse researchers not yet assigned to any AE |
| Search | Filter by name or email |
| Assign to Me | One-click self-assignment button |
| Researcher Info | Name, email, type (Wholesale / Enterprise), approval status, current assignments |

### 7.2 Order & Researcher Viewing

Account Executives can view orders and researchers through the sidebar, but cannot create, edit, or delete records (except creating orders and payments where permitted).

---

## 8. Authentication & Security

### 8.1 Login Flows

| Flow | Description |
|---|---|
| Researcher Login | Email + password at `/login`; portal = Researcher (enum `CUSTOMER`) |
| Back-Office Login | Email + password at `/admin/login`; portal = Back-Office (enums `ADMIN`, `MANAGER`, `STAFF`, `SALES_MANAGER`, `SALES_REP`) |
| Email OTP | Passwordless login via 6-digit code sent to email |
| Portal Separation | Researcher credentials do not work on back-office login and vice versa |

**Demo Accounts (Seeded):**

All staff accounts use the `@ascendrabio.com` domain. All seeded passwords are `SecurePass123!`.

| Role (Branded) | Enum | Email | Display Name | Portal |
|---|---|---|---|---|
| Admin | `ADMIN` | `admin@ascendrabio.com` | Marcus Whitfield (Founder & CEO) | Back-office |
| Operations Lead | `MANAGER` | `operations@ascendrabio.com` | Elena Vasquez (Operations Manager) | Back-office |
| Fulfillment Associate | `STAFF` | `fulfillment@ascendrabio.com` | Devon Park (Fulfillment Lead) | Back-office |
| Sales Director | `SALES_MANAGER` | `sales.lead@ascendrabio.com` | Rachel Thornton (Sales Director) | Back-office (restricted) |
| Account Executive | `SALES_REP` | `sarah.chen@ascendrabio.com` | Sarah Chen | Back-office (restricted) |
| Researcher (Tier 1) | `CUSTOMER` | `dr.j.harrison@gmail.com` | Dr. James Harrison | Researcher |
| Researcher (Tier 2 / B2B) | `CUSTOMER` | `l.nakamura@vertexlabs.com` | Lisa Nakamura (Vertex Research Labs) | Researcher |
| Researcher (Enterprise 1) | `CUSTOMER` | `a.klein@helixbio.org` | Dr. Aaron Klein (Helix Bio Institute) | Researcher |

### 8.2 Registration

| Step | Description |
|---|---|
| Researcher Signup | Email, password, name, mobile, NPI / license number, optional lab info |
| Email Verification | Verification email sent; login blocked until verified |
| Admin Approval | Researcher account held in "pending" state until a Admin or Ops Lead approves |
| Internal Accounts | Created by Admins only; no public signup for back-office roles |

### 8.3 Password Reset

| Step | Description |
|---|---|
| Request | Enter email to receive reset link |
| Confirm | Click link, enter new password |

### 8.4 Permission System

Beyond role-based route access, a granular module-action permission system controls what each user can do:

- **Modules:** Researchers, Orders, Products, Payments, Transactions, Settings, Analytics
- **Actions:** Read, Create, Update, Delete
- **Enforcement:** Checked at both route level (ProtectedRoute wrapper) and UI level (button visibility)

### 8.5 Password & Session Policy

| Policy | Value | Rationale |
|---|---|---|
| Minimum password length | 10 chars | Balances memorability and entropy |
| Required character classes | 3 of 4 (upper, lower, digit, symbol) | Reduces common-password attacks |
| Password history | Last 5 prevented | Blocks re-use of recent passwords |
| Session length (researcher) | 30 days rolling | Low-friction repeat buying |
| Session length (back-office) | 8 hours | Tighter default for privileged roles |
| "Remember me" | Opt-in, extends session to 90 days (researcher only) | Opt-in keeps it intentional |
| Concurrent sessions | Unlimited; device list visible in account settings | Common for lab environments with shared terminals |
| Auto-logout on tab close | Only if "Remember me" unchecked | |

### 8.6 Rate Limiting & Abuse Protection

| Endpoint Class | Limit | Action on Exceed |
|---|---|---|
| Login (email + password) | 5 attempts / 15 min / IP | 15-min lockout + email alert to account |
| Password reset request | 3 / hour / account | Silent rate-limit (don't reveal) |
| OTP request | 3 / 10 min / email | Silent rate-limit |
| Signup form | 5 / hour / IP | CAPTCHA after threshold |
| Product search | 100 / min / session | Soft throttle with retry-after |
| API (authenticated) | 600 / min / user | 429 response |

### 8.7 Audit Log

Every sensitive action is logged to an append-only audit table. Logs are queryable from `/settings?tab=audit`.

| Event Class | Examples | Retention |
|---|---|---|
| Auth | Login success / fail, password change, OTP send | 2 years |
| Role / Permission change | User role edited, permission granted / revoked | 5 years |
| Researcher lifecycle | Approval, rejection, tier change, deactivation | 5 years |
| Order admin actions | Status override, cancellation, manual refund | 5 years |
| Financial | Payment captured, refund issued, payout posted | 7 years (tax compliance) |
| Settings | Tax rates, shipping zones, email templates | 2 years |

---

## 9. Naming Conventions & Demo Data

This section defines the canonical naming conventions used throughout the platform for demo data, seeded accounts, placeholders, and email addresses. These conventions ensure the demo experience feels cohesive, realistic, and aligned with the Ascendra Bio brand.

### 9.1 Email Domain Strategy

| Account Type | Domain | Example |
|---|---|---|
| Internal staff (Admin, Ops Lead, Fulfillment) | `@ascendrabio.com` | `operations@ascendrabio.com` |
| Sales team (managers, reps) | `@ascendrabio.com` | `sarah.chen@ascendrabio.com` |
| Warehouses / fulfillment centers | `@ascendrabio.com` | `fulfillment@ascendrabio.com` |
| Individual researchers (Tier 1) | `@gmail.com`, `@outlook.com` | `dr.j.harrison@gmail.com` |
| Wholesale / small-lab researchers (Tier 2) | Lab-specific domain | `contact@vertexlabs.com` |
| Enterprise research institutions | `.org` or institutional domain | `purchasing@helixbio.org` |
| Enterprise commercial biotech | Company `.com` | `orders@meridiantherapeutics.com` |

### 9.2 Internal Demo Accounts (Ascendra Bio Staff)

| Role (Branded) | Enum | Email | Name | Title |
|---|---|---|---|---|
| Admin | `ADMIN` | `admin@ascendrabio.com` | Marcus Whitfield | Founder & CEO |
| Operations Lead | `MANAGER` | `operations@ascendrabio.com` | Elena Vasquez | Operations Manager |
| Fulfillment Associate | `STAFF` | `fulfillment@ascendrabio.com` | Devon Park | Fulfillment Lead |
| Sales Director | `SALES_MANAGER` | `sales.lead@ascendrabio.com` | Rachel Thornton | Sales Director |
| Account Executive | `SALES_REP` | `sarah.chen@ascendrabio.com` | Sarah Chen | Senior Account Executive |
| Account Executive | `SALES_REP` | `m.rodriguez@ascendrabio.com` | Marcus Rodriguez | Account Executive |
| Account Executive | `SALES_REP` | `p.patel@ascendrabio.com` | Priya Patel | Account Executive |

### 9.3 Researcher Demo Accounts (by tier)

All researcher accounts use the `CUSTOMER` enum in the database.

| Tier | Email | Account Name | Lab / Affiliation |
|---|---|---|---|
| Tier 1 (Individual / B2C) | `dr.j.harrison@gmail.com` | Dr. James Harrison | Independent researcher |
| Tier 1 (Individual / B2C) | `m.torres.research@outlook.com` | Dr. Maya Torres | Independent researcher |
| Tier 2 (Wholesale / B2B) | `l.nakamura@vertexlabs.com` | Lisa Nakamura | Vertex Research Labs |
| Tier 2 (Wholesale / B2B) | `m.beaumont@catalystbio.com` | Mark Beaumont | Catalyst BioSciences |
| Enterprise 1 | `a.klein@helixbio.org` | Dr. Aaron Klein | Helix Bio Institute |
| Enterprise 2 | `p.shah@meridiantherapeutics.com` | Dr. Priya Shah | Meridian Therapeutics |

### 9.4 Sales Team Hierarchy (Seeded)

```
Rachel Thornton (Sales Director)
├── Sarah Chen (Account Executive)        → assigned: Dr. Harrison, Vertex Labs
├── Marcus Rodriguez (Account Executive)  → assigned: Helix Bio, Catalyst BioSciences
└── Priya Patel (Account Executive)       → assigned: Meridian Therapeutics, Dr. Torres
```

### 9.5 Placeholder Text Conventions

Input field placeholders throughout dialogs and forms follow this pattern:

| Context | Placeholder |
|---|---|
| Staff email entry (back-office) | `you@ascendrabio.com` |
| Researcher email entry | `researcher@labdomain.com` |
| New researcher creation | `name@labdomain.com` |
| Warehouse contact email | `fulfillment@yourcompany.com` |
| Phone number | `+1 (555) 123-4567` |
| NPI / License number | `1234567890` (10 digits) |
| Company name (B2B form) | `Vertex Research Labs` |

### 9.6 Default Credentials (Demo Only)

All seeded demo accounts use the password: **`SecurePass123!`**

> ⚠️ **Production note:** This password is for local demo / client presentation environments only. Production deployments must enforce unique passwords per account, reset on first login, and rotate Admin credentials regularly.

### 9.7 Order & Transaction Sample Data

The 18 seeded demo orders distributed across all order statuses (Pending, Processing, Label Printed, Shipped, Delivered, Cancelled, On Hold) reference the seeded researcher accounts above. All order payments use the `AUTHORIZE_NET` payment type (the canonical enum value; other supported values are `ZELLE` and `BANK_WIRE`).

### 9.8 Product & SKU Naming

Seeded research peptides follow the industry-standard scientific naming format (e.g., `BPC-157`, `TB-500`, `GHK-Cu`, `Semaglutide`). SKU codes follow the pattern `ASB-<PEPTIDE>-<VARIANT>` — for example, `ASB-BPC157-5MG` or `ASB-TB500-10MG`. The `ASB-` prefix identifies Ascendra Bio inventory.

---

## 10. Technical Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui component library |
| State Management | React Context (Auth, Cart, Dashboard, Google Places) |
| Data Fetching | Custom API client with JWT authentication |
| Charts | Recharts |
| Spreadsheets | SheetJS (xlsx) for Excel export |
| Maps/Address | Google Places API autocomplete |
| Fonts | Geist, Geist Mono, Barlow |
| Theme | Light mode (dark mode infrastructure present but defaulting to light) |

### Route Protection

All back-office routes are protected client-side using a `<ProtectedRoute>` wrapper component that checks:
1. User authentication status
2. User role against allowed roles list
3. Granular permissions (where applicable)

Unauthenticated users are redirected to the login page. Unauthorized users see an access denied message.

### Layout Architecture

| Layout | Scope | Components |
|---|---|---|
| Root Layout | All pages | Theme, Auth, Cart, Google Places providers; conditional header / footer (hidden on back-office routes) |
| Landing Layout | `/landing/*` | Light theme enforcement |
| Account Layout | `/account/*` | Dashboard sidebar layout (Researcher Portal) |
| Dashboard Layout | All back-office routes | Sidebar navigation with role-based menu items |

---

## 11. Data Model Overview

High-level view of the primary entities and their relationships. This is a simplified conceptual model — the live Prisma schema has additional fields, indexes, and join tables.

```
User ──────┬───── Researcher (profile) ───── Address (many)
           │           │                  ──── SalesAssignment (many) ─── User (AE / Director)
           │           └──── Order (many) ──── OrderItem (many) ──── Variant
           │                        └──── Payment (1..many)
           │                        └──── StatusHistory (many)
           │
           └─── (staff) SalesTeam ─── Director → AEs (many)

Product ──── Variant (many) ──── SegmentPrice (per tier)
                    │        ──── BulkPrice (tiers)
                    │        └──── Inventory (per warehouse)
                    └──── Image (many)
                    └──── Review (many)

Collection ─── Product (many, via join)
Category   ─── Product (many, via join)

Coupon ───── AppliedCoupon ───── Order
Batch  ───── COA (purity / endotoxicity / sterility) ───── TestReport
SalesChannel ── ChannelPrice (per variant)
```

### 11.1 Core Entities

| Entity | Key Fields | Notes |
|---|---|---|
| `User` | id, email, passwordHash, role (enum), status, mfaEnabled | Single table for all roles |
| `Researcher` | userId, tier, npi, companyName, licenseNumber, assignedAEId | 1:1 with User where role = CUSTOMER |
| `Product` | id, name, slug, status, description, seoTitle, seoDescription | Has many Variants |
| `Variant` | id, productId, sku, name, regularPrice, salePrice, weightGrams | The sellable unit |
| `SegmentPrice` | variantId, tier, price | Per-tier override |
| `BulkPrice` | variantId, minQty, maxQty, unitPrice | Quantity breaks |
| `Inventory` | variantId, locationId, onHand, committed, available | available = onHand − committed |
| `Order` | id, orderNumber, researcherId, status, subtotal, discount, tax, shipping, total, paymentType, salesChannelId | |
| `OrderItem` | id, orderId, variantId, qty, unitPrice, lineTotal | Captures price at time of order |
| `Payment` | id, orderId, type, status, amount, gatewayRef | Multiple possible (partial refunds) |
| `Address` | id, researcherId, line1, line2, city, state, zip, country, isDefaultShipping, isDefaultBilling | |
| `Coupon` | id, code, type (pct / fixed), amount, minOrder, maxUses, expiresAt | |
| `Batch` | id, variantId, lotNumber, manufactureDate, expiryDate | 1:many with TestReport |
| `TestReport` | id, batchId, type (purity / endo / sterility), pdfUrl, testedAt | |
| `SalesChannel` | id, name, commissionPct, odooSyncEnabled | |

### 11.2 Key Invariants

- An Order's `total` always equals `subtotal − discount + tax + shipping` (verified by test).
- A Researcher's `tier` determines SegmentPrice eligibility; no other field affects pricing.
- Inventory `available = onHand − committed`; `committed` only changes via Order state transitions.
- Every paid Order has ≥1 Payment record with `status = CAPTURED`.

---

## 12. Key Workflows & State Diagrams

Composed workflows that span multiple features. The individual state machines are defined in Sections 5.2 (order) and 5.4 (researcher); this section shows how they compose into full business workflows.

### 12.1 First-Time Researcher Purchase

```
Visit landing ─→ Browse catalog ─→ Sign up ─→ Verify email ─→ Await approval ─→ Log in
                                                                     ↓
                                                                Admin approves
                                                                     ↓
 Add to cart ←─ Pricing engine (Tier 1 default) ←─ Re-enter storefront
      ↓
 Checkout ─→ Address ─→ Payment (card via Authorize.Net) ─→ Order created (PROCESSING)
      ↓                                                             ↓
 Confirmation email                                      Fulfillment picks, labels, ships
      ↓                                                             ↓
 Researcher receives tracking ←───────────────────── Order → SHIPPED → DELIVERED
      ↓
 Review request email (after 3 days)
```

### 12.2 Enterprise Bulk Quote Flow

```
Enterprise researcher ─→ Product page ─→ "Request Bulk Quote" ─→ Fills form (product, qty, notes)
                                                                        ↓
                                                              Bulk quote created (Pending Review)
                                                                        ↓
                                                    Assigned AE notified via email + dashboard inbox
                                                                        ↓
                                              AE reviews, negotiates via email, proposes custom price
                                                                        ↓
                                                  Admin creates manual Order at negotiated price
                                                                        ↓
                                            Net-30 / wire payment terms applied; Order → PROCESSING
```

### 12.3 Tier Upgrade Automation

```
Nightly job ─→ Compute each researcher's rolling 90-day spend
                        ↓
            Spend ≥ threshold for next tier?
                        ↓
          Yes ─→ Create TierUpgrade notification (Urgent / High / Medium priority)
                        ↓
              Admin dashboard shows count of pending upgrades
                        ↓
          Admin reviews → One-click upgrade → Researcher tier updated
                        ↓
              Next order uses new tier's SegmentPrice automatically
```

### 12.4 AE Account Re-Assignment (AE leaves the team)

```
Director marks AE as Deactivated
        ↓
System flags all researchers assigned to that AE
        ↓
Director opens "Reassign" tool → bulk-select researchers
        ↓
Assign to remaining AEs (round-robin suggestion, manual override)
        ↓
Each researcher gets "Your new AE is..." email
        ↓
Historical order attribution preserved (old AE retains credit on closed orders)
```

---

## 13. Non-Functional Requirements

### 13.1 Performance

| Page | Budget (p75, 4G) | Measurement |
|---|---|---|
| Landing (first visit) | LCP < 2.5s | Core Web Vitals |
| Product detail | LCP < 2.0s | |
| Catalog grid | Interactive < 2.0s | |
| Back-office dashboard | First meaningful paint < 1.5s | |
| Add-to-cart action | Visual feedback < 100ms | |
| Search suggestions | First result < 300ms | |

### 13.2 Availability & Reliability

| Metric | Target |
|---|---|
| Uptime (monthly) | 99.9% (≤ 44 min downtime) |
| Order creation success rate | ≥ 99.5% |
| Payment gateway timeout | Retry once; surface error after 30s |
| Email delivery rate | ≥ 98% (bounce handling + retry) |

### 13.3 Accessibility

- WCAG 2.1 Level AA for all researcher-facing pages.
- Keyboard navigation supported throughout; visible focus states on every interactive element.
- Color contrast ≥ 4.5:1 for text, 3:1 for UI components.
- All interactive controls have accessible names (aria-label where visual label is absent).
- Form errors announced via aria-live regions.
- Back-office pages target Level AA but may relax for data-dense tables (with keyboard alternatives).

### 13.4 SEO & Discoverability

| Concern | Treatment |
|---|---|
| Product pages | Server-rendered; full Open Graph + JSON-LD `Product` schema |
| Collection pages | JSON-LD `CollectionPage` + breadcrumbs |
| Blog posts | JSON-LD `Article` schema |
| Sitemap | Auto-generated at `/sitemap.xml`; refreshed on product publish |
| Robots | Back-office + `/account/*` excluded; storefront fully indexed |
| Canonical URLs | Every product / collection has a canonical tag |

### 13.5 Browser & Device Support

| Bucket | Support Level |
|---|---|
| Chrome, Edge, Safari, Firefox (last 2 versions) | Full |
| iOS Safari 16+, Chrome Android (last 2) | Full |
| Mobile breakpoint | 360px minimum |
| Tablet breakpoint | 768px |
| Desktop breakpoint | 1024px, 1280px, 1440px+ |
| IE / legacy | Not supported |

### 13.6 Compliance & Data Handling

| Area | Approach |
|---|---|
| PII storage | Hashed passwords (bcrypt), encrypted at rest, never logged |
| Payment data | Never stored on our servers; Authorize.Net tokenizes cards |
| Research-use disclaimer | Shown on every product page + cart + checkout |
| Export on request | Researcher can export their data from `/account` (JSON + CSV) |
| Deletion on request | Soft-delete by default; hard-delete available on request within 30 days |
| Sales tax | Per-state configuration; tax engine applies at checkout |
| Data residency | US-based hosting; no international transfers of PII |

---

## 14. Integrations

External services the platform depends on. Each has a defined fallback when unavailable.

| Integration | Purpose | Failure Mode |
|---|---|---|
| **Authorize.Net** | Card payments | Block card checkout; allow Zelle / wire options |
| **Google Places API** | Address autocomplete | Fall back to manual address entry (all fields shown) |
| **Odoo ERP** | Inventory + invoicing sync | Queue changes locally; retry with exponential backoff; admin alert after 1 hour |
| **SendGrid / SMTP** | Transactional + marketing email | Queue and retry; admin alert after 30 min of continuous failure |
| **Carrier APIs** (USPS, UPS, FedEx) | Shipping labels + tracking | Manual tracking entry fallback |
| **S3 / CDN** | Product images, COA PDFs, media library | Serve direct from origin (degraded performance, no outage) |
| **Analytics (GA4 / Plausible)** | Page + event tracking | Non-blocking — never delays page interaction |

### 14.1 Odoo ERP Sync (Deeper Detail)

Each Sales Channel can be configured with Odoo sync enabled. When an order is placed on that channel:

```
Order created (status PROCESSING)
        ↓
Odoo sync job enqueued
        ↓
POST to Odoo → Sales Order created there
        ↓
Inventory committed in Odoo
        ↓
Sync log entry written; visible at /settings/sales-channels/[id]/odoo-logs
```

Failures are retried 3× with exponential backoff. Persistent failures surface as a badge on the channel and an email to Ops Lead.

---

## 15. Analytics Events & KPIs

### 15.1 Events Tracked

| Event | When Fired | Key Properties |
|---|---|---|
| `page_view` | Every route change | path, role, tier |
| `product_viewed` | Product detail page load | productId, variantId, price, tier |
| `add_to_cart` | Add to cart action | productId, qty, unitPrice |
| `checkout_started` | Enter checkout flow | cartValue, itemCount |
| `order_completed` | Order confirmation reached | orderId, total, paymentType, tier |
| `signup_started` | Signup form submitted | — |
| `signup_verified` | Email verification clicked | timeToVerify |
| `account_approved` | Admin approves researcher | timeToApproval |
| `tier_upgraded` | Researcher tier changed | fromTier, toTier, trigger (auto / manual) |
| `bulk_quote_requested` | Quote form submitted | productId, requestedQty |
| `search_performed` | Search bar submission | query, resultCount |

### 15.2 Business KPIs Exposed in Back-Office

| KPI | Where | Refresh |
|---|---|---|
| Monthly Recurring Revenue by tier | `/analytics` overview | Hourly |
| New verified researchers (30d) | `/analytics` overview | Real-time |
| Order conversion rate (checkout started → completed) | `/analytics/sales` | Daily |
| Average order value | `/analytics/sales` | Real-time |
| Repeat purchase rate (90d) | `/analytics/customers` | Daily |
| Revenue per AE | `/analytics/sales-reps` | Hourly |
| Bulk quote response time (median) | `/analytics/sales-managers` | Real-time |
| Stock days remaining (per variant) | `/inventory` | Real-time |

---

## 16. Roadmap & Out of Scope

### 16.1 In-Scope (Current Release)

Everything described in Sections 1–15 is considered the baseline for v1.0.

### 16.2 Explicitly Out of Scope (v1.0)

These are intentional omissions. Listed here so future PRDs can reference the decision.

| Item | Reason | Possible Future Consideration |
|---|---|---|
| International shipping automation | Focus on US compliance first | v1.2 |
| Subscription / auto-reorder | Low researcher demand signal | v2.0 — revisit after repeat-purchase data |
| Multi-currency display | USD-only MVP | After international expansion |
| Native mobile apps | PWA serves 90%+ of mobile needs | v2.0 |
| ChatGPT-style AI search | Classic filter + search solves the job | Post-launch experimentation |
| Multi-warehouse inventory reservation | Single warehouse today | v1.1 |
| Two-factor authentication (TOTP) | Opt-in MFA requires more design | v1.1 |
| Affiliate / referral program | Deferred until acquisition engine proven | v1.3 |

### 16.3 Known Technical Debt

| Item | Risk | Priority |
|---|---|---|
| Dark-mode theme stubs present but untested | Visual regression if enabled | Low |
| Role enum values are generic (ADMIN, MANAGER, etc.) while UI uses branded names | Naming drift between code and PRD | Medium — resolve in next backend migration |
| Single-warehouse assumption in checkout | Blocks multi-warehouse rollout | Medium |
| No BFF layer — frontend calls API directly | Bundle size + coupling | Low |

### 16.4 Release Process

| Phase | Description |
|---|---|
| Staging | All features deployed + smoke-tested against seeded demo data |
| UAT | Admin + 2 AEs + 3 beta researchers validate flows end-to-end |
| Soft launch | Open to first 100 researchers; monitor metrics daily |
| General availability | Public launch + marketing push |

---

*This document covers the complete feature set of the Ascendra Bio e-commerce platform as implemented in the current codebase and the roadmap through v1.0 GA.*
