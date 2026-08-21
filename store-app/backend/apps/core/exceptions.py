"""One error envelope for the whole API.

Every error the client sees is `{"message": "<Arabic>", "errors": {...}}`.
The message is shown to the user, so it is always Arabic.
"""

from rest_framework.exceptions import NotAuthenticated
from rest_framework.views import exception_handler as drf_exception_handler

DEFAULT_MESSAGES = {
    400: "البيانات المُرسلة غير صحيحة",
    401: "يجب تسجيل الدخول للمتابعة",
    403: "ليس لديك صلاحية للقيام بهذا الإجراء",
    404: "العنصر المطلوب غير موجود",
    405: "هذه العملية غير مدعومة",
    409: "تعذّر إتمام العملية بسبب تعارض في البيانات",
    429: "عدد المحاولات كبير جداً، يرجى المحاولة بعد قليل",
    500: "حدث خطأ في الخادم، يرجى المحاولة لاحقاً",
}


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    # DRF downgrades NotAuthenticated to 403 whenever the authentication class
    # offers no WWW-Authenticate header, which SessionAuthentication does not.
    # `03-api-contract.md` distinguishes 401 (not signed in) from 403 (signed in,
    # not allowed), and the SPA relies on that split to decide whether to send
    # the user to /login. Restore the intended status.
    if isinstance(exc, NotAuthenticated):
        response.status_code = 401

    detail = response.data
    message = DEFAULT_MESSAGES.get(response.status_code, DEFAULT_MESSAGES[400])
    errors = None

    if isinstance(detail, dict):
        raw = detail.get("detail")
        if raw is not None:
            message = str(raw)
        else:
            errors = {key: _as_list(value) for key, value in detail.items()}
    elif isinstance(detail, list):
        errors = {"non_field_errors": _as_list(detail)}

    payload = {"message": message}
    if errors:
        payload["errors"] = errors
    response.data = payload
    return response


def _as_list(value):
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    return [str(value)]
