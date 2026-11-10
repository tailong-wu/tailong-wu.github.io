'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { clamp, copyFrameBox } = require('../swarm-loader.js');
const source = readFileSync(join(__dirname, '..', 'swarm-loader.js'), 'utf8');
function functionText(name, next) {
    const start = source.indexOf(`    function ${name}(`);
    const end = source.indexOf(`    function ${next}(`, start);
    assert.ok(start > 0 && end > start);
    return source.slice(start, end);
}
function node() {
    return { attributes: {}, dataset: {}, removed: false,
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() { this.removed = true; } };
}
function view() {
    return { shape: node(), rect: node(), badge: node(), handles: { querySelectorAll: () => [node(), node(), node(), node()] } };
}
function fixture() {
    const from = { state: 'drawing', clock: 200, duration: 610,
        box: { x: 20, y: 100, width: 300, height: 240, radius: 24 } };
    const carrier = { x: 320, y: 100, index: 3 };
    const target = { id: 'target', state: 'copying', hidden: false, copySource: from, copyPhase: 'waiting',
        copyClock: 0, copyWait: 0, copyDuration: 820, copyGroup: node(), sourceShape: view(), copyShape: view(),
        carrier, box: { x: 650, y: 100, width: 300, height: 240, radius: 24 } };
    carrier.carry = target;
    let activations = 0;
    const sandbox = { target, targets: [target], cameraY: 0, clamp, copyFrameBox,
        activate: item => { activations++; item.state = 'drawing'; },
        completeTarget: item => { item.state = 'done'; } };
    vm.createContext(sandbox);
    for (const [name, next] of [['setGeometry', 'updateCaret'], ['setTransferGeometry', 'clearTransfer'],
        ['clearTransfer', 'beginTransfer'], ['updateTransfer', 'renderTransfers'], ['renderTransfers', 'completeTarget']]) {
        vm.runInContext(functionText(name, next), sandbox);
    }
    return { from, carrier, target, sandbox, activations: () => activations,
        update(delta) { sandbox.delta = delta; vm.runInContext('updateTransfer(target, delta)', sandbox); },
        render() { vm.runInContext('renderTransfers()', sandbox); } };
}
test('copy waits for the source outline instead of duplicating an unbuilt box', () => {
    const f = fixture();
    f.update(100);
    assert.equal(f.target.copyPhase, 'waiting');
    assert.equal(f.target.copyBox, undefined);
    assert.equal(f.activations(), 0);
    f.from.clock = 750;
    f.update(16);
    assert.equal(f.target.copyPhase, 'waiting');
    f.from.clock = 780;
    f.update(16);
    assert.equal(f.target.copyPhase, 'dragging');
    assert.equal(f.activations(), 0);
});
test('duplicate stays attached to the actual carrier and the original stays visible', () => {
    const f = fixture();
    f.from.state = 'done'; f.update(16); f.update(350);
    f.carrier.x = 507; f.carrier.y = 141;
    f.render();
    const box = f.target.copyShape.rect.attributes;
    assert.equal(box.x + box.width, f.carrier.x);
    assert.equal(box.y, f.carrier.y);
    assert.equal(f.target.sourceShape.shape.attributes.opacity, .8);
    assert.equal(f.target.sourceShape.rect.attributes.x, f.from.box.x);
    assert.equal(f.activations(), 0);
});
test('construction starts only after the carrier reaches the target and completes snap feedback', () => {
    const f = fixture();
    f.from.state = 'done'; f.update(16); f.update(820); f.render();
    assert.equal(f.target.copyPhase, 'dragging', 'clock alone cannot drop a frame that is still in flight');
    assert.equal(f.activations(), 0);
    f.carrier.x = f.target.box.x + f.target.box.width; f.carrier.y = f.target.box.y;
    f.render();
    assert.equal(f.target.copyPhase, 'snapping');
    f.update(100); f.render();
    assert.equal(f.activations(), 0);
    const group = f.target.copyGroup;
    f.update(80);
    assert.equal(f.activations(), 1);
    assert.equal(f.target.state, 'drawing');
    assert.equal(f.carrier.carry, null);
    assert.equal(group.removed, true);
});
test('scroll or reflow during snapping waits for the carrier to arrive at the new corner', () => {
    const f = fixture();
    f.from.state = 'done'; f.update(16); f.update(820);
    f.carrier.x = f.target.box.x + f.target.box.width; f.carrier.y = f.target.box.y;
    f.render(); assert.equal(f.target.copyPhase, 'snapping');
    f.target.box.y += 140;
    f.update(180); f.render();
    assert.equal(f.target.copyPhase, 'dragging');
    assert.equal(f.activations(), 0);
    assert.equal(f.target.copyShape.rect.attributes.y, f.carrier.y);
    f.carrier.y = f.target.box.y; f.render(); f.update(180);
    assert.equal(f.activations(), 1);
});

test('hidden source or timeout releases the carrier and removes all transfer geometry', () => {
    for (const cause of ['hidden', 'timeout']) {
        const f = fixture(), group = f.target.copyGroup;
        if (cause === 'hidden') f.from.hidden = true;
        else f.target.copyWait = 7001;
        f.update(16);
        assert.equal(f.activations(), 1);
        assert.equal(f.carrier.carry, null);
        assert.equal(group.removed, true);
    }
});
