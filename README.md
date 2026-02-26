# Teazr

BETTER DMs — LESS OVERTHINKING. Pick a moment. Copy a line. Paste in DM.

## Send a Teaz — datasets

**Location:** `teaze-messages.js`

**Structure:**
- Two categories: `GENERAL` (any DM context) and `FLIRTY` (playful flirt)
- Buckets: `{MOMENT}:{STYLE}` e.g. `START:PLAYFUL`, `KEEP_GOING:CLASSY`
- BOUNDARY (GENERAL only): `BOUNDARY:unwanted_pic`, `BOUNDARY:too_pushy`

**Format:** Each suggestion is `{ id: '0', text: 'Message text.' }`. IDs are unique within a bucket.

**Adding more lines:**
1. Open `teaze-messages.js`
2. Find the bucket (e.g. `GENERAL_MESSAGES['START:PLAYFUL']`)
3. Add `{ id: '40', text: 'Your new line here.' }` (use next sequential id)
4. Follow tone rules: short (5–14 words), human, confident + kind, no banned phrases
5. Run `node test-teaze.js` to verify min counts and no banned phrases

**Tone rules (hard):** No corporate phrases, no therapy-speak, no manipulation. See the header comment in `teaze-messages.js` for full rules.

## Tests

Run sanity checks:
```bash
node test-teaze.js
```

Checks: min 35 per bucket, no banned phrases, anti-repeat algorithm.

