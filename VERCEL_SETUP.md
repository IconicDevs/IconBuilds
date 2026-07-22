# IconBuilds GitHub Pages + Vercel Setup

`minestore.org` is the static website on GitHub Pages. GitHub Pages cannot run `api/*.js`, so the browser must call the Vercel API endpoint instead of `/api` on `minestore.org`.

This project intentionally uses one Vercel serverless function only:

```text
api/index.js
```

That keeps the deployment under the Vercel Hobby function limit.

## Required Split

- GitHub Pages hosts the HTML, CSS, JS, images, and static pages.
- Vercel hosts the API at `https://icon-builds.vercel.app/api`.
- `config.js` must keep `api.productionBasePath` set to `https://icon-builds.vercel.app/api`.
- Do not test auth with `https://minestore.org/api?action=health`; that is GitHub Pages and should not be the API.

## Test The API

Open this Vercel URL:

```text
https://icon-builds.vercel.app/api?action=health
```

Good response:

```json
{"ok":true,"site":"IconBuilds","time":"..."}
```

If that returns HTML, 404, or 405, the Vercel deployment is not using this project root or `api/index.js` is not deployed.

## Vercel Project Settings

- Framework Preset: `Other`
- Root Directory: the folder containing `api`, `assets`, `index.html`, `package.json`, and `vercel.json`
- Build Command: leave empty
- Output Directory: leave empty
- Install Command: leave empty or `npm install`

## Required Env Vars On Vercel

```text
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_EMAILS=thestickboy@example.com,itzkuroyt@example.com
ALLOWED_ORIGINS=https://minestore.org,https://icon-builds.vercel.app
```

Use the real admin email addresses for `ADMIN_EMAILS`. Usernames alone are not secure enough.

## Email Verification

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=IconBuilds <verify@minestore.org>
```

The `RESEND_FROM_EMAIL` domain must be verified in Resend, or use a sender Resend has already verified.

## Google OAuth

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

In Google Cloud, add this authorized redirect URI exactly:

```text
https://icon-builds.vercel.app/api/google-callback
```

The API will finish Google login on Vercel, then return the session to `https://minestore.org`.

## GitHub Storage Backup

```text
GITHUB_TOKEN=github_pat_...
GITHUB_REPO=owner/repo-name
GITHUB_BRANCH=main
GITHUB_DB_PATH=data/iconbuilds-db.json
GITHUB_DB_BACKUP_PATH=data/iconbuilds-db.backup.json
```

The token should only have contents read/write permission for the repo that stores the backup JSON. Do not put secrets in GitHub Pages, `config.js`, or frontend files.

## Resource Download Links

In the admin panel, paste the file into **Protected download source**.

Supported sources:

```text
https://drive.google.com/uc?export=download&id=FILE_ID
https://drive.google.com/file/d/FILE_ID/view
https://example.com/resource.zip
https://example.com/resource.jar
```

IconBuilds does not expose this source URL in public resource data. A user must log in, verify email, add or purchase the resource, then IconBuilds gives them a short-lived `/api?action=downloadFile` link.

Google Drive files still need link access enabled so Vercel can redirect the buyer to the file. That is easier, but not as private as signed object storage. For stronger protection later, use Cloudflare R2, S3, Supabase Storage, or another provider that supports expiring signed download URLs.

## Optional Payments

```text
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```