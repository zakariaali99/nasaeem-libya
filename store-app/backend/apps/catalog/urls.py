from django.urls import path

from . import views

urlpatterns = [
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/<uuid:pk>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("products/<uuid:pk>/sizes/", views.ProductSizesManageView.as_view(), name="product-sizes-manage"),
    path("products/<uuid:pk>/variants/matrix/", views.VariantMatrixView.as_view(), name="variant-matrix"),
    path("products/<uuid:pk>/reviews/", views.ProductReviewsView.as_view(), name="product-reviews"),

    path("categories/", views.CategoryListView.as_view(), name="category-list"),
    path("categories/<uuid:pk>/", views.CategoryDetailView.as_view(), name="category-detail"),
    path("categories/<uuid:pk>/products/", views.CategoryProductsView.as_view(), name="category-products"),

    path("collections/", views.CollectionListView.as_view(), name="collection-list"),
    path("collections/<uuid:pk>/", views.CollectionDetailView.as_view(), name="collection-detail"),
    path("collections/<uuid:pk>/products/", views.CollectionProductsView.as_view(), name="collection-products"),

    # Public Storefront read-by-slug (GET only)
    path("products/by-slug/<str:slug>/", views.ProductBySlugView.as_view(), name="product-by-slug"),
    path("categories/by-slug/<str:slug>/", views.CategoryBySlugView.as_view(), name="category-by-slug"),
    path("collections/by-slug/<str:slug>/", views.CollectionBySlugView.as_view(), name="collection-by-slug"),

    path("options/", views.VariantOptionListView.as_view(), name="option-list"),
    path("options/<uuid:option_id>/", views.VariantOptionDetailView.as_view(), name="option-detail"),
    path("options/<uuid:option_id>/values/", views.VariantOptionValuesView.as_view(), name="option-values"),

    path("variants/", views.VariantListView.as_view(), name="variant-list"),
    path("variants/<uuid:variant_id>/", views.VariantDetailView.as_view(), name="variant-detail"),

    path("admin/inventory/", views.InventoryListView.as_view(), name="inventory-list"),
    path("admin/inventory/adjust/", views.InventoryAdjustView.as_view(), name="inventory-adjust"),
    path("admin/inventory/logs/", views.InventoryLogsView.as_view(), name="inventory-logs"),

    path("images/", views.ImageUploadView.as_view(), name="image-upload"),

    path("search/predictive/", views.PredictiveSearchView.as_view(), name="search-predictive"),
    path("fragrance-finder/", views.FragranceFinderView.as_view(), name="fragrance-finder"),

    path("admin/reviews/", views.AdminReviewsView.as_view(), name="admin-reviews-list"),
    path("admin/reviews/<uuid:pk>/", views.AdminReviewsView.as_view(), name="admin-reviews-detail"),

    path("wishlist/", views.WishlistListView.as_view(), name="wishlist-list"),
    path("wishlist/toggle/", views.WishlistToggleView.as_view(), name="wishlist-toggle"),
    path("wishlist/ids/", views.WishlistIdsView.as_view(), name="wishlist-ids"),
]

