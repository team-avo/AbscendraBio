# Product Requirements Document (PRD)

## Centre Research Peptides — E-Commerce Platform

**Version:** 1.0
**Last Updated:** April 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Roles & Access Levels](#2-user-roles--access-levels)
3. [Customer Storefront](#3-customer-storefront)
4. [Customer Account Portal](#4-customer-account-portal)
5. [Admin Dashboard](#5-admin-dashboard)
6. [Sales Manager Portal](#6-sales-manager-portal)
7. [Sales Rep Portal](#7-sales-rep-portal)
8. [Authentication & Security](#8-authentication--security)
9. [Technical Architecture](#9-technical-architecture)

---

## 1. Product Overview

Centre Research Peptides is a full-featured B2B/B2C e-commerce platform designed for the research peptide industry. The platform serves four distinct audiences through role-based portals:

- **Customers** browse a public-facing storefront, place orders, and manage their accounts.
- **Admins & Managers** operate a full back-office dashboard covering orders, products, customers, analytics, content, marketing, and system settings.
- **Sales Managers** oversee sales teams, track team performance, and recruit reps.
- **Sales Reps** manage their assigned customer portfolios and view orders.

### Key Platform Capabilities

| Capability | Description |
|---|---|
| Multi-tier Customer Pricing | Four customer segments (Tier 1, Tier 2, Enterprise 1, Enterprise 2), each with independent pricing |
| Bulk & Volume Pricing | Automatic price breaks based on order quantity |
| Sales Team Hierarchy | Admin > Sales Manager > Sales Rep structure with customer assignment |
| Quality & Compliance | Third-party lab test reports (purity, endotoxicity, sterility) publicly accessible |
| Multi-channel Sales | Sales channel management with per-channel pricing and Odoo ERP sync |
| Full CMS | Blog, static pages, navigation menus, and media library |
| Email Marketing | Campaign creation, targeted blasts, and transactional email templates |

---

## 2. User Roles & Access Levels

The platform defines six user roles. Each role determines which sections of the application are accessible.

### Role Hierarchy

```
ADMIN          (full access to every feature)
  |
MANAGER        (all admin features except user/role management)
  |
STAFF          (order fulfillment, product management, inventory)
  |
SALES_MANAGER  (team management, team analytics, recruitment)
  |
SALES_REP      (customer assignment, order viewing)
  |
CUSTOMER       (storefront, account portal, ordering)
```

### Detailed Access Matrix

| Section | Admin | Manager | Staff | Sales Manager | Sales Rep | Customer |
|---|---|---|---|---|---|---|
| **Storefront & Shopping** | - | - | - | - | - | Full |
| **Account Portal** | Full | Full | Full | Full | Full | Full |
| **Admin Dashboard** | Full | Full | Full | - | - | - |
| **Order Management** | Full | Full | Full | View | View | Own only |
| **Product Management** | Full | Full | View | - | - | - |
| **Product Create/Edit** | Full | Full | - | - | - | - |
| **Customer Management** | Full | Full | Full | View | View | - |
| **Customer Approvals** | Full | Full | Full | - | - | - |
| **Analytics — Sales** | Full | Full | Full | - | - | - |
| **Analytics — Sales Reps** | Full | Full | - | Full | - | - |
| **Analytics — Sales Managers** | Full | Full | - | - | - | - |
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
| **Sales Manager Portal** | - | - | - | Full | - | - |
| **Customer Self-Assignment** | - | - | - | Full | Full | - |

---

## 3. Customer Storefront

The public-facing storefront is accessible without login. Ordering requires authentication.

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
| Segment Pricing | Prices displayed based on logged-in customer tier |
| Reviews | Customer reviews with star ratings |
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

### 3.5 Checkout (`/landing/checkout`)

| Feature | Description |
|---|---|
| Cart Review | Full item list with quantity adjustment |
| Shipping Address | Google Places autocomplete + manual entry; saved addresses selectable |
| Billing Address | Same-as-shipping toggle or separate entry |
| Promo Code | Coupon code input with validation |
| Order Summary | Itemized pricing, discounts, shipping, and final total |
| Payment | Payment method selection and processing |
| Order Confirmation | Success page with order details |

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
| CMS Pages | Admin-created pages rendered at custom slugs (e.g., `/p/about-us`, `/p/faq`) |

### 3.9 Global Navigation

| Element | Description |
|---|---|
| Header | Sticky navbar with logo, navigation links (Products, 3rd Party Testing, Contact), search bar, cart icon with count badge, and login/avatar dropdown |
| Footer | Brand info, inquiry email form, product showcase, navigation links, social links, copyright |
| Mobile | Hamburger menu with slide-out panel |

---

## 4. Customer Account Portal

Authenticated customers access their account portal at `/account`. It uses the same sidebar layout as the admin dashboard.

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

## 5. Admin Dashboard

The admin back-office is accessed at `/admin-dashboard` and uses a sidebar navigation layout. All features below are available to **Admin** and **Manager** roles unless noted otherwise.

### 5.1 Dashboard Home (`/admin-dashboard`)

| Feature | Description |
|---|---|
| Revenue Metrics | 30-day revenue with trend comparison |
| Order Metrics | Total orders, pending, processing counts with change percentages |
| Customer Metrics | Total and active customer counts |
| Product Metrics | Active product count |
| Recent Orders | Table of latest orders with customer, amount, status |
| Top Products | Best sellers by sales volume, revenue, and stock level |
| Customer Distribution | Pie chart of Wholesale vs Enterprise customers |
| Sales Trend | Monthly revenue and order volume chart |
| Stock Alerts | Low inventory item warnings |
| Quick Actions | Create customer, create order buttons |

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
| `/orders/failed-payments` | Failed | Orders with payment failures (Admin/Manager/Staff only) |

**Capabilities (All Order Pages):**

| Feature | Description |
|---|---|
| Search | Full-text search by order number, customer name, product |
| Filters | Status, date range (presets + custom), customer type (Wholesale/Enterprise), payment method, sales rep, sales channel |
| Create Order | Manual order creation dialog |
| Edit Order | Modify order details |
| Update Status | Change order status with tracking info |
| Delete Order | Permanently remove order |
| Export to Excel | Download current filtered results as .xlsx |
| Email Report | Send filtered order report to any email address |

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
| Segment Prices | Per-customer-tier pricing (Tier 1, Tier 2, Enterprise 1, Enterprise 2) |
| Bulk Prices | Volume-based price breaks (min qty, max qty, unit price) |

### 5.4 Customer Management (`/customers`)

**Customer Views:**

| Route | Segment | Description |
|---|---|---|
| `/customers` | All | Unified customer list with type/status/rep/manager filters |
| `/customers/b2c` | Tier 1 | Consumer customers |
| `/customers/b2b` | Tier 2 | Business customers |
| `/customers/enterprise-1` | Enterprise 1 | First enterprise tier |
| `/customers/enterprise-2` | Enterprise 2 | Second enterprise tier |
| `/customers/wholesale` | Wholesale | Combined B2C + B2B view |
| `/customers/enterprise` | Enterprise | Combined Enterprise 1 + 2 view |
| `/customers/approvals` | Pending | New registrations awaiting admin approval |
| `/customers/rejected` | Rejected | Denied registrations |

**Capabilities:**

| Feature | Description |
|---|---|
| Create Customer | Manual customer creation dialog |
| Edit Customer | Modify profile, status, tier |
| Manage Addresses | Add/edit/delete customer addresses |
| Deactivate/Delete | Soft-deactivate or permanently delete |
| Approve/Reject | Action pending customer registrations |
| Export to Excel | Download customer data |
| Assign Sales Rep | Link customer to a sales representative |
| Assign Sales Manager | Link customer to a sales manager |

### 5.5 Analytics (`/analytics`)

| Route | Section | Description |
|---|---|---|
| `/analytics` | Overview | Key metrics dashboard |
| `/analytics/sales` | Sales Reports | Revenue and order trends with charts, date filters, channel filters, email reports |
| `/analytics/products` | Product Performance | Top products by revenue and units; category distribution pie chart |
| `/analytics/customers` | Customer Insights | Acquisition trends, lifetime value, segmentation |
| `/analytics/sku` | SKU Analytics | Variant-level sales performance |
| `/analytics/sales-reps` | Sales Rep Performance | Individual rep metrics and commission tracking |
| `/analytics/sales-managers` | Sales Manager Performance | Team-level metrics and territory analysis |
| `/analytics/person` | Individual Analytics | Deep-dive into a specific rep or manager |
| `/analytics/manager-customer-assignment` | Assignment Tracking | Customer-to-manager mapping overview |

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
| Stats | Total users, active, inactive, admin count |
| Create User | New user with role assignment (Admin, Manager, Staff, Sales Rep, Sales Manager) |
| Edit User | Modify details, role, activation status |
| Delete User | Remove user account |

**Sales Team Management:**

| Route | Feature | Description |
|---|---|---|
| `/users/sales_users` | Sales Rep Management | Select a rep, manage their customer assignments via two tabs (Assigned / Add Customers) |
| `/users/assign-customers` | Bulk Assignment | Two-panel interface for assigning customers to any rep |
| `/sales-managers` | Manager Hierarchy | Assign reps to managers and customers to managers; dual-panel with tabs |
| `/admin/sales-manager-assignments` | Manager Assignments | Admin view of all manager-customer mappings |

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
| `/marketing/targeted-blast` | Targeted Blast | Send marketing emails to specific customer segments |

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
| Quote List | All customer quote requests with search and read/unread status |
| Quote Detail | Customer info, requested products, quantities |
| Actions | Mark as reviewed, delete, respond via email |

### 5.15 Tier Upgrades (`/tier-upgrades`)

| Feature | Description |
|---|---|
| Upgrade Notifications | Customers eligible for tier upgrades based on spending thresholds |
| Priority Filter | Urgent and high-priority upgrade candidates |
| One-Click Upgrade | Instantly upgrade customer tier |

### 5.16 Abandoned Carts (`/admin/abandoned-carts`)

| Feature | Description |
|---|---|
| Cart List | Carts inactive for 30+ minutes with customer info and item details |
| Send Reminder | Email individual customers about their abandoned cart |
| Bulk Send | Email all customers with abandoned carts at once |

### 5.17 Admin Comments (`/admin/comments`)

| Feature | Description |
|---|---|
| Comment List | All order and customer comments system-wide |
| Filters | Type filter (Order/Customer), full-text search |
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

## 6. Sales Manager Portal

Sales Managers log in and are redirected to `/sales-manager/analytics`. They operate within a restricted sidebar showing Orders, Customers, and their team management tools.

### 6.1 Team Analytics (`/sales-manager/analytics`)

| Feature | Description |
|---|---|
| Revenue Metrics | Total team revenue with trend charts |
| Order Metrics | Total orders processed by team |
| Customer Metrics | Assigned and active customer counts |
| Performance Table | Sortable by revenue, orders, customer count |
| Date Range Filter | 1d, 7d, 14d, 30d, 90d, 365d, custom |
| Charts | Area charts for revenue/order trends, bar charts for comparison |

### 6.2 Team Management (`/sales-manager/my-team`)

| Feature | Description |
|---|---|
| Rep List | All reps assigned to this manager with name, email, status, customer count |
| Add Rep | Add existing sales reps to team |
| Edit Rep | Update rep information |
| Password Reset | Send password reset to reps |
| Activate/Deactivate | Toggle rep status |
| Delete Rep | Remove rep from team |

### 6.3 Recruitment (`/sales-manager/recruitment`)

| Feature | Description |
|---|---|
| Available Reps | Browse unassigned sales reps |
| Search | Find reps by name or email |
| Recruit | Assign an unassigned rep to your team |
| Create New | Create a brand new sales rep account |

### 6.4 Order & Customer Access

Sales Managers can view the Orders and Customers sections in read mode through the main sidebar navigation.

---

## 7. Sales Rep Portal

Sales Reps log in and are redirected to `/orders`. They have the most restricted admin access.

### 7.1 Customer Self-Assignment (`/assign-customers`)

| Feature | Description |
|---|---|
| Unassigned Customers | Browse customers not yet assigned to any rep |
| Search | Filter by name or email |
| Assign to Me | One-click self-assignment button |
| Customer Info | Name, email, type (Wholesale/Enterprise), approval status, current assignments |

### 7.2 Order & Customer Viewing

Sales Reps can view orders and customers through the sidebar, but cannot create, edit, or delete records (except creating orders and payments where permitted).

---

## 8. Authentication & Security

### 8.1 Login Flows

| Flow | Description |
|---|---|
| Customer Login | Email + password at `/login`; portal = CUSTOMER |
| Admin Login | Email + password at `/admin/login`; portal = ADMIN |
| Email OTP | Passwordless login via 6-digit code sent to email |
| Portal Separation | Customer credentials do not work on admin login and vice versa |

### 8.2 Registration

| Step | Description |
|---|---|
| Customer Signup | Email, password, name, mobile, NPI/license number, optional company info |
| Email Verification | Verification email sent; login blocked until verified |
| Admin Approval | Customer account held in "pending" state until admin approves |
| Staff Accounts | Created by admins only; no public signup |

### 8.3 Password Reset

| Step | Description |
|---|---|
| Request | Enter email to receive reset link |
| Confirm | Click link, enter new password |

### 8.4 Permission System

Beyond role-based route access, a granular module-action permission system controls what each user can do:

- **Modules:** Customers, Orders, Products, Payments, Transactions, Settings, Analytics
- **Actions:** Read, Create, Update, Delete
- **Enforcement:** Checked at both route level (ProtectedRoute wrapper) and UI level (button visibility)

---

## 9. Technical Architecture

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

All admin routes are protected client-side using a `<ProtectedRoute>` wrapper component that checks:
1. User authentication status
2. User role against allowed roles list
3. Granular permissions (where applicable)

Unauthenticated users are redirected to the login page. Unauthorized users see an access denied message.

### Layout Architecture

| Layout | Scope | Components |
|---|---|---|
| Root Layout | All pages | Theme, Auth, Cart, Google Places providers; conditional header/footer (hidden on admin routes) |
| Landing Layout | `/landing/*` | Light theme enforcement |
| Account Layout | `/account/*` | Dashboard sidebar layout |
| Dashboard Layout | All admin routes | Sidebar navigation with role-based menu items |

---

*This document covers the complete feature set of the Centre Research Peptides e-commerce platform as implemented in the current codebase.*
