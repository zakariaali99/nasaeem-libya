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


class MinimumLengthValidator(dj.MinimumLengthValidator):
    def validate(self, password, user=None):
        if len(password) < self.min_length:
            raise ValidationError(
                f"كلمة المرور قصيرة جداً، يجب أن تتكوّن من {self.min_length} أحرف على الأقل",
                code="password_too_short",
            )

    def get_help_text(self):
        return f"يجب أن تتكوّن كلمة المرور من {self.min_length} أحرف على الأقل"


class CommonPasswordValidator(dj.CommonPasswordValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError as exc:
            raise ValidationError(
                "كلمة المرور هذه شائعة جداً، اختر كلمة مرور أقوى", code="password_too_common"
            ) from exc

    def get_help_text(self):
        return "لا يمكن أن تكون كلمة المرور شائعة الاستخدام"


class NumericPasswordValidator(dj.NumericPasswordValidator):
    def validate(self, password, user=None):
        if password.isdigit():
            raise ValidationError(
                "كلمة المرور لا يمكن أن تتكوّن من أرقام فقط", code="password_entirely_numeric"
            )

    def get_help_text(self):
        return "لا يمكن أن تتكوّن كلمة المرور من أرقام فقط"


class UserAttributeSimilarityValidator(dj.UserAttributeSimilarityValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError as exc:
            raise ValidationError(
                "كلمة المرور تشبه معلوماتك الشخصية كثيراً", code="password_too_similar"
            ) from exc

    def get_help_text(self):
        return "يجب ألا تشبه كلمة المرور معلوماتك الشخصية"
