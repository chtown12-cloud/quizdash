# ⚡ QuizDash

A serverless, Kahoot-style live quiz game in a **single HTML file** (`index.html`).
Host on a big screen, players join on their phones with a 4-letter room code.

## Quick start

- **Try it locally:** open `index.html` in a browser. In local demo mode, host and
  players are tabs of the same browser — perfect for testing the flow.
- **Real multiplayer:** the file is already pointed at the `quizdash-eba72` Firebase
  Realtime Database. Deploy `index.html` to any static host and players can join
  from any device.

## Deploy (pick one)

- **GitHub Pages:** repo Settings → Pages → deploy from branch → root. Done.
- **Netlify:** drag `index.html` into https://app.netlify.com/drop.

## Firebase notes

The config lives in the `FIREBASE_CONFIG` block near the bottom of `index.html`.
The `databaseURL` is what the game actually needs; `apiKey` / `appId` are still
placeholders — paste the real ones from Firebase console → Project settings →
General → Your apps if you ever add Firebase Auth or Analytics.

Make sure the Realtime Database rules allow read/write (test mode does, for 30
days). For a longer-lived deployment, scope the rules to the `/rooms` path:

```json
{
  "rules": {
    "rooms": { ".read": true, ".write": true },
    "$other": { ".read": false, ".write": false }
  }
}
```

## Writing a quiz

The paste format is documented on the host setup screen inside the app:

```
# Friday Team Quiz

## Q1 | 20s
What is the capital of France?
- Paris ✓
- London
- Berlin
- Madrid
```

Correct answers earn 500–1000 points scaled by speed; wrong answers earn 0.
