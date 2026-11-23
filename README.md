# quoted (web)

The web version of the quoted Hamlet quote tester, made so iPhone users can have it without the App Store.
Plain HTML, CSS and JavaScript with no build step. It works fully offline once opened, and keeps progress
in the browser's storage on that device.

It's a straight port of the Android app in `../quoted`: same quotes (`js/quotes.js` is generated from the
Android `quotes.json`), same marking, blanks, weak/mastered rules, Learn drill, day streak, look and wording.

**Left out:** the daily reminder. An iPhone can't schedule a notification from a web app without a server
sending push messages, so Settings only has Reset progress. Added instead: a dismissible "Add quoted to your
home screen" tip on Home when it's opened in a browser rather than from the home screen.

## Try it on this PC

```bash
node tools/serve.mjs          # http://localhost:8080
```

## Tests

```bash
npm install                   # once, for the browser test (playwright-core, uses the installed Chrome)
npm test                      # 39 logic tests, ported from the Android unit tests
node test/e2e.mjs             # clicks through every screen on a phone-sized Chrome, offline check included
```

## Changing things

| What | Where |
|------|-------|
| Quotes | Edit `../quoted/app/src/main/assets/quotes.json`, then `node tools/build-quotes.mjs` |
| Marking, blanks, progress, Learn, streak | `js/domain.js` (mirrors the Kotlin `domain/` files) |
| Saved progress | `js/store.js` (localStorage) |
| Screens | `js/home.js`, `js/test-screen.js`, `js/learn.js`, `js/other-screens.js` |
| Look | `styles.css` |

**After any change that's been put online, bump `VERSION` in `sw.js`**, or phones keep the old cached copy.

## Putting it online

Any static host works (GitHub Pages, Netlify, Cloudflare Pages): upload this folder minus `node_modules`,
`test` and `tools`. It must be served over https for offline mode and "Add to Home Screen" to work properly.

On iPhone: open the link in Safari → Share → Add to Home Screen. Opening it from the home screen icon also
stops Safari from clearing the saved progress after a week of not visiting.

## History

**2026-11-23**: Published on GitHub Pages: https://masterchefgng.github.io/quoted/ (repo `MasterChefGNG/quoted`).
To update it: commit, then `git push`; Pages redeploys in about a minute. Built and tested in phone-sized Chrome (every screen, a reload keeps progress, works offline).
Not yet tried on a real iPhone.
