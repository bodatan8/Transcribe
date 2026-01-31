# Rate Limit Solution

## Problem
Seeing "email rate limit exceeded" (429 errors) when trying to create test account.

## Root Cause
Supabase has rate limits on:
- Email sending (for verification emails)
- Authentication operations
- These reset automatically after a few minutes

## Solution Applied

### Improved Detection
- ✅ Now detects "email rate limit exceeded" specifically
- ✅ Increased wait time to 3 minutes (180 seconds) for email rate limits
- ✅ Better error messages showing what type of rate limit

### Countdown Timer
- Shows countdown: "Wait 3:00 before retry"
- Button disabled during countdown
- Auto-enables when timer reaches 0

### Best Solution: Use Manual Sign-In

**Instead of clicking "Use Test Account":**

1. Enter email: `test@spratt.com`
2. Enter password: `test123456`
3. Click "Sign In"

This avoids:
- Account creation attempts
- Email sending
- Rate limit issues

### If You Must Use Test Account Button

1. **Wait 3-5 minutes** after rate limit error
2. The countdown timer will show remaining time
3. Button will re-enable automatically when ready

### Pre-Create Account (Best for Demos)

Before your demo, create the test account once:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" or "Invite User"
3. Email: `test@spratt.com`
4. Password: `test123456`
5. Auto-confirm email (check the box)

Then always use manual sign-in during the demo - no rate limits!

## Updated Wait Times

- **Email Rate Limit**: 3 minutes (180 seconds)
- **General Rate Limit**: 3 minutes (180 seconds)
- Timer shows countdown automatically

## Status

✅ Rate limit detection improved
✅ Countdown timer working
✅ Better error messages
✅ Manual sign-in recommended
