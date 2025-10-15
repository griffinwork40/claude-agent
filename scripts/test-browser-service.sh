#!/bin/bash

# Test Browser Service Connectivity
# Tests the Railway-deployed service at https://claude-agent-production.up.railway.app

set -e

SERVICE_URL="https://claude-agent-production.up.railway.app"
API_KEY="test-key-12345"

echo "🔍 Testing Browser Service Connectivity"
echo "Service URL: $SERVICE_URL"
echo "API Key: $API_KEY"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/health" || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == "FAILED" ]]; then
    echo "❌ Health check failed - service may be down"
    exit 1
else
    echo "✅ Health check passed"
    echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
fi
echo ""

# Test 2: Indeed Search
echo "2️⃣  Testing Indeed job search..."
INDEED_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/search-indeed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"keywords":"line cook","location":"Altamonte Springs"}' || echo "FAILED")

if [[ "$INDEED_RESPONSE" == "FAILED" ]]; then
    echo "❌ Indeed search request failed"
else
    echo "✅ Indeed search request completed"
    echo "$INDEED_RESPONSE" | jq . 2>/dev/null || echo "$INDEED_RESPONSE"
fi
echo ""

# Test 3: Google Jobs Search
echo "3️⃣  Testing Google Jobs search..."
GOOGLE_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/search-google" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"keywords":"line cook","location":"Altamonte Springs"}' || echo "FAILED")

if [[ "$GOOGLE_RESPONSE" == "FAILED" ]]; then
    echo "❌ Google Jobs search request failed"
else
    echo "✅ Google Jobs search request completed"
    echo "$GOOGLE_RESPONSE" | jq . 2>/dev/null || echo "$GOOGLE_RESPONSE"
fi
echo ""

# Test 4: LinkedIn Search (may fail due to auth requirements)
echo "4️⃣  Testing LinkedIn search (may require authentication)..."
LINKEDIN_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/search-linkedin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"keywords":"line cook","location":"Altamonte Springs","userId":"test-user"}' || echo "FAILED")

if [[ "$LINKEDIN_RESPONSE" == "FAILED" ]]; then
    echo "❌ LinkedIn search request failed"
else
    echo "✅ LinkedIn search request completed"
    echo "$LINKEDIN_RESPONSE" | jq . 2>/dev/null || echo "$LINKEDIN_RESPONSE"
fi
echo ""

echo "🏁 Browser service connectivity test completed"
