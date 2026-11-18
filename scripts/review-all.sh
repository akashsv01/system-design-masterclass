#!/usr/bin/env bash
# Review every implemented or verified topic at desktop and phone size and update verification.json.
# Usage: scripts/review-all.sh <baseUrl> <screenshotDir>
set -euo pipefail
BASE=${1:-http://localhost:8787}
OUT=${2:-screenshots-local}
mkdir -p "$OUT"
ROUTES=$(node -e "const fs=require('fs');console.log([...fs.readFileSync('docs/COVERAGE.md','utf8').matchAll(/\\]\\(\\/(learn|labs|patterns)\\/([a-z0-9-]+)\\) \\| (verified|implemented)/g)].map(m=>m[1]==='learn'?m[2]:m[1]+'/'+m[2]).join(' '))")
node scripts/review-lessons.cjs "$BASE" "$OUT" $ROUTES --write-verification
