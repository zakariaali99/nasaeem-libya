# 00 — Mission

## What you are building

**نسائم ليبيا** (Nasaim Libya) — an e-commerce store selling perfumes, oils and
gift sets to customers in **Libya**.

| Property | Value |
|---|---|
| Language | **Arabic only.** Every customer-facing string is Arabic. |
| Direction | **RTL.** `<html lang="ar" dir="rtl">` |
| Currency | **LYD** (Libyan Dinar), displayed `د.ل` |
| Primary device | **Mobile.** Design mobile-first, always. |
| Network | Frequently slow and metered. Every kilobyte is a real cost. |
| Backend | **Django + Django REST Framework** |
| Frontend | **React 19 + Vite + Tailwind CSS v4** |
| Database | **PostgreSQL** |
| Cache / queue | **Redis** |

## Who uses it

**The customer.** Arrives on a phone, usually over mobile data. Browses a
CMS-driven homepage, searches or filters a catalogue, opens a product, picks
variants, adds to a basket, checks out, chooses a delivery city, pays through a
Libyan payment gateway, and tracks the order.

**The operator.** Runs the whole business through `/admin`: products and
variants, inventory, orders and fulfilment, customers, discounts, delivery
couriers, payment gateways, and the homepage layout builder.

## What "done" means

Not "the code compiles". Done is:

1. A **new customer** can register with a phone number and a password, and buy
   something end to end.
2. An **operator** can add a product, receive the order, and fulfil it.
3. Every one of the **44 screens** in `06-routes-and-pages.md` exists and works.
4. The interface is **visually and behaviourally identical** to the reference —
   same layouts, same Arabic copy, same flows.
5. **No Node process runs.** **No container exists.** **No Next.js is in the tree.**
6. Every gate in `09-phases.md` passes, verified by a command that could have
   failed.

## The failure mode to design against

The reference project failed repeatedly in one specific way: **work was declared
complete on evidence that did not support the claim.** Gates were ticked because
a file existed, not because behaviour was observed. A migration was declared done
when 34 of 44 screens had silently become placeholders.

Therefore, throughout this build:

- **"The file exists" is never evidence that the feature works.**
- **"It compiles" is never evidence that it renders.**
- **"The test passes" is only evidence if you have seen the test fail** when the
  behaviour is broken.
- A screen is done when it has been **loaded in a browser** and driven.
- An endpoint is done when it has been **called with a real request** and its
  response inspected.

Where a gate says *verify by running*, reading the code instead is a failure.

## Scope boundary — build these, do not build those

**In scope:** catalogue, variants, inventory, cart, checkout, orders, payments,
delivery, discounts, accounts/auth, the storefront widget CMS, and the admin panel.

**Explicitly out of scope** — the reference contains partial implementations of
these; **do not port them, do not rebuild them**:

- RFM customer segmentation and analytics
- Wallets and the ledger
- The voucher engine and voucher partners
- The B2B partner API

They were deliberately cut. If you find them in `reference/`, leave them there.
