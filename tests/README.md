# Tests

Browser tests that play QuizDash end to end, with a big screen and phones
in one browser (demo mode, no Firebase). Each prints `PASS` / `FAIL` lines.

```
npx http-server . -p 8123 -s -c-1      # in the repo folder, left running
tests/run.sh                           # all of them
tests/run.sh switch read               # just these
```

They use [Playwright](https://playwright.dev) with Chromium. Screenshots and
logs land in `tests/out/`, which isn't committed.
