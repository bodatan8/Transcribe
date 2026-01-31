# Test Account Setup

## Quick Test Access

A test account feature has been added to the login page for quick demo access.

### Test Account Credentials
- **Email**: `test@spratt.com`
- **Password**: `test123456`

### How It Works

1. **Click "Use Test Account"** button on the login page
2. The app will:
   - Try to sign in with test credentials
   - If account doesn't exist, create it automatically
   - Sign you in immediately

### Making Test Account Admin

After using the test account for the first time, make it admin:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'test@spratt.com';
```

### Features

- ✅ One-click test access
- ✅ Auto-creates account if it doesn't exist
- ✅ No email verification needed for testing
- ✅ Perfect for demos and quick testing

### UI Updates

- Added "Use Test Account" button (outlined style)
- Shows "or" divider between sign in and test account
- Displays test credentials below for reference
- Loading state while setting up account
