# reference/

Working files for the Django migration. **Most of this directory is gitignored**
because it holds live credentials and customer data.

- `prod-dump.sql` — full pg_dump of the production database (plan+0 step 2). **Gitignored.**
  Contains gateway credentials in `payment_method_configurations.config_data`.
- `fixtures/moamalat/` — captured request/response pairs from a real sandbox
  purchase (plan+0 step 4). These are the test vectors plan+6 ports against.
  Replace any live secret value with `<REDACTED>` but keep the key and its position.

Nothing here is deleted until plan+9 decommissioning is complete.
