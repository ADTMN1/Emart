# EMART Admin Dashboard - Access Guide

## ✅ Professional Auto-Redirect Implemented

The admin dashboard now features **professional automatic role-based redirection**. No manual links needed!

---

## How It Works

### 1. **For Admin Users**
When you sign in with admin credentials:
- ✅ Login is processed
- ✅ System checks your role
- ✅ **Automatically redirects to `/admin` dashboard**
- ✅ Shows success message: "Admin Login Successful - Redirecting to admin dashboard..."

### 2. **For Regular Customers**
When regular users sign in:
- ✅ Login is processed
- ✅ System checks role
- ✅ **Automatically redirects to `/` (homepage)**
- ✅ Shows success message: "Signed in successfully - Welcome back to EMART!"

---

## Admin Login Credentials

```
Email: admin@emart.com
Password: Admin@123456
```

---

## Access Methods

### Method 1: Standard Login (Recommended)
1. Go to: `http://localhost:5174/login`
2. Enter admin credentials
3. Click "Sign In"
4. **Automatically redirected to `/admin` dashboard** ✨

### Method 2: OAuth Login
1. Click "Google" sign-in button
2. Complete Google OAuth
3. **Automatically redirected based on your role**

### Method 3: Direct URL (If Already Logged In)
1. Simply navigate to: `http://localhost:5174/admin`
2. If you're an admin → Access granted
3. If you're not an admin → Automatically redirected to homepage

---

## Security Features

✅ **Role-based access control**
- Non-admin users are redirected away from `/admin/*` routes
- Admin routes protected by `AdminLayout` component
- Backend API endpoints require `ADMIN` role

✅ **Automatic role detection**
- Role checked immediately after login
- No manual navigation required
- Seamless user experience

✅ **Session persistence**
- Admin sessions maintained across page refreshes
- Token-based authentication
- Secure logout available in admin sidebar

---

## Admin Dashboard Features

Once redirected to `/admin`, you'll have access to:

1. **Dashboard** - Statistics and overview
2. **Products** - CRUD operations with image upload
3. **Categories** - Category management
4. **Orders** - Order management and status updates
5. **Warehouse** - Package tracking
6. **Shipping** - Shipment management
7. **Customers** - User account overview
8. **Settings** - Configuration (coming soon)

---

## Troubleshooting

### Issue: "Not redirecting to admin dashboard"
**Solution:**
1. Make sure you're using the correct admin credentials
2. Check browser console for errors
3. Ensure backend is running: `http://localhost:5000`
4. Verify database has admin user with `ADMIN` role

### Issue: "Access denied to admin routes"
**Solution:**
1. Your account doesn't have `ADMIN` role
2. Check database: User role should be `ADMIN` not `CUSTOMER`
3. Try logging out and logging in again

### Issue: "Redirect loop"
**Solution:**
1. Clear browser cache and localStorage
2. Log out completely
3. Log in again with admin credentials

---

## For Developers

### Implementation Details

**Login.tsx:**
- After successful login, fetches user profile
- Checks `userData.role === 'ADMIN'`
- Redirects to `/admin` for admins, `/` for customers

**AuthCallback.tsx:**
- Handles OAuth redirect
- Fetches user profile with token
- Auto-redirects based on role

**AdminLayout.tsx:**
- Checks user role on mount
- Redirects non-admins to homepage
- Renders admin interface only for admins

---

## Summary

✅ **No manual links required**
✅ **Professional automatic redirection**
✅ **Role-based intelligent routing**
✅ **Secure admin-only access**
✅ **Seamless user experience**

**Just sign in with admin credentials and you're automatically taken to the admin dashboard!** 🚀
