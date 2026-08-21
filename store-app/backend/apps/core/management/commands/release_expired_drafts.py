"""Release the stock held by unconfirmed drafts past their TTL.

Lazy sweeps run inside checkout, but a scheduled pass keeps availability
honest even when no customer is checking out. Wire it to cron or a systemd
timer on the server:

    * * * * *  cd /srv/nasaim/backend && .venv/bin/python manage.py release_expired_drafts
"""

from django.core.management.base import BaseCommand

from apps.orders import services


class Command(BaseCommand):
    help = "Cancel expired draft orders and release their reserved stock."

    def handle(self, *args, **options):
        released = services.release_expired_drafts()
        self.stdout.write(f"released {released} expired draft(s)")
