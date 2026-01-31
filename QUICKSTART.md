# Spratt Quick Start

## 🚀 Get Started in 5 Minutes

### 1. Install & Configure

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Supabase credentials
# VITE_SUPABASE_URL="https://your-project.supabase.co"
# VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### 2. Set Up Database

**Quick Setup (Supabase Dashboard):**

1. Go to SQL Editor in Supabase Dashboard
2. Copy & paste contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL

**Create Storage Bucket:**

1. Go to Storage → Create Bucket
2. Name: `recordings`
3. Public: Yes

### 3. Make Yourself Admin

After signing up, run this in SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### 4. Run the App

```bash
npm run dev
```

Visit `http://localhost:5173`

### 5. Test It Out

1. **Sign Up** - Create your account
2. **Record** - Click "Start Recording" and say: "Call Steve Smith tomorrow"
3. **Stop** - Click "Stop Recording" 
4. **Review** - Actions will appear in the Actions section
5. **Approve** - Click "Approve" on actions

## 📋 What's Included

✅ React + Vite + Tailwind CSS  
✅ Supabase Auth & Database  
✅ Audio Recording (Browser MediaRecorder API)  
✅ Transcription Pipeline (Mock - ready for OpenAI Whisper)  
✅ AI Action Extraction (Mock - ready for GPT-4)  
✅ Action Approval Workflow  
✅ Role-Based Access (Admin/Adviser)  
✅ Row Level Security (RLS)  
✅ Azure DevOps Integration (Ready for MCP)  

## 🔧 Next Steps

- [ ] Add real transcription (OpenAI Whisper API)
- [ ] Add real AI extraction (OpenAI GPT-4)
- [ ] Configure Azure DevOps MCP servers
- [ ] Add action editing
- [ ] Add recording playback

## 📚 Documentation

- `README.md` - Full project documentation
- `SETUP.md` - Detailed setup instructions
- `supabase/migrations/001_initial_schema.sql` - Database schema
