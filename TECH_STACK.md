# Technology Stack

## Frontend — Next.js

| Category | Technology | Version |
|---|---|---|
| Framework | Next.js (Turbopack) | 15.5.9 |
| UI Library | React | 19.0.0 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| Component System | Shadcn UI + Radix UI | — |
| Icons | Lucide React | 0.525.0 |
| Animations | Motion (Framer Motion) | 11.11.7 |

### UI & Components
- **Radix UI** — Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown, Hover Card, Label, Menubar, Popover, Progress, Radio Group, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toggle, Tooltip
- **Embla Carousel** — Carousel/slider component
- **Vaul** — Drawer component
- **Cmdk** — Command palette
- **Sonner** — Toast notifications
- **React Resizable Panels** — Resizable layout panels
- **Recharts** — Charts and data visualization

### Forms & Validation
- **React Hook Form** — Form state management
- **Zod** — Schema validation
- **Input OTP** — OTP input component

### Rich Text Editor
- **Tiptap** — Editor with extensions (color, highlight, image, link, table, text-align, underline)

### Utilities
- **date-fns** — Date manipulation
- **PapaParse** — CSV parsing
- **XLSX** — Excel file handling
- **jsPDF + html2canvas** — PDF generation
- **file-saver** — Client-side file downloads
- **DOMPurify** — HTML sanitization
- **clsx + tailwind-merge + cva** — Conditional classnames
- **next-themes** — Dark mode
- **Pino** — Structured logging

### Maps
- **Google Maps JS API Loader** — Maps integration

---

## Backend — Node.js API

| Category | Technology | Version |
|---|---|---|
| Runtime | Node.js | — |
| Framework | Express | 4.16.1 |
| ORM | Prisma | 5.22.0 / 6.11.1 |
| Database | PostgreSQL | — |
| Cache / Queue | Redis + Bull | 4.16.5 |

### Authentication & Security
- **JWT** (jsonwebtoken) — Token-based auth
- **bcryptjs** — Password hashing
- **Helmet** — HTTP security headers
- **CORS** — Cross-origin configuration
- Role-based access control (RBAC)
- Email verification + OTP login

### Payment Processing
- **Stripe** — Primary payment gateway
- **Authorize.Net** — Secondary payment gateway

### Email
- **Resend** — Primary transactional email
- **Nodemailer** — Fallback SMTP
- **Bull** — Email queue with rate limiting

### SMS
- **Twilio** — SMS and OTP delivery

### File Storage
- **AWS S3** — File uploads and storage
- **Multer + Multer-S3** — Upload middleware
- MinIO compatible via S3 API

### Shipping
- **ShipStation** — Shipping label generation, tracking, inventory sync

### ERP Integration
- **Odoo** — Product sync, inventory management (custom integration)

### Scheduling
- **node-cron** — Recurring jobs (publish scheduler, settlement checker, promotion expiry, stock alerts, partner billing, label tracking sync)

### Reporting
- **ExcelJS** — Excel report generation
- Report types: Orders, Sales Analytics, Customers, Products, Transactions

### Utilities
- **uuid** — Unique identifiers
- **slugify** — URL-friendly slugs
- **express-validator + Joi** — Request validation
- **Pino + Morgan** — Logging
- **dotenv** — Environment variables
- **Nodemon** — Development auto-reload

---

## Database

| | |
|---|---|
| Engine | PostgreSQL |
| ORM | Prisma |
| Migrations | Prisma Migrate |
| Schema | `/nodejs-api/prisma/schema.prisma` |

### Key Models
User, Customer (B2B/B2C), Product, Order, Inventory, Payment, Transaction, Promotion, Coupon, ProductReview, Address, PageContent (CMS), Email Templates, Sales Reps/Managers, Bulk Quotes, Audit Logs

---

## Infrastructure

| | |
|---|---|
| Cache | Redis |
| Job Queue | Bull (Redis-backed) |
| File Storage | AWS S3 / MinIO |
| Frontend Output | Standalone (containerizable) |

---

## API Surface

48 route modules covering:

- **Auth** — Login, signup, OTP, password reset
- **Products** — Catalog, public storefront, bulk operations
- **Orders** — Management, fulfillment
- **Inventory** — Stock, batches, sync
- **Payments** — Stripe, Authorize.Net
- **Shipping** — ShipStation integration
- **Customers** — B2B/B2C management
- **Promotions** — Discounts, coupons
- **Analytics** — Reports, dashboards
- **Content** — CMS pages/posts
- **Marketing** — Campaigns
- **Sales** — Reps, managers, commissions
- **Bulk Quotes** — B2B quote requests

---

## Third-Party Integrations

| Service | Purpose |
|---|---|
| Stripe | Payment processing |
| Authorize.Net | Payment processing |
| ShipStation | Shipping & fulfillment |
| Resend | Transactional email |
| Twilio | SMS & OTP |
| AWS S3 | File storage |
| Google Maps | Address/location |
| Odoo | ERP sync |

---

## Project Structure

```
/
├── nextjs-frontend/          # Next.js 15 frontend
│   ├── src/app/              # App Router pages
│   ├── src/components/       # React components
│   ├── src/contexts/         # Auth, Cart, Dashboard contexts
│   ├── src/hooks/            # Custom hooks
│   └── src/lib/              # API client, utilities
│
├── nodejs-api/               # Express backend
│   ├── routes/               # 48 API route modules
│   ├── services/             # Business logic
│   ├── middleware/            # Auth, validation, error handling
│   ├── utils/                # Email, S3, SMS, scheduling
│   ├── cron/                 # Scheduled jobs
│   ├── workers/              # Background job processors
│   ├── integrations/         # Odoo ERP integration
│   └── prisma/               # Schema & migrations
```
