# iPhone Shortcut: SongScan

Build this by hand in the **Shortcuts** app (a Shortcut file can't be made on Windows).
Name it `SongScan`. Text in `[brackets]` is a variable: tap the field, then pick it
from the variable bar above the keyboard rather than typing it.

Deck URL base: `https://richyyo.github.io/familyDisco/decks/` (the repo name in the
path is case-sensitive).

| # | Action | Settings |
|---|--------|----------|
| 1 | **Pause** (search "Play/Pause") | Set to **Pause**. Stops last round's song. |
| 2 | **Scan QR or Barcode** | — |
| 3 | **If** | `[QR/Barcode]` **does not contain** `qs1:` |
| 3a | ↳ **Show Alert** | `Not a SongScan card`. Turn **Show Cancel Button** off. |
| 3b | ↳ **Stop This Shortcut** | — |
| 3c | **End If** | (delete the empty *Otherwise* branch) |
| 4 | **Match Text** | Pattern `deck=([a-z0-9]+)` in `[QR/Barcode]` |
| 4a | **Get Group at Index** | Index `1` in `[Matches]` |
| 4b | **Set Variable** | `Deck` |
| 5 | **Match Text** | Pattern `card=([0-9]+)` in `[QR/Barcode]` |
| 5a | **Get Group at Index** | Index `1` in `[Matches]` |
| 5b | **Set Variable** | `Card` |
| 6 | **URL** | `https://richyyo.github.io/familyDisco/decks/[Deck].json` |
| 6a | **Get Contents of URL** | Method GET (default) |
| 7 | **Get Dictionary Value** | Get **Value** for `cards` in `[Contents of URL]` |
| 7a | **Get Dictionary Value** | Get **Value** for `[Card]` in `[Dictionary Value]` |
| 7b | **Get Dictionary Value** | Get **Value** for `youtube` in `[Dictionary Value]` |
| 7c | **Set Variable** | `VideoID` |
| 8 | **If** | `[VideoID]` **does not have any value** |
| 8a | ↳ **Show Alert** | `Card not in this deck, or not on YouTube`. Show Cancel Button off. |
| 8b | ↳ **Stop This Shortcut** | — |
| 8c | **End If** | (delete the empty *Otherwise* branch) |
| 9 | **Show Notification** | `3`. Turn **Play Sound** off. |
| 9a | **Wait** | `1` second |
| 9b | **Show Notification** | `2`, Play Sound off |
| 9c | **Wait** | `1` second |
| 9d | **Show Notification** | `1`, Play Sound off |
| 9e | **Wait** | `1` second |
| 10 | **URL** | `https://music.youtube.com/watch?v=[VideoID]` |
| 10a | **Open URLs** | — |

**Steps 9–9e change the spec.** The spec had a "Tap OK, then put the phone face down"
alert plus three vibrations. You chose a visible 3-2-1 with no vibration or voice and
the song starting at the end of the count, so the alert and vibrations are replaced by
silent notification banners. A Shortcut has no full-screen countdown; banners are the
only on-screen cue that doesn't need a tap.

**Watch for this:** YouTube Music shows the title the moment it opens. If someone is
watching the 3-2-1, they will see the title unless the phone goes face down on "1".

## Setup

- Settings → Notifications → Shortcuts: allow notifications, or step 9 shows nothing.
- First run asks to open URLs and to reach github.io: choose **Always Allow**.
- Add to Home Screen (share sheet in the Shortcut), and optionally Back Tap
  (Settings → Accessibility → Touch → Back Tap → Double Tap → SongScan).
- Share with friends: ⋯ → Share → Copy iCloud Link. Each phone needs the YouTube Music
  app signed in to YouTube Premium or YouTube Music Premium.

## Test on the phone

1. Scan any non-SongScan QR (e.g. a Wi-Fi code): "Not a SongScan card", nothing plays.
2. Scan test card 0001 to 0010 in turn: 3, 2, 1 banners, then YouTube Music opens and
   plays with no further tap. Note any ad, any extra tap, any card that fails.
3. Run it again mid-song: the old song pauses before the scanner opens.
4. Turn on flight mode and scan: note what the Shortcut shows (it is Apple's own
   error, not ours).
