from django.urls import path

from . import admin_api, backup_views, settings_views

urlpatterns = [
    # Store settings & Bank accounts
    path("store-settings/", settings_views.PublicStoreSettingsView.as_view(), name="store-settings"),
    path("admin/store-settings/", settings_views.AdminStoreSettingsView.as_view(), name="admin-store-settings"),
    path("admin/bank-accounts/", settings_views.AdminBankAccountListCreateView.as_view(), name="admin-bank-accounts-list-create"),
    path("admin/bank-accounts/<uuid:pk>/", settings_views.AdminBankAccountDetailView.as_view(), name="admin-bank-accounts-detail"),

    # Geography & Admin Search
    path("admin/cities/", admin_api.AdminCityListView.as_view(), name="admin-cities"),
    path("admin/cities/<str:city_id>/", admin_api.AdminCityDetailView.as_view(), name="admin-city-detail"),
    path("admin/regions/", admin_api.AdminRegionCreateView.as_view(), name="admin-region-create"),
    path("admin/regions/<str:region_id>/", admin_api.AdminRegionDetailView.as_view(), name="admin-region-detail"),
    path("admin/search/", admin_api.AdminUnifiedSearchView.as_view(), name="admin-unified-search"),

    # Backups
    path("admin/backups/", backup_views.AdminBackupListView.as_view(), name="admin-backups-list"),
    path("admin/backups/export/", backup_views.AdminBackupExportView.as_view(), name="admin-backup-export"),
    path("admin/backups/download/<str:filename>/", backup_views.AdminBackupDownloadView.as_view(), name="admin-backup-download"),
    path("admin/backups/restore/", backup_views.AdminBackupRestoreView.as_view(), name="admin-backup-restore"),
    path("admin/backups/<str:filename>/", backup_views.AdminBackupDeleteView.as_view(), name="admin-backup-delete"),
]
