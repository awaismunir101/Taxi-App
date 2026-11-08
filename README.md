# Taxi Fare Calculator (PWA)

Files: index.html, app.js, fare.js, sw.js, manifest.webmanifest, 3 icons, tests.js.
Rates live in fare.js (RATES and MIN_FARE, values in cents). Run `node tests.js` to test.

## Install on iPhone
A service worker (offline mode) needs HTTPS, so host the folder once:
1. Upload ALL files in this folder to a free static host: Netlify Drop (app.netlify.com/drop), GitHub Pages or Cloudflare Pages.
2. Open the https link in **Safari** on the iPhone.
3. Tap Share, then **Add to Home Screen**, then Add.
4. Open it once from the Home Screen while online. It then works offline.

## Updating
After editing any file, change `taxi-fare-v1` in sw.js to `taxi-fare-v2` and re-upload.
