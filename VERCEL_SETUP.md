# IconBuilds Vercel Setup

The live domain is currently serving from GitHub Pages. GitHub Pages cannot run `api/*.js`, so signup will fail until `minestore.org` points to the Vercel deployment.

## Test The API

Open:

```text
https://minestore.org/api/health
```

Good response:

```json
{"ok":true,"site":"IconBuilds","time":"..."}
```

If you see a 404 page, 405 page, or any HTML, the site is not being served by Vercel functions.

## Vercel Project Settings

- Framework Preset: `Other`
- Root Directory: the folder containing `api`, `assets`, `index.html`, `package.json`, and `vercel.json`
- Build Command: leave empty
- Output Directory: leave empty
- Install Command: leave empty or `npm install`

## DNS

In Vercel, add `minestore.org` to the IconBuilds project. Then point the apex/root domain to Vercel.

Use Vercel's shown DNS records. The usual apex record is:

```text
Type: A
Name: @
Value: 76.76.21.21
```

Remove GitHub Pages apex records while doing this. GitHub Pages commonly uses these IPs:

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

## Required Env Vars

```text
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_EMAILS=thestickboy@example.com,itzkuroyt@example.com
ALLOWED_ORIGINS=https://minestore.org,https://icon-builds.vercel.app
```

## Email Verification

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=IconBuilds <verify@minestore.org>
```

## GitHub Storage

```text
GITHUB_TOKEN=
GITHUB_REPO=owner/repo-name
GITHUB_BRANCH=main
GITHUB_DB_PATH=data/iconbuilds-db.json
GITHUB_DB_BACKUP_PATH=data/iconbuilds-db.backup.json
```

## Optional

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```
