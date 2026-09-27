# خطة التنفيذ 04 — المعرّفات بالـ ID، صفحة إعدادات المتجر، وتسريع تحميل المتجر

> **تاريخ الكتابة:** 2026-09-27
> **المنفّذ:** وكيل برمجي (Antigravity).
> **جذر المشروع:** `store-app/` — الخادم Django في `store-app/backend`، والواجهة React + Vite في `store-app/frontend`.
> **الإنتاج:** cPanel/CloudLinux + Passenger. كل الطلبات تمرّ عبر Django (`PassengerBaseURI "/"`)، بما فيها ملفات JS و CSS والصور.

---

## 0. قواعد عامة للمنفّذ (إلزامية)

1. **نفّذ المهام بالترتيب: 1 ثم 2 ثم 3.** اعمل commit منفصلاً لكل مهمة، واتبع صيغة الرسائل الحالية في المستودع (`feat(...)` و `fix(...)`).
2. **القاعدة الذهبية:** كل عملية على سجل (عرض للتعديل، تعديل، حذف، أو مورد فرعي) تحدد السجل بالـ `id` (UUID) **فقط**، ولا تستخدم الـ `slug` أبداً. الـ slug مسموح به **فقط** في روابط المتجر العامة (SEO) للقراءة، مثل `/products/عود-ملكي`.
3. **الاختبارات قبل أي commit:**
   ```bash
   cd store-app/backend && .venv/bin/python -m pytest
   cd store-app/frontend && npm run build && npm test
   ```
   يجب أن تنجح كلها. لا تحذف اختباراً موجوداً لتنجح؛ عدّل الاختبار فقط إذا تغيّر العقد (الـ API) عمداً بسبب هذه الخطة.
4. **الواجهة المبنية:** بعد تعديل الواجهة شغّل `npm run build` وانسخ الناتج إلى `store-app/backend/dist` (راجع المهمة 3-ب لتنظيف المجلد قبل النسخ).
5. **لا تغيّر** منطق الطلبات والدفع والمخزون خارج ما هو مذكور هنا.
6. **النصوص الظاهرة للمستخدم بالعربية**، وعلى نفس نمط الموجود حالياً.
7. **حالة البداية:** توجد تعديلات غير مرفوعة في `backend/apps/catalog/views.py` (دالة `_find_by_slug_or_id`) وفي `backend/apps/catalog/tests.py` (اختبار `test_category_edit_and_delete_accept_encoded_arabic_slug`). كانت هذه إصلاحاً مؤقتاً، والمهمة 1 تستبدلها بالكامل (التفاصيل في 1-أ).

---

## المهمة 1 — كل العمليات بالـ ID وليس بالـ slug

### السبب
المعرّفات العربية (slugs) تصل إلى الخادم مُرمَّزة مرتين (`%25D8%25B9...`) بسبب البروكسي والمتصفح، فيرجع الخادم 404 «التصنيف غير موجود» ولا يمكن تعديل التصنيف أو حذفه. حدث نفس الخلل سابقاً مع المنتجات. الحل الجذري أن تستخدم كل العمليات الـ UUID.

### 1-أ. الخادم (Backend)

**الملف: `backend/apps/catalog/urls.py`** — استبدل مسارات المنتجات والتصنيفات والمجموعات بالتالي:

```python
# عمليات بالـ id (عرض/تعديل/حذف + الموارد الفرعية)
path("products/<uuid:pk>/", views.ProductDetailView.as_view(), name="product-detail"),
path("products/<uuid:pk>/sizes/", views.ProductSizesManageView.as_view(), name="product-sizes-manage"),
path("products/<uuid:pk>/variants/matrix/", views.VariantMatrixView.as_view(), name="variant-matrix"),
path("products/<uuid:pk>/reviews/", views.ProductReviewsView.as_view(), name="product-reviews"),
path("categories/<uuid:pk>/", views.CategoryDetailView.as_view(), name="category-detail"),
path("categories/<uuid:pk>/products/", views.CategoryProductsView.as_view(), name="category-products"),
path("collections/<uuid:pk>/", views.CollectionDetailView.as_view(), name="collection-detail"),
path("collections/<uuid:pk>/products/", views.CollectionProductsView.as_view(), name="collection-products"),

# قراءة عامة بالـ slug — للمتجر فقط (GET فقط)
path("products/by-slug/<str:slug>/", views.ProductBySlugView.as_view(), name="product-by-slug"),
path("categories/by-slug/<str:slug>/", views.CategoryBySlugView.as_view(), name="category-by-slug"),
path("collections/by-slug/<str:slug>/", views.CollectionBySlugView.as_view(), name="collection-by-slug"),
```

- محوّل `<uuid:pk>` لا يطابق النص `by-slug`، فلا يوجد تعارض بين المسارات.
- المسار القديم `products/<str:slug>/reviews/` (السطر 35 حالياً) **يُحذف** ويحل محله `products/<uuid:pk>/reviews/`.

**الملف: `backend/apps/catalog/views.py`**
- `ProductDetailView.get_object`: احذف منطق فك الترميز والبحث بالـ slug بالكامل (الأسطر ~180–215 حالياً)، واستبدله بـ:
  ```python
  def get_object(self, pk, *, admin=False):
      queryset = product_queryset()
      if not admin:
          queryset = queryset.filter(is_active=True)
      return queryset.filter(pk=pk).first()
  ```
  وغيّر توقيع الدوال `get/patch/delete` من `lookup` إلى `pk`.
- احذف دالة `_find_by_slug_or_id` كلها. `CategoryDetailView.get_object` و `CollectionDetailView.get_object` تصبح: `Model.objects.filter(pk=pk).first()`.
- عدّل `ProductSizesManageView` و `VariantMatrixView` و `CategoryProductsView` و `CollectionProductsView` و `ProductReviewsView` لتستقبل `pk`.
- أنشئ `ProductBySlugView` و `CategoryBySlugView` و `CollectionBySlugView`:
  - `permission_classes = [AllowAny]`، و **GET فقط** (لا `patch` ولا `delete`).
  - فك الترميز المتكرر مسموح هنا فقط، لأنه قراءة عامة: استخدم `urllib.parse.unquote` حتى تثبت القيمة.
  - للمنتجات: `is_active=True` لغير المدير (نفس المنطق الحالي في `ProductDetailView.get`).
  - أعد نفس شكل الاستجابة الحالي (`{"data": ...}`) ونفس السيريالايزر ونفس التخزين المؤقت (`store:product:{slug}`).
  - `CategoryBySlugView` و `CollectionBySlugView` تعيد التصنيف أو المجموعة مع الـ `id`. الواجهة تستخدم هذا الـ `id` بعدها لجلب `/categories/<id>/products/`.
- تأكد أن كل السيريالايزرات (`ProductSerializer` و `ProductListSerializer` و `CategorySerializer` و `CollectionSerializer`) تُرجع الحقل `id`. التصنيف والمجموعة يرجعانه حالياً؛ تحقق من سيريالايزرات قائمة المنتجات.

**الملف: `backend/apps/storefront/spa.py`** (حقن SEO في `index.html`): إن كان يبحث عن المنتج بالـ slug من المسار العام فهذا مسموح لأنه قراءة عامة. لا تغيّره إلا إذا كان يستدعي مسارات API أُزيلت.

**الملف: `backend/apps/catalog/tests.py` وبقية ملفات الاختبار:**
- كل استدعاء لـ `reverse("product-detail", args=[slug])` أو `kwargs={"lookup": ...}` أو لروابط مثل `/api/categories/{slug}/` يتحول إلى `id`.
- استبدل الاختبار `test_category_edit_and_delete_accept_encoded_arabic_slug` باختبارين:
  1. `PATCH` و `DELETE` على `/api/categories/{category.id}/` ينجحان (200 ثم 204).
  2. `PATCH` على `/api/categories/{category.slug}/` يرجع **404** (المسار غير موجود أصلاً)، لتأكيد أن الـ slug لم يعد مقبولاً في التعديل.
- أضف اختبارات مماثلة للمنتجات والمجموعات.
- أضف اختباراً لكل مسار `by-slug`: GET ينجح بالـ slug العربي (عادي، ومرمَّز مرة، ومرمَّز مرتين)، و `PATCH` عليه يرجع 405.

**خارج نطاق هذه المهمة (لا تغيّره):**
- مسارات الطلبات `orders/<str:lookup>/` — تستخدم رقم الطلب (ASCII) وليس slug.
- `cities` و `regions` و `payment_methods/<method_code>` و `delivery/methods/<method_code>` — رموز ASCII ثابتة.

### 1-ب. الواجهة (Frontend)

**الملف: `frontend/src/lib/queries/catalog.ts`**
- احذف `safeDecodeLookup` واستخداماتها كلها. الـ UUID لا يحتاج `encodeURIComponent` ولا فك ترميز.
- `useProduct(id)` → `GET /products/${id}/` (للوحة التحكم).
- أضف `useProductBySlug(slug)` → `GET /products/by-slug/${encodeURIComponent(slug)}/` (للمتجر فقط).
- أضف `useCategoryBySlug(slug)` و `useCollectionBySlug(slug)`.
- `useUpdateProduct` و `useDeleteProduct` و `useUpdateCategory` و `useDeleteCategory` و `useUpdateCollection` و `useDeleteCollection` و `useProductSizes` و hook مصفوفة المتغيرات: غيّر المعامل من `lookup` إلى `id`، أي `{ id, ...input }`.
- مفاتيح الكاش: `catalogKeys.product(id)`، و `['product-sizes', id]`.

**مسارات لوحة التحكم — الملف `frontend/src/App.tsx`:**
- `products/:productSlugOrId` → `products/:productId`
- `products/:productSlugOrId/variants` → `products/:productId/variants`

**عدّل كل استخدام للـ slug في لوحة التحكم إلى `id`.** القائمة المعروفة حالياً:

| الملف | السطر (تقريبي) | الحالي | المطلوب |
|---|---|---|---|
| `pages/admin/Products.tsx` | 267, 281 | `row.slug` في الرابط | `row.id` |
| `pages/admin/Products.tsx` | 307 | `remove.mutateAsync(pendingDelete.slug)` | `pendingDelete.id` |
| `pages/admin/ProductEdit.tsx` | 49 | رابط variants بـ `product.slug` | `product.id` |
| `pages/admin/ProductEdit.tsx` | 70 | `lookup: product.slug` | `id: product.id` |
| `pages/admin/ProductNew.tsx` | 24 | `navigate(.../${slug})` بعد الإنشاء | استخدم `id` من استجابة الإنشاء |
| `pages/admin/ProductVariants.tsx` | 22, 67, 93, 109, 133, 152 | `prodSlug` / `product.data.slug` | `productId` من `useParams` |
| `pages/admin/Categories.tsx` | 43, 161 | `editing.slug` / `pendingDelete.slug` | `.id` |
| `pages/admin/Collections.tsx` | 140, 161 | `editing.slug` / `pendingDelete.slug` | `.id` |
| `pages/admin/Inventory.tsx` | 769, 787 | `lookup: product.id` | `id: product.id` (تغيير الاسم فقط) |

بعد التعديل، ابحث عن أي بقايا وأصلحها:
```bash
cd store-app/frontend/src
grep -rnE "\.slug|lookup|safeDecodeLookup|productSlugOrId" pages/admin components/admin lib/queries
```
افحص أيضاً `components/admin/CommandPalette.tsx` و `QuickOrderModal.tsx` و `Breadcrumbs.tsx` و `pages/admin/WidgetBuilder.tsx`: أي رابط إلى `/admin/products/...` يجب أن يستخدم الـ `id`.

**المتجر (Storefront):**
- `pages/storefront/ProductDetail.tsx`: يأخذ `slug` من الرابط ويستدعي `useProductBySlug(slug)`. وكل ما يأتي بعد ذلك (التقييمات، «يُشترى معاً»، الأحجام) يستخدم `product.id`.
- `lib/queries/reviews.ts`: `/catalog/products/${slug}/reviews/` → `/products/${productId}/reviews/`. **انتبه:** البادئة `/catalog/` في الرابط الحالي تبدو خاطئة، لأن المسار الفعلي `/api/products/...`. تحقق منه وأصلحه.
- `pages/storefront/CategoryListing.tsx` و `CollectionListing`: `useCategoryBySlug(slug)` ثم `/categories/${category.id}/products/`.
- `lib/queries/storefront.ts` و `search.ts`: أي استدعاء لـ `/categories/${slug}` أو `/products/${slug}` يتحول إلى `by-slug` أو إلى `id`.
- روابط المتجر العامة **تبقى بالـ slug** (`/products/${slug}` و `/categories/${slug}`)، لأنها روابط SEO.

### 1-ج. معايير القبول
- [ ] تعديل وحذف تصنيف أو مجموعة أو منتج اسمه عربي ينجح من لوحة التحكم.
- [ ] `grep -rn "safeDecodeLookup\|_find_by_slug_or_id" store-app` يرجع صفراً.
- [ ] كل مسارات الكتابة في `catalog/urls.py` تستخدم `<uuid:pk>`.
- [ ] صفحة منتج وصفحة تصنيف في المتجر تفتحان بالرابط العربي.
- [ ] كل الاختبارات تنجح.

---

## المهمة 2 — صفحة «إعدادات المتجر» (الأرقام والبيانات المصرفية) بتغيير شامل

### السبب
رقم الهاتف والواتساب والبيانات المصرفية مكتوبة يدوياً في الكود في عدة أماكن، وبعضها غير متطابق. تغيير أي منها يتطلب تعديل الكود ونشره من جديد. ملاحظة: الخطة القديمة `fixes/02_hardcoded_elements_audit_and_admin_control_plan.md` (المرحلة 3) ذكرت هذا، لكنه **لم يُنفَّذ**، فلا يوجد نموذج `StoreSettings` في الكود.

### الأماكن المكتوبة يدوياً حالياً (يجب أن تُقرأ كلها من الإعدادات)

| الملف | ما المكتوب يدوياً |
|---|---|
| `backend/apps/orders/notifications.py:68-72` | اسم المصرف، اسم المستفيد، رقم الحساب `0123456789`، الآيبان `LY88 0001 ...` (في رسالة واتساب التحويل المصرفي) |
| `backend/apps/orders/services.py:1127-1134, 1154` | بيانات الشركة في الفاتورة الرسمية: الاسم عربي وإنجليزي، رقم السجل التجاري `2024/09812`، المدينة `طرابلس، ليبيا`، الهاتف `0910000000`، الموقع `nasaeem.ly`، ورابط التحقق `https://nasaeem.ly/track` |
| `backend/apps/orders/views.py:1058, 1137` | رابط الموقع `https://nasaeem.ly/cart` في رسائل السلات المتروكة |
| `frontend/src/components/layout/Footer.tsx:83, 87` | العنوان `مصراتة — ليبيا` والهاتف `+218 91 000 0000` |
| `frontend/src/components/storefront/CategoriesDrawer.tsx:243` | رابط واتساب الدعم `https://wa.me/218915555555` |
| `frontend/src/pages/storefront/CheckoutComplete.tsx:70-88` | بطاقة البيانات المصرفية كاملة (نسخة ثانية من نفس البيانات) |
| `frontend/src/pages/admin/AdminOrderDetail.tsx:524` | قيمة احتياطية `'مصراتة — ليبيا'` لمدينة الشحن — استبدلها بـ `'—'` (ليست بيانات متجر) |

لاحظ أن العنوان في التذييل «مصراتة» بينما في الفاتورة «طرابلس»، وأن رقم الهاتف في التذييل يختلف عن رقم واتساب الدعم. هذا يؤكد الحاجة إلى مصدر واحد.

### 2-أ. الخادم — النماذج (Models)

أنشئ في `backend/apps/core/models.py`:

```python
class StoreSettings(models.Model):
    """Singleton: exactly one row (pk=1). Read through get_store_settings()."""
    # الهوية
    store_name = models.CharField("اسم المتجر", max_length=120, default="نسائم ليبيا")
    legal_name = models.CharField("الاسم القانوني", max_length=200, blank=True)
    legal_name_en = models.CharField("الاسم القانوني (إنجليزي)", max_length=200, blank=True)
    cr_number = models.CharField("رقم السجل التجاري", max_length=50, blank=True)
    address = models.CharField("العنوان", max_length=200, blank=True)
    site_url = models.URLField("رابط الموقع", default="https://nasaeem.ly")
    # التواصل
    phone = models.CharField("هاتف خدمة العملاء", max_length=20, blank=True)       # 09XXXXXXXX
    whatsapp = models.CharField("رقم واتساب", max_length=20, blank=True)          # 09XXXXXXXX
    email = models.EmailField("البريد الإلكتروني", blank=True)
    # نص إضافي يظهر مع تعليمات التحويل
    bank_transfer_note = models.TextField("ملاحظة التحويل المصرفي", blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)


class BankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bank_name = models.CharField("اسم المصرف", max_length=120)
    branch = models.CharField("الفرع", max_length=120, blank=True)
    account_holder = models.CharField("اسم المستفيد", max_length=200)
    account_number = models.CharField("رقم الحساب", max_length=40)
    iban = models.CharField("الآيبان", max_length=34, blank=True)
    is_active = models.BooleanField("مفعّل", default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "bank_name"]
```

- `BankAccount` نموذج منفصل (وليس حقلاً واحداً) لأن المتجر يعرض حالياً مصرفين («الجمهورية / التجاري الوطني»)، ولكل مصرف رقم حساب مختلف.
- تحقق من الأرقام في `clean()` أو في السيريالايزر:
  - `phone` و `whatsapp`: استخدم الدالة الموجودة في `backend/apps/accounts/phone.py` لتوحيد الرقم إلى `09XXXXXXXX`.
  - `iban`: احذف المسافات، ثم تحقق أنه يبدأ بـ `LY` وطوله 25 حرفاً (آيبان ليبيا). اسمح بتركه فارغاً.
  - `account_number`: أرقام فقط بعد حذف المسافات.
- **هجرة بيانات (data migration)** تنشئ صف `StoreSettings` وتضع فيه القيم الحالية من الجدول أعلاه، حتى لا يتغير شيء يراه العميل بعد النشر. وتنشئ `BankAccount` واحداً بالقيم الحالية.
- **سؤال لصاحب المتجر قبل البدء:** أي رقم هو الصحيح للهاتف وللواتساب (`0910000000` أم `0915555555`)؟ وأي عنوان هو الصحيح؟ القيم الحالية وهمية (مثل `0123456789`)، فضع في الهجرة القيم الحالية كما هي، والمدير يصححها من الصفحة الجديدة.

**دالة القراءة مع الكاش** — `backend/apps/core/store_settings.py`:
```python
CACHE_KEY = "store:settings:v1"

def get_store_settings() -> StoreSettings: ...   # get_or_create(pk=1), cached 24h
def get_public_store_settings() -> dict: ...     # dict عام + قائمة الحسابات المفعلة، cached
def invalidate_store_settings(): ...             # cache.delete(...)
```
- استدعِ `invalidate_store_settings()` في `post_save` و `post_delete` لكل من `StoreSettings` و `BankAccount`.
- امسح أيضاً كاش `store:product:*` إن كان حقن SEO يستخدم اسم المتجر.

**النسخ الاحتياطي:** افتح `backend/apps/core/backup_service.py` وتأكد أن النموذجين الجديدين يدخلان في النسخة الاحتياطية وفي الاسترجاع. إن كانت الخدمة تعدّد النماذج يدوياً فأضفهما. أضف اختباراً لذلك.

### 2-ب. الخادم — الـ API

| المسار | الصلاحية | الوصف |
|---|---|---|
| `GET /api/store-settings/` | `AllowAny` | الإعدادات العامة + الحسابات المصرفية المفعّلة. العميل يحتاج البيانات المصرفية ليحوّل المبلغ، فهي عامة. |
| `GET /api/admin/store-settings/` | `IsAdminOrOwner` | كل الحقول |
| `PUT /api/admin/store-settings/` | `IsAdminOrOwner` | تحديث (partial مسموح) |
| `GET /api/admin/bank-accounts/` / `POST` | `IsAdminOrOwner` | قائمة وإضافة |
| `PATCH/DELETE /api/admin/bank-accounts/<uuid:pk>/` | `IsAdminOrOwner` | تعديل وحذف **بالـ id** |

- الصلاحية `IsAdminOrOwner` لأن الملف `accounts/permissions.py` يصفها بأنها للبيانات المالية («bank secrets»).
- سجّل كل تعديل في سجل النشاط إن وُجد نظام لذلك (ابحث عن `AuditLog` أو ما يشبهه). وإن لم يوجد، فاكتفِ بـ `updated_at`.

### 2-ج. الخادم — استبدال القيم المكتوبة يدوياً
- `orders/notifications.py` → `format_bank_transfer_whatsapp_message`: كرّر كتلة البيانات المصرفية لكل `BankAccount` مفعّل، واستخدم `legal_name` و `bank_transfer_note`. إن لم يوجد أي حساب مفعّل فاكتب: «سيتواصل معك فريقنا لتزويدك ببيانات التحويل».
- `orders/services.py` → كتلة `company` في الفاتورة ورابط `verification_url`: من `get_store_settings()`.
- `orders/views.py:1058, 1137` → `f"{settings.site_url}/cart"`.
- **رابط واتساب بعد إتمام الطلب** (`orders/views.py:353-373`): الرابط الحالي `wa.me/<رقم العميل نفسه>`، أي أن العميل يفتح محادثة مع نفسه. الصحيح غالباً أن الرابط يفتح محادثة مع **رقم واتساب المتجر** ومعها نص الفاتورة جاهز للإرسال. **اسأل صاحب المتجر قبل تغيير هذا السلوك.** إن وافق فاستخدم `whatsapp` من الإعدادات، وحوّله إلى صيغة `218XXXXXXXXX`.

### 2-د. الواجهة — مصدر واحد للإعدادات
- **بدون طلب إضافي:** في `backend/apps/storefront/spa.py → render_shell` احقن الإعدادات العامة في `index.html`:
  `<script>window.__STORE_SETTINGS__ = {...json...}</script>`
  - استخدم `json.dumps(..., ensure_ascii=False)` واستبدل `</` بـ `<\/` لمنع كسر وسم `script`.
  - `index.html` لا يُخزَّن مؤقتاً (`no-cache` في `.htaccess`)، فيظهر أي تغيير فوراً.
- `frontend/src/lib/queries/storeSettings.ts`:
  - `useStoreSettings()` → `useQuery({ queryKey: ['store-settings'], queryFn: GET /store-settings/, initialData: window.__STORE_SETTINGS__, staleTime: 10 * 60_000 })`.
  - في وضع التطوير (`vite dev`) لا يوجد حقن، فيُستدعى الـ API.
  - hooks الإدارة: `useAdminStoreSettings` و `useUpdateStoreSettings` و `useBankAccounts` و `useCreateBankAccount` و `useUpdateBankAccount({ id, ... })` و `useDeleteBankAccount(id)`. كل تعديل يعمل `invalidateQueries(['store-settings'])`.
- دالة مساعدة `lib/format.ts → formatLibyanPhone(p)` تعرض الرقم `+218 91 234 5678`، ودالة `whatsappUrl(p, text?)` تبني الرابط.
- استبدل القيم المكتوبة يدوياً في:
  - `Footer.tsx` (العنوان والهاتف، وأضف رابط `tel:`).
  - `CategoriesDrawer.tsx` (رابط الواتساب).
  - `CheckoutComplete.tsx` (بطاقة لكل حساب مصرفي مفعّل، مع زر «نسخ» لرقم الحساب والآيبان).
- تأكد أن `OfficialInvoice.tsx` يعرض القيم القادمة من API الفاتورة، وهي الآن من الإعدادات. لا يحتاج تغييراً إن كان يقرأ `data.company`.

### 2-هـ. الواجهة — صفحة الإدارة `/admin/settings`
- الملف `frontend/src/pages/admin/StoreSettings.tsx`.
- في `App.tsx`: `{ path: 'settings', element: withSuspense(<AdminStoreSettings />) }`.
- في `AdminLayout.tsx`: عنصر قائمة «إعدادات المتجر» بأيقونة `Settings` من lucide، يظهر فقط للأدوار Admin و Owner (بنفس طريقة إخفاء بقية العناصر حسب الدور).
- أضف الصفحة أيضاً إلى `CommandPalette.tsx`.
- **الأقسام:**
  1. **هوية المتجر:** اسم المتجر، الاسم القانوني عربي وإنجليزي، السجل التجاري، العنوان، رابط الموقع.
  2. **التواصل:** هاتف خدمة العملاء، رقم الواتساب (مع زر «تجربة» يفتح `wa.me`)، البريد.
  3. **الحسابات المصرفية:** جدول بالحسابات مع أزرار إضافة وتعديل وحذف (نافذة `ConfirmDialog` الموجودة)، ومفتاح «مفعّل»، وترتيب. كل العمليات بالـ `id`.
  4. **ملاحظة التحويل** (نص حر).
  5. **معاينة حيّة:** كيف ستظهر بطاقة التحويل للعميل، وكيف سيظهر التذييل.
- النموذج بـ `react-hook-form` + `zod` مثل بقية نماذج اللوحة، مع رسائل خطأ عربية («رقم الهاتف غير صحيح، مثال: 0912345678»، «الآيبان يجب أن يبدأ بـ LY ويتكون من 25 خانة»).
- زر «حفظ»، ثم رسالة نجاح: «تم الحفظ — سيظهر التغيير في كل المتجر فوراً».

### 2-و. الاختبارات
- الخادم:
  - الـ API العام يعيد الحسابات المفعّلة فقط.
  - تعديل الإعدادات يمسح الكاش، والاستدعاء التالي يعيد القيمة الجديدة.
  - العميل وموظف المبيعات يحصلان على 403 عند محاولة التعديل.
  - التحقق من الآيبان ومن رقم الهاتف.
  - رسالة واتساب التحويل تحتوي رقم الحساب الجديد بعد تغييره.
  - الفاتورة تحتوي الهاتف الجديد.
  - `render_shell` يحقن `__STORE_SETTINGS__`.
- الواجهة: اختبار vitest لـ `formatLibyanPhone` و `whatsappUrl`.

### 2-ز. معايير القبول
- [ ] `grep -rnE "0123456789|LY88|915555555|91 000 0000|0910000000|2024/09812" store-app/backend/apps store-app/frontend/src` لا يرجع إلا ملفات الاختبارات والهجرات و `seed_demo.py`.
- [ ] تغيير رقم الواتساب من `/admin/settings` يظهر فوراً (بعد تحديث الصفحة) في التذييل، ودرج التصنيفات، وصفحة إتمام الطلب، ورسالة واتساب الطلب، والفاتورة، بدون نشر جديد.
- [ ] إضافة حساب مصرفي ثانٍ تظهر في صفحة إتمام الطلب وفي رسالة الواتساب.

---

## المهمة 3 — تقليل الطلبات وأحجام الصور لتسريع المتجر

### ما وُجد أثناء الفحص (2026-09-27)
1. **ملفات JS و CSS والخطوط والصور يقدّمها Django عبر `django.views.static.serve`** (`backend/config/urls.py`). هذه الدالة:
   - **لا تضغط** الملفات (لا gzip ولا brotli).
   - **لا ترسل `Cache-Control`**. ترسل فقط `Last-Modified`، فيسأل المتصفح الخادم عن **كل ملف في كل زيارة** (طلب 304 لكل ملف).
   - تمرّ عبر Python/Passenger، وهذا أبطأ بكثير من الخادم نفسه.
   قواعد الكاش في `.htaccess` لا تُطبَّق غالباً، لأن Passenger يستقبل كل المسارات. **هذا أكبر سبب للبطء.**
2. **صور البانر ضخمة:** `media/banners/hero-desktop.jpg` بحجم 719KB، و `hero-mobile.jpg` بحجم 667KB، و `promo-royal-oud.jpg` بحجم 817KB. وهي JPG بدون نسخ مصغرة، وهي أول ما يُحمَّل في الصفحة الرئيسية.
3. **مجلد `backend/dist/assets` يحتوي 579 ملفاً** من بناءات قديمة متراكمة (نسخ عديدة من `index-*.js`). لا تؤثر على المتصفح مباشرة، لكنها تضخّم النشر والنسخ الاحتياطي.
4. **نظامان للصور المصغرة:** `catalog/services.py → RENDITIONS = {thumb:200, medium:600, full:1200}` و `catalog/images.py → IMAGE_DERIVATIVES = {thumb, card:600, hero:1600}` بجودة 85. يجب توحيدهما.
5. **صور تُعرض بوسم `<img>` مباشرة بالحجم الكامل** بدل النسخة المصغرة، في: `CartDrawer.tsx:143`، `InstantSearchModal.tsx:212`، `FrequentlyBoughtTogether.tsx:74`، `FragranceFinderQuizModal.tsx:331`، `CategoriesDrawer.tsx:192`، `VerifiedPhotoReviews.tsx:195`، `widgets/CatalogWidgets.tsx:200`، `widgets/SimpleWidgets.tsx:30,93`، `widgets/Carousel.tsx:39`، `widgets/HeroCta.tsx:42`.

### 3-0. القياس أولاً (إلزامي — قبل أي تعديل وبعده)
- على الموقع الحقيقي:
  ```bash
  curl -sI -H "Accept-Encoding: br, gzip" https://nasaeem.ly/assets/<اسم ملف index-*.js الحالي>
  ```
  سجّل `Content-Encoding` و `Cache-Control` و `Content-Length`.
- شغّل `scripts/perf.mjs` (Lighthouse على الجوال، 3 مرات) على الصفحة الرئيسية وصفحة منتج.
- سجّل من تبويب Network: عدد الطلبات، الحجم المنقول، LCP.
- ضع الأرقام **قبل وبعد** في جدول ضمن رسالة الـ commit أو في ملف `fixes/04_results.md`.

### 3-أ. تقديم الملفات الثابتة بضغط وكاش (أهم بند)
1. أضف `whitenoise[brotli]` إلى `backend/requirements.txt`.
2. في `settings.py`:
   - `"whitenoise.middleware.WhiteNoiseMiddleware"` مباشرة بعد `SecurityMiddleware`.
   - `WHITENOISE_ROOT = BASE_DIR / "dist"` لتقديم `assets/` و `fonts/` و `brand/` و `favicon.svg` وغيرها من جذر `dist`.
   - `WHITENOISE_IMMUTABLE_FILE_TEST`: دالة تعيد `True` للملفات تحت `/assets/` (أسماؤها تحتوي hash)، فتُرسل `Cache-Control: max-age=31536000, immutable`.
   - `WHITENOISE_MAX_AGE = 3600` لبقية الملفات.
   - استثنِ `sw.js` و `manifest.webmanifest` و `index.html` لتُرسل بـ `no-cache` (عبر `WHITENOISE_ADD_HEADERS_FUNCTION`).
3. احذف مسارات `serve` الخاصة بـ `assets` و `fonts` و `brand` و `brands` و `providers` و `favicon` و `sw` و `manifest` من `config/urls.py`، لأن WhiteNoise يستقبلها قبل Django. أبقِ الاستثناءات في regex الـ SPA shell كما هي.
4. **الضغط المسبق:** أضف `vite-plugin-compression2` إلى `vite.config.ts` لإنتاج ملفات `.br` و `.gz` بجانب كل ملف JS و CSS و SVG. WhiteNoise يقدّم النسخة المضغوطة تلقائياً إن وُجدت.
5. **الصور (`/media/`):** WhiteNoise لا يقدّم ملفات تُرفع أثناء التشغيل، لذلك:
   - أبقِ `serve` للمسار `/media/` لكن غلّفه بدالة تضيف `Cache-Control: public, max-age=2592000` (30 يوماً).
   - تحقق أن `store_image` يولّد **أسماء ملفات فريدة** لكل رفع (uuid أو hash). إن كانت فريدة فاستخدم `immutable` مع سنة كاملة.
6. **جرّب على الخادم** أن LiteSpeed يقدّم الملفات مباشرة بدون المرور على Passenger. هذا أسرع، لكنه قد لا يعمل مع `PassengerBaseURI "/"`. إن لم يعمل فالحل السابق (WhiteNoise) كافٍ.

**القبول:** `curl -I` على ملف تحت `/assets/` يُظهر `content-encoding: br` (أو gzip) و `cache-control: max-age=31536000, immutable`. وفي الزيارة الثانية لا توجد طلبات 304 للملفات الثابتة (كلها «from disk cache»).

### 3-ب. تنظيف ناتج البناء
- أنشئ `scripts/build-frontend.sh`:
  ```bash
  set -euo pipefail
  cd "$(dirname "$0")/../frontend"
  npm run build
  rm -rf ../backend/dist
  cp -R dist ../backend/dist
  ```
  حافظ على ملف `.htaccess` الخاص بـ `backend/dist`: انسخه من `frontend/public/.htaccess` إن كان مطابقاً، أو احفظه مؤقتاً قبل الحذف وأعده بعد النسخ. **لا تفقد أسطر إعداد Passenger في أعلاه.**
- اكتب هذا الإجراء في `deploy/README.md`.

### 3-ج. الصور
1. **توحيد نظام المصغّرات:** اعتمد نظاماً واحداً بالأحجام `thumb=200` و `card=600` و `full=1200` و `hero=1920` (للبانرات فقط). اجعل الملفين يستخدمان نفس الثابت، وحدّث `rendition_urls` والاختبارات في `test_performance_and_caching.py`.
2. **الجودة:** WebP بجودة `78` بدل `85`، مع `method=6`. الفرق غير ملحوظ بصرياً، والحجم ينخفض بنحو 25–35%.
3. **ضغط الصور عند الرفع لكل الصور** وليس صور المنتجات فقط: تأكد أن `ImageUploadView` (`/api/images/`) يولّد المصغّرات للبانرات وصور التصنيفات وصور الـ widgets أيضاً. `ImageUploadField.tsx` يضغط في المتصفح أولاً، وهذا جيد، فأبقه.
4. **أمر إدارة `optimize_media`** (`backend/apps/catalog/management/commands/optimize_media.py`):
   - يمر على كل ملفات `media/` من نوع `jpg` و `jpeg` و `png`، ويولّد لها نسخ WebP بالأحجام أعلاه.
   - يحدّث الروابط المخزنة في قاعدة البيانات: `ProductImage.url`، `Category.image_url`، وتخطيطات المتجر في `storefront` (حقول مثل `desktopImageUrl` و `mobileImageUrl` داخل JSON).
   - يدعم `--dry-run`، ويطبع قبل كل تغيير: الحجم القديم والجديد.
   - **لا يحذف الأصل** إلا مع `--delete-originals`.
   - الهدف: كل بانر أقل من 200KB لسطح المكتب وأقل من 100KB للجوال.
   - ملاحظة: الهجرة `storefront/migrations/0002_populate_default_luxury_storefront.py` تشير إلى `hero-desktop.jpg`. **لا تعدّل هجرة قديمة.** الأمر `optimize_media` يحدّث البيانات الفعلية في قاعدة البيانات.
5. **عرض الصور في الواجهة:**
   - كل صورة منتج تمر عبر المكوّن الموجود `ProductImage.tsx` (فيه `srcset` جاهز)، أو عبر مكوّن جديد عام `ResponsiveImage` لبقية الصور.
   - طبّق ذلك على كل الملفات في البند 5 من «ما وُجد».
   - الصور الصغيرة (السلة، البحث، الدرج، «يُشترى معاً»): استخدم `thumb` مع `sizes="64px"`.
   - بطاقات الشبكة: `sizes="(max-width: 640px) 50vw, 25vw"`.
   - كل `<img>` يجب أن يحمل `width` و `height` (لمنع قفز الصفحة CLS)، و `decoding="async"`، و `loading="lazy"` لكل صورة تحت أول شاشة.
   - `HeroCta.tsx` و `Carousel.tsx`: الصورة الأولى فقط `loading="eager"` مع `fetchPriority="high"`، والبقية `lazy`. وأضف `srcSet` بأحجام `hero` و `full` داخل `<source>`.
   - في `render_shell` أضف `<link rel="preload" as="image" imagesrcset=... fetchpriority="high">` لصورة البانر الأولى في الصفحة الرئيسية.

### 3-د. تقليل عدد طلبات الـ API
1. **حقن البيانات الأولية في `index.html`** (بنفس طريقة `__STORE_SETTINGS__` في المهمة 2):
   - `window.__BOOTSTRAP__ = { layout, categories, storeSettings }` في الصفحة الرئيسية.
   - في الـ hooks استخدم `initialData` من `__BOOTSTRAP__`، ثم امسح القيمة بعد أول استخدام حتى لا تبقى قديمة.
   - هذا يزيل 2–3 طلبات عند أول تحميل.
2. **staleTime** أطول للبيانات التي تتغير نادراً: التصنيفات والتخطيط والإعدادات `10 * 60_000`. الافتراضي الحالي `30_000` في `App.tsx:87`، أبقه للبقية.
3. **راجع تبويب Network للصفحة الرئيسية وصفحة المنتج:**
   - أي طلب مكرر (نفس الرابط مرتين) → وحّد `queryKey`.
   - أي widget يطلب منتجاته بطلب منفصل → اجعل `/storefront/layout/` يعيد منتجات كل widget ضمن نفس الاستجابة إن كان ذلك ممكناً دون كسر الكاش.
   - طلبات `me/` والسلة للزائر غير المسجل: لا تُرسل إلا إن وُجدت جلسة أو كوكي سلة.
4. **الخطوط:** تأكد أنها `woff2`، ومع `font-display: swap`، و `preload` للخط الأساسي فقط. إن كان الخط العربي كبيراً (>100KB) فاعمل subset للحروف العربية واللاتينية الأساسية.
5. **الأيقونات:** حجم الـ chunk الحالي `icons-*.js` نحو 51KB. ابحث عن أي `import * as Icons from 'lucide-react'` أو خريطة أيقونات ديناميكية كبيرة في `WidgetBuilder` أو `AnnouncementBar`، واجعلها قائمة محدودة. الهدف أقل من 25KB.
6. **Service Worker** (`sw.js`، الإصدار v3 حالياً): أضف استراتيجية `stale-while-revalidate` لـ `/media/` (مع حد أقصى 150 صورة)، و `cache-first` لـ `/assets/`. **ارفع الإصدار إلى v4.**

### 3-هـ. معايير القبول (قِسها بـ Lighthouse جوال عبر `scripts/perf.mjs`)
- [ ] الملفات الثابتة مضغوطة (br أو gzip) ومعها `immutable`.
- [ ] الزيارة الثانية: صفر طلبات 304 للملفات الثابتة.
- [ ] حجم الصفحة الرئيسية المنقول في الزيارة الأولى ينخفض **50% على الأقل** عن القياس الأول.
- [ ] LCP على الجوال أقل من 2.5 ثانية في Lighthouse (Slow 4G).
- [ ] طلبات الـ API في الصفحة الرئيسية عند أول تحميل: 2 أو أقل.
- [ ] لا توجد صورة في الصفحة الرئيسية أكبر من 200KB.
- [ ] كل الاختبارات تنجح.

---

## 4. النشر على الخادم (بعد الموافقة على كل مهمة)
```bash
cd ~/nasaeem-libya/store-app/backend
source /home/nasaeeml/virtualenv/nasaeem-libya/store-app/backend/3.13/bin/activate
pip install -r requirements.txt          # whitenoise
python manage.py migrate                 # StoreSettings + BankAccount + بياناتها
python manage.py optimize_media --dry-run
python manage.py optimize_media
touch tmp/restart.txt                    # إعادة تشغيل Passenger
```
- **خذ نسخة احتياطية قبل النشر:** `python manage.py create_system_backup`.
- بعد النشر:
  1. افتح `/admin/settings` وضع الأرقام والبيانات المصرفية **الحقيقية**.
  2. تحقق من التذييل وصفحة إتمام الطلب.
  3. أعد قياس الأداء.

## 5. قرارات مطلوبة من صاحب المتجر (اسأل قبل التنفيذ)
1. رابط واتساب بعد الطلب: هل يفتح محادثة مع **رقم المتجر**؟ (حالياً يفتح محادثة مع رقم العميل نفسه.)
2. الرقم والعنوان الصحيحان الآن. في الكود قيمتان مختلفتان لكل منهما.
3. هل يُعرض أكثر من حساب مصرفي للعميل، أم حساب واحد فقط؟
