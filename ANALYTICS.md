# LEAN Analytics

This project tracks a minimal set of product events with source attribution and zero PII.

## Events

| Event | When | Props |
|-------|------|-------|
| `teaze_opened` | Send a Teaz screen renders | `category`, `moment`, `style` |
| `quiz_started` | First quiz question shown | `quiz_version` |
| `quiz_completed` | Quiz results screen renders | `quiz_version` |
| `copy_clicked` | Any copy button clicked | `context` (`teaze_message` / `quiz_result` / `other`) |
| `share_clicked` | Any share button clicked | `context` (`whatsapp` / `copy_link` / `other`) |

## Payload shape

```json
{
  "event": "teaze_opened",
  "ts": 1700000000000,
  "path": "/teaze",
  "source": "tiktok",
  "ref_domain": "tiktok.com",
  "in_app": true,
  "props": { "category": "GENERAL", "moment": "START", "style": "CLASSY" }
}
```

### Source attribution (no cookies / no fingerprinting)

Every event includes:

- `source`: `"tiktok"` | `"instagram"` | `"facebook"` | `"direct"` | `"unknown"`
- `ref_domain`: hostname only (e.g. `"l.instagram.com"`) or `""`
- `in_app`: `true` if TikTok/Instagram/FB in-app browser detected

Detection priority: URL params (`utm_source` / `src`) → `document.referrer` hostname → user-agent in-app signals → `"direct"` if no referrer/signal, else `"unknown"`.

## Pages Function behavior

`functions/api/event.js`:

- accepts `POST /api/event` (returns 405 for other methods)
- validates event name against allowlist → 400 if unknown
- rejects payloads > 2 KB → 413
- per-IP rate limit: 60 req/min → 429
- logs valid event JSON to console
- writes one Analytics Engine datapoint to `env.AE` (`teazr_events`) for each accepted event
- returns 204 on success

### Analytics Engine datapoint mapping

- `blobs[0]` = event name
- `blobs[1]` = path
- `blobs[2]` = source
- `blobs[3]` = ref_domain
- `blobs[4]` = JSON stringified props
- `doubles[0]` = 1 (count)
- `doubles[1]` = in_app (1 or 0)
- `indexes[0]` = source

## Data storage

Events are stored in **Cloudflare Analytics Engine** when the `AE` binding is configured. If `AE` is not bound, events are still logged as structured JSON to the Pages Function console (visible in Cloudflare Dashboard → Pages → Deployment → Functions logs).

### Enabling Analytics Engine (if not already configured)

1. In Cloudflare Dashboard, go to **Workers & Pages → your Pages project → Settings → Functions → Analytics Engine bindings**.
2. Add a binding: variable name `AE`, dataset name `teazr_events`.
3. Redeploy. The function will automatically detect the binding and start writing datapoints.

## QA mode

Append `?qa=1` to any page URL to enable the QA overlay:

- Fixed panel at bottom-right showing last 20 tracked events
- Events also logged to `console.log` with `[TEAZR QA]` prefix
- The overlay does NOT send extra events

## QA checklist

1. Open `/teaze?qa=1` → `teaze_opened` appears in overlay
2. Start quiz with `?qa=1` → `quiz_started` appears
3. Finish quiz → `quiz_completed` appears
4. Click COPY in teaze → `copy_clicked` (context=teaze_message) appears
5. Click "Copy link" on quiz result → `copy_clicked` (context=quiz_result) appears
6. Click "Share on WhatsApp" → `share_clicked` (context=whatsapp) appears
7. Open with `?src=tiktok&qa=1` → source="tiktok"
8. Open with `?src=ig&qa=1` → source="instagram"
