# قائمة الرفع على الخادم الحي — خطة 8 كاملة — 26 أكتوبر 2026

> لصاحب المتجر. نفّذ الخطوات بالترتيب، وتحقق بعد كل خطة قبل الانتقال للتي بعدها.
> المصدر: القسم 4 في `fixes/09_handoff_2026-10-26.md`، و`store-app/deploy/README.md`.
> **لا تحذف شيئاً في `public_html`، ولا نسخة يناير 2025 الاحتياطية (`tar.gz`).**

---

## 1. ما الذي سيُرفع

| ما يتغير | التفاصيل |
|---|---|
| الكود | خطة 8 كاملة: الإخفاء، ومقاسات الصور ونسخ الجوال، والمتجر بالإنجليزية تحت `/en/`، وملف العميل (CRM) |
| الترحيلات | ثلاثة: `catalog 0007_english_fields` و`core 0012_city_region_name_en` و`core 0013_customer_crm` |
| أوامر لمرة واحدة | `make_mobile_copies` للمعاينة، ثم `--apply` |
| المكتبات | لا جديد في `requirements.txt` منذ ما قبل خطة 8 |
| الواجهة | `store-app/backend/dist` يُنسخ إلى `~/shop` |

الترحيلات الثلاثة تضيف أعمدة وجداول فقط، ولا تحذف شيئاً. `core 0012` يملأ الأسماء الإنجليزية للمدن.

---

## 2. قبل البدء (فحص مسبق)

- [ ] وقت هادئ، بلا طلبات جارية. الرفع كله يأخذ 10–15 دقيقة.
- [ ] دخول SSH أو «Terminal» في cPanel يعمل.
- [ ] مساحة كافية لنسختين من `db.sqlite3` ونسخة من `~/shop`:
  ```bash
  df -h ~ && du -sh ~/nasaeem-libya/store-app/backend/db.sqlite3 ~/shop
  ```
- [ ] لا تعديلات محلية على الخادم سوى الملف المعروف `storefront/0003_alter_widget_type.py`:
  ```bash
  cd ~/nasaeem-libya && git status --short
  ```
  إن ظهر غيره فتوقّف وأرسله لي.
- [ ] **سجّل رقم النسخة الحالية**، فهو نقطة الرجوع:
  ```bash
  cd ~/nasaeem-libya && git rev-parse HEAD > ~/commit-before-deploy-$(date +%F).txt && cat ~/commit-before-deploy-$(date +%F).txt
  ```
- [ ] الموقع يعمل الآن (لتعرف أن أي عطل بعدها من الرفع):
  ```bash
  curl -s https://shop.nasaeemlibya.ly/api/health/        # {"status":"ok",...}
  ```

---

## 3. خطوات الرفع

### الخطوة 1: النسخ الاحتياطي
```bash
cd ~/nasaeem-libya/store-app/backend
source /home/nasaeeml/virtualenv/nasaeem-libya/store-app/backend/3.13/bin/activate
python manage.py create_system_backup
cp db.sqlite3 ~/db-before-deploy-$(date +%F).sqlite3
cp -a ~/shop ~/shop-backup-$(date +%F)
```
**تحقق:**
- [ ] `create_system_backup` طبع رسالة نجاح، وملف `.zip` جديد في `store-app/backend/backups/`.
- [ ] الملف `~/db-before-deploy-…sqlite3` موجود وبحجم الأصل نفسه: `ls -l db.sqlite3 ~/db-before-deploy-*.sqlite3`.
- [ ] المجلد `~/shop-backup-…` موجود.

### الخطوة 2: سحب الكود
```bash
cd ~/nasaeem-libya && git pull && cd store-app/backend
```
**تحقق:**
- [ ] `git log --oneline -1` يعرض آخر تعديل على `main` (حالياً `ebbe61d` أو أحدث).
- [ ] `git status --short` لا يعرض إلا `storefront/0003_alter_widget_type.py`.

### الخطوة 3: الترحيلات
```bash
python manage.py showmigrations | grep "\[ \]"
python manage.py migrate --plan
python manage.py migrate
```
**تحقق:**
- [ ] `showmigrations` يعرض الثلاثة فقط: `catalog 0007_english_fields` و`core 0012_city_region_name_en` و`core 0013_customer_crm`. إن ظهر غيرها، أو ظهر شيء من `storefront`، فتوقّف.
- [ ] `migrate` ينتهي بـ `OK` لكل واحد.
- [ ] `python manage.py showmigrations | grep "\[ \]"` لا يطبع شيئاً بعدها.
- [ ] **لا تشغّل `makemigrations` أبداً على الخادم.**

### الخطوة 4: نسخ الجوال للبانرات القديمة
```bash
python manage.py make_mobile_copies            # معاينة فقط
python manage.py make_mobile_copies --apply    # يكتب النسخ الناقصة
```
**تحقق:**
- [ ] المعاينة تذكر البانرات التي ستُصنع لها نسخة. لا تحذف ولا تغيّر أي ملف موجود.
- [ ] بعد `--apply`، تشغيل المعاينة مرة ثانية لا يذكر شيئاً ناقصاً.

### الخطوة 5: إعادة تشغيل Django
```bash
touch tmp/restart.txt
curl -s https://shop.nasaeemlibya.ly/api/health/
```
**تحقق:**
- [ ] الرد `{"status":"ok","database":"ok","cache":"ok"}`. إن جاء `503` أو `degraded` فانتقل إلى «الرجوع» (القسم 5).
- [ ] `curl -s -o /dev/null -w "%{http_code}\n" https://shop.nasaeemlibya.ly/api/store-settings/` يطبع `200`.

### الخطوة 6: نشر الواجهة في `~/shop`
```bash
cd ~/nasaeem-libya/store-app/backend/dist
tar cf - --exclude='./.htaccess' --exclude='./media' . | (cd ~/shop && tar xf -)
cd ..
```
- لا `rsync` على الخادم، وأمر `tar` هذا بديله.
- **`.htaccess` في `~/shop` إعداد الخادم، و`media` صور المتجر الحقيقية. الاستثناءان لا غنى عنهما.**
- الأمر يضيف ويستبدل فقط، ولا يحذف شيئاً من `~/shop`.

**تحقق:**
- [ ] `curl -sI https://shop.nasaeemlibya.ly/ | grep -i "^last-modified"` يعرض تاريخ اليوم.
- [ ] `ls -la ~/shop/.htaccess` ما زال موجوداً بتاريخه القديم.

### الخطوة 7: مسح ذاكرة المتصفح
عامل الخدمة (`sw.js`) يحتفظ بالنسخة القديمة.
- على الحاسوب: افتح الموقع، ثم `Ctrl+Shift+R`. إن بقيت القديمة: أدوات المطوّر ← Application ← Service Workers ← Unregister، ثم Clear site data.
- على الهاتف: إعدادات المتصفح ← بيانات المواقع ← `shop.nasaeemlibya.ly` ← مسح.

---

## 4. التجربة بعد الرفع (حاسوب وهاتف)

| ما تجرّبه | الرابط | المتوقع |
|---|---|---|
| الصفحة الرئيسية | `/` | البانرات والمنتجات بالعربية |
| المتجر بالإنجليزية | `/en/` | نفس الصفحة بالإنجليزية، وزر اللغة يرجع للعربية |
| البحث بلا همزة | ابحث «الاصيل» | يجد «الأصيل» |
| قسم ومنتج | أي قسم ثم أي منتج | الصور والسعر والمقاسات |
| السلة وإتمام الطلب | أضف منتجاً ثم افتح السلة | تصل إلى نموذج الطلب. **لا تؤكد طلباً حقيقياً** إلا إن أردت إلغاءه بعدها |
| تتبّع الطلب | `/track` | البحث برقم طلب قديم يعمل |
| لوحة التحكم | `/admin` | الأرقام تظهر |
| العملاء (جديد) | `/admin/users` | القائمة تعمل، والدرج يفتح بالعدد والإنفاق |
| نصوص المتجر | `/admin/texts` | حقل «بالإنجليزية» موجود |
| المدن | `/admin/cities` | الاسم الإنجليزي ممتلئ |
| الخادم | `/api/health/` | `"status":"ok"` |

إن تعطل شيء واحد من هذه، صوّر الشاشة وأرسلها قبل أي محاولة إصلاح.

---

## 5. الرجوع (إن تعطل الموقع)

الأوامر تفترض أن الرجوع في يوم الرفع نفسه. إن كان في يوم آخر، فضع تاريخ يوم الرفع بدل `$(date +%F)`.

**نبّه:** إرجاع قاعدة البيانات يمحو أي طلب وصل بعد النسخة الاحتياطية. سجّل أرقام هذه الطلبات من لوحة التحكم أولاً إن استطعت.

```bash
cd ~/nasaeem-libya/store-app/backend
source /home/nasaeeml/virtualenv/nasaeem-libya/store-app/backend/3.13/bin/activate

# 1. قاعدة البيانات كما كانت (احتفظ بالمعطوبة للفحص)
cp db.sqlite3 ~/db-failed-deploy-$(date +%F).sqlite3
cp ~/db-before-deploy-$(date +%F).sqlite3 db.sqlite3

# 2. الكود كما كان (الرقم من الفحص المسبق)
cd ~/nasaeem-libya && git checkout $(cat ~/commit-before-deploy-$(date +%F).txt) && cd store-app/backend

# 3. إعادة التشغيل
touch tmp/restart.txt

# 4. الواجهة كما كانت (نسخة فوق نسخة، بلا حذف)
cd ~/shop-backup-$(date +%F) && tar cf - --exclude='./.htaccess' --exclude='./media' . | (cd ~/shop && tar xf -)
```
**تحقق:**
- [ ] `curl -s https://shop.nasaeemlibya.ly/api/health/` يعطي `ok`.
- [ ] الموقع يعمل كما كان قبل الرفع، بعد مسح ذاكرة المتصفح.
- [ ] **لا ترجع الترحيلات بـ `migrate` للخلف.** إرجاع الملف يكفي.
- بعد الرجوع، الكود على نسخة قديمة منفصلة عن `main`. للعودة لاحقاً: `git checkout main`.
- ملفات `-mobile.webp` التي كتبها `make_mobile_copies` تبقى، ولا تضر.

---

## 6. بروفة الترحيل محلياً

قبل الرفع، يمكنك إرسال نسخة من قاعدة البيانات الحية لأجرّب عليها الترحيل محلياً، فنعرف النتيجة قبل أن يراها العملاء.

### كيف ترسلها
1. على الخادم، نسخة متسقة حتى والموقع يعمل:
   ```bash
   cd ~/nasaeem-libya/store-app/backend
   python -c "import sqlite3; s=sqlite3.connect('db.sqlite3'); d=sqlite3.connect('/home/nasaeeml/db-rehearsal.sqlite3'); s.backup(d); d.close()"
   ```
2. نزّل `~/db-rehearsal.sqlite3` من «مدير الملفات» في cPanel، ثم احذفه من الخادم (هذه النسخة فقط).
3. أرسله بطريقة خاصة، لا في مكان عام: فيه بيانات العملاء وأرقام هواتفهم.

### ما سيُفحص عليها
- `showmigrations`: الناقص هو الثلاثة المتوقعة فقط، ولا شيء من `storefront`.
- `migrate --plan` ثم `migrate`: كل ترحيل ينتهي بلا خطأ، والوقت الذي يأخذه.
- عدد المنتجات والأقسام والطلبات والعملاء والمدن قبل الترحيل وبعده: يجب أن يبقى نفسه.
- الأسماء الإنجليزية للمدن بعد `core 0012`.
- `python manage.py check`، ثم المتجر بالعربية والإنجليزية ولوحة التحكم في المتصفح بهذه البيانات: قائمة العملاء، والطلبات، والمنتجات.
- `make_mobile_copies` للمعاينة فقط. الصور نفسها ليست في النسخة، فالنتيجة تقريبية.
- بعد البروفة تُحذف النسخة من الجهاز المحلي، وأكتب لك النتيجة في ملف هنا.
