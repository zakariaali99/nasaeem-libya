from django.core.management.base import BaseCommand

from apps.payments.reconciliation_service import reconcile_pending_payments


class Command(BaseCommand):
    help = "Reconcile pending/stuck electronic payments by polling gateways (Plan 03)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-age",
            type=int,
            default=3,
            help="Minimum age of pending payment in minutes before querying gateway (default 3)",
        )
        parser.add_argument(
            "--max-age",
            type=int,
            default=1440,
            help="Maximum age of pending payment in minutes (default 1440 / 24h)",
        )

    def handle(self, *args, **options):
        min_age = options["min_age"]
        max_age = options["max_age"]

        self.stdout.write(f"Starting payment reconciliation daemon (min_age={min_age}m, max_age={max_age}m)...")
        results = reconcile_pending_payments(min_age_minutes=min_age, max_age_minutes=max_age)
        self.stdout.write(self.style.SUCCESS(results["message"]))
