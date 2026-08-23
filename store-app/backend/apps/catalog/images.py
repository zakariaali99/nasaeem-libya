"""Automated High-Performance Image Optimization & Processing Pipeline.

Converts uploaded fragrance photography into WebP variants (Thumbnail, Card, Hero Zoom)
with optimal compression for Libyan mobile bandwidth.
"""

import io
import logging
from typing import Dict, Tuple

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

logger = logging.getLogger(__name__)

IMAGE_DERIVATIVES = {
    "thumb": (200, 200),
    "card": (600, 600),
    "hero": (1600, 1600),
}


def process_fragrance_image(
    image_bytes: bytes,
    quality: int = 85,
) -> Dict[str, Tuple[bytes, str]]:
    """Process uploaded image into thumbnail, card, and hero WebP variants.

    Returns a dict mapping size names ('thumb', 'card', 'hero') to (bytes, mime_type).
    """
    if not HAS_PIL:
        logger.warning("Pillow (PIL) is not installed; returning original bytes as fallback.")
        return {
            "thumb": (image_bytes, "image/jpeg"),
            "card": (image_bytes, "image/jpeg"),
            "hero": (image_bytes, "image/jpeg"),
        }

    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")

        results = {}
        for size_name, (max_w, max_h) in IMAGE_DERIVATIVES.items():
            resized = img.copy()
            resized.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            output_io = io.BytesIO()
            resized.save(output_io, format="WEBP", quality=quality, method=6)
            results[size_name] = (output_io.getvalue(), "image/webp")

        return results
    except Exception as err:
        logger.exception("Image optimization failed: %s", err)
        return {
            "thumb": (image_bytes, "image/jpeg"),
            "card": (image_bytes, "image/jpeg"),
            "hero": (image_bytes, "image/jpeg"),
        }
