# LEAN Analytics

This project tracks a minimal set of product events:

- `home_opened`
- `send_teaz_clicked`
- `quiz_start_clicked`
- `teaz_opened`
- `copy_clicked`
- `more_options_clicked`
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

## 60-second QA checklist

1. Open `https://teazr.app/` in an incognito window.
2. Open DevTools -> **Network** and filter by `event`.
3. Confirm `POST https://teazr.app/api/event` requests return `204`.
4. Click **SEND A TEAZ**:
   - confirm an event with `event: "send_teaz_clicked"` returns `204`
5. Click **COPY** on any suggestion:
   - confirm `event: "copy_clicked"` still returns `204`
6. Open `https://teazr.app/teaze` directly:
   - confirm it redirects to `https://teazr.app/`
7. Open `https://<project>.pages.dev` directly:
   - confirm it redirects to `https://teazr.app/`
8. Payload safety check:
   - payload should include `event`, `path`, optional `props`
   - no message text or other PII should be sent

## Verify Analytics Engine is receiving events

Dataset name: `teazr_events` (binding: `AE`).

1. In Cloudflare Pages, wait for the latest deployment to become **Successful**.
2. Generate fresh events on production:
   - open `https://teazr.app/`
   - click **SEND A TEAZ** and then **COPY** at least 2-3 times
3. In Cloudflare Dashboard, open **Analytics Engine** and select dataset `teazr_events`.
4. Confirm new datapoints appear for recent timestamps:
   - event names should include `home_opened`, `send_teaz_clicked`, `teaz_opened`, and `copy_clicked`
5. If data is not immediate, wait a short time and refresh the dataset view.
