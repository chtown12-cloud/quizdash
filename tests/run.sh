#!/bin/bash
# Runs every browser test in this folder against a local copy of the game.
# Needs Node with Playwright, and the game served at http://localhost:8123:
#   npx http-server . -p 8123 -s -c-1
# Usage: tests/run.sh [name ...]   (no names: run them all)
cd "$(dirname "$0")"
# this machine's own Chromium and Playwright, where they live outside the project
[ -z "$QD_CHROMIUM" ] && [ -x /opt/pw-browsers/chromium ] && export QD_CHROMIUM=/opt/pw-browsers/chromium
[ -z "$NODE_PATH" ] && [ -d /opt/node22/lib/node_modules ] && export NODE_PATH=/opt/node22/lib/node_modules
mkdir -p out
names=("$@"); [ ${#names[@]} -eq 0 ] && names=($(ls *.js | sed 's/\.js$//'))
fails=0
for t in "${names[@]}"; do
  timeout 600 node "$t.js" > "out/$t.txt" 2>&1
  p=$(grep -c '^PASS' "out/$t.txt"); f=$(grep -c '^FAIL' "out/$t.txt")
  crash=$(grep -c 'triggerUncaughtException\|^Error' "out/$t.txt")
  echo "$t: $p passed, $f failed$([ "$crash" -gt 0 ] && echo ', CRASHED')"
  grep '^FAIL' "out/$t.txt" | head -5
  [ "$f" -gt 0 ] || [ "$crash" -gt 0 ] && fails=$((fails + 1))
done
exit $fails
