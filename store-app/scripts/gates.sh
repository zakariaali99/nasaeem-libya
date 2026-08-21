#!/usr/bin/env bash
#
# The static half of 11-gates-and-testing.md. Every check below can fail, and
# the script exits non-zero when one does. Run it before declaring any phase
# complete.
#
#   bash store-app/scripts/gates.sh
#
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
FE="$ROOT/frontend"
BE="$ROOT/backend"

pass=0
fail=0

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail + 1)); [ -n "${2:-}" ] && printf '        %s\n' "$2"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# assert_empty <description> <command...>  — fails if the command prints anything
assert_empty() {
  local desc="$1"; shift
  local out
  out="$("$@" 2>/dev/null)"
  if [ -z "$out" ]; then ok "$desc"; else bad "$desc" "$(echo "$out" | head -5)"; fi
}

head_ "Rule 1 — no Next.js, no Node runtime in production"

assert_empty "no next/* imports in frontend/src" \
  grep -rn "from ['\"]next/" "$FE/src"
if grep -q '"next"' "$FE/package.json" 2>/dev/null; then
  bad "no 'next' dependency in package.json"
else
  ok "no 'next' dependency in package.json"
fi
assert_empty "no Node file serving traffic (express/fastify/http.createServer)" \
  grep -rln "require('express')\|from 'express'\|from 'fastify'\|http.createServer" "$FE/src"

head_ "Rule 2 — no Docker"

DOCKERFILES="$(find "$ROOT" -name 'Dockerfile' -o -name 'docker-compose.y*ml' 2>/dev/null | grep -v node_modules)"
if [ -z "$DOCKERFILES" ]; then ok "no Dockerfile or compose file"; else bad "no Dockerfile or compose file" "$DOCKERFILES"; fi

head_ "Design system"

if [ -f "$FE/tailwind.config.ts" ] || [ -f "$FE/tailwind.config.js" ]; then
  bad "no tailwind.config.* (v4 is CSS-first; a config file silently never compiles)"
else
  ok "no tailwind.config.* (v4 is CSS-first)"
fi

if [ -d "$FE/src/components" ]; then
  assert_empty "no raw palette classes in src/components" \
    grep -rEn "bg-(white|black)|(bg|text|border)-(slate|gray|zinc|neutral|stone|green|red|blue|yellow|amber|teal)-[0-9]" "$FE/src/components"
  assert_empty "no hardcoded hex colours in src/components" \
    grep -rEn "#[0-9a-fA-F]{6}\b" "$FE/src/components"
else
  ok "no raw palette classes in src/components (no components yet)"
  ok "no hardcoded hex colours in src/components (no components yet)"
fi

assert_empty "no physical-direction classes in src (use ms/me, ps/pe, start/end)" \
  grep -rEn "className=[^>]*\b(ml|mr|pl|pr)-[0-9]|className=[^>]*\b(left|right)-[0-9]|className=[^>]*text-(left|right)\b" "$FE/src"

RTL_FILES="$(grep -rl 'dir="rtl"' "$FE/src" "$FE/index.html" 2>/dev/null | wc -l | tr -d ' ')"
if [ "$RTL_FILES" -le 1 ]; then
  ok "dir=\"rtl\" appears in at most one file (found: $RTL_FILES)"
else
  bad "dir=\"rtl\" appears in at most one file" "found in $RTL_FILES files"
fi

head_ "Types and Django checks"

if (cd "$FE" && npx --no-install tsc --noEmit >/tmp/gates-tsc.log 2>&1); then
  ok "tsc --noEmit clean"
else
  bad "tsc --noEmit clean" "$(head -5 /tmp/gates-tsc.log)"
fi

if [ -x "$BE/.venv/bin/python" ]; then
  if (cd "$BE" && env DEBUG=False \
      SECRET_KEY="$(openssl rand -hex 32)" \
      ALLOWED_HOSTS=example.ly \
      CSRF_TRUSTED_ORIGINS=https://example.ly \
      DATABASE_URL="${DATABASE_URL:-postgres://localhost/nasaim_dev}" \
      REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}" \
      .venv/bin/python manage.py check --deploy >/tmp/gates-django.log 2>&1); then
    ok "manage.py check --deploy clean with DEBUG=False"
  else
    bad "manage.py check --deploy clean with DEBUG=False" "$(tail -5 /tmp/gates-django.log)"
  fi

  if (cd "$BE" && .venv/bin/python manage.py makemigrations --check --dry-run >/tmp/gates-mig.log 2>&1); then
    ok "no missing migrations"
  else
    bad "no missing migrations" "$(tail -3 /tmp/gates-mig.log)"
  fi
else
  bad "backend venv present" "$BE/.venv/bin/python not found"
fi

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
