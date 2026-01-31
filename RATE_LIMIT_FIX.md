# Rate Limit Error Fix

## Problem
Seeing "rate limit" error when using test account button.

## Root Cause
Supabase has rate limits on authentication operations:
- Too many sign-in attempts
- Too many sign-up attempts
- Rate limits reset after a few minutes

## Solution Applied

### Improved Rate Limit Handling
1. ✅ Added delays between operations (2 seconds)
2. ✅ Better error detection for rate limit messages
3. ✅ Clear user guidance when rate limited
4. ✅ Suggests manual sign-in as alternative
5. ✅ Prevents multiple rapid attempts

### Changes Made
- Added 2-second delay before creating account (if sign-in fails)
- Added 2-second delay before signing in (after account creation)
- Detects rate limit errors in all error messages
- Provides helpful guidance to user
- Shows test credentials clearly for manual sign-in

## How to Avoid Rate Limits

### Option 1: Use Manual Sign-In (Recommended)
Instead of clicking "Use Test Account" button:
1. Enter email: `test@spratt.com`
2. Enter password: `test123456`
3. Click "Sign In"

This avoids the account creation attempt and reduces rate limit issues.

### Option 2: Wait Between Attempts
- Wait 2-3 minutes between test account button clicks
- Rate limits reset automatically

### Option 3: Pre-create Test Account
Run this SQL in Supabase to create the account manually:

```sql
-- This will be created automatically when user signs up
-- But you can also manually insert if needed
-- Note: You'll need to create the auth user first via Supabase dashboard
```

Then just use manual sign-in with the credentials.

## Updated UI

The login page now shows:
- Clear test account credentials
- Note about rate limits
- Suggestion to use manual sign-in if rate limited

## Best Practice

For demos and testing:
1. **Pre-create the test account** before the demo
2. Use **manual sign-in** with the credentials
3. This avoids rate limit issues completely
