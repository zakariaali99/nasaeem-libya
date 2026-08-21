"""Phase 2 gate, as tests.

Every bullet in `09-phases.md` Phase 2 appears here as a test that fails if the
behaviour breaks. Nothing in this file uses a bypass: there is no test phone
number and no fixed code. The OTP double is injected into the view, not reachable
from any request path.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.otp import DummyOtpProvider
from apps.accounts.views import PasswordResetConfirmView, PasswordResetRequestView
from apps.core.models import Role, User

pytestmark = pytest.mark.django_db

GOOD_PASSWORD = "CorrectHorse9"
INVALID_CREDENTIALS = "رقم الهاتف أو كلمة المرور غير صحيحة"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def account(db):
    return User.objects.create_user(
        phone_number="0912345678", password=GOOD_PASSWORD, name="زكريا"
    )


def login(client, phone, password):
    return client.post(
        reverse("auth-login"), {"phone_number": phone, "password": password}, format="json"
    )


class TestLogin:
    def test_correct_credentials_return_a_session(self, client, account):
        response = login(client, "0912345678", GOOD_PASSWORD)
        assert response.status_code == 200
        assert "sessionid" in response.cookies
        assert client.get(reverse("auth-me")).status_code == 200

    def test_a_phone_with_no_password_returns_no_session(self, client, account):
        """The reference issued a session on a phone number alone. It must not
        be possible to reach a session without a password here."""
        for payload in (
            {"phone_number": "0912345678"},
            {"phone_number": "0912345678", "password": ""},
            {"phone_number": "0912345678", "password": None},
        ):
            response = client.post(reverse("auth-login"), payload, format="json")
            assert response.status_code == 400, payload
            assert "sessionid" not in response.cookies
            assert client.get(reverse("auth-me")).status_code == 401

    def test_a_wrong_password_never_yields_a_session(self, client, account):
        """The headline rule: a session only ever follows authenticate().

        The no-password case above is caught by field validation before the
        credential check runs, so this is the test that actually exercises it —
        replace authenticate() with a phone lookup and this fails.
        """
        response = login(client, "0912345678", "DefinitelyWrong9")
        assert response.status_code == 400
        assert "sessionid" not in response.cookies
        assert client.get(reverse("auth-me")).status_code == 401

    def test_unknown_phone_and_wrong_password_are_byte_identical(self, client, account):
        wrong = login(client, "0912345678", "TotallyWrong9")
        unknown = login(APIClient(), "0919999999", "TotallyWrong9")
        assert wrong.status_code == unknown.status_code == 400
        assert wrong.content == unknown.content
        assert INVALID_CREDENTIALS in wrong.content.decode()

    def test_a_malformed_phone_fails_identically_too(self, client, account):
        """A different message for 'not even a phone number' is still an oracle."""
        wrong = login(client, "0912345678", "TotallyWrong9")
        malformed = login(APIClient(), "not-a-phone", "TotallyWrong9")
        assert malformed.content == wrong.content

    def test_a_banned_user_receives_no_session(self, client, account):
        account.banned = True
        account.ban_expires_at = timezone.now() + timedelta(days=7)
        account.save()
        response = login(client, "0912345678", GOOD_PASSWORD)
        assert response.status_code == 400
        assert "sessionid" not in response.cookies
        assert client.get(reverse("auth-me")).status_code == 401

    def test_an_inactive_user_receives_no_session(self, client, account):
        account.is_active = False
        account.save()
        assert login(client, "0912345678", GOOD_PASSWORD).status_code == 400

    def test_login_accepts_any_written_form_of_the_number(self, client, account):
        for variant in ("+218912345678", "00218912345678", "091 234 5678", "091-2345678"):
            fresh = APIClient()
            assert login(fresh, variant, GOOD_PASSWORD).status_code == 200, variant


class TestThrottling:
    def test_login_throttling_returns_429(self, client, account):
        """Rate is 5/min, keyed on the phone number rather than only the IP."""
        codes = [login(client, "0912345678", "WrongPass9x").status_code for _ in range(7)]
        assert 429 in codes, codes
        assert codes.count(400) <= 5

    def test_throttling_follows_the_phone_across_clients(self, client, account):
        """An attacker rotating IPs against one account must still be limited."""
        for _ in range(6):
            login(APIClient(), "0912345678", "WrongPass9x")
        assert login(APIClient(), "0912345678", "WrongPass9x").status_code == 429

    def test_another_account_is_unaffected(self, client, account):
        User.objects.create_user(phone_number="0913333333", password=GOOD_PASSWORD)
        for _ in range(6):
            login(APIClient(), "0912345678", "WrongPass9x")
        assert login(APIClient(), "0913333333", GOOD_PASSWORD).status_code == 200


class TestRegistration:
    def test_registration_creates_an_account_and_a_session(self, client):
        response = client.post(
            reverse("auth-register"),
            {"phone_number": "0914444444", "password": GOOD_PASSWORD, "name": "عميل"},
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["data"]["phone_number"] == "0914444444"
        assert client.get(reverse("auth-me")).status_code == 200

    def test_a_four_character_password_is_rejected(self, client):
        response = client.post(
            reverse("auth-register"),
            {"phone_number": "0914444444", "password": "abcd"},
            format="json",
        )
        assert response.status_code == 400
        assert "password" in response.json()["errors"]
        assert not User.objects.filter(phone_number="0914444444").exists()

    @pytest.mark.parametrize("weak", ["1234567890", "password", "aaaaaaaa"])
    def test_common_and_numeric_passwords_are_rejected(self, client, weak):
        response = client.post(
            reverse("auth-register"),
            {"phone_number": "0915555555", "password": weak},
            format="json",
        )
        assert response.status_code == 400, weak

    def test_passwords_are_stored_hashed(self, client):
        client.post(
            reverse("auth-register"),
            {"phone_number": "0914444444", "password": GOOD_PASSWORD},
            format="json",
        )
        user = User.objects.get(phone_number="0914444444")
        assert GOOD_PASSWORD not in user.password
        assert user.password.startswith("pbkdf2_sha256$")
        assert user.check_password(GOOD_PASSWORD)

    def test_a_taken_number_gets_a_generic_message(self, client, account):
        response = client.post(
            reverse("auth-register"),
            {"phone_number": "0912345678", "password": GOOD_PASSWORD},
            format="json",
        )
        assert response.status_code == 400
        assert "مسجّل" not in response.content.decode()

    def test_an_invalid_phone_is_rejected(self, client):
        response = client.post(
            reverse("auth-register"),
            {"phone_number": "0812345678", "password": GOOD_PASSWORD},
            format="json",
        )
        assert response.status_code == 400


class TestSessionLifecycle:
    def test_me_is_401_for_anonymous_and_json_for_a_user(self, client, account):
        assert client.get(reverse("auth-me")).status_code == 401
        login(client, "0912345678", GOOD_PASSWORD)
        body = client.get(reverse("auth-me")).json()["data"]
        assert body["phone_number"] == "0912345678"
        assert "password" not in body

    def test_logout_invalidates_the_session_server_side(self, client, account):
        login(client, "0912345678", GOOD_PASSWORD)
        stolen = client.cookies["sessionid"].value
        assert client.post(reverse("auth-logout")).status_code == 200
        assert client.get(reverse("auth-me")).status_code == 401

        # Replay the captured cookie in a fresh client: it must authenticate nobody.
        replay = APIClient()
        replay.cookies["sessionid"] = stolen
        assert replay.get(reverse("auth-me")).status_code == 401

    def test_csrf_endpoint_sets_the_cookie(self, client):
        response = client.get(reverse("auth-csrf"))
        assert response.status_code == 200
        assert "csrftoken" in response.cookies


class TestPasswordReset:
    def _views_with_dummy(self):
        provider = DummyOtpProvider()
        PasswordResetRequestView.otp_provider = provider
        PasswordResetConfirmView.otp_provider = provider
        return provider

    def teardown_method(self):
        PasswordResetRequestView.otp_provider = None
        PasswordResetConfirmView.otp_provider = None

    def test_reset_works_end_to_end(self, client, account):
        provider = self._views_with_dummy()

        request = client.post(
            reverse("auth-password-reset-request"),
            {"phone_number": "0912345678"}, format="json",
        )
        assert request.status_code == 200
        request_id = request.json()["data"]["request_id"]
        code = provider.sent[-1]["code"]

        confirm = client.post(
            reverse("auth-password-reset-confirm"),
            {"request_id": request_id, "code": code, "password": "BrandNewPass9"},
            format="json",
        )
        assert confirm.status_code == 200

        # The new password works, the old one does not, and no session was
        # handed out by the reset itself.
        assert "sessionid" not in confirm.cookies
        assert login(APIClient(), "0912345678", "BrandNewPass9").status_code == 200
        assert login(APIClient(), "0912345678", GOOD_PASSWORD).status_code == 400

    def test_an_unknown_number_answers_identically(self, client, account):
        self._views_with_dummy()
        known = client.post(
            reverse("auth-password-reset-request"), {"phone_number": "0912345678"}, format="json",
        )
        unknown = APIClient().post(
            reverse("auth-password-reset-request"), {"phone_number": "0919999999"}, format="json",
        )
        assert known.status_code == unknown.status_code == 200
        assert known.json()["message"] == unknown.json()["message"]

    def test_a_wrong_code_does_not_change_the_password(self, client, account):
        self._views_with_dummy()
        request_id = client.post(
            reverse("auth-password-reset-request"), {"phone_number": "0912345678"}, format="json",
        ).json()["data"]["request_id"]

        response = client.post(
            reverse("auth-password-reset-confirm"),
            {"request_id": request_id, "code": "000000", "password": "BrandNewPass9"},
            format="json",
        )
        assert response.status_code == 400
        assert login(APIClient(), "0912345678", GOOD_PASSWORD).status_code == 200

    def test_an_unknown_request_id_is_rejected(self, client, account):
        self._views_with_dummy()
        response = client.post(
            reverse("auth-password-reset-confirm"),
            {"request_id": "made-up", "code": "123456", "password": "BrandNewPass9"},
            format="json",
        )
        assert response.status_code == 400

    def test_a_weak_new_password_is_rejected(self, client, account):
        provider = self._views_with_dummy()
        request_id = client.post(
            reverse("auth-password-reset-request"), {"phone_number": "0912345678"}, format="json",
        ).json()["data"]["request_id"]
        response = client.post(
            reverse("auth-password-reset-confirm"),
            {"request_id": request_id, "code": provider.sent[-1]["code"], "password": "abcd"},
            format="json",
        )
        assert response.status_code == 400

    def test_no_hardcoded_test_number_exists_anywhere(self):
        """The reference shipped `PHONE_NUMBER = "0920010991"` and
        `VERIFICATION = "111111"`, which bypassed OTP entirely.

        This walks the AST rather than grepping, so the numbers may appear in a
        docstring documenting the history but not in any executable expression.
        """
        import ast
        from pathlib import Path

        banned = {"0920010991", "111111"}
        offenders = []
        for path in Path(__file__).resolve().parent.rglob("*.py"):
            if path.name == "tests.py":
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            docstrings = set()
            for node in ast.walk(tree):
                if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                    doc = ast.get_docstring(node, clean=False)
                    if doc:
                        docstrings.add(doc)
            for node in ast.walk(tree):
                if isinstance(node, ast.Constant) and isinstance(node.value, str):
                    if node.value in banned and node.value not in "".join(docstrings):
                        offenders.append(f"{path.name}:{node.lineno} -> {node.value!r}")
        assert not offenders, offenders


class TestAdminPermissions:
    def test_a_customer_gets_403_on_the_admin_user_endpoint(self, client, account):
        target = User.objects.create_user(phone_number="0916666666", password=GOOD_PASSWORD)
        login(client, "0912345678", GOOD_PASSWORD)
        url = reverse("admin-user-detail", args=[target.id])
        assert client.get(url).status_code == 403
        assert client.patch(url, {"role": Role.OWNER}, format="json").status_code == 403

    def test_an_anonymous_request_gets_401(self, client, account):
        url = reverse("admin-user-detail", args=[account.id])
        assert client.get(url).status_code == 401

    def test_an_owner_may_change_a_role_and_ban(self, client, account):
        User.objects.create_superuser(phone_number="0910000001", password=GOOD_PASSWORD, role=Role.OWNER)
        login(client, "0910000001", GOOD_PASSWORD)
        url = reverse("admin-user-detail", args=[account.id])
        response = client.patch(url, {"role": Role.STAFF, "banned": True}, format="json")
        assert response.status_code == 200
        account.refresh_from_db()
        assert account.role == Role.STAFF and account.banned

    def test_the_admin_endpoint_cannot_set_a_password(self, client, account):
        User.objects.create_superuser(phone_number="0910000001", password=GOOD_PASSWORD, role=Role.OWNER)
        login(client, "0910000001", GOOD_PASSWORD)
        client.patch(
            reverse("admin-user-detail", args=[account.id]),
            {"password": "hijacked-value"}, format="json",
        )
        account.refresh_from_db()
        assert account.check_password(GOOD_PASSWORD)


class TestCsrf:
    """CSRF on every unsafe method, including anonymous ones.

    DRF's SessionAuthentication only checks CSRF once a session authenticates
    someone, and APIView is csrf_exempt by default — so login and register were
    unprotected until `CsrfProtectedAPIView` was introduced. Login CSRF lets an
    attacker sign a victim into the attacker's account.
    """

    @pytest.fixture
    def csrf_client(self):
        return APIClient(enforce_csrf_checks=True)

    def test_login_without_a_csrf_token_is_rejected(self, csrf_client, account):
        response = csrf_client.post(
            reverse("auth-login"),
            {"phone_number": "0912345678", "password": GOOD_PASSWORD},
            format="json",
        )
        assert response.status_code == 403
        assert "sessionid" not in response.cookies

    def test_register_without_a_csrf_token_is_rejected(self, csrf_client):
        response = csrf_client.post(
            reverse("auth-register"),
            {"phone_number": "0918888888", "password": GOOD_PASSWORD},
            format="json",
        )
        assert response.status_code == 403
        assert not User.objects.filter(phone_number="0918888888").exists()

    def test_password_reset_without_a_csrf_token_is_rejected(self, csrf_client, account):
        response = csrf_client.post(
            reverse("auth-password-reset-request"),
            {"phone_number": "0912345678"}, format="json",
        )
        assert response.status_code == 403

    def test_a_csrf_failure_answers_in_json_not_html(self, csrf_client, account):
        """The SPA parses {message, errors} for every failure; Django's HTML
        error page would surface as a generic 'unexpected error'."""
        response = csrf_client.post(
            reverse("auth-login"),
            {"phone_number": "0912345678", "password": GOOD_PASSWORD},
            format="json",
        )
        assert response.status_code == 403
        assert response["Content-Type"].startswith("application/json")
        body = response.json()
        assert "message" in body
        assert not any(c.isascii() and c.isalpha() for c in body["message"])

    def test_login_with_a_csrf_token_succeeds(self, csrf_client, account):
        csrf_client.get(reverse("auth-csrf"))
        token = csrf_client.cookies["csrftoken"].value
        response = csrf_client.post(
            reverse("auth-login"),
            {"phone_number": "0912345678", "password": GOOD_PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        assert response.status_code == 200


class TestArabicMessages:
    """Every customer-facing string is Arabic. Django's MinimumLengthValidator
    answers in English on an `ar` locale, which is why this project subclasses it."""

    ARABIC = pytest.mark.django_db

    @pytest.mark.parametrize(
        "password",
        ["abcd", "1234567890", "password", "aaaaaaaa"],
    )
    def test_password_errors_contain_no_latin_letters(self, client, password):
        response = client.post(
            reverse("auth-register"),
            {"phone_number": "0918777777", "password": password},
            format="json",
        )
        assert response.status_code == 400
        messages = " ".join(response.json()["errors"].get("password", []))
        latin = [c for c in messages if c.isascii() and c.isalpha()]
        assert not latin, f"English leaked into an Arabic message: {messages!r}"
