import os
from pathlib import Path
from PIL import Image, ImageFile, ImageOps
from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import Category, ProductImage
from apps.catalog.services import RENDITIONS
from apps.storefront.models import Widget

ImageFile.LOAD_TRUNCATED_IMAGES = True


class Command(BaseCommand):
    help = "Optimize and convert media images (JPG/PNG) to WebP renditions and update DB references."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be converted without writing files or changing the database.",
        )
        parser.add_argument(
            "--delete-originals",
            action="store_true",
            help="Delete original JPG/PNG files after generating optimized WebP renditions.",
        )
        parser.add_argument(
            "--quality",
            type=int,
            default=78,
            help="WebP compression quality (default 78).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        delete_originals = options["delete_originals"]
        quality = options["quality"]

        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.exists():
            self.stdout.write(self.style.WARNING(f"Media root {media_root} does not exist."))
            return

        self.stdout.write(f"==> Scanning media root: {media_root} (quality={quality}, dry_run={dry_run})")

        total_original_bytes = 0
        total_optimized_bytes = 0
        converted_count = 0
        url_replacements = {}  # old_rel_url -> new_rel_url

        # Scan for images to convert
        for root, _, files in os.walk(media_root):
            for file in files:
                file_path = Path(root) / file
                ext = file_path.suffix.lower()
                if ext not in (".jpg", ".jpeg", ".png"):
                    continue

                # Skip files that might already be rendition source derivatives
                orig_size = file_path.stat().st_size
                total_original_bytes += orig_size

                rel_to_media = file_path.relative_to(media_root)
                old_media_url = f"{settings.MEDIA_URL.rstrip('/')}/{rel_to_media.as_posix()}"
                new_stem = file_path.stem
                new_rel_webp = rel_to_media.with_suffix(".webp")
                new_media_url = f"{settings.MEDIA_URL.rstrip('/')}/{new_rel_webp.as_posix()}"
                url_replacements[old_media_url] = new_media_url

                try:
                    with Image.open(file_path) as img:
                        img.load()
                        try:
                            img = ImageOps.exif_transpose(img)
                        except Exception:
                            pass

                        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                            bg = Image.new("RGB", img.size, (255, 255, 255))
                            rgba = img.convert("RGBA")
                            bg.paste(rgba, mask=rgba.split()[3])
                            img = bg
                        elif img.mode != "RGB":
                            img = img.convert("RGB")

                        # 1. Main WebP image (same resolution/hero)
                        dest_main = file_path.with_suffix(".webp")
                        if not dry_run:
                            img.save(dest_main, "WEBP", quality=quality, method=6)
                            main_size = dest_main.stat().st_size
                        else:
                            main_size = int(orig_size * 0.25)  # Estimate

                        # 2. Renditions
                        rendition_bytes = 0
                        for name, size in RENDITIONS.items():
                            dest_rendition = file_path.parent / f"{new_stem}-{name}.webp"
                            if not dry_run:
                                rendition_img = img.copy()
                                rendition_img.thumbnail((size, size), Image.LANCZOS)
                                rendition_img.save(dest_rendition, "WEBP", quality=quality, method=6)
                                rendition_bytes += dest_rendition.stat().st_size

                        total_optimized_bytes += main_size
                        converted_count += 1

                        pct_saved = ((orig_size - main_size) / orig_size * 100) if orig_size else 0
                        self.stdout.write(
                            f"  [CONVERT] {rel_to_media.as_posix()}: {orig_size / 1024:.1f} KB -> "
                            f"{main_size / 1024:.1f} KB ({pct_saved:.1f}% reduction)"
                        )

                        if delete_originals and not dry_run:
                            file_path.unlink()
                            self.stdout.write(f"  [DELETE] Removed original {file_path.name}")

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  [ERROR] Failed converting {file_path}: {e}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\n==> Media Files: Converted {converted_count} files. "
                f"Total size: {total_original_bytes / 1024:.1f} KB -> {total_optimized_bytes / 1024:.1f} KB"
            )
        )

        # Update database records
        self.stdout.write("==> Updating database references...")
        with transaction.atomic():
            # 1. ProductImage
            updated_product_images = 0
            for pi in ProductImage.objects.all():
                new_url = pi.url
                for old_url, repl_url in url_replacements.items():
                    if old_url in new_url:
                        new_url = new_url.replace(old_url, repl_url)
                if new_url != pi.url:
                    if not dry_run:
                        pi.url = new_url
                        pi.save(update_fields=["url"])
                    updated_product_images += 1

            # 2. Category
            updated_categories = 0
            for cat in Category.objects.filter(image_url__isnull=False):
                if not cat.image_url:
                    continue
                new_url = cat.image_url
                for old_url, repl_url in url_replacements.items():
                    if old_url in new_url:
                        new_url = new_url.replace(old_url, repl_url)
                if new_url != cat.image_url:
                    if not dry_run:
                        cat.image_url = new_url
                        cat.save(update_fields=["image_url"])
                    updated_categories += 1

            # 3. Widgets (recursive replace in JSON)
            def replace_urls_in_json(obj):
                if isinstance(obj, str):
                    for old_url, repl_url in url_replacements.items():
                        if old_url in obj:
                            obj = obj.replace(old_url, repl_url)
                    return obj
                elif isinstance(obj, list):
                    return [replace_urls_in_json(item) for item in obj]
                elif isinstance(obj, dict):
                    return {k: replace_urls_in_json(v) for k, v in obj.items()}
                return obj

            updated_widgets = 0
            for widget in Widget.objects.all():
                new_data = replace_urls_in_json(widget.data)
                if new_data != widget.data:
                    if not dry_run:
                        widget.data = new_data
                        widget.save(update_fields=["data"])
                    updated_widgets += 1

            if dry_run:
                self.stdout.write(
                    f"  [DRY RUN] Would update {updated_product_images} product images, "
                    f"{updated_categories} categories, {updated_widgets} widgets."
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  [DB UPDATED] Updated {updated_product_images} product images, "
                        f"{updated_categories} categories, {updated_widgets} widgets."
                    )
                )

        if not dry_run:
            cache.clear()
            self.stdout.write(self.style.SUCCESS("==> Cleared application cache."))
