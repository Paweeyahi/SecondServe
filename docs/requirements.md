# SecondServe: Functional Requirements

## 1. Authentication & Role-Based Access
- Email and password authentication powered by Supabase Auth.
- 4 explicitly enforced roles: `consumer`, `store`, `rider`, `admin`.
- Automatic creation of a record in `public.profiles` upon auth signup.
- Route protection via Next.js middleware and layout checks.

## 2. Store & Product Management (Store Role)
- **Store Profile**: Manage commercial name, physical address, phone, and static GPS coordinates (latitude/longitude).
- **Product CRUD**:
  - Title, description, category, regular price, discount price, remaining stock, expiry date.
  - Image upload to Supabase Storage bucket (`products`).
  - Business rules: `original_price > 0`, `discount_price < original_price`, `quantity >= 0`, `expiry_date > now()`.
  - Lifecycle states: `active`, `sold_out`, `expired`, `shared`.

## 3. Product Discovery & Catalog (Consumer Role / Public)
- Search by keyword and store name.
- Filter by category, price range, and urgency of expiration (e.g. expires today).
- State driven entirely by URL search parameters for shareability and server rendering.

## 4. Ordering & Fulfillment (Consumer & Store Roles)
- Client-side shopping cart (Context + localStorage).
- Fulfillment choice:
  - **Self-Pickup**: Zero delivery fee; pickup at store address.
  - **Rider Delivery**: Requires delivery address; calculates delivery fee.
- Checkout atomicity: Must check stock and decrement in database transaction.
- Order lifecycle: `pending` ➔ `confirmed` ➔ `ready` ➔ `picked_up` ➔ `delivering` ➔ `completed` (or `cancelled`).

## 5. Delivery Workflow (Rider Role)
- Toggle shift availability: `online` / `offline`.
- Delivery Job Pool: Lists orders with `status = 'ready' AND delivery_type = 'delivery' AND rider_id IS NULL`.
- Race-free job claim: Atomic conditional update to set `rider_id = auth.uid()` and `status = 'rider_assigned'`.
- Handover verification: Rider marks `picked_up` at store, then `delivering`, then `completed` upon drop-off.

## 6. Community Donation / Sharing (Store Role)
- Store can divert unsold near-expiry items to community sharing.
- Sets product status to `shared` and records an entry in the `shares` table.

## 7. Admin Moderation (Admin Role)
- Inspect and approve/suspend user accounts, stores, and riders.
- High-level platform statistics (total food waste diverted, order metrics).
