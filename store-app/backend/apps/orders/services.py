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

from decimal import Decimal

from django.db import connection, transaction
from django.utils import timezone

from apps.catalog.models import Product, ProductVariant
from apps.core.models import Region

from .models import (
    Cart,
    CartItem,
    DeliveryMethod,
    Discount,
    DiscountType,
    Order,
    OrderItem,
    OrderStatus,
    ShippingStatus,
)

TWO_PLACES = Decimal("0.01")


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


def delivery_fee(region: Region | None) -> Decimal:
    """The fee comes from the region, falling back to its city."""
    if region is None:
        return Decimal("0.00")
    if region.delivery_fee and region.delivery_fee > 0:
        return money(region.delivery_fee)
    return money(region.city.delivery_fee)


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
    with connection.cursor() as cursor:
        cursor.execute("SELECT nextval('order_number_seq')")
        value = cursor.fetchone()[0]

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
    shipping_total = delivery_fee(region)
    method = (
        DeliveryMethod.objects.filter(code=delivery_method_code, is_active=True).first()
        if delivery_method_code
        else DeliveryMethod.objects.filter(is_active=True).order_by("name").first()
    )

    total = money(subtotal - discount_total + shipping_total)

    # ---- create the order --------------------------------------------------
    order = Order.objects.create(
        order_number=next_order_number(payment_method),
        user=user if (user and user.is_authenticated) else None,
        status=OrderStatus.PENDING,
        shipping_status=ShippingStatus.PENDING,
        subtotal=subtotal,
        discount_total=discount_total,
        shipping_total=shipping_total,
        delivery_discount_amount=Decimal("0.00"),
        total=total,
        payment_method=payment_method,
        delivery_method=method,
        discount=discount,
        shipping_address=address.strip(),
        shipping_region=region,
        shipping_city=region.city if region else None,
        billing_address=(billing_address or address).strip(),
        customer_notes=customer_notes.strip(),
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
    shipping_total = delivery_fee(region)

    return {
        "items": items,
        "subtotal": subtotal,
        "discount_total": discount_total,
        "discount": discount,
        "discount_error": discount_error,
        "shipping_total": shipping_total,
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
    order.shipping_total = delivery_fee(region)
    order.total = money(order.subtotal - order.discount_total + order.shipping_total)

    if payment_method:
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
    return order
