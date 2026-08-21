"""Seed a realistic Arabic catalogue for development.

    python manage.py seed_demo [--flush]

Idempotent: re-running updates rather than duplicating.

The owner's password is read from SEED_OWNER_PASSWORD, or generated randomly and
printed once. There is deliberately no default password: a known credential in a
seed script is a security bypass, and this project does not ship those in any
environment for any reason.
"""

import os
import secrets
from decimal import Decimal
from pathlib import Path
from random import Random

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import (
    Category,
    Collection,
    InventoryLog,
    Product,
    ProductCategory,
    ProductCollection,
    ProductImage,
    ProductVariant,
    VariantOption,
    VariantValue,
)
from apps.core.models import City, Region, Role, User
from apps.orders.models import (
    DeliveryMethod,
    Discount,
    DiscountType,
    PaymentMethodConfiguration,
)
from apps.storefront.models import StorefrontLayout, Widget, WidgetType
from apps.storefront.services import normalise_widget_data


def _stable_digest(text: str) -> int:
    """A digest that survives a process restart, unlike the builtin hash()."""
    import hashlib

    return int(hashlib.sha1(text.encode("utf-8")).hexdigest(), 16) % 10000

# (id, name, code, delivery fee, [(region id, region name, fee, days)])
CITIES = [
    ("tripoli", "طرابلس", "TIP", "15.00", [
        ("tripoli-center", "وسط المدينة", "0.00", 1),
        ("gargaresh", "قرقارش", "0.00", 1),
        ("andalus", "حي الأندلس", "5.00", 2),
        ("janzour", "جنزور", "5.00", 2),
        ("tajoura", "تاجوراء", "8.00", 2),
    ]),
    ("benghazi", "بنغازي", "BEN", "25.00", [
        ("benghazi-center", "وسط بنغازي", "0.00", 2),
        ("sabri", "الصابري", "8.00", 3),
        ("hadaeq", "الحدائق", "8.00", 3),
    ]),
    ("misrata", "مصراتة", "MIS", "20.00", [
        ("misrata-center", "وسط مصراتة", "0.00", 2),
        ("zawiyat-mahjoub", "زاوية المحجوب", "6.00", 3),
    ]),
    ("zawiya", "الزاوية", "ZAW", "18.00", [("zawiya-center", "وسط الزاوية", "0.00", 2)]),
    ("zliten", "زليتن", "ZLI", "20.00", [("zliten-center", "وسط زليتن", "0.00", 2)]),
    ("khoms", "الخمس", "KHO", "18.00", [("khoms-center", "وسط الخمس", "0.00", 2)]),
    ("gharyan", "غريان", "GHA", "22.00", [("gharyan-center", "وسط غريان", "0.00", 3)]),
    ("sabratha", "صبراتة", "SAB", "20.00", [("sabratha-center", "وسط صبراتة", "0.00", 2)]),
    ("sirte", "سرت", "SIR", "30.00", [("sirte-center", "وسط سرت", "0.00", 3)]),
    ("ajdabiya", "أجدابيا", "AJD", "32.00", [("ajdabiya-center", "وسط أجدابيا", "0.00", 4)]),
    ("bayda", "البيضاء", "BAY", "35.00", [("bayda-center", "وسط البيضاء", "0.00", 4)]),
    ("derna", "درنة", "DER", "38.00", [("derna-center", "وسط درنة", "0.00", 4)]),
    ("tobruk", "طبرق", "TOB", "40.00", [("tobruk-center", "وسط طبرق", "0.00", 5)]),
    ("sabha", "سبها", "SEB", "45.00", [("sabha-center", "وسط سبها", "0.00", 5)]),
]

# ---------------------------------------------------------------------------
# Catalogue, taken from the live corporate site nasaeemlibya.ly (2026-08-21).
#
# The 13 brands are the ones Nasaeem actually distributes, and each brand's
# logo is the real mark downloaded from that site into frontend/public/brands/.
#
# Product names are seeded ONLY where the live site names them. The site's own
# alt attributes are copy-pasted from the third brand onward — a dozen unrelated
# bottles all read "Rasasi Alwisam" — so filenames were used where they and the
# alt disagree. Five brands ship with no products rather than inventing SKUs;
# that also exercises the empty-category state, which needs a designed screen.
#
# Prices are plausible LYD placeholders, not the real ones. Product imagery is
# still generated tiles: no product photography was downloaded.
# ---------------------------------------------------------------------------

# (slug, arabic name, latin name, logo file)
BRANDS = [
    ("armaf", "أرماف", "Armaf", "armaf.svg"),
    ("afnan", "أفنان", "Afnan", "afnan.svg"),
    ("rasasi", "الرصاصي", "Rasasi", "rasasi.svg"),
    ("assaf", "عساف", "Assaf", "assaf.png"),
    ("rue-broca", "رو بروكا", "Rue Broca", "ruebroca.svg"),
    ("zimaya", "زمايا", "Zimaya", "zimaya.png"),
    ("tad-angel", "تاد أنجل", "Tad Angel", "tadangel.svg"),
    ("estiara", "استيارا", "Estiara", "estiara.svg"),
    ("laverne", "لافيرن", "Laverne", "laverne.png"),
    ("hamidi", "حميدي", "Hamidi", "hamidi.svg"),
    ("smart-collection", "سمارت كوليكشن", "Smart Collection", "smart.svg"),
    ("ebhar", "إبحار", "Ebhar", "ebhar.svg"),
    ("risala", "رسالة", "Risala", "risala.svg"),
]

COLLECTIONS = [
    ("الأكثر مبيعاً", "الأكثر-مبيعا", "المنتجات الأكثر طلباً لدى عملائنا"),
    ("وصل حديثاً", "وصل-حديثا", "أحدث ما وصل إلى المتجر"),
    ("عروض الموسم", "عروض-الموسم", "منتجات مختارة بأسعار مخفّضة"),
]

# name, slug, price, compare_at, brand slug, collections, description, has_variants
PRODUCTS = [
    ("Armaf Club de Nuit Intense", "armaf-club-de-nuit-intense", "380.00", "450.00", "armaf",
     ["الأكثر مبيعاً"], "عطر رجالي شرقي خشبي بنفحات من الأناناس والليمون وقاعدة من العنبر والمسك.", True),
    ("Armaf Odyssey Mandarine Sky", "armaf-odyssey-mandarine-sky", "310.00", None, "armaf",
     ["وصل حديثاً"], "عطر منعش بنفحات الماندرين والزهور البيضاء، مناسب للنهار.", True),
    ("Armaf Tag Him Ummo Nero", "armaf-tag-him-ummo-nero", "265.00", None, "armaf",
     [], "عطر رجالي جريء بمزيج من التوابل والخشب.", False),

    ("Afnan 9pm Rebel", "afnan-9pm-rebel", "295.00", "340.00", "afnan",
     ["الأكثر مبيعاً", "عروض الموسم"], "عطر مسائي دافئ بنفحات الفانيليا والكراميل والتفاح.", True),
    ("Afnan Supremacy Intense", "afnan-supremacy-intense", "320.00", None, "afnan",
     ["وصل حديثاً"], "تركيبة عطرية مركّزة بنفحات فاكهية وخشبية عالية الثبات.", True),
    ("Afnan Turathi Blue", "afnan-turathi-blue", "270.00", None, "afnan",
     [], "عطر شرقي أصيل يجمع بين العود والزعفران.", False),

    ("Rasasi Hawas Ice", "rasasi-hawas-ice", "340.00", None, "rasasi",
     ["الأكثر مبيعاً"], "نسخة منعشة من هواس بنفحات مائية وحمضية.", True),
    ("انتباه من الرصاصي", "انتباه-من-الرصاصي", "225.00", "280.00", "rasasi",
     ["عروض الموسم"], "عطر شرقي كلاسيكي بنفحات من الورد والعود.", False),
    ("الوسام من الرصاصي", "الوسام-من-الرصاصي", "260.00", None, "rasasi",
     [], "عطر رجالي فاخر بمزيج من التوابل والخشب الثمين.", False),

    ("Assaf Frankel Imagination", "assaf-frankel-imagination", "180.00", None, "assaf",
     ["وصل حديثاً"], "عطر معاصر بنفحات زهرية ناعمة.", False),
    ("Assaf Wild Colt", "assaf-wild-colt", "175.00", None, "assaf",
     [], "عطر رجالي بنفحات جلدية وخشبية.", False),
    ("Assaf Miss Flora", "assaf-miss-flora", "165.00", "195.00", "assaf",
     ["عروض الموسم"], "عطر نسائي زهري خفيف مناسب للاستخدام اليومي.", False),

    ("Rue Broca Hooked Azure", "rue-broca-hooked-azure", "150.00", None, "rue-broca",
     [], "عطر منعش بنفحات بحرية وحمضية.", False),
    ("Rue Broca Exotic Heritage", "rue-broca-exotic-heritage", "155.00", None, "rue-broca",
     ["وصل حديثاً"], "مزيج شرقي من التوابل والعنبر.", False),
    ("Rue Broca Nexa Purple", "rue-broca-nexa-purple", "145.00", None, "rue-broca",
     [], "عطر نسائي بنفحات الفواكه الحمراء والفانيليا.", False),

    ("زمايا فاطمة", "زمايا-فاطمة", "210.00", None, "zimaya",
     ["الأكثر مبيعاً"], "عطر نسائي شرقي فاخر بنفحات الورد والمسك.", True),
    ("زمايا إتقان جولد", "زمايا-إتقان-جولد", "240.00", "290.00", "zimaya",
     ["عروض الموسم"], "عطر ذهبي غني بالعود والعنبر.", False),
    ("Zimaya Oscaar", "zimaya-oscaar", "195.00", None, "zimaya",
     [], "عطر رجالي بنفحات خشبية دافئة.", False),

    ("Tad Angel Fleur Blossom", "tad-angel-fleur-blossom", "130.00", None, "tad-angel",
     ["وصل حديثاً"], "عطر زهري ربيعي خفيف.", False),
    ("Tad Angel Blue Nuit", "tad-angel-blue-nuit", "135.00", None, "tad-angel",
     [], "عطر مسائي أزرق بنفحات عطرية منعشة.", False),
    ("Tad Angel Pathway", "tad-angel-pathway", "125.00", "150.00", "tad-angel",
     ["عروض الموسم"], "عطر يومي متوازن بين الحمضيات والخشب.", False),

    ("Estiara Stag 2", "estiara-stag-2", "115.00", None, "estiara",
     [], "عطر رجالي عملي بثبات جيد وسعر مناسب.", False),
    ("Estiara Stag White", "estiara-stag-white", "115.00", None, "estiara",
     ["وصل حديثاً"], "النسخة البيضاء الأخف من ستاج.", False),
]

SIZE_VALUES = ["50 مل", "100 مل"]

DELIVERY_METHODS = [
    ("فانكس", "vanex", "شركة فانكس للشحن السريع"),
    ("نورس", "nawres", "شركة نورس للتوصيل"),
    ("درب السبيل", "darb_sabeel", "شركة درب السبيل للتوصيل"),
]

PAYMENT_METHODS = [
    ("moamalat", "بطاقة مصرفية (معاملات)", "الدفع ببطاقة محلية عبر بوابة معاملات", 1),
    ("plutu", "بلوتو", "سداد، أضفلي، ومحافظ محلية عبر بلوتو", 2),
    ("sadad_pay", "سداد", "الدفع المباشر عبر سداد", 3),
    ("binance_pay", "باينانس باي", "الدفع بالعملات الرقمية", 4),
    ("manual_payment", "تحويل مصرفي", "حوّل المبلغ وأرفق إيصال التحويل", 5),
    ("bank_cards_on_delivery", "بطاقة عند الاستلام", "الدفع ببطاقة مصرفية عند التسليم", 6),
]


class Command(BaseCommand):
    help = "يزرع بيانات تجريبية واقعية: مدن، تصنيفات، منتجات، وحساب مالك"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="احذف بيانات الكتالوج قبل الزرع",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        rng = Random(20260821)  # deterministic: same seed data every run

        if options["flush"]:
            self.stdout.write("حذف بيانات الكتالوج الحالية…")
            Widget.objects.all().delete()
            StorefrontLayout.objects.all().delete()
            ProductImage.objects.all().delete()
            ProductVariant.objects.all().delete()
            ProductCategory.objects.all().delete()
            ProductCollection.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()
            Collection.objects.all().delete()

        owner = self._seed_owner()
        self._seed_geography()
        categories = self._seed_categories()
        collections = self._seed_collections()
        size_option, size_values = self._seed_variant_options()
        products = self._seed_products(categories, collections, size_option, size_values, owner, rng)
        self._seed_images(products)
        self._seed_delivery_and_payments()
        self._seed_discounts(products)
        self._seed_layout(products, categories, collections)

        self.stdout.write(self.style.SUCCESS(
            f"\nتم: {City.objects.count()} مدينة · {Region.objects.count()} منطقة · "
            f"{Category.objects.count()} تصنيف · {Product.objects.count()} منتج · "
            f"{ProductVariant.objects.count()} خيار · {ProductImage.objects.count()} صورة"
        ))

    # ------------------------------------------------------------------ owner

    def _seed_owner(self):
        phone = os.environ.get("SEED_OWNER_PHONE", "0910000000")
        user = User.objects.filter(phone_number=phone).first()
        if user:
            self.stdout.write(f"حساب المالك موجود: {phone}")
            return user

        password = os.environ.get("SEED_OWNER_PASSWORD")
        generated = password is None
        if generated:
            password = secrets.token_urlsafe(12)

        user = User.objects.create_superuser(
            phone_number=phone, password=password, name="مالك المتجر", role=Role.OWNER
        )
        user.phone_verified = True
        user.save(update_fields=["phone_verified"])

        self.stdout.write(self.style.WARNING(f"\nحساب المالك: {phone}"))
        if generated:
            self.stdout.write(self.style.WARNING(f"كلمة المرور (تُعرض مرة واحدة): {password}\n"))
        return user

    # -------------------------------------------------------------- geography

    def _seed_geography(self):
        for city_id, name, code, fee, regions in CITIES:
            city, _ = City.objects.update_or_create(
                id=city_id,
                defaults={"name": name, "code": code, "delivery_fee": Decimal(fee), "is_active": True},
            )
            for region_id, region_name, region_fee, days in regions:
                Region.objects.update_or_create(
                    id=region_id,
                    defaults={
                        "name": region_name,
                        "city": city,
                        "delivery_fee": Decimal(region_fee),
                        "estimated_delivery_days": days,
                        "is_active": True,
                    },
                )
        self.stdout.write(f"المدن: {City.objects.count()} · المناطق: {Region.objects.count()}")

    # ------------------------------------------------------------- catalogue

    def _seed_categories(self):
        """Brands are the top-level browse axis — that is how a perfume
        distributor's storefront actually works. `image_url` points at the real
        mark downloaded from the live site."""
        created = {}
        for slug, arabic_name, latin_name, logo in BRANDS:
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": arabic_name,
                    "description": f"منتجات {arabic_name} ({latin_name})",
                    "image_url": f"/brands/{logo}",
                    "parent": None,
                    "is_active": True,
                },
            )
            created[slug] = category
        return created

    def _seed_collections(self):
        created = {}
        for name, slug, description in COLLECTIONS:
            collection, _ = Collection.objects.update_or_create(
                slug=slug, defaults={"name": name, "description": description, "is_active": True}
            )
            created[name] = collection
        return created

    def _seed_variant_options(self):
        option, _ = VariantOption.objects.get_or_create(name="الحجم")
        values = [VariantValue.objects.get_or_create(option=option, value=v)[0] for v in SIZE_VALUES]
        return option, values

    def _seed_products(self, categories, collections, size_option, size_values, owner, rng):
        products = []
        for name, slug, price, compare_at, brand_slug, collection_names, description, has_variants in PRODUCTS:
            product, _ = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "description": description,
                    "price": Decimal(price),
                    "compare_at_price": Decimal(compare_at) if compare_at else None,
                    # NOT `hash(slug)`: Python randomises str hashing per
                    # process (PYTHONHASHSEED), so every seed run produced a
                    # different SKU, which in turn made the variant
                    # get_or_create(sku=…) below create a whole new set of
                    # variants each time — 12 → 26 → 36 across three runs.
                    "sku": f"NL-{brand_slug[:4].upper()}-{_stable_digest(slug):04d}",
                    "is_active": True,
                    "has_variants": has_variants,
                    "track_quantity": True,
                    "stock": 0 if has_variants else rng.choice([0, 3, 12, 25, 40]),
                    "reserved_stock": 0,
                    "meta_title": f"{name} | نسائم ليبيا",
                    "meta_description": description[:160],
                },
            )
            ProductCategory.objects.get_or_create(product=product, category=categories[brand_slug])
            for collection_name in collection_names:
                ProductCollection.objects.get_or_create(
                    product=product, collection=collections[collection_name]
                )

            if has_variants:
                base = Decimal(price)
                for index, value in enumerate(size_values):
                    variant, created = ProductVariant.objects.get_or_create(
                        product=product,
                        sku=f"{product.sku}-{index + 1}",
                        defaults={
                            "price": (base * (Decimal("0.65") + Decimal(index) * Decimal("0.35"))).quantize(Decimal("0.01")),
                            "stock": rng.choice([0, 5, 15, 30]),
                            "is_active": True,
                        },
                    )
                    if created:
                        variant.values.set([value])
                        if variant.stock:
                            InventoryLog.objects.create(
                                product=product, variant=variant, change=variant.stock,
                                reason=InventoryLog.Reason.RESTOCK, note="بيانات تجريبية", user=owner,
                            )
            elif product.stock:
                InventoryLog.objects.filter(product=product, variant=None).exists() or InventoryLog.objects.create(
                    product=product, change=product.stock,
                    reason=InventoryLog.Reason.RESTOCK, note="بيانات تجريبية", user=owner,
                )
            products.append(product)
        return products

    # ----------------------------------------------------------------- images

    def _seed_images(self, products):
        """Generated placeholder tiles, not product photography.

        There are no real product images anywhere in reference/ — only the brand
        logo and payment provider marks. These are abstract gradients so the
        catalogue is browsable and layout/CLS work can proceed; every one is
        obviously a placeholder and must be replaced before launch.
        """
        try:
            from PIL import Image, ImageDraw
        except ImportError:  # pragma: no cover
            self.stdout.write(self.style.WARNING("Pillow غير مثبت — تم تخطي الصور"))
            return

        media = Path(settings.MEDIA_ROOT) / "products"
        media.mkdir(parents=True, exist_ok=True)
        renditions = {"thumb": 200, "medium": 600, "full": 1200}

        palette = [
            ((68, 73, 67), (215, 231, 187)),
            ((90, 74, 58), (232, 213, 183)),
            ((58, 74, 78), (196, 224, 229)),
            ((84, 62, 74), (231, 205, 219)),
        ]

        for index, product in enumerate(products):
            # Every third product gets three images rather than one, so the
            # gallery's swipe, dots and thumbnails are reachable at all. A
            # single-image catalogue leaves that whole component unexercised.
            shots = 3 if index % 3 == 0 else 1

            for shot in range(shots):
                top, bottom = palette[(index + shot) % len(palette)]
                suffix = "" if shot == 0 else f"-{shot + 1}"
                self._draw_tile(media, f"{product.slug}{suffix}", renditions, top, bottom)
                ProductImage.objects.get_or_create(
                    product=product,
                    sort_order=shot,
                    defaults={
                        "url": f"{settings.MEDIA_URL}products/{product.slug}{suffix}-full.webp",
                        "alt_text": f"{product.name} — صورة {shot + 1}" if shot else product.name,
                    },
                )

    def _draw_tile(self, media, stem, renditions, top, bottom):
        from PIL import Image, ImageDraw

        for name, size in renditions.items():
            path = media / f"{stem}-{name}.webp"
            if path.exists():
                continue
            image = Image.new("RGB", (size, size), top)
            draw = ImageDraw.Draw(image)
            for y in range(size):
                ratio = y / size
                draw.line(
                    [(0, y), (size, y)],
                    fill=tuple(int(top[c] + (bottom[c] - top[c]) * ratio) for c in range(3)),
                )
            radius = size // 4
            centre = size // 2
            draw.ellipse(
                [centre - radius, centre - radius, centre + radius, centre + radius],
                outline=bottom, width=max(2, size // 100),
            )
            image.save(path, "WEBP", quality=82, method=4)

    # ------------------------------------------------------ delivery/payments

    def _seed_delivery_and_payments(self):
        for name, code, description in DELIVERY_METHODS:
            DeliveryMethod.objects.update_or_create(
                code=code,
                defaults={"name": name, "description": description, "is_active": code == "vanex"},
            )
        for code, display_name, description, order in PAYMENT_METHODS:
            PaymentMethodConfiguration.objects.update_or_create(
                method_code=code,
                defaults={
                    "display_name": display_name,
                    "description": description,
                    "sort_order": order,
                    # Disabled until an operator adds real credentials. No secret
                    # is ever seeded.
                    "is_enabled": False,
                    "config_data": {},
                },
            )

    def _seed_discounts(self, products):
        now = timezone.now()
        Discount.objects.update_or_create(
            code="NASAIM10",
            defaults={
                "name": "خصم الترحيب",
                "description": "خصم 10% على أول طلب",
                "type": DiscountType.PERCENTAGE,
                "percentage": Decimal("10.00"),
                "value": Decimal("0.00"),
                "is_active": True,
                "start_date": now - timezone.timedelta(days=1),
                "end_date": now + timezone.timedelta(days=90),
                "min_order_amount": Decimal("100.00"),
                "max_discount_amount": Decimal("100.00"),
                "usage_limit": 500,
            },
        )
        expired, _ = Discount.objects.update_or_create(
            code="EXPIRED50",
            defaults={
                "name": "خصم منتهٍ",
                "description": "للاختبار: خصم منتهي الصلاحية",
                "type": DiscountType.FIXED,
                "value": Decimal("50.00"),
                "percentage": Decimal("0.00"),
                "is_active": True,
                "start_date": now - timezone.timedelta(days=60),
                "end_date": now - timezone.timedelta(days=30),
            },
        )
        expired.products.set(products[:2])

    # ----------------------------------------------------------------- layout

    def _seed_layout(self, products, categories, collections):
        layout, _ = StorefrontLayout.objects.update_or_create(
            name="التخطيط الافتراضي",
            defaults={"is_global_active": True, "active_days": []},
        )
        featured = [str(p.id) for p in products[:6]]
        # All 14 types are seeded deliberately: Phase 4's gate is "all 14 widget
        # types render", and a gate you cannot reach is not a gate. The images
        # are the real brand marks already in frontend/public/brands/.
        widgets = [
            (WidgetType.ANNOUNCEMENT_BAR, {
                "title": "توصيل لكل ليبيا",
                "message": "توصيل إلى جميع المدن الليبية خلال 1–5 أيام",
                "linkLabel": "تسوّق الآن", "linkUrl": "/products",
                "dismissible": True, "icon": "megaphone",
            }),
            (WidgetType.HERO_CTA, {
                "title": "نسائم ليبيا",
                "subtitle": "أرماف · أفنان · الرصاصي · وأكثر من 13 علامة عالمية",
                "buttonLabel": "تصفّح المتجر", "buttonUrl": "/products",
                "alignment": "center", "backgroundImageUrl": "",
            }),
            (WidgetType.CAROUSEL, {
                "carouselStyle": "hero",
                "slides": [
                    {"imageUrl": "/brands/armaf.svg", "linkUrl": "/categories/armaf",
                     "title": "أرماف", "subtitle": "عطور شرقية فاخرة"},
                    {"imageUrl": "/brands/afnan.svg", "linkUrl": "/categories/afnan",
                     "title": "أفنان", "subtitle": "مجموعة 2026"},
                    {"imageUrl": "/brands/rasasi.svg", "linkUrl": "/categories/rasasi",
                     "title": "الرصاصي", "subtitle": "الأكثر طلباً"},
                ],
            }),
            (WidgetType.CATEGORY_LIST, {
                "title": "تسوّق حسب العلامة التجارية",
                "categoryIds": [str(categories[s].id) for s in ("armaf", "afnan", "rasasi", "zimaya")],
                "layout": "grid",
            }),
            (WidgetType.PRODUCT_LIST, {
                "title": "الأكثر مبيعاً", "productIds": featured, "layout": "slider",
            }),
            (WidgetType.TEXT_BLOCK, {
                "content": "نسائم ليبيا لاستيراد العطور — مصراتة، منذ 2015. "
                           "بيع بالجملة والتجزئة، وتوصيل إلى جميع المدن الليبية.",
            }),
            (WidgetType.PHOTO_LINK_GRID, {
                "title": "اكتشف المزيد",
                "items": [
                    {"imageUrl": "/brands/zimaya.png", "linkUrl": "/categories/zimaya", "label": "زمايا"},
                    {"imageUrl": "/brands/estiara.svg", "linkUrl": "/categories/estiara", "label": "استيارا"},
                    {"imageUrl": "/brands/tadangel.svg", "linkUrl": "/categories/tadangel", "label": "تاد أنجل"},
                    {"imageUrl": "/brands/ruebroca.svg", "linkUrl": "/categories/ruebroca", "label": "رو بروكا"},
                ],
            }),
            (WidgetType.COLLECTION_SHOWCASE, {
                "collectionId": str(collections["عروض الموسم"].id), "layout": "grid",
            }),
            (WidgetType.SPACER, {"height": "lg"}),
            (WidgetType.IMAGE, {
                "imageUrl": "/brand/logo.svg",
                "altText": "شعار نسائم ليبيا",
                "linkUrl": "/products",
            }),
            (WidgetType.RECENTLY_VIEWED, {"title": "شوهدت مؤخراً", "limit": 8, "layout": "slider"}),
            (WidgetType.BUY_AGAIN, {"title": "اشترِ مجدداً", "limit": 8, "layout": "slider"}),
            (WidgetType.RECOMMENDED_FOR_YOU, {"title": "مقترح لك", "limit": 8, "layout": "grid"}),
            (WidgetType.TRENDING_NEAR_YOU, {"title": "رائج في منطقتك", "limit": 8, "layout": "slider"}),
        ]
        # The demo layout is rebuilt to a fixed state on every run — which is
        # what idempotent means here. Operator-authored layouts are untouched:
        # only the layout named "التخطيط الافتراضي" is rewritten.
        layout.widgets.all().delete()
        for order, (widget_type, data) in enumerate(widgets):
            Widget.objects.create(
                layout=layout, type=widget_type,
                data=normalise_widget_data(widget_type, data),
                order=order, is_active=True,
            )
