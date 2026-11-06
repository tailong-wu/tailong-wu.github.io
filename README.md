# tailong-wu.github.io

Personal portfolio: <https://tailong-wu.github.io/>

## Swarm-style entrance

A lightweight, dependency-free loading sequence designed for the existing bento layout:

1. Eighteen colored cursors orbit the **TW** monogram.
2. Cursors fan out to trace the actual visible cards, with temporary rulers, alignment guides, selection handles, and dimension badges.
3. Cards fill in, then Agents switch to an I-beam tool and type the headings, labels, and rich-text introduction character by character, with a blinking caret and brief punctuation pauses.
4. The original DOM remains in place to reserve exact line wrapping. Disposable typed copies are removed when finished, skipped, or interrupted; the original text, links, and event handlers are never replaced.

The original content, tab filtering, language/theme toggles, counters, links, and responsive layout remain intact. The original [business script](script.js) and [site stylesheet](styles.css) are unchanged.

### Preview locally

No install or build required. From this directory:

```sh
python3 -m http.server 4174 --bind 127.0.0.1
```

Open <http://127.0.0.1:4174/>. Refresh to replay the entrance.

### Behavior and safety

- About 4.2 seconds including character-by-character typing after DOM initialization; it never waits for the video iframe or third-party APIs. Chinese, emoji, and combining marks are typed as intact graphemes.
- **Skip intro**, Escape, keyboard navigation, or scrolling releases the page immediately.
- Honors the existing saved light/dark theme and English/Chinese language preference.
- `prefers-reduced-motion` skips the entrance; a mid-animation preference change also releases it immediately.
- Back/forward navigation does not replay it. No forced scroll reset or persistent focus trap.
- An independent 6.5-second head watchdog makes the page visible if the loader script fails.
- Missing loader CSS, runtime errors, a backgrounded page, or resize safely finish the intro.
- Existing card animations continue behind the reveal masks; no startup animation overrides remain afterward.

### Files

- [Page entry and fail-open bootstrap](index.html)
- [Cursor animation and cleanup](swarm-loader.js)
- [Scoped entrance styling](swarm-loader.css)
- [Local font CSS](fonts/fonts.css) and [font provenance](fonts/sources.json)
- [Dependency-free regression tests](tests/swarm-loader.test.cjs)

Inter 300/400/500/600/700 and Oleo Script 400/700 use the exact original Google Fonts files and Unicode ranges, now served locally. This avoids a blocking Google Fonts stylesheet delaying the intro. Font licenses: [Inter OFL](fonts/Inter-OFL.txt), [Oleo Script OFL](fonts/Oleo-Script-OFL.txt). The original Bilibili video embed still requires its external service.

### Run tests

Node.js 20+:

```sh
node --test tests/swarm-loader.test.cjs
node --check swarm-loader.js
```

Tests cover the independent watchdog, idempotent error cleanup, history/reduced-motion opt-out, theme precedence, unavailable storage, geometry, Unicode/grapheme typing and punctuation pacing, original source integrity, scoped CSS, and local font assets. Browser checks additionally cover desktop/mobile phases, both themes/languages, all tabs, keyboard controls, missing loader assets, script-disabled mode, scrolling, runtime failures, and restoring the original rich-text DOM and exact block dimensions after typing or interruption.

### Deployment

This remains a plain static GitHub Pages site; no package manager or build step was introduced. Publish the changed HTML, the two loader files, and the local fonts together. Keep the font license files with the assets.
