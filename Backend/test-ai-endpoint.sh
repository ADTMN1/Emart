#!/bin/bash

BASE_URL="http://localhost:5000/api/v1/ai/chat"

echo "=========================================="
echo "EMART AI Chat Endpoint Test Suite"
echo "=========================================="
echo ""

# Test 1: Valid general question
echo "Test 1: Valid general question about proxy shopping"
echo "Request: What is proxy shopping?"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"What is proxy shopping?"}')
echo "Status: $(echo $RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)"
echo "Response preview: $(echo $RESPONSE | grep -o '"message":"[^"]*' | head -1 | cut -c1-100)..."
echo ""

# Test 2: Empty message validation
echo "Test 2: Empty message validation"
echo "Request: {message: ''}"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":""}')
echo "Status: $(echo $RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)"
echo "Error: $(echo $RESPONSE | grep -o '"error":"[^"]*' | cut -d'"' -f4)"
echo ""

# Test 3: Missing message field
echo "Test 3: Missing message field"
echo "Request: {}"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{}')
echo "Status: $(echo $RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)"
echo "Error: $(echo $RESPONSE | grep -o '"error":"[^"]*' | cut -d'"' -f4)"
echo ""

# Test 4: AI refuses to invent product information
echo "Test 4: AI refuses to invent specific EMART product data"
echo "Request: What products does EMART sell and at what price?"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"What products does EMART sell and at what price?"}')
echo "Status: $(echo $RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)"
echo "Response contains 'don'\''t have access': $(echo $RESPONSE | grep -i "don't have access" > /dev/null && echo "YES" || echo "NO")"
echo ""

# Test 5: AI refuses to invent shipping costs
echo "Test 5: AI refuses to invent specific shipping costs"
echo "Request: How much does it cost to ship from Japan to USA?"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"How much does it cost to ship from Japan to USA?"}')
echo "Status: $(echo $RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)"
echo "Response mentions factors/variables: $(echo $RESPONSE | grep -iE "(depend|vary|factor)" > /dev/null && echo "YES" || echo "NO")"
echo ""

# Test 6: Valid question about EMART concept
echo "Test 6: Valid question about EMART service concept"
echo "Request: What is EMART?"
RESPONSE=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d '{"message":"What is EMART?"}')
echo "Status: $(echo $RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)"
echo "Response mentions 'proxy' or 'shopping': $(echo $RESPONSE | grep -iE "(proxy|shopping)" > /dev/null && echo "YES" || echo "NO")"
echo ""

echo "=========================================="
echo "Test Suite Complete"
echo "=========================================="
