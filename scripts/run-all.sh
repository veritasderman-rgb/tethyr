#!/usr/bin/env bash
# Celá sada testů v jednom prohlížeči: BROWSER=chromium|firefox|webkit scripts/run-all.sh [DEVICE=iphone|pixel]
# Předpoklad: `npm run build` a `npx vite preview --port 4173`. Výsledky: /tmp/t/<prohlížeč>-<test>.log, shrnutí na konci.
cd "$(dirname "$0")/.."
B=${BROWSER:-chromium}; mkdir -p /tmp/t
for t in test-players test-it9 test-it8 test-it4-audio test-it4-witness test-it4-film test-it5-map test-it5-3d test-it6 test-it7 test-it6-a11y; do
  [ -f scripts/$t.py ] || continue
  SHOT_OUT=/home/claude/webshots/it9/$B/$t timeout 1500 python3 scripts/$t.py > /tmp/t/$B-$t.log 2>&1
  echo "$B $t exit=$? $(grep -c '^OK' /tmp/t/$B-$t.log) OK, $(grep -c '^FAIL' /tmp/t/$B-$t.log) FAIL" | tee -a /tmp/t/$B-summary.txt
done
