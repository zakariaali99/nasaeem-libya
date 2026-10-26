# التنظيف والرفع: حذف القديم، ونشر المتجر، ورفع موقع الشركة — 26 أكتوبر 2026

> لصاحب المتجر. على الخادم في «Terminal» من cPanel. نفّذ المراحل بالترتيب ولا تتجاوز مرحلة قبل فحصها.
> **الحذف قرارك أنت وبيدك؛ لا أمر حذف هنا يُنفَّذ قبل أن تصل النسخة إلى Google Drive وتفتحها هناك.**
> المرجع التفصيلي لرفع المتجر (الفحص والرجوع): `fixes/10_deploy_checklist.md`.

---

## المرحلة 0: ما يُحفظ في Google Drive أولاً

المساحة الحرة نحو 500 MB فقط، فلا يمكن ضغط `public_html` كاملاً (1.3 GB). لذلك نحفظ ما له قيمة فقط؛ النسخة الكاملة لووردبريس موجودة أصلاً في ملف يناير 2025.

1. من «File Manager» نزّل هذه الملفات إلى جهازك ثم ارفعها إلى Drive:
   - `/home/nasaeeml/backup-1.23.2025_17-43-27_nasaeeml.tar.gz` (819 MB: الموقع القديم كاملاً بقاعدته).
   - `/home/nasaeeml/old-site/old-site-part1.tar.gz` (و`part2` إن كنت صنعته).
2. أرشيف صغير لأصول الشركة التي ليست في نسخة يناير (صور الجذر، والرفع بعد يناير 2025):
   ```bash
   cd ~/public_html && df -h ~ | tail -1
   tar czf ~/company-assets-2026-10-26.tar.gz \
     --exclude='wp-content/backuply' --exclude='wp-content/ai1wm-backups' \
     --exclude='wp-content/cache' --exclude='wp-content/plugins' \
     --exclude='wp-content/themes' --exclude='wp-content/languages' \
     --exclude='wp-admin' --exclude='wp-includes' \
     . ; ls -lh ~/company-assets-2026-10-26.tar.gz
   ```
   نزّله إلى Drive ثم احذفه من الخادم: `rm ~/company-assets-2026-10-26.tar.gz`.
3. احفظ ملف `.htaccess` القديم (قد يحوي سطوراً من cPanel):
   ```bash
   cp ~/public_html/.htaccess ~/public_html-htaccess-old.txt; cat ~/public_html-htaccess-old.txt
   ```
   أرسل لي ما طُبع.

**تحقق قبل المرحلة 1:** افتح الملفات الثلاثة في Drive وتأكد من أحجامها.

---

## المرحلة 1: الحذف (ينزل الاستهلاك من 87% إلى نحو 50%)

كل سطر مستقل؛ نفّذها واحداً واحداً:
```bash
rm ~/backup-1.23.2025_17-43-27_nasaeeml.tar.gz                          # 819 MB، صار في Drive
rm -r ~/public_html/wp-content/backuply ~/public_html/wp-content/ai1wm-backups   # 546 MB نسخ ووردبريس قديمة
rm -r ~/shop-backup-2026-09-28 ~/shop-backup-2026-09-28-1227 ~/shop-backup-2026-10-10 ~/shop-backup-2026-10-13   # 85 MB، نسخ واجهة قديمة
rm ~/db-before-deploy-2026-09-28.sqlite3
rm -r ~/.cache/pip ~/tmp/RCMTEMPattmnt*                                  # 58 MB مخازن مؤقتة
rm -r ~/old-site                                                         # بعد وصوله إلى Drive
rm "$(ls -d ~/nasaeem-libya/passenger_wsgi.py* | grep -v 'passenger_wsgi.py$' | head -1)"   # الملف الغريب المنتهي بـ tab
rm -r ~/nasaeem-libya/store-app/backend/store-app                        # مجلد مكرر بالخطأ
```
`test.nasaeemlibya.ly` (100 MB): احذف النطاق الفرعي أولاً من cPanel ← Domains، ثم `rm -r ~/test.nasaeemlibya.ly`.

لا تلمس: `~/mail` (بريدكم، 586 MB؛ تفريغ Trash وSpam يكون من Webmail)، `~/virtualenv`، `~/shop`، `~/nasaeem-libya`، `~/tmp/awstats|webalizer|analog` (إحصاءات cPanel).

**تحقق:**
```bash
df -h ~ | tail -1
cd ~/nasaeem-libya && git status --short      # يجب ألا يظهر إلا storefront/0003_alter_widget_type.py
ls ~/nasaeem-libya/passenger_wsgi.py*         # ملف واحد فقط
```

---

## المرحلة 2: نشر المتجر (shop.nasaeemlibya.ly)

```bash
cd ~/nasaeem-libya/store-app/backend
source /home/nasaeeml/virtualenv/nasaeem-libya/store-app/backend/3.13/bin/activate
git rev-parse HEAD > ~/commit-before-deploy-$(date +%F).txt
python manage.py create_system_backup
cp db.sqlite3 ~/db-before-deploy-$(date +%F).sqlite3
cp -a ~/shop ~/shop-backup-$(date +%F)

cd ~/nasaeem-libya && git pull && cd store-app/backend
git log --oneline -1                          # يجب أن يكون f9e8ed2 أو أحدث
python manage.py showmigrations | grep "\[ \]"   # المتوقع ثلاثة فقط: catalog 0007، core 0012، core 0013
python manage.py migrate
python manage.py make_mobile_copies           # معاينة
python manage.py make_mobile_copies --apply
touch tmp/restart.txt
curl -s https://shop.nasaeemlibya.ly/api/health/      # {"status":"ok",...}

cd ~/nasaeem-libya/store-app/backend/dist
tar cf - --exclude='./.htaccess' --exclude='./media' . | (cd ~/shop && tar xf -)
```
إن ظهر في `showmigrations` شيء من `storefront` أو غير الثلاثة: توقف وأرسل لي الناتج. **لا `makemigrations` أبداً.**

**تحقق (حاسوب وهاتف، بعد `Ctrl+Shift+R`):** الجدول في `fixes/10` §4. وإن تعطل شيء: الرجوع في `fixes/10` §5.

---

## المرحلة 3: رفع موقع الشركة (nasaeemlibya.ly)

الموقع جاهز داخل المستودع بعد `git pull`: `~/nasaeem-libya/company-site/dist/` ومعه `.htaccess` الخاص به. لا رفع من جهازك.

```bash
# 1. تفريغ public_html مع إبقاء .well-known و cgi-bin (شهادة SSL وإعداد cPanel)
cd ~/public_html
ls -A
find . -mindepth 1 -maxdepth 1 ! -name '.well-known' ! -name 'cgi-bin' -exec rm -r {} +
ls -A                                          # يجب أن يبقى الاثنان فقط

# 2. النسخ
cp -a ~/nasaeem-libya/company-site/dist/. ~/public_html/
ls -A ~/public_html                            # .htaccess  assets  en  index.html  robots.txt  sitemap.xml  + الاثنان
```

**تحقق:**
```bash
curl -sI https://nasaeemlibya.ly/ | head -1           # HTTP/2 200
curl -sI https://nasaeemlibya.ly/en/ | head -1        # 200
curl -sI http://nasaeemlibya.ly/ | grep -i location   # https://nasaeemlibya.ly/
curl -sI https://nasaeemlibya.ly/en | grep -i location # https://nasaeemlibya.ly/en/
```
ثم في المتصفح على الحاسوب والهاتف: المقدمة تظهر في كل فتح وتحديث، الصفحة بالعربية ثم `/en/`، وزر «تسوّق الآن» يفتح `shop.nasaeemlibya.ly`، وروابط الهاتف وواتساب والبريد.
إن ظهر 500 أو صفحة بيضاء: `cat ~/public_html-htaccess-old.txt` وأرسله لي مع `tail -20 ~/logs/*error*` إن وُجد.

---

## المرحلة 4: ما بعد الرفع

- حدّث هذا الملف بعلامة ✔ أمام كل مرحلة، وأرسل لي `df -h ~ | tail -1` ونتيجة الفحوص.
- بعد أسبوع من عمل المتجر بلا مشاكل يمكن حذف `~/shop-backup-<تاريخ اليوم>` و`~/db-before-deploy-<تاريخ اليوم>.sqlite3`.
- التعديل اللاحق لموقع الشركة: تعديل `company-site/content.json` في المستودع، ثم على الخادم `git pull` و`cp -a ~/nasaeem-libya/company-site/dist/. ~/public_html/`.
