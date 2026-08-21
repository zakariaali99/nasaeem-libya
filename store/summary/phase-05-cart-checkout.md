# Phase 5 — Cart & checkout ✅

## Done

**Backend** — `apps/orders/`
- `services.py` — the money path: guest-cart resolution, the login merge,
  discount validation (nine branches), the region→city delivery-fee fallback,
  collision-safe order numbers, and `checkout()` itself.
- `checkout()` locks every product and variant row **sorted by primary key**
  (two checkouts holding each other's rows in the opposite order is a deadlock
  that only shows up in production), re-reads every price from the database,
  snapshots name and price onto the order line, reserves stock, and empties the
  cart — all in one transaction.
- 14 endpoints: cart CRUD keyed on the **line id**, cart details, draft
  checkout, confirm, orders list/detail, discount validate/manage, plus
  `apps/delivery/` for methods, cities, regions and `/api/geo/`.
- `orders.0002` creates a PostgreSQL sequence for order numbers.

**Frontend**
- `/cart` — line items with stepper and remove, discount entry with live
  validation, server-computed totals, designed empty state.
- `/checkout/:orderId` — city→region cascade, address, courier, payment method,
  review, confirm.
- `/checkout/complete` — order number, lines, totals, delivery address.
- Cart mutations are **optimistic**, with rollback on failure.
- Phase 4's three carried items landed: QuantityStepper on the PDP, a real
  add-to-cart button in the sticky mobile bar, and a live cart badge in the
  header.

## Gate — 7 of 7

| Criterion | Evidence |
|---|---|
| A guest adds to cart without an account, and it survives a reload | driven as a real anonymous visitor: 2 items, 530.00, still there after a full navigation; a second session sees 0 |
| The guest cart merges on login | 2 items before, 2 after. The session key is captured **before** `django_login`, which cycles it |
| **Two checkouts for the last unit — one 409** | real threads, real connections, a barrier: `['conflict', 'ok']`, `reserved_stock 1`, one order |
| Totals recomputed server-side | `{total: "1.00"}` sent → order totals 905.00. The serializer has no `total` field to read |
| Discount validation | nine branches, each with its own Arabic message; `usage_count` increments under the same lock |
| **Zero cities → an Arabic explanation** | cities deactivated → the checkout screen shows the message instead of an empty `<select>` |
| `pytest` green | **212 passed** (168 → 212) |

## The mutation that matters

Remove `select_for_update()` from `checkout()` and the concurrency test fails —
three runs out of three. Both threads read `available_stock == 1` and both
reserve it. That is the test earning its place.

## Optimistic updates, measured

With the PATCH artificially delayed 2,000 ms, the quantity on screen changed
within 250 ms and stayed changed. With the PATCH forced to 500, it rolled back
from 3 to 2. Neither was asserted from the source.

## A design decision the routes forced

`06-routes-and-pages.md` puts the address step *on* `/checkout/:orderId`, so the
order id must exist before an address does. Checkout is therefore two steps: a
**draft** (prices locked, stock reserved, cart emptied) and a **confirm** (address,
courier, payment, delivery fee, total). The subtotal and discount are not
recomputed at confirmation — repricing a basket after the customer commits to it
is how a shop charges a number it did not quote.

## Two defects found by looking

1. **Order numbers came out `202608UNK0001`.** The payment tag is chosen after
   the order exists, so every order would carry `UNK`. Now re-tagged at
   confirmation (`UNK` → `MAN`) with the month and sequence — the order's
   identity — untouched, and the number is not shown before confirmation.
2. **A merge test that lied.** The browser still held a session from Phase 3, so
   the "guest" add went onto a user cart and the merge looked broken. Logging out
   first showed it working. The bug was in the measurement, and it is recorded
   because it looked exactly like a bug in the code.

## Carried into Phase 6

No payment is taken yet. The checkout screen offers only the two methods that
need no gateway — bank transfer and card on delivery — because listing a gateway
that cannot yet take a payment would be a button that does nothing. Stock is
**reserved**, never decremented: it leaves the shelf on payment confirmation,
which is Phase 6's gate.

## Next
Phase 6 — payments and delivery: six gateways, three couriers, webhook signature
rejection and idempotency. Its sandbox criterion is already known to be
unrunnable (no credentials exist) and is struck in `IMPLEMENTATION.md` §7 with a
substituted check that can actually fail.
