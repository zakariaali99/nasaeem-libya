from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.core.models import BankAccount, StoreSettings

CACHE_KEY = "store:settings:v1"
CACHE_TIMEOUT = 24 * 3600  # 24 hours


def _shared_cache() -> bool:
    """A per-process cache (production has no Redis) is only cleared in the
    process that saved, so the others kept the old phone number or wording for
    a day. One primary-key read is cheaper than that."""
    from django.conf import settings as django_settings

    return django_settings.CACHE_IS_SHARED


def get_store_settings() -> StoreSettings:
    shared = _shared_cache()
    settings = cache.get(CACHE_KEY) if shared else None
    if settings is None:
        settings, _ = StoreSettings.objects.get_or_create(pk=1)
        if shared:
            cache.set(CACHE_KEY, settings, CACHE_TIMEOUT)
    return settings


def clean_texts(value) -> dict:
    """`{key: text}` with short string keys and bounded string values.
    The English wording of a line is kept under `en:<key>`."""
    if not isinstance(value, dict):
        return {}
    clean = {}
    for key, text in list(value.items())[:400]:
        if isinstance(key, str) and 0 < len(key) <= 60 and isinstance(text, str):
            clean[key] = text.strip()[:600]
    return clean


def get_public_store_settings() -> dict:
    settings = get_store_settings()
    bank_accounts = [
        {
            "id": str(acc.id),
            "bank_name": acc.bank_name,
            "branch": acc.branch,
            "account_holder": acc.account_holder,
            "account_number": acc.account_number,
            "iban": acc.iban,
            "sort_order": acc.sort_order,
        }
        for acc in BankAccount.objects.filter(is_active=True).order_by("sort_order", "bank_name")[:1]
    ]
    return {
        "store_name": settings.store_name,
        "legal_name": settings.legal_name,
        "legal_name_en": settings.legal_name_en,
        "cr_number": settings.cr_number,
        "address": settings.address,
        "site_url": settings.site_url,
        "phone": settings.phone,
        "whatsapp": settings.whatsapp,
        "email": settings.email,
        "bank_transfer_note": settings.bank_transfer_note,
        "texts": settings.texts or {},
        "bank_accounts": bank_accounts,
    }


def invalidate_store_settings():
    cache.delete(CACHE_KEY)


@receiver([post_save, post_delete], sender=StoreSettings)
@receiver([post_save, post_delete], sender=BankAccount)
def on_settings_change(sender, **kwargs):
    invalidate_store_settings()
