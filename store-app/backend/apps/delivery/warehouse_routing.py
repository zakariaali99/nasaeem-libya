import logging
from .models import WarehouseHub

logger = logging.getLogger(__name__)

DEFAULT_HUBS = [
    {
        "code": WarehouseHub.HUB_TRIPOLI,
        "name_ar": "مخزن طرابلس الرئيسي والمنطقة الغربية",
        "address": "طريق السكة، طرابلس",
        "manager_phone": "0912000001",
        "city_coverage": [
            "طرابلس",
            "جنزور",
            "تاجوراء",
            "الزاوية",
            "صرمان",
            "صبراتة",
            "زوارة",
            "غريان",
            "يفرن",
            "نالوت",
            "الجميل",
        ],
    },
    {
        "code": WarehouseHub.HUB_BENGHAZI,
        "name_ar": "مخزن بنغازي الإقليمي والمنطقة الشرقية",
        "address": "شارع دبي، بنغازي",
        "manager_phone": "0912000002",
        "city_coverage": [
            "بنغازي",
            "المرج",
            "البيضاء",
            "درنة",
            "طبرق",
            "أجدابيا",
            "شحات",
            "القبة",
        ],
    },
    {
        "code": WarehouseHub.HUB_MISRATA,
        "name_ar": "مخزن مصراتة والوسطى",
        "address": "المنطقة الصناعية، مصراتة",
        "manager_phone": "0912000003",
        "city_coverage": [
            "مصراتة",
            "زليتن",
            "الخمس",
            "سرت",
            "ترهونة",
            "بني وليد",
        ],
    },
    {
        "code": WarehouseHub.HUB_SOUTH,
        "name_ar": "مخزن سبها والمنطقة الجنوبية",
        "address": "حي القرضة، سبها",
        "manager_phone": "0912000004",
        "city_coverage": [
            "سبها",
            "براك الشاطئ",
            "مرزق",
            "أوباري",
            "غات",
            "الجفرة",
            "هون",
        ],
    },
]


def ensure_warehouse_hubs() -> list[WarehouseHub]:
    """Ensures standard Libyan regional fulfillment hubs are created."""
    hubs = []
    for data in DEFAULT_HUBS:
        hub, _ = WarehouseHub.objects.get_or_create(
            code=data["code"],
            defaults={
                "name_ar": data["name_ar"],
                "address": data["address"],
                "manager_phone": data["manager_phone"],
                "city_coverage": data["city_coverage"],
                "is_active": True,
            },
        )
        hubs.append(hub)
    return hubs


def resolve_order_fulfillment_hub(shipping_city_name: str) -> WarehouseHub:
    """Finds the optimal Libyan warehouse hub based on recipient city."""
    ensure_warehouse_hubs()
    clean_city = (shipping_city_name or "").strip()

    if clean_city:
        for hub in WarehouseHub.objects.filter(is_active=True):
            coverage = hub.city_coverage or []
            if any(clean_city in c or c in clean_city for c in coverage):
                return hub

    # Fallback to Tripoli Main
    return WarehouseHub.objects.filter(code=WarehouseHub.HUB_TRIPOLI).first()
