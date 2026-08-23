"""Cart resolution, discount maths, delivery fees, and checkout.

`checkout()` is the most correctness-critical function in the system. Everything
about its shape is deliberate:

- it locks every product and variant row it will touch, **sorted by primary
  key**, so two concurrent checkouts can never deadlock against each other;
- it re-reads every price from the database and ignores anything the client
  sent about money;
- it reserves stock rather than decrementing it — stock leaves the shelf on
  payment confirmation (Phase 6), not on checkout.

Remove the `select_for_update()` and `test_two_checkouts_for_the_last_unit`
must fail. If it still passes, the test is wrong.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import connection, transaction
from django.db.models import F
from django.db.models.functions import Greatest
from django.utils import timezone

from apps.catalog.models import Product, ProductVariant
from apps.core.models import Region

from .notifications import dispatch_realtime_order_alert

from .models import (
    Cart,
    CartItem,
    CartPromotion,
    DeliveryMethod,
    Discount,
    DiscountType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    ShippingStatus,
)

TWO_PLACES = Decimal("0.01")

# An unconfirmed draft holds stock for this long, then releases it. Long enough
# to fill in an address on a slow connection; short enough that one abandoned
# basket cannot hide the last unit all day.
DRAFT_EXPIRY_MINUTES = 60
DRAFT_SWEEP_CACHE_KEY = "orders:draft-sweep"
DRAFT_SWEEP_INTERVAL_SECONDS = 30

logger = logging.getLogger(__name__)


class CheckoutError(Exception):
    """A checkout that cannot proceed. `status` is the HTTP code to answer."""

    def __init__(self, message, *, status=400, field=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.field = field


class OutOfStock(CheckoutError):
    def __init__(self, message):
        super().__init__(message, status=409)


def money(value) -> Decimal:
    return Decimal(value or 0).quantize(TWO_PLACES)


# --------------------------------------------------------------------------
# Carts — a guest may hold one
# --------------------------------------------------------------------------

def get_or_create_cart(request, *, create=True) -> Cart | None:
    """The caller's cart, whether or not they have an account.

    Requiring an account before a customer can put something in a basket is the
    single largest conversion tax there is, and the reference system did exactly
    that. A guest cart is keyed on the session.
    """
    if request.user.is_authenticated:
        cart = Cart.objects.filter(user=request.user).order_by("-updated_at").first()
        if cart or not create:
            return cart
        return Cart.objects.create(user=request.user)

    session_key = request.session.session_key
    if not session_key:
        if not create:
            return None
        # A guest with no session yet gets one, otherwise there is nothing to
        # key the basket on.
        request.session.save()
        session_key = request.session.session_key

    cart = Cart.objects.filter(session_id=session_key, user__isnull=True).first()
    if cart or not create:
        return cart
    return Cart.objects.create(session_id=session_key)


@transaction.atomic
def merge_guest_cart(*, session_key: str, user) -> Cart | None:
    """Fold the pre-login guest basket into the user's own.

    Called from login and register with the session key captured **before**
    `django_login`, because Django cycles the session key on login and the guest
    cart would otherwise be orphaned.

    Quantities add up; the guest cart is deleted. A line for the same
    product+variant is merged rather than duplicated.
    """
    if not session_key:
        return None

    guest = Cart.objects.filter(session_id=session_key, user__isnull=True).first()
    if guest is None:
        return None

    target = Cart.objects.filter(user=user).order_by("-updated_at").first()
    if target is None:
        # No basket of their own: adopt the guest cart wholesale.
        guest.user = user
        guest.session_id = ""
        guest.save(update_fields=["user", "session_id", "updated_at"])
        return guest

    for item in guest.items.select_related("product", "variant"):
        existing = target.items.filter(product=item.product, variant=item.variant).first()
        if existing:
            existing.quantity += item.quantity
            existing.save(update_fields=["quantity", "updated_at"])
        else:
            CartItem.objects.create(
                cart=target, product=item.product, variant=item.variant, quantity=item.quantity
            )
    guest.items.all().delete()
    guest.delete()
    return target


def available_stock(product: Product, variant: ProductVariant | None) -> int | None:
    """`None` means unlimited — `track_quantity=False` skips every stock check."""
    if not product.track_quantity:
        return None
    if variant is not None:
        return variant.stock - variant.reserved_stock
    return product.stock - product.reserved_stock


def unit_price(product: Product, variant: ProductVariant | None) -> Decimal:
    """A variant's price may be null, meaning "same as the product"."""
    if variant is not None and variant.price is not None:
        return money(variant.price)
    return money(product.price)


# --------------------------------------------------------------------------
# Discounts — validated server-side, every time
# --------------------------------------------------------------------------

def validate_discount(discount: Discount, *, subtotal: Decimal, products=()) -> Decimal:
    """Return the discount amount, or raise `CheckoutError` with an Arabic reason.

    Every branch here is covered by a test, because a discount that validates
    when it should not is money leaving the business.
    """
    now = timezone.now()

    if not discount.is_active:
        raise CheckoutError("كود الخصم غير مفعّل", field="discount_code")
    if discount.start_date and now < discount.start_date:
        raise CheckoutError("كود الخصم لم يبدأ بعد", field="discount_code")
    if discount.end_date and now > discount.end_date:
        raise CheckoutError("انتهت صلاحية كود الخصم", field="discount_code")
    if discount.usage_limit is not None and discount.usage_count >= discount.usage_limit:
        raise CheckoutError("تم استخدام كود الخصم بالكامل", field="discount_code")
    if discount.min_order_amount is not None and subtotal < money(discount.min_order_amount):
        raise CheckoutError(
            f"الحد الأدنى لاستخدام هذا الكود هو {money(discount.min_order_amount)} د.ل",
            field="discount_code",
        )

    # Product scope: when `products` is non-empty the discount applies only to
    # the matching lines, not to the whole basket.
    scoped_ids = set(discount.products.values_list("id", flat=True))
    if scoped_ids:
        eligible = sum(
            (money(line_total) for product_id, line_total in products if product_id in scoped_ids),
            Decimal("0.00"),
        )
        if eligible <= 0:
            raise CheckoutError("كود الخصم لا ينطبق على المنتجات في السلة", field="discount_code")
        base = eligible
    else:
        base = subtotal

    if discount.type == DiscountType.PERCENTAGE:
        amount = base * money(discount.percentage) / Decimal("100")
    else:
        amount = money(discount.value)

    if discount.max_discount_amount is not None:
        amount = min(amount, money(discount.max_discount_amount))

    # Never discount more than the basket is worth: a fixed 50 د.ل code on a
    # 30 د.ل basket must not produce a negative total.
    return min(money(amount), base).quantize(TWO_PLACES)


def _optional_region(region_id):
    if not region_id:
        return None
    return Region.objects.select_related("city").filter(id=region_id, is_active=True).first()


def resolve_region(region_id) -> Region:
    """The region, or an Arabic explanation of why there isn't one.

    > **The empty-city failure.** In the reference the city list came only from
    > a live courier API, it was empty, checkout rendered an empty `<select>`
    > with no explanation, and the customer could not proceed.

    So the two cases are answered differently: "you have not chosen yet" and
    "this store has no delivery regions at all" are not the same problem, and
    telling a customer to pick from an empty list is the failure being avoided.
    """
    region = _optional_region(region_id)
    if region is not None:
        return region
    if not Region.objects.filter(is_active=True).exists():
        raise CheckoutError(
            "لا توجد مناطق توصيل مُعرّفة في المتجر حالياً، يرجى التواصل معنا لإتمام الطلب",
            field="region_id",
        )
    raise CheckoutError("يرجى اختيار منطقة التوصيل", field="region_id")


def delivery_fee(region: Region | None, subtotal: Decimal = Decimal("0.00")) -> tuple[Decimal, Decimal]:
    """The fee comes from the region, falling back to its city.
    Returns (actual_shipping_fee, delivery_discount_amount).
    """
    if region is None:
        return Decimal("0.00"), Decimal("0.00")
    if region.delivery_fee and region.delivery_fee > 0:
        base_fee = money(region.delivery_fee)
    else:
        base_fee = money(region.city.delivery_fee)

    promo = CartPromotion.objects.filter(is_active=True).first()
    if promo and money(subtotal) >= money(promo.min_order_amount):
        return Decimal("0.00"), base_fee

    return base_fee, Decimal("0.00")


# --------------------------------------------------------------------------
# Order numbers — collision-safe, never random
# --------------------------------------------------------------------------

def next_order_number(payment_method: str) -> str:
    """`YYYYMM` + three payment-code letters + a sequence, e.g. `202608MOA0001`.

    The reference used `Math.floor(1000 + Math.random() * 9000)`, which collides.
    The format is kept so existing order numbers stay recognisable, but the
    digits come from a PostgreSQL sequence — created in a migration, so the
    guarantee travels with the code rather than living on one machine.

    The sequence does not reset monthly and is not modulo'd: after 9,999 orders
    the numeric part simply becomes five digits. A wrapping counter would
    reintroduce exactly the collision this replaces.
    """
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT nextval('order_number_seq')")
            value = cursor.fetchone()[0]
    else:
        value = Order.objects.count() + 1

    code = (payment_method or "UNK")[:3].upper().ljust(3, "X")
    return f"{timezone.localtime():%Y%m}{code}{value:04d}"


# --------------------------------------------------------------------------
# Checkout — the critical section
# --------------------------------------------------------------------------

@transaction.atomic
def checkout(
    *,
    cart: Cart,
    user,
    region_id: str | None,
    address: str,
    delivery_method_code: str = "",
    payment_method: str = "",
    discount_code: str = "",
    customer_notes: str = "",
    billing_address: str = "",
    require_delivery: bool = True,
    is_gift: bool = False,
    gift_wrap_type: str = "",
    gift_sender_name: str = "",
    gift_recipient_name: str = "",
    gift_message: str = "",
    hide_invoice_prices: bool = False,
) -> Order:
    lines = list(cart.items.select_related("product", "variant").all())
    if not lines:
        raise CheckoutError("السلة فارغة")

    # `require_delivery=False` creates a DRAFT: the order exists, stock is
    # reserved and the basket is emptied, but the address has not been chosen
    # yet. That is what `/checkout/:orderId` is for — `06-routes-and-pages.md`
    # puts the address step on the checkout screen, which means the order id has
    # to exist before the customer types an address. Reserving stock at draft
    # time is the point: nobody loses the last unit while filling in a form.
    region = resolve_region(region_id) if require_delivery else _optional_region(region_id)
    if require_delivery and not address.strip():
        raise CheckoutError("العنوان مطلوب", field="address")

    # ---- lock every row we will touch, sorted by primary key ----------------
    # Sorting matters: two checkouts holding each other's rows in the opposite
    # order is a deadlock, and it only ever shows up in production.
    product_ids = sorted({line.product_id for line in lines})
    variant_ids = sorted({line.variant_id for line in lines if line.variant_id})

    locked_products = {
        product.id: product
        for product in Product.objects.select_for_update()
        .filter(id__in=product_ids)
        .order_by("id")
    }
    locked_variants = {
        variant.id: variant
        for variant in ProductVariant.objects.select_for_update()
        .filter(id__in=variant_ids)
        .order_by("id")
    }

    # ---- re-read every price and every stock level from the database --------
    subtotal = Decimal("0.00")
    priced_lines = []
    for line in lines:
        product = locked_products.get(line.product_id)
        if product is None or not product.is_active:
            raise CheckoutError(f"المنتج «{line.product.name}» لم يعد متاحاً")

        variant = locked_variants.get(line.variant_id) if line.variant_id else None
        if line.variant_id and (variant is None or not variant.is_active):
            raise CheckoutError(f"الخيار المحدد لـ «{product.name}» لم يعد متاحاً")

        if line.quantity < 1:
            raise CheckoutError("الكمية يجب أن تكون 1 على الأقل")

        stock = available_stock(product, variant)
        if stock is not None and stock < line.quantity:
            raise OutOfStock(
                f"الكمية المتوفرة من «{product.name}» هي {max(stock, 0)} فقط"
            )

        price = unit_price(product, variant)
        line_total = money(price * line.quantity)
        subtotal += line_total
        priced_lines.append((line, product, variant, price, line_total))

    subtotal = money(subtotal)

    # ---- discount ----------------------------------------------------------
    discount = None
    discount_total = Decimal("0.00")
    if discount_code.strip():
        # Locked for the same reason the stock rows are: `usage_count` is a
        # limited resource, and two concurrent checkouts must not both pass the
        # `usage_count < usage_limit` check on the last remaining use.
        discount = (
            Discount.objects.select_for_update()
            .filter(code__iexact=discount_code.strip())
            .first()
        )
        if discount is None:
            raise CheckoutError("كود الخصم غير صحيح", field="discount_code")
        discount_total = validate_discount(
            discount,
            subtotal=subtotal,
            products=[(product.id, line_total) for _, product, _, _, line_total in priced_lines],
        )

    # ---- delivery ----------------------------------------------------------
    # A draft has no region yet, so no delivery fee yet. `finalise_order()` adds
    # it, and recomputes the total from the same stored numbers.
    shipping_total, delivery_discount_amount = delivery_fee(region, subtotal=subtotal)
    method = (
        DeliveryMethod.objects.filter(code=delivery_method_code, is_active=True).first()
        if delivery_method_code
        else DeliveryMethod.objects.filter(is_active=True).order_by("name").first()
    )

    gift_wrap_fee = Decimal("15.00") if (is_gift and gift_wrap_type == "ROYAL_VELVET") else Decimal("0.00")
    total = money(subtotal - discount_total + shipping_total + gift_wrap_fee)

    # ---- create the order --------------------------------------------------
    order = Order.objects.create(
        order_number=next_order_number(payment_method),
        user=user if (user and user.is_authenticated) else None,
        status=OrderStatus.PENDING,
        shipping_status=ShippingStatus.PENDING,
        subtotal=subtotal,
        discount_total=discount_total,
        shipping_total=shipping_total,
        delivery_discount_amount=delivery_discount_amount,
        total=total,
        payment_method=payment_method,
        delivery_method=method,
        discount=discount,
        shipping_address=address.strip(),
        shipping_region=region,
        shipping_city=region.city if region else None,
        billing_address=(billing_address or address).strip(),
        customer_notes=customer_notes.strip(),
        is_gift=is_gift,
        gift_wrap_type=gift_wrap_type,
        gift_wrap_fee=gift_wrap_fee,
        gift_sender_name=gift_sender_name.strip(),
        gift_recipient_name=gift_recipient_name.strip(),
        gift_message=gift_message.strip(),
        hide_invoice_prices=hide_invoice_prices,
    )

    OrderItem.objects.bulk_create([
        OrderItem(
            order=order,
            product=product,
            variant=variant,
            quantity=line.quantity,
            unit_price=price,
            total_price=line_total,
            # Snapshotted: an order is a historical record, and renaming or
            # repricing a product must never rewrite it.
            product_name=product.name,
        )
        for line, product, variant, price, line_total in priced_lines
    ])

    # ---- reserve stock -----------------------------------------------------
    for line, product, variant, _price, _total in priced_lines:
        if not product.track_quantity:
            continue
        if variant is not None:
            variant.reserved_stock += line.quantity
            variant.save(update_fields=["reserved_stock", "updated_at"])
        else:
            product.reserved_stock += line.quantity
            product.save(update_fields=["reserved_stock", "updated_at"])

    if discount is not None:
        # Inside the same transaction and under the same lock, so a limited-use
        # code cannot be over-redeemed by concurrent checkouts.
        discount.usage_count += 1
        discount.save(update_fields=["usage_count", "updated_at"])

    cart.items.all().delete()

    return order


def cart_summary(cart: Cart | None, *, region_id=None, discount_code="") -> dict:
    """What the cart screen shows. Every number is computed here, server-side —
    the client never sends a total and is never believed about one."""
    lines = (
        list(cart.items.select_related("product", "variant").prefetch_related("product__images"))
        if cart
        else []
    )

    items = []
    subtotal = Decimal("0.00")
    for line in lines:
        price = unit_price(line.product, line.variant)
        line_total = money(price * line.quantity)
        subtotal += line_total
        items.append({"line": line, "unit_price": price, "total_price": line_total})
    subtotal = money(subtotal)

    discount_total = Decimal("0.00")
    discount_error = None
    discount = None
    if discount_code.strip():
        discount = Discount.objects.filter(code__iexact=discount_code.strip()).first()
        if discount is None:
            discount_error = "كود الخصم غير صحيح"
        else:
            try:
                discount_total = validate_discount(
                    discount,
                    subtotal=subtotal,
                    products=[(item["line"].product_id, item["total_price"]) for item in items],
                )
            except CheckoutError as exc:
                discount_error = exc.message
                discount = None

    region = (
        Region.objects.select_related("city").filter(id=region_id, is_active=True).first()
        if region_id
        else None
    )
    shipping_total, delivery_discount_amount = delivery_fee(region, subtotal=subtotal)

    return {
        "items": items,
        "subtotal": subtotal,
        "discount_total": discount_total,
        "discount": discount,
        "discount_error": discount_error,
        "shipping_total": shipping_total,
        "delivery_discount_amount": delivery_discount_amount,
        "region": region,
        "total": money(subtotal - discount_total + shipping_total),
    }


def _retag_order_number(number: str, payment_method: str) -> str:
    """Update the three-character payment tag inside an existing order number.

    The tag exists so an operator can see at a glance which gateway an order
    used (`INVENTORY.md` §5.2). But the payment method is chosen on the checkout
    screen, AFTER the order id has to exist — so a draft is stamped `UNK` and
    the tag is corrected here.

    Only the tag changes. The `YYYYMM` prefix and the sequence digits — the
    order's actual identity — are untouched, so nothing that already references
    this order by its number is invalidated. The number is not shown to the
    customer until the confirmation screen, after this has run.
    """
    if len(number) < 9 or not payment_method:
        return number
    code = payment_method[:3].upper().ljust(3, "X")
    return f"{number[:6]}{code}{number[9:]}"


@transaction.atomic
def finalise_order(
    order: Order,
    *,
    region_id: str,
    address: str,
    delivery_method_code: str = "",
    payment_method: str = "",
    customer_notes: str = "",
    billing_address: str = "",
    is_gift: bool = False,
    gift_wrap_type: str = "",
    gift_sender_name: str = "",
    gift_recipient_name: str = "",
    gift_message: str = "",
    hide_invoice_prices: bool = False,
) -> Order:
    """Apply the delivery and payment choices to a draft order.

    The subtotal and the discount were fixed when the order was created and are
    NOT recomputed here — repricing a basket after the customer has committed to
    it is how a shop quietly charges a different number than it quoted. Only the
    delivery fee is added, and the total is recomputed from the stored figures.
    """
    if order.status != OrderStatus.PENDING:
        raise CheckoutError("لا يمكن تعديل هذا الطلب", status=409)

    region = resolve_region(region_id)
    if not address.strip():
        raise CheckoutError("العنوان مطلوب", field="address")

    order.shipping_region = region
    order.shipping_city = region.city
    order.shipping_address = address.strip()
    order.billing_address = (billing_address or address).strip()
    order.customer_notes = customer_notes.strip()
    shipping_total, delivery_discount_amount = delivery_fee(region, subtotal=order.subtotal)
    order.shipping_total = shipping_total
    order.delivery_discount_amount = delivery_discount_amount
    gift_wrap_fee = Decimal("15.00") if (is_gift and gift_wrap_type == "ROYAL_VELVET") else Decimal("0.00")
    order.gift_wrap_fee = gift_wrap_fee
    order.is_gift = is_gift
    order.gift_wrap_type = gift_wrap_type
    order.gift_sender_name = gift_sender_name.strip()
    order.gift_recipient_name = gift_recipient_name.strip()
    order.gift_message = gift_message.strip()
    order.hide_invoice_prices = hide_invoice_prices
    order.total = money(order.subtotal - order.discount_total + order.shipping_total + gift_wrap_fee)
    order.finalised_at = timezone.now()

    if payment_method:
        is_cod = payment_method.lower() in ("cod", "cash_on_delivery", "delivery")
        if is_cod and order.user and order.user.is_cod_blacklisted:
            raise CheckoutError(
                "نعتذر، لإتمام هذا الطلب يُرجى الدفع عبر البطاقة المصرفية أو بوابات الدفع الإلكتروني (سداد / بلتو / تداول)",
                field="payment_method",
                status=403,
            )
        order.payment_method = payment_method
        order.order_number = _retag_order_number(order.order_number, payment_method)
    if delivery_method_code:
        method = DeliveryMethod.objects.filter(
            code=delivery_method_code, is_active=True
        ).first()
        if method is None:
            raise CheckoutError("طريقة التوصيل غير متاحة", field="delivery_method_code")
        order.delivery_method = method

    order.save()
    try:
        dispatch_realtime_order_alert(order)
    except Exception:
        pass
    return order


# --------------------------------------------------------------------------
# Expired drafts — reservations must be a lease, not a leak
# --------------------------------------------------------------------------

def release_expired_drafts(*, now=None) -> int:
    """Cancel unconfirmed drafts past their TTL and hand their stock back.

    A draft is a PENDING order whose `finalised_at` is still null: stock was
    reserved at creation and the customer has not reached confirmation. Left
    alone forever, one abandoned basket permanently hides stock from everyone.

    Lock ordering here is safe against `checkout()`: it locks orders first,
    which checkout never locks; the product/variant/discount rows it does
    touch are updated with atomic F-expressions inside this transaction.
    """
    cutoff = (now or timezone.now()) - timedelta(minutes=DRAFT_EXPIRY_MINUTES)
    released = 0

    with transaction.atomic():
        expired = list(
            Order.objects.select_for_update()
            .filter(
                status=OrderStatus.PENDING,
                finalised_at__isnull=True,
                created_at__lt=cutoff,
            )
            .order_by("id")
        )
        if not expired:
            return 0

        product_qtys: dict[int, int] = {}
        variant_qtys: dict[int, int] = {}
        for order in expired:
            for item in order.items.all():
                if not item.product.track_quantity:
                    continue
                if item.variant_id:
                    variant_qtys[item.variant_id] = variant_qtys.get(item.variant_id, 0) + item.quantity
                else:
                    product_qtys[item.product_id] = product_qtys.get(item.product_id, 0) + item.quantity
            if order.discount_id is not None:
                # The draft consumed a use of a limited code at creation;
                # an abandoned draft must give it back.
                Discount.objects.filter(pk=order.discount_id).update(
                    usage_count=Greatest(F("usage_count") - 1, 0)
                )
            order.status = OrderStatus.CANCELLED
            order.save(update_fields=["status", "updated_at"])
            released += 1

        if product_qtys:
            for product in Product.objects.filter(id__in=product_qtys):
                Product.objects.filter(pk=product.pk).update(
                    reserved_stock=Greatest(
                        F("reserved_stock") - product_qtys[product.pk], 0
                    )
                )
        if variant_qtys:
            for variant in ProductVariant.objects.filter(id__in=variant_qtys):
                ProductVariant.objects.filter(pk=variant.pk).update(
                    reserved_stock=Greatest(
                        F("reserved_stock") - variant_qtys[variant.pk], 0
                    )
                )

    logger.info("released expired drafts count=%s", released)
    return released


def maybe_release_expired_drafts() -> None:
    """Throttled lazy sweep so correctness never depends on a cron existing.

    Runs at most once per interval cluster-wide (Redis `add` is the gate), and
    a failure here must never take a checkout down with it — the management
    command and the next attempt remain.
    """
    from django.core.cache import cache

    if not cache.add(DRAFT_SWEEP_CACHE_KEY, "1", DRAFT_SWEEP_INTERVAL_SECONDS):
        return
    try:
        release_expired_drafts()
    except Exception:
        logger.exception("draft sweep failed; will retry on the next window")


# --------------------------------------------------------------------------
# Plan 01 — Operational Velocity & Quick Order Entry Suite
# --------------------------------------------------------------------------

@transaction.atomic
def quick_create_admin_order(
    *,
    customer_name: str,
    customer_phone: str,
    customer_email: str = "",
    shipping_city_id: str | None = None,
    shipping_region_id: str | None = None,
    shipping_address: str = "",
    delivery_method_code: str = "",
    payment_method_code: str = "manual_payment",
    discount_code: str = "",
    customer_notes: str = "",
    items: list[dict],
    operator_user=None,
) -> Order:
    """Instant order entry for phone and WhatsApp sales.

    - Resolves or provisions the customer account by phone number
    - Validates and atomically deducts stock using `adjust_stock()`
    - Applies promotions and pricing with exact Decimal precision
    - Creates order, items, and initial payment record in one transaction
    """
    import re
    import secrets
    from apps.core.models import User, Role, City, Region
    from apps.catalog.services import adjust_stock
    from apps.payments.models import Payment

    if not items:
        raise CheckoutError("يجب إضافة منتج واحد على الأقل للطلب")

    clean_phone = re.sub(r"[^0-9+]", "", customer_phone.strip())
    if not clean_phone or len(clean_phone) < 8:
        raise CheckoutError("رقم هاتف العميل غير صالح (8 أرقام على الأقل)", field="customer_phone")

    # 1. Customer resolution (lookup or create)
    customer = User.objects.filter(phone_number=clean_phone).first()
    if not customer:
        customer = User.objects.create_user(
            phone_number=clean_phone,
            name=customer_name.strip() or "عميل طلب يدوي",
            email=customer_email.strip() or None,
            password=secrets.token_urlsafe(16),
            role=Role.CUSTOMER,
        )
        customer.phone_verified = True
        customer.save(update_fields=["phone_verified"])
    elif customer_name.strip() and not customer.name:
        customer.name = customer_name.strip()
        customer.save(update_fields=["name"])

    # 2. Region / City resolution
    region = None
    city = None
    if shipping_region_id:
        region = Region.objects.filter(id=shipping_region_id, is_active=True).first()
        if region:
            city = region.city
    if not region and shipping_city_id:
        city = City.objects.filter(id=shipping_city_id, is_active=True).first()
        if city:
            region = city.regions.filter(is_active=True).first()

    # 3. Delivery Method resolution
    delivery_method = None
    if delivery_method_code:
        delivery_method = DeliveryMethod.objects.filter(
            code=delivery_method_code, is_active=True
        ).first()

    # 4. Lock products & variants, verify active and stock availability
    product_ids = sorted({str(it["product_id"]) for it in items if "product_id" in it and it["product_id"]})
    variant_ids = sorted({str(it["variant_id"]) for it in items if it.get("variant_id")})

    locked_products = {
        str(p.id): p
        for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
    }
    locked_variants = {
        str(v.id): v
        for v in ProductVariant.objects.select_for_update().filter(id__in=variant_ids).order_by("id")
    }

    subtotal = Decimal("0.00")
    validated_lines = []
    for it in items:
        p_id = str(it["product_id"])
        v_id = str(it["variant_id"]) if it.get("variant_id") else None
        qty = int(it.get("quantity", 1))
        if qty < 1:
            raise CheckoutError("الكمية يجب أن تكون 1 على الأقل")

        product = locked_products.get(p_id)
        if not product or not product.is_active:
            raise CheckoutError(f"المنتج #{p_id} غير متاح للطلب")

        variant = locked_variants.get(v_id) if v_id else None
        if v_id and (not variant or not variant.is_active):
            raise CheckoutError(f"الخيار المحدد للمنتج «{product.name}» غير متاح")

        unit_price = Decimal(str(variant.price if variant else product.price))
        line_total = (unit_price * qty).quantize(TWO_PLACES)
        subtotal += line_total

        # Check available stock
        target = variant if variant else product
        if product.track_quantity:
            available = target.stock - target.reserved_stock
            if qty > available:
                label = f"{product.name} ({variant.label})" if variant else product.name
                raise CheckoutError(
                    f"الكمية المطلوبة من «{label}» ({qty}) غير متوفرة في المخزون (المتبقي: {available})"
                )

        validated_lines.append({
            "product": product,
            "variant": variant,
            "quantity": qty,
            "unit_price": unit_price,
            "total_price": line_total,
        })

    # 5. Discount calculation
    discount_total = Decimal("0.00")
    applied_discount = None
    if discount_code.strip():
        applied_discount, discount_total, _ = resolve_discount(
            discount_code.strip(), subtotal, user=customer
        )

    # 6. Shipping & Promotions
    shipping_fee = Decimal(str(region.delivery_fee if region else (city.delivery_fee if city else "0.00")))
    delivery_discount_amount = Decimal("0.00")
    shipping_total = shipping_fee

    promo = CartPromotion.objects.filter(is_active=True).first()
    if promo and promo.is_active and subtotal >= promo.min_order_amount:
        delivery_discount_amount = shipping_fee
        shipping_total = Decimal("0.00")

    total = (subtotal - discount_total + shipping_total).quantize(TWO_PLACES)
    if total < Decimal("0.00"):
        total = Decimal("0.00")

    # 7. Create Order record
    order_num = next_order_number(payment_method_code or "MAN")
    order = Order.objects.create(
        user=customer,
        order_number=order_num,
        status=OrderStatus.PROCESSING,
        shipping_status=ShippingStatus.PENDING,
        subtotal=subtotal,
        discount_total=discount_total,
        discount=applied_discount,
        shipping_total=shipping_total,
        delivery_discount_amount=delivery_discount_amount,
        total=total,
        payment_method=payment_method_code or "manual_payment",
        delivery_method=delivery_method,
        shipping_city=city,
        shipping_region=region,
        shipping_address=shipping_address.strip(),
        customer_notes=customer_notes.strip(),
        finalised_at=timezone.now(),
    )

    # 8. Create OrderItems & immediately deduct stock
    for line in validated_lines:
        OrderItem.objects.create(
            order=order,
            product=line["product"],
            variant=line["variant"],
            quantity=line["quantity"],
            unit_price=line["unit_price"],
            total_price=line["total_price"],
        )
        if line["product"].track_quantity:
            adjust_stock(
                product=line["product"],
                variant=line["variant"],
                change=-line["quantity"],
                reason="admin_quick_order",
                note=f"طلب يدوي رقم #{order.order_number}",
                user=operator_user,
            )

    # 9. Create initial Payment record
    Payment.objects.create(
        order=order,
        method_code=payment_method_code or "manual_payment",
        amount=total,
        status=PaymentStatus.COMPLETED if payment_method_code != "manual_payment" else PaymentStatus.WAITING_FOR_VERIFICATION,
        reference_id=f"MAN_{order.order_number}",
    )

    if applied_discount:
        Discount.objects.filter(pk=applied_discount.pk).update(usage_count=F("usage_count") + 1)

    return order


@transaction.atomic
def execute_bulk_order_action(
    *,
    order_ids: list[str],
    action: str,
    operator_user=None,
    notes: str = "",
) -> dict:
    """Bulk action runner for order lists.

    Applies mass updates atomically and skips invalid transitions gracefully.
    """
    if not order_ids:
        return {"updated_count": 0, "failed_ids": [], "message": "لم يتم تحديد أي طلبات"}

    orders = list(Order.objects.filter(id__in=order_ids).select_for_update().order_by("id"))
    updated_count = 0
    failed_ids = []

    for order in orders:
        try:
            if action == "mark_processing":
                if order.status == OrderStatus.PENDING:
                    order.status = OrderStatus.PROCESSING
                    order.save(update_fields=["status", "updated_at"])
                    updated_count += 1
            elif action == "mark_shipped":
                if order.shipping_status in [ShippingStatus.PENDING, ShippingStatus.ACCEPTED]:
                    order.shipping_status = ShippingStatus.ACCEPTED
                    order.save(update_fields=["shipping_status", "updated_at"])
                    updated_count += 1
            elif action == "mark_completed":
                if order.status != OrderStatus.CANCELLED:
                    order.status = OrderStatus.COMPLETED
                    order.shipping_status = ShippingStatus.DELIVERED
                    order.save(update_fields=["status", "shipping_status", "updated_at"])
                    updated_count += 1
            elif action == "mark_cancelled":
                if order.status != OrderStatus.COMPLETED:
                    order.status = OrderStatus.CANCELLED
                    order.shipping_status = ShippingStatus.CANCELLED
                    order.save(update_fields=["status", "shipping_status", "updated_at"])
                    updated_count += 1
            else:
                failed_ids.append(str(order.id))
        except Exception as err:
            logger.exception("Bulk action %s failed for order %s: %s", action, order.id, err)
            failed_ids.append(str(order.id))

    return {
        "updated_count": updated_count,
        "failed_ids": failed_ids,
        "message": f"تم تحديث {updated_count} طلبات بنجاح",
    }


# --------------------------------------------------------------------------
# Plan 02 — Thermal Waybills & Official Invoicing Suite
# --------------------------------------------------------------------------

def build_order_waybill_data(order: Order) -> dict:
    """Builds clean, structured data for 4x6 / 80mm thermal shipping waybill."""
    courier_name = "مندوب المتجر"
    courier_code = "local"
    if order.delivery_method:
        courier_name = order.delivery_method.name
        courier_code = order.delivery_method.code

    # Tracking number from delivery shipment if exists
    tracking_number = order.order_number
    try:
        if hasattr(order, "shipment") and order.shipment and order.shipment.tracking_number:
            tracking_number = order.shipment.tracking_number
    except Exception:
        pass

    # Check payment method: prepaid vs COD
    is_prepaid = order.payment_method in [
        "sadad_pay", "moamalat", "plutu", "binance_pay", "wallet"
    ] or (hasattr(order, "payment") and order.payment and order.payment.status == "completed")

    items_list = []
    for item in order.items.select_related("product", "variant").all():
        variant_desc = ""
        if item.variant:
            variant_desc = " / ".join(
                v.value for v in item.variant.values.all()
            ) or item.variant.sku
        items_list.append({
            "product_name": item.product.name if item.product else "عطر فاخر",
            "variant_description": variant_desc,
            "quantity": item.quantity,
            "sku": (item.variant.sku if item.variant else item.product.sku) if item.product else "",
        })

    city_name = order.shipping_city.name if order.shipping_city else "طرابلس"
    region_name = order.shipping_region.name if order.shipping_region else ""

    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "tracking_number": tracking_number,
        "barcode_value": order.order_number,
        "created_at": order.created_at.isoformat(),
        "recipient": {
            "name": order.user.name if order.user else "عميل نسائم",
            "phone_1": order.user.phone_number if order.user else "",
            "phone_2": "",
            "city": city_name,
            "region": region_name,
            "address": order.shipping_address or f"{city_name} — {region_name}".strip(" —"),
        },
        "courier": {
            "name": courier_name,
            "code": courier_code,
        },
        "payment": {
            "method": order.payment_method,
            "is_prepaid": is_prepaid,
            "cod_amount": "0.00" if is_prepaid else str(order.total),
            "total_amount": str(order.total),
        },
        "packing_list": items_list,
        "fragile_warning": "⚠️ تنبيه: بضاعة قابلة للكسر (عطور زجاجية فاخرة) 🍷 | يُرجى الحذر",
        "customer_notes": order.customer_notes or "",
    }


def build_order_invoice_data(order: Order) -> dict:
    """Builds official A4 Tax/Sales Invoice data with Arabic Tafqeet and QR verification."""
    from apps.orders.tafqeet import tafqeet_libyan_dinars

    # Formal invoice number: INV-YYYY-MM-XXXX
    date_part = order.created_at.strftime("%Y-%m")
    numeric_part = "".join(filter(str.isdigit, order.order_number))[-4:] or "0001"
    invoice_number = f"INV-{date_part}-{numeric_part}"

    items_list = []
    for item in order.items.select_related("product", "variant").all():
        variant_desc = ""
        if item.variant:
            variant_desc = " / ".join(
                v.value for v in item.variant.values.all()
            ) or item.variant.sku
        items_list.append({
            "product_name": item.product.name if item.product else "عطر فاخر",
            "variant_description": variant_desc,
            "sku": (item.variant.sku if item.variant else item.product.sku) if item.product else "",
            "quantity": item.quantity,
            "unit_price": str(item.unit_price),
            "total_price": str(item.total_price),
        })

    city_name = order.shipping_city.name if order.shipping_city else "طرابلس"
    region_name = order.shipping_region.name if order.shipping_region else ""

    tafqeet_text = tafqeet_libyan_dinars(order.total)

    return {
        "invoice_number": invoice_number,
        "order_id": str(order.id),
        "order_number": order.order_number,
        "issue_date": order.created_at.strftime("%Y/%m/%d"),
        "issue_time": order.created_at.strftime("%I:%M %p"),
        "company": {
            "name": "شركة نسائم ليبيا لتجارة العطور الفاخرة ش.م.م",
            "name_en": "NASAEEM LIBYA LUXURY PERFUMES CO.",
            "cr_number": "2024/09812",
            "city": "طرابلس، ليبيا",
            "phone": "0910000000",
            "website": "nasaeem.ly",
        },
        "customer": {
            "name": order.user.name if order.user else "عميل نسائم",
            "phone": order.user.phone_number if order.user else "",
            "email": order.user.email if (order.user and order.user.email) else "",
            "city": city_name,
            "region": region_name,
            "address": order.shipping_address or f"{city_name} — {region_name}".strip(" —"),
        },
        "items": items_list,
        "financials": {
            "subtotal": str(order.subtotal),
            "discount_total": str(order.discount_total),
            "shipping_total": str(order.shipping_total),
            "delivery_discount_amount": str(order.delivery_discount_amount),
            "total": str(order.total),
            "tafqeet": tafqeet_text,
            "payment_method": order.payment_method,
            "payment_status": order.payment.status if hasattr(order, "payment") and order.payment else "pending",
        },
        "verification_url": f"https://nasaeem.ly/track?order={order.order_number}",
        "terms": "نسائم ليبيا تضمن أصالة كافة العطور بنسبة 100%. يحق للعميل الاستبدال أو الاسترجاع خلال 7 أيام من تاريخ الاستلام شريطة بقاء الغلاف الأصلي مغلقاً وبحالته المصنعية.",
    }


def build_batch_waybills_data(order_ids: list[str]) -> list[dict]:
    """Builds list of waybills for batch consecutive printing."""
    orders = Order.objects.filter(id__in=order_ids).select_related(
        "user", "shipping_city", "shipping_region", "delivery_method"
    ).prefetch_related("items__product", "items__variant__values").order_by("-created_at")
    return [build_order_waybill_data(order) for order in orders]
