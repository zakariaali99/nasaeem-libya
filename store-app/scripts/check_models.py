#!/usr/bin/env python
"""Assert that every model and field in store/02-data-model.md exists in Django.

The spec's model list is normative. This script parses it and compares against
live Django introspection, so "every model exists with every field" is a check
that can fail rather than a claim someone made.

    cd store-app/backend && .venv/bin/python ../scripts/check_models.py

Exits non-zero on any missing model or field.
"""

import os
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
SPEC = Path(__file__).resolve().parent.parent.parent / "store" / "02-data-model.md"

sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.apps import apps  # noqa: E402

# Models the spec describes but which Django provides or which are out of scope.
SKIP_MODELS = {"Role", "OrderStatus", "ShippingStatus", "PaymentStatus", "DiscountType", "WidgetType"}

# Backticked tokens inside a model section that are not field names.
NOT_FIELDS = {
    "PROTECT", "CASCADE", "SET_NULL", "allow_unicode=True", "True", "False",
    "USERNAME_FIELD", "UserManager", "create_user", "create_superuser",
    "set_password()", "self", "stock", "reserved_stock", "random",
    "select_for_update()", "ATOMIC_REQUESTS = True", "InventoryLog",
    "OrderItem.product", "CartItem.product", "imageUrl", "image_url", "url",
    "data", "08-features.md", "id", "sandboxMode",
    # image renditions generated on upload, not columns:
    "thumb", "medium", "full",
}

# related_name= / through= values that appear in backticks
RELATED_RE = re.compile(r'related_name="([^"]+)"')


def parse_spec():
    text = SPEC.read_text(encoding="utf-8")
    sections = {}
    current = None
    for line in text.splitlines():
        header = re.match(r"^### `([A-Za-z]+)`", line)
        if header:
            current = header.group(1)
            sections[current] = []
            continue
        if line.startswith("## "):
            current = None
            continue
        if current:
            sections[current].append(line)

    expected = {}
    for model, lines in sections.items():
        if model in SKIP_MODELS:
            continue
        body = "\n".join(lines)
        related = set(RELATED_RE.findall(body))
        fields = set()
        for token in re.findall(r"`([^`]+)`", body):
            token = token.strip()
            if token in NOT_FIELDS or token in related:
                continue
            # a field name is a bare lowercase identifier
            if re.fullmatch(r"[a-z][a-z0-9_]*", token):
                fields.add(token)
            # "`meta_title` / `meta_description`" style pairs are caught above;
            # "`width` `length` `height`" too.
        expected[model] = fields
    return expected


def main():
    expected = parse_spec()
    live = {m.__name__: m for m in apps.get_models()}

    missing_models = []
    missing_fields = []

    for model_name, fields in sorted(expected.items()):
        model = live.get(model_name)
        if model is None:
            missing_models.append(model_name)
            continue
        actual = set()
        for field in model._meta.get_fields():
            actual.add(field.name)
            if getattr(field, "attname", None):
                actual.add(field.attname)
        for field in sorted(fields):
            if field not in actual:
                missing_fields.append(f"{model_name}.{field}")

    width = max((len(m) for m in expected), default=0)
    for model_name, fields in sorted(expected.items()):
        status = "MISSING MODEL" if model_name in missing_models else "ok"
        gaps = [f for f in fields if f"{model_name}.{f}" in missing_fields]
        if gaps:
            status = "missing: " + ", ".join(sorted(gaps))
        mark = "\033[32m✓\033[0m" if status == "ok" else "\033[31m✗\033[0m"
        print(f"  {mark} {model_name.ljust(width)}  {len(fields):>2} spec fields  {status}")

    print()
    if missing_models or missing_fields:
        print(f"\033[31m{len(missing_models)} model(s) and {len(missing_fields)} field(s) missing.\033[0m")
        return 1
    print(f"\033[32mAll {len(expected)} spec models present with every named field.\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
