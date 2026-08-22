#!/usr/bin/env bash
# Re-copy the self-hosted Cairo subsets from the npm package into public/fonts/.
# Run after bumping @fontsource-variable/cairo. The unicode-range values in
# src/styles/globals.css come from the package's index.css and must be re-checked
# if the package changes them.
set -euo pipefail
cd "$(dirname "$0")/../frontend"
SRC=node_modules/@fontsource-variable/cairo/files
cp "$SRC/cairo-arabic-wght-normal.woff2" public/fonts/cairo-arabic.woff2
cp "$SRC/cairo-latin-wght-normal.woff2"  public/fonts/cairo-latin.woff2
KUFY=node_modules/@fontsource-variable/reem-kufi/files
cp "$KUFY/reem-kufi-arabic-wght-normal.woff2" public/fonts/reem-kufi-arabic.woff2
cp "$KUFY/reem-kufi-latin-wght-normal.woff2"  public/fonts/reem-kufi-latin.woff2
echo "synced: $(ls -1 public/fonts | tr '\n' ' ')"
