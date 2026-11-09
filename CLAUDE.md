# SongScan (repo: RichyYO/familyDisco)

QR song cards printed at home. iPhone: Apple Shortcut → YouTube Music. Android: static
page on GitHub Pages → Spotify Web API. Spec: https://claude.ai/artifact/PPeqWSrTMqzjc979cComZa

## Verdict block
Question: can a group play a full game with home-printed cards, no ads, nobody seeing a title early?
- iPhone, ads seen: ___   title seen early: ___   failed cards: ___ / ___
- Android, ads seen: ___   title seen early: ___   failed cards: ___ / ___
- Played by someone other than Red: ___
- Timebox: none set (Red, 2026-11-08). Playbook rule 9 says set one.

## Scope / Parked
v1 = card generator, iPhone Shortcut (SHORTCUT.md), Android page (index.html + app.js), one deck `main`.
Parked: iPhone+Spotify, Android+YouTube, in-app reveal, catalog updates, offline, scoring, public release.

## Decisions (beyond the spec)
- iPhone countdown = three silent Show Notification banners (3, 2, 1), no vibrate, no voice, no
  "Tap OK" alert; song starts after "1" (Red, 2026-11-08). Shortcuts has no full-screen count.
- Android keeps the spec's beep per second: the phone is face down, so the screen can't be seen.
- Blank CSV card numbers are assigned and written back into the CSV, so reruns never renumber printed cards.
- Generator errors (not warns) on glyphs the card font lacks; font = Windows Arial.
- Print layout: A4, 3×4 grid of 60 mm cards, backs mirrored for long-edge duplex.
- QR fallback = jsQR 1.4.0 from jsDelivr with SRI, loaded only without BarcodeDetector.
- Device pick: remembered ID → active Smartphone → first Smartphone. Forgotten when playback
  fails to start. "Playing" only after /me/player confirms that device is playing (a 2xx from /play isn't proof).
- `print/` is gitignored (titles + build output). Not done: keeping the CSV private. songs/*.csv is public in the repo.

## Playtest log
- 2026-11-08 iPhone: music.youtube.com link from Notes autoplays (spec step 1 passed).
- 2026-11-09 Android (Firefox): Spotify sign-in OK after creating the app; scanning PDF cards OK; no sound.
  /play 204 but player ends "paused, no track". Private Session off. Track IDs all valid. PC web
  player → phone Connect works. Spotify login fails in the Claude browser pane (can't test from PC).

## Architecture
- tools/make_cards.py: CSV → decks/<deck>.json (IDs only) + print/cards-<deck>.pdf. Validates all
  rows first, builds in memory, writes nothing on any error. PyMuPDF 1.27 orphans Page objects on
  new_page(), so pages are re-fetched via doc[i].
- app.js: screens signin → scan → ready → countdown → playing; errors via UserError(kind).
  Classic script, so functions are globals and can be driven from the console for tests.

## Known issues / untested (needs a real phone)
- Android: scan works, but the first real game showed "Playing" with no sound (2026-11-09). Fix (wake the
  idle device, then poll /me/player to confirm) didn't help. Current guess: page audio holds Android
  audio focus → AudioContext closed before /play, plus one retry. `#silent` URL hash skips beeps
  (debug switch: delete once the cause is known).
- Visible iPhone countdown: whoever watches it sees the title when YouTube Music opens.
- Show Notification banners while the Shortcut runs: unverified on device.
- BarcodeDetector path, `spotify:` button from Chrome, 10-min idle device check: unverified.
