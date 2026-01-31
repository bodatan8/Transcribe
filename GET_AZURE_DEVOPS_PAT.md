# Get Azure DevOps PAT for datan8.com

## Step-by-Step Instructions

### 1. Go to Azure DevOps (NOT Azure Portal)

**Your organization URL:**
- Try: `https://dev.azure.com/datan8`
- Or: `https://datan8.visualstudio.com` (if using older URL format)

### 2. Navigate to Personal Access Tokens

**Option A: Via UI**
1. Click your profile icon (top right corner)
2. Select **"Personal access tokens"**
3. Or go to: `https://dev.azure.com/datan8/_usersSettings/tokens`

**Option B: Direct Link**
- If you're signed in, go directly to:
  ```
  https://dev.azure.com/datan8/_usersSettings/tokens
  ```

### 3. Create New Token

1. Click **"+ New Token"** button
2. Fill in the form:
   - **Name**: `Spratt App` (or any descriptive name)
   - **Organization**: Select `datan8` (should be pre-selected)
   - **Expiration**: Choose a date (recommend 90 days or custom)
   
3. **Select Scopes** (check these):
   - ✅ **Work Items** → **Read & Write** (required for creating work items)
   - ✅ **Code** → **Read & Write** (if you want to push code)
   - ✅ **Build** → **Read & Write** (if you want to trigger builds)
   - ✅ **Release** → **Read & Write** (if you want to manage releases)

4. Click **"Create"**

### 4. Copy the Token

⚠️ **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

The token will look something like:
```
abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### 5. Add to .env File

Paste the token into your `.env` file:

```bash
AZURE_DEVOPS_PAT="your-copied-token-here"
```

### Troubleshooting

**If you can't access Azure DevOps:**
- Make sure you're signed in with a datan8.com account
- Check if your organization uses a custom domain
- Contact your Azure DevOps administrator if you don't have access

**If the organization name is different:**
- Check with your team what the exact Azure DevOps organization name is
- It might be different from your email domain

**Alternative: Check existing tokens**
- If you already have tokens, you can view them at the tokens page
- But you can't see the actual token value - only create new ones

### Verify It Works

After adding the PAT to `.env`, restart your dev server:
```bash
npm run dev
```

The app will use this token to create work items in Azure DevOps when actions are approved.
