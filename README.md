# Star Trek Tracker

## Overview

Star Trek Tracker is a Next.js app that tracks Star Trek series and movies, lets users mark progress, rate content, and analyze ratings with charts.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: Tailwind CSS, Radix UI, shadcn/ui components
- **Auth**: next-auth (Credentials provider, JWT sessions)
- **DB**: PostgreSQL accessed via `pg` (node-postgres)
- **Charts**: Recharts

## Prerequisites

- Node.js 18+
- PostgreSQL 13+ reachable (local or remote)
- Python 3 + pip (for data import helper)
- Docker Desktop (optional, for running the app via docker-compose)

## Environment Variables

Create `star-trek/.env.local` (used by Next.js) with at least:

```env
DATABASE_URL=postgresql://USER:PASS@HOST:5432/startrekdb
NEXTAUTH_SECRET=your-long-random-string
# Optional: gate self-signup after the first admin
INVITE_SECRET=your-invite-code
```

Notes:
- The app reads `DATABASE_URL` and `NEXTAUTH_SECRET`. Registration uses `INVITE_SECRET` after the first user is created.
- If you run via `docker compose`, also provide a root-level `.env` with the same vars so the container gets them.

## Local Development

From `star-trek/`:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Running with Docker

From the repo root (uses `star-trek/Dockerfile`):

```bash
docker compose up -d
```

Ensure your root `.env` provides `DATABASE_URL`, `NEXTAUTH_SECRET`, and (optionally) `INVITE_SECRET` for the container.

## Database Setup

This project uses plain SQL via `pg` (no Prisma). The first data import will auto-create tables if they are missing. You can point `DATABASE_URL` to any Postgres instance you manage.

If you don’t have Postgres locally, a quick disposable container:

```bash
docker run --name startrekdb -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=startrekdb -p 5432:5432 -d postgres:13
```

Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/startrekdb` accordingly.

## Importing IMDb Data

The importer fetches metadata and images using CinemagoerNG (Python) and loads data into Postgres via SQL upserts.

- From `star-trek/`:

```bash
node scripts/import-imdb-data.js import
```

What it does:
- Installs/updates `cinemagoerng` via `pip` if needed
- Generates JSON in `star-trek/scripts/data/`
- Upserts shows, seasons, episodes, and movies
- Downloads artwork to `star-trek/public/images/`

### Updating for New Content

Re-run the same import command to pull new seasons/episodes or additional titles configured in the script.

### Adding New Titles

Update the `tv_series` or `movies` maps in `star-trek/scripts/import-imdb-data.js` and re-run the import.

## Authentication

- Credentials login backed by the `users` table
- First registered user becomes admin and is auto-approved
- Subsequent registrations require `INVITE_SECRET`

## Backup and Restore (manual)

Use standard Postgres tools:

```bash
# backup
pg_dump "${DATABASE_URL}" > backup.sql

# restore (creates/overwrites objects in target DB)
psql "${DATABASE_URL}" -f backup.sql
```

Alternatively, run these inside a `postgres` Docker container if you don’t have client tools installed.

## Troubleshooting

- **DB connection errors**: verify `DATABASE_URL` and that Postgres is reachable on the host/port.
- **Auth issues**: ensure `NEXTAUTH_SECRET` is set. In production, also set `NEXTAUTH_URL` to your site URL.
- **Import failures**: verify Python 3 + `pip` are installed; check console output for missing system libs.
