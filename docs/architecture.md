# SecondServe: Technical Architecture

## Technology Stack
- **Framework**: Next.js 14+ (App Router, Server Components by default, Server Actions for mutations).
- **Language**: TypeScript (strict mode, zero `any`).
- **Styling**: Tailwind CSS (utility-first, responsive, mobile-first design).
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth with SSR cookies, Supabase Storage, Row Level Security).
- **Hosting**: Vercel (Git-integrated serverless deployment).

## Route & Directory Structure
```text
src/
├── app/
│   ├── (public)/          # Landing, Catalog (/products), Store Profile
│   ├── (auth)/            # Login, Register, Auth Callback
│   ├── (consumer)/        # Checkout, Orders, Tracking
│   ├── (store)/           # Store Dashboard, Inventory CRUD, Order Handover, Shares
│   ├── (rider)/           # Rider Dashboard, Job Pool, Delivery Execution
│   └── (admin)/           # Admin Moderation, Platform Metrics
├── components/
│   ├── ui/                # Base UI atoms (Button, Card, Input, Badge, Modal)
│   ├── shared/            # Navbar, Footer, StatusTimeline
│   ├── consumer/          # CartDrawer, ProductCard, DeliveryOptionSelector
│   ├── store/             # ProductForm, StoreOrderCard
│   ├── rider/             # JobCard, DeliveryActionButtons
│   └── admin/             # ModerationTable, MetricCard
├── context/               # Cart Context (localStorage sync, consumer only)
├── lib/
│   ├── supabase/          # client.ts (browser), server.ts (RSC/Actions), middleware.ts
│   └── actions/           # Server Actions (products.ts, orders.ts, deliveries.ts, donations.ts)
└── types/                 # database.types.ts, roles.ts, product.ts, order.ts
```

## State Architecture
- **Catalog & Search Filter State**: URL SearchParams (`?q=...&category=...`).
- **Shopping Cart State**: React Context with `localStorage` persistence.
- **Order & Inventory State**: PostgreSQL database as single source of truth; live order page updates via Supabase Realtime channel.
- **Rider Job Pool State**: Server-rendered list refreshed via Next.js Server Action revalidation.
