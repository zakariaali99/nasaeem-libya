# reference/ — the old system

## What goes here

Place the zip of the previous implementation in this folder, then unzip it to
`reference/system/`.

```bash
cd store/reference
unzip <the-archive>.zip -d system/
```

## What it is for

It is the **source of truth for the interface and the behaviour**:

- every screen's layout, hierarchy and spacing
- every Arabic string shown to a user
- every business rule and edge case
- the data model and API shapes
- the payment and delivery provider integrations

## What it is NOT for

It is a **Next.js + Node.js application** — exactly what Rules 1 and 2 forbid.

**Port the behaviour and the interface. Discard the framework.**

Do not copy: `next.config.*`, anything importing `next/*`, `src/app/api/**`
route handlers, Node backend services, `Dockerfile`, `docker-compose.yml`,
Drizzle or better-auth (Django owns the database and identity now).

Do copy, carefully: Arabic copy · payment hashing and signing (**byte-exact**,
especially Moamalat, which was validated against a real processed payment) ·
discount and stock maths · the order-number format · layout and visual design.

## First task

Produce `reference/INVENTORY.md` — real counts of pages, components, endpoints,
models and providers, before planning anything. See `../10-agent-protocol.md`.

## Known defects — do not port these

The reference works, but it carries specific faults. They are documented across
`00`–`09` where relevant. In short: the brand palette and Arabic font were
configured but never compiled · dark mode was 246 unreachable classes with no
provider · 562 physical-direction classes against 5 logical ones in an RTL app ·
the cart required an account · `/register` was a dead end · the discount badge
disagreed with the displayed price · buttons were below the 44 px touch minimum
· checkout rendered an empty city dropdown with no explanation.

**Build the store the reference was trying to be, not the one it is.**
