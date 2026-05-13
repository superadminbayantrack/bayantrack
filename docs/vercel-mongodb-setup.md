# Vercel + MongoDB Atlas Setup

This project can run the React/Vite frontend and Express API on Vercel. The API is exposed through Vercel serverless functions in `api/`, and the app reads MongoDB from `MONGODB_URI` first, then falls back to the older local name `MONGO_URI`.

Official references:

- MongoDB Atlas Vercel integration: https://www.mongodb.com/docs/atlas/reference/partner-integrations/vercel/
- Vercel environment variables: https://vercel.com/docs/environment-variables

## 1. Create Or Confirm MongoDB Atlas Access

In MongoDB Atlas:

1. Open your cluster.
2. Go to **Connect** -> **Drivers**.
3. Copy the `mongodb+srv://...` connection string.
4. Replace `<password>` with the database user's password.
5. Include the database name, for example:

```text
mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/bayantrack?retryWrites=true&w=majority&appName=BayanTrack
```

For the current Atlas cluster, use the `bayantrack` database name. If Atlas gives you a URI like this:

```text
mongodb+srv://USER:PASSWORD@bayantrack.qc3gvju.mongodb.net/?appName=BayanTrack
```

change it to include `/bayantrack` before the query string:

```text
mongodb+srv://USER:PASSWORD@bayantrack.qc3gvju.mongodb.net/bayantrack?retryWrites=true&w=majority&appName=BayanTrack
```

Also confirm:

- The database user exists and has read/write access.
- Atlas **Network Access** allows Vercel to connect. For Vercel serverless functions, Atlas usually needs `0.0.0.0/0` unless you use a more restricted networking setup.

## 2. Add Vercel Environment Variables

In Vercel:

1. Open the project.
2. Go to **Settings** -> **Environment Variables**.
3. Add these for Production, Preview, and Development as needed:

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/bayantrack?retryWrites=true&w=majority&appName=BayanTrack
MONGODB_DB_NAME=bayantrack
JWT_SECRET=use-a-long-random-secret
CORS_ORIGIN=https://your-vercel-domain.vercel.app,https://your-custom-domain.com
```

Do not commit the real MongoDB password to git. Store it only in Vercel Environment Variables and local untracked env files.

Optional but recommended before going public:

```text
BOOTSTRAP_ADMIN_USERNAME=
BOOTSTRAP_ADMIN_PASSWORD=
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_CONTACT=
BOOTSTRAP_SUPERADMIN_USERNAME=
BOOTSTRAP_SUPERADMIN_PASSWORD=
BOOTSTRAP_SUPERADMIN_EMAIL=
BOOTSTRAP_SUPERADMIN_CONTACT=
```

Mail variables are only needed if OTP and notifications should send real email:

```text
MAIL_SERVICE=gmail
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
NOTIFICATION_EMAIL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Leave `VITE_API_BASE_URL` blank on Vercel so the frontend calls same-origin `/api/...`.

## 3. Deploy

The repo already includes `vercel.json`:

- `buildCommand`: `pnpm build:client`
- `outputDirectory`: `dist/spa`
- API functions: `api/index.ts` and `api/[...path].ts`
- SPA fallback: all non-file routes return `index.html`

After adding or changing environment variables, redeploy from the Vercel dashboard.

## 4. Quick Verification

After deployment, test:

```text
https://your-vercel-domain.vercel.app/api/ping
```

Then test a database-backed endpoint:

```text
https://your-vercel-domain.vercel.app/api/announcements
```

If `/api/ping` works but database endpoints fail, recheck `MONGODB_URI`, the Atlas database user, and Atlas Network Access.
