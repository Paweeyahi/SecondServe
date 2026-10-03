# SecondServe: Project Scope & Boundaries

## Project Overview
SecondServe is a sustainable web platform designed to reduce food and product waste by connecting local grocery stores with consumers and delivery riders for near-expiry and clearance products.

## Target Roles (4 Roles)
1. **consumer**: Discovers, purchases, and tracks near-expiry goods (Self-Pickup or Rider Delivery).
2. **store**: Manages store profile, near-expiry inventory, order fulfillment, and donation/sharing.
3. **rider**: Delivers orders from stores to consumers in local neighborhoods.
4. **admin**: Platform moderation, verification of stores/riders, and system oversight.

## Core Value Proposition
- **Consumers**: High-quality groceries and goods at steep discounts; transparent expiry tracking; convenient fulfillment.
- **Stores**: Recovers revenue on items destined for waste; zero extra delivery fleet costs.
- **Riders**: Flexible local neighborhood delivery earnings.
- **Environment**: Direct contribution to Zero Food Waste and community sustainability.

## Explicit Scope Guardrails (MVP Non-Goals)
The following are strictly **out of scope** for the MVP:
- **No in-app digital wallet or automated payment gateway integration**: Use Cash on Delivery (COD) or PromptPay QR slip verification.
- **No real-time GPS map tracking**: Use sequential milestone status transitions (Ready ➔ Picked Up ➔ Delivering ➔ Completed).
- **No automated dispatching / route optimization**: Use a first-come, first-served open Job Pool.

## Added post-MVP (2026-09-18, explicit user request)

These two were originally listed as non-goals above but the user asked for
them by name, understanding the added complexity. Both are implementable
without a paid third-party account (unlike the GPS/payment items still
excluded above), so they're in scope now:

- **Customer reviews/ratings**: a consumer may rate + comment on a store
  after their order reaches `completed`, one review per order. Public
  read (like the product catalog); write gated through a SECURITY DEFINER
  RPC the same way every other mutation in this app is. See M11 in
  `implementation-plan.md`.
- ~~**Web push notifications**~~ — built as M12, then removed on 2026-09-22
  at the user's request (see `implementation-plan.md` M12 section). Back to
  in-app only for these events; Realtime still covers the open
  order-tracking page.
