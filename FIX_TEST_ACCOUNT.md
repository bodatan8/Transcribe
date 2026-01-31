# Fixing Test Account Login Issue

## Problem
"Invalid login" error when using test account button.

## Root Cause
Supabase requires email confirmation by default. When a test account is created, the user needs to verify their email before they can sign in.

## Solution Applied

### Improved Error Handling
- Better error messages showing what went wrong
- Checks if account already exists
- Handles email confirmation requirement
- More informative feedback to user

### Options to Fix

**Option 1: Disable Email Confirmation (Recommended for Testing)**

In Supabase Dashboard:
1. Go to Authentication → Settings
2. Find "Enable email confirmations"
3. **Disable** it (turn off)
4. Save changes

This allows immediate sign-in after account creation.

**Option 2: Auto-confirm Test Account**

After creating test account, run this SQL in Supabase:

```sql
-- Confirm the test account email
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'test@spratt.com';
```

**Option 3: Use Manual Sign In**

If email confirmation is enabled:
1. Click "Use Test Account" button
2. Check email inbox for confirmation link
3. Click confirmation link
4. Then sign in manually with:
   - Email: test@spratt.com
   - Password: test123456

## Updated Code

The test account handler now:
- ✅ Tries to sign in first (if account exists)
- ✅ Creates account if it doesn't exist
- ✅ Provides clear error messages
- ✅ Handles email confirmation errors
- ✅ Shows helpful messages to user

## Testing

After disabling email confirmation in Supabase:
1. Click "Use Test Account"
2. Should sign in immediately
3. No email verification needed
