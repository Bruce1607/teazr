# TEAZR — User-side recovery if site doesn't load

If https://teazr.app or https://teazr.app/teaze does not load (blank page, stuck, or old version) in Chrome or Instagram in-app browser:

## Steps to recover

1. **Clear site data for teazr.app**
   - Chrome: Settings → Privacy and security → Site settings → View permissions and data stored across sites → search "teazr" → Clear data
   - Or: Open `chrome://settings/siteData`, search "teazr.app", click trash icon

2. **Unregister Service Worker (if any)**
   - Chrome: DevTools (F12) → Application tab → Service Workers → find teazr.app → Unregister

3. **Hard refresh**
   - Windows: Ctrl+Shift+R
   - Mac: Cmd+Shift+R

4. **Try Incognito/Private** (bypasses cache) to confirm the site loads, then clear data in normal window

After deploying the emergency fix, new visits will get the working version. Users who previously had a stuck cache may need to clear site data once.
