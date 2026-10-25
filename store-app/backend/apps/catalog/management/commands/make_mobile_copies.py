"""Make the 1080px phone copy for banners uploaded before uploads made one.

A banner upload now writes `<name>-mobile.webp` beside `<name>-full.webp`, and
the store sends phones the small file when it exists. Banners uploaded before
that have no phone copy, so phones download the 1920px picture.

    python manage.py make_mobile_copies            # report only
    python manage.py make_mobile_copies --apply    # write the missing copies

It reads every homepage layout (sliders, image heroes, offer banners, single
pictures), never deletes or changes an existing file, and skips copies that
already exist, so it is safe to run again. A widget remembers its phone copy
when it is saved, so after writing copies it re-saves the widgets that use
them through the same cleaning the dashboard applies on save.
Banners 1350px wide or less are left as they are: they are already light.
"""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

# Same width and quality as a banner upload (ImageUploadView).
MOBILE_WIDTH = 1080
QUALITY = 86

# A picture this narrow is already light enough for a phone; a copy would
# save little and could come out larger after re-encoding.
SMALL_ENOUGH = 1350

IMAGE_KEYS = ("imageUrl", "mobileImageUrl", "desktopImageUrl", "backgroundImageUrl")


def banner_urls(data) -> set:
    """Every picture url in one widget's `data`, at any depth (slides, items)."""
    found = set()
    if isinstance(data, dict):
        for key, value in data.items():
            if key in IMAGE_KEYS and isinstance(value, str) and value:
                found.add(value)
            elif isinstance(value, (dict, list)):
                found |= banner_urls(value)
    elif isinstance(data, list):
        for value in data:
            found |= banner_urls(value)
    return found


def is_small(full: Path) -> bool:
    from PIL import Image

    with Image.open(full) as image:  # reads the header only
        return image.width <= SMALL_ENOUGH


def missing_copies():
    """`(full_path, mobile_path)` for each uploaded banner without a phone copy
    that is wide enough to be worth one."""
    from apps.storefront.models import Widget

    media_url = settings.MEDIA_URL
    root = Path(settings.MEDIA_ROOT)
    urls = set()
    for data in Widget.objects.values_list("data", flat=True):
        urls |= banner_urls(data)

    pairs = []
    for url in sorted(urls):
        if not url.startswith(media_url) or not url.endswith("-full.webp"):
            continue  # an external link, or a file this store did not make
        full = root / url[len(media_url):]
        mobile = full.with_name(full.name.replace("-full.webp", "-mobile.webp"))
        if full.exists() and not mobile.exists() and not is_small(full):
            pairs.append((full, mobile))
    return pairs


def refresh_widgets() -> int:
    """Re-save each widget so it picks up the phone copies now on disk."""
    from apps.storefront.models import Widget
    from apps.storefront.services import normalise_widget_data

    changed = 0
    for widget in Widget.objects.all():
        if not banner_urls(widget.data):
            continue
        data = normalise_widget_data(widget.type, widget.data)
        if data != widget.data:
            widget.data = data
            widget.save()  # the save signal clears the cached homepage
            changed += 1
    return changed


def make_copy(full: Path, mobile: Path) -> bool:
    """Write the copy; False (and no file) when it would not be smaller."""
    from PIL import Image

    with Image.open(full) as image:
        image.load()
        copy = image.convert("RGB")
    copy.thumbnail((MOBILE_WIDTH, MOBILE_WIDTH * 4), Image.LANCZOS)
    copy.save(mobile, "WEBP", quality=QUALITY, method=6)
    if mobile.stat().st_size >= full.stat().st_size:
        mobile.unlink()  # our own file, just written: phones keep the original
        return False
    return True


class Command(BaseCommand):
    help = "Report (or, with --apply, make) the missing 1080px phone copies of homepage banners."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="write the missing copies")

    def handle(self, *args, **options):
        pairs = missing_copies()
        if not pairs:
            self.stdout.write(self.style.SUCCESS("لا بانرات تحتاج نسخة جوال. لا شيء لعمله."))
            return

        self.stdout.write(f"بانرات بلا نسخة جوال: {len(pairs)}")
        for full, _ in pairs:
            self.stdout.write(f"  {full.relative_to(settings.MEDIA_ROOT)}")

        if not options["apply"]:
            self.stdout.write("تقرير فقط. شغّل الأمر مع --apply لصنع النسخ.")
            return

        made = 0
        for full, mobile in pairs:
            try:
                if make_copy(full, mobile):
                    made += 1
                else:
                    self.stdout.write(f"  تُركت: {full.name} (النسخة لن تكون أصغر)")
            except Exception as exc:  # one bad file must not stop the rest
                self.stderr.write(f"تعذّر: {full.name}: {exc}")
        self.stdout.write(self.style.SUCCESS(f"صُنعت {made} نسخة جوال."))
        if made:
            self.stdout.write(f"حُدّثت أقسام الصفحة الرئيسية: {refresh_widgets()}")
