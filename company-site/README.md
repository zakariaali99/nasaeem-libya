# موقع الشركة التعريفي — nasaeemlibya.ly

صفحة واحدة ثابتة بلغتين: العربية على `/` والإنجليزية على `/en/`. الخطة: `fixes/13_plan_company_site_2026-10-26.md`.

## تعديل المحتوى
كل النصوص والأرقام والروابط في `content.json` فقط:
- `site`: الهاتف الرسمي، واتساب، البريد، رمز الخريطة، رابط المتجر، روابط التواصل.
- `brands`: شعارات الماركات (الملفات في `assets/img/brands/`). لإضافة ماركة: ضع ملفها هناك وأضف سطراً.
- `distributors`: الموزعون بلغتين، والهواتف بالصيغة المحلية (`091...`)؛ البناء يحوّلها إلى `tel:+218...`.
- `photos`: أماكن صور الشركة الخاصة (فارغة حالياً فيظهر نقش بألوان الهوية). ضع الصورة في `assets/img/photos/` واكتب مسارها، مثل `/assets/img/photos/about.jpg`.
- `ar` و`en`: نصوص كل لغة.

## البناء
من جذر المستودع، بلا أي مكتبات:
```bash
python3 company-site/build.py
```
يحذف `dist/` ويولّده من جديد: `dist/index.html` و`dist/en/index.html` والأصول و`sitemap.xml` و`robots.txt`.
للمعاينة: `python3 -m http.server 8090 --directory company-site/dist` ثم `http://localhost:8090/`.

## الرفع (صاحب المتجر)
1. نسخة من `public_html` إلى Google Drive.
2. تفريغ `public_html` مع إبقاء `.well-known/` و`cgi-bin/`.
3. رفع محتويات `dist/` إلى `public_html/`:
   ```bash
   tar czf company-site.tar.gz -C company-site/dist .
   # ثم على الخادم داخل public_html:
   tar xzf company-site.tar.gz
   ```
4. الفحص: `https://nasaeemlibya.ly/` و`/en/` على الحاسوب والهاتف، وزر «تسوّق الآن» يفتح المتجر.

الخطوط والشعارات منسوخة من `store-app/frontend/public/`؛ إن تغيّرت هناك تُنسخ يدوياً إلى `assets/`.
