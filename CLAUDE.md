# SongScan (repo: RichyYO/familyDisco)

QR song cards printed at home. One static page on GitHub Pages opens `spotify:track:<id>` in
the phone's Spotify app, which starts the song by itself. No sign-in, no Web API.
Spec: https://claude.ai/artifact/PPeqWSrTMqzjc979cComZa (its iPhone/YouTube half is dropped, see Scope).

## Verdict block
Question: can a group play a full game with home-printed cards, no ads, nobody seeing a title early?
- Spotify page, ads seen: ___   title seen early: ___   failed cards: ___ / ___
- Played by someone other than Red: ___
- Timebox: none. Hobby project, no deadline or verdict pressure (Red, 2026-11-11).

## Scope / Parked
v1 = card generator, Spotify page (index.html + app.js), one deck `main`.
Dropped 2026-11-09 (Red): YouTube Music + iPhone Shortcut. Spotify only; SHORTCUT.md and the CSV
`youtube` column deleted (git history has them). Every card now needs a Spotify ID.
Parked: in-app reveal, catalog updates, offline, scoring, public release.

YouTube is back (2026-11-11) as a per-phone setting, for players with YouTube Premium.
Real deck `main` comes later; keep using `test` until then.

## Decisions (beyond the spec)
- Countdown = the spec's beep per second: the phone is face down, so the screen can't be seen.
- Settings (per phone, localStorage `songscan.settings`): countdown 1–3 s, beeps on/off. Capped at
  3 s (Red, 2026-11-11) because the song link must open while the Play tap still counts as recent;
  3 s is the longest confirmed on a phone. Beeps off creates no AudioContext at all.
- Service is per phone (Red, 2026-11-11), not per deck or a second page: one printed deck serves
  both. Spotify ID stays required on every card; `youtube` is optional and the generator lists
  cards without one. YouTube plays by opening `https://www.youtube.com/watch?v=<id>` in the
  regular YouTube app (Red, 2026-11-17). Not music.youtube.com: players don't have the separate
  YouTube Music app (the intent link prompts its install), and Firefox opens the plain link as a tab.
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
- Apple (iPhone/iPad; iPadOS by MacIntel + touch) (Red, 2026-11-17): Play is an `<a>` whose href
  is the song, so the tap itself opens it. No countdown or beeps; settings grey them out with an
  "Apple:" note. Safari hands youtube.com to the app only from a fresh tap; after 3 s it gives
  Safari's page or an "Open in app?" prompt. Spotify on Apple uses open.spotify.com, because
  app schemes (youtube://) prompted even when tapped.
- Rejected: in-page YouTube player (iPhone: ad first every time, froze once); youtube:// links.
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
- 2026-11-09 Android (Firefox), commit eb80a77: scan → Play → beeps → Spotify opens and the song
  starts by itself, 3 s after the tap. Full round works.
- 2026-11-16 Android, YouTube Music setting: the app opens (not the browser tab), but on the Video
  tab and doesn't start until tapped. All test.csv `youtube` IDs are music-video IDs, which is
  why it lands on Video; the song (Art Track) ID is a different ID. test.csv now has song IDs
  (music.youtube.com search → Songs filter); all 10 open on the Song tab in the PC web player, the
  old video ID on Video. Phone retest pending.
- 2026-11-17 Android (Firefox 160), link test page: plain music.youtube.com (song, video, radio
  queue) now all open a browser tab. Intent pinned to the YTM app and youtube.com/watch play by
  themselves, both tapped and after 3 s. youtu.be and vnd.youtube: "other". Delay isn't the issue.
- 2026-11-17 Android, commit 5bc1365: YouTube setting, full round works (youtube.com/watch).
  iPhone Safari: same link opens Safari's YouTube page, not autoplaying, muted.
- 2026-11-17 iPhone (iOS 18.7, Safari), ios-test.html, two runs: youtube.com/watch tapped directly
  opens the app and plays (run 2; run 1 got Safari's page, likely iOS stuck on "open in Safari"
  after earlier tries). After 3 s: Safari page or "Open in app?" prompt. youtube:// always
  prompts. In-page player: ad first every time, once stuck on a black screen. Spotify not tried.

## Architecture
- tools/make_cards.py: CSV → decks/<deck>.json (IDs only) + print/cards-<deck>.pdf. Validates all
  rows first, builds in memory, writes nothing on any error. PyMuPDF 1.27 orphans Page objects on
  new_page(), so pages are re-fetched via doc[i].
- app.js: screens scan → ready → countdown → playing; problems go to the scan screen's toast.
  Classic script, so functions are globals and can be driven from the console for tests.
  index.html loads `app.js?v=N`: bump N on every app.js change (Pages caches 10 min; a stale
  app.js under a fresh index.html cost a phone test on 2026-11-09).

## Known issues / untested (needs a real phone)
- Untested: BarcodeDetector path, Spotify Free accounts, iPad detection.
- Untested on a phone: settings screen, the Apple tap-to-play round in the real game, Spotify on
  iPhone (open.spotify.com from a tap). If iOS opens YouTube links in Safari, long-press one →
  "Open in YouTube" resets it (seen 2026-11-17 after test tries landed on Safari's page).
