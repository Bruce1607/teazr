# LEAN Analytics

This project tracks a minimal set of product events:

- `teaz_opened`
- `copy_clicked`
- `more_options_clicked`
- `quiz_started`
- `quiz_completed`

Client events are posted to `POST /api/event`.

## Payload shape

Each event payload includes:

- `event`
- `ts`
- `path`
- `session_id`
- `anon_id`
- optional `props`

`session_id` is regenerated per page session. `anon_id` is persisted in `localStorage`.

## Pages Function behavior

`functions/api/event.js`:

- accepts `POST /api/event`
- validates event name against the allowlist above
- logs valid event JSON to console
- always returns `204`

Invalid/unrecognized events are ignored (not logged).

## Manual test instructions

1. Open browser DevTools:
   - **Network** tab (filter: `event`)
   - **Console** (server logs in Pages environment)
2. Load `/teaze`:
   - expect `POST /api/event` with `event: "teaz_opened"`
3. Click any **COPY** button:
   - expect `event: "copy_clicked"`
4. Click **MORE ↻**:
   - expect `event: "more_options_clicked"`
5. Start quiz from home:
   - expect `event: "quiz_started"`
6. Complete all 6 quiz questions:
   - expect `event: "quiz_completed"`
7. Verify `session_id` and `anon_id` are present in posted payloads.
8. Verify server logs only show allowlisted events.
