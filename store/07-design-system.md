# 07 — Design system

## Tailwind v4 is CSS-first — read this before writing any CSS

Tailwind v4 does **not** read `tailwind.config.ts` unless you explicitly
`@config` it. Every token lives in `src/styles/globals.css` inside `@theme`.

> The reference system shipped a `tailwind.config.ts` containing its entire brand
> palette and Arabic font for months. None of it ever compiled. The store
> rendered in shadcn's default zero-chroma greyscale — no brand colour at all —
> and nobody noticed because the file looked authoritative. **Do not create a
> `tailwind.config.ts`.**

## Token layer

```css
@import "tailwindcss";

@theme {
  /* type */
  --font-sans: "Cairo", ui-sans-serif, system-ui, sans-serif;

  /* brand */
  --color-primary:   oklch(0.58 0.10 182);   /* teal */
  --color-primary-foreground: oklch(0.99 0 0);
  --color-secondary: oklch(0.78 0.14 68);    /* amber */
  --color-secondary-foreground: oklch(0.24 0.04 68);

  /* surfaces */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.15 0 0);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.15 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-muted-foreground: oklch(0.45 0 0);
  --color-border: oklch(0.92 0 0);
  --color-ring: oklch(0.58 0.10 182);

  /* commerce semantics — REQUIRED, and absent from stock shadcn */
  --color-price: oklch(0.15 0 0);
  --color-price-sale: oklch(0.55 0.19 25);
  --color-discount: oklch(0.55 0.19 25);
  --color-in-stock: oklch(0.60 0.15 150);
  --color-low-stock: oklch(0.70 0.15 70);
  --color-out-of-stock: oklch(0.55 0.02 0);
  --color-success: oklch(0.60 0.15 150);
  --color-warning: oklch(0.75 0.15 80);
  --color-info: oklch(0.60 0.12 240);
  --color-destructive: oklch(0.58 0.22 27);
  --color-rating: oklch(0.80 0.16 85);

  /* radius, spacing, shadow scales */
  --radius-sm: 0.375rem; --radius-md: 0.5rem;
  --radius-lg: 0.75rem;  --radius-xl: 1rem; --radius-2xl: 1.5rem;
}
```

Dark mode: `@custom-variant dark (&:is(.dark *))`, and redefine **only** the
tokens under `.dark`.

### Two absolute colour rules

1. **No component may contain a raw colour.** No `bg-white`, no `text-slate-700`,
   no `#16a34a`. Only tokens. The reference had **1158** raw palette classes
   against 756 semantic ones, plus 78 hardcoded hex values — which is why its
   dark mode was structurally impossible.
2. **Dark mode must actually be wired.** A theme provider, a toggle, and `.dark`
   applied to `<html>`. The reference had **246 `dark:` classes and no theme
   provider at all** — every one of them was unreachable dead code. Either wire
   it properly or do not write `dark:` at all.

Verify with a script that fails the build:
`grep -rE "bg-(white|black|slate|gray|green|red|blue)-?[0-9]*|#[0-9a-fA-F]{6}" src/components` → must be empty.

## Arabic typography

**Font: Cairo.** A variable font — one file covers weights 200–1000, which
matters far more on Libyan mobile data than the choice of family.

**Self-host it.** Do not link Google Fonts: an external request on a slow or
filtered connection is a blocked render. Install `@fontsource-variable/cairo`,
import it in `main.tsx`, `font-display: swap`, and preload the Arabic subset in
`index.html`.

> The reference loaded **Inter with `subsets: ["latin"]`** on an
> `<html lang="ar">` document. Latin-only Inter contains **no Arabic glyphs**, so
> every Arabic character in the entire store fell back to whatever font the
> device happened to have. Verify your font actually loads:
> `document.fonts.check('16px Cairo')` must be `true`, and the served `woff2`
> must carry a `unicode-range` covering `U+0600–06FF`.

- Base `line-height: 1.75`. Arabic needs more leading than Latin.
- Type scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48. Nothing else.
- **Digits**: decide once — Western `0123` or Arabic-Indic `٠١٢٣` — and apply it
  to every price, quantity, date and order number in the app. Record the decision.
- **Money**: one formatter in `lib/format.ts`. Every price in the app goes
  through it. The reference had ten formatting sites and two different formatters
  inside a single component.

## RTL — structural, not patched

**Use logical properties everywhere. Physical direction classes are banned.**

| Never | Always |
|---|---|
| `ml-*` `mr-*` | `ms-*` `me-*` |
| `pl-*` `pr-*` | `ps-*` `pe-*` |
| `left-*` `right-*` | `start-*` `end-*` |
| `text-left` `text-right` | `text-start` `text-end` |
| `border-l` `border-r` | `border-s` `border-e` |
| `rounded-l-*` `rounded-r-*` | `rounded-s-*` `rounded-e-*` |

> The reference had **562 physical-direction classes against 5 logical ones** —
> a 112:1 ratio in an RTL-first app. It was built LTR and corrected by hand, one
> component at a time, forever.

- `dir="rtl"` is set **once**, on `<html>` in `index.html`. **Never repeat it on
  a component.** The reference repeated it in 87 files.
- Mirror directional icons: back arrows, carousel controls, breadcrumb
  separators. A `ChevronLeft` meaning "back" is wrong in RTL.
- Charts, sliders and progress bars must run right-to-left.

**Falsifiable test:** force `<html dir="ltr">` and load the storefront. Nothing
may overflow horizontally and no layout may break. If it does, direction was
hardcoded somewhere.

## Component library

`components/ui/` — primitives only, Radix-based, CVA variants:
Button · Input · Textarea · Select · Checkbox · Radio · Switch · Slider ·
Dialog · Sheet · Drawer · Popover · Tooltip · DropdownMenu · Tabs · Accordion ·
Table · Badge · Alert · Card · Skeleton · Separator · Avatar · Pagination ·
Breadcrumb · Toast · Command/Combobox · ScrollArea · Label · Form.

`components/storefront/` — Price · ProductCard · ProductGallery ·
VariantSelector · QuantityStepper · StockBadge · DiscountBadge · Rating ·
CartLineItem · OrderStatusChip · EmptyState · ErrorState · AddressForm ·
PaymentMethodPicker · DeliveryPicker.

`components/admin/` — DataTable · FormSection · ImageUploader ·
VariantMatrixBuilder · WidgetBuilder · StatCard · ConfirmDialog.

### Sizing — non-negotiable
`sm: h-10` (40 px) · `default: h-11` (44 px) · `lg: h-12` (48 px) ·
`icon: size-11`. **Every interactive target ≥ 44×44 px.** shadcn's defaults are
`h-9`/`h-8` and are too small for a mobile storefront.

Variants must cover real needs — including a **loading** state with a built-in
spinner and `disabled`. If call sites are overriding `className` to reshape a
component, the variant set is wrong. (Reference: 64 such overrides.)

## Accessibility

WCAG 2.1 AA, verified not assumed.
- Contrast **≥ 4.5:1** body, **≥ 3:1** large text and UI. Compute it with a
  script over the token pairs, in both themes. Do not assert ratios by hand.
- Visible focus on every interactive element. Never `outline: none` without a
  replacement.
- Every icon-only button has an Arabic `aria-label`.
- Every input has a real `<label>`.
- Full keyboard operability — including the widget builder's drag-and-drop
  (@dnd-kit keyboard sensors) and the variant selector.
- `prefers-reduced-motion` respected by every animation.
- One `<h1>` per page, heading levels not skipped.
- `alt` on every image; `alt=""` for decorative.

## Motion

Durations 150 / 200 / 300 ms. Easing `ease-out` entering, `ease-in` leaving.
Motion must be purposeful — state change, spatial relationship, or feedback.
No decorative animation on the money path.
