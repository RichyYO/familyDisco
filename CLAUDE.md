# SongScan (repo: RichyYO/familyDisco)

QR song cards printed at home. One static page on GitHub Pages opens `spotify:track:<id>` in
the phone's Spotify app, which starts the song by itself. No sign-in, no Web API.
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
- Play = open `spotify:track:<id>` after the countdown, not Web API /play (2026-11-09). Web API
  /play to the phone returned 204 and loaded nothing; ruled out device pick, page audio, Private
  Session, Premium, card data, market. Matches github.com/encodi/sonora-mcp/issues/34 (Android +
  Windows clients, Oct–Nov 2026). Cost of the link: Spotify shows the title on the face-down phone,
  and "Next card" can't pause the song (the next link replaces it). Spotify dev app no longer used.
- Playing screen keeps a "Song didn't start? Play it" link to the same track, in case the browser
  won't open an app 3 s after the tap.
- `print/` is gitignored (titles + build output). Not done: keeping the CSV private. songs/*.csv is public in the repo.

## Playtest log
- 2026-11-08 iPhone: music.youtube.com link from Notes autoplays (spec step 1 passed).
- 2026-11-09 Android (Firefox): Spotify sign-in OK after creating the app; scanning PDF cards OK; no sound.
  /play 204 but player ends "paused, no track". Private Session off. Track IDs all valid. PC web
  player → phone Connect works. Spotify login fails in the Claude browser pane (can't test from PC).
  Closing page audio before /play and `#silent` (no beeps) both still fail. Account is Premium.
  Printed QR codes decoded from the PDF: all 10 map to the right deck entries.
  Tapping a `spotify:track:` or open.spotify.com link from Firefox opens Spotify and the song
  starts by itself (after accepting "always open in app").

## Architecture
- tools/make_cards.py: CSV → decks/<deck>.json (IDs only) + print/cards-<deck>.pdf. Validates all
  rows first, builds in memory, writes nothing on any error. PyMuPDF 1.27 orphans Page objects on
  new_page(), so pages are re-fetched via doc[i].
- app.js: screens scan → ready → countdown → playing; problems go to the scan screen's toast.
  Classic script, so functions are globals and can be driven from the console for tests.
  index.html loads `app.js?v=N`: bump N on every app.js change (Pages caches 10 min; a stale
  app.js under a fresh index.html cost a phone test on 2026-11-09).

## Known issues / untested (needs a real phone)
- Opening Spotify from the page 3 s after the tap (no fresh tap): untested on the phone.
- Untested: iPhone Safari with the page, BarcodeDetector path, Spotify Free accounts.
