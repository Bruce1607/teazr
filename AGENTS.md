# AGENTS.md

## Cursor Cloud specific instructions

**Product:** Teazr — a static vanilla JS web app for DM conversation starters and a flirt quiz. Zero npm dependencies, Cloudflare Pages hosted.

**Key files:**
- `index.html` / `teaze.html` — entry points
- `app.js` — entire SPA logic (~1400 lines, vanilla JS)
- `styles.css` — all styling
- `teaze-messages.js` — curated message dataset (exported as global `TEAZE_MESSAGES`)
- `functions/api/event.js` — Cloudflare Pages Function for analytics (optional, not needed locally)

**Running locally:** Serve the repo root with any static HTTP server (e.g., `python3 -m http.server 8080`). No build step required for dev — the build script (`npm run build`) only copies files to `dist/public` for Cloudflare Pages deployment.

**Tests:** `node test-teaze.js` — validates message dataset (min counts per bucket, banned phrases, anti-repeat algorithm). Some pre-existing test failures exist in sub-buckets and banned-phrase checks; these are not regressions.

**Build:** `npm run build` runs `node scripts/copy-pages-files.mjs`, which copies static assets to `dist/public`. Only needed for deployment, not for local dev.

**No linter configured.** There is no ESLint, Prettier, or other linting tool in this project.

**Analytics API:** The `POST /api/event` endpoint requires Cloudflare Pages Functions runtime (`wrangler pages dev .`). It's optional — the frontend gracefully handles its absence.
