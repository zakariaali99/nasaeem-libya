# summary/ — phase-by-phase status

One file per phase. Each says **what was done**, **what it proves**, and
**what is next**. The evidence lives in `../PROGRESS.md`; this folder is the
short version you can read in a minute.

| Phase | Title | Status |
|---|---|---|
| 0 | Foundation | ✅ done |
| 1 | Data model | ✅ done |
| 2 | Auth | ✅ done |
| 3 | Catalog API + admin catalog screens | ✅ done |
| 4 | Storefront browse | ⚠️ built — 1 criterion struck (variant images), 1 **failed** (Lighthouse) |
| 5 | Cart & checkout | ✅ done |
| 6 | Payments & delivery | 🔨 next |
| 7 | Orders, accounts, admin operations | ⬜ |
| 8 | Widget builder | ⬜ |
| 9 | Quality, accessibility, SEO, deployment | ⬜ |

Rules that hold across every phase:
- A gate is only met when its command has been **run** and its output seen.
- A criterion that cannot fail is struck, with the reason recorded.
- Failures are written down. A summary with no failures in it is a summary of
  not looking.
