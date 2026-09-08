#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:5000/api/v1"
TEST_EMAIL="test$(date +%s)@test.com"
TEST_PASSWORD="TestPass123@"
TOKEN=""

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     EMART Authentication System Comprehensive Test         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        if [ -n "$3" ]; then
            echo -e "  ${YELLOW}Error: $3${NC}"
        fi
    fi
}

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth=$4
    
    if [ -n "$auth" ]; then
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $auth" \
            -d "$data"
    else
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

echo -e "\n${YELLOW}═══ TEST 1: User Registration ═══${NC}"
echo "Testing user registration with: $TEST_EMAIL"

REGISTER_RESPONSE=$(api_call "POST" "/auth/register" "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\"
}")

if echo "$REGISTER_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    print_result 0 "User registration successful"
    echo "  User: $TEST_EMAIL"
    echo "  Token received: ${TOKEN:0:20}..."
else
    print_result 1 "User registration failed" "$REGISTER_RESPONSE"
    exit 1
fi

echo -e "\n${YELLOW}═══ TEST 2: Get User Profile ═══${NC}"
PROFILE_RESPONSE=$(api_call "GET" "/auth/profile" "" "$TOKEN")

if echo "$PROFILE_RESPONSE" | grep -q "$TEST_EMAIL"; then
    print_result 0 "Profile retrieval successful"
    echo "$PROFILE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PROFILE_RESPONSE"
else
    print_result 1 "Profile retrieval failed" "$PROFILE_RESPONSE"
fi

echo -e "\n${YELLOW}═══ TEST 3: Update Profile ═══${NC}"
UPDATE_RESPONSE=$(api_call "PUT" "/auth/profile" "{
    \"firstName\": \"Updated\",
    \"lastName\": \"Name\",
    \"phone\": \"+1234567890\"
}" "$TOKEN")

if echo "$UPDATE_RESPONSE" | grep -q "Updated"; then
    print_result 0 "Profile update successful"
    echo "$UPDATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPDATE_RESPONSE"
else
    print_result 1 "Profile update failed" "$UPDATE_RESPONSE"
fi

echo -e "\n${YELLOW}═══ TEST 4: Logout ═══${NC}"
LOGOUT_RESPONSE=$(api_call "POST" "/auth/logout" "" "$TOKEN")

if echo "$LOGOUT_RESPONSE" | grep -q "success"; then
    print_result 0 "Logout successful"
else
    print_result 1 "Logout failed" "$LOGOUT_RESPONSE"
fi

echo -e "\n${YELLOW}═══ TEST 5: Login with Credentials ═══${NC}"
LOGIN_RESPONSE=$(api_call "POST" "/auth/login" "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
}")

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    print_result 0 "Login successful"
    echo "  New token received: ${NEW_TOKEN:0:20}..."
    TOKEN=$NEW_TOKEN
else
    print_result 1 "Login failed" "$LOGIN_RESPONSE"
fi

echo -e "\n${YELLOW}═══ TEST 6: Token Refresh ═══${NC}"
REFRESH_RESPONSE=$(api_call "POST" "/auth/refresh-token" "" "$TOKEN")

if echo "$REFRESH_RESPONSE" | grep -q "token"; then
    print_result 0 "Token refresh successful"
    REFRESHED_TOKEN=$(echo "$REFRESH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "  Refreshed token: ${REFRESHED_TOKEN:0:20}..."
else
    print_result 1 "Token refresh failed" "$REFRESH_RESPONSE"
fi

echo -e "\n${YELLOW}═══ TEST 7: Change Password ═══${NC}"
NEW_PASSWORD="NewTestPass123@"
CHANGE_PASSWORD_RESPONSE=$(api_call "POST" "/auth/change-password" "{
    \"currentPassword\": \"$TEST_PASSWORD\",
    \"newPassword\": \"$NEW_PASSWORD\",
    \"confirmPassword\": \"$NEW_PASSWORD\"
}" "$TOKEN")

if echo "$CHANGE_PASSWORD_RESPONSE" | grep -q "success"; then
    print_result 0 "Password change successful"
    TEST_PASSWORD=$NEW_PASSWORD
else
    print_result 1 "Password change failed" "$CHANGE_PASSWORD_RESPONSE"
fi

echo -e "\n${YELLOW}═══ TEST 8: Login with New Password ═══${NC}"
LOGIN_NEW_RESPONSE=$(api_call "POST" "/auth/login" "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
}")

if echo "$LOGIN_NEW_RESPONSE" | grep -q "token"; then
    print_result 0 "Login with new password successful"
else
    print_result 1 "Login with new password failed" "$LOGIN_NEW_RESPONSE"
fi

echo -e "\n${YELLOW}═══ TEST 9: Password Validation ═══${NC}"
echo "Testing weak password rejection..."

WEAK_PASSWORD_RESPONSE=$(api_call "POST" "/auth/register" "{
    \"email\": \"weak$(date +%s)@test.com\",
    \"password\": \"weak\"
}")

if echo "$WEAK_PASSWORD_RESPONSE" | grep -q "Password"; then
    print_result 0 "Weak password rejected correctly"
else
    print_result 1 "Weak password validation failed"
fi

echo -e "\n${YELLOW}═══ TEST 10: Duplicate Email Prevention ═══${NC}"
DUPLICATE_RESPONSE=$(api_call "POST" "/auth/register" "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
}")

if echo "$DUPLICATE_RESPONSE" | grep -q "already exists"; then
    print_result 0 "Duplicate email prevented correctly"
else
    print_result 1 "Duplicate email prevention failed"
fi

echo -e "\n${YELLOW}═══ TEST 11: Invalid Login Credentials ═══${NC}"
INVALID_LOGIN_RESPONSE=$(api_call "POST" "/auth/login" "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"WrongPassword123@\"
}")

if echo "$INVALID_LOGIN_RESPONSE" | grep -q "Invalid"; then
    print_result 0 "Invalid credentials rejected correctly"
else
    print_result 1 "Invalid credentials validation failed"
fi

echo -e "\n${YELLOW}═══ TEST 12: Protected Route Without Token ═══${NC}"
NO_TOKEN_RESPONSE=$(api_call "GET" "/auth/profile" "")

if echo "$NO_TOKEN_RESPONSE" | grep -q "token\|auth"; then
    print_result 0 "Protected route secured correctly"
else
    print_result 1 "Protected route not properly secured"
fi

echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Test Summary                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}All core authentication features tested!${NC}"
echo -e "\n${YELLOW}Test completed for user: $TEST_EMAIL${NC}"
echo -e "${YELLOW}Final password: $TEST_PASSWORD${NC}"
echo ""
