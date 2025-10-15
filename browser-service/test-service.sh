#!/bin/bash
# Quick test script for browser service

set -e

echo "🧪 Testing Browser Automation Service"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if service is running
echo ""
echo "1️⃣  Testing health endpoint..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    curl -s http://localhost:3001/health | jq .
else
    echo -e "${RED}✗ Service not running on port 3001${NC}"
    echo "Start the service with: cd browser-service && npm run dev"
    exit 1
fi

# Test Indeed search
echo ""
echo "2️⃣  Testing Indeed job search..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-12345" \
  -d '{"keywords":"software engineer","location":"remote"}')

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    JOB_COUNT=$(echo "$RESPONSE" | jq '.data | length')
    echo -e "${GREEN}✓ Indeed search successful - Found $JOB_COUNT jobs${NC}"
    echo "$RESPONSE" | jq '.data[0] | {title, company, location}' 2>/dev/null || echo "No jobs found"
else
    echo -e "${RED}✗ Indeed search failed${NC}"
    echo "$RESPONSE" | jq . || echo "$RESPONSE"
    exit 1
fi

# Test authentication
echo ""
echo "3️⃣  Testing authentication..."
AUTH_TEST=$(curl -s -X POST http://localhost:3001/api/search-indeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-key" \
  -d '{"keywords":"test","location":"test"}')

if echo "$AUTH_TEST" | jq -e '.error == "Unauthorized"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Authentication working correctly${NC}"
else
    echo -e "${RED}✗ Authentication not working${NC}"
    echo "$AUTH_TEST"
fi

echo ""
echo "======================================"
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Start Next.js app: npm run dev (in project root)"
echo "2. Test end-to-end: Visit http://localhost:3000/agent"
echo "3. Send message: 'Search for frontend developer jobs in San Francisco'"

