from decimal import Decimal
import pytest
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product
from apps.core.models import City, Region, Role, User
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.orders.notifications import format_order_telegram_message
from apps.orders.serializers import ExecutiveAnalyticsSerializer


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        phone_number="0919999222",
        role=Role.ADMIN,
        password="secretpassword123",
    )


@pytest.fixture
def executive_dataset(db):
    city_tip = City.objects.create(id="tripoli", name="طرابلس", code="TIP", is_active=True)
    city_ben = City.objects.create(id="benghazi", name="بنغازي", code="BEN", is_active=True)

    reg_tip = Region.objects.create(id="andalus", city=city_tip, name="حي الأندلس", delivery_fee=Decimal("15.00"), is_active=True)
    reg_ben = Region.objects.create(id="berka", city=city_ben, name="البركة", delivery_fee=Decimal("25.00"), is_active=True)

    cat_armaf = Category.objects.create(name="أرمسترونغ رويال (Armaf)", slug="armaf-luxury")
    prod = Product.objects.create(
        name="عطر كلوب دي نوي إنتنس",
        slug="club-de-nuit-intense",
        sku="CDN-001",
        price=Decimal("250.00"),
        stock=20,
        is_active=True,
    )
    prod.categories.add(cat_armaf)

    user1 = User.objects.create_user(
        phone_number="0912223344",
        name="عميل مميز VIP",
        role=Role.CUSTOMER,
        password="pass",
        lifetime_spend=Decimal("1250.00"),
        vip_tier="GOLD",
    )

    # Order 1 (Tripoli)
    o1 = Order.objects.create(
        user=user1,
        order_number="ORD-EXEC-001",
        subtotal=Decimal("500.00"),
        total=Decimal("515.00"),
        status=OrderStatus.COMPLETED,
        shipping_city=city_tip,
        shipping_region=reg_tip,
        payment_method="cod",
    )
    OrderItem.objects.create(
        order=o1,
        product=prod,
        product_name=prod.name,
        quantity=2,
        unit_price=prod.price,
        total_price=Decimal("500.00"),
    )

    # Order 2 (Benghazi)
    o2 = Order.objects.create(
        user=user1,
        order_number="ORD-EXEC-002",
        subtotal=Decimal("250.00"),
        total=Decimal("275.00"),
        status=OrderStatus.PROCESSING,
        shipping_city=city_ben,
        shipping_region=reg_ben,
        payment_method="moamalat",
    )
    OrderItem.objects.create(
        order=o2,
        product=prod,
        product_name=prod.name,
        quantity=1,
        unit_price=prod.price,
        total_price=Decimal("250.00"),
    )

    return o1, o2


@pytest.mark.django_db
def test_executive_analytics_builder_metrics(executive_dataset):
    data = ExecutiveAnalyticsSerializer().build()

    assert Decimal(data["total_revenue"]) == Decimal("790.00")
    assert data["total_orders_count"] == 2
    assert Decimal(data["estimated_profit"]) > Decimal("0.00")
    assert len(data["city_breakdown"]) >= 2
    assert any(c["city_name"] == "طرابلس" for c in data["city_breakdown"])
    assert any(c["city_name"] == "بنغازي" for c in data["city_breakdown"])
    assert len(data["payment_methods_breakdown"]) >= 2
    assert len(data["trend_series"]) == 14


@pytest.mark.django_db
def test_executive_analytics_admin_api_endpoint_with_timeframe(api_client, admin_user, executive_dataset):
    api_client.force_authenticate(user=admin_user)
    res = api_client.get("/api/admin/analytics/executive/?days=30")
    assert res.status_code == 200
    data = res.data["data"]
    assert "total_revenue" in data
    assert "city_breakdown" in data
    assert "brand_performance" in data
    assert "vip_top_spenders" in data
    assert data["timeframe_days"] == 30
    assert len(res.data["data"]["trend_series"]) > 0


@pytest.mark.django_db
def test_cancelled_orders_excluded_from_dashboard_revenue_and_series(api_client, admin_user):
    from decimal import Decimal
    from django.utils import timezone
    from apps.orders.models import Order, OrderStatus

    api_client.force_authenticate(user=admin_user)
    today = timezone.localtime().date()

    # Create 1 completed order (300 LYD) and 1 cancelled order (500 LYD)
    Order.objects.create(
        order_number="ORD-TEST-COMPL",
        status=OrderStatus.COMPLETED,
        subtotal=Decimal("300.00"),
        total=Decimal("300.00"),
    )
    Order.objects.create(
        order_number="ORD-TEST-CANC",
        status=OrderStatus.CANCELLED,
        subtotal=Decimal("500.00"),
        total=Decimal("500.00"),
    )

    res = api_client.get("/api/admin/dashboard/?days=7")
    assert res.status_code == 200
    data = res.data["data"]

    # Cancelled order must NOT be in timeframe_revenue or revenue_total
    assert Decimal(data["revenue_total"]) >= Decimal("300.00")
    # Cancelled order's 500 LYD must not inflate today's series
    today_point = next((p for p in data["series"] if p["date"] == today.isoformat()), None)
    assert today_point is not None
    assert Decimal(today_point["revenue"]) == Decimal("300.00")
    assert today_point["orders"] == 1


@pytest.mark.django_db
def test_dashboard_stats_with_dynamic_days(api_client, admin_user, executive_dataset):
    api_client.force_authenticate(user=admin_user)
    res = api_client.get("/api/admin/dashboard/?days=7")
    assert res.status_code == 200
    data = res.data["data"]
    assert data["timeframe_days"] == 7
    assert len(data["series"]) == 7


@pytest.mark.django_db
def test_custom_date_range_endpoints(api_client, admin_user, executive_dataset):
    from django.utils import timezone
    from datetime import timedelta
    today = timezone.localtime().date()
    start_str = (today - timedelta(days=10)).isoformat()
    end_str = today.isoformat()

    api_client.force_authenticate(user=admin_user)

    # 1. Executive Analytics with start_date & end_date
    res_exec = api_client.get(f"/api/admin/analytics/executive/?start_date={start_str}&end_date={end_str}")
    assert res_exec.status_code == 200
    exec_data = res_exec.data["data"]
    assert exec_data["start_date"] == start_str
    assert exec_data["end_date"] == end_str
    assert len(exec_data["trend_series"]) == 11

    # 2. Dashboard Stats with start_date & end_date
    res_dash = api_client.get(f"/api/admin/dashboard/?start_date={start_str}&end_date={end_str}")
    assert res_dash.status_code == 200
    dash_data = res_dash.data["data"]
    assert dash_data["start_date"] == start_str
    assert dash_data["end_date"] == end_str
    assert len(dash_data["series"]) == 11


def test_telegram_order_alert_formatting(executive_dataset):
    o1, _ = executive_dataset
    msg = format_order_telegram_message(o1)
    assert "#ORD-EXEC-001" in msg
    assert "طرابلس" in msg
    assert "كلوب دي نوي إنتنس" in msg
    assert "الدفع عند الاستلام كاش" in msg


@pytest.mark.django_db
def test_long_date_range_performance_and_series(api_client, admin_user, executive_dataset):
    api_client.force_authenticate(user=admin_user)
    res = api_client.get("/api/admin/analytics/executive/?start_date=2026-01-01&end_date=2026-08-30")
    assert res.status_code == 200
    data = res.data["data"]
    assert data["start_date"] == "2026-01-01"
    assert data["end_date"] == "2026-08-30"
    assert len(data["trend_series"]) == 242
    assert data["trend_series"][0]["date"] == "2026-01-01"
    assert data["trend_series"][-1]["date"] == "2026-08-30"


@pytest.mark.django_db
def test_abandoned_carts_workflow_and_aliases(api_client, admin_user, executive_dataset):
    from apps.orders.models import Cart, CartItem
    from apps.catalog.models import Product
    from django.utils import timezone
    from datetime import timedelta

    prod = Product.objects.filter(is_active=True).first()
    cart = Cart.objects.create(
        phone_number="0913334455",
        customer_name="عميل سلة متروكة",
    )
    CartItem.objects.create(cart=cart, product=prod, quantity=2)
    # Set cart updated_at in past (e.g. 30 minutes ago)
    Cart.objects.filter(id=cart.id).update(updated_at=timezone.now() - timedelta(minutes=30))

    api_client.force_authenticate(user=admin_user)

    # 1. Main endpoint
    res = api_client.get("/api/admin/marketing/abandoned-carts/")
    assert res.status_code == 200
    assert res.data["data"]["stats"]["abandoned_count"] >= 1
    assert any(c["id"] == str(cart.id) for c in res.data["data"]["carts"])

    # 2. Alias endpoint
    res_alias = api_client.get("/api/orders/admin/marketing/abandoned-carts/")
    assert res_alias.status_code == 200
    assert any(c["id"] == str(cart.id) for c in res_alias.data["data"]["carts"])

    # 3. Trigger WhatsApp reminder
    res_wa = api_client.post(f"/api/admin/marketing/abandoned-carts/{cart.id}/send-whatsapp/")
    assert res_wa.status_code == 200
    assert "whatsapp_link" in res_wa.data
    assert "NASAEEM5" in res_wa.data["whatsapp_link"]

    # 4. Mark recovered
    res_rec = api_client.post(f"/api/admin/marketing/abandoned-carts/{cart.id}/mark-recovered/")
    assert res_rec.status_code == 200
    cart.refresh_from_db()
    assert cart.is_recovered is True

