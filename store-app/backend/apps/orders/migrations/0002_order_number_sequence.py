"""A PostgreSQL sequence for the numeric part of an order number.

`04-backend-spec.md`: order numbers are generated collision-safely — "a sequence
or a `select_for_update` counter, **not** `random`". The reference used
`Math.floor(1000 + Math.random() * 9000)`.

A sequence rather than a counter table: it needs no new model (Phase 1's
recorded decision is spec-normative models only), it is transaction-safe by
construction, and `nextval` never hands the same number to two callers.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("orders", "0001_initial")]

    operations = [
        migrations.RunSQL(
            sql="CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;",
            reverse_sql="DROP SEQUENCE IF EXISTS order_number_seq;",
        ),
    ]
