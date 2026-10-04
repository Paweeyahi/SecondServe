# SecondServe: Relational Database Schema

## PostgreSQL Tables (Supabase)

### 1. profiles
Extends `auth.users` with application roles.
- `id` UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
- `role` TEXT NOT NULL CHECK (role IN ('consumer', 'store', 'rider', 'admin'))
- `full_name` TEXT NOT NULL CHECK (char_length(trim(full_name)) > 0)
- `phone` TEXT NOT NULL CHECK (char_length(trim(phone)) >= 9)
- `suspended` BOOLEAN NOT NULL DEFAULT false  -- admin moderation: blocks login/role routes
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 2. stores
Store locations and merchant profiles.
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `owner_id` UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT
- `name` TEXT NOT NULL CHECK (char_length(trim(name)) > 0)
- `address` TEXT NOT NULL CHECK (char_length(trim(address)) > 0)
- `latitude` NUMERIC(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90)
- `longitude` NUMERIC(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180)
- `phone` TEXT NOT NULL
- `delivery_fee` NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0)  -- flat fee the store charges for rider delivery
- `verified` BOOLEAN NOT NULL DEFAULT false  -- admin approval gate for public listing
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 3. riders
Delivery rider credentials and status.
- `id` UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE
- `vehicle_type` TEXT NOT NULL CHECK (vehicle_type IN ('motorcycle', 'bicycle', 'car'))
- `license_plate` TEXT NOT NULL CHECK (char_length(trim(license_plate)) > 0)
- `status` TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'offline'))
  -- shift toggle switches `available` <-> `offline`; the system sets `busy` while on an active delivery
- `verified` BOOLEAN NOT NULL DEFAULT false  -- admin approval gate for claiming jobs
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 4. products
Near-expiry inventory items.
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `store_id` UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE
- `name` TEXT NOT NULL CHECK (char_length(trim(name)) > 0)
- `category` TEXT NOT NULL CHECK (category IN ('fresh', 'bakery', 'beverage', 'dry', 'ready_meal', 'produce', 'meat_seafood', 'dairy', 'frozen', 'snacks'))  -- extended by migration-add-categories.sql  -- near-expiry food only
- `original_price` NUMERIC(10, 2) NOT NULL CHECK (original_price > 0)
- `discount_price` NUMERIC(10, 2) NOT NULL CHECK (discount_price >= 0 AND discount_price < original_price)
- `quantity` INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0)
- `expiry_date` TIMESTAMPTZ NOT NULL
- `image_url` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold_out', 'expired', 'shared'))
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

### 5. orders
Order headers and delivery routing.
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `consumer_id` UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
- `store_id` UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT
- `rider_id` UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL
- `delivery_type` TEXT NOT NULL CHECK (delivery_type IN ('pickup', 'delivery'))
- `delivery_address` TEXT NULL
- `delivery_fee` NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0)
- `total_amount` NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0)
- `status` TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'ready', 'rider_assigned', 'picked_up', 'delivering', 'completed', 'cancelled'))
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- CONSTRAINT `check_delivery_address` CHECK ((delivery_type = 'pickup') OR (delivery_type = 'delivery' AND delivery_address IS NOT NULL AND char_length(trim(delivery_address)) > 0))

**Status flow**
- `pickup`:   `pending → confirmed → ready → completed`
- `delivery`: `pending → confirmed → ready → rider_assigned → picked_up → delivering → completed`
- any status → `cancelled` (a cancellation restocks every line item atomically)

### 6. order_items
Line items for purchases.
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `order_id` UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE
- `product_id` UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT
- `quantity` INTEGER NOT NULL CHECK (quantity > 0)
- `unit_price` NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)

### 7. shares
Log of unsold near-expiry items donated.
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `store_id` UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE
- `product_id` UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT
- `quantity` INTEGER NOT NULL CHECK (quantity > 0)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

## Essential Indexes
```sql
CREATE INDEX idx_products_catalog ON public.products (status, expiry_date);
CREATE INDEX idx_products_store ON public.products (store_id);
CREATE INDEX idx_orders_rider_pool ON public.orders (status, delivery_type) WHERE status = 'ready' AND delivery_type = 'delivery' AND rider_id IS NULL;
CREATE INDEX idx_orders_consumer ON public.orders (consumer_id, created_at DESC);
CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
```
