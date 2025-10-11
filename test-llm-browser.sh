#!/bin/bash
# Test LLM-controlled browser service

set -e

API_URL="${BROWSER_SERVICE_URL:-https://claude-agent-production.up.railway.app}"
API_KEY="${BROWSER_SERVICE_API_KEY:-test-key-12345}"
SESSION_ID="test-$(date +%s)"

echo "🧪 Testing LLM-Controlled Browser Service"
echo "========================================="
echo "API URL: $API_URL"
echo "Session ID: $SESSION_ID"
echo ""

# Test 1: Navigate to a website
echo "1️⃣  Navigate to example.com..."
curl -s -X POST "$API_URL/api/browser/navigate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"url\":\"https://example.com\"}" | jq .

echo ""

# Test 2: Get page snapshot
echo "2️⃣  Get page snapshot..."
SNAPSHOT=$(curl -s -X POST "$API_URL/api/browser/snapshot" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}")

echo "$SNAPSHOT" | jq '.data.snapshot' | head -20
echo "... (truncated)"
echo ""

# Test 3: Get page content
echo "3️⃣  Get page content..."
curl -s -X POST "$API_URL/api/browser/content" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq '{url: .data.url, textLength: .data.textLength}'

echo ""

# Test 4: Execute JavaScript
echo "4️⃣  Execute JavaScript (get page title)..."
curl -s -X POST "$API_URL/api/browser/evaluate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"script\":\"document.title\"}" | jq .

echo ""

# Test 5: Navigate to a form page
echo "5️⃣  Navigate to a page with a form..."
curl -s -X POST "$API_URL/api/browser/navigate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"url\":\"https://httpbin.org/forms/post\"}" | jq .

echo ""

# Test 6: Get snapshot of form
echo "6️⃣  Get form snapshot..."
curl -s -X POST "$API_URL/api/browser/snapshot" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq '.data.snapshot' | head -30

echo ""

# Test 7: Close session
echo "7️⃣  Close session..."
curl -s -X POST "$API_URL/api/browser/close" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"sessionId\":\"$SESSION_ID\"}" | jq .

echo ""
echo "========================================="
echo "✅ All tests passed!"

