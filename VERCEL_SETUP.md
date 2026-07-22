# IconBuilds Vercel Setup

If signup says `The API did not return JSON (405)`, the browser is not reaching the serverless API handler.

## Test The API

Open this URL on the deployed domain:

```text
https://minestore.org/api/index?action=health
```

Good response:

```json
{"ok":true,"site":"IconBuilds","time":"..."}
```

Bad response:

- `405`
- HTML page
- Vercel error page

If it is bad, check the Vercel project root and redeploy.

## Vercel Project Settings

- Framework Preset: `Other`
- Root Directory: the folder that contains `api/index.js`, `vercel.json`, `index.html`, and `package.json`
- Build Command: leave empty
- Output Directory: leave empty
- Install Command: leave empty or `npm install`

For this local folder, the correct root is:

```text
C:\Users\Kvngc\Downloads\IconBuildss\IconBuilds
```

## Required Env Vars

Set these in Vercel Project Settings, then redeploy:

```text
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_EMAILS=thestickboy@example.com,itzkuroyt@example.com
ALLOWED_ORIGINS=https://minestore.org
```

For email verification:

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=IconBuilds <verify@minestore.org>
```

For GitHub storage on Vercel:

```text
GITHUB_TOKEN=
GITHUB_REPO=owner/repo-name
GITHUB_BRANCH=main
GITHUB_DB_PATH=data/iconbuilds-db.json
GITHUB_DB_BACKUP_PATH=data/iconbuilds-db.backup.json
```

For Google login:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

For paid checkout:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```
