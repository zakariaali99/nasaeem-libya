from decimal import Decimal
import pytest

from apps.orders.models import Order, OrderStatus, ShippingStatus
from apps.delivery.cod_reconciliation import commit_cod_statement, parse_and_stage_cod_statement
from apps.delivery.models import (
    CODReconciliationItem,
    CODReconciliationStatement,
    CourierTrackingEvent,
    WarehouseHub,
)
from apps.delivery.warehouse_routing import resolve_order_fulfillment_hub
from apps.delivery.webhook_service import build_order_tracking_timeline, process_courier_webhook_event
from apps.delivery.whatsapp_gateway import confirm_order_via_whatsapp, create_or_refresh_whatsapp_session


@pytest.mark.django_db
class TestCourierWebhooksAndTracking:
    """Plan 04 — Courier Webhooks and Live Tracking Timeline Tests."""

    def test_courier_webhook_delivery_lifecycle(self, customer):
        order = Order.objects.create(
            order_number="202608VNX8801",
            tracking_number="VNX-LY-8801",
            user=customer,
            total=Decimal("250.00"),
            status=OrderStatus.PROCESSING,
            shipping_status="processing",
        )

        # 1. Out for delivery
        event1 = process_courier_webhook_event(
            courier_code="vanex",
            tracking_number="VNX-LY-8801",
            status_code="OUT_FOR_DELIVERY",
            location="طرابلس - حي الأندلس",
            driver_name="محمود الفرجاني",
            driver_phone="0913333333",
        )
        order.refresh_from_db()
        assert order.shipping_status == "out_for_delivery"
        assert event1.driver_name == "محمود الفرجاني"

        # 2. Delivered
        event2 = process_courier_webhook_event(
            courier_code="vanex",
            tracking_number="VNX-LY-8801",
            status_code="DELIVERED",
            location="طرابلس - حي الأندلس",
        )
        order.refresh_from_db()
        assert order.status == OrderStatus.COMPLETED
        assert order.shipping_status == "delivered"

        # 3. Timeline
        timeline = build_order_tracking_timeline(order)
        assert len(timeline["events"]) == 2
        assert timeline["tracking_number"] == "VNX-LY-8801"


@pytest.mark.django_db
class TestCODReconciliationSuite:
    """Plan 04 — Excel COD Reconciliation & Discrepancy Highlighting Tests."""

    def test_cod_statement_discrepancy_analysis(self, customer, owner):
        order1 = Order.objects.create(
            order_number="202608COD8802",
            tracking_number="VNX-LY-8802",
            user=customer,
            total=Decimal("300.00"),
            status=OrderStatus.PROCESSING,
        )
        order2 = Order.objects.create(
            order_number="202608COD8803",
            tracking_number="VNX-LY-8803",
            user=customer,
            total=Decimal("450.00"),
            status=OrderStatus.PROCESSING,
        )

        csv_content = """tracking_number,order_number,collected_amount,delivery_fee,recipient_name
VNX-LY-8802,202608COD8802,300.00,20.00,عميل نسائم
VNX-LY-8803,202608COD8803,400.00,20.00,عميل ثان
VNX-LY-9999,202608COD9999,150.00,15.00,غير مسجل
"""
        stmt = parse_and_stage_cod_statement(
            courier_code="vanex",
            courier_name="شركة فانكس إكسبريس",
            raw_csv_text=csv_content,
            operator_user=owner,
        )

        assert stmt.total_orders_count == 3
        assert stmt.matched_orders_count == 1
        assert stmt.discrepancies_count == 2
        assert stmt.total_collected_actual == Decimal("850.00")
        assert stmt.total_delivery_fees == Decimal("55.00")
        assert stmt.net_bank_deposit == Decimal("795.00")

        items = {item.tracking_number: item for item in stmt.items.all()}
        assert items["VNX-LY-8802"].match_status == CODReconciliationItem.MATCH_PERFECT
        assert items["VNX-LY-8803"].match_status == CODReconciliationItem.MATCH_AMOUNT_MISMATCH
        assert items["VNX-LY-9999"].match_status == CODReconciliationItem.MATCH_ORDER_NOT_FOUND

    def test_cod_statement_commit_and_ledger(self, customer, owner):
        order = Order.objects.create(
            order_number="202608COD8804",
            tracking_number="VNX-LY-8804",
            user=customer,
            total=Decimal("200.00"),
            status=OrderStatus.PROCESSING,
        )

        stmt = parse_and_stage_cod_statement(
            courier_code="nawres",
            courier_name="شركة النورس للتوصيل",
            rows_data=[{
                "tracking_number": "VNX-LY-8804",
                "order_number": "202608COD8804",
                "collected_amount": "200.00",
                "delivery_fee": "15.00",
            }],
            operator_user=owner,
        )

        committed = commit_cod_statement(stmt.statement_id, operator_user=owner)
        assert committed.status == CODReconciliationStatement.STATUS_COMMITTED

        order.refresh_from_db()
        assert order.status == OrderStatus.COMPLETED
        assert order.shipping_status == "delivered"


@pytest.mark.django_db
class TestWarehouseRoutingAndWhatsApp:
    """Plan 04 — Libyan Regional Hubs & Interactive WhatsApp Bot Tests."""

    def test_regional_warehouse_routing(self):
        hub_tripoli = resolve_order_fulfillment_hub("طرابلس - حي الأندلس")
        assert hub_tripoli.code == WarehouseHub.HUB_TRIPOLI

        hub_benghazi = resolve_order_fulfillment_hub("بنغازي - الفويهات")
        assert hub_benghazi.code == WarehouseHub.HUB_BENGHAZI

        hub_misrata = resolve_order_fulfillment_hub("مصراتة - الرويسات")
        assert hub_misrata.code == WarehouseHub.HUB_MISRATA

    def test_whatsapp_session_and_gps_confirmation(self, customer):
        order = Order.objects.create(
            order_number="202608WA8805",
            user=customer,
            total=Decimal("380.00"),
            status=OrderStatus.PENDING,
            shipping_address="طرابلس",
        )

        session = create_or_refresh_whatsapp_session(order)
        assert session.status == "pending"
        assert len(session.token) > 20

        # Confirm with GPS
        updated_session = confirm_order_via_whatsapp(
            token=session.token,
            gps_lat=32.8872,
            gps_lng=13.1913,
            address_text="بالقرب من مدرسة النخبة",
        )
        assert updated_session.status == "address_updated"

        order.refresh_from_db()
        assert order.status == OrderStatus.PROCESSING
        assert "GPS: 32.8872,13.1913" in order.shipping_address
