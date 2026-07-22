# IconBuilds

Plain HTML, CSS, and JavaScript marketplace for official IconRealms resources.

The frontend is intentionally simple:

- `index.html`
- `styles.css`
- `config.js`
- `script.js`

The backend uses Vercel serverless endpoints in `api/` so secrets stay off the frontend.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Storage

Reads try Vercel KV first. If KV is missing, down, or empty, the API tries the encrypted GitHub backup. If neither is configured, the marketplace returns an empty resource list.

Admin writes save sanitized marketplace data to Vercel KV, then mirror an encrypted backup to GitHub. The backup excludes secret keys, sessions, payment data, and permanent download URLs.

## Main Endpoints

- `GET /api/resources`
- `GET /api/resources?slug=my-resource`
- `POST /api/admin-resources`
- `PUT /api/admin-resources?id=resource-id`
- `DELETE /api/admin-resources?id=resource-id`
- `GET /api/storage-health`
