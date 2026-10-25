"""Arabic search normalization, bilingual transliteration, and fragrance finder engine.
"""

import re
import unicodedata
from decimal import Decimal
from django.db.models import Q

from .models import Category, Collection, Product
from .visibility import visible_categories, visible_products

# Bilingual dictionary mapping Arabic <-> Latin perfume brand and olfactory terms
TRANSLITERATION_MAP = {
    "dior": ["ديور"],
    "ديور": ["dior"],
    "creed": ["كريد", "كريد افينتوس"],
    "كريد": ["creed"],
    "sauvage": ["سوفاج", "سافاج"],
    "سوفاج": ["sauvage"],
    "armaf": ["ارماف", "أرماف", "كلوب دي نوي"],
    "ارماف": ["armaf"],
    "أرماف": ["armaf"],
    "lattafa": ["لطافة", "لطافه"],
    "لطافة": ["lattafa"],
    "chanel": ["شانيل"],
    "شانيل": ["chanel"],
    "tom ford": ["توم فورد", "تومفورد"],
    "توم فورد": ["tom ford"],
    "oud": ["عود", "العود"],
    "عود": ["oud"],
    "musk": ["مسك", "المسك"],
    "مسك": ["musk"],
    "amber": ["عنبر", "العنبر"],
    "عنبر": ["amber"],
    "vanilla": ["فانيليا", "فانيلا"],
    "فانيليا": ["vanilla"],
    "citrus": ["حمضيات", "حمضي", "برغموت"],
    "برغموت": ["citrus", "bergamot"],
    "leather": ["جلد", "جلود", "ليذر"],
    "ورد": ["rose", "زهري"],
    "rose": ["ورد", "زهري"],
}

# No search log exists, so there is nothing to call "most searched". The list
# used to be seven invented phrases, most of which returned no products.
TRENDING_SEARCH_KEYWORDS: list[str] = []


def normalize_arabic_text(text: str) -> str:
    """Normalize Arabic text by removing tashkeel and standardizing character variants."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    # Remove Arabic diacritics
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)
    # Normalize Alefs
    text = re.sub(r"[إأآٱ]", "ا", text)
    # Normalize Teh Marbuta
    text = re.sub(r"ة", "ه", text)
    # Normalize Alef Maksura & Yeh
    text = re.sub(r"ى", "ي", text)
    return text.strip().lower()


def expand_search_terms(query: str) -> list[str]:
    """Expand query with transliterated synonyms."""
    norm_q = normalize_arabic_text(query)
    terms = {norm_q, query.strip().lower()}
    for key, mapped in TRANSLITERATION_MAP.items():
        norm_key = normalize_arabic_text(key)
        if norm_key in norm_q or norm_q in norm_key:
            for item in mapped:
                terms.add(normalize_arabic_text(item))
                terms.add(item.lower())
    return list(terms)


def perform_predictive_search(query: str):
    """Execute predictive instant search returning products, categories, collections."""
    if not query or len(query.strip()) < 2:
        return {
            "trending_keywords": TRENDING_SEARCH_KEYWORDS,
            "matched_categories": [],
            "matched_collections": [],
            "products": [],
        }

    terms = expand_search_terms(query)

    # Build Q filters
    product_q = Q(is_active=True)
    sub_q = Q()
    for term in terms:
        sub_q |= (
            Q(name__icontains=term)
            | Q(description__icontains=term)
            | Q(sku__icontains=term)
            | Q(categories__name__icontains=term)
            | Q(collections__name__icontains=term)
        )
    product_q &= sub_q

    products = (
        visible_products(Product.objects.filter(product_q))
        .prefetch_related("images", "categories", "collections", "discounts", "variants")
        .distinct()[:8]
    )

    # Categories
    cat_q = Q(is_active=True)
    cat_sub = Q()
    for term in terms:
        cat_sub |= Q(name__icontains=term) | Q(description__icontains=term)
    cat_q &= cat_sub
    categories = visible_categories(Category.objects.filter(cat_q))[:4]

    # Collections
    col_q = Q(is_active=True)
    col_sub = Q()
    for term in terms:
        col_sub |= Q(name__icontains=term) | Q(description__icontains=term)
    col_q &= col_sub
    collections = Collection.objects.filter(col_q)[:3]

    from .serializers import CategorySerializer, CollectionSerializer, ProductListSerializer

    return {
        "trending_keywords": TRENDING_SEARCH_KEYWORDS,
        "matched_categories": CategorySerializer(categories, many=True).data,
        "matched_collections": CollectionSerializer(collections, many=True).data,
        "products": ProductListSerializer(products, many=True).data,
    }


def find_fragrance_recommendations(gender: str = "ALL", vibe: str = "ORIENTAL", occasion: str = "EVENING", max_budget: float = None):
    """AI Fragrance Finder: Match the most suitable 3 perfumes with personalized justification."""
    queryset = (
        visible_products(Product.objects.all())
        .prefetch_related("images", "categories", "collections", "discounts", "variants")
    )

    # If budget specified
    if max_budget and max_budget > 0:
        queryset = queryset.filter(price__lte=Decimal(str(max_budget)))

    # Match by gender if specified
    if gender and gender.upper() in ["MEN", "WOMEN"]:
        queryset = queryset.filter(
            Q(perfume_details__gender=gender.upper()) | Q(perfume_details__gender="UNISEX") | Q(perfume_details__isnull=True)
        )

    # Match by olfactory family / vibe
    vibe_map = {
        "ORIENTAL": ["عود", "عنبر", "بخور", "شرقي", "توابل"],
        "FRESH": ["حمضيات", "صيف", "برغموت", "بحر", "منعش", "ليمون"],
        "WARM": ["فانيليا", "مسك", "تونكا", "دافئ", "حلو"],
        "WOODY": ["خشب", "صندل", "جلد", "أرز", "رسمي"],
    }

    keywords = vibe_map.get(vibe.upper(), ["عود", "عنبر", "فاخر"])
    vibe_filter = Q()
    for kw in keywords:
        vibe_filter |= (
            Q(name__icontains=kw)
            | Q(description__icontains=kw)
            | Q(categories__name__icontains=kw)
            | Q(collections__name__icontains=kw)
            | Q(perfume_details__fragrance_family__icontains=kw)
        )

    matched = list(queryset.filter(vibe_filter).distinct()[:3])
    exact = len(matched)

    # Fallback to general active products if less than 3 matched
    if len(matched) < 3:
        existing_ids = [p.id for p in matched]
        fallback = list(queryset.exclude(id__in=existing_ids)[: 3 - len(matched)])
        matched.extend(fallback)

    from .serializers import ProductListSerializer

    serialized_products = ProductListSerializer(matched, many=True).data

    # No score and no "why it suits you": both used to be fixed strings (97%,
    # 93%, 89% and one sentence per scent family), whatever was matched.
    results = [
        {"product": item, "vibe_label": vibe, "exact": index < exact}
        for index, item in enumerate(serialized_products)
    ]

    return results
