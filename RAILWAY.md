# Deploy on Railway (simplest path)

Railway hosts the app **and** keeps your SQLite database on a persistent disk volume. No Turso account needed.

## Overview

1. Put this project on GitHub  
2. Create a Railway project from that repo  
3. Attach a volume at `/data`  
4. Set a few environment variables  
5. Deploy  

---

## 1. GitHub

You need a free [GitHub](https://github.com) account and a new empty repository (e.g. `mafia-invitees`).

Then in this project folder, commit and push (never commit `.env`).

---

## 2. Railway project

1. Go to [railway.app](https://railway.app) and sign up (GitHub login is easiest)  
2. **New Project** → **Deploy from GitHub repo** → pick this repo  
3. Railway will detect Next.js and start a deploy (it may fail until env + volume are set — that’s OK)

---

## 3. Add a volume (database disk)

1. Click your service  
2. **Settings** → **Volumes** → **Add Volume**  
3. Mount path: `/data`  
4. Save  

Your database file will live at `/data/mafia.db` on Railway’s servers — not on your laptop.

---

## 4. Environment variables

In the service → **Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `file:/data/mafia.db` |
| `APP_PASSWORD` | your shared login password |
| `SESSION_SECRET` | run `openssl rand -hex 32` locally and paste the result |

---

## 5. Build & start settings

Under **Settings** → **Build** / **Deploy**:

- **Build command:** `npm run build`  
- **Start command:** `npx prisma migrate deploy && npm start`  

The start command creates/updates tables on boot, then starts the site.

Generate a public URL: **Settings** → **Networking** → **Generate domain**.

---

## 6. Load your people (first time)

A fresh volume starts empty. Either:

**A. Re-seed from CSVs** (if you still have import files), or  

**B. Copy your local DB up once** using the [Railway CLI](https://docs.railway.com/guides/cli):

```bash
# After linking the project
railway run bash -c 'echo ok'   # sanity check
# Upload is typically done by dumping/importing; ask for help with this step
```

Or from your Mac, after the site is up, we can walk through importing AddressBook again against the Railway DB.

---

## Local vs Railway

| | Your Mac | Railway |
|---|---|---|
| App | `npm run dev` | Always on at your `.up.railway.app` URL |
| Database | Local file (e.g. `~/.local/share/mafia-invitees/mafia.db`) | `/data/mafia.db` on Railway’s volume |

Edits on the live site do **not** change your laptop DB (and vice versa), unless you copy data on purpose.

---

## Troubleshooting

- **Deploy crash / no DATABASE_URL:** Add the volume and variables, then redeploy  
- **Login works, no people:** Schema is there but data isn’t — seed or import  
- **Build fails on better-sqlite3:** Share the build log and we’ll fix native deps  
