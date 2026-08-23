"""Double-Entry Accounting & Financial Ledger Service for Nasaeem Libya.

Enforces strict mathematical balance (Sum Debit == Sum Credit) for all monetary transactions:
- COD delivery orders
- Electronic gateway payments
- Courier settlements & remittances
- Gateway refunds & returns
"""

from decimal import Decimal
from typing import Sequence, Tuple, Union

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.payments.models import LedgerAccount, LedgerEntry, LedgerTransaction

# Standard Account Definitions
STANDARD_ACCOUNTS = [
    {"code": "1010_CASH_ON_DELIVERY", "name": "نقدية قيد التحصيل (المندوبين وشركات الشحن)", "account_type": LedgerAccount.TYPE_ASSET},
    {"code": "1020_GATEWAY_RECEIVABLES", "name": "مستحقات بوابات الدفع الإلكتروني المعلقة", "account_type": LedgerAccount.TYPE_ASSET},
    {"code": "1030_BANK_ACCOUNT", "name": "الحساب المصرفي الرئيسي للمتجر", "account_type": LedgerAccount.TYPE_ASSET},
    {"code": "2010_CUSTOMER_PAYABLES", "name": "مستحقات واستردادات العملاء", "account_type": LedgerAccount.TYPE_LIABILITY},
    {"code": "4010_SALES_REVENUE", "name": "إيرادات مبيعات العطور الفاخرة", "account_type": LedgerAccount.TYPE_REVENUE},
    {"code": "5010_COURIER_EXPENSES", "name": "مصاريف وعمولات الشحن والتوصيل", "account_type": LedgerAccount.TYPE_EXPENSE},
    {"code": "5020_GATEWAY_FEES", "name": "رسوم وعمولات بوابات الدفع الإلكتروني", "account_type": LedgerAccount.TYPE_EXPENSE},
    {"code": "5030_COGS", "name": "تكلفة البضاعة المباعة", "account_type": LedgerAccount.TYPE_EXPENSE},
]


def ensure_standard_accounts() -> dict[str, LedgerAccount]:
    """Initializes or fetches all standard chart of accounts."""
    accounts = {}
    for spec in STANDARD_ACCOUNTS:
        acc, _ = LedgerAccount.objects.get_or_create(
            code=spec["code"],
            defaults={
                "name": spec["name"],
                "account_type": spec["account_type"],
                "balance": Decimal("0.00"),
            },
        )
        accounts[spec["code"]] = acc
    return accounts


AccountRef = Union[LedgerAccount, str]


@transaction.atomic
def record_double_entry_transaction(
    *,
    reference_type: str,
    reference_id: str,
    description: str,
    debits: Sequence[Tuple[AccountRef, Decimal]],
    credits: Sequence[Tuple[AccountRef, Decimal]],
) -> LedgerTransaction:
    """Creates a balanced double-entry transaction.

    Raises ValidationError if sum(debits) != sum(credits).
    Atomically updates account balances.
    """
    total_debit = sum((amount for _, amount in debits), Decimal("0.00"))
    total_credit = sum((amount for _, amount in credits), Decimal("0.00"))

    # Enforce balance
    if abs(total_debit - total_credit) > Decimal("0.001"):
        raise ValidationError(
            f"القيد المحاسبي غير متوازن: إجمالي المدين ({total_debit}) لا يساوي إجمالي الدائن ({total_credit})"
        )

    accounts_map = ensure_standard_accounts()

    def resolve_account(acc_ref: AccountRef) -> LedgerAccount:
        if isinstance(acc_ref, LedgerAccount):
            return acc_ref
        if acc_ref in accounts_map:
            return accounts_map[acc_ref]
        return LedgerAccount.objects.get(code=acc_ref)

    txn = LedgerTransaction.objects.create(
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
    )

    # Process Debits
    for acc_ref, amount in debits:
        if amount <= 0:
            continue
        account = resolve_account(acc_ref)
        account = LedgerAccount.objects.select_for_update().get(id=account.id)

        LedgerEntry.objects.create(
            transaction=txn,
            account=account,
            entry_type=LedgerEntry.ENTRY_DEBIT,
            amount=amount,
        )

        # Asset & Expense increase with Debit; Liability, Equity & Revenue decrease
        if account.account_type in [LedgerAccount.TYPE_ASSET, LedgerAccount.TYPE_EXPENSE]:
            account.balance += amount
        else:
            account.balance -= amount
        account.save(update_fields=["balance", "updated_at"])

    # Process Credits
    for acc_ref, amount in credits:
        if amount <= 0:
            continue
        account = resolve_account(acc_ref)
        account = LedgerAccount.objects.select_for_update().get(id=account.id)

        LedgerEntry.objects.create(
            transaction=txn,
            account=account,
            entry_type=LedgerEntry.ENTRY_CREDIT,
            amount=amount,
        )

        # Liability, Equity & Revenue increase with Credit; Asset & Expense decrease
        if account.account_type in [LedgerAccount.TYPE_LIABILITY, LedgerAccount.TYPE_EQUITY, LedgerAccount.TYPE_REVENUE]:
            account.balance += amount
        else:
            account.balance -= amount
        account.save(update_fields=["balance", "updated_at"])

    return txn


def record_order_sale_ledger(order) -> LedgerTransaction:
    """Records double-entry ledger entries when an order is confirmed/paid."""
    order_number = order.order_number
    amount = order.total

    # Determine whether COD or Online Gateway
    is_cod = order.payment_method == "manual_payment"
    receivable_code = "1010_CASH_ON_DELIVERY" if is_cod else "1020_GATEWAY_RECEIVABLES"
    desc = f"مبيعات عطور طلب #{order_number} ({'كاش مندوب' if is_cod else 'دفع إلكتروني'})"

    return record_double_entry_transaction(
        reference_type="ORDER_SALE",
        reference_id=order_number,
        description=desc,
        debits=[(receivable_code, amount)],
        credits=[("4010_SALES_REVENUE", amount)],
    )


def record_courier_settlement(
    *,
    courier_name: str,
    collected_amount: Decimal,
    delivery_fee: Decimal,
    bank_deposit: Decimal,
    reference_id: str = "",
) -> LedgerTransaction:
    """Records courier cash remittance: cash deposited into bank minus delivery fees."""
    desc = f"تسوية وتوريد نقدية من شركة الشحن ({courier_name}) — إيداع بنكي {bank_deposit} د.ل وعمولة {delivery_fee} د.ل"

    return record_double_entry_transaction(
        reference_type="COURIER_SETTLEMENT",
        reference_id=reference_id or courier_name,
        description=desc,
        debits=[
            ("1030_BANK_ACCOUNT", bank_deposit),
            ("5010_COURIER_EXPENSES", delivery_fee),
        ],
        credits=[
            ("1010_CASH_ON_DELIVERY", collected_amount),
        ],
    )


def record_refund_ledger(refund) -> LedgerTransaction:
    """Records reverse double-entry transaction when a refund is completed."""
    order = refund.order
    amount = refund.amount
    desc = f"استرداد مالي للطلب #{order.order_number} — سبب: {refund.reason or 'طلب العميل'}"

    # Refund against Revenue and reduce Gateway Receivables or Bank
    credit_target = "1020_GATEWAY_RECEIVABLES" if refund.payment.method_code != "manual_payment" else "1030_BANK_ACCOUNT"

    return record_double_entry_transaction(
        reference_type="ORDER_REFUND",
        reference_id=str(refund.id),
        description=desc,
        debits=[("4010_SALES_REVENUE", amount)],
        credits=[(credit_target, amount)],
    )


def get_ledger_summary() -> dict:
    """Calculates executive financial positions and ledger balances."""
    accounts = ensure_standard_accounts()

    pending_cod = accounts["1010_CASH_ON_DELIVERY"].balance
    pending_gateways = accounts["1020_GATEWAY_RECEIVABLES"].balance
    bank_balance = accounts["1030_BANK_ACCOUNT"].balance
    total_revenue = accounts["4010_SALES_REVENUE"].balance
    total_courier_expenses = accounts["5010_COURIER_EXPENSES"].balance
    total_gateway_fees = accounts["5020_GATEWAY_FEES"].balance
    total_expenses = total_courier_expenses + total_gateway_fees

    net_profit = total_revenue - total_expenses

    return {
        "pending_cod_courier": str(pending_cod),
        "pending_gateway_receivables": str(pending_gateways),
        "bank_account_balance": str(bank_balance),
        "total_sales_revenue": str(total_revenue),
        "total_courier_expenses": str(total_courier_expenses),
        "total_gateway_fees": str(total_gateway_fees),
        "total_expenses": str(total_expenses),
        "net_profit": str(net_profit),
    }
