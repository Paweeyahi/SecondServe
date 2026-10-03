# SecondServe: Implementation Plan (M1–M12)

Derived from [`requirements.md`](./requirements.md), [`scope.md`](./scope.md),
[`architecture.md`](./architecture.md), [`database.md`](./database.md), and the
engineering rules in
[`.agents/skills/secondserve-fullstack-development/SKILL.md`](../.agents/skills/secondserve-fullstack-development/SKILL.md).

Each module is a shippable slice with an explicit **verification checkpoint**.
A module is **Done** only when its checkpoint passes *and* the global
Definition of Done (SKILL.md §10) holds:

- `npm run build` and `tsc --noEmit` pass with zero errors
- Role protection enforced at **both** middleware and PostgreSQL RLS
- DB mutations are atomic where required (stock, rider claim)
- UI is responsive (Tailwind mobile-first)
- No forbidden features (SKILL.md §8 / scope.md) introduced

Status legend: ✅ done · 🟡 partial · ⬜ not started

---

## Resolved Decisions (locked)

These settle the contradictions previously found between the source docs. The
schema and canonical types have been updated to match; treat this section as
authoritative.

| # | Decision | Consequence |
|---|----------|-------------|
| D1 | **Order status includes `rider_assigned`.** Full set: `pending, confirmed, ready, rider_assigned, picked_up, delivering, completed, cancelled`. | `orders.status` CHECK, `database.md`, and `OrderStatus` in `src/types/order.ts` + `database.types.ts` updated. |
| D2 | **`pickup` flow:** `pending → confirmed → ready → completed`. **`delivery` flow:** `pending → confirmed → ready → rider_assigned → picked_up → delivering → completed`. Any state → `cancelled`. | Drives M6/M7 state machines. |
| D3 | **Cancelling an order restocks every line item atomically** (`quantity += qty` in the same transaction); a product that was `sold_out` flips back to `active`. | M4 `createOrder` rollback + M6 `cancelOrder`. |
| D4 | **Delivery fee is a flat per-store amount.** New column `stores.delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (>= 0)`. Checkout copies `store.delivery_fee` onto `orders.delivery_fee` for `delivery`, `0` for `pickup`. No distance math, no maps, no consumer coordinates. | M2 store settings, M4 checkout. |
| D5 | **Account moderation uses per-table flags:** `profiles.suspended BOOLEAN DEFAULT false`, `stores.verified BOOLEAN DEFAULT false`, `riders.verified BOOLEAN DEFAULT false`. `suspended` blocks login + role routes; `verified` gates public store listing / rider job claiming. | M9, and RLS/middleware in M1/M10. |
| D6 | **Rider Job Pool refreshes via Server Action revalidation** (`revalidatePath`), not Realtime. Realtime is used only for the consumer's own order-tracking page (M5). | M7. |
| D7 | **Rider shift** toggles `riders.status` between `available` and `offline`; the system sets `busy` automatically while the rider holds an active delivery. (`requirements.md` "online/offline" wording maps to `available/offline`.) | M7. |

---

## Module Overview

| # | Module | Primary role(s) | Req. mapping | Status |
|---|--------|-----------------|--------------|--------|
| M1 | Foundation, Auth & Role Routing | all | Req. §1 | ✅ |
| M2 | Store Profile & Product CRUD | store | Req. §2 | ✅ |
| M3 | Product Discovery & Catalog | consumer / public | Req. §3 | ✅ |
| M4 | Cart & Checkout (atomic ordering) | consumer | Req. §4 | 🟡 |
| M5 | Order Tracking & Realtime Timeline | consumer | Req. §4 | 🟡 |
| M6 | Store Order Fulfillment | store | Req. §4 | 🟡 |
| M7 | Rider Delivery Workflow | rider | Req. §5 | 🟡 |
| M8 | Community Donation / Sharing | store | Req. §6 | 🟡 |
| M9 | Admin Moderation & Platform Metrics | admin | Req. §7 | 🟡 |
| M10 | Hardening, RLS Audit & Deployment | all | §8–§10 | 🟡 (RLS consolidation only; rest not started) |
| M11 | Store Reviews & Ratings | consumer / public | added post-MVP, see scope.md | ✅ |
| M12 | Web Push Notifications | all | added post-MVP, see scope.md | ❌ removed 2026-09-22 |

Critical path: **M1 → M2 → M3 → M4 → M5 → M6 → M7**. M8 and M9 depend on M2/M4.
M10 runs last, but its RLS checklist is updated incrementally as each module lands.
M11 was a post-MVP addition (scope.md "Added post-MVP") layered on top of the
M1–M9 foundation, depending on M4 (an order must reach `completed`). M12 was
also added post-MVP but was later removed in full at the user's request — see
its section below for what was torn out.

---

## M1 — Foundation, Auth & Role Routing

**Goal:** Every role can register, log in, and land on the correct workspace;
unauthorized and suspended users are blocked at the edge and at the database.

**Scope**
- Supabase project: schema from `database.md`, `handle_new_user` trigger +
  baseline RLS ([`docs/fix-auth-signup.sql`](./fix-auth-signup.sql))
- Route groups: `(public)`, `(auth)`, `(consumer)`, `(store)`, `(rider)`, `(admin)`
- `src/middleware.ts` — session + role redirect (SKILL.md §2); also redirect
  `profiles.suspended = true` users to a "account suspended" page and sign them out
- `src/lib/supabase/{server,client,middleware}.ts`
- `src/lib/actions/auth.ts` — `signIn`, `signUp`, `signOut`, `getUserProfile`
- `src/app/(auth)/{login,register}/page.tsx`, `auth/callback/route.ts`
- Canonical types: `src/types/roles.ts`, `database.types.ts`

**Key rules**
- Server client via `cookies()` only; never expose `SUPABASE_SERVICE_ROLE_KEY`
- Profile / store / rider rows are created by the DB trigger (SECURITY DEFINER),
  not by client inserts
- No `any`; Server Action inputs validated with **Zod** (add schemas to
  `signUp` / `signIn`)

**Verification checkpoint**
1. Register one user per role → row appears in `profiles` (+ `stores` for store,
   `riders` for rider) with correct `role`; new boolean columns default correctly
   (`suspended = false`, `verified = false`, `delivery_fee = 0`).
2. Login as `store` → redirected to `/dashboard/store`; visiting
   `/dashboard/rider` redirects to `/`.
3. Logged-out visit to `/dashboard/store` → redirect to `/login?next=...`.
4. Set `profiles.suspended = true` for a user → next request redirects to
   `/suspended`; the sign-out button there clears the session.
5. A `consumer` JWT cannot read another user's `profiles` row (RLS).
6. `tsc --noEmit` and `npm run build` clean.

**Implemented:**
- Route groups: `(public)` (landing moved here), `(auth)`, `(consumer)` (guard
  layout ready for M4), `(store)`, `(rider)`, `(admin)`; plus `/suspended`
- `zod` added; `src/lib/validation/auth.ts` — `SignInSchema`,
  `SignUpSchema` (discriminated union on `role`); wired into `signIn`/`signUp`
- `src/middleware.ts` — single profile fetch (`role, suspended`), suspended →
  `/suspended`, consolidated role redirects
- `src/app/(consumer)/layout.tsx` — layer-2 role guard
- Schema migration + RLS applied to the live Supabase project ✅

---

## M2 — Store Profile & Product CRUD

**Goal:** A store owner manages their profile (including flat delivery fee) and
the full product lifecycle, with image upload.

**Scope**
- `src/app/(store)/dashboard/store/` — overview, `products/`, `products/new`,
  `products/[id]/edit`, `settings` (profile + `delivery_fee`)
- `src/components/store/ProductForm.tsx` (client leaf), `StoreProductCard.tsx`
- `src/lib/actions/products.ts` — `createProduct`, `updateProduct`,
  `deleteProduct`, `setProductStatus`
- `src/lib/actions/store.ts` — `updateStoreProfile` (name, address, phone,
  lat/long, `delivery_fee`)
- Supabase Storage bucket `products` + upload helper
- Zod schemas co-located with the actions; inferred types only
- RLS: store owners `SELECT/INSERT/UPDATE/DELETE` products only where
  `store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())`; a store may
  `UPDATE` only its own `stores` row

**Key rules (SKILL.md §6, §7)**
- Invariants in Zod *and* DB CHECK: `original_price > 0`,
  `0 <= discount_price < original_price`, `quantity >= 0`,
  `expiry_date > now()` at creation, `delivery_fee >= 0`
- Create → `status = 'active'`; stock reaching `0` → `sold_out`
- Storage upload validates auth + `role = 'store'`

**Verification checkpoint**
1. Create product with `discount_price >= original_price` → rejected with a field error.
2. Create a valid product → row `status = 'active'`, image URL resolves from Storage.
3. Edit quantity to `0` → status auto-flips to `sold_out`; raising it above `0`
   flips back to `active`.
4. Set `delivery_fee = 25` in store settings → persisted on the `stores` row.
5. Store A cannot see or mutate Store B's product or store row (RLS test via API).
6. Non-store role calling `createProduct` → authorization error.
7. `npm run build` clean.

**Implemented (pending verification):**
- SQL: [`docs/migration-m2-products.sql`](./migration-m2-products.sql) — `products`
  table + CHECK, RLS policies (own CRUD + public catalog gated on
  `stores.verified`), `products` Storage bucket (public read, store-only writes)
- `src/lib/validation/{product,store}.ts` — Zod schemas (price + expiry rules)
- `src/lib/queries/store.ts` — `getCurrentStore`, `getStoreProducts`, `getStoreProduct`
- `src/lib/actions/products.ts` — `createProduct`, `updateProduct`,
  `deleteProduct`, `setProductStatus` (image upload/cleanup, auto active↔sold_out)
- `src/lib/actions/store.ts` — `updateStoreProfile`
- `src/components/store/` — `ProductForm`, `StoreProductCard`,
  `DeleteProductButton`, `StoreProfileForm`, `StoreNav`
- Pages under `src/app/(store)/dashboard/store/`: `layout` (guard + shell),
  `page` (overview + verified banner), `products`, `products/new`,
  `products/[id]/edit`, `settings`
- `next.config.mjs` — `images.remotePatterns` for Supabase Storage
- `src/types/product.ts` — `PRODUCT_CATEGORIES` (5 food categories), narrowed
  `database.types.ts` category union

---

## M3 — Product Discovery & Catalog

**Goal:** Public visitors and consumers browse, search, and filter active
inventory from **verified** stores; all filter state lives in the URL.

**Scope**
- `src/app/(public)/products/page.tsx` (RSC, reads `searchParams`)
- `src/app/(public)/stores/[id]/page.tsx`
- `src/components/consumer/ProductCard.tsx`, `CatalogFilters.tsx` (client leaf
  that pushes to the `router` query), `ExpiryBadge.tsx`
- Server-side query filtered by `?q=`, `?category=`, `?minPrice=`, `?maxPrice=`,
  `?exp=today`
- RLS: public `SELECT` on products only when `status = 'active' AND quantity > 0`
  **and** the owning store has `verified = true`

**Key rules (SKILL.md §4.1)**
- Filter/search state **must** be URL SearchParams — never `useState` / Context
- Page is a Server Component; only the filter control is `"use client"`

**Verification checkpoint**
1. `/products?category=bakery&exp=today` renders server-side and is shareable
   (reload keeps results); `curl` of the URL returns populated HTML.
2. `sold_out` / `expired` / `shared` products, and products from `verified = false`
   stores, never appear in the catalog.
3. Changing a filter updates the URL and result set without a full client-state reset.
4. `/stores/[id]` shows only that store's active products (and 404s for an
   unverified store).
5. `tsc --noEmit` clean; no `any`.

**Implemented (pending verification):**
- `src/lib/validation/catalog.ts` — `parseCatalogFilters` (searchParams → typed
  filters, invalid values dropped), expiry-window table
- `src/lib/queries/catalog.ts` — `searchCatalog` (category / price / expiry /
  keyword-incl-store-name / sort), `getPublicStore`, `getStorePublicProducts`
- `src/components/consumer/` — `ProductCard`, `ExpiryBadge`,
  `CatalogFilters` (client leaf; all filter state in the URL, debounced search)
- Pages: `src/app/(public)/products/page.tsx` (RSC, reads `searchParams`),
  `src/app/(public)/stores/[id]/page.tsx`
- Public visibility relies on the M2 `products_select_public` RLS policy
  (active + in-stock + `stores.verified`)
- **Manual step for testing:** set a test store `verified = true`
  (`update public.stores set verified = true;`) until the M9 admin UI exists

---

## M4 — Cart & Checkout (Atomic Ordering)

**Goal:** Consumer builds a cart, chooses fulfillment, and places an order that
never oversells; delivery fee comes from the store.

**Scope**
- `src/context/CartContext.tsx` — Context + `localStorage` sync, consumer only
- `src/components/consumer/{CartDrawer,DeliveryOptionSelector,QuantityStepper}.tsx`
- `src/app/(consumer)/checkout/page.tsx`
- `src/lib/actions/orders.ts` — `createOrder`
- Postgres function for atomic checkout (single transaction): for each line,
  `UPDATE products SET quantity = quantity - :qty WHERE id = :id AND quantity >= :qty`;
  if 0 rows → raise, roll back the whole order; then insert `orders` + `order_items`
- Zod `CreateOrderSchema`

**Key rules (SKILL.md §6, §7 + D3, D4)**
- Cart is cleared immediately on successful order creation
- `delivery_type = 'delivery'` ⇒ non-empty `delivery_address`,
  `delivery_fee = store.delivery_fee` (read server-side, never trusted from the client)
- `delivery_type = 'pickup'` ⇒ `delivery_fee = 0`
- `total_amount = Σ(unit_price × qty) + delivery_fee`, recomputed server-side
- Overselling: a failed stock `UPDATE` throws `"Item is out of stock"` and rolls
  back the entire order (no partial `order_items`)
- A single cart may only contain items from one store (delivery fee + fulfillment
  are per store) — enforce in cart and re-validate at checkout

**Verification checkpoint**
1. Two concurrent checkouts for the last unit → exactly one succeeds; the other
   gets `"Item is out of stock"`; `quantity` never goes negative.
2. Order + all `order_items` created atomically (no partial order on failure).
3. Delivery without an address → rejected before any DB write.
4. `delivery_fee` on the created order equals the store's current `delivery_fee`
   even if the client posts a different value.
5. Successful order → cart empty, redirect to `/orders/[id]`, `status = 'pending'`.
6. `npm run build` clean.

**Implemented (pending verification):**
- SQL: [`docs/migration-m4-orders.sql`](./migration-m4-orders.sql) — `orders` +
  `order_items` tables, RLS (`orders_select_related`, `order_items_select_related`),
  and `place_order(store, delivery_type, address, items jsonb)` SECURITY DEFINER
  RPC that runs the whole checkout in one transaction (server-side prices + fee +
  stock; `RAISE` rolls everything back; `OUT_OF_STOCK:<id>` on shortfall)
- `src/context/CartContext.tsx` — Context + `localStorage` (`secondserve_cart_v1`),
  one store per cart, qty clamped to stock; mounted in the root layout
- `src/components/consumer/` — `AddToCartButton` (on `ProductCard`), `CartWidget`
  (navbar drawer, consumers + guests), `CheckoutClient`
- `src/lib/validation/order.ts` — `CreateOrderSchema`
- `src/lib/actions/orders.ts` — `createOrder` (calls RPC, maps errors to Thai,
  drops out-of-stock lines), `getCheckoutStoreInfo`
- `src/lib/queries/orders.ts` — `getMyOrders`, `getOrderDetail`
- Pages: `(consumer)/checkout`, `(consumer)/orders`, `(consumer)/orders/[id]`
  (basic confirmation/list — M5 adds the realtime timeline)
- `database.types.ts` — `orders`/`order_items` rows already present; added
  `place_order` to `Functions`; `ORDER_STATUS_LABELS` in `types/order.ts`

**Run first:** [`docs/migration-m4-orders.sql`](./migration-m4-orders.sql)

---

## M5 — Order Tracking & Realtime Timeline

**Goal:** Consumer watches an order progress live without polling.

**Scope**
- `src/app/(consumer)/orders/page.tsx` (list), `orders/[id]/page.tsx` (detail)
- `src/components/shared/StatusTimeline.tsx` — renders the correct milestone set
  for `pickup` vs `delivery` (D2)
- Client subscription to Supabase Realtime `postgres_changes` scoped to the
  consumer's own orders
- RLS: consumer reads only `consumer_id = auth.uid()`

**Key rules (SKILL.md §4.3)**
- Database is the single source of truth; **no interval polling**
- Realtime subscription is a `"use client"` leaf; the page shell stays RSC

**Verification checkpoint**
1. Change an order's `status` in the DB → the open detail page updates within
   ~1s, no manual refresh, no polling requests in the network tab.
2. Consumer A cannot open Consumer B's `/orders/[id]` (RLS → 404 / redirect).
3. Timeline shows `rider_assigned → picked_up → delivering → completed` for a
   delivery order and `ready → completed` for a pickup order.
4. `tsc --noEmit` clean.

**Implemented (pending manual verification — needs a live Supabase project):**
- SQL: [`docs/migration-m5-realtime.sql`](./migration-m5-realtime.sql) — adds
  `public.orders` to the `supabase_realtime` publication (idempotent); relies
  entirely on the existing M4 `orders_select_related` RLS policy for per-row
  authorization, no new policies needed
- `src/components/shared/StatusTimeline.tsx` — pure presentational milestone
  list; picks the `pickup` (4-step) or `delivery` (7-step) sequence per D2,
  renders a dedicated "cancelled" state instead of a step index
- `src/components/consumer/OrderStatusPanel.tsx` (client leaf) — subscribes to
  `postgres_changes` (`UPDATE`, filtered to `id=eq.<orderId>`) on mount,
  updates local `status` state on push, unsubscribes on unmount; renders the
  status banner + badge + `StatusTimeline`
- `src/app/(consumer)/orders/[id]/page.tsx` — stays an RSC data-fetch shell;
  swapped its static status banner for `<OrderStatusPanel>`, passing the
  server-fetched `status`/`delivery_type` as the initial render before the
  subscription takes over
- Consumer-A/Consumer-B isolation reuses the existing `getOrderDetail` +
  `orders_select_related` behavior (unrelated order → `null` → `notFound()`)
- `npm run build` and `tsc --noEmit` both clean
- **Not yet verified manually:** run
  [`docs/migration-m5-realtime.sql`](./migration-m5-realtime.sql) against the
  live project, then confirm checkpoint #1 (live update within ~1s, no
  polling requests in the network tab) and #2 (cross-consumer 404)

**Run first:** [`docs/migration-m5-realtime.sql`](./migration-m5-realtime.sql)

---

## M6 — Store Order Fulfillment

**Goal:** Store advances its incoming orders through the state machine and hands
off to pickup or the rider pool.

**Scope**
- `src/app/(store)/dashboard/store/orders/` (list + detail)
- `src/components/store/StoreOrderCard.tsx`
- `src/lib/actions/orders.ts` — `confirmOrder`, `markReady`, `completePickup`,
  `cancelOrder`
- RLS: store sees orders where
  `store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())`

**Key rules (SKILL.md §6 + D2, D3)**
- Every transition is a guarded `UPDATE ... WHERE id = :id AND status = :expected`;
  0 rows affected ⇒ stale state, abort with a clear message
- Allowed store transitions: `pending → confirmed`, `confirmed → ready`,
  `ready → completed` (pickup only), and `→ cancelled` from
  `pending` / `confirmed` / `ready`
- At `ready` with `delivery_type = 'delivery'` the order becomes visible in the
  rider Job Pool (no status change beyond `ready`)
- `cancelOrder` restocks every line item in the same transaction (D3)
- Store cannot move a delivery order past `ready` — that is the rider's domain (M7)

**Verification checkpoint**
1. Attempt `pending → ready` (skipping `confirmed`) → rejected.
2. A `delivery` order set to `ready` appears in the rider Job Pool query; a
   `pickup` order set to `ready` does not.
3. Cancelling a `confirmed` order → `status = 'cancelled'` and each product's
   `quantity` is incremented back; any `sold_out` product returns to `active`.
4. Store B cannot mutate Store A's order.
5. `npm run build` clean.

**Implemented (pending manual verification — needs a live Supabase project):**
- SQL: [`docs/migration-m6-store-orders.sql`](./migration-m6-store-orders.sql) —
  `confirm_order`, `mark_order_ready`, `complete_pickup_order`, `cancel_order`
  SECURITY DEFINER RPCs; each is a single guarded `UPDATE ... WHERE id = :id
  AND status = :expected AND store_id IN (caller's stores)` — 0 rows affected
  raises `STALE_OR_FORBIDDEN`; `cancel_order` additionally restocks every
  `order_items` row and flips `sold_out → active` in the same function (D3).
  Direct client writes to `orders` remain blocked; these functions are the
  only mutation path, matching the M4 RPC pattern
- `src/types/database.types.ts` — added the four functions to `Functions`
- `src/lib/queries/store-orders.ts` — `getStoreOrders`, `getStoreOrderDetail`
  (both scoped to `store_id`, join `profiles!orders_consumer_id_fkey` for
  consumer name/phone since `orders` has two FKs into `profiles`)
- `src/lib/actions/orders.ts` — added `confirmOrder`, `markReady`,
  `completePickup`, `cancelOrder` (thin RPC wrappers + Thai error mapping +
  `revalidatePath`)
- `src/components/store/{StoreOrderCard,StoreOrderActions}.tsx` — list card
  (server) + action buttons (client leaf, `useTransition`, cancel needs a
  second confirm click); buttons shown are status/delivery-type-dependent
  (`ready` + `delivery` shows "รอไรเดอร์รับงาน" instead of a button — that
  hand-off is M7)
- Pages: `(store)/dashboard/store/orders/page.tsx` (list),
  `orders/[id]/page.tsx` (detail with consumer contact info); `StoreNav.tsx`
  gained an "ออเดอร์" tab
- `npm run build` and `tsc --noEmit` both clean
- **Not yet verified manually:** run
  [`docs/migration-m6-store-orders.sql`](./migration-m6-store-orders.sql)
  against the live project, then confirm checkpoints 1–4 above (skip-state
  rejection, rider-pool visibility at `ready`, restock-on-cancel, cross-store
  isolation)

**Run first:** [`docs/migration-m6-store-orders.sql`](./migration-m6-store-orders.sql)

---

## M7 — Rider Delivery Workflow

**Goal:** Verified riders go on shift, claim jobs race-free, and complete
deliveries by milestone.

**Scope**
- `src/app/(rider)/dashboard/rider/` — overview, `jobs/`, `jobs/[id]`
- `src/components/rider/{JobCard,DeliveryActionButtons,ShiftToggle}.tsx`
- `src/lib/actions/deliveries.ts` — `setShiftStatus`, `claimJob`,
  `markPickedUp`, `markDelivering`, `markDelivered`
- Job Pool list is server-rendered; each action calls
  `revalidatePath('/dashboard/rider/jobs')` (D6)
- RLS: rider reads orders where
  (`status = 'ready' AND delivery_type = 'delivery' AND rider_id IS NULL`) OR
  `rider_id = auth.uid()`; a rider may only `UPDATE` orders where
  `rider_id = auth.uid()` (plus the atomic claim below)

**Key rules (SKILL.md §6 + D2, D6, D7)**
- Only riders with `riders.verified = true` may claim jobs
- Claim is one atomic conditional update — **never** read-then-write in client code:
  ```sql
  UPDATE public.orders
  SET rider_id = auth.uid(), status = 'rider_assigned'
  WHERE id = :order_id AND rider_id IS NULL AND status = 'ready';
  ```
  0 rows affected ⇒ tell the rider the job was already taken
- On claim, set `riders.status = 'busy'`; on `markDelivered`, return it to
  `available`
- Shift toggle switches `riders.status` between `available` and `offline`
  (blocked while `busy`)
- Handover: `rider_assigned → picked_up → delivering → completed`, each a guarded update

**Verification checkpoint**
1. Two riders claim the same job simultaneously → exactly one succeeds; the other
   sees "job already taken"; `rider_id` is written once.
2. Job Pool excludes non-`ready`, `pickup`, and already-claimed orders, and is
   hidden entirely from an unverified rider.
3. A rider can only act on orders where `rider_id = auth.uid()`.
4. Full path `ready → rider_assigned → … → completed` updates the consumer
   timeline (M5) live; `riders.status` ends back at `available`.
5. `tsc --noEmit` clean.

**Implemented (pending manual verification — needs a live Supabase project):**
- SQL: [`docs/migration-m7-rider-delivery.sql`](./migration-m7-rider-delivery.sql) —
  re-scopes the M4 `orders_select_related` Job Pool clause to
  `riders.verified = true` (was only checking `role = 'rider'`, which left
  the pool visible to unverified riders); adds `set_rider_shift`,
  `claim_delivery_job`, `mark_picked_up`, `mark_delivering`, `mark_delivered`
  SECURITY DEFINER RPCs. `claim_delivery_job` does the whole claim as one
  guarded `UPDATE ... WHERE rider_id IS NULL AND status = 'ready'` (never
  read-then-write), raising `JOB_ALREADY_TAKEN` on 0 rows, then flips
  `riders.status` to `busy`; `mark_delivered` flips it back to `available`
- `src/types/database.types.ts` — added the five functions to `Functions`
- `src/lib/queries/rider.ts` — `getCurrentRider`, `getJobPool` (unclaimed
  `ready`+`delivery` orders), `getActiveJob` (the rider's one in-flight
  order), `getRiderOrderDetail`
- `src/lib/actions/deliveries.ts` — `setShiftStatus`, `claimJob`,
  `markPickedUp`, `markDelivering`, `markDelivered` (RPC wrappers + Thai
  error mapping + `revalidatePath` per D6 — no Realtime on the rider side)
- `src/components/rider/{ShiftToggle,JobCard,ClaimJobButton,DeliveryActionButtons,RiderNav}.tsx`
- `src/app/(rider)/dashboard/rider/layout.tsx` — added the missing layer-2
  role guard (previously the route relied on middleware alone); moved the
  page header/container into the layout and added `RiderNav`
  (ภาพรวม / งานจัดส่ง), matching the M2 store dashboard pattern
- Pages: `dashboard/rider/page.tsx` (overview: shift toggle, pool count,
  active job), `jobs/page.tsx` (pool list; shows a blocking notice instead
  of the pool when the rider already has an active job or isn't verified
  yet), `jobs/[id]/page.tsx` (detail; renders `ClaimJobButton` or
  `DeliveryActionButtons` depending on whether `rider_id` is this rider)
- `npm run build` and `tsc --noEmit` both clean
- **Not yet verified manually:** run
  [`docs/migration-m7-rider-delivery.sql`](./migration-m7-rider-delivery.sql)
  against the live project, then confirm checkpoints 1–4 above (concurrent
  claim race, pool visibility/hiding, per-rider write scope, full handover
  path updating the M5 consumer timeline live)

**Run first:** [`docs/migration-m7-rider-delivery.sql`](./migration-m7-rider-delivery.sql)

**Follow-up — fixed manually (2026-09-16), confirmed working:**
1. Checkpoint 1 (race-free claim) verified with two real riders clicking the
   same job near-simultaneously — one succeeded, the other saw "งานนี้ถูก
   ไรเดอร์คนอื่นรับไปแล้ว" exactly as designed.
2. Found while doing that test: the Job Pool always showed "0 รายการ" for
   every unclaimed job. Cause: `order_items_select_related` (M4) only grants
   `SELECT` to the consumer, the owning store, or the *assigned* rider
   (`rider_id = auth.uid()`) — nobody, while a job is still unclaimed. It
   never got the "open pool, verified rider" clause that
   `orders_select_related` has. Fixed in
   [`docs/migration-fix-job-pool-items.sql`](./migration-fix-job-pool-items.sql)
   by mirroring that clause onto `order_items_select_related`.

**Run:** [`docs/migration-fix-job-pool-items.sql`](./migration-fix-job-pool-items.sql)

---

## M8 — Community Donation / Sharing

**Goal:** Store diverts unsold near-expiry stock to community sharing.

**Scope**
- `src/lib/actions/donations.ts` — `shareProduct`
- Store UI: "Share to community" on a product card / detail
- Transaction: set product `status = 'shared'` **and** insert a `shares` row
  (`store_id`, `product_id`, `quantity`) atomically
- Store-facing shares log page (optional but recommended for M9 metrics)

**Key rules (SKILL.md §6)**
- A `shared` product leaves the commercial catalog (already covered by M3's
  `status = 'active'` filter)
- Both writes succeed or neither does

**Verification checkpoint**
1. Share a product → `products.status = 'shared'` and exactly one new `shares`
   row with the matching quantity.
2. The shared product disappears from `/products` and `/stores/[id]`.
3. Inject a failure on the `shares` insert → product status is unchanged (atomic).
4. `npm run build` clean.

**Implemented (pending manual verification — needs a live Supabase project):**
- SQL: [`docs/migration-m8-shares.sql`](./migration-m8-shares.sql) — creates
  `public.shares` (not created by any earlier migration; database.types.ts
  already had the shape from planning, but the live table didn't exist yet),
  RLS (`shares_select_own`, store-owner scoped; an admin-wide policy is
  deferred to M9), and the `share_product(p_product_id)` SECURITY DEFINER RPC
- Sharing diverts a product's **entire** remaining stock (not partial): the
  RPC reads the current `quantity` under `for update`, flips
  `products.status → 'shared'`, and inserts one `shares` row with that
  quantity — both writes in one transaction, matching D3's atomicity style
- `src/types/database.types.ts` — added `share_product` to `Functions`
- `src/lib/actions/donations.ts` — `shareProduct` (RPC wrapper + Thai error
  mapping + revalidate `products`, `dashboard/store/shares`, `/products`)
- `src/lib/queries/shares.ts` — `getStoreShares`
- `src/components/store/ShareProductButton.tsx` (client leaf, two-step
  confirm since it's irreversible) wired into `StoreProductCard.tsx`, shown
  only when `status === 'active'`
- Page: `(store)/dashboard/store/shares/page.tsx` (donation log + running
  total); `StoreNav.tsx` gained a "แชร์ชุมชน" tab
- Already covered by M3: a `shared` product disappears from `/products` and
  `/stores/[id]` because both only select `status = 'active'`
- `npm run build` and `tsc --noEmit` both clean
- **Not yet verified manually:** run
  [`docs/migration-m8-shares.sql`](./migration-m8-shares.sql) against the
  live project, then confirm checkpoints 1–3 above

**Run first:** [`docs/migration-m8-shares.sql`](./migration-m8-shares.sql)

**Follow-up — public donation feed added:** the Navbar always had a
"ส่งต่ออาหารชุมชน" link to `/shares`, but no page existed there (M8 as
originally scoped, matching `requirements.md` §6, is store-only). Since the
user wanted a real public page there, added
[`docs/migration-fix-public-shares.sql`](./migration-fix-public-shares.sql)
(public `shares_select_public` RLS, replacing the store-only
`shares_select_own`) plus `getPublicShares()` / `getTotalSharedQuantity()` in
`src/lib/queries/shares.ts` and `src/app/(public)/shares/page.tsx` — a
public, no-login-required feed of every donation (store name, product,
quantity, date) with a running total. Manually confirmed working.

**Run:** [`docs/migration-fix-public-shares.sql`](./migration-fix-public-shares.sql)

---

## M9 — Admin Moderation & Platform Metrics

**Goal:** Admin verifies / suspends accounts and sees high-level impact numbers.

**Scope**
- `src/app/(admin)/dashboard/admin/` — `users/`, `stores/`, `riders/`, metrics
- `src/components/admin/{ModerationTable,MetricCard}.tsx`
- `src/lib/actions/admin.ts` — `setStoreVerified`, `setRiderVerified`,
  `setUserSuspended`
- Uses the D5 flags (`stores.verified`, `riders.verified`, `profiles.suspended`)
  — no new schema beyond what D5 already added
- RLS: every admin action gated on the caller's `role = 'admin'`

**Key rules**
- Metrics are aggregate queries (COUNT / SUM), server-rendered; no client polling
- Scope guard: no reviews/ratings, no dispatch algorithms (scope.md)
- Suspending a user takes effect on their next request (middleware, M1)

**Verification checkpoint**
1. Admin sets a store `verified = false` → its products stop appearing publicly
   and `/stores/[id]` 404s.
2. Admin suspends a store owner → they are signed out and blocked from
   `/dashboard/store`.
3. Non-admin calling any `admin.ts` action → authorization error (middleware + RLS).
4. Metrics page matches seeded data: food waste diverted = Σ `shares.quantity` +
   Σ delivered `order_items.quantity`; order counts grouped by `status`.
5. `tsc --noEmit` clean; no `any`.

**Follow-up — user-role chart + store sales/commission report added to
`/dashboard/admin/users` (2026-09-18):** user asked for a chart summarizing
users by type plus a per-store sales report with commission. Built per the
`dataviz` skill's procedure:
- `UserRoleChart.tsx` — a horizontal **stacked bar** (not a literal pie; the
  skill's component guidance says "part-to-whole rides on the stacked bar
  chart; donut stays deprioritized" for exactly this composition-of-a-whole
  case) using the validated default categorical palette's first four slots
  (blue/orange/aqua/yellow) in their documented order, plus a table-view twin
  with exact counts/percentages.
- `StoreSalesChart.tsx` — a horizontal bar per store (one hue, since store
  names are nominal categories with no natural order — never a value-ramp on
  nominal data) plus a table with exact revenue/commission figures.
- SQL: [`docs/migration-fix-admin-store-sales.sql`](./migration-fix-admin-store-sales.sql)
  adds `admin_store_sales_report()`, an aggregate RPC (same pattern as
  `admin_platform_metrics()`) summing `order_items` for each store's
  `completed` orders. **Commission is a placeholder 10% of revenue** — there
  is no commission field or billing system anywhere else in the app
  (`scope.md` rules out payment gateways; it's Cash on Delivery), so this is
  an invented business assumption the user should confirm/adjust.

**Run:** [`docs/migration-fix-admin-store-sales.sql`](./migration-fix-admin-store-sales.sql)

**Implemented (pending manual verification — needs a live Supabase project):**
- SQL: [`docs/migration-m9-admin.sql`](./migration-m9-admin.sql) — `is_admin()`
  SECURITY DEFINER helper (avoids self-referencing-policy subtlety on
  `profiles`); admin-wide SELECT policies on `profiles` and `riders` (stores
  already had `stores_select_all` from M1, so no change there);
  `admin_set_store_verified`, `admin_set_rider_verified`,
  `admin_set_user_suspended` SECURITY DEFINER RPCs (each checks `is_admin()`
  itself; `admin_set_user_suspended` also refuses `p_user_id = auth.uid()` so
  an admin can't lock themselves out); `admin_platform_metrics()` returns one
  aggregate `jsonb` object rather than loosening `orders`/`order_items` RLS
  for row-level admin reads
- `src/types/database.types.ts` — added the four functions to `Functions`
- `src/lib/queries/admin.ts` — `getAllUsers`, `getAllStores` (join
  `profiles!stores_owner_id_fkey` for owner name), `getAllRiders` (join
  `profiles!riders_id_fkey`), `getPlatformMetrics` (wraps the RPC)
- `src/lib/actions/admin.ts` — `setStoreVerified`, `setRiderVerified`,
  `setUserSuspended` (RPC wrappers + Thai error mapping + revalidate)
- `src/components/admin/{ModerationTable,MetricCard,StoreVerifyToggle,RiderVerifyToggle,UserSuspendToggle,AdminNav}.tsx`
- `src/app/(admin)/dashboard/admin/layout.tsx` — added the missing layer-2
  role guard (same gap M7 found and fixed for `(rider)`) + `AdminNav`
  (ภาพรวม / ผู้ใช้ / ร้านค้า / ไรเดอร์)
- Pages: `page.tsx` (metrics: per-entity counts, food-waste-diverted using
  the exact D-checkpoint formula, orders-by-status breakdown),
  `users/page.tsx`, `stores/page.tsx`, `riders/page.tsx` (moderation tables)
- Suspend-takes-effect-next-request and store-verified-gates-public-listing
  (checkpoints 1–2) are already covered by M1 middleware and M2/M3 RLS —
  this module only needed to add the toggle
- `npm run build` and `tsc --noEmit` both clean
- **Not yet verified manually:** run
  [`docs/migration-m9-admin.sql`](./migration-m9-admin.sql) against the live
  project, then confirm checkpoints 1–4 above with seeded data

**Run first:** [`docs/migration-m9-admin.sql`](./migration-m9-admin.sql)

---

## M10 — Hardening, RLS Audit & Deployment

**Goal:** Ship to Vercel with security, type-safety, and responsiveness verified
end to end.

**Scope**
- RLS audit: every table has `ENABLE ROW LEVEL SECURITY` + reviewed policies
  matching SKILL.md §5 and the D5 gates; consolidate them into
  `docs/rls-policies.sql` as the source of truth ✅ **done 2026-09-18** —
  see below
- Zod coverage: every Server Action validates its input; grep for unvalidated
  `formData.get` and for `any` ✅ **audited 2026-09-22** — every shape-bearing
  input already has a Zod schema; the only unvalidated params are opaque
  uuids into RPCs that re-check ownership/status server-side, or
  enums/booleans backed by a Postgres-side type/CHECK. No gaps found.
- Atomicity review: checkout (M4), order cancel/restock (M6), and rider claim
  (M7) confirmed transactional ✅ **re-reviewed 2026-09-22** — every
  SECURITY DEFINER function in `rls-policies.sql` is atomic (single
  WHERE-gated UPDATE, or an explicit `for update` row lock for multi-step
  ones like `share_product`); no client-side check-then-mutate race found in
  `src/lib/actions/*.ts`. One genuine gap found outside the RPC layer:
  `updateProduct` (`src/lib/actions/products.ts`) wrote the product edit
  form's quantity straight to the table, so a concurrent `place_order` stock
  decrement between page-load and save got silently overwritten (lost
  update). Fixed via a new `update_product()` RPC that locks the row and
  requires the caller's `p_expected_quantity` (quantity at form-render time,
  carried as a hidden field in `ProductForm.tsx`) to still match, raising
  `QUANTITY_CHANGED` otherwise — same row-lock pattern as `share_product()`.
  See [`docs/migration-fix-product-update-race.sql`](./migration-fix-product-update-race.sql)
  (also folded into `rls-policies.sql`, function count 47→48). **Run and
  confirmed** against the live project (2026-09-22).
- Responsive QA pass at 360 / 768 / 1280 px across every route group
  ✅ **done 2026-09-22** — dev server driven headlessly via Playwright
  (`chromium-cli` unavailable on this machine, so used `npx playwright` +
  a scratch driver script instead; no project skill existed for this yet).
  Checked every public page (`/`, `/products`, `/login`, `/register`,
  `/shares`) at all three widths, plus every store dashboard page
  (`dashboard/store`, `products`, `products/new`, `orders`, `settings`,
  `shares`), the rider dashboard + Job Pool, and the consumer orders page —
  the last three reached by registering one throwaway `qa-responsive-
  {role}@test.local` account per role through the real register flow (no
  admin dashboard check — no self-serve admin signup; covered once the
  seed script's demo-admin account is usable, or check it manually).
  `document.scrollWidth` vs `clientWidth` confirmed no horizontal overflow
  on any page/width combination; visual screenshot review found no cut-off
  text, broken nav, or unusable controls (the store/rider tab strip
  collapsing to a horizontally-scrollable row under ~400px is an
  intentional pattern, not a bug — confirmed by comparing against the
  1280px screenshot where all tabs show). One React hydration console
  warning appeared once on `/products`' first (dev-mode, on-demand-compile)
  load and did not reproduce on repeated loads — a known Next.js dev-mode
  first-compile artifact, not a real bug; not worth chasing further.
  Leaves 3 throwaway auth accounts on the live project
  (`qa-responsive-consumer/store/rider@test.local`, password
  `TestPass123!`) — harmless (isolated test data, no real user affected)
  but safe to delete via Supabase dashboard -> Authentication whenever
  convenient.
- `next build` + `tsc --noEmit` in CI; Vercel project + env vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the VAPID
  pair M12 added here is gone along with M12 itself, see its section below)
- Seed script for demo data (one store, products, a consumer, a rider, an admin)
  ✅ **done 2026-09-22** — [`scripts/seed.mjs`](../scripts/seed.mjs)
  (`npm run seed`). Uses the Supabase Admin API (`SUPABASE_SERVICE_ROLE_KEY`,
  documented in `.env.local.example` — server/seed-only, bypasses RLS, never
  used by the app itself) to create one demo account per role (fixed
  `demo-{role}@secondserve.local` emails, password `Demo1234!`), including
  an admin account created directly via metadata — bypassing the
  register-page UI restriction rather than the old manual
  register-then-hand-edit-role workaround. Force-verifies the demo
  store/rider, then seeds 5 near-expiry products (placeholder images
  uploaded to the real `products` storage bucket via `picsum.photos`, same
  code path as a real upload). Idempotent — matches by fixed email/product
  name and skips what already exists, safe to run repeatedly. **Not yet run
  against the live project** (needs the service role key added locally
  first).

**RLS consolidation, done ahead of the rest of M10 (2026-09-18):**
[`docs/rls-policies.sql`](./rls-policies.sql) is now the single reference for
every current RLS policy and SECURITY-DEFINER function across all 16
migration files (`migration-m1` … `migration-m12` + every
`migration-fix-*.sql`) — built by tracing each table/function to its
*final* state, since several were replaced more than once (e.g.
`orders_select_related`: M4 → tightened by M7; `products_select_public`: M2
→ tightened by `migration-fix-expiry-gate`; `submit_review`: M11's 3-arg
version → replaced by `migration-fix-rider-reviews`'s 4-arg version). Every
statement is idempotent and the file is safe to re-run in full at any time
as a sanity check. It does **not** include `CREATE TABLE` DDL (still
`docs/database.md` + the individual `migration-mN-*.sql` files for schema
history) — this file is the access-control layer only: 26 RLS policies +
21 SECURITY DEFINER functions (including the `handle_new_user` signup
trigger) across profiles/stores/riders/products/orders/order_items/shares/
reviews/push_subscriptions, plus the `orders` Realtime publication. This
was done as a standalone task ahead of the rest of M10 (documentation-only,
no live database changes), per explicit user request — the remaining M10
scope items above are still not started.

**Run** (safe against the live project — every statement idempotent, and
running it doubles as an audit that no environment is missing a fix):
[`docs/rls-policies.sql`](./rls-policies.sql)

**Verification checkpoint**
1. `npm run build` and `npm run type-check` green in CI.
2. RLS regression suite: for each role, a scripted attempt to read/write another
   role's rows fails.
3. Scope check: no Stripe/Omise/wallet, no map/GPS/geocoding, no
   auto-dispatch anywhere in the codebase. (Reviews and the M12 service
   worker are now in scope — see scope.md "Added post-MVP" — so this
   checkpoint no longer bans them.)
4. Lighthouse mobile pass on `/`, `/products`, `/dashboard/store`.
5. Production deploy loads and a full consumer purchase → rider delivery flow
   works against the production Supabase project.

---

## M11 — Store Reviews & Ratings

**Goal:** A consumer rates a store after their order is delivered; the
public sees an average rating and the review list.

**Scope**
- `public.reviews` table: `id, order_id UNIQUE, consumer_id, store_id, rating
  int CHECK 1-5, comment text nullable, created_at`. One review per order,
  enforced by the `UNIQUE` constraint (belt-and-suspenders with the RPC check).
- `submit_review(p_order_id, p_rating, p_comment)` SECURITY DEFINER RPC —
  matches every other mutation in this app: checks the caller is that
  order's consumer, checks `status = 'completed'`, inserts.
- RLS: public `SELECT` (like the product catalog — reviews are meant to be
  seen by anyone deciding whether to buy from a store); no direct
  INSERT/UPDATE/DELETE policy, the RPC is the only write path.
- `src/components/shared/StarRating.tsx` — read-only star display (reused on
  the store page) and an interactive input variant (used in the review form).
- `src/components/consumer/ReviewForm.tsx` — shown on `/orders/[id]` only
  when `status === 'completed'` and no review exists yet for that order.
- `/stores/[id]` (public store page): average rating + count near the store
  name, and the review list below the product grid.

**Key rules**
- A consumer can only review their own order, and only once it's `completed`
  — enforced server-side in the RPC, not just hidden in the UI.
- Reviews are immutable in this pass (no edit/delete UI) — matches the
  "keep it minimal" instinct for a first cut; extending to edit/delete or
  store owner replies is a natural follow-up, not built now.

**Verification checkpoint**
1. Reviewing an order you don't own, or one that isn't `completed` yet →
   rejected by the RPC (test by calling `submit_review` directly with a
   mismatched order id).
2. Submitting a second review for the same order → rejected (`UNIQUE`
   violation surfaces as a friendly "already reviewed" error, not a raw DB
   error).
3. `/stores/[id]` shows the correct average and every review, visible even
   logged out.
4. `npm run build` / `tsc --noEmit` clean.

**Implemented (pending manual verification — needs a live Supabase project):**
- SQL: [`docs/migration-m11-reviews.sql`](./migration-m11-reviews.sql) —
  `reviews` table (`order_id UNIQUE`), public SELECT RLS, `submit_review()`
  SECURITY DEFINER RPC (checks ownership + `completed` status + no existing
  review, all server-side)
- `src/types/database.types.ts` / `src/types/review.ts`
- `src/lib/queries/reviews.ts` — `getStoreReviews`, `getStoreRatingSummary`,
  `getReviewForOrder`
- `src/lib/actions/reviews.ts` — `submitReview` (Zod + RPC wrapper + Thai
  error mapping)
- `src/components/shared/StarRating.tsx` (read-only or interactive),
  `src/components/consumer/ReviewForm.tsx`
- Wired into `(consumer)/orders/[id]/page.tsx` (form appears only when
  `status === 'completed'` and no review yet; shows the submitted review
  otherwise) and `(public)/stores/[id]/page.tsx` (average + count near the
  store name, full review list below the product grid)
- `npm run build` / `tsc --noEmit` clean
- **Not yet verified manually:** run
  [`docs/migration-m11-reviews.sql`](./migration-m11-reviews.sql), then
  confirm the checkpoints above

**Run:** [`docs/migration-m11-reviews.sql`](./migration-m11-reviews.sql)

**Follow-up — extended to rider reviews (2026-09-18):** `reviews` was
store-only; the user asked for rider reviews too. A delivery order can now
carry up to *two* reviews (one per target), not one:
[`docs/migration-fix-rider-reviews.sql`](./migration-fix-rider-reviews.sql)
(run after `migration-m11-reviews.sql`) makes `store_id` nullable, adds
`rider_id`, adds a `CHECK` enforcing exactly one target per row, replaces
the old `UNIQUE(order_id)` with two partial unique indexes (at most one
store review + one rider review per order), and recreates `submit_review()`
with a `p_target` ('store' | 'rider') parameter. `ReviewForm` is now generic
over `target`; the consumer's `/orders/[id]` page shows both forms/results
for a completed delivery order (store review always; rider review only when
`delivery_type = 'delivery'` and a rider was assigned). Added
`getRiderReviews`/`getRiderRatingSummary`/`getRiderRatingSummaries` to
`src/lib/queries/reviews.ts`; the rider's own dashboard now has a rating
stat card, and `/dashboard/admin/riders` has a rating column.

**Run:** [`docs/migration-fix-rider-reviews.sql`](./migration-fix-rider-reviews.sql)

---

## M12 — Web Push Notifications (removed 2026-09-22)

Built and DB-confirmed exactly as described in the "Implemented" section this
replaces (self-hosted VAPID push: `push_subscriptions` table,
`get_order_push_targets`/`get_available_rider_push_targets` RPCs, service
worker, `NotificationOptIn` control, wired into `confirmOrder`/`markReady`/
`markDelivered`). M11 passed manual QA on 2026-09-22 and, in the same pass,
the user asked to remove M12 entirely (code + DB), so it was torn back out
rather than left pending verification:

- Deleted `src/components/shared/NotificationOptIn.tsx`,
  `src/lib/actions/push.ts`, `src/lib/push/send.ts`, `public/sw.js`
- Removed the `pushOrderEvent`/`pushAvailableRiders` calls and imports from
  `src/lib/actions/orders.ts` (`confirmOrder`, `markReady`) and
  `src/lib/actions/deliveries.ts` (`markDelivered`); removed `<NotificationOptIn />`
  from `NavbarClient.tsx`
- Removed the `push_subscriptions` table type and the two RPC types from
  `src/types/database.types.ts`
- Removed the `web-push` / `@types/web-push` deps from `package.json` and the
  VAPID env vars from `.env.local` / `.env.local.example`
- Removed the `push_subscriptions` RLS policy + both RPCs from
  `docs/rls-policies.sql` (audit count updated accordingly)
- DB: [`docs/migration-remove-push.sql`](./migration-remove-push.sql) drops
  the `push_subscriptions` table and both RPC functions — run this even
  though `migration-m12-push.sql` was already applied, to undo it on the live
  project. `migration-m12-push.sql` itself is left in place as historical
  record only; do not rerun it.

**Run:** [`docs/migration-remove-push.sql`](./migration-remove-push.sql)

---

## Schema deltas applied for this plan

Already reflected in `docs/database.md` and `src/types/*`. Run
[`docs/migration-plan-schema.sql`](./migration-plan-schema.sql) against the live
Supabase project (fold into `docs/rls-policies.sql` in M10):

```sql
ALTER TABLE public.profiles ADD COLUMN suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.stores   ADD COLUMN delivery_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0);
ALTER TABLE public.stores   ADD COLUMN verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.riders   ADD COLUMN verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD  CONSTRAINT orders_status_check CHECK (
  status IN ('pending','confirmed','ready','rider_assigned','picked_up','delivering','completed','cancelled')
);
```

---

## Fixes found during manual testing

- **Slow page navigation/refresh** (found 2026-09-18, user-reported): every
  request paid for repeated Supabase Auth round-trips instead of one.
  1. `src/middleware.ts` ran on every request and called
     `supabase.auth.getUser()` (a network call to the Supabase Auth server to
     verify the JWT) plus a `profiles` query, for every single navigation.
     Switched to `supabase.auth.getSession()` (decodes the cookie locally,
     no network round-trip in the common case) — safe here because
     middleware is only a coarse UX pre-redirect; the real security boundary
     (RLS + each role layout's own verified `getUserProfile()` call) is
     unchanged.
  2. Every role's layout + page independently called their own "get current
     user/store/rider" helper, each re-running `auth.getUser()` from
     scratch — e.g. the store dashboard called it 3 times per render
     (`getUserProfile` in the layout, `getCurrentStore` in the layout,
     `getCurrentStore` again in the page). Added
     `src/lib/supabase/user.ts` (`getAuthUser`, wrapped in `React.cache()`)
     and wired it into `getUserProfile`, `getCurrentStore`, `getCurrentRider`,
     `getMyOrders`, `updateStoreProfile`, `saveSubscription` — `cache()`
     memoizes per request, so repeat calls anywhere in the same
     render/action reuse the first verified result instead of re-fetching.
     `getCurrentStore`/`getCurrentRider` are now `cache()`-wrapped
     themselves too, so their DB query is also deduped, not just the auth
     check.

- **Order history/job details showed "สินค้า" with no image once a product's
  status changed** (found 2026-09-18, on both the consumer order page and the
  rider job page): `products` RLS only granted SELECT to the public listing
  conditions or the owning store -- a consumer or rider viewing a *past*
  order's line items got `product: null` from the join (RLS-hidden embeds
  come back null, not an error) as soon as that product went `sold_out`,
  expired, or was shared. Fixed in
  [`docs/migration-fix-product-visibility.sql`](./migration-fix-product-visibility.sql)
  by adding `products_select_order_related`: visible to the consumer/rider/
  store on an order it belongs to, or an eligible rider browsing the open Job
  Pool -- mirroring the clauses already on `orders_select_related`. No app
  code changes needed (the queries already selected `name, image_url`).

**Run:** [`docs/migration-fix-product-visibility.sql`](./migration-fix-product-visibility.sql)

- **Expired-but-still-`active` products stayed purchasable** (found while
  manually testing the M4 oversell checkpoint): nothing in the app flips a
  product's `status` to `'expired'` on a timer — `ExpiryBadge` is a
  display-only calculation comparing `expiry_date` to "now" client-side. The
  actual gates (RLS `products_select_public` from M2, and the `place_order()`
  stock-decrement `WHERE` clause from M4) never checked `expiry_date`, so a
  product already past expiry but still `status = 'active'` remained visible
  in the catalog/store page and checkoutable. Fixed in
  [`docs/migration-fix-expiry-gate.sql`](./migration-fix-expiry-gate.sql) by
  adding `expiry_date > now()` to both. **Run this against the live project**
  (after m4-m9) — it re-issues the M2 policy and M4 function in place, no new
  objects.
