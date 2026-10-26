#!/usr/bin/env python3
"""Build the company site: content.json + templates/page.html -> dist/.

Standard library only. Run from anywhere:  python3 company-site/build.py
Each run deletes dist/ and regenerates it, so the output is reproducible.
"""
import datetime
import hashlib
import json
import re
import shutil
import sys
from html import escape
from pathlib import Path
from urllib.parse import quote, quote_plus

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
LANGS = ("ar", "en")


def e(text):
    return escape(str(text), quote=True)


def fmt(text, **values):
    """Fill {name} slots in a content string (missing slots stay as-is)."""
    return re.sub(r"\{(\w+)\}", lambda m: str(values.get(m.group(1), m.group(0))), text)


def tel(local):
    """0911773270 -> +218911773270 (Libyan local number to E.164)."""
    digits = re.sub(r"\D", "", local)
    if digits.startswith("218"):
        return "+" + digits
    return "+218" + digits.lstrip("0")


def phone_display(local):
    """0911773270 -> 091 177 3270, the way Libyan numbers are usually written."""
    d = re.sub(r"\D", "", local)
    return f"{d[:3]} {d[3:6]} {d[6:]}" if len(d) == 10 else d


def maps_search(query):
    return "https://www.google.com/maps/search/?api=1&query=" + quote_plus(query)


def img_tag(src, alt, cls, width=None, height=None, lazy=True):
    size = f' width="{width}" height="{height}"' if width else ""
    lazy_attr = ' loading="lazy" decoding="async"' if lazy else ""
    return f'<img class="{cls}" src="{e(src)}" alt="{e(alt)}"{size}{lazy_attr}>'


def render_page(template, content, lang, version):
    site, t = content["site"], content[lang]
    other = "en" if lang == "ar" else "ar"
    domain = site["domain"].rstrip("/")
    url = {code: domain + content[code]["path"] for code in LANGS}
    counts = {"distributors": len(content["distributors"]), "brands": len(content["brands"])}
    photos = content.get("photos", {})

    nav = "".join(
        f'<li><a href="#{key}">{e(label)}</a></li>' for key, label in t["nav"].items()
    )
    stats = "".join(
        f'<div class="stat"><dt>{e(s["label"])}</dt><dd>{e(fmt(s["value"], **counts))}</dd></div>'
        for s in t["stats"]
    )
    goals = "".join(f"<li>{e(g)}</li>" for g in t["goals"])
    services = "".join(
        f'<li><span class="services__n" aria-hidden="true">{i:02d}</span><span>{e(s)}</span></li>'
        for i, s in enumerate(t["services"], 1)
    )
    brands = "".join(
        f'<li class="brands__item">{img_tag("/assets/img/brands/" + b["file"], b[lang], "brands__logo", 160, 160)}</li>'
        for b in content["brands"]
    )

    cards = []
    for d in content["distributors"]:
        loc, ar = d[lang], d["ar"]
        query = f'{ar["name"]} {ar["address"]} {ar["city"]} ليبيا'
        if d["phones"]:
            phones = "".join(
                f'<li><a href="tel:{tel(p)}" dir="ltr" aria-label="{e(fmt(t["call_aria"], phone=phone_display(p)))}">'
                f'<svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg>{e(phone_display(p))}</a></li>'
                for p in d["phones"]
            )
            phones = f'<ul class="card__phones">{phones}</ul>'
        else:
            phones = f'<p class="card__none">{e(t["no_phone"])}</p>'
        aria = fmt(t["map_button_aria"], name=loc["name"], city=loc["city"])
        cards.append(
            '<li class="card reveal">'
            f'<p class="card__city">{e(loc["city"])}</p>'
            f'<h3 class="card__name">{e(loc["name"])}</h3>'
            f'<p class="card__address">{e(loc["address"])}</p>'
            f"{phones}"
            f'<a class="btn btn--outline btn--sm card__map" href="{e(maps_search(query))}" '
            f'target="_blank" rel="noopener" aria-label="{e(aria)}">'
            f'<svg class="icon" aria-hidden="true"><use href="#i-pin"/></svg>{e(t["map_button"])}</a>'
            "</li>"
        )

    social = "".join(
        f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener me" aria-label="{e(s["label"])}">'
        f'<svg class="icon" aria-hidden="true"><use href="#i-{e(s["id"])}"/></svg><span>{e(s["label"])}</span></a></li>'
        for s in site["social"]
    )

    hero_photo = img_tag(photos["hero"], "", "hero__photo", lazy=False) if photos.get("hero") else ""
    if photos.get("about"):
        about_photo = img_tag(photos["about"], t["about_photo_alt"], "about__photo")
        about_hidden = "false"
    else:
        about_photo = '<img class="about__logo" src="/assets/img/logo.svg" alt="" width="200" height="200" loading="lazy">'
        about_hidden = "true"

    jsonld = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": t["full_name"],
        "alternateName": content["en" if lang == "ar" else "ar"]["name"],
        "url": url[lang],
        "logo": domain + "/assets/img/apple-touch-icon.png",
        "foundingDate": str(site["founded"]),
        "email": site["email"],
        "telephone": tel(site["phone"]),
        "address": {"@type": "PostalAddress", "streetAddress": t["address"], "addressLocality": "Misrata", "addressCountry": "LY"},
        "sameAs": [s["url"] for s in site["social"]] + [site["store_url"]],
    }

    values = {
        **{k: e(v) for k, v in t.items() if isinstance(v, str)},
        "canonical": e(url[lang]),
        "url_ar": e(url["ar"]),
        "url_en": e(url["en"]),
        "og_image": e(domain + "/assets/img/og.jpg"),
        "og_locale_alt": e(content[other]["og_locale"]),
        "version": version,
        "jsonld": json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/"),
        "nav_items": nav,
        "lang_switch_href": e(content[other]["path"]),
        "lang_switch_hreflang": e(t["lang_switch"]["hreflang"]),
        "lang_switch_label": e(t["lang_switch"]["label"]),
        "lang_switch_aria": e(t["lang_switch"]["aria"]),
        "store_url": e(site["store_url"]),
        "stats": stats,
        "goals": goals,
        "services": services,
        "brands": brands,
        "distributors": "".join(cards),
        "hero_photo": hero_photo,
        "about_photo": about_photo,
        "about_visual_hidden": about_hidden,
        "whatsapp_url": e("https://wa.me/" + site["whatsapp"]),
        "phone_tel": e("tel:" + tel(site["phone"])),
        "phone_display": e(phone_display(site["phone"])),
        "email": e(site["email"]),
        "label_phone": e(t["contact_labels"]["phone"]),
        "label_email": e(t["contact_labels"]["email"]),
        "label_address": e(t["contact_labels"]["address"]),
        "label_social": e(t["contact_labels"]["social"]),
        "map_link": e(maps_search(site["map_embed_query"])),
        "map_embed": e(
            "https://maps.google.com/maps?q=" + quote(site["map_embed_query"])
            + "&hl=" + lang + "&z=16&output=embed"
        ),
        "social": social,
        "year": str(datetime.date.today().year),
    }

    def sub(m):
        key = m.group(1)
        if key not in values:
            sys.exit(f"build.py: template slot {{{{{key}}}}} has no value ({lang})")
        return values[key]

    return re.sub(r"\{\{(\w+)\}\}", sub, template)


def main():
    content = json.loads((ROOT / "content.json").read_text(encoding="utf-8"))
    template = (ROOT / "templates" / "page.html").read_text(encoding="utf-8")

    # Cache-busting token: changes whenever the CSS or JS changes.
    digest = hashlib.sha1()
    for name in ("css/site.css", "js/site.js"):
        digest.update((ROOT / "assets" / name).read_bytes())
    version = digest.hexdigest()[:8]

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "assets", DIST / "assets", ignore=shutil.ignore_patterns(".*"))

    for lang in LANGS:
        out = DIST / content[lang]["path"].strip("/") / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render_page(template, content, lang, version), encoding="utf-8")

    (DIST / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {content['site']['domain'].rstrip('/')}/sitemap.xml\n",
        encoding="utf-8",
    )
    domain = content["site"]["domain"].rstrip("/")
    links = "".join(
        f'<xhtml:link rel="alternate" hreflang="{c}" href="{domain}{content[c]["path"]}"/>' for c in LANGS
    )
    urls = "".join(f"<url><loc>{domain}{content[c]['path']}</loc>{links}</url>" for c in LANGS)
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
        f"{urls}</urlset>\n",
        encoding="utf-8",
    )

    size = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    print(f"built {DIST.relative_to(ROOT.parent)}/ : {', '.join(content[c]['path'] for c in LANGS)} ({size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
