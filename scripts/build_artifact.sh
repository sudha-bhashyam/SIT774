#!/usr/bin/env bash
set -euo pipefail
mkdir -p build
NAME="sit774-build-$(date +%s).zip"
zip -r "build/$NAME" . \
  -x "node_modules/*" ".git/*" "*.pid" "*.log" "build/*" ".DS_Store" ".env"
echo "build/$NAME"
