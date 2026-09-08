# EMART Authentication System Documentation

## Overview

The EMART platform implements a secure, professional-grade authentication system with JWT (JSON Web Tokens), password hashing, rate limiting, and comprehensive validation.

## Table of Contents

1. [Architecture](#architecture)
2. [Security Features](#security-features)
3. [API Endpoints](#api-endpoints)
4. [Frontend Integration](#frontend-integration)
5. [Password Requirements](#password-requirements)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [Testing](#testing)

---

## Architecture

### Backend Stack
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt (12 rounds)
- **Validation**: express-validator
- **Rate Limiting**: Custom in-memory rate limiter

### Frontend Stack
- **Framework**: React with TypeScript
- **State Management**: React Context API
- **Routing**: React Router
- **HTTP Client**: Fetch API with custom wrapper
- **Token Storage**: localStorage

---

## Security Features

### 1. Password Security
- **Minimum length**: 8 characters
- **Complexity requirements**:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (@$!%*?&)
- **Hashing**: bcrypt with 12 salt rounds
- **Storage**: Only hashed passwords stored in database

### 2. JWT Token Security
- **Expiration**: 7 days (configurable via `.env`)
- **Payload**: User ID, email, and role
- **Secret**: Configurable via `JWT_SECRET` environment variable
- **Transmission**: Bearer token in Authorization header
- **Refresh**: Automatic token refresh every 6 hours

### 3. Rate Limiting
- **Registration**: 5 attempts per 15 minutes per IP+email
- **Login**: 5 attempts per 15 minutes per IP+email
- **API requests**: 60 requests per minute
- **Response**: 429 status code with Retry-After header

### 4. Input Validation
- **Email**: Valid format, normalized, lowercase
- **Names**: 2-50 characters, letters/spaces/hyphens/apostrophes only
- **Phone**: 10-20 characters, numbers and common phone symbols
- **Sanitization**: Automatic XSS protection via express-validator

### 5. Error Messages
- **Secure**: Generic messages for authentication failures
- **User-friendly**: Clear guidance for validation errors
- **Consistent**: Standardized error response format

---

## API Endpoints

### Base URL
```
http://localhost:5000/api/v1/auth
```

### Public Endpoints

#### 1. Register New User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",      // Optional
  "lastName": "Doe"         // Optional
}

Response (201 Created):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "createdAt": "2026-09-08T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Account created successfully! Welcome to EMART."
}
```

#### 2. Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": null,
      "role": "USER",
      "createdAt": "2026-09-08T10:00:00.000Z",
      "updatedAt": "2026-09-08T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Welcome back! Login successful."
}
```

### Protected Endpoints (Require Authorization Header)

#### 3. Get User Profile
```http
GET /auth/profile
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "role": "USER",
    "createdAt": "2026-09-08T10:00:00.000Z",
    "updatedAt": "2026-09-08T10:00:00.000Z"
  },
  "message": "Profile retrieved successfully"
}
```

#### 4. Update Profile
```http
PUT /auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Jane",       // Optional
  "lastName": "Smith",       // Optional
  "phone": "+1234567890"     // Optional
}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "+1234567890",
    "role": "USER",
    "createdAt": "2026-09-08T10:00:00.000Z",
    "updatedAt": "2026-09-08T10:30:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

#### 5. Change Password
```http
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "SecurePass123!",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}

Response (200 OK):
{
  "success": true,
  "data": null,
  "message": "Password changed successfully"
}
```

#### 6. Refresh Token
```http
POST /auth/refresh-token
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Token refreshed successfully"
}
```

#### 7. Logout
```http
POST /auth/logout
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": null,
  "message": "Logged out successfully"
}
```

---

## Frontend Integration

### Authentication Context

The frontend uses React Context API for global authentication state management:

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { 
    user,              // Current user object or null
    token,             // JWT token or null
    isAuthenticated,   // Boolean: true if user is logged in
    isLoading,         // Boolean: true during initialization
    login,             // Function: (email, password) => Promise<void>
    register,          // Function: (data) => Promise<void>
    logout,            // Function: () => void
    updateProfile,     // Function: (data) => Promise<void>
    changePassword,    // Function: (current, new, confirm) => Promise<void>
    refreshToken       // Function: () => Promise<void>
  } = useAuth();

  // Use authentication state and methods
}
```

### Automatic Token Management

- **Storage**: JWT tokens stored in localStorage
- **Restoration**: Automatic session restoration on app load
- **Injection**: Token automatically added to all API requests
- **Refresh**: Token refreshed every 6 hours automatically
- **Expiration**: User logged out if token refresh fails

### Protected Routes Example

```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
```

---

## Password Requirements

### Client-Side Validation (Immediate Feedback)
- Minimum 8 characters
- Contains uppercase letter (A-Z)
- Contains lowercase letter (a-z)
- Contains number (0-9)
- Contains special character (@$!%*?&)

### Server-Side Validation (Enforced)
- All client-side rules enforced
- Password strength regex pattern matching
- New password must differ from current password (on change)
- Confirmation password must match

### Password Strength Indicator
The registration page shows real-time password strength:
- **Weak**: Less than 3 criteria met (Red)
- **Fair**: 3 criteria met (Yellow)
- **Good**: 4 criteria met (Blue)
- **Strong**: All 5 criteria met (Green)

---

## Rate Limiting

### Configuration

| Endpoint | Window | Max Attempts | Error Message |
|----------|--------|--------------|---------------|
| Register | 15 min | 5 | "Too many authentication attempts. Please try again in 15 minutes." |
| Login | 15 min | 5 | "Too many authentication attempts. Please try again in 15 minutes." |
| API calls | 1 min | 60 | "Too many API requests. Please slow down." |

### How It Works

1. **Key Generation**: Rate limit by IP + email combination
2. **Window**: Rolling time window starts on first request
3. **Counter**: Increments with each request
4. **Blocking**: Requests blocked when limit exceeded
5. **Reset**: Counter resets after window expires
6. **Response**: 429 status with Retry-After header

### Customization

Edit `/Backend/src/middleware/rateLimiter.ts` to adjust limits:

```typescript
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // Time window
  max: 5,                     // Max requests
  message: 'Custom message',  // Error message
});
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error message here",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid input or validation error |
| 401 | Unauthorized | Invalid credentials or missing token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | User or resource not found |
| 409 | Conflict | Email already registered |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Frontend Error Display

Errors are displayed using:
1. **Toast Notifications**: For action feedback
2. **Inline Messages**: Below form fields
3. **Alert Boxes**: For critical errors

---

## Testing

### Automated Test Script

Run the comprehensive authentication test suite:

```bash
cd Backend
chmod +x test-auth.sh
./test-auth.sh
```

This tests:
1. ✅ User registration
2. ✅ Profile retrieval
3. ✅ Profile updates
4. ✅ Logout functionality
5. ✅ Login with credentials
6. ✅ Token refresh
7. ✅ Invalid login rejection
8. ✅ Duplicate registration rejection
9. ✅ Weak password rejection
10. ✅ Unauthorized access protection

### Manual Testing

#### Test User Registration (Frontend)
1. Navigate to `http://localhost:5173/register`
2. Fill in registration form
3. Observe password strength indicator
4. Submit form
5. Verify redirect to home page
6. Check user profile in navigation

#### Test Login (Frontend)
1. Navigate to `http://localhost:5173/login`
2. Enter credentials
3. Verify "Remember me" checkbox
4. Submit form
5. Verify redirect and authentication state

#### Test Protected Routes
1. Navigate to `/orders` or `/account`
2. Without login: Should redirect to `/login`
3. With login: Should show protected content

### Testing with cURL

See examples in `test-auth.sh` or use these quick tests:

```bash
# Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@12345"}'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@12345"}'

# Get Profile (replace TOKEN)
curl -X GET http://localhost:5000/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Environment Variables

Required in `/Backend/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/emart"

# JWT Configuration
JWT_SECRET="your-secure-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=5000
NODE_ENV="development"

# CORS
CORS_ORIGIN="http://localhost:5173"
```

Required in `/Frontend/.env`:

```env
# Backend API URL
VITE_API_URL="http://localhost:5000"
```

---

## Best Practices

### Security Recommendations

1. ✅ **Production JWT Secret**: Use strong, random secret in production
2. ✅ **HTTPS Only**: Enable HTTPS in production
3. ✅ **Token Expiration**: Keep token expiration reasonable (7 days)
4. ✅ **Rate Limiting**: Monitor and adjust rate limits based on usage
5. ✅ **Password Policy**: Enforce strong password requirements
6. ✅ **Input Validation**: Always validate on both client and server
7. ✅ **Error Messages**: Use generic messages for security-sensitive errors

### Future Enhancements

- [ ] Email verification on registration
- [ ] Password reset via email
- [ ] Two-factor authentication (2FA)
- [ ] OAuth providers (Google, Facebook, Apple)
- [ ] Token blacklist for logout
- [ ] Session management (view active sessions)
- [ ] Account lockout after failed attempts
- [ ] Security audit logging
- [ ] Redis for distributed rate limiting

---

## Troubleshooting

### Common Issues

**Issue**: Token not being sent with requests
- **Solution**: Check AuthContext is wrapping the app in main.tsx
- **Check**: Browser localStorage contains `emart_token`

**Issue**: CORS errors
- **Solution**: Verify `CORS_ORIGIN` in backend `.env` matches frontend URL
- **Check**: Frontend `VITE_API_URL` is correct

**Issue**: "Unauthorized" on protected routes
- **Solution**: Ensure token is valid and not expired
- **Action**: Try logging out and logging back in

**Issue**: Rate limit errors during testing
- **Solution**: Wait for rate limit window to reset
- **Action**: Restart backend to clear in-memory rate limit store

**Issue**: Password validation errors
- **Solution**: Ensure password meets all requirements:
  - Minimum 8 characters
  - Uppercase, lowercase, number, special character

---

## Support

For issues or questions:
- Check this documentation
- Review test scripts
- Inspect browser console and network tab
- Check backend server logs

---

**Last Updated**: September 8, 2026  
**Version**: 1.0.0  
**Maintained by**: EMART Development Team
