# Deploying Sunwoven

This app runs with **no Replit dependency**. Login is local email/password;
Stripe and file uploads are optional and off by default, so it boots with just
a Postgres database. There are two supported ways to deploy — pick one:

- **[Vercel](#deploy-to-vercel)** — the whole app as one Vercel project (static
  client + the API as a serverless function). Uses `vercel.json` + `api/`.
- **[Fly.io](#deploy-to-flyio)** — the whole app as one always-on container.
  Uses `Dockerfile` + `fly.toml`.

Both need the **same one thing from you: a Postgres database** (e.g.
[Neon](https://neon.tech), free tier). Nobody can create that for you — your
accounts and data live in it.

---

## Deploy to Vercel

1. **Create a Postgres database** — [Neon](https://neon.tech) → new project →
   copy the connection string. Use the **pooled** connection string (Neon shows
   a "Pooled connection" toggle) — serverless functions open many short
   connections.

2. **Create the schema** (once, from your machine):
   ```bash
   export DATABASE_URL="postgresql://…"   # your Neon pooled URL
   npm install
   npm run db:push
   ```

3. **Import the repo into Vercel**: [vercel.com/new](https://vercel.com/new) →
   import `akhines/sunwoven` → pick the branch
   (`claude/copywork-generator-pdf-review-5qwjv0`). Vercel reads `vercel.json`
   automatically (build command, output dir, and the `/api` function) — leave
   the detected settings as-is.

4. **Add Environment Variables** (Project → Settings → Environment Variables):
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | your Neon **pooled** connection string |
   | `SESSION_SECRET` | a random string — run `openssl rand -hex 32` |

   (`NODE_ENV=production` is set by Vercel automatically.)

5. **Deploy.** When it finishes, open the URL, click **Parent Login → Create
   one**, and register. You're in.

> After the first deploy, pushes to that branch auto-deploy. If the API
> function build ever fails on a specific package, send me the build log and
> I'll adjust.

---

## Deploy to Fly.io

This app runs as a single container — the Express server serves both the API
(`/api/*`) and the built React client.

## What you need
- A **Postgres database** reachable from the internet (e.g. [Neon](https://neon.tech) — free tier is fine).
- A **[Fly.io](https://fly.io) account** and the `flyctl` CLI (`brew install flyctl`).

## One-time setup

1. **Create the database** (Neon → new project → copy the connection string).

2. **Create the schema.** From this repo, with the DB URL exported, push the
   Drizzle schema (creates the `users`, `sessions`, and all app tables,
   including the new `password_hash` column):
   ```bash
   export DATABASE_URL="postgresql://…"      # your Neon URL
   npm install
   npm run db:push
   ```

3. **Launch the Fly app** (don't deploy yet — we set secrets first):
   ```bash
   fly launch --no-deploy      # accept the existing fly.toml; pick an app name
   ```
   If you choose a different app name, update `app = "…"` in `fly.toml`.

4. **Set secrets:**
   ```bash
   fly secrets set \
     DATABASE_URL="postgresql://…" \
     SESSION_SECRET="$(openssl rand -hex 32)" \
     PUBLIC_URL="https://<your-app-name>.fly.dev"
   ```

5. **Deploy:**
   ```bash
   fly deploy --remote-only
   ```

6. Open `https://<your-app-name>.fly.dev`, click **Parent Login → Create one**,
   and register your account. You're in.

## Optional, later
- **Stripe** (subscriptions): set `ENABLE_STRIPE=true` plus your Stripe keys and
  wire `server/stripeClient.ts` to read `STRIPE_SECRET_KEY` instead of the
  Replit connector.
- **File uploads** (portfolio photos / QR uploads): point object storage at a
  GCS or S3 bucket and set `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR`.
- **AI helper**: set `OPENAI_API_KEY`.

## Environment variables
| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | yes | Postgres connection string |
| `SESSION_SECRET` | strongly recommended | random 32+ byte string; has an insecure dev fallback |
| `PUBLIC_URL` | recommended | e.g. `https://sunwoven.fly.dev` |
| `NODE_ENV` | set by Docker | `production` |
| `PORT` | set by Docker | `5000` |
| `ENABLE_STRIPE` | no | `true` to turn on Stripe (off by default) |
| `OPENAI_API_KEY` | no | enables the AI curriculum/study helper |
