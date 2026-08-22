#!/usr/bin/env node
/**
 * Lighthouse mobile, three runs, median — against a PRODUCTION build.
 *
 *   node scripts/perf.mjs                       # the default route set
 *   node scripts/perf.mjs /products/some-slug   # specific routes
 *
 * `11-gates-and-testing.md`: "A number without its conditions is not a
 * measurement." Every run prints the host, the Chrome version, the command and
 * the throttling profile alongside the numbers, and the process exits non-zero
 * when a budget from `05-frontend-spec.md` is missed.
 *
 * Lighthouse is a dev dependency installed on demand
 * (`npm install --no-save lighthouse`) — it is a measuring tool, not something
 * the production system runs. Nothing Node-based serves traffic; nginx does.
 */

import { execSync } from 'node:child_process'
import { hostname, cpus, arch, release, type } from 'node:os'

const BASE = process.env.PERF_BASE_URL || 'http://localhost:5184'
const ROUTES = process.argv.slice(2)
const RUNS = Number(process.env.PERF_RUNS || 3)

// From `05-frontend-spec.md` and the Phase 9 gate (`09-phases.md`): mobile
// Lighthouse ≥ 90 Performance / ≥ 95 Accessibility / 100 SEO.
const BUDGETS = {
  performance: 90, // Lighthouse score, mobile
  accessibility: 95,
  seo: 100,
  lcp: 2500, // ms
  cls: 0.05,
}

const DEFAULT_ROUTES = ['/', '/products']

const LIGHTHOUSE = 'node_modules/.bin/lighthouse'

function runOnce(url) {
  const command =
    `${LIGHTHOUSE} "${url}" --quiet --output=json --output-path=stdout ` +
    `--only-categories=performance,accessibility,seo --preset=perf ` +
    `--chrome-flags="--headless=new --no-sandbox"`
  const raw = execSync(command, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const report = JSON.parse(raw)
  return {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    lcp: report.audits['largest-contentful-paint'].numericValue,
    cls: report.audits['cumulative-layout-shift'].numericValue,
    tbt: report.audits['total-blocking-time'].numericValue,
    chrome: report.environment.hostUserAgent,
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const routes = ROUTES.length > 0 ? ROUTES : DEFAULT_ROUTES

console.log('Conditions')
console.log(`  host        ${hostname()} · ${type()} ${release()} · ${arch()} · ${cpus().length} cores`)
console.log(`  base url    ${BASE}   (production build served by \`vite preview\`)`)
console.log(`  runs        ${RUNS}, median reported`)
console.log(`  throttling  Lighthouse mobile defaults (4x CPU, simulated Slow 4G)`)
console.log(`  command     ${LIGHTHOUSE} <url> --preset=perf --only-categories=performance`)
console.log('')

let failed = false

for (const route of routes) {
  const url = `${BASE}${route}`
  const results = []
  for (let run = 0; run < RUNS; run += 1) {
    process.stdout.write(`  ${route}  run ${run + 1}/${RUNS}…\r`)
    results.push(runOnce(url))
  }

  const performance = median(results.map((r) => r.performance))
  const accessibility = median(results.map((r) => r.accessibility))
  const seo = median(results.map((r) => r.seo))
  const lcp = median(results.map((r) => r.lcp))
  const cls = median(results.map((r) => r.cls))
  const tbt = median(results.map((r) => r.tbt))

  const checks = [
    ['performance', performance, BUDGETS.performance, performance >= BUDGETS.performance, '≥'],
    ['accessibility', accessibility, BUDGETS.accessibility, accessibility >= BUDGETS.accessibility, '≥'],
    ['seo', seo, BUDGETS.seo, seo >= BUDGETS.seo, '≥'],
    ['LCP (ms)', Math.round(lcp), BUDGETS.lcp, lcp <= BUDGETS.lcp, '≤'],
    ['CLS', Number(cls.toFixed(3)), BUDGETS.cls, cls <= BUDGETS.cls, '≤'],
  ]

  console.log(`${route}   (chrome: ${results[0].chrome.match(/Chrome\/[\d.]+/)?.[0] ?? '?'})`)
  for (const [name, value, budget, ok, direction] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(14)} ${String(value).padStart(7)}   budget ${direction} ${budget}`)
    if (!ok) failed = true
  }
  console.log(`        TBT (ms)       ${String(Math.round(tbt)).padStart(7)}   (informational)`)
  console.log('')
}

process.exit(failed ? 1 : 0)
