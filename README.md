# Star Trek Tracker

## Database

This project uses Postgres (via Docker) and Prisma as the ORM. Follow these steps to create, populate, maintain, and back up the database.

### 1) Start Postgres (Docker)
- Ensure Docker Desktop is running.
- From the repo root:
```bash
docker compose up -d star-trek-db
```
- Connection defaults (see `docker-compose.yml`):
  - Host: localhost
  - Port: 5432
  - DB: startrekdb
  - User: postgres
  - Password: postgres

### 2) Configure environment
Create a `star-trek/.env` file with the Prisma connection string:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/startrekdb?schema=public
```

### 3) Generate Prisma client and apply schema
From the `star-trek/` directory:
```bash
# install deps (first time)
npm install
# generate Prisma client
npx prisma generate
# apply migrations (create schema)
npx prisma migrate dev -n init
```
Alternatively, use package scripts:
```bash
npm run db:deploy   # for applying existing migrations in non-dev
npm run db:migrate  # for dev workflow (prompts for migration name)
```

### 4) Populate database from IMDb
We fetch metadata and images using a Python helper (CinemagoerNG) orchestrated by a Node script that upserts into Postgres.

- Prerequisites:
  - Python 3 available on PATH
  - `pip` available on PATH

- Run the import (from `star-trek/`):
```bash
node scripts/import-imdb-data.js import
```
What it does:
- Ensures `cinemagoerng` is installed via `pip`.
- Runs `scripts/imdb_fetch.py` to create JSON files in `star-trek/scripts/data/`.
- Upserts shows, seasons, episodes, and movies into Postgres (safe to re-run; it updates existing and adds new records).

### 5) Adding new shows or movies (future releases)
Edit `star-trek/scripts/imdb_fetch.py` to include new items:
- TV Series: update the `tv_series` dict (IMDB ID and `order`).
- Movies: update the `movies` dict (IMDB ID and `order`).

Example snippet (inside `import_star_trek_data()`):
```python
# Add a new series
"Star Trek: New Frontier": {"imdb_id": "tt1234567", "order": 27},

# Add a new movie
"Star Trek: Prime Directive": {"imdb_id": "tt2345678", "order": 28},
```
Then re-run the import:
```bash
node scripts/import-imdb-data.js import
```

Notes:
- The import is idempotent. It uses Prisma upserts on title/season/episode to update or create records.
- Artwork is downloaded into `star-trek/public/images/` and paths are saved in the DB.

### 6) Updating existing shows when new episodes air
No code changes required. Re-run the import to pull in new seasons/episodes that have appeared on IMDb:
```bash
node scripts/import-imdb-data.js import
```
This will upsert seasons and episodes under existing shows.

### 7) Browse the database (Prisma Studio)
- With Docker DB running and `.env` set, from `star-trek/` run:
```bash
npx prisma studio
```
Or use the dockerized studio service (optional):
```bash
docker compose up -d prisma-studio
# then open http://localhost:5555
```

### 8) Backup and restore
Backup (creates `star-trek/backups/backup-<timestamp>.sql`):
```bash
cd star-trek
node scripts/backup-database.js
```
- The script keeps the last 5 backups.
- It uses environment vars if provided: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT`.

Restore (manual command using `pg_restore`):
```bash
# pick the backup file from star-trek/backups
PGPASSWORD=postgres pg_restore \
  -h localhost -p 5432 -U postgres \
  -d startrekdb -c -v \
  path/to/backup-<timestamp>.sql
```
If `pg_restore` is not available on PATH, install PostgreSQL client tools or use a Postgres docker container, e.g.:
```bash
docker run --rm -e PGPASSWORD=postgres \
  -v "$(pwd)/star-trek/backups:/backups" \
  --network host postgres:13 \
  pg_restore -h localhost -p 5432 -U postgres -d startrekdb -c -v /backups/backup-<timestamp>.sql
```

### 9) Troubleshooting
- Cannot connect: ensure `docker compose ps` shows `star-trek-db` healthy and that port 5432 is free.
- Prisma errors: check `DATABASE_URL` in `star-trek/.env` and re-run `npx prisma generate`.
- Import errors: ensure Python 3 + `pip` are available and try again. Check console for missing system dependencies.
