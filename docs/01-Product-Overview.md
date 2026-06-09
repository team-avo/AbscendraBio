# AscendraBio — Product Overview

*A non-technical guide to what the platform does, who it serves, and how it works.*

---

## 1. What is AscendraBio?

AscendraBio is an online platform for selling **research peptides** to verified researchers, clinics, and businesses. It works the way a normal e-commerce store works (browse products, add to cart, check out), but is purpose-built for the research-peptide industry with the extra controls that industry needs — verified-customer pricing, third-party purity reports, and a clean inventory pipeline from suppliers to shelf.

The platform has two sides:

- **The Storefront** — what customers see at [www.ascendrabio.com](https://www.ascendrabio.com)
- **The Admin Panel** — what the AscendraBio team uses to run the business

Both run from the same system, so an order placed on the storefront appears in the admin panel instantly.

---

## 2. Who Uses the Platform?

There are four kinds of people on the platform, and each gets a different experience.

### 2.1 Visitors (not logged in)
- Can browse the catalog, view product details, and read public information.
- **Cannot see prices** — prices are hidden until a customer is logged in.
- Can sign up to become a customer.

### 2.2 Customers (logged in)
There are four customer tiers, each with its own pricing:

| Tier            | Who they are                                         |
|-----------------|------------------------------------------------------|
| **B2C**         | Individual researchers / retail buyers               |
| **B2B**         | Smaller businesses buying for clinics or labs        |
| **Enterprise 1**| Larger accounts with custom negotiated pricing       |
| **Enterprise 2**| Highest-tier accounts with deepest pricing           |

B2B and Enterprise customers need **admin approval** before they can start ordering. B2C customers can sign up and order immediately.

### 2.3 Sales Team
The AscendraBio team can include **Sales Managers** and **Sales Reps** who are assigned to specific customers. Reps see only their own customers; managers see their team's activity.

### 2.4 Admins
Full access to everything — products, inventory, orders, customers, settings.

---

## 3. The Customer Journey

Here's what happens, step by step, when a researcher buys from AscendraBio.

### Step 1 — Discover Products
The customer lands on the storefront and can:
- Browse the full catalog.
- Filter by category, price range, or stock status.
- Search by product name or variant size (e.g. *"GHK-Cu - 50mg"*).
- Mark items as **favorites** to come back to later.

### Step 2 — View a Product
On a product page, the customer sees:
- Photos and a description.
- All available sizes (called **variants** — e.g. 10mg vial, 50mg vial).
- The **price for their tier** (so a B2B customer sees a different price than a B2C customer).
- **Bulk pricing**, if applicable — buying more units drops the per-unit price.
- A **Certificate of Analysis (COA)** — proof of purity, sterility, and endotoxin testing from an independent third-party lab.
- Reviews from other approved customers.

### Step 3 — Add to Cart
- Customers (and even visitors, as a "guest cart") can add items to their cart.
- A guest cart automatically merges into the customer's account if they sign in or sign up before checking out.

### Step 4 — Checkout
The checkout has four short steps:

1. **Shipping & billing address** — saved for future orders.
2. **Shipping method** — calculated based on weight and destination.
3. **Clinical Use Protocol** — a confirmation checkbox that the customer is a verified researcher.
4. **Payment** — three options available:
   - **Credit / Debit Card** (processed instantly via Authorize.Net)
   - **Zelle** (manual — the customer pays via their bank app and uploads confirmation)
   - **Bank Wire** (manual — instructions shown on screen)

Discounts (promotion codes, high-value discounts, etc.) are applied automatically at this stage if eligible.

### Step 5 — Order Confirmation
- The customer gets an email with their order number, items, and total.
- They can view the order anytime under **My Account → Orders**.
- When the order ships, they get another email with tracking info.

### Step 6 — After the Order
From their account, the customer can:
- Track shipment status (label created → in transit → delivered).
- Download an invoice / receipt.
- Re-order favorite products.
- Leave a review.
- Request a **bulk quote** for high-volume custom pricing.

---

## 4. What the Admin Team Can Do

The admin panel is the operational backbone. Here's what's available, grouped by area.

### 4.1 Product Catalog
- Add, edit, and remove products.
- Each product can have multiple **variants** (e.g. 5mg, 10mg, 50mg vials).
- Upload product images.
- Organize products into **categories** and **collections**.
- Bulk-upload products via spreadsheet.
- Mark products as **Popular** to feature them on the storefront.

### 4.2 Pricing
The platform supports several layers of pricing — they stack on top of each other:
1. **Base price** (regular and sale price).
2. **Segment pricing** — different price per customer tier (B2C / B2B / Enterprise 1 / Enterprise 2).
3. **Bulk pricing** — automatic discount when buying more (e.g. 10 units = $X, 50 units = $Y).
4. **Promotion codes** — percentage off, fixed amount off, free shipping, or BOGO deals.
5. **High-value discount** — automatic discount on large carts.

### 4.3 Inventory & Stock
- Track stock per **warehouse location**.
- See low-stock alerts.
- Log every stock movement (sale, restock, transfer, adjustment) with an audit trail.

### 4.4 Stock Receipts — Supplier Auto-Import
One of the platform's standout features:
- The system **monitors a Gmail inbox** for order-confirmation emails from suppliers (e.g. Ion Peptide).
- When a supplier email arrives, the platform automatically **parses the email** and creates a **Pending Stock Receipt** with all the products and quantities.
- An admin reviews each line, matches supplier product names to AscendraBio products, and clicks **Approve**.
- Approval adds the stock to inventory and creates a full audit record.

This replaces what used to be hours of manual data entry every time a supplier shipment arrived.

### 4.5 Orders
- See all orders with filters (pending, paid, shipped, delivered, failed, refunded).
- Open any order to view items, addresses, payment status, and tracking.
- Add internal notes or customer-facing comments.
- Process refunds, capture payments, or retry failed payments.
- See **abandoned carts** — customers who started but didn't finish checking out.
- Export orders to Excel.

### 4.6 Customers
- Browse and search customers by tier (B2C / B2B / Enterprise / Wholesale).
- Approve or reject new B2B / Enterprise signups.
- View each customer's full order history, total spend, and assigned sales rep.
- Upgrade or change a customer's tier.
- Assign customers to sales managers / reps.

### 4.7 Marketing
- **Promotion codes** — percentage off, fixed off, free shipping, BOGO, volume-tier discounts.
- **Email campaigns** — send blasts to segmented customer lists with open/click tracking.
- **Email templates** — order confirmation, shipping notification, password reset, etc. All editable.
- **Banners** and **popular products** for storefront placement.

### 4.8 Reports & Analytics
- Sales dashboard (revenue, order count, trends).
- Top-performing products.
- Customer-level analytics (lifetime spend, order count).
- Sales-rep / sales-manager performance.
- Excel exports for orders, products, customers.

### 4.9 Compliance & COAs
- Upload third-party lab reports (Certificates of Analysis) per product and per variant.
- Three report types supported: **Purity**, **Endotoxicity**, **Sterility**.
- Reports are visible on the storefront product page and on a dedicated **Third-Party Testing** page.

### 4.10 Settings
- Configure payment gateway (Authorize.Net credentials).
- Configure shipping rates, tax rules.
- Manage warehouse locations.
- Manage email templates.
- Manage staff users (admins, sales managers, sales reps) with role-based permissions.
- View audit logs (logins, who did what, when).

---

## 5. External Services Used

The platform integrates with several third-party services to do its job:

| Purpose                  | Service Used                  |
|--------------------------|-------------------------------|
| Card payments            | **Authorize.Net**             |
| Transactional emails     | **Resend**                    |
| Supplier email parsing   | **Gmail** (OAuth)             |
| SMS verification codes   | **Twilio**                    |
| File / image storage     | **Amazon S3**                 |
| Shipping & tracking      | **ShipStation**               |
| Address autocomplete     | **Google Places**             |
| Hosting (storefront)     | **Vercel**                    |
| Hosting (backend / DB)   | **Railway**                   |

---

## 6. What's Live Today vs. What's Coming

### Live now
- Full storefront with login, browse, cart, and checkout.
- Three payment methods (Card, Zelle, Bank Wire).
- Admin product management.
- Admin order management with refunds and tracking.
- Customer tiers with tier-based pricing.
- Stock receipts auto-import from supplier emails.
- COA / third-party testing reports.
- Email notifications (order confirmation, shipping, password reset).
- Sales team assignments.

### Known follow-ups
- **Product images** for the 21 newly-added Ion Peptide products are missing — admin needs to upload them.
- **Retail markup** on those new products needs review — they're currently at supplier cost.
- **Gmail OAuth** needs the consent screen set to *External* (currently *Internal*) so the supplier-email importer can run from `devops@medoflow.com`.

---

## 7. Key Numbers (as of May 2026)

- **28** active products on the storefront
- **30+** variants across all products
- **4** customer tiers
- **3** payment methods at checkout
- **1** warehouse location (Main Warehouse — more can be added)

---

## 8. Quick Glossary

| Term              | What it means                                                                 |
|-------------------|-------------------------------------------------------------------------------|
| **Variant**       | A specific size / strength of a product (e.g. "10mg Vial" vs "50mg Vial").    |
| **SKU**           | A unique code for each variant — used internally to track inventory.          |
| **COA**           | Certificate of Analysis — third-party lab report proving purity & safety.     |
| **Bulk pricing**  | Lower per-unit price when buying more of the same item.                       |
| **Segment price** | A different base price for a specific customer tier (B2C vs B2B etc.).        |
| **Stock receipt** | A record of supplier inventory coming in, before it's approved into stock.    |
| **Sales channel** | A B2B partner with their own pricing and fulfillment rules.                   |

---

*Document version 1.0 — last updated May 2026.*
*For technical setup and architecture, see Doc 2 — Developer Reference.*
