# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

TEAZR is a zero-dependency static SPA (vanilla HTML/CSS/JS) for crafting better DMs. No build tools, no frameworks, no backend. See `README.md` for dataset structure and tone rules.

### Running locally

Serve files with any static HTTP server from the repo root:

```bash
npx serve . -l 3000
```

The app is then available at `http://localhost:3000`. Analytics events log to the browser console on localhost (no server needed).

### Tests

```bash
node test-teaze.js
```

Validates message datasets: min counts per bucket, banned phrase checks, anti-repeat algorithm. Some existing data content failures are present in the repo (banned phrases in CLOSE_KINDLY buckets and sub-35 counts in situation-specific buckets).

### Build

```bash
npm run build
```

Copies static files to `dist/public/` for Cloudflare Pages deployment.

### Key files

- `app.js` — all application logic (quiz, teaz, routing, analytics)
- `teaze-messages.js` — message dataset
- `test-teaze.js` — sanity tests
- `styles.css` — all styles
- `index.html` / `teaze.html` — entry points
