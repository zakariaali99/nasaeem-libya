"""Switch off the shared "000000" password on customer accounts.

Accounts were once opened with "000000", so anyone who knew a customer's
phone number could sign in as them. This finds the customer accounts whose
password is still "000000" and makes the password unusable. Their orders and
addresses are untouched; the customer keeps buying without a password, and an
administrator can set them a new one from the customer's page if they ask.

Staff and owner accounts are only reported, never changed, so nobody running
the store is locked out.

    python manage.py invalidate_default_passwords            # report only
    python manage.py invalidate_default_passwords --apply    # do it
"""

from django.core.management.base import BaseCommand

from apps.core.models import User

DEFAULT = "000000"


class Command(BaseCommand):
    help = 'Disable the shared "000000" password on customer accounts (report unless --apply).'

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Change the accounts; without it, only report.")

    def handle(self, *args, apply=False, **options):
        customers, staff = [], []
        for user in User.objects.exclude(password="").iterator():
            if not user.has_usable_password() or not user.check_password(DEFAULT):
                continue
            (staff if getattr(user, "is_admin_role", False) or user.is_staff else customers).append(user)

        self.stdout.write(f'حسابات عملاء بكلمة "{DEFAULT}": {len(customers)}')
        for user in staff:
            self.stdout.write(self.style.WARNING(
                f"حساب موظف بكلمة {DEFAULT} (لم يُغيَّر، غيّر كلمته بنفسك): {user.phone_number} {user.name}"
            ))
        if not apply:
            self.stdout.write("لم يُغيَّر شيء. أعد التشغيل مع --apply للتنفيذ.")
            return
        for user in customers:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        self.stdout.write(self.style.SUCCESS(f"أُبطلت كلمة {DEFAULT} على {len(customers)} حساب عميل."))
