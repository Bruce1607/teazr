# LEAN Analytics

This project tracks a minimal set of product events:

- `teaz_opened`
- `copy_clicked`
- `more_options_clicked`
- `quiz_started`
- `quiz_completed`

Client events are posted to:

- `POST https://teazr.app/api/event`

Expected response status:

- `204`

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
- applies request/payload size caps before accepting data
- logs valid event JSON to console
- writes one Analytics Engine datapoint to `env.AE` (`teazr_events`) for each accepted event
- always returns `204`

Invalid/unrecognized events are ignored (not logged).

### Analytics Engine datapoint mapping

Each accepted event writes:

- `blobs[0] = event`
- `blobs[1] = path || ""`
- `blobs[2] = props.tab || ""`
- `blobs[3] = props.bucketKey || ""`
- `doubles[0] = 1`
- `indexes[0] = anon_id || ""`
- `indexes[1] = session_id || ""`

If `env.AE` is missing or the write throws, the function logs the error and still returns `204`.

## Manual test instructions

1. Open browser DevTools on `https://teazr.app`.
2. Go to **Network** tab and filter by `/api/event`.
3. Open `/teaze`:
   - confirm a request to `POST /api/event`
   - confirm response status is `204`
   - confirm payload includes `event`, `path`, and optional `props`
4. Click any **COPY** button:
   - confirm `event: "copy_clicked"` and status `204`
5. Click **MORE ↻**:
   - confirm `event: "more_options_clicked"` and status `204`
6. Start and complete the quiz:
   - confirm `quiz_started` and `quiz_completed` are sent
7. Payload safety check:
   - no message text or other PII should be sent

## Verify Analytics Engine is receiving events

Dataset name: `teazr_events` (binding: `AE`).

1. In Cloudflare Pages, wait for the latest deployment to become **Successful**.
2. Generate fresh events on production:
   - open `https://teazr.app/teaze`
   - click **COPY** at least 2-3 times
3. In Cloudflare Dashboard, open **Analytics Engine** and select dataset `teazr_events`.
4. Confirm new datapoints appear for recent timestamps:
   - event names should include `teaz_opened` and `copy_clicked`
5. If data is not immediate, wait a short time and refresh the dataset view.
