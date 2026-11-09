# Making the SongScan shortcut on an iPhone

This guide walks you through building the SongScan shortcut by hand in Apple's
**Shortcuts** app. You don't need any experience. It takes about 20–30 minutes the
first time.

**What the finished shortcut does:** you tap it, it pauses whatever is playing, opens
the camera so you can scan a song card, counts down 3, 2, 1, then plays the song in
YouTube Music. It never shows the song name on the screen before it plays.

**Before you start, you need:**

- An iPhone with the **Shortcuts** app (it comes with the phone, so search for it if
  it isn't on your home screen).
- The **YouTube Music** app, signed in to an account with YouTube Premium or YouTube
  Music Premium. Without Premium you get ads.
- One printed SongScan card to test with.

---

## Part 0: How the Shortcuts app works (read this first)

A shortcut is a list of steps that the iPhone does one after another, top to bottom,
like a recipe. Apple calls each step an **action**. You build the shortcut by adding
actions one at a time.

**Adding an action:** at the bottom of the screen there is a search box called
**Search Actions**. Tap it, type the action's name (for example `Wait`), then tap the
action in the list. It gets added to the **bottom** of your shortcut.

**Blue words are settings you can change.** Each action is a grey box with a sentence
in it, for example *Wait **1** second*. The blue parts can be tapped and changed.

**Some actions have extra settings hidden away.** If an action has a small arrow
(**›** or **⌄**) on its right, tap it to show more options. Tap it again to hide them.

**Using the result of an earlier step.** Most actions produce something: the scanner
produces the text from the QR code, a web download produces the downloaded data, and
so on. A later action can use that result. In this guide, these results are written
like this: **`[QR/Barcode]`**, **`[Text]`**, **`[Deck]`**. They show up in the app as
small coloured bubbles with an icon.

To put one into a field:

1. Tap the field.
2. A strip appears just above the keyboard with suggestions. If the one you want is
   there, tap it.
3. If it isn't, tap **Select Variable** in that strip. The screen changes so that
   every earlier step can be tapped. Tap the step whose result you want.

**Never type the name of a bubble yourself.** Typing the word `Text` just puts the
word "Text" in the field. It has to be the coloured bubble.

**Often the app fills this in for you.** When you add an action right after another
one, it usually uses the previous step's result automatically. Always check that the
bubble it picked matches what this guide says.

**Moving an action:** press and hold it, drag it up or down, and let go. A slightly
indented action means it is *inside* the If block above it (more on If blocks in
Part 2).

**Deleting an action:** tap the **✕** on its top right, or press and hold it and
choose **Delete**.

**Testing as you go:** the **▶** (play) button at the bottom right runs the shortcut
right now. You can press it at any point to check what you've built so far.

---

## Part 1: Create the shortcut and set up the scanner

**What this part does:** stops the song from the last round and opens the camera.

1. Open **Shortcuts**. Tap **Shortcuts** at the bottom if you aren't on that tab, then
   tap **+** in the top right corner. An empty shortcut opens.
2. **Give it a name.** Tap the name at the very top of the screen (it says something
   like *New Shortcut*), tap **Rename**, type `SongScan`, and tap **Done** on the
   keyboard.
3. **Add "Play/Pause".** Search for `Play/Pause` and tap it. The box says something
   like *Play/Pause on iPhone*. Tap the blue word **Play/Pause** and choose **Pause**.
   Now it reads *Pause on iPhone*. (This stops last round's song when you scan the
   next card.)
4. **Add "Scan QR or Barcode".** Search for `Scan QR` and tap **Scan QR or Barcode**.
   There's nothing to change. Its result is called **`[QR/Barcode]`**.
5. **Add "Text".** Search for `Text` and tap the action called just **Text** (its
   icon is a yellow box with lines). It shows an empty box. Tap inside the box and
   put in the **`[QR/Barcode]`** bubble (see Part 0 if you're not sure how). Its result
   is called **`[Text]`**.

   *Why this step:* the scanner's result isn't marked as text, so the next step can't
   check what's written in it. Passing it through a **Text** action fixes that.

---

## Part 2: Check that it's really a SongScan card

**What this part does:** if someone scans the wrong QR code (a Wi-Fi code, a menu),
the shortcut says so and stops instead of doing something strange.

Every SongScan card's code starts with `qs1:`. That's the letters **q** and **s**,
the **number one**, and a colon. It is not a lowercase L.

6. **Add "If".** Search for `If` and tap it. Three linked boxes appear at once:
   **If**, **Otherwise** and **End If**. Everything placed between *If* and
   *Otherwise* only happens when the check is true.
7. **Set up the check.** The If box reads *If **Input** **Condition***.
   - Tap **Input** and choose the **`[Text]`** bubble (it may already be filled in).
   - Tap **Condition** and choose **does not contain**.
   - A new blue field appears. Tap it and type exactly `qs1:`
   - Now it reads: *If **Text** does not contain **qs1:***.

   If **does not contain** is missing from the list, the Input isn't the
   **`[Text]`** bubble from step 5. Fix the Input first.
8. **Add "Show Alert".** Search for `Show Alert` and tap it. It gets added at the
   bottom, *below* End If. **Drag it up** so it sits between **If** and
   **Otherwise** (it will look indented). Then:
   - Tap the message (it says *Do you want to continue?*) and replace it with
     `Not a SongScan card`
   - Tap the arrow on the action and switch **Show Cancel Button** off.
9. **Add "Stop This Shortcut".** Search for `Stop This Shortcut`, tap it, and drag
   it up so it sits just under the Show Alert, still between **If** and **Otherwise**.
10. **Leave "Otherwise" empty.** Nothing goes between Otherwise and End If. That's fine.

It should now look like this:

```
Pause on iPhone
Scan QR or Barcode
Text: [QR/Barcode]
If [Text] does not contain qs1:
    Show alert: Not a SongScan card
    Stop This Shortcut
Otherwise
End If
```

**Checkpoint:** press **▶** and scan any QR code that isn't a SongScan card. You
should see *Not a SongScan card*. Then press **▶** and scan a real card. Nothing
visible happens yet, and that's correct.

---

## Part 3: Read the deck name and card number off the card

**What this part does:** a card's code looks like `qs1:deck=test;card=0001`. These
steps pick out the deck name (`test`) and the card number (`0001`) and save each one
under a name so later steps can use them.

All of these actions go **after End If**, at the bottom, so you won't need to drag
anything. Type the patterns exactly as written, including the brackets. They are
instructions that tell the app which part of the text to pick out.

11. **Add "Match Text".** It reads *Match **pattern** in **text***.
    - Tap the pattern (it shows something like `[0-9a-zA-Z]`), delete it, and type
      `deck=([a-z0-9]+)`
    - Set the second field to the **`[Text]`** bubble from step 5. The app may have
      picked something else, so check it.
12. **Add "Get Group at Index".** It reads *Get group at index **1** in
    **Matches***. Leave it exactly like that.
13. **Add "Set Variable".** It reads *Set variable **Variable Name** to
    **(something)***. Tap **Variable Name** and type `Deck`. The second part should be
    the result of step 12. This saves the deck name as **`[Deck]`**.
14. **Add another "Match Text".** Pattern: `card=([0-9]+)`. Second field: the
    **`[Text]`** bubble again.
15. **Add another "Get Group at Index".** Leave it at *index **1** in **Matches***.
    Make sure **Matches** is the bubble from step 14, not step 11.
16. **Add another "Set Variable".** Name it `Card`. This saves the card number as
    **`[Card]`**.

---

## Part 4: Look up which song the card is

**What this part does:** the song list lives on the internet, on the project's web
page. The shortcut downloads the list for this deck and finds the YouTube code for
this card number. The card itself only holds a number, so nobody can work out the
song by looking at it.

17. **Add "URL".** Tap its field and type
    `https://richyyo.github.io/familyDisco/decks/`
    then put in the **`[Deck]`** bubble, then type `.json`
    With no spaces, it should read like
    `https://richyyo.github.io/familyDisco/decks/[Deck].json`.
    Type it in lowercase except `familyDisco`, which needs its capital D.
18. **Add "Get Contents of URL".** It should say *Get contents of **URL***. Leave
    everything else as it is. This downloads the song list.
19. **Add "Get Dictionary Value".** It reads *Get **Value** for **Key** in
    **Dictionary***.
    - Leave **Value** as it is.
    - Tap **Key** and type `cards`
    - The last part should be **Contents of URL** (from step 18).
20. **Add another "Get Dictionary Value".**
    - Tap **Key** and put in the **`[Card]`** bubble (don't type the word).
    - The last part should be **Dictionary Value** from step 19.
21. **Add another "Get Dictionary Value".**
    - Tap **Key** and type `youtube`
    - The last part should be **Dictionary Value** from step 20.
22. **Add "Set Variable".** Name it `VideoID`. This saves the song's YouTube code.

---

## Part 5: Stop if the card isn't in the list

**What this part does:** if a card's number isn't in the online list, the shortcut
says so instead of opening YouTube Music on nothing.

23. **Add "If"** (it goes after everything else, at the bottom).
    - Input: the **`[VideoID]`** bubble.
    - Condition: **does not have any value**.
24. **Add "Show Alert"**, drag it between this new **If** and its **Otherwise**, and
    set the message to `Card not in this deck, or not on YouTube`. Tap the arrow and
    switch **Show Cancel Button** off.
25. **Add "Stop This Shortcut"** and drag it just under that alert.
26. Leave this **Otherwise** empty too.

---

## Part 6: Count down 3, 2, 1

**What this part does:** small banners appear at the top of the screen showing 3,
then 2, then 1, one second apart, so everyone knows the song is coming. There's no
sound, and no button to tap.

All of these go at the bottom, after the second End If.

27. **Add "Show Notification".** Tap the message (it says *Hello World!*) and replace
    it with `3`. Tap the arrow and switch **Play Sound** off.
28. **Add "Wait"** and leave it at *1 second*.
29. **Add "Show Notification"** with `2`, Play Sound off.
30. **Add "Wait"**, 1 second.
31. **Add "Show Notification"** with `1`, Play Sound off.
32. **Add "Wait"**, 1 second.

---

## Part 7: Play the song

33. **Add "URL".** Type `https://music.youtube.com/watch?v=` and then put in the
    **`[VideoID]`** bubble right after the `=`, with no space.
34. **Add "Open URLs".** It should say *Open **URL***. This opens YouTube Music and
    the song starts.

Tap **Done** in the top right. Your shortcut is saved.

---

## Part 8: One-time setup on the phone

- **Allow the countdown banners:** open the iPhone **Settings** app → **Notifications**
  → **Shortcuts** → switch **Allow Notifications** on. Without this, the 3-2-1 doesn't
  show (the song still plays).
- **The first run asks permission.** It will ask whether SongScan may connect to
  `github.io`, and whether it may open YouTube Music. Choose **Always Allow** both times
  so it never asks again in the middle of a game.
- **Put it on your home screen:** in the Shortcuts app, press and hold the SongScan
  tile → **Share** → **Add to Home Screen**.
- **Optional, start it by tapping the back of the phone:** Settings → Accessibility →
  Touch → **Back Tap** → **Double Tap** → choose **SongScan**.
- **Give it to friends:** press and hold the SongScan tile → **Share** → **Copy iCloud
  Link**, and send them the link. They need YouTube Music with Premium too.

---

## Part 9: Test it

1. Scan a QR code that isn't a SongScan card (a Wi-Fi code, a menu). You should see
   *Not a SongScan card*, and nothing plays.
2. Scan each test card (0001 to 0010) in turn. You should see 3, 2, 1 at the top of
   the screen, then YouTube Music opens and plays with no extra tapping. Write down any
   ad, any extra tap you needed, and any card that didn't work.
3. Run it again while a song is playing. The song should pause before the camera opens.
4. Turn on Airplane Mode and scan a card. Write down what message appears. That
   message comes from Apple, not from us.

**Watch out:** YouTube Music shows the song's name the moment it opens. If someone is
watching the 3-2-1, they'll see the name unless the phone goes face down on "1".

---

## If something goes wrong

| What you see | What's probably wrong |
|---|---|
| **does not contain** isn't in the list (step 7) | The If's Input isn't the **`[Text]`** bubble. Redo step 5, then pick that bubble. |
| *Not a SongScan card* on a real card | The If says `qsl:` (letter L) instead of `qs1:` (number one), or there's a space in it. |
| *Card not in this deck…* on every card | Check the URL in step 17 letter by letter (including the capital **D** in `familyDisco` and the `.json` ending). Check that step 20's Key is the **`[Card]`** bubble, not the typed word "Card". |
| A box asks you to choose something, or shows a list | One of the Get Dictionary Value steps is reading the wrong bubble. Check the last part of steps 19, 20 and 21. |
| YouTube Music opens but plays nothing | Step 33 needs the **`[VideoID]`** bubble right after `v=`, with no space. |
| No 3-2-1 banners | Notifications for Shortcuts are switched off (see Part 8). |
| An action ended up in the wrong place | Press and hold it and drag it. Indented means it's inside the If above it. |

**Tip for finding a problem:** add a **Show Result** action anywhere, put a bubble in
it (for example **`[Deck]`**), and press **▶**. It pops up whatever that step produced,
so you can see where things go wrong. Delete it when you're done.
