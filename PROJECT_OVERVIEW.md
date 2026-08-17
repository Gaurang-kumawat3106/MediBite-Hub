# 🍽️ MediBite-Hub / BhukkadBox — Repository & Architecture Overview

> **Quick Summary**: MediBite-Hub (also branded as BhukkadBox) is a multi-outlet campus canteen food ordering, real-time token management, and payment processing platform. It connects customers (students/staff), outlet managers (food stall heads), and canteen administration with real-time order tracking and digital queue tokening.

---

## 1. 📌 What the Repository Is About

The platform digitizes college/campus food canteens with multiple independent food outlets. Key capabilities include:

- **Customer Workflow**:
  - Browse verified outlets, view outlet-specific menus categorized by food types.
  - Transparent pricing with dynamic platform fee tiers/slabs.
  - Cart management (items from a single outlet per order).
  - Razorpay payment gateway integration (UPI, cards, netbanking) with webhook verification.
  - Real-time order status tracking (`pending` ➔ `preparing` ➔ `completed` ➔ `delivered` / `cancelled`).
  - Digital daily queue token issuance (`OrderToken`) with real-time notifications and one-time popup alert.
  - Reorder functionality for quick repeated purchases.

- **Outlet Head / Stall Manager Workflow**:
  - Outlet profile and UI customization (banner images, color themes, layouts: classic, modern, minimal).
  - Category and product management (add/edit menu items, upload food images, toggle live availability).
  - Live order management dashboard receiving real-time incoming orders via WebSockets.
  - Order status advancement and automatic token generation on completion.
  - Revenue analytics: today's collection, weekly collection, monthly collection, and delivered order logs.

- **Superadmin / Platform Administration**:
  - Outlet onboarding and verification (`is_approved`).
  - Configurable platform fee calculation via tiered price slabs (`PlatformFeeSlab`) and fallback config (`PlatformFeeConfig`).
  - User verification and access control.

- **Real-Time Communication**:
  - Django Channels + Redis-backed WebSockets for instantaneous order state changes, token broadcasts, and product out-of-stock alerts.

---

## 2. 💻 Tech Stack & Architecture

### Backend Stack (`/canteen`)
- **Framework**: Python 3.11/3.12+ / Django 6.0.3
- **ASGI & WebSockets Server**: Daphne 4.2.1 & Django Channels 4.1.0 (with `channels-redis`)
- **Database**: PostgreSQL (hosted on Render / Neon Tech) via `dj-database-url` and `psycopg2-binary` (SQLite fallback for local offline dev)
- **Media Asset Storage**: Cloudinary via `django-cloudinary-storage` (for outlet logos, banners, food images)
- **Static Files**: Whitenoise (`CompressedManifestStaticFilesStorage`)
- **Email Service**: Anymail 15.0 with Brevo (Sendinblue) API backend + SMTP fallback for email verification and password reset flows
- **Payments**: Razorpay Python SDK 2.0.1 (order creation, signature validation, webhooks)
- **Load Testing**: Locust (`locustfile.py`)

### Frontend Stack (`/frontend`)
- **Framework**: Next.js 16.3.1 (App Router)
- **Core Library**: React 19.2.8 & React DOM 19.2.8
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Toasts & Notifications**: `react-hot-toast`
- **Data Fetching & Cache**: Custom cached fetch layer (`src/lib/apiCache.ts`), CSRF interceptor (`src/lib/csrf.ts`), and custom reconnecting WebSocket hook (`src/hooks/useWebSocket.ts`).
- **Legacy Templates**: Pre-existing Django HTML templates in `canteen/accounts/templates/accounts/` are preserved, while views are adapted to return JSON when requested with `Accept: application/json`.

---

## 3. 🌐 Deployment & Infrastructure

| Component | Provider / Environment | Notes |
| :--- | :--- | :--- |
| **Compute / Backend Server** | **AWS EC2 Instance** | Runs Daphne / ASGI / Gunicorn application server |
| **Database** | **Render / Neon Tech (PostgreSQL)** | Connected via `DATABASE_URL` with SSL mode required |
| **Cache & Channel Layer** | **Render / Local Redis** | Connected via `REDIS_URL` with InMemory fallback |
| **Frontend Hosting** | **Vercel / EC2** | Next.js deployment (`medi-bite-hub.vercel.app`) |
| **Media Hosting** | **Cloudinary** | `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` |
| **Transactional Email** | **Brevo (Sendinblue)** | Verified sender `medibite.hub26@gmail.com` |
| **Custom Domains** | `bhukkadbox.in`, `www.bhukkadbox.in`, `api.bhukkadbox.in` | Configured in `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` |

---

## 4. 📂 Directory Structure

```plaintext
medicanteen/
├── canteen/                        # Django Backend Root
│   ├── manage.py                   # Django CLI entrypoint
│   ├── .env                        # Backend environment configuration
│   ├── run_gunicorn.sh             # Production startup script
│   ├── locustfile.py               # Load testing suite
│   ├── canteen/                    # Core project configuration
│   │   ├── settings.py             # Settings (Databases, Auth, Channels, CORS, Razorpay)
│   │   ├── urls.py                 # Root URL router
│   │   ├── asgi.py                 # ASGI entrypoint (HTTP + WebSocket Protocol Router)
│   │   └── wsgi.py                 # WSGI entrypoint
│   ├── accounts/                   # Primary Django App (Users, Outlets, Orders, Products)
│   │   ├── models.py               # CustomUser, Outlet, Product, Cart, Order, OrderToken, etc.
│   │   ├── views.py                # Dual-mode API & Template views (JSON + HTML)
│   │   ├── consumers.py            # OrderConsumer WebSocket handler
│   │   ├── routing.py              # WebSocket URL route definitions (`ws/orders/`)
│   │   ├── forms.py                # Signup, login, outlet profile forms
│   │   ├── admin.py                # Django Admin configurations and actions
│   │   └── sitemaps.py             # SEO Sitemap definitions
│   └── utils/
│       └── brevo_email.py          # Email helper utilities
│
├── frontend/                       # Next.js 16 Frontend App
│   ├── package.json                # Frontend dependencies and scripts
│   ├── tsconfig.json               # TypeScript configuration
│   ├── .env.local                  # Frontend environment (NEXT_PUBLIC_API_URL)
│   └── src/
│       ├── app/                    # Next.js App Router
│       │   ├── layout.tsx          # Root layout
│       │   ├── page.tsx            # Splash / Landing page
│       │   ├── login/              # Login interface
│       │   ├── register/           # Registration (Customer & Outlet)
│       │   ├── customer/home/      # Customer outlet browsing & selection
│       │   ├── outlet/[id]/        # Outlet menu & product catalog view
│       │   ├── cart/               # Cart review & Razorpay checkout
│       │   ├── orders/             # Customer order tracking & history
│       │   ├── token/              # Active token modal / popup view
│       │   └── outlet/             # Outlet Head dashboard
│       │       ├── home/           # Dashboard overview & analytics
│       │       ├── orders/         # Live incoming order fulfillment
│       │       ├── delivered/      # Delivered orders log
│       │       └── products/       # Menu item & category manager
│       ├── components/             # Reusable UI components (Footer, OutletSidebar, AuthLayout)
│       ├── hooks/                  # Custom hooks (`useWebSocket.ts`)
│       └── lib/                    # Utilities (`apiCache.ts`, `csrf.ts`)
│
├── build.sh                        # Render / EC2 build script
├── render.yaml                     # Render infrastructure-as-code specification
├── requirements.txt                # Python backend dependencies
└── PROJECT_OVERVIEW.md             # This reference guide
```

---

## 5. 🔑 Key Database Models & Relationships

1. **`CustomUser`** (`AbstractUser`):
   - `is_customer`: Customer flag
   - `is_outlet_head`: Outlet manager flag
   - `is_email_verified`: Email activation status
2. **`Outlet`**:
   - `manager`: `OneToOneField` linking to a `CustomUser` (`is_outlet_head=True`)
   - `is_approved`: Admin approval status
   - `logo`: Cloudinary image
3. **`OutletUI`**:
   - Custom branding: banners 1-3, `theme_color`, `layout_type` ('classic', 'modern', 'minimal').
4. **`Category` & `Product`**:
   - Outlets have multiple categories; categories contain products with prices, images, and live `is_available` toggles.
   - `Product.customer_price = Product.price + get_platform_fee_for_price(Product.price)`.
5. **`Cart` & `CartItem`**:
   - User cart containing line items and real-time total calculations.
6. **`Order` & `OrderItem`**:
   - Order tracking with immutable checkout price snapshots (`unit_price`, `platform_fee`).
   - Razorpay transaction IDs: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
   - Status flow: `pending` ➔ `preparing` ➔ `completed` ➔ `delivered` (or `cancelled`).
7. **`OrderToken`**:
   - Daily unique token per outlet (`UniqueConstraint` on `[outlet, token_date, token_no]`).
   - Created automatically when outlet marks order as `completed`.
8. **`PlatformFeeSlab` & `PlatformFeeConfig`**:
   - Dynamic tier-based fee lookup configured from Django Admin.

---

## 6. 🔌 Real-Time WebSocket Events (`/ws/orders/`)

WebSocket connections join channel groups based on user authentication:
- **Customer**: joins `user_{user.id}` and `customers` group.
- **Outlet Head**: joins `user_{user.id}` and `outlet_{outlet.id}` group.

### Broadcast Events:
- `new_order`: Sent to `outlet_{outlet_id}` on successful payment/order placement.
- `order_update`: Sent to `user_{user_id}` when order status changes.
- `token_update`: Sent to `user_{user_id}` when digital token is assigned.
- `product_deactivated`: Sent to `customers` group when an item goes out of stock.

---

## 7. 🚀 Running Locally for Development

### Backend (Django + Daphne)
```bash
# In the root workspace directory
source venv/bin/activate  # or activate your python venv
cd canteen

# Run migrations
python manage.py migrate

# Start Daphne ASGI server (handles both HTTP and WebSockets)
python manage.py runserver  # Or: daphne -b 127.0.0.1 -p 8000 canteen.asgi:application
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev
# Running on http://localhost:3000
```
