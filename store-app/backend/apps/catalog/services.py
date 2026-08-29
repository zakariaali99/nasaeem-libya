"""
Catalogue business logic.

Everything that mutates stock goes through `adjust_stock()`, which always writes
an `InventoryLog` row. There is no other supported way to change a stock level —
if a code path sets `product.stock` directly, inventory history silently lies.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from itertools import product as cartesian_product
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils.text import slugify

from .models import InventoryLog, Product, ProductVariant, VariantValue

RENDITIONS = {"thumb": 200, "medium": 600, "full": 1200}


class StockError(Exception):
    """Raised when an adjustment would drive available stock negative."""


# --------------------------------------------------------------------------
# Slugs
# --------------------------------------------------------------------------

def unique_slug(model, name, instance=None, max_length=100):
    """Arabic-safe slug, uniquified with a numeric suffix.

    `allow_unicode=True` is not optional: `slugify('عود ملكي')` without it
    returns an empty string, and every Arabic product would collide on ''.
    """
    base = slugify(name, allow_unicode=True)[:max_length] or uuid.uuid4().hex[:8]
    slug = base
    index = 2
    queryset = model.objects.all()
    if instance is not None and instance.pk:
        queryset = queryset.exclude(pk=instance.pk)
    while queryset.filter(slug=slug).exists():
        suffix = f"-{index}"
        slug = f"{base[: max_length - len(suffix)]}{suffix}"
        index += 1
    return slug


# --------------------------------------------------------------------------
# Inventory
# --------------------------------------------------------------------------

@dataclass
class StockChange:
    product: Product
    variant: ProductVariant | None
    change: int
    reason: str
    note: str = ""
    user: object | None = None


@transaction.atomic
def adjust_stock(*, product, variant=None, change, reason, note="", user=None, allow_negative=False):
    """Applies a signed change and records it. Locks the row it touches.

    Returns the refreshed target (variant when given, otherwise product).
    """
    if change == 0:
        raise StockError("قيمة التعديل يجب ألا تساوي صفراً")

    target_model = ProductVariant if variant is not None else Product
    target_pk = variant.pk if variant is not None else product.pk
    locked = target_model.objects.select_for_update().get(pk=target_pk)

    new_stock = locked.stock + change
    if new_stock < 0 and not allow_negative:
        raise StockError("لا يمكن أن يصبح المخزون بالسالب")
    if new_stock - locked.reserved_stock < 0 and not allow_negative:
        raise StockError("لا يمكن تخفيض المخزون إلى ما دون الكمية المحجوزة")

    locked.stock = new_stock
    locked.save(update_fields=["stock", "updated_at"])

    InventoryLog.objects.create(
        product=product,
        variant=variant,
        change=change,
        reason=reason,
        note=note,
        user=user if (user is not None and getattr(user, "is_authenticated", False)) else None,
    )
    return locked


@transaction.atomic
def set_stock(*, product, variant=None, quantity, reason, note="", user=None):
    """Sets an absolute level by computing the delta, so the log still records a
    signed change rather than an opaque overwrite."""
    current = (variant or product).stock
    delta = quantity - current
    if delta == 0:
        return variant or product
    return adjust_stock(
        product=product, variant=variant, change=delta, reason=reason, note=note, user=user
    )


def reserve_stock(*, product, variant=None, quantity):
    """Increments `reserved_stock`. Checkout owns the locking; this is the
    arithmetic it delegates to."""
    target = variant or product
    type(target).objects.filter(pk=target.pk).update(
        reserved_stock=F("reserved_stock") + quantity
    )


def release_stock(*, product, variant=None, quantity):
    target = variant or product
    type(target).objects.filter(pk=target.pk).update(
        reserved_stock=F("reserved_stock") - quantity
    )


# --------------------------------------------------------------------------
# Variant matrix
# --------------------------------------------------------------------------

def generate_variant_matrix(*, product, value_groups, defaults=None):
    """Creates one variant per combination across the supplied option groups.

    `value_groups` is a list of lists of VariantValue ids, one list per option.
    Existing combinations are left alone, so re-running after adding a value
    only creates what is missing.
    """
    defaults = defaults or {}
    groups = [
        list(VariantValue.objects.filter(id__in=ids).select_related("option"))
        for ids in value_groups
        if ids
    ]
    if not groups:
        return []

    existing = {
        frozenset(str(v) for v in variant.values.values_list("id", flat=True)): variant
        for variant in product.variants.prefetch_related("values")
    }

    created = []
    for combination in cartesian_product(*groups):
        key = frozenset(str(value.id) for value in combination)
        if key in existing:
            continue
        variant = ProductVariant.objects.create(
            product=product,
            price=defaults.get("price", product.price),
            stock=defaults.get("stock", 0),
            sku=defaults.get("sku", ""),
            is_active=True,
        )
        variant.values.set(combination)
        created.append(variant)

    if created and not product.has_variants:
        product.has_variants = True
        product.save(update_fields=["has_variants", "updated_at"])
    return created


# --------------------------------------------------------------------------
# Images
# --------------------------------------------------------------------------

def rendition_urls(url):
    """thumb/medium/full URLs derived from a stored image url by convention.

    The renditions are files on disk, not columns — `02-data-model.md` gives
    ProductImage only a single `url`. The client needs all three to build a
    `srcset`, so the mapping lives here rather than being guessed client-side.
    """
    if not url:
        return {}
    path = Path(url)
    stem = path.stem
    for name in RENDITIONS:
        if stem.endswith(f"-{name}"):
            stem = stem[: -(len(name) + 1)]
            break
    parent = str(path.parent)
    return {
        name: f"{parent}/{stem}-{name}{path.suffix}" if parent not in (".", "") else f"{stem}-{name}{path.suffix}"
        for name in RENDITIONS
    }


def store_image(uploaded_file, *, subdir="products"):
    """Saves an upload and writes thumb/medium/full WebP renditions.

    Returns the `full` URL, which is what `ProductImage.url` stores.
    """
    import io
    import logging
    from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError

    logger = logging.getLogger(__name__)

    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except Exception:
        pass

    try:
        import pillow_avif  # noqa: F401
    except Exception:
        pass

    ImageFile.LOAD_TRUNCATED_IMAGES = True

    try:
        if hasattr(uploaded_file, "read"):
            uploaded_file.seek(0)
            content = uploaded_file.read()
        elif isinstance(uploaded_file, (bytes, bytearray)):
            content = uploaded_file
        else:
            raise ValueError("الملف غير صالح")

        if not content:
            raise ValueError("الملف المرفوع فارغ")

        image = Image.open(io.BytesIO(content))
        image.load()
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            pass
    except Exception as exc:
        logger.warning("store_image validation failed: %s (%s)", exc, type(exc))
        raise ValueError("الملف ليس صورة صالحة") from exc

    # Cleanly convert transparent formats onto a crisp white background
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        bg = Image.new("RGB", image.size, (255, 255, 255))
        rgba = image.convert("RGBA")
        bg.paste(rgba, mask=rgba.split()[3])
        image = bg
    elif image.mode != "RGB":
        image = image.convert("RGB")

    directory = Path(settings.MEDIA_ROOT) / subdir
    directory.mkdir(parents=True, exist_ok=True)
    stem = uuid.uuid4().hex

    for name, size in RENDITIONS.items():
        rendition = image.copy()
        rendition.thumbnail((size, size), Image.LANCZOS)
        rendition.save(directory / f"{stem}-{name}.webp", "WEBP", quality=85, method=4)

    return f"{settings.MEDIA_URL}{subdir}/{stem}-full.webp"


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------

# Arabic orthography is written several ways for the same word. These three
# rules are applied identically to the stored text and to the query so that
# عِطْر, عطر and العطر all meet:
#
#   1. strip the harakat and tatweel      U+064B–U+0652 and U+0640
#   2. unify the alef forms  أ إ آ ٱ → ا
#   3. unify  ى / ی → ي
#
# PostgreSQL's `unaccent` does NOT do this — measured, not assumed:
#     SELECT unaccent('عِطْر') = 'عطر';  ->  f
# so it is not used here. There is also no Arabic text-search *configuration*
# in PostgreSQL; `simple` is chosen deliberately, because English stemming
# would mangle Arabic tokens.
ARABIC_NORMALISERS = (
    (r"[ً-ْـ]", ""),
    (r"[أإآٱ]", "ا"),
    (r"[ىی]", "ي"),
)


def normalise_arabic(text: str) -> str:
    import re as _re

    for pattern, replacement in ARABIC_NORMALISERS:
        text = _re.sub(pattern, replacement, text)
    return text.strip()


def _normalised_column(field):
    """The same three rules, applied in SQL to a column."""
    from django.db.models import Func, TextField, Value
    from django.db.models.functions import Coalesce

    # `name` is a CharField and `description` a TextField; without an explicit
    # output_field Django refuses to combine them ("mixed types").
    expression = Coalesce(field, Value(""), output_field=TextField())
    for pattern, replacement in ARABIC_NORMALISERS:
        expression = Func(
            expression, Value(pattern), Value(replacement), Value("g"),
            function="regexp_replace", output_field=TextField(),
        )
    return expression


def search_products(queryset, term):
    """Full-text over name + description, with trigram similarity unioned in.

    Full-text alone misses partial words — a shopper typing "عو" for "عود" gets
    nothing back — so trigram similarity carries the prefix case and the two are
    ranked together. `pg_trgm` is created by the Phase 0 database setup.
    """
    from django.db import connection
    from django.db.models import Q

    term = normalise_arabic((term or "").strip())
    if not term:
        return queryset

    if connection.vendor != "postgresql":
        return queryset.filter(
            Q(name__icontains=term)
            | Q(description__icontains=term)
            | Q(sku__icontains=term)
        )

    from django.contrib.postgres.search import (
        SearchQuery,
        SearchRank,
        SearchVector,
        TrigramSimilarity,
    )
    from django.db.models import F, Value
    from django.db.models.functions import Greatest

    name = _normalised_column(F("name"))
    description = _normalised_column(F("description"))

    vector = SearchVector(name, weight="A", config="simple") + SearchVector(
        description, weight="B", config="simple"
    )
    query = SearchQuery(term, config="simple", search_type="plain")

    return (
        queryset.annotate(
            norm_name=name,
            norm_description=description,
            document=vector,
            rank=SearchRank(vector, query),
            similarity=TrigramSimilarity(name, Value(term)),
        )
        .filter(
            # `document=query` compiles to `@@`, which is the real match.
            # Filtering on `rank > 0` looks equivalent and is not: ts_rank
            # returns 1e-20 for a document that does not match at all, so every
            # search matched every product — caught by an existing test
            # asserting that "لا-يوجد" finds nothing.
            Q(document=query)
            | Q(similarity__gt=0.15)
            | Q(norm_name__icontains=term)
            | Q(norm_description__icontains=term)
            | Q(sku__icontains=term)
        )
        .annotate(relevance=Greatest("rank", "similarity"))
    )
