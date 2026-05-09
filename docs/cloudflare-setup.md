# BayanTrack Cloudflare Setup

This project is now prepared for Cloudflare Pages deployment.

Current architecture:

- React/Vite frontend: deploys well to Cloudflare Pages.
- Express + Mongoose backend: should stay on a Node host for now.
- MongoDB database: keep on MongoDB Atlas unless you want a larger D1 migration.
- Cloudflare Pages Function proxy: `/api/*` forwards to your Node API through `API_ORIGIN`.

## Option A: Cloudflare Pages Hosting

This is the recommended always-online setup for the frontend. Cloudflare hosts the built React app, and your backend runs on a Node-capable host.

Use this when you want the site to stay online even when your personal PC is turned off.

## Option B: Your PC As The Server Through Cloudflare Tunnel

This is the setup you used before. It is still possible.

In this setup:

- Your PC runs the BayanTrack app.
- `cloudflared` opens an outbound tunnel from your PC to Cloudflare.
- Users open a Cloudflare URL/domain.
- Cloudflare forwards traffic back to the app running on your PC.

Important limitation: if your PC is shut down, asleep, disconnected from the internet, or the app/tunnel window is closed, the website will be unreachable. Cloudflare is only forwarding traffic; it is not hosting the backend in this mode.

This project already has `run-online.bat` for this mode.

Quick temporary URL:

```bat
run-online.bat
```

Production local server through a temporary Cloudflare URL:

```bat
run-online.bat prod
```

The script:

1. Starts the app locally.
2. Waits until the app responds.
3. Starts `cloudflared tunnel --url`.
4. Prints a temporary `https://*.trycloudflare.com` URL in the tunnel window.

Keep both windows open while using the site.

### Permanent Domain With The Same PC Server

If you want a stable URL like `bayantrack.your-domain.com`, create a named Cloudflare Tunnel instead of a temporary `trycloudflare.com` tunnel.

Easiest setup:

```bat
setup-cloudflare-tunnel.bat
```

That script logs in to Cloudflare, creates the named tunnel, creates the DNS route, and writes a local `.cloudflared/config.yml`.

After setup, run the permanent tunnel with:

```bat
run-permanent-tunnel.bat
```

Manual equivalent:

One-time setup:

```bash
cloudflared tunnel login
cloudflared tunnel create bayan-track
cloudflared tunnel route dns bayan-track bayantrack.your-domain.com
```

Then create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: bayan-track
credentials-file: C:\Users\YOUR_WINDOWS_USER\.cloudflared\YOUR_TUNNEL_ID.json

ingress:
  - hostname: bayantrack.your-domain.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Manual run production app:

```bat
run-online.bat prod
```

In another terminal, run:

```bash
cloudflared tunnel --config .cloudflared/config.yml run
```

For better availability, install `cloudflared` as a Windows service so the tunnel starts when Windows boots. The app itself still needs to start too, so use `run-permanent-tunnel.bat` or Windows Task Scheduler for the Node app.

## Why Not Put The Current Backend Directly On Cloudflare?

The backend is an Express server that uses Mongoose models. Cloudflare Pages/Workers run on the Workers runtime and expect Fetch-style handlers. Cloudflare can run Pages Functions and Workers, and D1 is Cloudflare's SQLite database, but this app is not currently written for D1 or Worker-native request handling.

Fastest production path:

1. Deploy frontend to Cloudflare Pages.
2. Deploy the existing Express API to a Node host such as Render, Railway, Fly.io, a VPS, or another Node-capable service.
3. Use MongoDB Atlas for the database.
4. Set `API_ORIGIN` in Cloudflare Pages so `/api/*` proxies to the backend.

Cloudflare-native path:

1. Rewrite the API routes as Pages Functions or Workers.
2. Convert Mongoose schemas and queries to D1 SQL tables/queries or another Worker-compatible storage design.
3. Migrate existing MongoDB documents into the new schema.

## Files Added

- `wrangler.toml` - Cloudflare Pages project config.
- `public/_redirects` - SPA fallback so routes like `/login` work on refresh.
- `public/_routes.json` - only `/api/*` invokes the Pages Function.
- `functions/api/[[path]].js` - proxies Cloudflare `/api/*` requests to your backend.
- `.env.example` - safe list of required variables.

## Requirements

- Cloudflare account.
- Wrangler login or Cloudflare API token.
- Backend URL for the Express API, for example `https://api.your-domain.com`.
- MongoDB Atlas connection string.
- Mail credentials or Resend API key for OTP emails.
- Strong `JWT_SECRET`.

## One-Time Cloudflare Login

```bash
pnpm run cloudflare:login
pnpm run cloudflare:whoami
```

This machine is not authenticated yet. Deployment will fail until login is complete.

## Create The Pages Project

```bash
pnpm exec wrangler pages project create bayan-track --production-branch main
```

If your production branch is not `main`, replace it with your actual branch name.

## Configure Cloudflare Variables

For Cloudflare Pages, set this variable:

```bash
pnpm exec wrangler pages secret put API_ORIGIN --project-name=bayan-track
```

Value example:

```text
https://api.your-domain.com
```

If you skip the proxy and want the browser to call the API directly, set this as a Cloudflare Pages build variable instead:

```text
VITE_API_BASE_URL=https://api.your-domain.com
```

Using the proxy is simpler because the frontend can keep same-origin `/api/*` calls.

## Deploy Frontend To Cloudflare Pages

```bash
pnpm run deploy:cloudflare
```

The script builds `dist/spa` and deploys it to the `bayan-track` Pages project.

## Backend Environment Variables

Set these on your Node backend host, not in the frontend:

```text
MONGO_URI=...
JWT_SECRET=...
CORS_ORIGIN=https://bayan-track.pages.dev,https://your-domain.com
MAIL_SERVICE=...
MAIL_USER=...
MAIL_PASS=...
NOTIFICATION_EMAIL=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
```

Also change the bootstrap admin/superadmin values before production:

```text
BOOTSTRAP_ADMIN_PASSWORD=...
BOOTSTRAP_SUPERADMIN_PASSWORD=...
```

## Database Notes

Recommended now: MongoDB Atlas.

Cloudflare D1 is possible, but it is a database migration project, not a config change. The current Mongoose models, `ObjectId` references, nested arrays, and query/update patterns would need SQL schema design and route rewrites.

Cloudflare Hyperdrive can accelerate Postgres/MySQL. It does not currently support MongoDB.

## Important Security Cleanup Before Push

Your local `.env` is currently tracked by git. Before pushing to GitHub or deploying from a repo, remove it from git history/index and rotate exposed secrets:

```bash
git rm --cached .env
git commit -m "Stop tracking local env secrets"
```

If the repository has already been pushed publicly, rotate `MONGO_URI`, `JWT_SECRET`, mail app passwords, and any admin passwords.
