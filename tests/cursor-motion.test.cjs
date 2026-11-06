'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { advanceCursor, turnAngle, wanderPoint } = require('../swarm-loader.js');

const DEFAULTS = { response: 12, maxSpeed: 1600, maxAcceleration: 7000 };
const EPSILON = 1e-7;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const speed = state => Math.hypot(state.vx, state.vy);
const angleDelta = (from, to) => ((to - from + 180) % 360 + 360) % 360 - 180;

function finiteState(state, context) {
    for (const key of ['x', 'y', 'vx', 'vy']) {
        assert.ok(Number.isFinite(state[key]), `${context}: ${key} must be finite, got ${state[key]}`);
    }
}

function closeState(actual, expected, context) {
    finiteState(actual, context);
    for (const key of ['x', 'y', 'vx', 'vy']) {
        assert.ok(Math.abs(actual[key] - expected[key]) <= EPSILON,
            `${context}: ${key} should be ${expected[key]}, got ${actual[key]}`);
    }
}

function boundedStep(previous, next, seconds, options = DEFAULTS, context = 'step') {
    const dt = Math.max(0, Math.min(0.05, seconds));
    finiteState(next, context);
    assert.ok(speed(next) <= options.maxSpeed + EPSILON,
        `${context}: vector speed ${speed(next)} exceeds ${options.maxSpeed}`);
    const velocityChange = Math.hypot(next.vx - previous.vx, next.vy - previous.vy);
    assert.ok(velocityChange <= options.maxAcceleration * dt + EPSILON,
        `${context}: velocity change ${velocityChange} exceeds acceleration budget ${options.maxAcceleration * dt}`);
    assert.ok(distance(previous, next) <= options.maxSpeed * dt + EPSILON,
        `${context}: position moved farther than the speed budget`);
}

function assertInViewport(point, width, height, context) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${context}: finite position`);
    assert.ok(point.x >= -EPSILON && point.x <= width + EPSILON,
        `${context}: x=${point.x} outside [0, ${width}]`);
    assert.ok(point.y >= -EPSILON && point.y <= height + EPSILON,
        `${context}: y=${point.y} outside [0, ${height}]`);
}

test('motion helpers are available as DOM-free CommonJS exports', () => {
    assert.equal(typeof advanceCursor, 'function');
    assert.equal(typeof turnAngle, 'function');
    assert.equal(typeof wanderPoint, 'function');
});

test('zero and negative elapsed time preserve cursor position and retained velocity', () => {
    const state = { x: 123, y: -87, vx: 320, vy: -140 };
    const goal = { x: -4000, y: 8000 };
    for (const seconds of [0, -1 / 60, -1000]) {
        closeState(advanceCursor({ ...state }, goal, seconds), state, `dt=${seconds}`);
    }
});

test('long frame gaps are clamped to a single 50ms motion step', () => {
    const state = { x: 51, y: 72, vx: 280, vy: -190 };
    const goal = { x: 900, y: -600 };
    const expected = advanceCursor({ ...state }, goal, 0.05);
    for (const seconds of [0.051, 0.5, 10, 1e6]) {
        const actual = advanceCursor({ ...state }, goal, seconds);
        closeState(actual, expected, `dt=${seconds} clamps to 0.05`);
        boundedStep(state, actual, seconds, DEFAULTS, `long gap ${seconds}`);
    }
});

test('a large diagonal target jump accelerates toward it instead of snapping', () => {
    const state = { x: -40, y: 75, vx: 0, vy: 0 };
    const goal = { x: 12000, y: -9000 };
    const dt = 1 / 60;
    const next = advanceCursor({ ...state }, goal, dt);
    boundedStep(state, next, dt);
    assert.ok(distance(state, next) > 0, 'the cursor must start moving');
    assert.ok(distance(state, next) <= DEFAULTS.maxAcceleration * dt * dt + EPSILON,
        'movement from rest must respect the acceleration budget, not just speed');
    assert.ok(distance(next, goal) > 10000, 'a distant target cannot become the displayed position in one frame');
    assert.ok(next.vx > 0 && next.vy < 0, 'acceleration must point toward the diagonal target');
});

test('vector speed and acceleration stay capped through distant goals and abrupt reversals', () => {
    for (const options of [DEFAULTS, { response: 9, maxSpeed: 260, maxAcceleration: 480 }]) {
        let state = { x: 0, y: 0, vx: 0, vy: 0 };
        let fastest = 0;
        const goals = [
            { x: 20000, y: 15000 }, { x: -18000, y: -22000 },
            { x: 20000, y: -16000 }, { x: 0, y: 0 }
        ];
        const frameTimes = [1 / 240, 1 / 120, 1 / 60, 1 / 30, 0.05, 0.5];
        for (let frame = 0; frame < 720; frame++) {
            const dt = frameTimes[frame % frameTimes.length];
            const previous = { ...state };
            const goal = goals[Math.floor(frame / 180)];
            state = advanceCursor({ ...state }, goal, dt, options);
            boundedStep(previous, state, dt, options, `frame ${frame}, maxSpeed ${options.maxSpeed}`);
            fastest = Math.max(fastest, speed(state));
        }
        assert.ok(fastest > options.maxSpeed * 0.9, 'caps must limit genuine pursuit, not suppress all movement');
    }
});

test('changing a target preserves momentum and smoothly reverses the existing velocity', () => {
    const dt = 1 / 120;
    let state = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let frame = 0; frame < 48; frame++) {
        state = advanceCursor({ ...state }, { x: 10000, y: 0 }, dt);
    }
    assert.ok(state.vx > 600, 'establish meaningful forward velocity before switching tasks');
    const previous = { ...state };
    const goal = { x: -10000, y: 0 };
    state = advanceCursor({ ...state }, goal, dt);
    boundedStep(previous, state, dt, DEFAULTS, 'first frame after target switch');
    assert.ok(state.vx > 0, 'target reassignment cannot reset or instantly reverse momentum');
    assert.ok(state.x > previous.x, 'the rendered position initially continues along its retained velocity');
    assert.ok(state.vx < previous.vx, 'the new target must begin decelerating the previous motion');
    for (let frame = 0; frame < 120; frame++) {
        const before = { ...state };
        state = advanceCursor({ ...state }, goal, dt);
        boundedStep(before, state, dt, DEFAULTS, `reversal frame ${frame}`);
    }
    assert.ok(state.vx < 0 && state.x < previous.x, 'bounded deceleration must eventually turn toward the new target');
});

test('a stationary goal is approached and settles rather than leaving residual drift', () => {
    const goal = { x: 340, y: -160 };
    let state = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let frame = 0; frame < 480; frame++) {
        const previous = { ...state };
        state = advanceCursor({ ...state }, goal, 1 / 120);
        boundedStep(previous, state, 1 / 120, DEFAULTS, `settling frame ${frame}`);
    }
    assert.ok(distance(state, goal) < 0.1, `stationary target error is ${distance(state, goal)}px`);
    assert.ok(speed(state) < 0.1, `settled speed is ${speed(state)}px/s`);
});

test('60Hz and 120Hz follow approximately the same moving-target trajectory', () => {
    const targetAt = seconds => ({
        x: 500 + 180 * Math.sin(seconds * 1.3),
        y: 350 + 140 * Math.cos(seconds * 0.9)
    });
    function trajectory(hz) {
        let state = { x: 100, y: 100, vx: 0, vy: 0 };
        const samples = [];
        for (let frame = 1; frame <= hz * 2; frame++) {
            state = advanceCursor({ ...state }, targetAt(frame / hz), 1 / hz);
            finiteState(state, `${hz}Hz frame ${frame}`);
            if (frame % (hz / 10) === 0) samples.push({ ...state });
        }
        return samples;
    }
    const at60 = trajectory(60), at120 = trajectory(120);
    const finalError = distance(at60.at(-1), at120.at(-1));
    assert.ok(finalError <= 10, `position disagreement after 2s is ${finalError}px (limit 10px)`);
    const meanError = at60.reduce((sum, state, index) => sum + distance(state, at120[index]), 0) / at60.length;
    assert.ok(meanError <= 10, `mean disagreement along the trajectory is ${meanError}px (limit 10px)`);
});

test('long-running pursuit remains finite under irregular frames and large finite target outliers', () => {
    let state = { x: -120, y: 90, vx: 350, vy: -220 };
    const times = [0, -0.1, 1 / 240, 1 / 120, 1 / 60, 0.03, 0.05, 2];
    for (let frame = 0; frame < 2400; frame++) {
        const dt = times[frame % times.length];
        const goal = frame % 17 === 0
            ? { x: (frame % 2 ? -1 : 1) * 1e9, y: -1e9 }
            : { x: Math.sin(frame * 0.05) * 1200, y: Math.cos(frame * 0.03) * 900 };
        const previous = { ...state };
        state = advanceCursor({ ...state }, goal, dt);
        boundedStep(previous, state, dt, DEFAULTS, `irregular frame ${frame}`);
    }
});

test('angular turning follows the shortest arc across wrap boundaries and bounds every step', () => {
    const pairs = [[350, 10], [10, 350], [179, -179], [-179, 179],
        [1430, -710], [-1070, 1070], [0, 180], [180, 0]];
    for (const [current, target] of pairs) {
        for (const seconds of [0, 1 / 240, 1 / 120, 1 / 60, 0.05]) {
            const next = turnAngle(current, target, seconds);
            assert.ok(Number.isFinite(next), `finite rotation from ${current} to ${target}`);
            const desired = angleDelta(current, target), actual = angleDelta(current, next);
            assert.ok(Math.abs(actual) <= 360 * seconds + EPSILON,
                `${current} -> ${target}: angular step ${actual} exceeds 360deg/s`);
            assert.ok(Math.abs(actual) <= Math.abs(desired) + EPSILON, 'turn cannot overshoot the target');
            if (Math.abs(desired) < 180 - EPSILON && Math.abs(actual) > EPSILON) {
                assert.equal(Math.sign(actual), Math.sign(desired), 'turn must take the shortest angular direction');
            }
            assert.ok(Math.abs(angleDelta(next, target)) <= Math.abs(desired) + EPSILON,
                'turning must not increase the remaining shortest-arc distance');
            if (Math.abs(desired) > EPSILON && seconds > 0) {
                assert.ok(Math.abs(actual) > 0, 'a nonzero available turn step must make progress');
            }
        }
    }
});

test('angular turning converges to close targets without overshoot and ignores nonpositive dt', () => {
    for (const [current, target] of [[359, 1], [1, 359], [-179, 179], [1082, -721]]) {
        let angle = current;
        for (let frame = 0; frame < 120; frame++) {
            const next = turnAngle(angle, target, 1 / 60);
            assert.ok(Math.abs(angleDelta(next, target)) <= Math.abs(angleDelta(angle, target)) + EPSILON,
                `${current} -> ${target}: a close target must not be overshot`);
            angle = next;
        }
        // Capped turning may ease into a target; exact one-frame arrival is not required.
        assert.ok(Math.abs(angleDelta(angle, target)) <= EPSILON, `${current} -> ${target}: close target should converge`);
        for (const dt of [0, -1 / 60, -1]) {
            assert.ok(Math.abs(angleDelta(current, turnAngle(current, target, dt))) <= EPSILON,
                'nonpositive elapsed time cannot rotate the cursor');
        }
    }
});

const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'wide desktop', width: 1920, height: 1080 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small mobile', width: 320, height: 568 }
];

for (const { name, width, height } of viewports) {
    test(`idle wandering remains bounded and moving on ${name}, including offscreen pointer outliers`, () => {
        const pointers = [null, { x: width / 2, y: height / 2 },
            { x: -1e9, y: -1e9 }, { x: 1e9, y: 1e9 }, { x: 1e9, y: -1e9 }];
        for (let index = 0; index < 12; index++) {
            for (const pointer of pointers) {
                let previous = wanderPoint(index, 0, width, height, pointer);
                assertInViewport(previous, width, height, `${name}, cursor ${index}, initial`);
                let totalTravel = 0;
                for (let sample = 1; sample <= 120; sample++) {
                    const seconds = sample / 4;
                    const point = wanderPoint(index, seconds, width, height, pointer);
                    const context = `${name}, cursor ${index}, t=${seconds}, pointer=${JSON.stringify(pointer)}`;
                    assertInViewport(point, width, height, context);
                    const travel = distance(previous, point);
                    assert.ok(travel > 1e-6, `${context}: idle cursor cannot remain parked between samples`);
                    totalTravel += travel;
                    previous = point;
                }
                assert.ok(totalTravel > 1, `${name}, cursor ${index}: wandering must produce visible motion over 30s`);
            }
        }
    });
}

test('idle wander has no discontinuities at clock boundaries or during long-running animation', () => {
    const times = [-10, 0, 0.999999, 1, 2.999999, 3, 9.999999, 10, 59.999999, 60, 600, 3600];
    for (const { name, width, height } of viewports) {
        for (const index of [0, 1, 5, 11, 29]) {
            for (const pointer of [null, { x: 1e9, y: -1e9 }]) {
                for (const seconds of times) {
                    const before = wanderPoint(index, seconds - 1e-6, width, height, pointer);
                    const after = wanderPoint(index, seconds + 1e-6, width, height, pointer);
                    const context = `${name}, cursor ${index}, t=${seconds}`;
                    assertInViewport(before, width, height, context);
                    assertInViewport(after, width, height, context);
                    assert.ok(distance(before, after) < 0.05,
                        `${context}: a two-microsecond interval must not jump ${distance(before, after)}px`);
                }
            }
        }
    }
});
