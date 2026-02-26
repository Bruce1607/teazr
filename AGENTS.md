# AGENTS.md

## Cursor Cloud specific instructions

**Product:** TEAZR is a zero-dependency, static vanilla JavaScript web app for generating DM message suggestions. No frameworks, no build toolchain beyond a simple file-copy script.

**Key commands (see `README.md` and `package.json`):**
- Tests: `node test-teaze.js` — dataset sanity checks (bucket counts, banned phrases, anti-repeat algorithm)
- Build: `npm run build` — copies static files to `dist/public/` for Cloudflare Pages deployment
- Dev server: `npx serve -l 3000` — serves the app at http://localhost:3000

**Notes:**
- There are no npm dependencies to install (zero `dependencies` and zero `devDependencies` in `package.json`).
- The test suite has pre-existing failures (17 checks fail due to banned phrases like "kindly" in CLOSE_KINDLY buckets and sub-35-count micro-buckets). These are dataset issues, not environment issues.
- The app consists of two pages: `index.html` (landing + quiz) and `teaze.html` (Send a Teaz). Navigation between them uses relative links.
- Analytics POSTs to `/api/event` are fire-and-forget; they log to console on localhost. No backend endpoint is needed.
