# Apex01 — Study Planner & Focus Rooms

Apex01 is your all-in-one study command center: a smart planner with to-do lists, a
**graphic Pomodoro timer**, **live video focus rooms** (powered by open-source
[Jitsi Meet](https://jitsi.org/)), a **global leaderboard** based on hours spent studying
in rooms, and a **secure email authentication** system.

![Apex01](src/app/icon.svg)

## Features

| Feature | Description |
| --- | --- |
| Planner & to-dos | Prioritized tasks, notes and due dates, filtered by state |
| Graphic Pomodoro | Animated SVG ring timer with focus / short / long break cycles, session counter, completion chime |
| Focus rooms | Real-time video study rooms via Jitsi Meet (open source, self-hostable) |
| Room creation | One-click room creation with shareable invite links and unique codes |
| Leaderboard | Ranked by total minutes in focus rooms, updates live as you study |
| Email auth | Password-based auth using bcrypt hashing + signed HTTP-only session cookies (JWT via `jose`) |

Everything is branded **Apex01**.

## Getting started locally

### 1. Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database. The easiest free option is [Neon](https://neon.tech) —
  create a project and copy the connection string (add `?sslmode=require` if suggested).

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
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Random string used to sign session cookies — `openssl rand -base64 32` |
| `NEXT_PUBLIC_JITSI_DOMAIN` | ⬜ | Jitsi Meet server, default `meet.jit.si` |
| `NEXT_PUBLIC_APP_URL` | ⬜ | Public URL of the app (branding / links) |

## Deploying to Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
   Vercel automatically detects Next.js.
3. In **Settings → Environment Variables**, add:
   - `DATABASE_URL` — your Neon (or equivalent) connection string
   - `AUTH_SECRET` — a long random string
   - (optional) `NEXT_PUBLIC_JITSI_DOMAIN`
4. From your local machine, push the schema to the production database once:

   ```bash
   npm run db:push
   ```

5. Deploy. The build runs `prisma generate` automatically (via `postinstall`), so your
   Vercel build always has a fresh Prisma client.

## About the video rooms (Jitsi)

Focus rooms embed Jitsi Meet, the open-source WebRTC conferencing platform.

- **Default:** the public `meet.jit.si` domain works out of the box in most cases.
- **Self-host (recommended for production):** run your own Jitsi Meet instance and point
  `NEXT_PUBLIC_JITSI_DOMAIN` at it. This removes third-party dependencies and lets you
  brand the conference UI. See the
  [Jitsi self-host guide](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-start).
- Users can always fall back to opening the room in a new tab if embedding is blocked.

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
- **jose** signed JWT sessions + **bcryptjs** password hashing
- **Jitsi Meet** iframe API for video rooms
- Deploys cleanly to Vercel

## Project structure

```
prisma/schema.prisma          # Database models (User, Todo, Meeting, MeetingMember, StudyDay)
src/lib/                      # db, auth (sessions), password hashing, validation, queries
src/app/api/                  # Route handlers for auth, todos, meetings, leaderboard, stats
src/app/                      # Landing, (auth) pages, (app) dashboard with sidebar
src/components/               # Pomodoro timer, todo list, meeting room, leaderboard, branding
```