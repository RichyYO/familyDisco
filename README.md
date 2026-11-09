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

## Spotify setup (once)

Needs Spotify **Premium** on the account that plays (and on the app owner's account).

1. https://developer.spotify.com/dashboard → Create app → tick **Web API**.
2. Redirect URIs: `https://richyyo.github.io/familyDisco/` and, for testing on the PC,
   `http://127.0.0.1:8000/`.
3. User Management: add each Spotify account that will play (max five).
4. Copy the Client ID into `SPOTIFY_CLIENT_ID` at the top of `app.js`.
5. On the phone, open the site, sign in, allow the camera. Add to Home Screen.

## Test on the PC

```
python -m http.server 8000 --bind 127.0.0.1
```

Then open http://127.0.0.1:8000/ (use `127.0.0.1`, not `localhost`: Spotify rejects
`localhost` redirects).
