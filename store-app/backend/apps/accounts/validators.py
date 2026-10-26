"""Password validators with Arabic messages.

Django's own validators are translated, but not completely: `MinimumLengthValidator`
returns English on an `ar` locale because Arabic's plural forms are not all
covered in the shipped catalogue. This is an Arabic-only store — `00-mission.md`:
"Every customer-facing string is Arabic" — so a validator that sometimes answers
in English is a defect, not a cosmetic issue.

These subclass Django's validators so the *logic* stays Django's; only the
user-facing text is replaced.
"""

from django.contrib.auth import password_validation as dj
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class MinimumLengthValidator(dj.MinimumLengthValidator):
    def validate(self, password, user=None):
        if len(password) < self.min_length:
            raise ValidationError(
                _("كلمة المرور قصيرة جداً، يجب أن تتكوّن من %(min_length)s أحرف على الأقل")
                % {"min_length": self.min_length},
                code="password_too_short",
            )

    def get_help_text(self):
        return _("يجب أن تتكوّن كلمة المرور من %(min_length)s أحرف على الأقل") % {"min_length": self.min_length}


class CommonPasswordValidator(dj.CommonPasswordValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError as exc:
            raise ValidationError(
                _("كلمة المرور هذه شائعة جداً، اختر كلمة مرور أقوى"), code="password_too_common"
            ) from exc

    def get_help_text(self):
        return _("لا يمكن أن تكون كلمة المرور شائعة الاستخدام")


class NumericPasswordValidator(dj.NumericPasswordValidator):
    def validate(self, password, user=None):
        if password.isdigit():
            raise ValidationError(
                _("كلمة المرور لا يمكن أن تتكوّن من أرقام فقط"), code="password_entirely_numeric"
            )

    def get_help_text(self):
        return _("لا يمكن أن تتكوّن كلمة المرور من أرقام فقط")


class UserAttributeSimilarityValidator(dj.UserAttributeSimilarityValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError as exc:
            raise ValidationError(
                _("كلمة المرور تشبه معلوماتك الشخصية كثيراً"), code="password_too_similar"
            ) from exc

    def get_help_text(self):
        return "يجب ألا تشبه كلمة المرور معلوماتك الشخصية"
