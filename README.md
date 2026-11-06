# tailong-wu.github.io

Personal portfolio: <https://tailong-wu.github.io/>

## Scroll-driven Swarm construction

This is **not a timed splash screen**. Each section is constructed when scrolling reaches it:

1. Colored Agent cursors gather around the **TW** monogram.
2. Agents draw the cards currently in view, showing rulers, guides, selection handles and dimensions.
3. Cards fill in; Agents switch to I-beams and type headings, labels and rich text character by character.
4. Unvisited sections stay pending, even after the first screen has finished. Scrolling brings more work into the construction frontier.
5. Faster scrolling increases work tempo and worker count. Work above the viewport catches up quickly. Returning to an already completed card never rebuilds it.
6. After every section, including the footer, has been built, the animation removes itself.

Between sections, a small “Scroll to keep building” indicator remains. **Show all** reveals everything immediately.

The original content, tab filtering, language/theme toggles, counters, links and responsive layout are preserved. The original [business script](script.js) and [site stylesheet](styles.css) remain unchanged. Original rich-text nodes reserve the exact layout; only disposable, accessibility-hidden copies are typed.

### Preview locally

No install or build required:

```sh
python3 -m http.server 4174 --bind 127.0.0.1
```

Open <http://127.0.0.1:4174/>. Refresh to replay, then scroll down to construct the rest of the page.

### Behavior and safety

- Each card has its own work clock. There is no page-wide timer that reveals untouched sections.
- A monotonic scroll frontier admits visited content; visible work takes priority. Completed cards become interactive individually.
- Theme, language and category changes reconcile active work and geometry without revealing unvisited sections. Hidden categories are not incorrectly admitted as zero-height cards.
- The first screen retains the original 18-Agent orbit, fixed assignments, staggered flight, card tracing and real typing before scroll-driven work takes over. Opening progress UI stays out of the composition.
- Resizing, initial ResizeObserver delivery and late font reflow update outlines, typed-copy geometry and caret positions **without completing or restarting active work**. Only an explicit language replacement completes the affected active text jobs.
- Backgrounding pauses the engine. Returning does not consume the paused time as construction time.
- Idle scenes stop their animation loop; scrolling and pointer movement wake them again.
- Escape, **Show all**, or Tab accessibility navigation reveals the entire page. Space, Arrow Up/Down, Home/End and Page Up/Down remain construction-driving scroll controls.
- Reduced motion, missing assets, initialization errors and runtime errors fail open. Back/forward navigation does not replay the effect.
- A separate 6.5-second head watchdog protects startup only. Once the runtime takes over, it is cancelled: waiting below-fold content is not released by that timer.
- No forced scroll reset, permanent container-wide inert state, cloned business links, or external animation dependency.

### Files and diagnostics

- [Page entry and startup watchdog](index.html)
- [Scheduler, scroll frontier, Agent rendering and typing](swarm-loader.js)
- [Scoped construction styling](swarm-loader.css)
- [Local font CSS](fonts/fonts.css) and [font provenance](fonts/sources.json)
- [Regression tests](tests/swarm-loader.test.cjs)

While construction is active, `window.portfolioSwarm.snapshot()` reports the frontier, tempo, pending/active/completed counts and per-section clocks. `window.portfolioSwarm.showAll()` is the same explicit opt-out as the on-screen button.

Inter 300–700 and Oleo Script 400/700 use the original Google Fonts files and Unicode ranges, hosted locally. Font licenses: [Inter OFL](fonts/Inter-OFL.txt), [Oleo Script OFL](fonts/Oleo-Script-OFL.txt). The original Bilibili video embed still requires its external service, but never gates construction.

### Validation and deployment

```sh
node --test tests/swarm-loader.test.cjs
node --check swarm-loader.js
```

Tests cover frontier eligibility/priority, scroll-dependent tempo/workers, startup takeover, error cleanup, theme/history/reduced-motion handling, Unicode typing, geometry, source integrity and local fonts. Browser checks additionally verify that below-fold content stays pending beyond the old splash deadline, real scrolling starts new work, returning does not rebuild completed cards, fast scrolling catches up, and mobile/control/skip paths remain usable.

This remains a static GitHub Pages site with no build step. Publish the HTML, loader files and local fonts together; retain the font licenses. The loader asset URLs carry a release query (`v=intro-scroll-20261106-2`) so returning visitors do not reuse the old timed-intro scripts from the browser cache. Bump that query when shipping a new loader release.
