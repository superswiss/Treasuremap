# Hidden Trails

A phone-friendly static treasure hunt game with two adventures: **Operation Howell Creek: The STEVE Protocol** and **Captain Barnacle Beard’s Lost Treasure**. The demos are playable now. Real-world play stays locked until its route and answers are configured.

## Run on this computer

In PowerShell, open this project folder and run:

```powershell
node tools/serve.mjs
```

Open **http://localhost:4173**. Keep PowerShell open; Ctrl+C stops the server. Install a supported Node.js LTS release if `node` is unavailable. `npm start` is equivalent when npm is available. Do not double-click index.html.

The server rebuilds `dist/` at startup. After changing source files, stop and restart it. It binds only to this computer. For phone GPS, camera, and microphone testing, deploy to HTTPS; a plain HTTP Wi-Fi address is insufficient. If port 4173 is already in use by this server, use its existing browser address.

## Try the game

1. Choose **Try the demo**. Demo saves are separate from field saves and do not use GPS.
2. Use **Simulate arrival** and **Simulate marker scan** when prompted. Demo observation answers appear on screen.
3. Capture all three sensors before the timer expires. Failed attempts can be retried.
4. After STEVE’s reveal, use **Field kit → Download Agency signal**, then upload the WAV to CipherWave. Enter its decoded phrase on the Mission tab.
5. Use **Journal** for recovered clues, text notes, and optional local photos.
6. Use **Field kit → Export / restore progress** to transfer progress and text notes between devices. Photos stay on their originating device and have individual download/delete controls.

## Configure a real hunt

Fill in [SETUP-CHECKLIST.md](SETUP-CHECKLIST.md), or send those details in chat. The summaries did not include the original pirate coordinates, questions, answers, or React CipherWave source. Pirate demo questions are placeholders; the audio implementation is new.

Open **Organizer access** at the bottom of the app. The initial PIN is **1980**. Choose **Setup & readiness** to see missing information and edit the settings JSON. Save on this device to test locally.

To configure all players:

1. Download the settings from Setup.
2. Replace **content/hunt-settings.json** in this project with that download.
3. Rebuild and deploy. Browser-only settings do not change hosted files.
4. On a device with an old local override, choose **Use deployed settings** in Setup.

Each location is either `null` (not configured) or an object such as `{ "lat": 28.12345, "lng": -81.12345 }`. Replace example coordinates with your actual approved point. Set fenceAnswer and fizzAnswer to one of their displayed choices. Supply five pirate questions, 2–6 choices each, and matching answers. The readiness check validates required fields; walk the route to verify it.

## Deploy to GitHub Pages

Choose either route below. This project has not been published by this work.

### Option A: upload the finished game

1. Run `node tools/build.mjs`. The generated **dist/** directory is the complete website, including STEVE’s existing WAV recordings.
2. Create a GitHub repository, for example `hidden-trails`. GitHub Free supports Pages for public repositories.
3. Upload the **contents of dist/** to the root of the repository’s `main` branch. `index.html` must be at the repository root, not inside another dist folder. Keep the audio, content, lib, and adventures folder structure.
4. Open **Settings → Pages → Build and deployment**. Select **Deploy from a branch**, then **main** and **/(root)**. Save.
5. Wait for deployment and open the HTTPS address GitHub provides, usually `https://YOUR-USERNAME.github.io/hidden-trails/`.
6. For updates, rebuild and replace the deployed files. Remove old deployed files if you intentionally delete them.

### Option B: automatic deployment from source

1. Add the game source to a repository whose default branch is `main`: index.html, style.css, app.js, package.json, .gitignore, .github/workflows/pages.yml, adventures/, lib/, content/, audio/steve/, tools/, and tests/. Documentation is optional.
2. Review the files before uploading. The unrelated PDF in this workspace is not game content. Avoid a blanket `git add .` without reviewing what it includes.
3. In **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**.
4. Open **Actions → Publish Hidden Trails → Run workflow**, or push another commit to main.
5. The supplied workflow tests the game, builds dist/, and publishes only that directory. Its deployment summary links to the site. If your branch has another name, update the workflow’s branches setting.

Official instructions: [Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Before inviting players

- Ensure Setup has no missing fields for the adventure you plan to run. You can publish demos while field setup is incomplete.
- Walk the route using the actual phone. Tune arrival/capture radii and the timer. Keep nodes reachable by walking on approved paths, away from water and real equipment.
- On the deployed HTTPS site, open **Organizer access → Printable marker links**. Encode those exact URLs into QR labels or NFC tags, and print the plain access codes as a fallback. This screen supplies URLs; it does not generate QR graphics.
- Place the activation and final markers. Sensor captures use GPS, so they do not need QR labels in this version.
- Download the shutdown signal from the organizer Audio encoder. Use a separate playback device for microphone reception and keep the WAV upload fallback available.
- Test failed sensor attempts, hints, progress transfer, and organizer overrides.

## Features and limits

- Two themed adventures, local saves, map, hints, spoken narration, GPS arrival questions, QR/NFC links, timed three-node capture, audio cipher, and a journal.
- STEVE’s supplied narration and a playable shutdown puzzle between his reveal and the final rendezvous. The processor stage uses revised text/read-aloud instead of the old vial recording: inspect a prepared colored prop; do not mix chemicals or enter pool equipment areas.
- Leaflet/OpenStreetMap uses completed, current, and locked checkpoint pins, player location, accuracy circles, and live yard distances. Configured future locations are visible as locked pins.
- GPS checks require a fix less than 20 seconds old, reported accuracy within the configured radius, and a position within that radius. Inaccurate GPS may require an organizer override.
- CipherWave uses audible dual tones, an opening synchronization tone, repeated characters, and a checksum. This is a game cipher, not encryption or hidden-in-music steganography. Its new v1 framing is not compatible with the older unframed proof of concept.
- Microphone recording is capped at 60 seconds. Speaker-to-phone performance requires physical testing. Upload a WAV when reception fails. Very long encoded messages can exceed the recording cap.
- In-browser QR scanning depends on BarcodeDetector support. The phone’s camera app, NFC links, and typed codes are fallbacks.
- Progress and notes use localStorage; photos use IndexedDB. Clearing browser data or using private browsing can erase saves. Localhost and the hosted site have different saves. Progress codes include notes, not photos/settings, and are structurally validated but not signed.
- The organizer PIN and puzzle answers are visible in client files. The PIN is a convenience control, not a security boundary. Static route coordinates are public to anyone who downloads the app.
- This is online-first: no service worker or guaranteed offline play. Fonts load from Google Fonts, Leaflet from unpkg, and map tiles from OpenStreetMap. These services and the host receive normal network requests; tile requests reveal the viewed map area. The app does not upload GPS fixes, recordings, photos, notes, or progress and has no analytics backend.
- Photos are journal memories, not stage triggers. Separate phones play independently; there is no synchronized multiplayer backend.

## Existing material and source layout

- `adventures/hunts.js`: live stage sequence and story integration.
- `content/hunt-settings.json`: real locations, answers, timer, radii, PIN.
- `content/steve-transmissions.json`: existing narrative/audio source. Its older stages section remains reference material; it does not control the live game.
- `audio/steve/`: existing generated recordings, included in deployment.
- `content/steve-transmission-scripts.md`, `content/help-and-safety.md`, and `prototype/steveSpeech.ts`: preserved supporting drafts. The app displays updated help and uses plain JavaScript speech.
- `lib/`: progress/GPS validation, audio codec, photo storage.
- `tools/build.mjs`: deployable-file allowlist; unrelated workspace files are excluded.

To regenerate the original Windows speech recordings, optionally run:

```powershell
.\tools\generate-steve-audio.ps1
```

Rebuild after regenerating. Generation is unnecessary for the supplied WAVs.

## Checks

```powershell
node --test tests/core.test.mjs
node tools/build.mjs
```

`npm test` and `npm run build` are equivalents. Optional end-to-end checks are in tests/browser.mjs. They require Playwright and a browser with the local server running. Use `node tests/browser.mjs`; optionally set BROWSER_CHANNEL to msedge or chrome and PLAYWRIGHT_MODULE to an installed Playwright package path. Browser tests emulate location and do not substitute for an outdoor phone test.

## Guided setup with a clickable map

Open setup.html on the hosted site, or Organizer access → Setup & readiness → Open guided setup. Select a checkpoint, click the map, or drag its selected pin. Answer the form questions and choose Download configuration. Attach the resulting hunt-settings.json file in chat for integration. Incomplete drafts can be downloaded too. Drafts save automatically in this browser; Use in this browser applies the setup locally. Import configuration lets you reopen a downloaded plan. Publishing still requires replacing content/hunt-settings.json and deploying.

