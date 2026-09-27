#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"
BACKEND_DIST="${SCRIPT_DIR}/../backend/dist"

echo "==> Building frontend with Vite & compression..."
cd "${FRONTEND_DIR}"
npm run build

echo "==> Updating backend dist..."
TMP_HTACCESS=""
if [ -f "${BACKEND_DIST}/.htaccess" ]; then
    TMP_HTACCESS=$(mktemp)
    cp "${BACKEND_DIST}/.htaccess" "${TMP_HTACCESS}"
fi

rm -rf "${BACKEND_DIST}"
mkdir -p "${BACKEND_DIST}"
cp -R "${FRONTEND_DIR}/dist/"* "${BACKEND_DIST}/"
cp -R "${FRONTEND_DIR}/dist/".* "${BACKEND_DIST}/" 2>/dev/null || true

if [ -n "${TMP_HTACCESS}" ] && [ -f "${TMP_HTACCESS}" ]; then
    if [ ! -f "${BACKEND_DIST}/.htaccess" ]; then
        cp "${TMP_HTACCESS}" "${BACKEND_DIST}/.htaccess"
    fi
    rm -f "${TMP_HTACCESS}"
fi

echo "==> Frontend built and synced to backend/dist successfully."
