#!/bin/bash
# Landout Map Verification Script
# Runs Playwright smoke tests and saves screenshots for review

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/test-output"

echo "========================================"
echo " Landout Map Verification"
echo "========================================"

# Check if dev server is running
if ! curl -s --max-time 2 http://localhost:3000 > /dev/null 2>&1; then
  echo "⚠️  Dev server not running on localhost:3000"
  echo "Starting dev server..."
  cd "$PROJECT_DIR"
  npm run dev -- -H 0.0.0.0 &
  DEV_PID=$!
  echo "Waiting for dev server to start..."
  for i in $(seq 1 30); do
    if curl -s --max-time 2 http://localhost:3000 > /dev/null 2>&1; then
      echo "✅ Dev server ready"
      break
    fi
    sleep 2
  done
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
export BASE_URL

cd "$PROJECT_DIR"

echo ""
echo "--- Running smoke tests ---"
npx playwright test --reporter=list 2>&1 | tee "$OUTPUT_DIR/test-results.txt"
TEST_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "--- Screenshot output ---"
ls -lh "$OUTPUT_DIR/screenshots/" 2>/dev/null || echo "No screenshots yet (run with --grep Screenshot)"

echo ""
echo "========================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ All smoke tests passed"
else
  echo "❌ Some tests failed — see output above"
  echo "HTML report: $OUTPUT_DIR/html-report/index.html"
fi
echo "========================================"

exit $TEST_EXIT_CODE
