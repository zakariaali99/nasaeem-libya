from django.urls import path

from . import views

urlpatterns = [
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/<str:lookup>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("products/<str:lookup>/variants/matrix/", views.VariantMatrixView.as_view(), name="variant-matrix"),

    path("categories/", views.CategoryListView.as_view(), name="category-list"),
    path("categories/<str:lookup>/", views.CategoryDetailView.as_view(), name="category-detail"),
    path("categories/<str:lookup>/products/", views.CategoryProductsView.as_view(), name="category-products"),

    path("collections/", views.CollectionListView.as_view(), name="collection-list"),
    path("collections/<str:lookup>/", views.CollectionDetailView.as_view(), name="collection-detail"),
    path("collections/<str:lookup>/products/", views.CollectionProductsView.as_view(), name="collection-products"),

    path("options/", views.VariantOptionListView.as_view(), name="option-list"),
    path("options/<uuid:option_id>/", views.VariantOptionDetailView.as_view(), name="option-detail"),
    path("options/<uuid:option_id>/values/", views.VariantOptionValuesView.as_view(), name="option-values"),

    path("variants/", views.VariantListView.as_view(), name="variant-list"),
    path("variants/<uuid:variant_id>/", views.VariantDetailView.as_view(), name="variant-detail"),

    path("admin/inventory/", views.InventoryListView.as_view(), name="inventory-list"),
    path("admin/inventory/adjust/", views.InventoryAdjustView.as_view(), name="inventory-adjust"),
    path("admin/inventory/logs/", views.InventoryLogsView.as_view(), name="inventory-logs"),

    path("images/", views.ImageUploadView.as_view(), name="image-upload"),
]
