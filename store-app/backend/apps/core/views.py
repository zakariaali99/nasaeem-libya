"""Shared view plumbing."""

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.views import APIView


@method_decorator(csrf_protect, name="dispatch")
class CsrfProtectedAPIView(APIView):
    """An APIView that enforces CSRF even for anonymous requests.

    DRF's SessionAuthentication only checks CSRF when a session actually
    authenticates someone, and `APIView` is csrf_exempt by default — so an
    anonymous POST to /api/auth/login/ is unprotected out of the box. That
    permits login CSRF: an attacker signs a victim into the attacker's account,
    and everything the victim then does (addresses, order history) lands there.

    `03-api-contract.md` says CSRF is enforced on every unsafe method. Public
    write endpoints — login, register, password reset, and later the guest cart —
    inherit from this rather than from APIView.
    """


def csrf_failure(request, reason=""):
    """CSRF rejections must speak JSON, not Django's HTML page.

    The SPA parses `{message, errors}` for every failure; an HTML body makes the
    client fall back to a generic "unexpected error" and hides the real cause
    from the user, who can usually fix it by reloading.
    """
    from django.http import JsonResponse

    return JsonResponse(
        {
            "message": "انتهت صلاحية الجلسة، يرجى تحديث الصفحة والمحاولة مرة أخرى",
            "errors": {"csrf": ["CSRF verification failed"]},
        },
        status=403,
    )
