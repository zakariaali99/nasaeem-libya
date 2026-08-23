from decimal import Decimal
import pytest
from django.core.exceptions import ValidationError

from apps.orders.models import Order, OrderStatus, PaymentStatus
from apps.payments.ledger_service import (
    ensure_standard_accounts,
    get_ledger_summary,
    record_courier_settlement,
    record_double_entry_transaction,
    record_order_sale_ledger,
)
from apps.payments.models import LedgerAccount, LedgerTransaction, Payment, PaymentRefund
from apps.payments.reconciliation_service import reconcile_pending_payments
from apps.payments.refund_service import process_payment_refund


@pytest.mark.django_db
class TestDoubleEntryLedger:
    """Plan 03 — Double-Entry Financial Ledger Suite Tests."""

    def test_standard_accounts_initialization(self):
        accounts = ensure_standard_accounts()
        assert "1010_CASH_ON_DELIVERY" in accounts
        assert "1020_GATEWAY_RECEIVABLES" in accounts
        assert "1030_BANK_ACCOUNT" in accounts
        assert "4010_SALES_REVENUE" in accounts
        assert "5010_COURIER_EXPENSES" in accounts

    def test_unbalanced_entry_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            record_double_entry_transaction(
                reference_type="TEST",
                reference_id="T1",
                description="Unbalanced",
                debits=[("1030_BANK_ACCOUNT", Decimal("100.00"))],
                credits=[("4010_SALES_REVENUE", Decimal("90.00"))],
            )
        assert "غير متوازن" in str(exc_info.value)

    def test_balanced_transaction_updates_balances(self):
        ensure_standard_accounts()
        txn = record_double_entry_transaction(
            reference_type="TEST_BALANCED",
            reference_id="T2",
            description="Balanced Transaction",
            debits=[("1030_BANK_ACCOUNT", Decimal("250.00"))],
            credits=[("4010_SALES_REVENUE", Decimal("250.00"))],
        )
        assert txn.entries.count() == 2

        bank = LedgerAccount.objects.get(code="1030_BANK_ACCOUNT")
        revenue = LedgerAccount.objects.get(code="4010_SALES_REVENUE")
        assert bank.balance >= Decimal("250.00")
        assert revenue.balance >= Decimal("250.00")

    def test_order_sale_ledger_recording(self, customer):
        order = Order.objects.create(
            order_number="202608MAN7701",
            user=customer,
            total=Decimal("420.00"),
            payment_method="manual_payment",
            status=OrderStatus.PROCESSING,
        )
        txn = record_order_sale_ledger(order)
        assert txn.reference_type == "ORDER_SALE"
        assert txn.entries.count() == 2

    def test_courier_settlement_ledger(self):
        txn = record_courier_settlement(
            courier_name="فانكس إكسبريس",
            collected_amount=Decimal("500.00"),
            delivery_fee=Decimal("25.00"),
            bank_deposit=Decimal("475.00"),
            reference_id="VANEX-SETTLE-01",
        )
        assert txn.entries.count() == 3
        entries = {e.account.code: (e.entry_type, e.amount) for e in txn.entries.all()}
        assert entries["1030_BANK_ACCOUNT"] == ("debit", Decimal("475.00"))
        assert entries["5010_COURIER_EXPENSES"] == ("debit", Decimal("25.00"))
        assert entries["1010_CASH_ON_DELIVERY"] == ("credit", Decimal("500.00"))


@pytest.mark.django_db
class TestRefundsAndReconciliation:
    """Plan 03 — 1-Click Refund & Reconciliation Daemon Tests."""

    def test_process_payment_refund_flow(self, customer, owner):
        order = Order.objects.create(
            order_number="202608MOA7702",
            user=customer,
            total=Decimal("300.00"),
            payment_method="moamalat",
            status=OrderStatus.PROCESSING,
        )
        payment = Payment.objects.create(
            order=order,
            method_code="moamalat",
            status=PaymentStatus.COMPLETED,
            amount=Decimal("300.00"),
            reference_id="TXN-MOA-8899",
        )

        refund = process_payment_refund(
            payment_id=str(payment.id),
            amount=Decimal("300.00"),
            reason="طلب العميل استرجاع العطر",
            operator_user=owner,
        )
        assert refund.status == PaymentRefund.STATUS_COMPLETED
        assert refund.amount == Decimal("300.00")
        assert refund.provider_refund_id.startswith("REF-MOAM-")

        order.refresh_from_db()
        payment.refresh_from_db()
        assert payment.status == "refunded"
        assert order.status == OrderStatus.CANCELLED

    def test_over_refund_rejected(self, customer):
        order = Order.objects.create(order_number="202608MOA7703", user=customer, total=Decimal("150.00"))
        payment = Payment.objects.create(
            order=order, method_code="plutu", status=PaymentStatus.COMPLETED, amount=Decimal("150.00")
        )

        with pytest.raises(ValidationError) as exc:
            process_payment_refund(payment_id=str(payment.id), amount=Decimal("200.00"))
        assert "يتجاوز" in str(exc.value)

    def test_admin_refund_api_endpoint(self, admin_client, customer):
        order = Order.objects.create(
            order_number="202608MOA7704",
            user=customer,
            total=Decimal("200.00"),
            status=OrderStatus.PROCESSING,
        )
        payment = Payment.objects.create(
            order=order,
            method_code="plutu",
            status=PaymentStatus.COMPLETED,
            amount=Decimal("200.00"),
        )

        res = admin_client.post(
            f"/api/admin/payments/{payment.id}/refund/",
            {"amount": "200.00", "reason": "استبدال عطر"},
            content_type="application/json",
        )
        assert res.status_code == 200
        assert res.json()["data"]["amount"] == "200.00"

    def test_admin_ledger_summary_and_settlement_apis(self, admin_client):
        res = admin_client.get("/api/admin/ledger/summary/")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "pending_cod_courier" in data
        assert "net_profit" in data

        # Courier settlement API
        res_settle = admin_client.post(
            "/api/admin/ledger/settle-courier/",
            {
                "courier_name": "شركة نورس للتوصيل",
                "collected_amount": "300.00",
                "delivery_fee": "20.00",
                "bank_deposit": "280.00",
                "reference_id": "NAWRES-08-23",
            },
            content_type="application/json",
        )
        assert res_settle.status_code == 200
        assert "تم تسجيل تسوية المندوب" in res_settle.json()["message"]

    def test_reconciliation_daemon_scan(self):
        res = reconcile_pending_payments(min_age_minutes=0, max_age_minutes=1440)
        assert "checked_count" in res
        assert "message" in res
