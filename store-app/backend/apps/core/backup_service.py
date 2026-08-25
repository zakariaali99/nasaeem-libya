"""Full System Backup & Restore Service.

Exports database records and media files to a timestamped ZIP archive,
and provides atomic restoration capabilities.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import zipfile
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core import serializers
from django.db import connection, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

BACKUPS_DIR = getattr(settings, "BACKUPS_DIR", Path(settings.BASE_DIR) / "backups")


def get_backups_dir() -> Path:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUPS_DIR


def get_system_stats() -> dict:
    """Returns real-time entity counts and storage sizes."""
    from apps.catalog.models import Category, Product, ProductImage, ProductReview
    from apps.core.models import User
    from apps.orders.models import Order
    from apps.storefront.models import StorefrontLayout, Widget

    media_size_bytes = 0
    media_root = Path(settings.MEDIA_ROOT)
    if media_root.exists():
        for root, _, files in os.walk(media_root):
            for f in files:
                fp = os.path.join(root, f)
                if not os.path.islink(fp):
                    media_size_bytes += os.path.getsize(fp)

    return {
        "products_count": Product.objects.count(),
        "images_count": ProductImage.objects.count(),
        "orders_count": Order.objects.count(),
        "users_count": User.objects.count(),
        "categories_count": Category.objects.count(),
        "reviews_count": ProductReview.objects.count(),
        "layouts_count": StorefrontLayout.objects.count(),
        "widgets_count": Widget.objects.count(),
        "media_size_bytes": media_size_bytes,
        "media_size_mb": round(media_size_bytes / (1024 * 1024), 2),
    }


def list_backups() -> list[dict]:
    """Lists existing backup archives with metadata."""
    backups_dir = get_backups_dir()
    backups = []

    for file in sorted(backups_dir.glob("nasaeem_backup_*.zip"), reverse=True):
        stat = file.stat()
        manifest = {}
        try:
            with zipfile.ZipFile(file, "r") as zf:
                if "manifest.json" in zf.namelist():
                    manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        except Exception as e:
            logger.warning(f"Could not read manifest from {file.name}: {e}")

        backups.append({
            "filename": file.name,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "manifest": manifest,
        })

    return backups


def create_full_backup() -> dict:
    """Generates a complete ZIP backup containing JSON fixtures, manifest, and media/."""
    backups_dir = get_backups_dir()
    timestamp_str = timezone.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"nasaeem_backup_{timestamp_str}.zip"
    zip_filepath = backups_dir / zip_filename

    stats = get_system_stats()

    # Ordered list of models to dump
    model_labels = [
        "core.User",
        "core.UserAddress",
        "core.LoyaltyTransaction",
        "core.City",
        "core.Region",
        "catalog.Category",
        "catalog.Collection",
        "catalog.Product",
        "catalog.ProductCategory",
        "catalog.ProductCollection",
        "catalog.VariantOption",
        "catalog.VariantValue",
        "catalog.ProductVariant",
        "catalog.ProductImage",
        "catalog.PerfumeAttribute",
        "catalog.ProductBundle",
        "catalog.ProductReview",
        "catalog.InventoryLog",
        "catalog.WishlistItem",
        "orders.DeliveryMethod",
        "orders.PaymentMethodConfiguration",
        "orders.Discount",
        "orders.CartPromotion",
        "orders.Cart",
        "orders.CartItem",
        "orders.Order",
        "orders.OrderItem",
        "delivery.WarehouseHub",
        "delivery.CODReconciliationStatement",
        "delivery.CODReconciliationItem",
        "delivery.CourierTrackingEvent",
        "delivery.WhatsAppVerificationSession",
        "payments.Payment",
        "payments.PaymentRefund",
        "payments.LedgerAccount",
        "payments.LedgerTransaction",
        "payments.LedgerEntry",
        "storefront.StorefrontLayout",
        "storefront.Widget",
    ]

    dump_objects = []
    for label in model_labels:
        try:
            model = apps.get_model(label)
            qs = model.objects.all()
            dump_objects.extend(list(qs))
        except Exception as e:
            logger.warning(f"Skipping model {label} during backup: {e}")

    serialized_data = serializers.serialize("json", dump_objects, indent=2)

    manifest = {
        "version": "1.0",
        "app": "Nasaeem Libya E-Commerce Engine",
        "timestamp": timezone.now().isoformat(),
        "stats": stats,
        "models_included": model_labels,
    }

    with zipfile.ZipFile(zip_filepath, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("database.json", serialized_data)
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

        # Add media folder
        media_root = Path(settings.MEDIA_ROOT)
        if media_root.exists():
            for root, _, files in os.walk(media_root):
                for file in files:
                    file_path = Path(root) / file
                    if not file_path.is_symlink():
                        rel_path = file_path.relative_to(media_root)
                        zf.write(file_path, arcname=f"media/{rel_path}")

    file_size = zip_filepath.stat().st_size
    return {
        "filename": zip_filename,
        "filepath": str(zip_filepath),
        "size_bytes": file_size,
        "size_mb": round(file_size / (1024 * 1024), 2),
        "created_at": timezone.now().isoformat(),
        "stats": stats,
    }


def delete_backup(filename: str) -> bool:
    """Deletes a backup file by name."""
    safe_name = os.path.basename(filename)
    filepath = get_backups_dir() / safe_name
    if filepath.exists() and filepath.suffix == ".zip":
        filepath.unlink()
        return True
    return False


def restore_backup(zip_filepath: str | Path) -> dict:
    """Restores the system database and media assets from a backup ZIP file."""
    zip_path = Path(zip_filepath)
    if not zip_path.exists():
        raise FileNotFoundError(f"Backup file not found: {zip_path}")

    with zipfile.ZipFile(zip_path, "r") as zf:
        namelist = zf.namelist()
        if "database.json" not in namelist:
            raise ValueError("Invalid backup archive: database.json is missing.")

        manifest = {}
        if "manifest.json" in namelist:
            manifest = json.loads(zf.read("manifest.json").decode("utf-8"))

        raw_db_json = zf.read("database.json").decode("utf-8")

        # Extract media files
        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)

        for member in zf.infolist():
            if member.filename.startswith("media/") and not member.is_dir():
                rel_filename = member.filename[len("media/"):]
                target_path = media_root / rel_filename
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as source, open(target_path, "wb") as target:
                    shutil.copyfileobj(source, target)

        # Deserialize and save objects inside an atomic transaction
        with transaction.atomic():
            deserialized_objects = serializers.deserialize("json", raw_db_json)
            restored_count = 0
            for obj in deserialized_objects:
                obj.save()
                restored_count += 1

    return {
        "success": True,
        "restored_records_count": restored_count,
        "manifest": manifest,
        "restored_at": timezone.now().isoformat(),
    }
