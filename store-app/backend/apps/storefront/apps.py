from django.apps import AppConfig


class StorefrontConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.storefront"
    verbose_name = "واجهة المتجر"

    def ready(self):
        """The layout is cached; every write to a layout or a widget drops it.

        Phase 8's gate is "the change is visible immediately after a save", and
        a cache with no invalidation is precisely how that gate fails.
        """
        from django.db.models.signals import post_delete, post_save

        from . import services
        from .models import StorefrontLayout, Widget

        for model in (StorefrontLayout, Widget):
            post_save.connect(services.invalidate_layout_cache, sender=model,
                              dispatch_uid=f"storefront-cache-save-{model.__name__}")
            post_delete.connect(services.invalidate_layout_cache, sender=model,
                                dispatch_uid=f"storefront-cache-delete-{model.__name__}")
