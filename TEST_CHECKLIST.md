# TEAZR V1 FINAL – Manual Test Checklist

## Send a Teaz

- [ ] **Category toggle**
  - Default is GENERAL. Toggle to FLIRTY; suggestions change.
  - Toggle back to GENERAL; suggestions change.
  - Category persists when switching moments/styles.

- [ ] **MORE OPTIONS ↻**
  - Button appears top-right above the 3 suggestions.
  - Clicking it refreshes the 3 suggestions.
  - New suggestions differ from the previous 3 (anti-repeat).
  - Click several times; suggestions vary, no immediate repeats.
  - Button shows "REFRESHING…" briefly, then re-enables.

- [ ] **BOUNDARY (GENERAL only)**
  - Switch to GENERAL. BOUNDARY appears in Moments.
  - Select BOUNDARY. Situation selector appears: "Unwanted pic" / "Too pushy / won't stop".
  - Select each situation; suggestions update.
  - Safety microcopy appears under BOUNDARY suggestions.
  - Switch to FLIRTY; BOUNDARY disappears. Moment resets to START if BOUNDARY was selected.

- [ ] **Defaults**
  - Fresh load: Category=GENERAL, Moment=START, Style=CLASSY.

- [ ] **Share link**
  - COPY LINK produces a URL. Open in new tab; seed loads category/moment/style/situation.
  - Share URL with BOUNDARY + situation; recipient sees correct state.

- [ ] **Copy**
  - Each COPY button copies the message text.
  - Button shows COPIED, then reverts.

## Quiz

- [ ] **quiz_started**
  - Start quiz; event fires (check Network tab for POST /api/event).

- [ ] **quiz_completed**
  - Finish 6 questions; result screen appears; event fires.

## Analytics (optional)

- [ ] Open DevTools → Network; filter by `event`.
- [ ] Navigate to Send a Teaz → `teaz_opened`.
- [ ] Change moment → `moment_selected`.
- [ ] Change style → `style_selected`.
- [ ] Change category → `category_selected`.
- [ ] Change situation (BOUNDARY) → `situation_selected`.
- [ ] Click COPY → `copy_clicked` (props include index 0/1/2).
- [ ] Click MORE OPTIONS → `more_options_clicked`.
- [ ] No personal data in payloads (no message text, no IP).

## Cross-browser

- [ ] Chrome/Edge, Firefox, Safari: layout and interactions work.
- [ ] Mobile viewport: category toggle, MORE OPTIONS placement readable.
