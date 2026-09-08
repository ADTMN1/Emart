# Authentication Testing Guide

## Quick Test Scenarios

### Test 1: Regular Login
1. Open http://localhost:5173
2. Click "Sign In" in navbar
3. Enter credentials and login
4. **Expected**: Immediately see your user avatar and name in navbar (no "Sign In" button)
5. **Check console**: Should see `[Auth] Login successful` and `[Navbar] Auth state: {isAuthenticated: true}`

### Test 2: Page Refresh After Login
1. After logging in, refresh the page (F5 or Ctrl+R)
2. **Expected**: Brief loading skeleton in navbar, then your user info appears
3. **Expected**: NO flash of "Sign In" button
4. **Check console**: Should see `[Auth] Initializing auth` and `[Auth] User profile loaded`

### Test 3: Google OAuth Login
1. Open http://localhost:5173/login
2. Click "Continue with Google" button
3. Complete Google sign-in
4. **Expected**: Redirected back to homepage with user info in navbar
5. **Check console**: Should see `[Auth] Setting auth data` logs

### Test 4: Logout
1. Click on your user avatar in navbar
2. Click "Sign Out"
3. **Expected**: Navbar shows "Sign In" button immediately
4. **Check localStorage**: `emart_token` should be removed

### Test 5: Protected Routes (if implemented)
1. Logout if logged in
2. Try to access /account or /orders directly
3. **Expected**: Redirected to login page
4. After login, redirected back to the original page

## Browser Console Debugging

### Open Console
- Chrome/Edge: F12 → Console tab
- Firefox: F12 → Console tab
- Safari: Cmd+Option+C

### What to Look For

#### Successful Login
```
[Auth] Login successful: {user: {...}, hasToken: true}
[Navbar] Auth state: {isLoading: false, isAuthenticated: true, hasUser: true}
```

#### Successful Session Restore
```
[Auth] Initializing auth, token exists: true
[Auth] User profile loaded: {id: "...", email: "..."}
[Navbar] Auth state: {isLoading: false, isAuthenticated: true, hasUser: true}
```

#### Successful OAuth Callback
```
[Auth] Setting auth data: {user: {...}, hasToken: true}
[Navbar] Auth state: {isLoading: false, isAuthenticated: true, hasUser: true}
```

#### Failed Authentication
```
[Auth] Session restoration failed: Error: ...
[Navbar] Auth state: {isLoading: false, isAuthenticated: false, hasUser: false}
```

## Common Issues & Solutions

### Issue: "Sign In" button still shows after login

**Diagnosis:**
1. Open browser console
2. Check for errors
3. Type: `localStorage.getItem('emart_token')`
4. Type: `JSON.parse(localStorage.getItem('emart_token'))`

**Possible Causes:**
- Token not being stored (check console for errors)
- AuthContext not updating (check React DevTools)
- API `/auth/profile` failing (check Network tab)

**Solution:**
- Check network tab for failed API calls
- Verify backend is running on port 5000
- Clear localStorage and try again: `localStorage.clear()`

### Issue: Loading skeleton never disappears

**Diagnosis:**
1. Open Network tab in DevTools
2. Look for `/auth/profile` request
3. Check if it's pending/failed

**Possible Causes:**
- Backend not running
- Token is invalid/expired
- CORS error

**Solution:**
- Restart backend server
- Clear localStorage: `localStorage.removeItem('emart_token')`
- Check backend logs

### Issue: OAuth callback shows error

**Diagnosis:**
1. Check URL for `?token=` parameter
2. Open console for error messages
3. Check network tab for `/auth/profile` request

**Possible Causes:**
- Backend not redirecting with token
- Token is malformed
- Profile endpoint failing

**Solution:**
- Verify backend OAuth callback is working: `curl http://localhost:5000/api/v1/auth/google`
- Check backend logs for OAuth errors
- Verify Google OAuth credentials in backend `.env`

### Issue: Flash of "Sign In" button on page load

**Diagnosis:**
1. Check if `isLoading` state is being used in Navbar
2. Look at console logs for auth initialization timing

**Possible Causes:**
- Navbar not checking `isLoading` state
- Auth initialization taking too long

**Solution:**
- Verify Navbar has loading skeleton code
- Check if `/auth/profile` API is slow (look at Network tab timing)

## Manual Testing Checklist

### Authentication Flow
- [ ] Login with email/password works
- [ ] Register new account works
- [ ] Google OAuth login works
- [ ] Logout works
- [ ] Remember me checkbox works (if implemented)

### UI State Management
- [ ] Navbar shows loading skeleton on initial load
- [ ] Navbar shows user info immediately after login
- [ ] No flash of "Sign In" for logged-in users
- [ ] User dropdown menu works
- [ ] Profile data displays correctly in dropdown

### Session Persistence
- [ ] Page refresh preserves login
- [ ] Opening new tab preserves login
- [ ] Login persists after browser restart (if remember me)
- [ ] Token auto-refreshes (wait 6+ hours)

### Error Handling
- [ ] Invalid credentials show error message
- [ ] Network error shows friendly message
- [ ] Expired token triggers logout
- [ ] Failed OAuth shows error and redirects

### Navigation
- [ ] Login redirects to home page
- [ ] OAuth callback redirects to home page
- [ ] Logout stays on current page (or redirects)
- [ ] Protected routes redirect to login

## React DevTools Inspection

1. Install React DevTools browser extension
2. Open DevTools → React tab
3. Find `AuthProvider` component
4. Inspect state:
   - `user`: should be object or null
   - `token`: should be string or null
   - `isLoading`: should be false after init
   - `isAuthenticated`: should match login state

## Network Tab Analysis

### Successful Login
```
POST /api/v1/auth/login
Status: 200
Response: {
  "success": true,
  "data": {
    "user": {...},
    "token": "eyJ..."
  }
}
```

### Successful Profile Load
```
GET /api/v1/auth/profile
Status: 200
Headers: Authorization: Bearer eyJ...
Response: {
  "success": true,
  "data": {
    "id": "...",
    "email": "...",
    ...
  }
}
```

### Failed Authentication
```
GET /api/v1/auth/profile
Status: 401
Response: {
  "success": false,
  "error": "Unauthorized"
}
```

## Performance Testing

1. Open DevTools → Lighthouse
2. Run audit on homepage
3. Check for:
   - Auth initialization blocking render
   - Large token payload
   - Excessive re-renders

## Security Testing

1. **Token Storage**: Check localStorage (should be `emart_token`)
2. **Token Format**: Should be JWT (three base64 sections separated by dots)
3. **Token in Requests**: Check Network tab → Headers → Authorization: Bearer
4. **Logout Cleanup**: Verify token removed from localStorage
5. **Expired Token**: Manually expire token and verify logout

## Automated Testing (Optional)

If you want to add E2E tests:

```javascript
// Example Playwright test
test('user can login and see navbar', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // Should redirect to home
  await page.waitForURL('http://localhost:5173/');
  
  // Should see user in navbar
  await expect(page.locator('[aria-label="user-avatar"]')).toBeVisible();
  await expect(page.locator('text=Sign In')).not.toBeVisible();
});
```

## Reporting Issues

When reporting authentication bugs, include:
1. Browser console output (especially `[Auth]` and `[Navbar]` logs)
2. Network tab screenshot showing API requests
3. Steps to reproduce
4. Expected vs actual behavior
5. Browser and OS version
6. localStorage content: `localStorage.getItem('emart_token')`
