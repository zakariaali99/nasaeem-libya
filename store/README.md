# store/ — Build نسائم ليبيا from zero

This folder is a **complete build specification**. It is written to be executed by
an AI agent that has never seen this project, with no conversation context.

You are building a Libyan Arabic e-commerce store: **Django backend, React + Vite +
Tailwind frontend.** Feature-for-feature and screen-for-screen identical to the
reference system in `reference/`.

---

## THE TWO RULES THAT OVERRIDE EVERYTHING

### RULE 1 — No Next.js. No Node.js runtime.

- **No Next.js.** Not the framework, not `next/*` imports, not App Router, not
  API routes, not `next.config.*`, not SSR, not `next start`. Zero.
- **No Node.js as a runtime.** No Express, no Fastify, no `server.js`, no Node
  process serving a request, no Node hosting an API, no Node in production.

**The one permitted exception, stated precisely:** Vite is itself a Node program.
You cannot build a React + Vite + Tailwind app without Node in the *build
toolchain*. So:

> **Node is allowed ONLY as a build-time tool** — `npm install`, `npm run build`,
> `npm run dev`. The output is static files. **After the build finishes, no Node
> process may exist anywhere in the running system.** Nothing Node-based serves
> traffic, holds state, talks to the database, or answers an API call.

If you catch yourself writing a Node file that runs in production, you have
broken Rule 1. **Django is the only backend. There is no second backend.**

### RULE 2 — No Docker.

No `Dockerfile`, no `docker-compose.yml`, no containers, no `docker` command
anywhere in setup, development, testing, or deployment. Everything runs directly
on the host: Python virtualenv, PostgreSQL, Redis, nginx, systemd.

---

## Read these in order — all of them, before writing any code

| # | File | What it gives you |
|---|---|---|
| 00 | `00-mission.md` | What is being built, for whom, and what "done" means |
| 01 | `01-architecture.md` | System shape, request lifecycle, deployment topology |
| 02 | `02-data-model.md` | Every model, every field, every relation |
| 03 | `03-api-contract.md` | Every endpoint, method, payload, status code |
| 04 | `04-backend-spec.md` | Django, app by app |
| 05 | `05-frontend-spec.md` | React + Vite structure, routing, state, data layer |
| 06 | `06-routes-and-pages.md` | All 44 screens, page by page |
| 07 | `07-design-system.md` | Tokens, Arabic typography, RTL rules, components |
| 08 | `08-features.md` | Payments, delivery, discounts, widgets, inventory |
| 09 | `09-phases.md` | The phase plan and the gate on each phase |
| 10 | `10-agent-protocol.md` | **How you plan and delegate to subagents** |
| 11 | `11-gates-and-testing.md` | How every claim gets verified |

`reference/` holds the old system. **`10-agent-protocol.md` is the file that tells
you how to run the build.** Read everything else first, then follow it.

---

## The reference system

`reference/` contains a zip of the previous implementation. It is the **source of
truth for what the screens look like and what the features do.**

It is **not** a source of truth for *how* to build them — it was a Next.js + Node
app, which is precisely what Rules 1 and 2 forbid. Mine it for:

- screen layouts, component structure, Arabic copy, and visual design
- business logic and edge cases
- the data model and API shapes
- the payment and delivery provider integrations

Port the **behaviour and the interface**. Discard the **framework**.

---

## Non-negotiable acceptance

The build is done when a customer can register with a phone number, browse the
catalogue in Arabic, add to a basket, check out, pay, and see the order in their
account — and an operator can run the entire business from `/admin` — with **no
Node process running, no container, and no Next.js in the tree.**
