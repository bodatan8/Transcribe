# Demo Accounts for Testing

## Quick Start

To test the app, you'll need to create an account:

1. **Sign Up**: Click "Don't have an account? Sign up" on the login page
2. **Enter Details**:
   - Full Name: Your name
   - Email: Your email address
   - Password: Choose a secure password (min 6 characters)
3. **Sign In**: After signup, you'll be automatically signed in

## Making Yourself Admin

After signing up, run this SQL in Supabase SQL Editor:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

## Test Flow

1. **Sign Up/Login** → Create account or sign in
2. **Record Audio** → Click the large record button
3. **Speak Action Items** → Try phrases like:
   - "Call Steve Smith tomorrow"
   - "Email the client at client@example.com"
   - "Schedule a meeting with the team next week"
4. **Stop Recording** → Click stop, wait for processing
5. **View Actions** → Actions will appear automatically
6. **Approve Actions** → Review and approve/reject actions

## UI/UX Improvements Made

✅ Removed redundant "Welcome to Spratt" text (logo speaks for itself)
✅ Cleaned up colors to match Spratt brand exactly (#00407A blue, #666666 grey)
✅ Simplified design - removed glassmorphism, using clean white cards
✅ Better form styling with proper borders and focus states
✅ Added helpful text for sign-in guidance
✅ Professional, corporate look matching insurance broker brand
