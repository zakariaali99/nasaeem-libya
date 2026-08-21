# 10 — Agent protocol

**This file tells you how to run the build.** Read `00`–`09` first, and unpack
`reference/`, before you act on anything here.

---

## Step 1 — Absorb the reference before planning

1. Unzip `reference/` into `reference/system/`.
2. Inventory it. Produce `reference/INVENTORY.md` recording, with real counts:
   every page and its route · every component · every API endpoint · every model
   · the payment and delivery provider implementations · the Arabic copy.
3. **Extract, do not adapt.** Pull out the parts that are framework-independent
   and must be preserved byte-exact:
   - **Arabic copy** — every user-facing string
   - **Payment hashing and signing** — especially Moamalat
   - **Business rules** — discount maths, stock, order-number format
   - **Layout and visual design** — spacing, hierarchy, structure

> The reference is a Next.js + Node application. **Its framework choices are
> forbidden here** (Rules 1 and 2). Port behaviour and interface. Discard
> architecture.

## Step 2 — Write your own implementation plan

Produce `store/IMPLEMENTATION.md` before writing code. It must contain, for each
of the ten phases in `09-phases.md`:

- the exact files created or modified
- the subagent assignments and their boundaries
- the dependency order **inside** the phase
- the gate, copied verbatim from `09-phases.md`
- how you will verify it — **the actual command**

Do not restate this specification. Turn it into an executable work plan.

## Step 3 — Delegate to subagents

Each subagent starts in a **fresh context window** and has read nothing. A
subagent brief must therefore be **self-contained**.

### Every brief contains

1. **The two rules, verbatim.** No Next.js, no Node runtime, no Docker. A
   subagent that has not read `README.md` will otherwise reach for Next.js by
   habit — it is the statistically likely choice for a React commerce app, and
   it is forbidden here.
2. Which spec files to read — always `00`, `01`, plus the ones for its task.
3. The precise scope: files it owns, files it must not touch.
4. The interfaces it must conform to — exact model fields, exact endpoint
   shapes, exact prop signatures — so parallel work composes without a merge
   fight.
5. Its gate, and the command that verifies it.
6. **"Report honestly. If your gate cannot pass, say so and stop. A reported
   blocker is worth more than a passed-looking gate. Never edit a criterion to
   fit your result."**

### What parallelises, and what does not

**Safe in parallel** — disjoint files, agreed interfaces:
- Django apps in different directories, once the models exist
- Admin screens (one per subagent, once `<DataTable>` exists)
- Payment providers (one per subagent, once `base.py` exists)
- Widget renderers (one per type, once the widget contract exists)
- Primitives (one per component, once tokens exist)

**Must be serial** — shared foundations or high coupling:
- Phase 0 and Phase 1. **One agent.** Everything depends on them.
- `lib/api.ts`, `globals.css` tokens, `<DataTable>`, `providers/base.py` — each
  is written once, by one agent, before its dependents fan out.
- **Checkout (`orders/services.py`). One agent, alone.** It is the most
  correctness-critical code in the system; concurrent edits will produce a
  race condition nobody can reproduce.

### Sequencing

Run phases in order; parallelise **inside** a phase. A representative shape:

```
Phase 0  ─ 1 agent (serial)
Phase 1  ─ 1 agent (serial)
Phase 2  ─ 1 agent
Phase 3  ─ 1 agent: DataTable + catalog API
           then 4 in parallel: products · categories+collections · inventory · variants
Phase 4  ─ 1 agent: layout + tokens applied
           then 5 in parallel: widget renderers · catalogue · PDP · search · cards
Phase 5  ─ 1 agent ALONE for checkout services
           then 2 in parallel: cart UI · checkout UI
Phase 6  ─ 1 agent: base.py + registry
           then 6 in parallel: one per gateway; 3 in parallel: one per courier
Phase 7  ─ 5 in parallel: dashboard · orders · users · discounts · account
Phase 8  ─ 1 agent (widget builder is tightly coupled)
Phase 9  ─ 4 in parallel: a11y · performance · SEO · deployment
```

**After every phase, you — the orchestrator — run the gate yourself.** Never
accept a subagent's word that its gate passed. Run the command. Read the output.

## Step 4 — Integrate

After each phase: run the full test suite, run the gate, fix what broke, and
record the result in `store/PROGRESS.md` with the date, the command run, and its
actual output. If a gate failed, **write that down too.** The record must be
able to say "this failed", or it records nothing.

---

## Standing rules for every agent

1. **No Next.js. No Node runtime. No Docker.** Above everything.
2. **Never commit** unless the human asks. Report the diff.
3. **One phase per dispatch.** Stop at the gate and report.
4. **"Documented" never completes an action.** Writing that something works is
   not making it work.
5. **Verify by running.** Reading the code is not verification.
6. **No security bypass**, in any environment, for any reason. No test phone
   numbers, no fixed codes, no `if DEBUG: skip_auth`. If a test needs one, the
   test is wrong.
7. **Never weaken** `ATOMIC_REQUESTS`, DRF deny-by-default permissions, throttle
   defaults, or the checkout locking.
8. **Do not invent a payment hash.** Copy the reference exactly.
9. **Do not build the out-of-scope features** — RFM, wallets, vouchers, partner
   API. Flag and move on.
10. **If a gate cannot pass, stop and say so.**

## Speed, safely

Fast comes from **parallelising the independent** and **never redoing work** —
not from skipping gates. The two things that actually cost time:

- **Interface churn.** Agree every shared contract *before* fanning out — model
  fields, endpoint shapes, component props. A day spent on interfaces saves a
  week of merge conflicts.
- **Rework from unverified foundations.** A token layer or an API client that is
  wrong costs every downstream agent. Get Phases 0–1 right serially; then go wide.

Cheapest wins: **build `<DataTable>` once** (26 admin screens depend on it),
**build the token layer once** (everything depends on it), and **write
`lib/api.ts` once** (every data call depends on it).
