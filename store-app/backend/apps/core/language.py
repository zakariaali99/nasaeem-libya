"""The English store's content.

The storefront asks for English with `?lang=en` on every API request made
from an `/en/` page. A query parameter rather than a header, so every cache
on the way (the service worker, the server's own, the browser's) keeps the
two languages apart without being told.

Each translatable field has an optional `<field>_en` twin. An empty twin
means "not translated yet", and the English store shows the Arabic instead
of a blank. The dashboard never sends `lang`, so it always works on the
Arabic fields and edits the `_en` fields beside them.
"""

import re

from django.core.cache import cache


def wants_english(request) -> bool:
    if request is None:
        return False
    params = getattr(request, "query_params", None) or getattr(request, "GET", {})
    return params.get("lang") == "en"


def english_or(obj, field: str, english: bool):
    """`obj.<field>_en` when English is wanted and it was written, else `obj.<field>`."""
    value = getattr(obj, field, "")
    if english:
        twin = getattr(obj, f"{field}_en", None)
        if twin:
            return twin
    return value


# A size written in Arabic reads naturally in English without anyone typing it:
# «100 مل» → "100 ml". A typed `value_en` always wins.
_UNITS = (
    (re.compile(r"\s*مل\b|\s*ملل\b|\s*مللي\b"), " ml"),
    (re.compile(r"\s*لتر\b"), " L"),
    (re.compile(r"\s*(غرام|جرام|غ)\b"), " g"),
    (re.compile(r"\s*(قطعة|حبة)\b"), " pcs"),
)
_OPTION_NAMES = {"الحجم": "Size", "اللون": "Colour", "النوع": "Type", "الوزن": "Weight"}


def english_value(value) -> str:
    """The English label of a variant value («100 مل» → "100 ml")."""
    if getattr(value, "value_en", ""):
        return value.value_en
    text = value.value
    for pattern, unit in _UNITS:
        text = pattern.sub(unit, text)
    return text.strip()


def english_option(option) -> str:
    if getattr(option, "name_en", ""):
        return option.name_en
    return _OPTION_NAMES.get(option.name.strip(), option.name)


def value_label(value, english: bool) -> str:
    return english_value(value) if english else value.value


def option_label(option, english: bool) -> str:
    return english_option(option) if english else option.name


class EnglishFieldsMixin:
    """For a serializer: on an English request, each field named in
    `english_fields` carries its `_en` twin when that was written."""

    english_fields: tuple = ()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if wants_english(self.context.get("request")):
            for field in self.english_fields:
                twin = getattr(instance, f"{field}_en", None)
                if field in data and twin:
                    data[field] = twin
        return data


def localise_widget(data, english: bool):
    """A homepage widget's text in the wanted language. The builder saves an
    English line as `<key>_en` beside the Arabic `<key>` (at any depth — in
    slides and items too); an empty English line keeps the Arabic."""
    if not english:
        return data
    if isinstance(data, list):
        return [localise_widget(item, english) for item in data]
    if not isinstance(data, dict):
        return data
    out = {key: localise_widget(value, english) for key, value in data.items()}
    for key, value in data.items():
        if key.endswith("_en") and key[:-3] in out and value not in ("", None, []):
            out[key[:-3]] = value
    return out


# ---------------------------------------------------------------- caching

def lang_key(key: str, request) -> str:
    """A cache key per language: the English copy is stored apart."""
    return f"{key}:en" if wants_english(request) else key


def forget(*keys: str) -> None:
    """Drop a cached entry in both languages."""
    cache.delete_many([k for key in keys for k in (key, f"{key}:en")])


from django.middleware.locale import LocaleMiddleware
from django.utils import translation


class StoreLocaleMiddleware(LocaleMiddleware):
    """Activates the language for each request.

    Prefers `?lang=en|ar` query param if present (which the storefront passes on
    every API request from /en/ pages), then falls back to Django's standard
    Accept-Language / session / cookie resolution.
    """

    def process_request(self, request):
        params = getattr(request, "GET", {})
        lang = params.get("lang")
        if lang in ("en", "ar"):
            translation.activate(lang)
            request.LANGUAGE_CODE = translation.get_language()
            return None
        return super().process_request(request)

