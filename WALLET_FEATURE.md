# EMART Wallet Feature Documentation

## Overview

The EMART Wallet feature allows users to:
- **Deposit money** into their wallet using various payment methods
- **View their balance** and transaction history
- **Pay for orders** using wallet balance
- **Withdraw funds** back to their bank account or PayPal
- **Receive refunds** and promotional bonuses

---

## Features

### 1. **Wallet Balance Management**
- Real-time balance display
- Multi-currency support (default: USD)
- Balance history tracking
- Active/inactive wallet status

### 2. **Deposit Funds**
- Multiple payment methods:
  - Credit Card
  - PayPal
  - Bank Transfer
  - Stripe
- Minimum deposit: $1.00
- Instant balance update
- Transaction receipt

### 3. **Withdraw Funds**
- Withdrawal methods:
  - Bank Transfer
  - PayPal
- Minimum withdrawal: $10.00
- Balance verification
- Processing time: 3-5 business days

### 4. **Transaction History**
- Complete transaction log
- Filter by transaction type:
  - Deposits
  - Withdrawals
  - Payments
  - Refunds
  - Bonuses
  - Adjustments
- Filter by status:
  - Pending
  - Processing
  - Completed
  - Failed
  - Cancelled
- Transaction details include:
  - Amount
  - Balance before/after
  - Payment method
  - Reference number
  - Timestamps

### 5. **Order Payments**
- Pay for orders using wallet balance
- Automatic balance deduction
- Insufficient balance protection
- Order reference linking

### 6. **Refunds**
- Automatic refund processing to wallet
- Refund reason tracking
- Instant balance credit

### 7. **Promotional Bonuses**
- Welcome bonus ($10 credit)
- Referral bonuses
- Seasonal promotions
- Loyalty rewards

---

## Database Schema

### Wallet Table
```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance FLOAT DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Wallet Transaction Table
```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  wallet_id UUID,
  type VARCHAR(20), -- DEPOSIT, WITHDRAWAL, PAYMENT, REFUND, BONUS, ADJUSTMENT
  amount FLOAT,
  balance_before FLOAT,
  balance_after FLOAT,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
  description TEXT,
  reference VARCHAR(255), -- Order number, payment ref, etc.
  payment_method VARCHAR(100),
  payment_details JSONB,
  notes TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Base URL
```
http://localhost:5000/api/v1/wallet
```

### 1. Get Wallet
```http
GET /wallet
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "balance": 373.00,
    "currency": "USD",
    "isActive": true,
    "createdAt": "2026-09-08T10:00:00.000Z",
    "updatedAt": "2026-09-08T10:00:00.000Z"
  },
  "message": "Wallet retrieved successfully"
}
```

### 2. Get Balance
```http
GET /wallet/balance
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": {
    "balance": 373.00,
    "currency": "USD",
    "isActive": true
  },
  "message": "Balance retrieved successfully"
}
```

### 3. Deposit Funds
```http
POST /wallet/deposit
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100.00,
  "paymentMethod": "credit_card",
  "reference": "PAYMENT-REF-123",
  "paymentDetails": {
    "last4": "4242",
    "brand": "Visa"
  }
}

Response (201 Created):
{
  "success": true,
  "data": {
    "transaction": {
      "id": "uuid",
      "type": "DEPOSIT",
      "amount": 100.00,
      "balanceBefore": 373.00,
      "balanceAfter": 473.00,
      "status": "COMPLETED",
      "description": "Deposit via credit_card",
      "createdAt": "2026-09-08T10:00:00.000Z"
    },
    "wallet": {
      "id": "uuid",
      "balance": 473.00
    }
  },
  "message": "Deposit successful"
}
```

### 4. Withdraw Funds
```http
POST /wallet/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50.00,
  "withdrawMethod": "bank_transfer",
  "reference": "ACC-123456"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "transaction": {
      "id": "uuid",
      "type": "WITHDRAWAL",
      "amount": 50.00,
      "balanceBefore": 473.00,
      "balanceAfter": 423.00,
      "status": "COMPLETED",
      "description": "Withdrawal via bank_transfer"
    },
    "wallet": {
      "id": "uuid",
      "balance": 423.00
    }
  },
  "message": "Withdrawal successful"
}
```

### 5. Get Transaction History
```http
GET /wallet/transactions?limit=20&offset=0&type=DEPOSIT&status=COMPLETED
Authorization: Bearer <token>

Query Parameters:
- limit: Number of transactions (default: 20, max: 100)
- offset: Pagination offset (default: 0)
- type: Filter by type (DEPOSIT, WITHDRAWAL, PAYMENT, REFUND, BONUS, ADJUSTMENT)
- status: Filter by status (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)

Response (200 OK):
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "DEPOSIT",
        "amount": 100.00,
        "balanceBefore": 373.00,
        "balanceAfter": 473.00,
        "status": "COMPLETED",
        "description": "Deposit via credit_card",
        "reference": "PAYMENT-REF-123",
        "paymentMethod": "credit_card",
        "createdAt": "2026-09-08T10:00:00.000Z",
        "processedAt": "2026-09-08T10:00:05.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  },
  "message": "Transactions retrieved successfully"
}
```

### 6. Get Single Transaction
```http
GET /wallet/transactions/:id
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "DEPOSIT",
    "amount": 100.00,
    "balanceBefore": 373.00,
    "balanceAfter": 473.00,
    "status": "COMPLETED",
    "description": "Deposit via credit_card",
    "reference": "PAYMENT-REF-123",
    "paymentMethod": "credit_card",
    "createdAt": "2026-09-08T10:00:00.000Z",
    "processedAt": "2026-09-08T10:00:05.000Z"
  },
  "message": "Transaction retrieved successfully"
}
```

---

## Frontend Implementation

### Wallet Page Route
```
/wallet
```

### Key Components

#### 1. Balance Display Card
- Shows current balance
- Currency indicator
- Last updated timestamp
- Quick action buttons (Add Funds, Withdraw)

#### 2. Statistics Cards
- Total Deposited
- Total Spent
- Bonuses Earned

#### 3. Transaction List
- Scrollable transaction history
- Color-coded by transaction type
- Status badges
- Amount with +/- indicators
- Balance after each transaction

#### 4. Deposit Modal
- Amount input
- Payment method selector
- Validation (min $1.00)
- Submit button

#### 5. Withdraw Modal
- Available balance display
- Amount input
- Withdrawal method selector
- Validation (min $10.00, max: current balance)
- Submit button

### Integration in My Orders Page
- "My Wallet" button added to the header
- Quick access from order management
- Prominent placement for easy discovery

---

## User Flow

### Depositing Funds
1. Navigate to "My Wallet" page
2. Click "Add Funds" button
3. Enter deposit amount
4. Select payment method
5. Confirm deposit
6. Payment processing
7. Balance updated instantly
8. Transaction recorded

### Paying for Orders
1. Add items to cart
2. Proceed to checkout
3. Select "Wallet" as payment method
4. Balance verification
5. If sufficient: payment processed
6. If insufficient: prompt to add funds
7. Order placed
8. Transaction recorded

### Withdrawing Funds
1. Navigate to "My Wallet" page
2. Click "Withdraw" button
3. View available balance
4. Enter withdrawal amount
5. Select withdrawal method
6. Confirm withdrawal
7. Processing (3-5 business days)
8. Transaction recorded

---

## Security Features

### Balance Protection
- Concurrent transaction prevention
- Atomic database transactions
- Balance verification before deductions
- Overflow protection

### Transaction Security
- All transactions require authentication
- JWT token validation
- User ID verification
- Amount validation (positive values)
- Method whitelisting

### Audit Trail
- Complete transaction history
- Before/after balance tracking
- Timestamp tracking
- Reference linking
- Status tracking

---

## Validation Rules

### Deposits
- **Amount**: Must be >= $1.00
- **Payment Method**: Must be one of: credit_card, paypal, bank_transfer, stripe, other
- **Reference**: Optional, max 100 characters

### Withdrawals
- **Amount**: Must be >= $10.00 and <= current balance
- **Withdrawal Method**: Must be one of: bank_transfer, paypal, other
- **Reference**: Optional, max 100 characters

### Transactions Query
- **Limit**: Between 1 and 100
- **Offset**: Must be >= 0
- **Type**: Must be valid transaction type
- **Status**: Must be valid transaction status

---

## Error Handling

### Common Errors

| Error | HTTP Status | Description |
|-------|------------|-------------|
| Invalid Amount | 400 | Amount is zero, negative, or invalid format |
| Insufficient Balance | 400 | Withdrawal/payment exceeds available balance |
| Wallet Inactive | 400 | User's wallet is not active |
| Transaction Not Found | 404 | Invalid transaction ID |
| Unauthorized | 401 | Missing or invalid authentication token |
| Validation Error | 400 | Input validation failed |

### Error Response Format
```json
{
  "success": false,
  "message": "Insufficient balance. Available: $50.00, Required: $100.00",
  "errors": []
}
```

---

## Testing

### Manual Testing

1. **Create Account and Check Wallet**
   - Register new account
   - Navigate to /wallet
   - Verify wallet exists with $0 balance

2. **Test Deposit**
   - Click "Add Funds"
   - Enter $100.00
   - Select Credit Card
   - Submit
   - Verify balance updated
   - Check transaction history

3. **Test Withdrawal**
   - Click "Withdraw"
   - Enter $50.00
   - Select Bank Transfer
   - Submit
   - Verify balance reduced
   - Check transaction history

4. **Test Order Payment**
   - Add items to cart
   - Proceed to checkout
   - Select Wallet payment
   - Complete order
   - Verify balance deducted
   - Check transaction history

5. **Test Insufficient Balance**
   - Try to withdraw more than available
   - Verify error message shown
   - Balance unchanged

### API Testing with cURL

```bash
# Get wallet
curl -X GET http://localhost:5000/api/v1/wallet \
  -H "Authorization: Bearer YOUR_TOKEN"

# Deposit funds
curl -X POST http://localhost:5000/api/v1/wallet/deposit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "paymentMethod": "credit_card"}'

# Get transactions
curl -X GET "http://localhost:5000/api/v1/wallet/transactions?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Future Enhancements

### Planned Features
- [ ] Multi-currency support (JPY, EUR, GBP)
- [ ] Automatic currency conversion
- [ ] Recurring deposits (subscription model)
- [ ] Wallet-to-wallet transfers
- [ ] QR code payments
- [ ] Mobile app integration
- [ ] Transaction export (CSV, PDF)
- [ ] Spending analytics dashboard
- [ ] Budget limits and alerts
- [ ] Family/business accounts
- [ ] Cashback rewards program
- [ ] Interest on balance (savings feature)

### Payment Gateway Integration
- Stripe Connect
- PayPal Adaptive Payments
- Bank account verification (Plaid)
- Cryptocurrency support

---

## Files Created/Modified

### Backend
- ✅ `/Backend/prisma/schema.prisma` - Added Wallet and WalletTransaction models
- ✅ `/Backend/src/services/wallet.service.ts` - Wallet business logic
- ✅ `/Backend/src/controllers/wallet.controller.ts` - Wallet endpoints
- ✅ `/Backend/src/routes/wallet.routes.ts` - Wallet routes
- ✅ `/Backend/src/middleware/validations/wallet.validation.ts` - Input validation
- ✅ `/Backend/src/routes/index.ts` - Added wallet routes
- ✅ `/Backend/src/services/auth.service.ts` - Create wallet on registration

### Frontend
- ✅ `/Frontend/src/pages/Wallet.tsx` - Wallet management page
- ✅ `/Frontend/src/App.tsx` - Added wallet route
- ✅ `/Frontend/src/pages/MyOrders.tsx` - Added wallet link

### Documentation
- ✅ `/WALLET_FEATURE.md` - This comprehensive documentation

---

## Quick Start

### Backend Setup
1. Run database migration:
   ```bash
   cd Backend
   npx prisma generate
   npx prisma db push
   ```

2. Start backend server:
   ```bash
   npm run dev
   ```

### Frontend Access
1. Start frontend:
   ```bash
   cd Frontend
   npm run dev
   ```

2. Navigate to wallet:
   - Login to your account
   - Go to "My Orders" page
   - Click "My Wallet" button
   - Or directly visit: `http://localhost:5173/wallet`

---

## Support

For issues or questions:
- Check API documentation above
- Review transaction history for audit trail
- Contact support with transaction reference number

---

**Last Updated**: September 8, 2026  
**Version**: 1.0.0  
**Feature Status**: ✅ Complete and Functional
