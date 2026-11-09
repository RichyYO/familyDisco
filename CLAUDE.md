# SongScan (repo: RichyYO/familyDisco)

QR song cards printed at home. One static page on GitHub Pages → Spotify Web API, on any phone.
Spec: https://claude.ai/artifact/PPeqWSrTMqzjc979cComZa (its iPhone/YouTube half is dropped, see Scope).

## Verdict block
Question: can a group play a full game with home-printed cards, no ads, nobody seeing a title early?
- Spotify page, ads seen: ___   title seen early: ___   failed cards: ___ / ___
- Played by someone other than Red: ___
- Timebox: none set (Red, 2026-11-08). Playbook rule 9 says set one.

## Scope / Parked
v1 = card generator, Spotify page (index.html + app.js), one deck `main`.
Dropped 2026-11-09 (Red): YouTube Music + iPhone Shortcut. Spotify only; SHORTCUT.md and the CSV
`youtube` column deleted (git history has them). Every card now needs a Spotify ID.
Parked: in-app reveal, catalog updates, offline, scoring, public release.

## Decisions (beyond the spec)
- Countdown = the spec's beep per second: the phone is face down, so the screen can't be seen.
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
  Closing page audio before /play and `#silent` (no beeps) both still fail. Account is Premium.
  Printed QR codes decoded from the PDF: all 10 map to the right deck entries.

## Architecture
- tools/make_cards.py: CSV → decks/<deck>.json (IDs only) + print/cards-<deck>.pdf. Validates all
  rows first, builds in memory, writes nothing on any error. PyMuPDF 1.27 orphans Page objects on
  new_page(), so pages are re-fetched via doc[i].
- app.js: screens signin → scan → ready → countdown → playing; errors via UserError(kind).
  Classic script, so functions are globals and can be driven from the console for tests.

## Known issues / untested (needs a real phone)
- No sound (2026-11-09): /play 204, phone ends "paused, no track". Ruled out: device pick, page
  audio, Private Session, Premium, card data. Next suspect: track IDs not playable in Red's market;
  the error now reports `track playable=` from GET /tracks?market=from_token. `#silent` URL hash
  skips beeps (debug switch: delete once the cause is known).
- Untested: iPhone Safari with the page, BarcodeDetector path, `spotify:` button, 10-min idle device check.
