#!/usr/bin/env bash
# 跑全部的端對端測試：會在 8770 埠開一個本機伺服器提供 public/，一支一支執行，最後列出失敗的
# 需要 Node 與 Playwright（Chromium）：npm i -D playwright && npx playwright install chromium
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8770}"
export LIFEY_URL="${LIFEY_URL:-http://127.0.0.1:$PORT/}"
export LIFEY_OUT="${LIFEY_OUT:-$(mktemp -d)}"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory public >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
failed=0
for t in tests/e2e/*.test.cjs; do
  out=$(node "$t" 2>&1)
  if echo "$out" | grep -q "❌\|💥\|Error"; then
    echo "✗ $(basename "$t")"; echo "$out" | grep "❌\|💥\|Error" | head -5; failed=$((failed + 1))
  else
    echo "✓ $(basename "$t")（$(echo "$out" | grep -c '✅') 項）"
  fi
done
echo "截圖存在 $LIFEY_OUT"
exit $failed
