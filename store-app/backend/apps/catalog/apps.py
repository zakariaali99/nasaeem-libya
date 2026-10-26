from django.apps import AppConfig
from django.db.backends.signals import connection_created


class CatalogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.catalog'

    def ready(self):
        # Arabic normalisation inside SQLite queries (the live host has no
        # regexp_replace). A no-op on Postgres.
        from .services import register_sqlite_normaliser

        connection_created.connect(register_sqlite_normaliser, dispatch_uid="catalog-sqlite-normaliser")
        # Connections opened before the app registry was ready (none in
        # practice, but the dev server reuses one) get the function too.
        from django.db import connection

        if connection.vendor == "sqlite" and connection.connection is not None:
            register_sqlite_normaliser(connection=connection)
