#!/bin/sh
set -e
cd "$(dirname "$0")"
# Najpierw: python3 scripts/prep_cortex.py <katalog brainspace/datasets> public/data  (tworzy cortex.bin i cortex.json)
rm -rf dist && mkdir -p dist/data
cp public/index.html public/uplot.css dist/
base64 -w0 public/data/cortex.bin > dist/data/cortex.b64.txt
cp public/data/cortex.json dist/data/
cp public/data/L5_TTPC_C010398B-P2.swc dist/data/L5_TTPC_C010398B-P2.swc.txt
npx esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile=dist/app.js --log-level=warning
ls -la dist dist/data
