import sys
from decimal import Decimal
from django.db import migrations

LIBYAN_CITIES = [
    ("tripoli", "طرابلس", "TIP", Decimal("15.00")),
    ("benghazi", "بنغازي", "BEN", Decimal("25.00")),
    ("misrata", "مصراتة", "MRA", Decimal("20.00")),
    ("zawiya", "الزاوية", "ZAW", Decimal("15.00")),
    ("zliten", "زليتن", "ZLI", Decimal("20.00")),
    ("khoms", "الخمس", "KHO", Decimal("18.00")),
    ("sabratha", "صبراتة", "SAB", Decimal("18.00")),
    ("surman", "صرمان", "SUR", Decimal("18.00")),
    ("zuwara", "زوارة", "ZUW", Decimal("20.00")),
    ("gharyan", "غريان", "GHA", Decimal("20.00")),
    ("tarhuna", "ترهونة", "TAR", Decimal("20.00")),
    ("bani-walid", "بني وليد", "BNW", Decimal("25.00")),
    ("zintan", "الزنتان", "ZIN", Decimal("25.00")),
    ("yefren", "يفرن", "YEF", Decimal("25.00")),
    ("nalut", "نالوت", "NAL", Decimal("30.00")),
    ("sirte", "سرت", "SRT", Decimal("25.00")),
    ("tobruk", "طبرق", "TOB", Decimal("30.00")),
    ("bayda", "البيضاء", "BAY", Decimal("30.00")),
    ("derna", "درنة", "DRN", Decimal("30.00")),
    ("marj", "المرج", "MRJ", Decimal("28.00")),
    ("ajdabiya", "أجدابيا", "AJD", Decimal("25.00")),
    ("shahhat", "شحات", "SHH", Decimal("30.00")),
    ("qubbah", "القبة", "QUB", Decimal("30.00")),
    ("brega", "البريقة", "BRG", Decimal("28.00")),
    ("ras-lanuf", "رأس لانوف", "RSL", Decimal("28.00")),
    ("sabha", "سبها", "SEB", Decimal("35.00")),
    ("ubari", "أوباري", "UBR", Decimal("40.00")),
    ("murzuq", "مرزق", "MRZ", Decimal("40.00")),
    ("ghat", "غات", "GHT", Decimal("45.00")),
    ("brak-shati", "براك الشاطئ", "SHT", Decimal("35.00")),
    ("jufra", "الجفرة (هون / ودان)", "JUF", Decimal("30.00")),
    ("kufra", "الكفرة", "KUF", Decimal("45.00")),
    ("ghadames", "غدامس", "GHD", Decimal("35.00")),
    ("msallata", "مسلاتة", "MSL", Decimal("20.00")),
    ("ajaylat", "العجيلات", "AJY", Decimal("20.00")),
    ("jameel", "الجميل", "JAM", Decimal("20.00")),
    ("rigdalin", "رقدالين", "RGD", Decimal("20.00")),
]


def populate_cities(apps, schema_editor):
    if "test" in sys.argv or "pytest" in sys.modules:
        return

    City = apps.get_model("core", "City")
    for city_id, name, code, fee in LIBYAN_CITIES:
        City.objects.update_or_create(
            id=city_id,
            defaults={
                "name": name,
                "code": code,
                "delivery_fee": fee,
                "is_active": True,
            },
        )


def reverse_populate(apps, schema_editor):
    City = apps.get_model("core", "City")
    city_ids = [c[0] for c in LIBYAN_CITIES]
    City.objects.filter(id__in=city_ids).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_user_cod_blacklist_reason_user_cod_rejections_count_and_more"),
    ]

    operations = [
        migrations.RunPython(populate_cities, reverse_code=reverse_populate),
    ]
