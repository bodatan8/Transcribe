# Spratt - Audio Recording & Action Extraction App

Spratt is an audio recording application that automatically extracts actionable items from transcriptions and integrates with Azure DevOps.

## Features

- 🎤 **Audio Recording**: Record audio directly in the browser
- 📝 **Automatic Transcription**: Audio is transcribed automatically
- 🤖 **AI Action Extraction**: Actions are extracted from transcriptions using AI
- ✅ **Action Approval Workflow**: Review and approve/reject extracted actions
- 👥 **Role-Based Access**: Two-tier system (Admin/Adviser) with Row Level Security
- 🔐 **Supabase Authentication**: Secure user authentication and authorization
- 🔗 **Azure DevOps Integration**: MCP server integration for Azure DevOps (coming soon)

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Build Output**: `build/` directory

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `AZURE_DEVOPS_PAT`: Your Azure DevOps Personal Access Token

### 3. Set Up Supabase Database

Run the migration file to create the database schema:

```bash
# Using Supabase CLI (recommended)
supabase db push

# Or manually run the SQL in supabase/migrations/001_initial_schema.sql
```

### 4. Create Supabase Storage Bucket

Create a storage bucket named `recordings` in your Supabase dashboard:
- Go to Storage → Create Bucket
- Name: `recordings`
- Public: Yes (or configure RLS policies)

### 5. Run Development Server

```bash
npm run dev
```

### 6. Build for Production

```bash
npm run build
```

Output will be in the `build/` directory.

## Database Schema

- **profiles**: User profiles with role (admin/adviser)
- **recordings**: Audio recordings with transcription status
- **actions**: Extracted actions from transcriptions
- **shared_records**: Sharing records between users

## Row Level Security (RLS)

- **Admins**: Can view all records
- **Advisers**: Can view only their own records and shared records
- All users can create their own records

## MCP Server Integration

Azure DevOps integration via MCP servers is configured but requires:
1. MCP servers to be running
2. Azure DevOps PAT configured in `.env`
3. MCP server endpoints configured

## Project Structure

```
src/
  components/     # React components
  contexts/       # React contexts (Auth)
  lib/           # Utilities (Supabase client)
  services/      # Business logic (transcription, actions)
```

## Next Steps

- [ ] Implement real transcription API (OpenAI Whisper)
- [ ] Implement real AI action extraction (OpenAI GPT-4)
- [ ] Set up Azure DevOps MCP server integration
- [ ] Add action execution (create work items, send emails, etc.)
- [ ] Add recording playback
- [ ] Add action editing capabilities
