#!/usr/bin/env node
/**
 * Computes WCAG contrast for every token pair in src/styles/globals.css.
 *
 * Contrast is COMPUTED here — OKLCH -> Oklab -> linear sRGB -> relative
 * luminance — never asserted by hand. Exits non-zero on any failure so it can
 * be wired into CI.
 *
 *   node store-app/scripts/check-contrast.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cssPath = resolve(here, '../frontend/src/styles/globals.css')
const css = readFileSync(cssPath, 'utf8')

/** Pull `--color-*: oklch(L C H);` declarations out of a block. */
function parseBlock(source) {
  const tokens = {}
  const re = /--color-([a-z0-9-]+):\s*oklch\(([^)]+)\)/g
  let m
  while ((m = re.exec(source))) {
    const [l, c, h] = m[2].trim().split(/\s+/).map(Number)
    tokens[m[1]] = { l, c, h: h || 0 }
  }
  return tokens
}

// `@theme static` forces Tailwind to emit every token instead of
// tree-shaking the unused ones — see PROGRESS.md, Phase 1 addendum.
const themeBlock = css.match(/@theme(?:\s+static)?\s*\{([\s\S]*?)\n\}/)
const darkBlock = css.match(/\n\.dark\s*\{([\s\S]*?)\n\}/)
if (!themeBlock) throw new Error('no @theme block found in globals.css')

const light = parseBlock(themeBlock[1])
const dark = { ...light, ...parseBlock(darkBlock ? darkBlock[1] : '') }

function oklchToLinearRgb({ l, c, h }) {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3

  return [
    +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
}

function relativeLuminance(token) {
  const [r, g, b] = oklchToLinearRgb(token).map((v) => Math.min(Math.max(v, 0), 1))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg, bg) {
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * kind: 'body' needs 4.5:1, 'ui' (large text, controls, indicators) needs 3:1.
 *
 * `border` is absent on purpose: it is decorative (card edges, dividers), and
 * WCAG 1.4.11 applies to boundaries that are the only means of identifying a
 * control. `input` is exactly that boundary, so it is checked.
 */
const PAIRS = [
  ['foreground', 'background', 'body'],
  ['muted-foreground', 'background', 'body'],
  ['card-foreground', 'card', 'body'],
  ['muted-foreground', 'muted', 'body'],
  ['popover-foreground', 'popover', 'body'],
  ['accent-foreground', 'accent', 'body'],
  ['primary-foreground', 'primary', 'body'],
  ['secondary-foreground', 'secondary', 'body'],
  ['destructive-foreground', 'destructive', 'body'],
  ['price', 'card', 'body'],
  ['price', 'background', 'body'],
  ['price-sale', 'background', 'body'],
  ['price-sale', 'card', 'body'],
  ['discount', 'background', 'body'],
  ['out-of-stock', 'background', 'body'],
  ['in-stock', 'background', 'ui'],
  ['low-stock', 'background', 'ui'],
  ['success', 'background', 'ui'],
  ['warning', 'background', 'ui'],
  ['info', 'background', 'ui'],
  ['destructive', 'background', 'ui'],
  ['rating', 'background', 'ui'],
  ['input', 'background', 'ui'],
  ['ring', 'background', 'ui'],
  ['primary', 'background', 'ui'],
]

const THRESHOLD = { body: 4.5, ui: 3.0 }
let failures = 0

for (const [themeName, tokens] of [
  ['light', light],
  ['dark', dark],
]) {
  console.log(`\n\x1b[1m${themeName} theme\x1b[0m`)
  console.log('  ratio   need  status  pair')
  for (const [fgName, bgName, kind] of PAIRS) {
    const fg = tokens[fgName]
    const bg = tokens[bgName]
    if (!fg || !bg) {
      console.log(`  \x1b[33m  --   \x1b[0m  ---   MISSING  ${fgName} on ${bgName}`)
      failures++
      continue
    }
    const ratio = contrast(fg, bg)
    const need = THRESHOLD[kind]
    const passed = ratio >= need
    if (!passed) failures++
    const colour = passed ? '\x1b[32m' : '\x1b[31m'
    console.log(
      `  ${colour}${ratio.toFixed(2).padStart(5)}\x1b[0m  ${need.toFixed(1)}   ${
        passed ? 'pass  ' : '\x1b[31mFAIL\x1b[0m  '
      }  ${fgName} on ${bgName} (${kind})`,
    )
  }
}

console.log(
  failures === 0
    ? '\n\x1b[32mAll token pairs meet WCAG 2.1 AA.\x1b[0m'
    : `\n\x1b[31m${failures} pair(s) below threshold.\x1b[0m`,
)
process.exit(failures === 0 ? 0 : 1)
