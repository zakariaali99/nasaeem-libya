"""Order stages — the single place an order moves.

The operator sees one state with six stages. It is stored as the
(`status`, `shipping_status`) pair the rest of the system already reads, so
reports, the customer's order pages and the analytics keep working unchanged.

Any stage may move to any other stage: a cancelled order the courier did in
fact deliver goes back to "delivered", a delivered one the customer sent back
goes to "returned". What makes that safe is that stock and money are never
moved by the button pressed, only by the difference between what the order is
doing now and what the target stage requires:

    stock   new / preparing         → held (a reservation, or units already
                                      taken if the order was paid online)
            out_for_delivery / delivered → taken off the shelf
            returned / cancelled    → back on the shelf (except damaged units)

    money   delivered (pay on delivery) → the sale is booked in the ledger;
            leaving delivered            → the booking is reversed.

`Order.stock_state` and `Order.revenue_booked` record what has actually been
done, so going back and forth never moves stock or money twice.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from django.db import transaction
from django.utils import timezone

from apps.catalog.models import InventoryLog, Product, ProductVariant
from apps.catalog.services import adjust_stock

from .models import (
    Order,
    OrderStage,
    OrderStageEvent,
    OrderStatus,
    PaymentStatus,
    ShippingStatus,
    StockState,
)

STAGE_FIELDS: dict[str, tuple[str, str]] = {
    OrderStage.NEW: (OrderStatus.PENDING, ShippingStatus.PENDING),
    OrderStage.PREPARING: (OrderStatus.PROCESSING, ShippingStatus.PENDING),
    OrderStage.OUT_FOR_DELIVERY: (OrderStatus.PROCESSING, ShippingStatus.ACCEPTED),
    OrderStage.DELIVERED: (OrderStatus.COMPLETED, ShippingStatus.DELIVERED),
    OrderStage.RETURNED: (OrderStatus.REFUNDED, ShippingStatus.RETURNED),
    OrderStage.CANCELLED: (OrderStatus.CANCELLED, ShippingStatus.CANCELLED),
}

# None = "held": a reservation, or the units an online payment already took
# (see `_held_state`).
STAGE_STOCK: dict[str, str | None] = {
    OrderStage.NEW: None,
    OrderStage.PREPARING: None,
    OrderStage.OUT_FOR_DELIVERY: StockState.TAKEN,
    OrderStage.DELIVERED: StockState.TAKEN,
    OrderStage.RETURNED: StockState.RELEASED,
    OrderStage.CANCELLED: StockState.RELEASED,
}

STAGE_ORDER = list(STAGE_FIELDS)


def stage_of(order: Order) -> str:
    status, shipping = order.status, order.shipping_status
    if status == OrderStatus.CANCELLED:
        return OrderStage.CANCELLED
    if status == OrderStatus.REFUNDED or shipping == ShippingStatus.RETURNED:
        return OrderStage.RETURNED
    if status == OrderStatus.COMPLETED:
        return OrderStage.DELIVERED
    if shipping in (ShippingStatus.ACCEPTED, ShippingStatus.DELIVERED):
        return OrderStage.OUT_FOR_DELIVERY
    if status == OrderStatus.PROCESSING:
        return OrderStage.PREPARING
    return OrderStage.NEW


def stage_filter(stage: str) -> dict:
    """Queryset filter for one stage — the inverse of `stage_of`."""
    if stage == OrderStage.CANCELLED:
        return {"status": OrderStatus.CANCELLED}
    if stage == OrderStage.RETURNED:
        return {"status": OrderStatus.REFUNDED}
    if stage == OrderStage.DELIVERED:
        return {"status": OrderStatus.COMPLETED}
    if stage == OrderStage.OUT_FOR_DELIVERY:
        return {"status__in": [OrderStatus.PENDING, OrderStatus.PROCESSING],
                "shipping_status__in": [ShippingStatus.ACCEPTED, ShippingStatus.DELIVERED]}
    if stage == OrderStage.PREPARING:
        return {"status": OrderStatus.PROCESSING,
                "shipping_status__in": [ShippingStatus.PENDING, ShippingStatus.CANCELLED]}
    return {"status": OrderStatus.PENDING,
            "shipping_status__in": [ShippingStatus.PENDING, ShippingStatus.CANCELLED]}


def is_backward(current: str, target: str) -> bool:
    """Anything that is not a plain step forward along the delivery path —
    the moves the operator is asked to confirm."""
    if target in (OrderStage.RETURNED, OrderStage.CANCELLED):
        return True
    if current in (OrderStage.RETURNED, OrderStage.CANCELLED):
        return True
    return STAGE_ORDER.index(target) < STAGE_ORDER.index(current)


class StageError(Exception):
    def __init__(self, message, *, status=400, code="invalid", details=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.details = details or []


@dataclass
class StageResult:
    order: Order
    from_stage: str
    to_stage: str
    effects: list[dict] = field(default_factory=list)
    shortages: list[dict] = field(default_factory=list)
    applied: bool = False


def _lines(order: Order):
    """Order lines whose product still exists and tracks quantity."""
    for item in order.items.select_related("product", "variant"):
        if item.product is None or not item.product.track_quantity:
            continue
        yield item


def _holder(item):
    model = ProductVariant if item.variant_id else Product
    pk = item.variant_id or item.product_id
    return model.objects.select_for_update().get(pk=pk)


def _label(item) -> str:
    return item.product_name or (item.product.name if item.product else "")


def _held_state(order: Order) -> str:
    """How an order in "new" or "preparing" holds its stock: an order paid
    online took its units at payment and keeps them; any other holds a
    reservation."""
    from .services import PAY_ON_DELIVERY

    paid_online = (
        order.payment_method not in PAY_ON_DELIVERY
        and order.payments.filter(status=PaymentStatus.COMPLETED).exists()
    )
    return StockState.TAKEN if paid_online else StockState.RESERVED


def _plan_stock(order: Order, target: str, damaged: set[str]):
    """(new stock_state, effects, shortages) without touching anything."""
    want = STAGE_STOCK[target] or _held_state(order)
    current = order.stock_state
    if want == current:
        return current, [], []

    effects, shortages = [], []
    for item in _lines(order):
        holder = (ProductVariant if item.variant_id else Product).objects.get(
            pk=item.variant_id or item.product_id
        )
        free = holder.stock - holder.reserved_stock
        qty = item.quantity
        name = _label(item)
        if current == StockState.RESERVED and want == StockState.TAKEN:
            effects.append({"kind": "stock_out", "item": name, "quantity": qty})
        elif current == StockState.RESERVED and want == StockState.RELEASED:
            effects.append({"kind": "reservation_released", "item": name, "quantity": qty})
        elif current == StockState.TAKEN and want == StockState.RESERVED:
            effects.append({"kind": "back_to_reserved", "item": name, "quantity": qty})
        elif current == StockState.TAKEN and want == StockState.RELEASED:
            if str(item.id) in damaged:
                effects.append({"kind": "damaged", "item": name, "quantity": qty})
            else:
                effects.append({"kind": "stock_back", "item": name, "quantity": qty})
        elif current == StockState.RELEASED and want == StockState.RESERVED:
            if free < qty:
                shortages.append({"item": name, "needed": qty, "available": max(free, 0)})
            effects.append({"kind": "reserved", "item": name, "quantity": qty})
        elif current == StockState.RELEASED and want == StockState.TAKEN:
            if free < qty:
                shortages.append({"item": name, "needed": qty, "available": max(free, 0)})
            effects.append({"kind": "stock_out", "item": name, "quantity": qty})
    return want, effects, shortages


def _apply_stock(order: Order, current: str, want: str, damaged: set[str], user, note: str):
    ref = f"طلب #{order.order_number}"
    for item in _lines(order):
        holder = _holder(item)
        qty = item.quantity
        variant = holder if item.variant_id else None
        if current == StockState.RESERVED and want == StockState.TAKEN:
            holder.reserved_stock = max(holder.reserved_stock - qty, 0)
            holder.save(update_fields=["reserved_stock", "updated_at"])
            adjust_stock(product=item.product, variant=variant, change=-qty,
                         reason=InventoryLog.Reason.SALE, note=ref, user=user,
                         allow_negative=True)
        elif current == StockState.RESERVED and want == StockState.RELEASED:
            holder.reserved_stock = max(holder.reserved_stock - qty, 0)
            holder.save(update_fields=["reserved_stock", "updated_at"])
        elif current == StockState.TAKEN and want == StockState.RESERVED:
            adjust_stock(product=item.product, variant=variant, change=qty,
                         reason=InventoryLog.Reason.CORRECTION,
                         note=f"{ref} — رجع من التوصيل إلى التجهيز", user=user)
            holder = _holder(item)
            holder.reserved_stock += qty
            holder.save(update_fields=["reserved_stock", "updated_at"])
        elif current == StockState.TAKEN and want == StockState.RELEASED:
            if str(item.id) in damaged:
                continue
            adjust_stock(product=item.product, variant=variant, change=qty,
                         reason=InventoryLog.Reason.RETURN, note=f"{ref} {note}".strip(),
                         user=user)
        elif current == StockState.RELEASED and want == StockState.RESERVED:
            holder.reserved_stock += qty
            holder.save(update_fields=["reserved_stock", "updated_at"])
        elif current == StockState.RELEASED and want == StockState.TAKEN:
            adjust_stock(product=item.product, variant=variant, change=-qty,
                         reason=InventoryLog.Reason.SALE, note=ref, user=user,
                         allow_negative=True)


def _plan_money(order: Order, target: str) -> list[dict]:
    from .services import PAY_ON_DELIVERY

    if order.payment_method not in PAY_ON_DELIVERY:
        return []
    if target == OrderStage.DELIVERED and not order.revenue_booked:
        return [{"kind": "sale_booked", "amount": str(order.total)}]
    if target != OrderStage.DELIVERED and order.revenue_booked:
        return [{"kind": "sale_reversed", "amount": str(order.total)}]
    return []


def _apply_money(order: Order, effects: list[dict], note: str):
    from apps.payments.ledger_service import record_order_sale_ledger, record_order_sale_reversal
    from apps.payments.models import Payment

    for effect in effects:
        if effect["kind"] == "sale_booked":
            payment = order.payments.order_by("-created_at").first()
            if payment is None:
                payment = Payment(order=order, method_code=order.payment_method or "manual_payment",
                                  amount=order.total)
            payment.status = PaymentStatus.COMPLETED
            payment.amount = order.total
            payment.verified_at = timezone.now()
            payment.save()
            record_order_sale_ledger(order)
            order.revenue_booked = True
        elif effect["kind"] == "sale_reversed":
            payment = order.payments.filter(status=PaymentStatus.COMPLETED).order_by("-created_at").first()
            if payment is not None:
                payment.status = PaymentStatus.CANCELLED
                payment.save(update_fields=["status", "updated_at"])
            record_order_sale_reversal(order, note)
            order.revenue_booked = False


def change_stage(
    order: Order,
    target: str,
    *,
    by=None,
    note: str = "",
    damaged_item_ids=(),
    dry_run: bool = False,
    allow_short: bool = False,
) -> StageResult:
    """Move `order` to `target`. With `dry_run` nothing is written and the
    result says what would happen. A move that needs stock the shelf does not
    have is refused (409, code `insufficient_stock`) unless `allow_short`."""
    if target not in STAGE_FIELDS:
        raise StageError("مرحلة غير معروفة", code="unknown_stage")
    note = (note or "").strip()[:1000]
    damaged = {str(v) for v in (damaged_item_ids or ())}

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order.pk)
        current = stage_of(order)
        if current == target:
            raise StageError("الطلب في هذه المرحلة أصلاً", code="same_stage")
        if order.finalised_at is None and not order.shipping_address and current == OrderStage.NEW:
            raise StageError("هذه سلة لم يُكمل صاحبها الطلب بعد", code="draft")

        want, stock_effects, shortages = _plan_stock(order, target, damaged)
        money_effects = _plan_money(order, target)
        result = StageResult(order=order, from_stage=current, to_stage=target,
                             effects=stock_effects + money_effects, shortages=shortages)
        if dry_run:
            return result
        if shortages and not allow_short:
            raise StageError("الكمية المتوفرة لا تكفي لهذا الطلب", status=409,
                             code="insufficient_stock", details=shortages)

        user = by if (by is not None and getattr(by, "is_authenticated", False)) else None
        if want != order.stock_state:
            _apply_stock(order, order.stock_state, want, damaged, user, note)
            order.stock_state = want
        _apply_money(order, money_effects, note)

        order.status, order.shipping_status = STAGE_FIELDS[target]
        if order.finalised_at is None:
            order.finalised_at = timezone.now()
        order.save(update_fields=["status", "shipping_status", "stock_state",
                                  "revenue_booked", "finalised_at", "updated_at"])
        OrderStageEvent.objects.create(order=order, from_stage=current, to_stage=target,
                                       note=note, effects=result.effects, changed_by=user)
        result.applied = True
        return result
