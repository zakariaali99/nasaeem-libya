"""What a shopper may see.

A product is on the store only when it is switched on itself AND every category
it sits in (with every parent above it — a brand is a root category) AND every
collection it sits in is switched on. Hiding a brand never touches the
products' own switch: showing the brand again brings each product back exactly
as it was, and a product hidden on its own stays hidden.

Every storefront read of products, categories or collections goes through
here, so there is one rule and one place to change it. The category table is
small, so the tree is walked in Python — no recursive SQL, which SQLite on the
live server would make awkward.
"""

from apps.core.language import forget

from .models import Category, Collection, Product


def hidden_categories() -> dict:
    """`{category_id: name of the category that was switched off}` for every
    category the shopper must not see: the switched-off ones and everything
    below them. The name is what the dashboard shows as «مخفي بسبب: …»."""
    rows = {
        pk: (parent_id, is_active, name)
        for pk, parent_id, is_active, name in Category.objects.values_list(
            "id", "parent_id", "is_active", "name"
        )
    }
    reasons = {}

    def reason(pk):
        # Walk up to the nearest switched-off category. `seen` guards a
        # parent loop someone may have saved by hand in the Django admin.
        seen = set()
        while pk is not None and pk in rows and pk not in seen:
            seen.add(pk)
            parent_id, is_active, name = rows[pk]
            if not is_active:
                return name
            pk = parent_id
        return None

    for pk in rows:
        name = reason(pk)
        if name is not None:
            reasons[pk] = name
    return reasons


def hidden_collections() -> dict:
    return dict(Collection.objects.filter(is_active=False).values_list("id", "name"))


def visible_products(queryset):
    queryset = queryset.filter(is_active=True)
    if hidden := hidden_categories():
        queryset = queryset.exclude(categories__in=list(hidden))
    if hidden := hidden_collections():
        queryset = queryset.exclude(collections__in=list(hidden))
    return queryset


def visible_categories(queryset):
    return queryset.exclude(id__in=list(hidden_categories()))


def visible_collections(queryset):
    return queryset.filter(is_active=True)


def is_product_visible(product) -> bool:
    return visible_products(Product.objects.filter(pk=product.pk)).exists()


def hidden_by(product, categories=None, collections=None) -> list:
    """Why a product is off the store, for the dashboard badge. Empty when it
    is visible. Reads the prefetched categories/collections."""
    categories = hidden_categories() if categories is None else categories
    collections = hidden_collections() if collections is None else collections
    reasons = []
    if not product.is_active:
        reasons.append("المنتج نفسه")
    for category in product.categories.all():
        name = categories.get(category.id)
        if name and name not in reasons:
            reasons.append(name)
    for collection in product.collections.all():
        name = collections.get(collection.id)
        if name and name not in reasons:
            reasons.append(name)
    return reasons


def forget_product_pages():
    """Drop every cached product page. A product page is cached for hours, and
    hiding a brand changes what those pages may show (bundles, links)."""
    keys = ["store:categories:tree"]
    for pk, slug in Product.objects.values_list("id", "slug"):
        keys.append(f"store:product:{pk}")
        if slug:
            keys.append(f"store:product:{slug}")
    forget(*keys)  # both languages
