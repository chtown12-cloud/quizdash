# ⚡ QuizDash

A serverless, Kahoot-style live quiz game in a **single HTML file** (`index.html`).
Host on a big screen, players join on their phones with a 4-letter room code.

**▶ Play it live: https://quizdash-play.netlify.app**

## Quick start

- **Try it locally:** open `index.html` in a browser. In local demo mode, host and
  players are tabs of the same browser — perfect for testing the flow.
- **Real multiplayer:** the file is already pointed at the `quizdash-eba72` Firebase
  Realtime Database. Deploy `index.html` to any static host and players can join
  from any device.

## Hosting

Deployed on Netlify at **https://quizdash-play.netlify.app** — connected to
this repo's `main` branch, so every push redeploys automatically (free tier,
no build step: the repo root is served as-is).

Players rarely type the URL anyway — the host lobby shows a QR code that
opens the join page with the room code pre-filled.

## Firebase notes

The config lives in the `FIREBASE_CONFIG` block near the bottom of `index.html`.
The `databaseURL` is what the game actually needs; `apiKey` / `appId` are still
placeholders — paste the real ones from Firebase console → Project settings →
General → Your apps if you ever add Firebase Auth or Analytics.

**Set these database rules** (Firebase console → Realtime Database → Rules →
paste → Publish). Test mode expires after 30 days; these don't, and they limit
what can be written:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true,
        "players": {
          "$pid": {
            "name": { ".validate": "newData.isString() && newData.val().length <= 24" }
          }
        }
      }
    }
  }
}
```

## Security & privacy

- **What's collected:** a self-chosen nickname and answer taps. No accounts,
  no email, no cookies, no analytics, no tracking.
- **Nothing is kept:** the room (nicknames, answers, scores) is erased from
  Firebase automatically when the host closes the tab after the podium, when
  the host clicks "Play again", or instantly via the "🧹 Erase game data"
  button. Players' browsers keep nothing either — the temporary player id
  lives in sessionStorage and is dropped at the podium.
- **Player devices:** the page ships a Content-Security-Policy that only
  permits Google Fonts, the Firebase SDK, and this game's own database — any
  injected script or call to another server is blocked by the browser. All
  player-provided text (nicknames, etc.) is HTML-escaped before rendering,
  and values read back from the database are type-coerced.
- **Third parties that see players' IP addresses:** Google Fonts (font files)
  and Firebase (the game data itself) — standard for any website, no cookies
  involved. Your static host (Netlify/GitHub Pages) serves the page, as any
  web host does.
- **Honest limits:** rooms are open to anyone who knows the 4-letter code
  while a game is live (that's the design — no accounts), and scoring trusts
  each phone's reported speed. Fine for a party game; not built for money
  prizes.

## Writing a quiz

The paste format is documented on the host setup screen inside the app:

```
# Friday Team Quiz

## Q1 | 20s
What is the capital of France?
- Paris *
- London
- Berlin
- Madrid
```

Mark the correct answer with a trailing `*` (a `✓` also works).
Correct answers earn 500–1000 points scaled by speed; wrong answers earn 0.
