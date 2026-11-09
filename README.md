# SongScan

Scan a printed card with your phone, and the song plays in the Spotify app.
No titles on any screen: flip the card to reveal.

## Make cards

```
python tools/make_cards.py songs/main.csv
```

CSV columns `card,title,artist,year,spotify`. The `spotify` column takes a track share link,
a `spotify:track:` URI or a bare ID, and every row needs one. Writes `decks/main.json`
(commit it) and `print/cards-main.pdf`. Print the PDF on A4, double-sided,
**flip on long edge**, at 100% scale (not "fit to page"). Cut along the corner marks.

## Publish

Push to `github.com/RichyYO/familyDisco`, then Settings → Pages → Deploy from branch `main`,
folder `/ (root)`. Site: https://richyyo.github.io/familyDisco/

## On the phone (once)

1. Install the Spotify app and sign in (tested with Premium).
2. Open https://richyyo.github.io/familyDisco/ and allow the camera. Add to Home Screen.
3. Scan a card and tap Play. When the browser asks to open Spotify, choose **Always**
   (Firefox: "always open in app"), so later songs start without a prompt.

No Spotify sign-in or developer app: the page opens `spotify:track:<id>` and the Spotify app
starts the song by itself.

## Test on the PC

```
python -m http.server 8000 --bind 127.0.0.1
```

Then open http://127.0.0.1:8000/. The camera needs `127.0.0.1`/`localhost` or HTTPS.
