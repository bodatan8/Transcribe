# Automated Test Account Setup

## Quick Setup (Automated)

### Step 1: Add Secret Key to .env

1. Go to Supabase Dashboard → **Settings → API**
2. Find **"Secret key"** (NOT the publishable key)
3. Copy it
4. Add to your `.env` file:

```bash
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
```

**Note:** Supabase now uses "Secret key" instead of "service_role" - they're the same thing.

### Step 2: Run Initial Migration

Run the database schema migration first:

1. Go to Supabase Dashboard → **SQL Editor**
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run

### Step 3: Run Automated Script

```bash
npm run create-test-account
```

That's it! The script will:
- ✅ Create the test user in auth.users
- ✅ Auto-confirm the email
- ✅ Create the profile with admin role
- ✅ Verify everything worked

### Test Account Created

- **Email**: `test@spratt.com`
- **Password**: `test123456`
- **Role**: `admin`

## Manual Alternative

If you prefer manual setup, see `CREATE_TEST_ACCOUNT.md`

## Security Note

The service_role key has full admin access. Keep it secret and never commit it to git!
