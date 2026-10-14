"""The one-off command that switches off the shared "000000" password."""

from io import StringIO

import pytest
from django.core.management import call_command

from apps.core.models import Role, User


@pytest.mark.django_db
class TestInvalidateDefaultPasswords:
    def _users(self):
        old = User.objects.create_user(phone_number="0921000001", name="قديم", password="000000", role=Role.CUSTOMER)
        own = User.objects.create_user(phone_number="0921000002", name="خاصة", password="Own-pass-77", role=Role.CUSTOMER)
        boss = User.objects.create_user(phone_number="0921000003", name="مدير", password="000000", role=Role.OWNER)
        return old, own, boss

    def test_report_only_changes_nothing(self):
        old, _, _ = self._users()
        out = StringIO()
        call_command("invalidate_default_passwords", stdout=out)
        old.refresh_from_db()
        assert old.check_password("000000")
        assert ": 1" in out.getvalue()

    def test_apply_locks_only_customers_on_the_default(self):
        old, own, boss = self._users()
        call_command("invalidate_default_passwords", "--apply", stdout=StringIO())
        for user in (old, own, boss):
            user.refresh_from_db()
        assert not old.has_usable_password()
        assert own.check_password("Own-pass-77")
        assert boss.check_password("000000")  # staff are reported, never locked out
