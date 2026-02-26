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

## How to query Analytics Engine

Dataset name: `teazr_events` (binding: `AE`).

In Cloudflare Dashboard:

1. Open **Analytics Engine**.
2. Open dataset **teazr_events**.
3. Run SQL queries using mapped columns:
   - `blob1 = event`
   - `blob2 = path`
   - `blob3 = tab`
   - `blob4 = bucketKey`
   - `double1 = event_count` (always `1`)
   - `index1 = anon_id`
   - `index2 = session_id`

### Example query: events per day by event name

```sql
SELECT
  DATE_TRUNC('day', timestamp) AS day,
  blob1 AS event_name,
  SUM(double1) AS events
FROM teazr_events
WHERE timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY 1, 2
ORDER BY 1 ASC, 2 ASC;
```

### Example query: teaz_opened per day

```sql
SELECT
  DATE_TRUNC('day', timestamp) AS day,
  SUM(double1) AS teaz_opened
FROM teazr_events
WHERE blob1 = 'teaz_opened'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY 1
ORDER BY 1 ASC;
```

### Example query: copy rate (copy_clicked / teaz_opened)

```sql
WITH daily AS (
  SELECT
    DATE_TRUNC('day', timestamp) AS day,
    SUM(CASE WHEN blob1 = 'copy_clicked' THEN double1 ELSE 0 END) AS copies,
    SUM(CASE WHEN blob1 = 'teaz_opened' THEN double1 ELSE 0 END) AS opens
  FROM teazr_events
  WHERE timestamp >= NOW() - INTERVAL '30' DAY
  GROUP BY 1
)
SELECT
  day,
  copies,
  opens,
  CASE WHEN opens = 0 THEN 0 ELSE copies / opens END AS copy_rate
FROM daily
ORDER BY day ASC;
```
