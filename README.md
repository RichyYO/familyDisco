# SongScan

Scan a printed card, the song plays in YouTube Music (iPhone) or Spotify (Android).
No titles on any screen: flip the card to reveal.

## Make cards

```
python tools/make_cards.py songs/main.csv
```

CSV columns `card,title,artist,year,spotify,youtube`. Links or bare IDs are fine. Writes
`decks/main.json` (commit it) and `print/cards-main.pdf`. Print the PDF on A4, double-sided,
**flip on long edge**, at 100% scale (not "fit to page"). Cut along the corner marks.

## Publish

Push to `github.com/RichyYO/familyDisco`, then Settings → Pages → Deploy from branch `main`,
folder `/ (root)`. Site: https://richyyo.github.io/familyDisco/

## iPhone

Build the Shortcut from [SHORTCUT.md](SHORTCUT.md).

## Android: Spotify setup (once)

1. https://developer.spotify.com/dashboard → Create app → tick **Web API**.
2. Redirect URIs: `https://richyyo.github.io/familyDisco/` and, for testing on the PC,
   `http://127.0.0.1:8000/`.
3. User Management: add the Spotify account used on the Android phone (max five).
4. Copy the Client ID into `SPOTIFY_CLIENT_ID` at the top of `app.js`.
5. On the phone, open the site in Chrome, sign in, allow the camera. Add to Home Screen.
   Turn on Spotify's Private Session to keep game songs out of recommendations.

## Test on the PC

```
python -m http.server 8000 --bind 127.0.0.1
```

Then open http://127.0.0.1:8000/ (use `127.0.0.1`, not `localhost`: Spotify rejects
`localhost` redirects).
