const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { clamp, ease, lerp, perimeterPoint, splitText, typingPlan, typingCount, inView, scrollTempo, workerCount, eligibleTargets, copyFrameBox, COLORS, ORBIT_MS, BUILD_MS, OUTRO_MS } = require('../swarm-loader.js');
const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const bootstrap = html.match(/<script id="swarm-bootstrap">([\s\S]*?)<\/script>/)[1];

function bootFixture({ theme = null, systemDark = false, reduced = false, navigation = 'navigate', storageThrows = false } = {}) {
    const classes = new Set();
    const attributes = new Map();
    const timers = new Map();
    const events = [];
    let timerId = 0, removed = 0;
    const documentElement = {
        dataset: {},
        classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)) },
        setAttribute: (name, value) => attributes.set(name, value)
    };
    const sandbox = {
        document: {
            documentElement,
            getElementById: () => ({ remove: () => { removed += 1; } }),
            querySelectorAll: () => []
        },
        localStorage: { getItem: () => { if (storageThrows) throw new Error('Storage denied'); return theme; } },
        matchMedia: query => ({ matches: query.includes('reduced-motion') ? reduced : systemDark }),
        performance: { now: () => 100, getEntriesByType: () => [{ type: navigation }] },
        setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
        clearTimeout: id => timers.delete(id),
        Event: class { constructor(type) { this.type = type; } },
        dispatchEvent: event => events.push(event.type)
    };
    sandbox.window = sandbox;
    vm.runInNewContext(bootstrap, sandbox);
    return { sandbox, classes, attributes, timers, events, removed: () => removed };
}

test('head hook opts in and provides an independent bounded fail-open watchdog', () => {
    const fixture = bootFixture();
    assert.ok(fixture.classes.has('swarm-loading'));
    assert.equal(fixture.timers.size, 1);
    const watchdog = [...fixture.timers.values()][0];
    assert.equal(watchdog.delay, 6500);
    let restored = 0;
    fixture.sandbox.__portfolioSwarm.restore = () => { restored += 1; };
    watchdog.callback();
    assert.equal(fixture.classes.size, 0);
    assert.equal(fixture.sandbox.document.documentElement.dataset.swarmState, 'timeout');
    assert.equal(fixture.timers.size, 0);
    assert.equal(restored, 1);
    assert.equal(fixture.removed(), 1);
    assert.deepEqual(fixture.events, ['swarm:finished']);
});

test('runtime takeover cancels only the startup timer and keeps unvisited content pending', () => {
    const fixture = bootFixture();
    const boot = fixture.sandbox.__portfolioSwarm;
    boot.takeOver();
    assert.equal(boot.active, true);
    assert.equal(boot.done, false);
    assert.equal(fixture.timers.size, 0);
    assert.ok(fixture.classes.has('swarm-loading'));
    boot.release('skipped');
    assert.equal(fixture.classes.size, 0);
});

test('scroll frontier admits only visited, non-hidden targets and prioritizes the viewport', () => {
    const item = (id, y, extra = {}) => ({ id, state: 'pending', box: { x: 0, y, width: 300, height: 200 }, ...extra });
    const targets = [item('above', 0), item('visible', 600), item('future', 1600),
        item('done', 650, { state: 'done' }), item('filtered', 650, { hidden: true })];
    assert.deepEqual(eligibleTargets(targets, 900, 500, 900, 1).map(x => x.id), ['visible']);
    assert.deepEqual(eligibleTargets(targets, 900, 500, 900, 8).map(x => x.id), ['visible', 'above']);
    assert.deepEqual(eligibleTargets([targets[2]], 900, 500, 900), []);
    assert.deepEqual(eligibleTargets(targets, 900, 500, 900, 0), []);
    assert.equal(inView({ y: 900, height: 100 }, 500, 900), false);
    assert.equal(inView({ y: 899, height: 100 }, 500, 900), true);
    // Merely waiting does not change eligibility; a new scroll frontier must admit the next section.
    assert.deepEqual(eligibleTargets([targets[2]], 900, 500, 900), []);
    assert.equal(eligibleTargets([targets[2]], 1900, 1500, 1900).length, 1);
});

test('fast scrolling adds workers and speeds work without unbounded animation rates', () => {
    assert.equal(scrollTempo(0), 1);
    assert.ok(scrollTempo(2400) > scrollTempo(300));
    assert.equal(scrollTempo(-2400), scrollTempo(2400));
    assert.ok(scrollTempo(100000) <= 3.8);
    assert.equal(workerCount(0, 0), 6);
    assert.ok(workerCount(2400, 4) > workerCount(0, 4));
    assert.equal(workerCount(100000, 100), 30);
});

test('cleanup is idempotent and survives a failing optional restore callback', () => {
    const fixture = bootFixture();
    fixture.sandbox.__portfolioSwarm.restore = () => { throw new Error('Unexpected DOM failure'); };
    fixture.sandbox.__portfolioSwarm.release('skipped');
    fixture.sandbox.__portfolioSwarm.release('complete');
    assert.equal(fixture.classes.size, 0);
    assert.equal(fixture.removed(), 1);
    assert.equal(fixture.sandbox.document.documentElement.dataset.swarmState, 'skipped');
    assert.equal(fixture.timers.size, 0);
});

test('reduced motion and restored history never hide content or start a timeout', () => {
    for (const options of [{ reduced: true }, { navigation: 'back_forward' }]) {
        const fixture = bootFixture(options);
        assert.equal(fixture.classes.size, 0);
        assert.equal(fixture.timers.size, 0);
        assert.equal(fixture.sandbox.__portfolioSwarm, undefined);
        assert.ok(['reduced', 'restored'].includes(fixture.sandbox.document.documentElement.dataset.swarmState));
    }
});

test('initial theme respects saved light over system dark and saved dark over system light', () => {
    assert.equal(bootFixture({ theme: 'light', systemDark: true }).attributes.has('data-theme'), false);
    assert.equal(bootFixture({ theme: 'dark', systemDark: false }).attributes.get('data-theme'), 'dark');
    assert.equal(bootFixture({ systemDark: true }).attributes.get('data-theme'), 'dark');
    assert.equal(bootFixture({ systemDark: false }).attributes.has('data-theme'), false);
});

test('unavailable storage cannot prevent the fail-open watchdog', () => {
    const fixture = bootFixture({ storageThrows: true });
    assert.ok(fixture.classes.has('swarm-loading'));
    assert.equal(fixture.timers.size, 1);
    [...fixture.timers.values()][0].callback();
    assert.equal(fixture.classes.size, 0);
});

test('animation helpers are bounded and end at the correct values', () => {
    assert.equal(clamp(-10), 0); assert.equal(clamp(10), 1);
    assert.equal(clamp(4, 2, 3), 3);
    assert.equal(ease(-1), 0); assert.equal(ease(0), 0); assert.equal(ease(1), 1); assert.equal(ease(2), 1);
    assert.equal(lerp(10, 30, 0.5), 20);
    assert.ok(ORBIT_MS + BUILD_MS + OUTRO_MS < 6500);
    assert.equal(COLORS.length, 12);
});

test('duplicate animation timestamps retain a scheduled frame instead of parking the swarm', () => {
    const source = readFileSync(join(root, 'swarm-loader.js'), 'utf8');
    const start = source.indexOf('    function tick(now) {');
    const end = source.indexOf('        const motionDelta =', start);
    assert.ok(start > 0 && end > start);
    const prefix = source.slice(start, end) + '\n}';
    for (const options of [{ ended: false, hidden: false }, { ended: true, hidden: false }, { ended: false, hidden: true }]) {
        let scheduled = 0;
        const sandbox = { ended: options.ended, document: { hidden: options.hidden }, frame: 7,
            now: 100, motionFrame: 100, requestAnimationFrame: callback => { scheduled += 1; assert.equal(callback.name, 'tick'); return 42; } };
        vm.runInNewContext(`(${prefix})(now)`, sandbox);
        const active = !options.ended && !options.hidden;
        assert.equal(scheduled, active ? 1 : 0);
        assert.equal(sandbox.frame, active ? 42 : 0);
    }
});

test('font and resize notifications preserve active animation clocks; only replaced text completes work', () => {
    const source = readFileSync(join(root, 'swarm-loader.js'), 'utf8');
    const start = source.indexOf('    function requestLayout(');
    const end = source.indexOf('    function setGeometry(', start);
    assert.ok(start > 0 && end > start);
    const layout = source.slice(start, end).trim();
    for (const reason of [undefined, 'geometry', { type: 'resize' }, [{ contentRect: {} }], 'content']) {
        let completed = 0, wakes = 0;
        const targets = [{ state: 'drawing', clock: 350 }, { state: 'typing', clock: 1300 }, { state: 'pending', clock: 0 }];
        const sandbox = { ended: false, targets, reason, geometryDirty: false, resetFrontier: false,
            completeTarget: target => { completed += 1; target.state = 'done'; }, wake: () => { wakes += 1; } };
        vm.runInNewContext(`(${layout})(reason)`, sandbox);
        assert.equal(completed, reason === 'content' ? 2 : 0);
        assert.deepEqual(targets.map(target => target.clock), [350, 1300, 0]);
        assert.equal(targets[2].state, 'pending');
        assert.equal(sandbox.geometryDirty, true);
        assert.equal(sandbox.resetFrontier, true);
        assert.equal(wakes, 1);
    }
    for (const font of ['inter-latin.woff2', 'oleo-script-400-latin.woff2', 'oleo-script-700-latin.woff2']) {
        assert.ok(html.includes(`href="fonts/${font}" crossorigin`));
    }
});

test('typewriter preserves Chinese, combining marks, emoji, and original whitespace', () => {
    const text = '你好，Tailong! e\u0301 👩‍🔬 🇨🇳\n';
    const units = splitText(text);
    assert.equal(units.join(''), text);
    assert.ok(units.includes('e\u0301'));
    assert.ok(units.includes('👩‍🔬'));
    assert.ok(units.includes('🇨🇳'));
    const plan = typingPlan(units);
    assert.equal(typingCount(plan, 0), 0);
    assert.equal(typingCount(plan, 1), units.length);
    assert.equal(typingCount(plan, 2), units.length);
    let previous = 0;
    for (let tick = 0; tick <= 100; tick++) {
        const count = typingCount(plan, tick / 100);
        assert.ok(count >= previous && count <= units.length);
        previous = count;
    }
});

test('typewriter pauses at punctuation without skipping final characters', () => {
    const plan = typingPlan(splitText('A,B'));
    assert.deepEqual(plan.stops, [1, 3.8, 4.8]);
    assert.equal(typingCount(plan, .5), 1);
    assert.equal(typingCount(plan, 1), 3);
    assert.equal(typingCount(typingPlan([]), 1), 0);
});

test('copy-frame interpolation lifts, scales, and lands exactly on the target frame', () => {
    const from = { x: 20, y: 80, width: 120, height: 90, radius: 18 };
    const to = { x: 620, y: 240, width: 360, height: 260, radius: 32 };
    const start = copyFrameBox(from, to, 0);
    const middle = copyFrameBox(from, to, .5);
    const end = copyFrameBox(from, to, 1);
    assert.deepEqual(start, from);
    assert.deepEqual(end, to);
    assert.ok(middle.x > from.x && middle.x < to.x);
    assert.ok(middle.y < lerp(from.y, to.y, ease(.5)), 'copy should arc upward while dragging');
    assert.ok(middle.width > from.width && middle.width < to.width);
    assert.ok(middle.height > from.height && middle.height < to.height);
    for (const progress of [-1, 0, .25, .5, .75, 1, 2]) {
        const box = copyFrameBox(from, to, progress);
        for (const value of Object.values(box)) assert.ok(Number.isFinite(value));
    }
});

test('rounded-card tracing stays on every perimeter, including degenerate rectangles', () => {
    for (const box of [
        { x: 24, y: 100, width: 520, height: 390, radius: 32 },
        { x: 0, y: 0, width: 300, height: 48, radius: 100 },
        { x: -10, y: -20, width: 10, height: 20, radius: 0 },
        { x: 5, y: 6, width: 0, height: 0, radius: 2 }
    ]) {
        for (let step = 0; step <= 100; step++) {
            const point = perimeterPoint(box, step / 100);
            assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.angle));
            assert.ok(point.x >= box.x - 1e-6 && point.x <= box.x + box.width + 1e-6);
            assert.ok(point.y >= box.y - 1e-6 && point.y <= box.y + box.height + 1e-6);
        }
        const first = perimeterPoint(box, 0), last = perimeterPoint(box, 1);
        assert.ok(Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6);
    }
});

test('original portfolio business logic and styling are unchanged', () => {
    const hash = filename => createHash('sha256').update(readFileSync(join(root, filename))).digest('hex');
    assert.equal(hash('script.js'), '385903ffd5efe3a602ff7f0df40e1e4b7ef28ce107ffcf010dbb18393b0210f0');
    assert.equal(hash('styles.css'), '0362b44ca5973bc3ef8ed62fb99708f5a379ccd674263a8af05340252ed38783');
    assert.match(html, /<script src="swarm-loader\.js\?v=copy-drag-20261110-1" defer><\/script>/);
    assert.match(html, /<link rel="stylesheet" href="swarm-loader\.css\?v=copy-drag-20261110-1">/);
    assert.match(html, /<script src="script\.js"><\/script>/);
    const loader = readFileSync(join(root, 'swarm-loader.js'), 'utf8');
    const loaderCss = readFileSync(join(root, 'swarm-loader.css'), 'utf8');
    assert.match(loader, /function beginTransfer\(target, source/);
    assert.match(loader, /copyFrameBox\(source\.box, target\.box/);
    assert.match(loaderCss, /\.swarm-copy-frame/);
    assert.match(loaderCss, /\.swarm-copy-handle/);
});

test('all original font faces are available locally with their licenses', () => {
    const css = readFileSync(join(root, 'fonts/fonts.css'), 'utf8');
    const sources = [...css.matchAll(/url\(([^)]+)\)/g)].map(match => match[1]);
    assert.equal(sources.length, 39);
    assert.equal(new Set(sources).size, 11);
    for (const source of new Set(sources)) {
        assert.ok(source.startsWith('./'));
        assert.equal(readFileSync(join(root, 'fonts', source.slice(2))).subarray(0, 4).toString(), 'wOF2');
    }
    assert.doesNotMatch(css, /url\(https?:/);
    assert.doesNotMatch(html, /<link[^>]+https:\/\/fonts\./);
    for (const license of ['Inter-OFL.txt', 'Oleo-Script-OFL.txt']) {
        assert.match(readFileSync(join(root, 'fonts', license), 'utf8'), /SIL OPEN FONT LICENSE/);
    }
});

test('reduced-motion CSS explicitly reveals cards, and normal overrides are startup-scoped', () => {
    const css = readFileSync(join(root, 'swarm-loader.css'), 'utf8');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(reduced, /opacity: 1 !important/);
    assert.match(reduced, /transform: none !important/);
    assert.match(reduced, /clip-path: none !important/);
    assert.match(css, /html\.swarm-loading \.bento-card/);
    const js = readFileSync(join(root, 'swarm-loader.js'), 'utf8');
    assert.doesNotMatch(js, /fetch\(|scrollTo\(|localStorage\.setItem/);
});
