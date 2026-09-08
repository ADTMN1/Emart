# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for the EMART application.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter project name: "EMART" (or your preferred name)
5. Click "Create"

## Step 2: Enable Google+ API

1. In your project, go to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click on it and press "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Click "Create"
4. Fill in the required information:
   - **App name**: EMART
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. On the Scopes page, click "Add or Remove Scopes"
7. Add these scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
8. Click "Save and Continue"
9. Add test users (optional for development)
10. Click "Save and Continue"

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click "Create Credentials" > "OAuth client ID"
3. Select **Application type**: Web application
4. Enter **Name**: EMART Web Client
5. Add **Authorized JavaScript origins**:
   - `http://localhost:5173` (for development)
   - Add your production domain when deploying
6. Add **Authorized redirect URIs**:
   - `http://localhost:5000/api/v1/auth/google/callback` (for development)
   - Add your production API domain when deploying
7. Click "Create"
8. Copy the **Client ID** and **Client Secret**

## Step 5: Update Environment Variables

### Backend (.env)

Update `/Backend/.env` with your Google OAuth credentials:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/auth/google/callback
```

### Frontend (optional)

If you need to configure the API URL for the frontend, create or update `/Frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

## Step 6: Restart the Backend Server

After updating the environment variables, restart your backend server:

```bash
cd Backend
npm run dev
```

## Testing Google OAuth

1. Go to http://localhost:5173/login or http://localhost:5173/register
2. Click the "Google" button
3. You'll be redirected to Google's consent screen
4. Sign in with your Google account
5. Grant the requested permissions
6. You'll be redirected back to the application and automatically logged in

## Troubleshooting

### Error: redirect_uri_mismatch

This means the redirect URI in your Google Cloud Console doesn't match the one your app is using.

**Solution:**
1. Check the exact redirect URI in the error message
2. Add that exact URI to your Google Cloud Console OAuth credentials
3. Make sure there are no trailing slashes or differences in protocol (http vs https)

### Error: access_denied

The user denied the permission request or your app isn't authorized.

**Solution:**
1. Make sure your app is not in restricted mode
2. Add test users in the OAuth consent screen if your app is still in testing mode
3. Try again and grant all requested permissions

### Error: Invalid credentials

Your client ID or client secret is incorrect.

**Solution:**
1. Double-check the credentials in your `.env` file
2. Make sure there are no extra spaces or quotes
3. Regenerate the credentials if necessary

## Production Deployment

When deploying to production:

1. Update the OAuth consent screen with your production information
2. Verify your domain in Google Cloud Console
3. Add production URLs to:
   - Authorized JavaScript origins
   - Authorized redirect URIs
4. Update your `.env` files with production values
5. Publish your OAuth consent screen (if required)

## Security Best Practices

1. **Never commit** your `.env` file to version control
2. Keep your client secret secure and private
3. Use HTTPS in production
4. Regularly rotate your credentials
5. Monitor OAuth usage in Google Cloud Console
6. Set up proper CORS policies

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
