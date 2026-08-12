# Deploy to Netlify

This app needs a **persistent database**. Netlify’s serverless functions can’t keep a local SQLite file, so production uses **[Turso](https://turso.tech)** (hosted SQLite). Local dev can keep using your file DB.

## 1. Create a Turso database

```bash
# Install CLI: https://docs.turso.tech/cli/installation
brew install tursodatabase/tap/turso   # macOS
turso auth login
turso db create mafia-invitees
turso db show mafia-invitees --url
turso db tokens create mafia-invitees
```

Save the URL (`libsql://…`) and token.

## 2. Apply schema + copy data

Apply each migration to Turso (order matters):

```bash
DB=mafia-invitees
for f in prisma/migrations/*/migration.sql; do
  echo "Applying $f"
  turso db shell "$DB" < "$f"
done
```

Copy your local data (optional but recommended):

```bash
# Dump local DB (use your real DATABASE_URL path)
sqlite3 "$HOME/.local/share/mafia-invitees/mafia.db" .dump > /tmp/mafia-dump.sql

# Import (skip sqlite_sequence noise if Turso complains)
turso db shell mafia-invitees < /tmp/mafia-dump.sql
```

If the dump fights Turso, skip it and run `npm run db:seed` against Turso by temporarily setting `TURSO_*` in `.env` (or re-import AddressBook with `db:reconcile-addressbook`).

## 3. Put the project on GitHub

This repo isn’t pushed yet. From the project folder:

```bash
git add .
git status   # confirm .env is NOT listed
git commit -m "Ready for Netlify deploy"
# create a GitHub repo, then:
git remote add origin git@github.com:YOUR_USER/gv-schedule.git
git push -u origin main
```

Never commit `.env`.

## 4. Create the Netlify site

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect GitHub and select this repo
3. Build settings (usually auto-detected):
   - **Build command:** `npm run build`
   - **Publish directory:** leave default / let Next.js runtime handle it
   - **Node version:** `22` (set in `netlify.toml`)

## 5. Environment variables (Netlify UI → Site configuration → Environment variables)

| Variable | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://…` from Turso |
| `TURSO_AUTH_TOKEN` | Turso token |
| `APP_PASSWORD` | Shared team login password |
| `SESSION_SECRET` | Long random string (e.g. `openssl rand -hex 32`) |

You do **not** need `DATABASE_URL` on Netlify if Turso vars are set.

## 6. Deploy

Trigger a deploy (first import deploys automatically). Open the Netlify URL and log in with `APP_PASSWORD`.

## Local vs production

| | Local | Netlify |
|---|---|---|
| DB | `DATABASE_URL=file:…` | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` |
| App | `npm run dev` | Netlify build |

## Troubleshooting

- **Build fails on `better-sqlite3`:** Netlify still installs it for local adapter code; the Linux build image usually compiles it. If it fails, say so and we can make the sqlite adapter a local-only optional dependency.
- **Empty site / login works but no people:** Schema applied but data wasn’t imported — re-run the dump/import or seed against Turso.
- **Prisma “unknown argument”:** Redeploy after `prisma generate` (already in `npm run build` / `postinstall`).
