#!/usr/bin/env bash
# 雲端功能測試（Face ID 登入、跨裝置同步、家人連結、AI 故事）：每支測試各開一個空的本機雲端（wrangler dev + 本機 D1/R2）
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8787}"
export LIFEY_OUT="${LIFEY_OUT:-$(mktemp -d)}"
failed=0
for t in ${ONLY:-tests/e2e/*.cloud.cjs}; do
  # 每支測試用新的埠和新的資料夾，確保是空的資料庫（wrangler 的子行程不一定會跟著結束）
  PORT=$((PORT + 1))
  export LIFEY_URL="http://localhost:$PORT/"
  state=$(mktemp -d)
  # AI 故事接到測試自己開的假 Claude API（FAKE_AI_PORT），不會真的呼叫
  export FAKE_AI_PORT=$((PORT + 1000))
  setsid npx wrangler dev --local --port "$PORT" --persist-to "$state" \
    --var ANTHROPIC_API_KEY:test-key --var STORY_API_BASE:http://127.0.0.1:$FAKE_AI_PORT >/dev/null 2>&1 &
  W=$!
  for i in $(seq 1 60); do curl -s "$LIFEY_URL/api/signup" 2>/dev/null | grep -q open && break; sleep 1; done
  out=$(node "$t" 2>&1); echo "$out" > "$LIFEY_OUT/$(basename "$t").log"
  kill -- -"$W" 2>/dev/null; wait "$W" 2>/dev/null; rm -rf "$state"
  if echo "$out" | grep -q "❌\|💥"; then
    echo "✗ $(basename "$t")"; echo "$out" | grep "❌\|💥" | head -5; failed=$((failed + 1))
  else
    echo "✓ $(basename "$t")（$(echo "$out" | grep -c '✅') 項）"
  fi
done
exit $failed
