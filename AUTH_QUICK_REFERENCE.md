# EMART Authentication - Quick Reference

## 🚀 Quick Start

### Backend (.env):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/emart"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=5000
CORS_ORIGIN="http://localhost:5173"
```

### Frontend (.env):
```env
VITE_API_URL="http://localhost:5000"
```

### Start Services:
```bash
# Terminal 1 - Backend
cd Backend && npm run dev

# Terminal 2 - Frontend
cd Frontend && npm run dev
```

---

## 📡 API Endpoints

### Public (No Auth Required)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/auth/register` | `{ email, password, firstName?, lastName? }` | `{ user, token }` |
| POST | `/auth/login` | `{ email, password }` | `{ user, token }` |

### Protected (Requires Bearer Token)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/auth/profile` | - | `{ user }` |
| PUT | `/auth/profile` | `{ firstName?, lastName?, phone? }` | `{ user }` |
| POST | `/auth/change-password` | `{ currentPassword, newPassword, confirmPassword }` | `{ success }` |
| POST | `/auth/refresh-token` | - | `{ token }` |
| POST | `/auth/logout` | - | `{ success }` |

---

## 🔐 Password Requirements

✅ Minimum 8 characters  
✅ At least one uppercase letter (A-Z)  
✅ At least one lowercase letter (a-z)  
✅ At least one number (0-9)  
✅ At least one special character (@$!%*?&)

**Example**: `SecurePass123!`

---

## 🎯 Frontend Usage

### Using Auth Context:
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  // Login
  await login('user@example.com', 'SecurePass123!');

  // Register
  await register({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe'
  });

  // Logout
  logout();
}
```

### Protected Routes:
```typescript
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
}
```

---

## 🛡️ Rate Limits

| Endpoint | Window | Max Attempts |
|----------|--------|--------------|
| Register | 15 min | 5 |
| Login | 15 min | 5 |
| API calls | 1 min | 60 |

**Response**: `429 Too Many Requests` with `Retry-After` header

---

## 🧪 Testing

### Run Test Script:
```bash
cd Backend
./test-auth.sh
```

### cURL Examples:

**Register:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@12345"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@12345"}'
```

**Get Profile:**
```bash
curl -X GET http://localhost:5000/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚠️ Common Issues

### CORS Error
**Fix**: Check `CORS_ORIGIN` in Backend `.env` matches frontend URL

### Unauthorized Error
**Fix**: Verify token is valid, not expired. Try logout and login again.

### Rate Limit Error
**Fix**: Wait for window to reset or restart backend server

### Password Validation Error
**Fix**: Ensure password meets all requirements (8+ chars, A-z, 0-9, @$!%*?&)

---

## 📝 Response Format

### Success:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

### Error:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

---

## 🔑 Status Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 200 | Success | Operation completed |
| 201 | Created | Registration successful |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Invalid credentials/token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | User not found |
| 409 | Conflict | Email already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

---

## 📚 Full Documentation

See `/Backend/AUTHENTICATION.md` for complete documentation including:
- Architecture details
- Security features
- Frontend integration guide
- Testing instructions
- Troubleshooting
- Best practices

---

**Last Updated**: September 8, 2026  
**Quick Reference Version**: 1.0.0
