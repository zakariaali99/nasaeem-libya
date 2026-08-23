import csv
import io
import logging
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, OrderStatus, ShippingStatus
from apps.payments.ledger_service import record_courier_settlement

from .models import CODReconciliationItem, CODReconciliationStatement

logger = logging.getLogger(__name__)


def parse_and_stage_cod_statement(
    *,
    courier_code: str,
    courier_name: str,
    raw_csv_text: str = "",
    rows_data: list[dict] = None,
    operator_user=None,
) -> CODReconciliationStatement:
    """Parses settlement rows and creates a staged draft reconciliation statement with discrepancy analysis."""
    if rows_data is None:
        rows_data = []

    if raw_csv_text:
        # Parse CSV
        f = io.StringIO(raw_csv_text.strip())
        reader = csv.DictReader(f)
        for r in reader:
            rows_data.append(r)

    if not rows_data:
        raise ValidationError("لم يتم العثور على أي بيانات أو شحنات في الملف المرفوع")

    statement_id = f"STMT-{courier_code.upper()}-{timezone.now().strftime('%Y%m%d%H%M%S')}"

    total_expected = Decimal("0.00")
    total_actual = Decimal("0.00")
    total_fees = Decimal("0.00")
    matched_count = 0
    discrepancies_count = 0

    staged_items = []

    for row in rows_data:
        # Support flexible column headers in Arabic & English
        tracking = str(row.get("tracking_number") or row.get("رقم_التتبع") or row.get("رقم التتبع") or "").strip()
        order_num = str(row.get("order_number") or row.get("رقم_الطلب") or row.get("رقم الطلب") or "").strip()
        recipient = str(row.get("recipient_name") or row.get("اسم_المستلم") or row.get("العميل") or "").strip()

        collected_str = str(row.get("collected_amount") or row.get("المبلغ_المحصل") or row.get("المحصل") or "0").replace(",", "").strip()
        fee_str = str(row.get("delivery_fee") or row.get("عمولة_التوصيل") or row.get("رسوم الشحن") or "0").replace(",", "").strip()

        try:
            collected_amt = Decimal(collected_str)
        except Exception:
            collected_amt = Decimal("0.00")

        try:
            fee_amt = Decimal(fee_str)
        except Exception:
            fee_amt = Decimal("0.00")

        # Find matching order
        order = None
        if tracking:
            order = Order.objects.filter(tracking_number=tracking).first()
        if not order and order_num:
            order = Order.objects.filter(order_number=order_num).first()

        match_status = CODReconciliationItem.MATCH_PERFECT
        status_note = ""
        expected_amt = Decimal("0.00")

        if not order:
            match_status = CODReconciliationItem.MATCH_ORDER_NOT_FOUND
            status_note = "الطلب غير موجود في قاعدة بيانات المتجر"
            discrepancies_count += 1
        else:
            expected_amt = Decimal(str(order.total))
            if order.status == OrderStatus.COMPLETED and order.shipping_status == "delivered":
                match_status = CODReconciliationItem.MATCH_ALREADY_SETTLED
                status_note = "الطلب تم تسليمه وتسويته مسبقاً"
            elif abs(collected_amt - expected_amt) > Decimal("0.01"):
                match_status = CODReconciliationItem.MATCH_AMOUNT_MISMATCH
                status_note = f"فارق بالمبلغ (المسجل: {expected_amt} د.ل مقابل المحصل: {collected_amt} د.ل)"
                discrepancies_count += 1
            else:
                match_status = CODReconciliationItem.MATCH_PERFECT
                status_note = "مطابق تماماً ومستوفي الشروط"
                matched_count += 1

        discrepancy_amt = collected_amt - expected_amt
        total_expected += expected_amt
        total_actual += collected_amt
        total_fees += fee_amt

        staged_items.append({
            "order": order,
            "tracking_number": tracking or (order.tracking_number if order else ""),
            "order_number": order_num or (order.order_number if order else ""),
            "recipient_name": recipient or (order.user.name if order and order.user else ""),
            "expected_amount": expected_amt,
            "collected_amount": collected_amt,
            "delivery_fee": fee_amt,
            "discrepancy_amount": discrepancy_amt,
            "match_status": match_status,
            "status_note": status_note,
            "is_approved": match_status in [CODReconciliationItem.MATCH_PERFECT, CODReconciliationItem.MATCH_AMOUNT_MISMATCH],
        })

    net_deposit = max(Decimal("0.00"), total_actual - total_fees)

    with transaction.atomic():
        statement = CODReconciliationStatement.objects.create(
            statement_id=statement_id,
            courier_code=courier_code,
            courier_name=courier_name,
            total_orders_count=len(staged_items),
            matched_orders_count=matched_count,
            discrepancies_count=discrepancies_count,
            total_collected_expected=total_expected,
            total_collected_actual=total_actual,
            total_delivery_fees=total_fees,
            net_bank_deposit=net_deposit,
            status=CODReconciliationStatement.STATUS_DRAFT,
            operator_user=operator_user,
        )

        for item in staged_items:
            CODReconciliationItem.objects.create(
                statement=statement,
                order=item["order"],
                tracking_number=item["tracking_number"],
                order_number=item["order_number"],
                recipient_name=item["recipient_name"],
                expected_amount=item["expected_amount"],
                collected_amount=item["collected_amount"],
                delivery_fee=item["delivery_fee"],
                discrepancy_amount=item["discrepancy_amount"],
                match_status=item["match_status"],
                status_note=item["status_note"],
                is_approved=item["is_approved"],
            )

    return statement


def commit_cod_statement(
    statement_id: str,
    operator_user=None,
) -> CODReconciliationStatement:
    """Commits an approved draft statement, updates matching orders, and records double-entry settlement."""
    with transaction.atomic():
        statement = (
            CODReconciliationStatement.objects.select_for_update()
            .prefetch_related("items__order")
            .get(statement_id=statement_id)
        )

        if statement.status == CODReconciliationStatement.STATUS_COMMITTED:
            raise ValidationError("تم اعتماد وترحيل هذا الكشف مسبقاً")

        approved_items = statement.items.filter(is_approved=True)

        for item in approved_items:
            if item.order:
                order = item.order
                order.status = OrderStatus.COMPLETED
                order.shipping_status = "delivered"
                order.save(update_fields=["status", "shipping_status", "updated_at"])

        # Record courier settlement in double-entry ledger
        if statement.total_collected_actual > Decimal("0.00"):
            record_courier_settlement(
                courier_name=statement.courier_name,
                collected_amount=statement.total_collected_actual,
                delivery_fee=statement.total_delivery_fees,
                bank_deposit=statement.net_bank_deposit,
                reference_id=statement.statement_id,
            )

        statement.status = CODReconciliationStatement.STATUS_COMMITTED
        statement.operator_user = operator_user
        statement.save(update_fields=["status", "operator_user", "updated_at"])

    return statement
