# Mafia Invitees

Password-protected guest desk that replaces the Google Sheet for ranking, categorizing, and tracking Mafia night invitees.

## Features

- **Los Angeles Players** ranked roster with drag-and-drop order (auto-saves)
- Create additional custom lists from **+ New list**
- **Vegas Players** and **Archived** lists
- **Vegas Players** and **Archived** tabs
- Category checklist + filter
- Plus-ones field (sheet column C)
- Shared password login (name captured for edit attribution)

## Greenvelope

Greenvelope does not expose a public RSVP API (CSV/Excel export only). RSVP tracking can be rebuilt later.

## Setup

> **Important:** Do not store the SQLite database inside Google Drive. File-locking breaks SQLite. Point `DATABASE_URL` at a normal local path (see `.env.example`).

```bash
cp .env.example .env
# set APP_PASSWORD, SESSION_SECRET, and an absolute DATABASE_URL off Google Drive

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default local password (if you kept the sample `.env`): `mafia-invitees` — change before sharing.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local server |
| `npm run db:seed` | Re-import CSVs from `data/import/` |
| `npm run build` / `npm start` | Production |

## Deploy

**Simplest for beginners:** [Railway](./RAILWAY.md) — one host, SQLite on a disk volume, no Turso.

**Netlify alternative:** [DEPLOY.md](./DEPLOY.md) — needs Turso for the database.

Set in production:

- `DATABASE_URL` (Railway: `file:/data/mafia.db`)
- `APP_PASSWORD`
- `SESSION_SECRET`
