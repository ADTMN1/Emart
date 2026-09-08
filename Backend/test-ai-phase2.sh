#!/bin/bash

BASE_URL="http://localhost:5000/api/v1/ai/chat"

echo "=========================================="
echo "EMART AI Phase 2 - Knowledge RAG Tests"
echo "=========================================="
echo ""

# Helper function to check if response contains text
check_response() {
    local response="$1"
    local search_term="$2"
    local test_name="$3"
    
    if echo "$response" | grep -qi "$search_term"; then
        echo "  ✓ PASS: Response contains '$search_term'"
        return 0
    else
        echo "  ✗ FAIL: Response does NOT contain '$search_term'"
        return 1
    fi
}

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Proxy Fee Information (Specific Numbers)
echo "Test 1: Proxy fee for items under ¥5,000"
echo "Expected: Should return ¥500 fee from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How much is the proxy fee for an item that costs 3000 yen?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "500" "Proxy fee"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 2: International Shipping Costs (Specific Numbers)
echo "Test 2: Shipping cost to USA"
echo "Expected: Should provide specific costs from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How much does it cost to ship 1kg to USA via EMS?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "3,500\|3500" "Shipping cost"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 3: Warehouse Storage Period
echo "Test 3: Free storage period"
echo "Expected: Should return 60 days from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How long can I store items for free at the warehouse?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "60" "Free storage"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 4: Photo Inspection Fees
echo "Test 4: Photo inspection costs"
echo "Expected: Should return ¥200 or ¥500 from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How much does photo inspection cost?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "200\|500" "Inspection fee"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 5: Return Policy (Within 48 hours)
echo "Test 5: Return request timeframe"
echo "Expected: Should mention 48 hours from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How quickly do I need to request a return after my item arrives at the warehouse?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "48" "Return timeframe"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 6: Payment Methods
echo "Test 6: Accepted payment methods"
echo "Expected: Should list credit cards, PayPal, etc. from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"What payment methods does EMART accept?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "credit\|visa\|paypal\|mastercard" "Payment methods"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 7: Prohibited Items
echo "Test 7: Prohibited items"
echo "Expected: Should mention weapons, hazardous materials from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"Can I ship lithium batteries?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "restrict\|prohibit\|limitation" "Prohibited items"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 8: Consolidation Fee
echo "Test 8: Package consolidation pricing"
echo "Expected: Should mention free for 5 items, ¥200 beyond"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How much does it cost to consolidate 7 packages?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "free\|200\|¥200" "Consolidation fee"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 9: Company Information
echo "Test 9: Company information"
echo "Expected: Should provide EMART description from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"Tell me about EMART company"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "proxy\|shopping\|platform" "Company info"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 10: Question NOT in knowledge base
echo "Test 10: Question not covered in knowledge base"
echo "Expected: Should say it doesn't have that information"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"What are the specific operating hours of EMART customer service on Tuesdays?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "don't have\|not have\|don't know\|specific information" "Out of scope"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 11: Phase 1 compatibility - General question
echo "Test 11: Phase 1 compatibility - General proxy shopping question"
echo "Expected: Should still answer general questions"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"What is proxy shopping?"}')
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
    echo "  ✓ PASS: Request successful"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo "  ✗ FAIL: Request failed"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 12: Phase 1 compatibility - Empty message validation
echo "Test 12: Phase 1 compatibility - Empty message validation"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":""}')
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" = "false" ]; then
    echo "  ✓ PASS: Validation working"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo "  ✗ FAIL: Validation not working"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test 13: Repackaging service costs
echo "Test 13: Repackaging service costs"
echo "Expected: Should return ¥300 or ¥600 from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How much does repackaging cost?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "300\|600" "Repackaging fee"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 14: Shipping methods and timing
echo "Test 14: EMS shipping delivery time"
echo "Expected: Should mention 3-7 days from knowledge base"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How long does EMS shipping take?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "3.*7\|3-7" "EMS timing"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

# Test 15: Prohibited items - counterfeit policy
echo "Test 15: Counterfeit items policy"
echo "Expected: Should mention zero tolerance or refund policy"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"What happens if I receive a counterfeit item?"}')
echo "Response: $(echo $RESPONSE | jq -r '.data.message' | head -c 150)..."
check_response "$RESPONSE" "refund\|counterfeit\|zero tolerance" "Counterfeit policy"
if [ $? -eq 0 ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
echo ""

echo "=========================================="
echo "Test Results Summary"
echo "=========================================="
echo "Total Tests: $((PASS_COUNT + FAIL_COUNT))"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi
