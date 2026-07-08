# Setup Guide

## Step 1 — Supabase

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project (choose a region close to you)
3. Once created, go to **Project Settings → API** and copy:
   - `Project URL` → put in `.env` as `VITE_SUPABASE_URL`
   - `anon public key` → put in `.env` as `VITE_SUPABASE_ANON_KEY`
4. Go to **SQL Editor** and paste the entire contents of `supabase/migration.sql`, run it
5. Go to **Authentication → Settings** and enable email auth
6. Go to **Authentication → Providers → Email** and disable "Confirm email" if you want instant signup (or keep it on for email verification)
7. Go to **Edge Functions** and deploy the matching function:
   - Install Supabase CLI locally: `npm install -g supabase`
   - `supabase login`
   - `supabase functions deploy match-items`

## Step 2 — Cloudinary

1. Go to [cloudinary.com](https://cloudinary.com) and create a free account
2. Copy your **Cloud Name** from the dashboard → put in `.env` as `VITE_CLOUDINARY_CLOUD_NAME`
3. Go to **Settings → Upload** → Enable unsigned uploading → Create an **Upload Preset** (set to "Unsigned") → put in `.env` as `VITE_CLOUDINARY_UPLOAD_PRESET`

## Step 3 — Hugging Face

1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) and create a free access token
2. Put the token in `.env` as `VITE_HF_API_KEY`
3. Also add it to your Supabase Edge Function secrets:
   - `supabase secrets set HF_API_KEY=hf_your-token-here`

## Step 4 — Groq

1. Go to [console.groq.com/keys](https://console.groq.com/keys) and create a free API key
2. Put it in `.env` as `VITE_GROQ_API_KEY`
3. Also add it to Supabase Edge Function secrets:
   - `supabase secrets set GROQ_API_KEY=gsk_your-key-here`

## Step 5 — Environment File

Copy `.env.example` to `.env` and fill in all values:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-upload-preset
VITE_HF_API_KEY=hf_your-huggingface-key
VITE_GROQ_API_KEY=gsk_your-groq-key
```

## Step 6 — Run Locally

```bash
npm run dev
```

## Step 7 — Deploy to Vercel

1. Push the project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add all environment variables (from `.env`) in Vercel project settings
4. Deploy — DONE

## Database Tables Created (automatically via migration.sql)

| Table | Purpose |
|---|---|
| `profiles` | User profiles linked to Supabase Auth |
| `posts` | Lost & found items (with image_vector and text_vector) |
| `likes` | User likes on posts |
| `comments` | User comments on posts |
| `matches` | AI-generated matches between lost & found items |
| `conversations` | DM conversations between two users |
| `messages` | Individual messages in conversations |

## Postman? No need.

The app handles everything through the React frontend. Supabase Row Level Security (RLS) policies protect all data access.
