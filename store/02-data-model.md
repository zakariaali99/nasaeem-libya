# 02 — Data model

Every model below is taken from the working reference schema. Field names,
types and relations are **normative** — build them exactly.

Conventions, applied to every model:
- Primary key `id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`
  unless stated otherwise.
- `created_at = DateTimeField(auto_now_add=True)`, `updated_at = DateTimeField(auto_now=True)`.
- Money is `DecimalField(max_digits=10, decimal_places=2)`. **Never float.**
- Arabic `verbose_name` on user-facing fields, as shown.
- `db_index=True` exactly where marked — these indexes are load-bearing.

---

## app: `core`

### `Role` (TextChoices)
`CUSTOMER = "customer"`, `STAFF = "staff"`, `MANAGER = "manager"`,
`ADMIN = "admin"`, `OWNER = "owner"`

### `User(AbstractBaseUser, PermissionsMixin)`
**`USERNAME_FIELD = "phone_number"`.** Custom `UserManager` with
`create_user` / `create_superuser` that call `set_password()`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | pk |
| `phone_number` | CharField(32) | **unique, db_index** — the identity |
| `phone_verified` | Boolean | default False |
| `name` | CharField(255) | blank=True |
| `email` | EmailField | blank, null, unique |
| `role` | CharField(choices=Role) | default `customer` |
| `is_active` | Boolean | default True |
| `is_staff` | Boolean | default False |
| `banned` | Boolean | default False |
| `ban_reason` | TextField | blank |
| `ban_expires_at` | DateTime | null |
| `date_joined` | DateTime | default `timezone.now` |
| `legacy_id` | CharField(64) | null, unique, not editable — for import only |

A banned user, or one whose `ban_expires_at` is in the future, **must not receive
a session**.

### `City`
`id = CharField(primary_key=True, max_length=64)` (not UUID).
`name` CharField(100) unique db_index · `code` CharField(50) unique ·
`delivery_fee` Decimal · `is_active` Boolean db_index.

### `Region`
`id = CharField(primary_key=True, max_length=64)`.
`name` CharField(100) · `city` FK→City `related_name="regions"` ·
`delivery_fee` Decimal default 0 · `estimated_delivery_days` Integer null ·
`is_active` Boolean db_index.

### `UserAddress`
`user` FK→User `related_name="addresses"` · `region` FK→Region **`PROTECT`** ·
`address` TextField · `is_default` Boolean.

---

## app: `catalog`

### `Category`
`name` CharField(100) unique · `slug` SlugField(100) unique **`allow_unicode=True`** ·
`description` TextField blank · `image_url` CharField(255) blank ·
`parent` FK→self null blank (self-nesting) · `is_active` Boolean db_index ·
`is_system` Boolean default False.

> `allow_unicode=True` is required on **every** slug. Arabic slugs must work.

### `Collection`
`name` unique · `slug` unique allow_unicode · `description` · `is_active` db_index.

### `Product`
| Field | Type | Notes |
|---|---|---|
| `name` | CharField(100) | db_index |
| `slug` | SlugField(100) | unique, allow_unicode, db_index |
| `description` | TextField | blank |
| `price` | Decimal | null, blank, db_index |
| `compare_at_price` | Decimal | null — the struck-through "was" price |
| `sku` | CharField(50) | blank, db_index |
| `barcode` | CharField(50) | blank |
| `is_active` | Boolean | db_index |
| `has_variants` | Boolean | default False |
| `track_quantity` | Boolean | default False |
| `stock` | Integer | default 0 |
| `reserved_stock` | Integer | default 0 |
| `meta_title` / `meta_description` | | SEO |
| `width` `length` `height` | Integer | null |
| `weight` | Decimal | null |
| `categories` | M2M→Category | through `ProductCategory` |
| `collections` | M2M→Collection | through `ProductCollection` |

**Available stock is `stock - reserved_stock`.** Never sell against `stock` alone.

### `ProductCategory` / `ProductCollection`
Explicit through-models. FK product CASCADE, FK category/collection CASCADE db_index.

### `VariantOption`
`name` CharField(100) — e.g. الحجم, اللون.

### `VariantValue`
`option` FK→VariantOption `related_name="values"` · `value` CharField(100).

### `ProductVariant`
`product` FK→Product `related_name="variants"` · `sku` · `price` Decimal ·
`compare_at_price` · `stock` Integer · `reserved_stock` Integer ·
`is_active` Boolean · M2M→VariantValue (the combination this variant represents).

### `ProductImage`
`product` FK→Product `related_name="images"` · `url` CharField ·
`alt_text` CharField blank · `sort_order` Integer.

Images are stored on disk under `MEDIA_ROOT` and served by nginx from `/media/`.
Generate `thumb` / `medium` / `full` renditions with **Pillow** on upload.

### `InventoryLog`
`product` FK · `variant` FK null · `change` Integer (signed) ·
`reason` CharField · `note` TextField blank · `user` FK→User null ·
`created_at` db_index. **Append-only. Never update or delete a row.**

---

## app: `orders`

### Enums — use these exact values and Arabic labels

`OrderStatus`: `pending` قيد الانتظار · `processing` قيد المعالجة ·
`completed` مكتمل · `cancelled` ملغي · `refunded` مسترجع

`ShippingStatus`: `pending` قيد الانتظار · `accepted` تم القبول ·
`delivered` تم التوصيل · `returned` مرتجع · `cancelled` ملغي

`PaymentStatus`: `pending` قيد الانتظار · `completed` مكتمل · `failed` فشل ·
`cancelled` ملغي · `refunded` مسترجع · `waiting_for_verification` بانتظار التحقق

`DiscountType`: `percentage` نسبة مئوية · `fixed` مبلغ ثابت

### `DeliveryMethod`
`name` unique · `code` unique · `description` · `is_active` db_index ·
`configuration` JSONField — courier credentials and options.

### `PaymentMethodConfiguration`
`method_code` CharField(50) unique db_index · `display_name` · `description` ·
`config_data` JSONField · `is_enabled` Boolean db_index · `sort_order` Integer.

> `config_data` holds gateway secrets. **Never serialise it to a non-admin
> client.** The public payment-methods endpoint returns only `method_code`,
> `display_name`, `description`, `sort_order`.

### `Discount`
`code` CharField(50) unique null blank db_index · `name` · `description` ·
`type` (DiscountType) · `value` Decimal · `percentage` Decimal ·
`products` M2M→Product blank · `is_active` db_index ·
`start_date` / `end_date` DateTime db_index · `min_order_amount` Decimal null ·
`max_discount_amount` Decimal null · `usage_limit` Integer null ·
`usage_count` Integer default 0.

### `Cart`
`user` FK→User null blank · `session_id` CharField(255) blank db_index ·
`expires_at` DateTime null db_index.

> **A cart may exist without a user.** `session_id` carries the guest basket.
> On login, merge the guest cart into the user cart. Requiring an account before
> a customer can add to a basket is the single largest conversion tax there is —
> the reference system did exactly that and it is not to be repeated.

### `CartItem`
`cart` FK `related_name="items"` · `product` FK **`PROTECT`** ·
`variant` FK null **`PROTECT`** · `quantity` Integer default 1.

### `Order`
| Field | Notes |
|---|---|
| `order_number` | CharField(50) unique db_index — human-readable |
| `user` | FK→User null (guest checkout allowed) |
| `status` | OrderStatus |
| `shipping_status` | ShippingStatus |
| `subtotal` `discount_total` `shipping_total` `delivery_discount_amount` `total` | Decimal |
| `payment_method` | CharField(50) |
| `delivery_method` | FK→DeliveryMethod |
| `discount` | FK→Discount SET_NULL null |
| `shipping_address` | TextField |
| `shipping_region` / `shipping_city` | FK |
| `billing_address` | TextField |
| `customer_notes` | TextField |
| `tracking_number` / `tracking_url` | courier |
| `reference_id` | CharField(100) — gateway reference |

### `OrderItem`
`order` FK `related_name="items"` · `product` FK PROTECT · `variant` FK null ·
`quantity` Integer · `unit_price` Decimal · `total_price` Decimal ·
`product_name` CharField — **denormalised snapshot**.

> Snapshot name and price onto the order line at purchase time. An order is a
> historical record; renaming or repricing a product must never alter it.

### `Payment`
`order` FK `related_name="payments"` · `method_code` · `status` (PaymentStatus) ·
`amount` Decimal · `reference_id` · `provider_payload` JSONField ·
`verified_at` DateTime null.

---

## app: `storefront`

### `WidgetType` (TextChoices) — all 14, exact values
`carousel` سلايدر متحرك · `text_block` كتلة نصية · `image` صورة ·
`product_list` قائمة منتجات · `collection_showcase` عرض مجموعة ·
`category_list` قائمة تصنيفات · `photo_link_grid` شبكة صور بروابط ·
`hero_cta` بانر رئيسي تفاعلي · `announcement_bar` شريط الإعلانات ·
`spacer` فاصل مساحي · `recently_viewed` شوهدت مؤخراً · `buy_again` إعادة شراء ·
`recommended_for_you` موصى به لك · `trending_near_you` رائج في منطقتك

### `StorefrontLayout`
`name` CharField(255) · `is_global_active` Boolean db_index ·
`active_start_date` / `active_end_date` DateTime null ·
`active_days` JSONField(list) · `active_start_hour` / `active_end_hour` Integer null.

### `Widget`
`layout` FK→StorefrontLayout `related_name="widgets"` · `type` (WidgetType) ·
`data` JSONField · `order` Integer db_index · `is_active` Boolean db_index ·
`style` JSONField null · `targeting` JSONField null.

`data` shape per type is specified in `08-features.md`. **Normalise it on write**,
so the client never has to guess between `imageUrl` / `image_url` / `url`.

---

## Integrity rules

1. **`ATOMIC_REQUESTS = True`.** Every request is a transaction.
2. **Checkout takes `select_for_update()`** on every product/variant row it
   decrements, in a stable order, to prevent overselling under concurrency.
   This is the most correctness-critical code in the system.
3. `PROTECT` on `OrderItem.product` and `CartItem.product` — never let a product
   delete destroy order history.
4. `InventoryLog` is append-only.
5. Stock decrements on **payment confirmation**, not on add-to-cart. Reservation
   uses `reserved_stock`.
