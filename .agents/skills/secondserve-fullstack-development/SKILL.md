---
name: secondserve-fullstack-development
description: Project-specific engineering standards, architecture rules, and implementation workflows for SecondServe (Next.js App Router, TypeScript, Tailwind CSS, Supabase). Activate whenever writing, reviewing, or refactoring code for the SecondServe codebase.
---

# SecondServe Full-Stack Development Skill

This skill governs **HOW** code must be designed, written, and verified in the **SecondServe** project. Every agent and developer must adhere to these engineering rules to maintain architecture integrity, type safety, and database consistency.

---

## 1. Project Role and Stack

You are a Senior Full-Stack Engineer pair-programming on **SecondServe**—a sustainable web platform connecting stores, consumers, and riders to eliminate near-expiry food waste.

### Technology Standards
- **Framework**: Next.js (App Router, `src/app`). Server Components (RSC) by default; Server Actions (`src/lib/actions/*`) for all state mutations.
- **Language**: TypeScript in strict mode. Absolutely zero `any`.
- **Styling**: Tailwind CSS with mobile-first responsive utility design.
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS), Supabase Auth with SSR cookies (`@supabase/ssr`), and Supabase Storage for product images.
- **Deployment Target**: Vercel.

---

## 2. Architecture & Role Isolation Rules

The system has **4 distinct user roles**: `consumer`, `store`, `rider`, and `admin`.

### Route Grouping & Protection
- Routes must be grouped using Next.js App Router Route Groups:
  - `src/app/(public)/`: Public discovery and landing (`/`, `/products`, `/stores/[id]`).
  - `src/app/(auth)/`: Authentication flows (`/login`, `/register`, `/auth/callback`).
  - `src/app/(consumer)/`: Consumer orders and checkout (`/checkout`, `/orders`, `/orders/[id]`).
  - `src/app/(store)/`: Merchant operations (`/dashboard/store/*`).
  - `src/app/(rider)/`: Delivery fulfillment (`/dashboard/rider/*`).
  - `src/app/(admin)/`: Platform oversight (`/dashboard/admin/*`).
- **Two-Layer Role Defense**:
  1. **Edge Middleware** (`src/middleware.ts`): Inspects session cookie and role claims; immediately redirects unauthorized roles before layout rendering.
  2. **PostgreSQL RLS**: Enforces security at the database row level even if an endpoint or middleware is compromised.
- **Component Isolation**: Never import role-specific components into another role's workspace (e.g., rider actions must never be bundled into consumer or public cards).

---

## 3. TypeScript Rules & Canonical Types

All data structures must reference single, canonical type definitions in `src/types/`:

### Canonical Locations
- `src/types/database.types.ts`: Pure schema types generated from Supabase (`supabase gen types typescript`).
- `src/types/roles.ts`:
  ```ts
  export type UserRole = 'consumer' | 'store' | 'rider' | 'admin';
  ```
- `src/types/product.ts`: `Product`, `ProductCategory`, `ProductStatus = 'active' | 'sold_out' | 'expired' | 'shared'`.
- `src/types/order.ts`: `Order`, `OrderItem`, `OrderStatus = 'pending' | 'confirmed' | 'ready' | 'picked_up' | 'delivering' | 'completed' | 'cancelled'`, `DeliveryType = 'pickup' | 'delivery'`.
- `src/types/store.ts` & `src/types/rider.ts`: Respective merchant and rider profile definitions.

### Typing Invariants
- **No `any`**: Use strict generics or `unknown` combined with Zod validation.
- **DTO Validation**: All inputs to Server Actions must be validated via Zod schemas, with TypeScript types inferred using `z.infer<typeof Schema>`.
- **Null Safety**: Accurately model database nullable fields (e.g. `rider_id: string | null`, `delivery_address: string | null`).

---

## 4. Component & State Management Rules

To prevent state desynchronization and keep the architecture beginner-friendly, state must live in **four deliberate places only**:

1. **Search & Filter State ➔ URL SearchParams**
   - Query strings (`?q=...&category=...&exp=today`) drive product catalog filtering.
   - Never store catalog filter state in React `useState` or Context.
2. **Shopping Cart State ➔ React Context + `localStorage`**
   - Scoped strictly to the consumer. Exists only until checkout is executed.
   - Cleared immediately upon successful order creation.
3. **Order & Inventory State ➔ PostgreSQL (Server State)**
   - Database is the sole source of truth.
   - Active order tracking screens subscribe to live PostgreSQL updates using Supabase Realtime (`postgres_changes`). Do not use interval polling.
4. **Rider Job Pool State ➔ Server Component Fetch + Action Revalidation**
   - Available jobs query is fetched server-side.
   - Upon job acceptance, call `revalidatePath('/dashboard/rider/jobs')`.

### Server Component (RSC) Boundary Rule
- Keep components as Server Components by default.
- Add `"use client"` only at the leaf nodes that require browser interaction (forms, click handlers, Realtime subscriptions, cart drawer).

---

## 5. Supabase Data-Access Rules

### Client Construction
- **Server Environments** (Server Components, Server Actions, Route Handlers):
  - Always use `createClient()` from `src/lib/supabase/server.ts` using `cookies()` from `next/headers`.
- **Browser Environments** (Client Components):
  - Always use `createBrowserClient()` from `src/lib/supabase/client.ts`.
- **Service Role Key Prohibition**: Never leak or use `SUPABASE_SERVICE_ROLE_KEY` in browser bundles. Use it exclusively for administrative/migration scripts.

### Row Level Security (RLS) Policies
- Every table must have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- **Products**: Public read only if `status = 'active' AND quantity > 0`. Store owners manage only their own rows (`owner_id = auth.uid()`).
- **Orders**: Consumers view only `consumer_id = auth.uid()`. Stores view only `store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())`.
- **Rider Job Pool**: Riders read unclaimed ready delivery jobs (`status = 'ready' AND delivery_type = 'delivery' AND rider_id IS NULL`) and their own assigned orders (`rider_id = auth.uid()`).
- **Storage**: Uploads to bucket `products/` must validate user authentication and role (`role = 'store'`).

---

## 6. CRUD & Consistency Rules

### Product Lifecycle
- **Create**: Inserts with `status = 'active'`.
- **Stock Depletion**: When stock hits `0`, update status to `sold_out`.
- **Donation / Sharing**: Setting product to `shared` removes it from commercial catalog and creates an entry in `shares` table.

### Order Status State Machine
Orders must strictly follow this linear progression:
```
[pending] ➔ [confirmed] ➔ [ready] ➔ [picked_up] ➔ [delivering] ➔ [completed]
    │            │           │
    └────────────┴───────────┴──────────▶ [cancelled]
```
- If `delivery_type = 'pickup'`, order moves directly from `ready` ➔ `completed` upon customer collection.
- If `delivery_type = 'delivery'`, order enters Rider Job Pool at `ready`.

### Race-Free Rider Job Acceptance
Rider job picking must be atomic. Never perform a read-then-write in client code. Use a single conditional SQL update:
```sql
UPDATE public.orders
SET rider_id = auth.uid(), status = 'rider_assigned'
WHERE id = target_order_id AND rider_id IS NULL AND status = 'ready';
```
If zero rows are returned/affected, abort and inform the rider that the job was already taken.

---

## 7. Validation & Error-Handling Rules

### Input Validation
- Validate all incoming Server Action arguments with **Zod** before querying the database.
- Enforce business invariants:
  - `original_price > 0`
  - `discount_price >= 0 AND discount_price < original_price`
  - `quantity >= 0`
  - `expiry_date > now()` at creation
  - If `delivery_type = 'delivery'`, `delivery_address` must not be empty.

### Atomic Stock Deductions (Prevent Overselling)
During order creation, deduct inventory atomically:
```sql
UPDATE public.products
SET quantity = quantity - requested_qty
WHERE id = target_product_id AND quantity >= requested_qty;
```
If the update affects 0 rows, throw an explicit `"Item is out of stock"` error and rollback order insertion.

---

## 8. Scope Guardrails (Strict MVP Non-Goals)

To prevent scope creep, **STRICTLY REJECT** and do not write code for:
1. **In-App Payment Gateway / Digital Wallet**: Use Cash on Delivery (COD) or PromptPay QR upload only. No Stripe, Omise, or virtual balances.
2. **Real-Time GPS Map Tracking**: No live vehicle map breadcrumbs or Mapbox/Google Maps polling. Use milestone badges only.
3. **Web Push Notification Service Workers**: No browser push notifications. Use in-app badge indicators and Supabase Realtime alerts.
4. **Automated Dispatching Algorithms**: No automated nearest-rider dispatching. Use the open first-come, first-served Job Pool.
5. **Review / Rating System**: Deferred to post-MVP roadmap.

---

## 9. Workflow Before Changing Code

Before creating or editing files, execute this checklist:
1. **Consult Approved Docs**: Verify alignment with `docs/scope.md`, `docs/requirements.md`, `docs/architecture.md`, and `docs/database.md`.
2. **Verify Module Scope**: Ensure the task belongs to the active development module (M1–M10) and does not introduce out-of-scope features.
3. **Check Types**: Verify that models match `src/types/database.types.ts` and domain definitions.
4. **Confirm Server/Client Boundary**: Decide whether the component is an RSC or Client Component before adding hooks.
5. **Check RLS Implications**: Ensure the planned SQL mutation has a matching RLS policy in PostgreSQL.

---

## 10. Definition of Done (DoD)

A task or module is complete **ONLY** when:
- `npm run build` and `tsc --noEmit` pass with zero errors.
- Role-based authorization is enforced (both route protection and RLS).
- Database operations maintain atomicity (stock checks and rider acceptance).
- UI is fully responsive (Tailwind mobile-first styling).
- No forbidden future features (Section 8) have been added.
- The module's verification checkpoint has been tested and confirmed.
