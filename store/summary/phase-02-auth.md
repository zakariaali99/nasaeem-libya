# Phase 2 — Auth ✅

## Done

**Backend** — `apps/accounts/`
- `phone.py` — one place decides what a Libyan mobile is. `+218…`, `00218…`,
  `218…`, spaced and dashed forms all normalise to `09XXXXXXXX`.
- `serializers.py` — register and login. Login calls `authenticate()` and
  nothing else can produce a session.
- `throttling.py` — rate limits keyed on the **submitted phone number**, so an
  attacker rotating IPs against one account is still limited.
- `otp.py` — Marsol, for password reset only. The reference's hardcoded test
  number and fixed code are documented and deliberately not ported.
- `validators.py` — Arabic-messaged subclasses of Django's password validators.
- `views.py` / `urls.py` — csrf, register, login, logout, me, password reset
  request + confirm, admin user detail/patch.

**Frontend**
- Primitives: `Button` (44px minimum, built-in loading + double-submit guard),
  `Input`, `Label`, `Alert`, `Field`.
- `/login`, `/register`, `/forgot-password` — react-hook-form + zod, Arabic
  inline errors, `autoComplete` and `inputMode` set, `dir="ltr"` on the phone
  input only.
- `RequireAuth` route guard, `RouteErrorBoundary`, per-route `<title>`.
- Every route is `React.lazy()` — auth screens are 1–3 kB chunks.

## Gate — 10 of 10, verified by running

| Criterion | Evidence |
|---|---|
| Correct credentials return a session | `HTTP 200`, `sessionid` set, `/auth/me/` 200 |
| **Phone with no password returns no session** | `400`, no cookie, `/auth/me/` 401 |
| Wrong password ≡ unknown phone | `cmp` of two real responses → identical bytes |
| 4-character password rejected | `400`, no user row created |
| Passwords hashed | row starts `pbkdf2_sha256$` |
| Login throttling → 429 | 7 rapid attempts → `400 400 400 400 429 429 429` |
| Banned user gets no session | `400`, `/auth/me/` 401 |
| `/auth/me/` 401 anon, JSON authed | both, over real HTTP |
| Logout invalidates server-side | replayed cookie in a fresh client → 401 |
| Password reset end to end | new password works, old one 400s, no session issued |

**80 tests pass.** The suite catches the reference's exact bypass: replacing
`authenticate()` with a phone lookup fails 5 tests, including
`test_a_wrong_password_never_yields_a_session`.

## Three defects found by driving it, not reading it

1. **DRF answered 403 where the contract says 401.** SessionAuthentication has
   no `WWW-Authenticate` header, so DRF downgrades `NotAuthenticated` to 403 —
   which would have sent the SPA to "you lack permission" instead of "sign in".
   Fixed in the exception handler.
2. **CSRF was not enforced on anonymous POSTs.** `APIView` is csrf_exempt and
   SessionAuthentication only checks CSRF once a session authenticates someone,
   so `/auth/login/` and `/auth/register/` were open to login CSRF. Added
   `CsrfProtectedAPIView`; public write endpoints inherit from it.
3. **A password error came back in English.** Django's `MinimumLengthValidator`
   is untranslated for Arabic's plural forms. In an Arabic-only store that is a
   defect, not a nit. Subclassed all four validators, and a test now fails if any
   Latin letter appears in a password error.

Plus: CSRF failures returned Django's **HTML** page, which the SPA cannot parse.
Now a JSON envelope with an Arabic message.

## Screens verified in a browser

At a real 320 px and 390 px viewport: no horizontal overflow, **no element below
44×44**, every input has a real `<label>`, exactly one `<h1>`, Arabic-only inline
errors, and forcing `dir="ltr"` breaks nothing. `/me` while signed out redirects
to `/login?next=%2Fme`.

**One correction to my own method:** a first pass reported overflow at 320/390/768
by setting `documentElement.style.width`, which does not resize the viewport. The
numbers were meaningless. Re-measured with real viewport resizes — no overflow.
Two links genuinely were under 44 px and were widened.

## Next
Phase 3 — catalog API and admin catalog screens (20–27), starting with the shared
`<DataTable>` that 26 admin screens depend on.
