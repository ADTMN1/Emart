#!/bin/bash

# EMART Authentication Flow Testing Script
# This script tests the complete authentication flow

API_BASE="http://localhost:5000/api/v1"
TIMESTAMP=$(date +%s)
TEST_EMAIL="testuser_${TIMESTAMP}@example.com"
TEST_PASSWORD="Test@12345"
TEST_FIRSTNAME="John"
TEST_LASTNAME="Doe"

echo "======================================"
echo "EMART Authentication Testing"
echo "======================================"
echo ""
echo "Base URL: $API_BASE"
echo "Test Email: $TEST_EMAIL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Register a new user
echo "Test 1: Register New User"
echo "--------------------------------------"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"$TEST_FIRSTNAME\",
    \"lastName\": \"$TEST_LASTNAME\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Registration successful${NC}"
  TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
  USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.user.id')
  echo "Token: ${TOKEN:0:20}..."
  echo "User ID: $USER_ID"
else
  echo -e "${RED}✗ Registration failed${NC}"
  exit 1
fi

echo ""
echo ""

# Test 2: Get User Profile
echo "Test 2: Get User Profile (Protected Route)"
echo "--------------------------------------"
PROFILE_RESPONSE=$(curl -s -X GET "$API_BASE/auth/profile" \
  -H "Authorization: Bearer $TOKEN")

echo "$PROFILE_RESPONSE" | jq '.'

if echo "$PROFILE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Profile retrieved successfully${NC}"
else
  echo -e "${RED}✗ Failed to retrieve profile${NC}"
fi

echo ""
echo ""

# Test 3: Update Profile
echo "Test 3: Update Profile"
echo "--------------------------------------"
UPDATE_RESPONSE=$(curl -s -X PUT "$API_BASE/auth/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"firstName\": \"Jane\",
    \"lastName\": \"Smith\",
    \"phone\": \"+1234567890\"
  }")

echo "$UPDATE_RESPONSE" | jq '.'

if echo "$UPDATE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Profile updated successfully${NC}"
else
  echo -e "${RED}✗ Failed to update profile${NC}"
fi

echo ""
echo ""

# Test 4: Logout
echo "Test 4: Logout"
echo "--------------------------------------"
LOGOUT_RESPONSE=$(curl -s -X POST "$API_BASE/auth/logout" \
  -H "Authorization: Bearer $TOKEN")

echo "$LOGOUT_RESPONSE" | jq '.'

if echo "$LOGOUT_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Logout successful${NC}"
else
  echo -e "${RED}✗ Logout failed${NC}"
fi

echo ""
echo ""

# Test 5: Login with credentials
echo "Test 5: Login with Credentials"
echo "--------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'

if echo "$LOGIN_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Login successful${NC}"
  NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
  echo "New Token: ${NEW_TOKEN:0:20}..."
else
  echo -e "${RED}✗ Login failed${NC}"
fi

echo ""
echo ""

# Test 6: Refresh Token
echo "Test 6: Refresh Token"
echo "--------------------------------------"
REFRESH_RESPONSE=$(curl -s -X POST "$API_BASE/auth/refresh-token" \
  -H "Authorization: Bearer $NEW_TOKEN")

echo "$REFRESH_RESPONSE" | jq '.'

if echo "$REFRESH_RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Token refresh successful${NC}"
  REFRESHED_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.token')
  echo "Refreshed Token: ${REFRESHED_TOKEN:0:20}..."
else
  echo -e "${RED}✗ Token refresh failed${NC}"
fi

echo ""
echo ""

# Test 7: Invalid login attempt
echo "Test 7: Invalid Login Attempt (Wrong Password)"
echo "--------------------------------------"
INVALID_LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"WrongPassword123!\"
  }")

echo "$INVALID_LOGIN_RESPONSE" | jq '.'

if echo "$INVALID_LOGIN_RESPONSE" | jq -e '.success == false' > /dev/null; then
  echo -e "${GREEN}✓ Invalid login correctly rejected${NC}"
else
  echo -e "${RED}✗ Invalid login was not properly rejected${NC}"
fi

echo ""
echo ""

# Test 8: Duplicate registration
echo "Test 8: Duplicate Registration (Should Fail)"
echo "--------------------------------------"
DUPLICATE_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"Duplicate\",
    \"lastName\": \"User\"
  }")

echo "$DUPLICATE_RESPONSE" | jq '.'

if echo "$DUPLICATE_RESPONSE" | jq -e '.success == false' > /dev/null; then
  echo -e "${GREEN}✓ Duplicate registration correctly rejected${NC}"
else
  echo -e "${RED}✗ Duplicate registration was not properly rejected${NC}"
fi

echo ""
echo ""

# Test 9: Invalid password format
echo "Test 9: Weak Password Validation"
echo "--------------------------------------"
WEAK_PASSWORD_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"weakpass_${TIMESTAMP}@example.com\",
    \"password\": \"weak\",
    \"firstName\": \"Weak\",
    \"lastName\": \"Password\"
  }")

echo "$WEAK_PASSWORD_RESPONSE" | jq '.'

if echo "$WEAK_PASSWORD_RESPONSE" | jq -e '.success == false' > /dev/null; then
  echo -e "${GREEN}✓ Weak password correctly rejected${NC}"
else
  echo -e "${RED}✗ Weak password was not properly rejected${NC}"
fi

echo ""
echo ""

# Test 10: Accessing protected route without token
echo "Test 10: Access Protected Route Without Token"
echo "--------------------------------------"
NO_TOKEN_RESPONSE=$(curl -s -X GET "$API_BASE/auth/profile")

echo "$NO_TOKEN_RESPONSE" | jq '.'

if echo "$NO_TOKEN_RESPONSE" | jq -e '.success == false' > /dev/null; then
  echo -e "${GREEN}✓ Unauthorized access correctly rejected${NC}"
else
  echo -e "${RED}✗ Unauthorized access was not properly rejected${NC}"
fi

echo ""
echo ""

echo "======================================"
echo "Testing Complete!"
echo "======================================"
echo ""
echo -e "${YELLOW}Note: The test user account has been created and can be used for manual testing:${NC}"
echo "Email: $TEST_EMAIL"
echo "Password: $TEST_PASSWORD"
