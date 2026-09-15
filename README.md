# Apex01 — Study Planner & Focus Rooms

Apex01 is your all-in-one study command center: a smart planner with to-do lists, a
**graphic Pomodoro timer**, **live video focus rooms** (powered by open-source
[MiroTalk P2P](https://github.com/miroslavpejic85/mirotalk)), a **global leaderboard**
based on hours spent studying in rooms, and **Supabase Auth** for secure email / OTP / Google
authentication.

![Apex01](src/app/icon.svg)

## Features

| Feature | Description |
| --- | --- |
| Planner & to-dos | Prioritized tasks, notes and due dates, filtered by state |
| Graphic Pomodoro | Animated SVG ring timer with focus / short / long break cycles, session counter, completion chime |
| Focus rooms | Real-time P2P video study rooms via a MiroTalk P2P server (no third-party account needed to join) |
| Room creation | One-click room creation with shareable invite links and unique codes (max 5 concurrent rooms) |
| Admin controls | The admin account can delete any room and wipe all meetings |
| Leaderboard | Ranked by total minutes in focus rooms, updates live as you study |
| Auth | Supabase Auth: email + password, email OTP (sign-in and signup verification), password reset email, Google OAuth |

Everything is branded **Apex01**.

## Getting started locally

### 1. Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database for app data. The easiest free option is [Neon](https://neon.tech) —
  create a project and copy the connection string (add `?sslmode=require` if suggested).
- A [Supabase](https://supabase.com) project for authentication.

### 2. Install & configure

```bash
npm install                     # also runs `prisma generate`
cp .env.example .env            # then fill in the values below
npm run db:push                 # creates the tables in your database
npm run dev                     # start http://localhost:3000
```

### 3. Environment variables (`.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Neon, Vercel Postgres, etc.) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Project URL, e.g. `https://abcdef.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key (safe to expose in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service_role key (server-side only, never exposed) |
| `NEXT_PUBLIC_MIROTALK_DOMAIN` | ✅ | MiroTalk P2P server domain, e.g. `p2p-latest-ajnb.onrender.com`. If unset, video is disabled as a safety fallback |
| `NEXT_PUBLIC_APP_URL` | ⬜ | Public URL of the app (branding / links) |

### 4. Supabase setup (one-time)

1. Keep **Authentication → Providers → Email** enabled with *Confirm email* switched ON —
   the app uses the emailed 6-digit code to activate accounts.
2. (Optional) Enable the **Google** provider and paste your Google OAuth **Client ID / Secret**
   from the Google Cloud Console (Authorized redirect URI:
   `https://<your-project>.supabase.co/auth/v1/callback`).
3. In **Authentication → URL Configuration**, set the Site URL to your app and add redirect
   allow-list entries for `http://localhost:3000/**` and your production domain `/**` (Supabase
   requires this before email links / Google return to your callback).
4. Create your admin account: either sign up in the app, or create one with the service role
   (set `email_confirmed_at`). Then mark that user `isAdmin = true` in the `User` table — the
   admin row can be linked to its Supabase auth UUID via the `supabaseId` column.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
   Vercel automatically detects Next.js.
3. In **Settings → Environment Variables**, add all variables from the table above.
   Remember to add `SUPABASE_SERVICE_ROLE_KEY` too — it is required by server-side code.
4. From your local machine, push the schema to the production database once:

   ```bash
   npm run db:push
   ```

5. Deploy (or click **Redeploy** after changing env vars so `NEXT_PUBLIC_*` values are
   re-inlined at build time). The build runs `prisma generate` automatically (via
   `postinstall`), so your Vercel build always has a fresh Prisma client.

## About the video rooms (MiroTalk)

Focus rooms embed MiroTalk P2P, a secure open-source WebRTC conferencing platform that
runs entirely in the browser.

- Point `NEXT_PUBLIC_MIROTALK_DOMAIN` at your MiroTalk P2P server (self-host or a hosted
  instance, e.g. on Render).
- Limitations: a free Render instance may need a cold start to wake up; the room UI shows a
  retry prompt and a "Open in new tab" escape hatch.
- A global cap of **5 concurrent rooms** is enforced; the admin can delete any room.

## How focus time is tracked

When a member joins a room, the client sends a heartbeat to
`/api/meetings/[code]/heartbeat` every minute. The server credits only healthy,
continuous heartbeats (capped per chunk), then updates:

- the room member's `minutes`,
- the user's `totalMinutes` (this drives the leaderboard),
- a per-day bucket used by the dashboard's weekly chart.

Leaving a room simply stops the heartbeats, so time stops accruing.

## Tech stack

- **Next.js 16** (App Router, React Server Components, Turbopack)
- **Tailwind CSS v4** for the Apex01 dark theme
- **Prisma 7** ORM + **PostgreSQL** (via `@prisma/adapter-pg`)
- **Supabase Auth** (`@supabase/ssr` + `@supabase/supabase-js`) for sessions, email OTP,
  password reset and Google OAuth
- **MiroTalk P2P** iframe API for video rooms
- Deploys cleanly to Vercel

## Project structure

```
prisma/schema.prisma          # Database models (User, Todo, Meeting, MeetingMember, StudyDay)
src/lib/                      # db, auth (Supabase integration), validation, queries
src/lib/supabase/             # Supabase client factories (browser, SSR, admin/service-role)
src/proxy.ts                  # Next.js middleware: refresh Supabase tokens on requests
src/app/api/                  # Route handlers for auth, todos, meetings, leaderboard, stats
src/app/auth/callback/        # OAuth / email-link code exchange
src/app/                      # Landing, (auth) pages, (app) dashboard with sidebar
src/components/               # Pomodoro timer, todo list, meeting room, leaderboard, branding
```