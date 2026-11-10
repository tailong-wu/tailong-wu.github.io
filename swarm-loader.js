/* Scroll-driven collaborative construction for Tailong Wu's portfolio. */
(() => {
    'use strict';

    const COLORS = ['#F24E1E', '#A259FF', '#1ABCFE', '#0ACF83', '#FF7262', '#FFC700',
        '#9747FF', '#E8467C', '#14AE5C', '#0D99FF', '#FF8A00', '#00B5CE'];
    const ARROW = 'M4.6 3.9C4.2 3.1 4.9 2.4 5.7 2.8L20.6 9.4C21.5 9.8 21.4 11.1 20.4 11.3L13.9 12.9C13.4 13 13 13.4 12.9 13.9L11.3 20.4C11.1 21.4 9.8 21.5 9.4 20.6Z';
    const IBEAM = 'M8 4H10Q12 4 12 6Q12 4 14 4H16M12 6V20M8 22H10Q12 22 12 20Q12 22 14 22H16';
    const ORBIT_MS = 700;
    const BUILD_MS = 3300; // A single card's work budget, never a page-wide reveal timer.
    const OUTRO_MS = 240;
    const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
    const ease = value => 1 - (1 - clamp(value)) ** 3;
    const lerp = (from, to, progress) => from + (to - from) * progress;
    const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const splitText = text => segmenter ? Array.from(segmenter.segment(text), item => item.segment) : Array.from(text);

    function typingPlan(units) {
        let weight = 0;
        const stops = units.map(unit => {
            weight += /[.,!?;:，。！？；：、]/u.test(unit) ? 2.8 : /\s/u.test(unit) ? 1.25 : 1;
            return weight;
        });
        return { units, stops, weight };
    }
    function typingCount(plan, progress) {
        const weight = clamp(progress) * plan.weight;
        let low = 0, high = plan.stops.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (plan.stops[mid] <= weight) low = mid + 1;
            else high = mid;
        }
        return low;
    }
    function perimeterPoint(box, progress) {
        const { x, y } = box;
        const w = Math.max(0, box.width), h = Math.max(0, box.height);
        const r = clamp(box.radius ?? 0, 0, Math.min(w, h) / 2), arc = Math.PI * r / 2;
        const segments = [
            [w - 2 * r, d => [x + r + d, y, 0]],
            [arc, d => { const a = -Math.PI / 2 + d / r; return [x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r, a * 180 / Math.PI + 90]; }],
            [h - 2 * r, d => [x + w, y + r + d, 90]],
            [arc, d => { const a = d / r; return [x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r, a * 180 / Math.PI + 90]; }],
            [w - 2 * r, d => [x + w - r - d, y + h, 180]],
            [arc, d => { const a = Math.PI / 2 + d / r; return [x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r, a * 180 / Math.PI + 90]; }],
            [h - 2 * r, d => [x, y + h - r - d, 270]],
            [arc, d => { const a = Math.PI + d / r; return [x + r + Math.cos(a) * r, y + r + Math.sin(a) * r, a * 180 / Math.PI + 90]; }]
        ];
        let distance = clamp(progress) * segments.reduce((sum, segment) => sum + segment[0], 0);
        for (const [length, point] of segments) {
            if (length <= 0) continue;
            if (distance <= length) { const [px, py, angle] = point(distance); return { x: px, y: py, angle }; }
            distance -= length;
        }
        return { x: x + r, y, angle: 0 };
    }
    // Keep velocity across jobs: bounded spring steering, never assignment/snap-to-target.
    function advanceCursor(state, goal, seconds, options = {}) {
        const dt = clamp(Number.isFinite(seconds) ? seconds : 0, 0, .05);
        const vx = state.vx ?? 0, vy = state.vy ?? 0;
        if (!dt) return { x: state.x, y: state.y, vx, vy };
        const response = options.response ?? 12;
        const maxSpeed = options.maxSpeed ?? 1600, maxAcceleration = options.maxAcceleration ?? 7000;
        let ax = (goal.x - state.x) * response * response - 2 * response * vx;
        let ay = (goal.y - state.y) * response * response - 2 * response * vy;
        const acceleration = Math.hypot(ax, ay);
        if (acceleration > maxAcceleration) { ax *= maxAcceleration / acceleration; ay *= maxAcceleration / acceleration; }
        let nextVX = vx + ax * dt, nextVY = vy + ay * dt;
        const speed = Math.hypot(nextVX, nextVY);
        if (speed > maxSpeed) { nextVX *= maxSpeed / speed; nextVY *= maxSpeed / speed; }
        return { x: state.x + (vx + nextVX) * dt / 2, y: state.y + (vy + nextVY) * dt / 2,
            vx: nextVX, vy: nextVY };
    }
    function turnAngle(current, target, seconds) {
        const dt = clamp(Number.isFinite(seconds) ? seconds : 0, 0, .05);
        const difference = ((target - current + 180) % 360 + 360) % 360 - 180;
        return current + clamp(difference * (1 - Math.exp(-10 * dt)), -360 * dt, 360 * dt);
    }
    function wanderPoint(index, seconds, width, height, pointer = null) {
        const phase = index * 2.3999632297, rate = .36 + (index % 3) * .035;
        const angle = seconds * rate + phase;
        const centerX = width * .5 + (pointer ? clamp(pointer.x, 0, width) - width * .5 : 0) * .22;
        const centerY = height * .52 + (pointer ? clamp(pointer.y, 0, height) - height * .52 : 0) * .18;
        const rx = Math.min(width * .26, 260), ry = Math.min(height * .22, 190);
        return { x: centerX + rx * (Math.cos(angle) + .12 * Math.sin(seconds * .17 + phase * .7)),
            y: centerY + ry * (Math.sin(angle) + .12 * Math.cos(seconds * .19 + phase * .9)) };
    }
    const inView = (box, top, bottom) => box.y < bottom && box.y + box.height > top;
    const scrollTempo = speed => 1 + clamp(Math.abs(speed) / 1800, 0, 2.8);
    const workerCount = (speed, active) => Math.round(clamp(6 + active * 2 + Math.abs(speed) / 900, 6, 30));
    function eligibleTargets(targets, frontier, top, bottom, limit = 8) {
        return targets.filter(target => target.state === 'pending' && !target.hidden && target.box.width > 0 && target.box.height > 0 && target.box.y < frontier)
            .sort((a, b) => Number(inView(b.box, top, bottom)) - Number(inView(a.box, top, bottom))
                || Math.abs(a.box.y - top) - Math.abs(b.box.y - top)).slice(0, Math.max(0, limit));
    }
    const isWorkingTarget = target => target.state === 'copying' || target.state === 'drawing' || target.state === 'typing';
    function copyFrameBox(from, to, progress, lift = 42) {
        const p = ease(progress), arc = p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p) * lift;
        return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) - arc,
            width: lerp(from.width, to.width, p), height: lerp(from.height, to.height, p),
            radius: lerp(from.radius ?? 0, to.radius ?? 0, p) };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { clamp, ease, lerp, perimeterPoint, splitText, typingPlan, typingCount,
            inView, scrollTempo, workerCount, eligibleTargets, advanceCursor, turnAngle, wanderPoint,
            copyFrameBox, COLORS, ORBIT_MS, BUILD_MS, OUTRO_MS };
        return;
    }

    const boot = window.__portfolioSwarm;
    if (!boot || boot.done) return;
    const root = document.documentElement;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const svgNS = 'http://www.w3.org/2000/svg';
    const listeners = [], targets = [], cursors = [];
    const textSelector = [
        '.status-badge > span:last-child', '.greeting', '.card-header h3', '.tech-item > span',
        '.location-label', '.location-value', '.stat-label', '.github-link > span', '.hf-value', '.hf-label',
        '.project-info h3', '.project-info p', '.tag', '.project-bullets li', '.focus-label', '.focus-title',
        '.focus-desc', '.contact-text', '.contact-method > span', '.award-title', '.award-event', '.award-year', '.footer p'
    ].join(',');
    let layer, surface, world, transfers, guides, rulers, hint, hintCount, track, skipText;
    let frame = 0, fontTimer = 0, exitTimer = 0, healthTimer = 0;
    let ended = false, ready = false, building = false, leaving = false, geometryDirty = false;
    let width = innerWidth, height = innerHeight, cameraY = scrollY, frontier = 0, tempo = 1;
    let began = 0, previousFrame = 0, lastPaint = 0, lastScrollY = scrollY, lastScrollAt = 0, velocity = 0;
    let scrollIntent = false, pointer = null, rulerBucket = null, lastCount = '', verticalTicks;
    let resetFrontier = false, openingTargets = [], motionTime = 0, motionFrame = -1;

    const listen = (node, type, callback, options) => {
        node.addEventListener(type, callback, options);
        listeners.push(() => node.removeEventListener(type, callback, options));
    };
    const svg = (tag, attributes, parent = world) => {
        const node = document.createElementNS(svgNS, tag);
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
        parent.append(node);
        return node;
    };
    const snapshot = () => ({
        phase: root.dataset.swarmState, frontier, scrollY: cameraY, viewportHeight: height, tempo, frameTime: motionFrame,
        opening: !scrollIntent && openingTargets.some(target => target.state !== 'done'),
        pending: targets.filter(target => target.state === 'pending').length,
        active: targets.filter(isWorkingTarget).length,
        done: targets.filter(target => target.state === 'done').length,
        total: targets.length,
        targets: targets.map(target => ({ id: target.id, state: target.state, y: target.box.y,
            height: target.box.height, time: Math.round(target.clock),
            copyPhase: target.state === 'copying' ? target.copyPhase : null }))
    });

    function restoreWriter(writer) {
        if (writer.restored) return;
        writer.restored = true;
        writer.copy.remove();
        writer.frame.remove();
        writer.element.classList.remove('swarm-typing-source');
        if (writer.originalStyle === null) writer.element.removeAttribute('style');
        else writer.element.setAttribute('style', writer.originalStyle);
    }
    function restoreAccess(target) {
        target.node.inert = target.wasInert;
        if (target.busy === null) target.node.removeAttribute('aria-busy');
        else target.node.setAttribute('aria-busy', target.busy);
    }
    function restoreAll() {
        for (const target of targets) {
            try { target.writers.forEach(restoreWriter); }
            finally {
                restoreAccess(target);
                target.node.classList.remove('swarm-card-visible', 'swarm-built');
                target.node.removeAttribute('data-swarm-build');
                target.group?.remove(); clearTransfer(target);
            }
        }
    }
    function cleanup() {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(frame);
        clearTimeout(fontTimer); clearTimeout(exitTimer); clearInterval(healthTimer);
        listeners.splice(0).forEach(remove => remove());
    }
    function finish(reason = 'complete') {
        if (ended) return;
        const restoreFocus = layer?.contains(document.activeElement);
        cleanup();
        boot.release(reason);
        if (restoreFocus) document.querySelector('.tab')?.focus({ preventScroll: true });
    }
    function wake() {
        if (ended || leaving || document.hidden || frame) return;
        previousFrame = 0;
        frame = requestAnimationFrame(tick);
    }
    function measureAll(reset = false) {
        width = innerWidth; height = innerHeight; cameraY = scrollY;
        surface.setAttribute('viewBox', `0 0 ${width} ${height}`);
        for (const target of targets) {
            const element = target.nav ? target.node.querySelector('.tab-list') : target.node;
            const box = element.getBoundingClientRect();
            target.hidden = getComputedStyle(target.node).display === 'none';
            target.box = { x: box.x, y: box.y + cameraY, width: box.width, height: box.height,
                radius: target.nav ? Math.min(box.height / 2, 24) : parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0 };
            if (target.hidden && isWorkingTarget(target)) completeTarget(target);
            else if (target.state === 'drawing' || target.state === 'typing') refreshTargetGeometry(target);
        }
        const edge = cameraY + height - Math.min(36, height * .04);
        frontier = reset ? edge : Math.max(frontier, edge);
        rulerBucket = null;
    }
    function requestLayout(reason = 'geometry') {
        if (ended) return;
        // Font/resize notifications must never fast-forward the opening animation.
        // A deliberate language replacement alone invalidates the original text nodes.
        if (reason === 'content') {
            targets.filter(target => target.state === 'drawing' || target.state === 'typing').forEach(completeTarget);
        }
        geometryDirty = true; resetFrontier = true; wake();
    }
    function setGeometry(node, values) {
        for (const [name, value] of Object.entries(values)) node?.setAttribute(name, value);
    }
    function updateCaret(writer) {
        if (!writer.range || writer.restored) return;
        const rectangles = writer.range.getClientRects();
        const rect = rectangles[rectangles.length - 1] ?? writer.element.getBoundingClientRect();
        writer.point = { x: writer.count > 0 ? rect.right : rect.left,
            y: rect.top + rect.height / 2 + cameraY };
    }
    function refreshTargetGeometry(target) {
        const { x, y, width: w, height: h, radius } = target.box;
        setGeometry(target.outline, { x, y, width: w, height: h, rx: radius });
        const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
        target.shape.querySelectorAll('.swarm-handle').forEach((handle, index) => {
            setGeometry(handle, { x: corners[index][0] - 3, y: corners[index][1] - 3 });
        });
        setGeometry(target.shape.querySelector('.swarm-measure'), { x: x + w / 2 - 32, y: y + h + 8 });
        const label = target.shape.querySelector('.swarm-measure-text');
        setGeometry(label, { x: x + w / 2, y: y + h + 18 });
        if (label) label.textContent = `${Math.round(w)} × ${Math.round(h)}`;
        for (const writer of target.writers) {
            if (writer.restored) continue;
            // Read original typography, not our temporary transparent-ink override.
            writer.element.classList.remove('swarm-typing-source');
            const computed = getComputedStyle(writer.element), box = writer.element.getBoundingClientRect();
            const color = computed.color, left = computed.paddingLeft, top = computed.paddingTop;
            const textWidth = Math.max(1, box.width - parseFloat(left) - parseFloat(computed.paddingRight)
                - parseFloat(computed.borderLeftWidth) - parseFloat(computed.borderRightWidth));
            writer.element.classList.add('swarm-typing-source');
            writer.element.style.setProperty('--swarm-text-ink', color);
            writer.copy.style.left = left; writer.copy.style.top = top; writer.copy.style.width = `${textWidth}px`;
            setGeometry(writer.frame.firstElementChild, { x: box.x - 2, y: box.y + cameraY - 2,
                width: box.width + 4, height: box.height + 4 });
        }
    }
    function transferSource(target) {
        if (!target.node.matches('.bento-card')) return null;
        const box = target.box;
        return targets.filter(candidate => candidate !== target && candidate.node.matches('.bento-card')
            && !candidate.hidden && candidate.state !== 'pending' && candidate.state !== 'copying'
            && candidate.box.width / box.width > .55 && candidate.box.width / box.width < 1.8
            && candidate.box.height / box.height > .55 && candidate.box.height / box.height < 1.8
            && inView(candidate.box, cameraY - height * .35, cameraY + height))
            .sort((a, b) => Math.hypot(a.box.x - box.x, a.box.y - box.y)
                - Math.hypot(b.box.x - box.x, b.box.y - box.y))[0];
    }
    function transferShape(group, box, opacity = 1) {
        const shape = svg('g', { opacity }, group);
        const rect = svg('rect', { x: box.x, y: box.y, width: box.width, height: box.height,
            rx: box.radius, class: 'swarm-copy-frame' }, shape);
        const handles = svg('g', { class: 'swarm-copy-handles' }, shape);
        for (const [hx, hy] of [[box.x, box.y], [box.x + box.width, box.y],
            [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
            svg('rect', { x: hx - 3, y: hy - 3, width: 6, height: 6, class: 'swarm-copy-handle' }, handles);
        }
        const badge = svg('text', { x: box.x + box.width / 2, y: box.y - 8,
            class: 'swarm-copy-label' }, shape);
        badge.textContent = 'COPY';
        return { shape, rect, handles, badge };
    }
    function setTransferGeometry(view, box) {
        setGeometry(view.rect, { x: box.x, y: box.y, width: box.width, height: box.height, rx: box.radius });
        const corners = [[box.x, box.y], [box.x + box.width, box.y],
            [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
        view.handles.querySelectorAll('.swarm-copy-handle').forEach((handle, index) => {
            setGeometry(handle, { x: corners[index][0] - 3, y: corners[index][1] - 3 });
        });
        setGeometry(view.badge, { x: box.x + box.width / 2, y: box.y - 8 });
    }
    function clearTransfer(target) {
        if (target.carrier) target.carrier.carry = null;
        target.carrier = null; target.copyGroup?.remove(); target.copyGroup = null;
    }
    function beginTransfer(target, source, delay = 0) {
        if (!source) return activate(target, delay);
        const carrier = cursors.slice(0, 18).filter(cursor => !cursor.carry)
            .sort((a, b) => Math.hypot(a.x - source.box.x - source.box.width, a.y - source.box.y + cameraY)
                - Math.hypot(b.x - source.box.x - source.box.width, b.y - source.box.y + cameraY))[0];
        if (!carrier) return activate(target, delay);
        target.state = 'copying'; target.copySource = source; target.copyClock = -delay;
        target.copyDuration = 820; target.copyPhase = 'waiting'; target.copyWait = 0;
        target.carrier = carrier; carrier.carry = target;
        target.node.dataset.swarmBuild = 'copying';
        target.copyGroup = svg('g', { class: 'swarm-transfer', 'data-target': target.id }, transfers);
        target.sourceShape = transferShape(target.copyGroup, source.box, 0);
        target.sourceShape.shape.classList.add('swarm-copy-source'); target.sourceShape.badge.textContent = '';
        target.copyShape = transferShape(target.copyGroup, source.box, 0);
    }
    function updateTransfer(target, delta) {
        const source = target.copySource;
        target.copyWait += delta;
        if (target.hidden || source.hidden || target.copyWait > 7000) {
            clearTransfer(target);
            if (target.hidden) completeTarget(target); else activate(target, 0);
            return;
        }
        // Copy only an already drawn frame, never an invisible pending/copying source.
        if (target.copyPhase === 'waiting') {
            target.copyClock = Math.min(0, target.copyClock + delta);
            if (target.copyClock < 0 || (source.state !== 'done' && source.clock < 160 + source.duration)) return;
            target.copyPhase = 'grabbing'; target.copyClock = 0;
        }
        const sourceBox = source.box;
        const phase = target.copyPhase;
        if (phase === 'grabbing') {
            const goal = { x: sourceBox.x + sourceBox.width, y: sourceBox.y - cameraY };
            target.copyGoal = goal;
            if (Math.hypot(target.carrier.x - goal.x, target.carrier.y - goal.y) < 9) {
                target.copyPhase = 'dragging'; target.copyClock = 0;
            }
        } else if (phase === 'dragging') {
            target.copyClock += delta;
            if (target.copyClock >= target.copyDuration) target.copyClock = target.copyDuration;
        } else if (phase === 'snapping') {
            const distance = Math.hypot(target.carrier.x - target.box.x - target.box.width,
                target.carrier.y - target.box.y + cameraY);
            if (distance > 4) {
                // Camera/reflow changed during the snap: keep holding the frame until it arrives again.
                target.copyPhase = 'dragging'; target.copyClock = target.copyDuration;
            } else {
                target.copyClock += delta;
                if (target.copyClock >= 180) {
                    clearTransfer(target); activate(target, 0); return;
                }
            }
        }
        const progress = phase === 'waiting' || phase === 'grabbing' ? 0
            : phase === 'snapping' ? 1 : clamp(target.copyClock / target.copyDuration);
        target.copyBox = copyFrameBox(sourceBox, target.box, progress);
        target.copyGoal = { x: target.copyBox.x + target.copyBox.width, y: target.copyBox.y - cameraY };
    }
    function renderTransfers() {
        targets.filter(target => target.state === 'copying' && target.copyBox).forEach(target => {
            const sourceBox = target.copySource.box;
            setTransferGeometry(target.sourceShape, sourceBox);
            target.sourceShape.shape.setAttribute('opacity', target.copyPhase === 'snapping'
                ? 1 - clamp(target.copyClock / 180) : .8);
            let box = target.copyBox;
            if (target.copyPhase === 'dragging') {
                // The frame follows the rendered Agent tip, not an unrelated animation clock.
                box = { ...box, x: target.carrier.x - box.width, y: target.carrier.y + cameraY };
                if (target.copyClock >= target.copyDuration
                    && Math.hypot(box.x - target.box.x, box.y - target.box.y) < 3) {
                    target.copyPhase = 'snapping'; target.copyClock = 0;
                    box = { ...target.box };
                }
            }
            setTransferGeometry(target.copyShape, box);
            target.copyShape.shape.setAttribute('opacity', target.copyPhase === 'grabbing' ? .35 : .95);
            target.copyGroup.dataset.phase = target.copyPhase;
            target.copyGroup.dataset.carrier = target.carrier.index;
            target.copyGroup.dataset.source = target.copySource.id;
        });
    }
    function completeTarget(target) {
        if (target.state === 'done') return;
        target.writers.forEach(restoreWriter);
        target.group?.remove(); clearTransfer(target);
        target.state = 'done';
        target.node.dataset.swarmBuild = 'done';
        target.node.classList.remove('swarm-card-visible');
        target.node.classList.add('swarm-built');
        restoreAccess(target);
    }

    function prepareText(target) {
        const elements = [...target.node.querySelectorAll(target.nav ? '.tab' : textSelector)]
            .filter(element => element.textContent.trim() && !element.querySelector('svg, img, iframe, a, button, input'));
        // A footer is itself the text container's ancestor, so the selector is also valid here.
        target.writers = [];
        elements.forEach((element, index) => {
            const originalStyle = element.getAttribute('style');
            const computed = getComputedStyle(element), box = element.getBoundingClientRect();
            const copy = document.createElement('span');
            copy.className = 'swarm-typed-copy'; copy.setAttribute('aria-hidden', 'true');
            if (computed.webkitBackgroundClip === 'text' && computed.backgroundImage !== 'none') {
                copy.classList.add('swarm-gradient');
                copy.style.setProperty('--swarm-gradient', computed.backgroundImage);
            }
            for (const child of element.childNodes) copy.append(child.cloneNode(true));
            copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            const sourceWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            const copyWalker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
            const parts = [];
            let sourceNode, copyNode, offset = 0;
            while ((sourceNode = sourceWalker.nextNode()) && (copyNode = copyWalker.nextNode())) {
                const units = splitText(sourceNode.data);
                parts.push({ source: sourceNode, node: copyNode, units, start: offset });
                offset += units.length; copyNode.data = '';
            }
            const plan = typingPlan(parts.flatMap(part => part.units));
            const group = svg('g', { opacity: 0 }, target.group);
            svg('rect', { x: box.x - 2, y: box.y + cameraY - 2, width: box.width + 4, height: box.height + 4,
                class: 'swarm-outline', 'stroke-opacity': .55 }, group);
            const start = 160 + target.duration + 120 + Math.min(index * 75, 300);
            const duration = Math.min(clamp(plan.units.length * 16, 260, 1800), BUILD_MS - 180 - start);
            const writer = { element, copy, parts, plan, frame: group, start, duration, count: -1,
                originalStyle, restored: false, point: null };
            // Register before changing the DOM so partial initialization also restores safely.
            target.writers.push(writer);
            copy.style.left = computed.paddingLeft; copy.style.top = computed.paddingTop;
            copy.style.width = `${Math.max(1, box.width - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight)
                - parseFloat(computed.borderLeftWidth) - parseFloat(computed.borderRightWidth))}px`;
            element.style.setProperty('--swarm-text-ink', computed.color);
            element.classList.add('swarm-typing-source'); element.append(copy);
        });
        target.end = Math.max(160 + target.duration + 240,
            ...target.writers.map(writer => writer.start + writer.duration + 150));
    }
    function updateWriter(writer, time) {
        if (writer.restored) return;
        const elapsed = time - writer.start;
        writer.frame.setAttribute('opacity', elapsed >= 0 && elapsed < writer.duration ? 1 : 0);
        if (elapsed < 0) return;
        const count = typingCount(writer.plan, elapsed / writer.duration);
        writer.copy.classList.add('is-typing');
        if (count !== writer.count) {
            writer.count = count;
            writer.copy.dataset.typedChars = count; writer.copy.dataset.totalChars = writer.plan.units.length;
            let last = writer.parts[0], end = 0, lastLength = 0;
            for (const part of writer.parts) {
                const shown = clamp(count - part.start, 0, part.units.length);
                const text = part.units.slice(0, shown).join('');
                if (part.node.data !== text) part.node.data = text;
                if (shown > 0) { last = part; end = text.length; lastLength = part.units[shown - 1].length; }
            }
            if (last) {
                const range = document.createRange();
                range.setStart(last.source, end ? end - lastLength : 0);
                range.setEnd(last.source, end || (last.units[0]?.length ?? 0));
                writer.range = range;
            }
        }
        if (count === writer.plan.units.length) restoreWriter(writer);
    }
    function activate(target, delay) {
        target.state = 'drawing'; target.clock = -delay; target.delay = delay; target.wallStart = performance.now();
        target.duration = target.nav ? 420 : 610;
        target.node.dataset.swarmBuild = 'drawing';
        const { x, y, width: w, height: h, radius } = target.box;
        target.group = svg('g', {});
        target.shape = svg('g', {}, target.group);
        target.outline = svg('rect', { x, y, width: w, height: h, rx: radius, pathLength: 1,
            'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'swarm-outline' }, target.shape);
        for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
            svg('rect', { x: hx - 3, y: hy - 3, width: 6, height: 6, class: 'swarm-handle' }, target.shape);
        }
        svg('rect', { x: x + w / 2 - 32, y: y + h + 8, width: 64, height: 15, rx: 2, class: 'swarm-measure' }, target.shape);
        const label = svg('text', { x: x + w / 2, y: y + h + 18, class: 'swarm-measure-text' }, target.shape);
        label.textContent = `${Math.round(w)} × ${Math.round(h)}`;
        prepareText(target);
    }
    function drawRulers(active) {
        const opening = !scrollIntent && openingTargets.some(target => target.state !== 'done');
        const visible = (opening ? active.find(target => !target.nav && inView(target.box, cameraY, cameraY + height)) : null)
            ?? active.find(target => inView(target.box, cameraY, cameraY + height));
        const fade = opening ? 1 - clamp((Math.max(...openingTargets.map(target => target.clock + target.delay)) - 1080) / 320) : 1;
        const bucket = Math.floor(cameraY / 50);
        rulers.setAttribute('opacity', visible ? fade : 0);
        guides.setAttribute('opacity', visible ? .65 * fade : 0);
        if (!visible || !fade) return;
        if (bucket !== rulerBucket) {
            rulerBucket = bucket; rulers.replaceChildren();
            svg('rect', { x: 0, y: 0, width, height: 16, class: 'swarm-ruler' }, rulers);
            svg('rect', { x: 0, y: 0, width: 16, height, class: 'swarm-ruler' }, rulers);
            for (let x = 50; x < width; x += 50) {
                svg('line', { x1: x, x2: x, y1: x % 100 ? 12 : 9, y2: 16, class: 'swarm-ruler-tick' }, rulers);
                if (!(x % 100)) { const text = svg('text', { x: x + 3, y: 8, class: 'swarm-ruler-number' }, rulers); text.textContent = x; }
            }
            verticalTicks = svg('g', {}, rulers);
            for (let y = bucket * 50; y < cameraY + height + 50; y += 50) {
                const py = y - bucket * 50;
                svg('line', { x1: y % 100 ? 12 : 9, x2: 16, y1: py, y2: py, class: 'swarm-ruler-tick' }, verticalTicks);
                if (!(y % 100)) { const text = svg('text', { x: 2, y: py - 3, class: 'swarm-ruler-number' }, verticalTicks); text.textContent = y; }
            }
        }
        verticalTicks?.setAttribute('transform', `translate(0 ${bucket * 50 - cameraY})`);
        guides.replaceChildren();
        svg('line', { x1: visible.box.x, x2: visible.box.x, y1: 0, y2: height, class: 'swarm-guide' }, guides);
        svg('line', { x1: 0, x2: width, y1: visible.box.y - cameraY, y2: visible.box.y - cameraY, class: 'swarm-guide' }, guides);
    }
    function createCursor(index, labels) {
        const node = document.createElement('div');
        node.className = 'swarm-cursor'; node.setAttribute('aria-hidden', 'true');
        node.dataset.tool = 'arrow';
        node.style.opacity = index < 18 ? 1 : 0;
        node.innerHTML = `<svg width="26" height="26" viewBox="0 0 28 28"><path d="${ARROW}" fill="${COLORS[index % COLORS.length]}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="swarm-cursor-label"></span>`;
        const label = node.querySelector('span'); label.style.background = COLORS[index % COLORS.length];
        label.textContent = labels[index % labels.length]; layer.append(node);
        const angle = index / 18 * Math.PI * 2, radius = width < 600 ? 87 : 105;
        return { node, icon: node.firstElementChild, index, tool: 'arrow', x: width / 2 + Math.cos(angle) * radius,
            y: height / 2 - 8 + Math.sin(angle) * radius * .86,
            vx: -Math.sin(angle) * radius * .7, vy: Math.cos(angle) * radius * .86 * .7,
            angle: angle * 180 / Math.PI + 218, seed: Math.random() * 6.28,
            alpha: index < 18 ? 1 : 0, phase: (index * .38196601125) % 1, job: null };
    }
    function cursorTool(cursor, tool) {
        if (cursor.tool === tool) return;
        cursor.tool = tool; cursor.node.dataset.tool = tool;
        const color = COLORS[cursor.index % COLORS.length];
        cursor.icon.innerHTML = tool === 'text'
            ? `<g transform="translate(-8 -10)"><path d="${IBEAM}" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="${IBEAM}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/></g>`
            : `<path d="${ARROW}" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    function paintCursors(active, dt, speed) {
        const seconds = dt / 1000;
        const opening = building && !scrollIntent && openingTargets.some(target => target.state !== 'done');
        if (opening) active = openingTargets.filter(target => target.state !== 'pending' && !target.hidden);
        const count = !building || opening ? 18 : active.length ? Math.min(width < 600 ? 20 : 30, workerCount(speed, active.length)) : 6;
        cursors.forEach((cursor, index) => {
            const wanted = index < count || !!cursor.carry;
            if (!wanted && cursor.alpha < .005) {
                cursor.alpha = 0; cursor.node.style.opacity = 0; cursor.job = null; return;
            }
            let destination, working = false, tool = 'arrow';
            if (wanted && building && active.length && (!cursor.job || !active.includes(cursor.job))) {
                cursor.job = active[index % active.length];
                cursor.phase = (index * .38196601125) % 1;
            }
            if (!wanted) {
                // Retiring workers keep flying while fading; they never freeze in place.
                cursor.job = null;
                destination = { x: index % 2 ? width + 70 : -70,
                    y: height * (.25 + (index % 5) * .12) + Math.sin(motionTime + cursor.seed) * 30 };
            } else if (cursor.carry?.copyGoal) {
                destination = cursor.carry.copyGoal;
                working = true;
            } else if (!building) {
                const a = index / 18 * Math.PI * 2 + motionTime * .7;
                const r = (width < 600 ? 87 : 105) + Math.sin(motionTime * 1.8 + cursor.seed) * 9;
                destination = { x: width / 2 + Math.cos(a) * r, y: height / 2 - 8 + Math.sin(a) * r * .86 };
            } else if (active.length && cursor.job?.state === 'copying') {
                const target = cursor.job;
                const box = target.copyBox ?? target.copySource.box;
                cursor.phase = (cursor.phase + seconds * .12) % 1;
                const point = perimeterPoint(box, cursor.phase);
                destination = { x: point.x, y: point.y - cameraY };
                working = target.copyPhase === 'dragging';
            } else if (active.length && cursor.job && cursor.job.clock < 0) {
                // Workers awaiting a staggered job continue orbiting instead of parking.
                const a = index / 18 * Math.PI * 2 + motionTime * .7;
                const r = (width < 600 ? 87 : 105) + Math.sin(motionTime * 1.8 + cursor.seed) * 9;
                destination = { x: width / 2 + Math.cos(a) * r, y: height / 2 - 8 + Math.sin(a) * r * .86 };
            } else if (active.length) {
                const target = cursor.job;
                const live = target.writers.filter(writer => !writer.restored && writer.point && target.clock >= writer.start);
                const writer = live[Math.floor(index / active.length)];
                if (writer) {
                    tool = 'text'; working = true;
                    destination = { x: writer.point.x + Math.sin(motionTime * 2 + cursor.seed) * .6,
                        y: writer.point.y - cameraY + Math.cos(motionTime * 1.7 + cursor.seed) * .8 };
                } else {
                    const trace = (target.clock - 160) / target.duration;
                    const offset = Math.floor(index / active.length) * .23;
                    if (target.state === 'drawing' && trace >= 0 && trace < 1) {
                        cursor.phase = (trace + offset) % 1;
                    } else {
                        const r = target.box.radius;
                        const perimeter = Math.max(100, 2 * (target.box.width + target.box.height) - 8 * r + 2 * Math.PI * r);
                        cursor.phase = (cursor.phase + seconds * (85 + index % 4 * 17) / perimeter) % 1;
                    }
                    const point = perimeterPoint(target.box, cursor.phase);
                    destination = { x: point.x, y: point.y - cameraY };
                    working = target.state !== 'done' && trace > 0 && trace < 1;
                }
            } else {
                cursor.job = null;
                destination = wanderPoint(index, motionTime, width, height, pointer);
            }
            cursorTool(cursor, tool);
            // Position is in viewport space. A camera/line/job change changes only the goal,
            // not the rendered position, velocity or shared arrow/I-beam anchor.
            Object.assign(cursor, advanceCursor(cursor, destination, seconds,
                { response: tool === 'text' || cursor.carry ? 20 : 12, maxSpeed: 1250, maxAcceleration: 6500 }));
            const heading = tool === 'text' ? 0 : Math.hypot(cursor.vx, cursor.vy) > 2
                ? Math.atan2(cursor.vy, cursor.vx) * 180 / Math.PI + 128 : cursor.angle;
            cursor.angle = turnAngle(cursor.angle, heading, seconds);
            const targetAlpha = !wanted ? 0 : building && !active.length ? .65
                : opening && index >= active.length && tool === 'arrow' ? .72 : 1;
            cursor.alpha += (targetAlpha - cursor.alpha) * (1 - Math.exp(-11 * seconds));
            cursor.node.style.transform = `translate3d(${(cursor.x - 4).toFixed(3)}px, ${(cursor.y - 3).toFixed(3)}px, 0)`;
            cursor.icon.style.transform = `rotate(${cursor.angle.toFixed(3)}deg)`;
            cursor.icon.style.transformOrigin = '4px 3px';
            cursor.node.style.opacity = cursor.alpha.toFixed(3);
            cursor.node.classList.toggle('is-working', working && cursor.y > -26 && cursor.y < height + 26);
        });
    }
    function tick(now) {
        if (ended || document.hidden) { frame = 0; return; }
        if (now === motionFrame) { frame = requestAnimationFrame(tick); return; }
        const motionDelta = motionFrame < 0 ? 16 : clamp(now - motionFrame, 0, 50);
        motionFrame = now; frame = 0;
        try {
            const dt = previousFrame ? Math.min(50, now - previousFrame) : 16;
            previousFrame = now; lastPaint = now;
            motionTime += motionDelta / 1000;
            cameraY = scrollY;
            if (geometryDirty) { measureAll(resetFrontier); geometryDirty = false; resetFrontier = false; }
            if (!building && ready && (now - began >= ORBIT_MS || scrollIntent)) {
                building = true; measureAll();
                openingTargets = eligibleTargets(targets, frontier, cameraY, cameraY + height, 8);
                root.classList.add('swarm-building'); layer.classList.add('is-building', 'is-opening');
            }
            if (!building) {
                track.style.width = `${clamp((now - began) / ORBIT_MS) * 80}%`;
                paintCursors([], motionDelta, 0); frame = requestAnimationFrame(tick); return;
            }
            frontier = Math.max(frontier, cameraY + height - Math.min(36, height * .04));
            const speed = velocity * Math.exp(-(now - lastScrollAt) / 400);
            tempo = scrollTempo(speed);
            let active = targets.filter(isWorkingTarget);
            const capacity = Math.abs(speed) > 1000 ? 12 : 8;
            eligibleTargets(targets, frontier, cameraY, cameraY + height, capacity - active.length)
                .forEach((target, index) => {
                    const openingIndex = openingTargets.indexOf(target);
                    const gap = Math.min(115, 600 / Math.max(1, openingTargets.length - 1));
                    // One deliberate copy gesture at a time keeps the handoff legible.
                    const source = targets.some(candidate => candidate.state === 'copying') ? null : transferSource(target);
                    const delay = openingIndex >= 0 ? openingIndex * gap : Math.min(index * 85, 425);
                    if (source) beginTransfer(target, source, delay);
                    else activate(target, delay);
                });
            active = targets.filter(isWorkingTarget);
            for (const target of active) {
                const visible = inView(target.box, cameraY, cameraY + height);
                const workDelta = dt * tempo * (visible ? 1 : 4);
                if (target.state === 'copying') {
                    updateTransfer(target, dt * (visible ? Math.min(tempo, 1.4) : 3));
                    continue;
                }
                target.clock += workDelta;
                target.group.setAttribute('opacity', visible ? 1 : 0);
                const progress = clamp((target.clock - 160) / target.duration);
                target.outline.setAttribute('stroke-dashoffset', 1 - progress);
                target.shape.setAttribute('opacity', target.clock >= 80 ? 1 - clamp((target.clock - target.duration - 380) / 260) : 0);
                if (progress === 1 && target.state === 'drawing') {
                    target.state = 'typing'; target.node.dataset.swarmBuild = 'typing';
                    target.node.classList.add('swarm-card-visible');
                }
                target.writers.forEach(writer => updateWriter(writer, target.clock));
                if (target.clock >= target.end || now - target.wallStart > 12000) completeTarget(target);
            }
            active = targets.filter(isWorkingTarget);
            // Batch geometry reads after every text write, avoiding one forced layout per writer.
            active.forEach(target => target.writers.forEach(updateCaret));
            world.setAttribute('transform', `translate(0 ${-cameraY})`);
            drawRulers(active);
            const visibleActive = active.filter(target => inView(target.box, cameraY, cameraY + height));
            paintCursors(visibleActive, motionDelta, speed);
            renderTransfers();
            const done = targets.filter(target => target.state === 'done').length;
            const phase = active.length ? 'drawing' : 'waiting';
            if (root.dataset.swarmState !== phase) root.dataset.swarmState = phase;
            const visibleTargets = targets.filter(target => !target.hidden);
            const visibleDone = visibleTargets.filter(target => target.state === 'done').length;
            const filteredOnly = !active.length && visibleDone === visibleTargets.length && done < targets.length;
            const hintLabel = active.length ? (root.lang.startsWith('zh') ? '智能体正在构建' : 'Agents are building')
                : filteredOnly ? (root.lang.startsWith('zh') ? '切换分类，继续构建' : 'Switch tabs to keep building')
                    : (root.lang.startsWith('zh') ? '向下滚动，继续构建' : 'Scroll to keep building');
            if (hint.textContent !== hintLabel) hint.textContent = hintLabel;
            const countLabel = `${visibleDone} / ${visibleTargets.length}`;
            if (countLabel !== lastCount) { hintCount.textContent = countLabel; lastCount = countLabel; }
            const opening = !scrollIntent && openingTargets.some(target => target.state !== 'done');
            layer.classList.toggle('is-opening', opening);
            const skipLabel = opening ? (root.lang.startsWith('zh') ? '跳过开场' : 'Skip intro')
                : (root.lang.startsWith('zh') ? '直接显示全部' : 'Show all');
            if (skipText.textContent !== skipLabel) skipText.textContent = skipLabel;
            layer.classList.toggle('is-idle', !active.length);
            if (done === targets.length && !leaving) {
                leaving = true; layer.classList.add('is-leaving');
                exitTimer = setTimeout(() => finish('complete'), OUTRO_MS);
            }
            // Visible agents keep moving in idle and even throughout the final fade.
            // Visibility/reduced-motion/skip handlers still stop the loop immediately.
            frame = requestAnimationFrame(tick);
        } catch (error) {
            console.warn('Portfolio construction skipped:', error); finish('error');
        }
    }

    function start() {
        if (boot.done) return;
        try {
            if (motion.matches) return boot.release('reduced');
            if (getComputedStyle(root).getPropertyValue('--swarm-loader-ready').trim() !== '1') return boot.release('no-style');
            const container = document.querySelector('body > .container');
            if (!container) return boot.release('no-content');
            const chinese = root.lang.startsWith('zh');
            layer = document.createElement('div'); layer.id = 'swarm-loader';
            layer.innerHTML = `<div class="swarm-paper" aria-hidden="true"></div>
                <div class="swarm-intro" aria-hidden="true"><div class="swarm-monogram">TW</div><div class="swarm-signature">TAILONG WU</div></div>
                <div class="swarm-caption" role="status"><div class="swarm-status"><span class="swarm-status-label"><i class="swarm-status-dot"></i>${chinese ? '智能体集结中' : 'Gathering the swarm'}</span><span>18 agents</span></div><div class="swarm-track"><div class="swarm-track-fill"></div></div></div>
                <svg class="swarm-surface" aria-hidden="true"></svg>
                <div class="swarm-progress" aria-hidden="true"><i class="swarm-status-dot"></i><span class="swarm-progress-text"></span><span class="swarm-progress-count"></span></div>
                <button type="button" class="swarm-skip" id="swarm-skip"><span class="swarm-skip-text">${chinese ? '跳过开场' : 'Skip intro'}</span> <span aria-hidden="true">↗</span></button>`;
            document.body.append(layer);
            surface = layer.querySelector('svg');
            world = svg('g', {}, surface); transfers = svg('g', {}, world);
            guides = svg('g', { opacity: 0 }, surface); rulers = svg('g', { opacity: 0 }, surface);
            hint = layer.querySelector('.swarm-progress-text'); hintCount = layer.querySelector('.swarm-progress-count');
            track = layer.querySelector('.swarm-track-fill');
            skipText = layer.querySelector('.swarm-skip-text');
            const nodes = [document.querySelector('.tab-nav'), ...document.querySelectorAll('.bento-card'), document.querySelector('.footer')].filter(Boolean);
            boot.restore = restoreAll;
            nodes.forEach((node, index) => {
                targets.push({ id: node.matches('.tab-nav') ? 'navigation' : node.matches('.footer') ? 'footer' : `card-${index}`,
                    node, nav: node.matches('.tab-nav'), state: 'pending', box: {}, clock: 0, writers: [],
                    wasInert: node.inert, busy: node.getAttribute('aria-busy') });
                node.inert = true; node.setAttribute('aria-busy', 'true'); node.dataset.swarmBuild = 'pending';
            });
            measureAll();
            const labels = chinese ? ['布局', '机器人', '视觉语言动作', '智能体', '研究', '代码', '设计', '联系']
                : ['layout', 'robotics', 'VLA', 'agents', 'research', 'code', 'design', 'contact'];
            for (let index = 0; index < 30; index++) cursors.push(createCursor(index, labels));
            listen(layer.querySelector('button'), 'click', () => finish('skipped'));
            listen(window, 'scroll', () => {
                const now = performance.now(), next = scrollY;
                velocity = clamp((next - lastScrollY) / clamp(now - lastScrollAt, 16, 100) * 1000, -14000, 14000);
                lastScrollY = next; lastScrollAt = now; cameraY = next; scrollIntent = true;
                frontier = Math.max(frontier, next + innerHeight - Math.min(36, innerHeight * .04));
                wake();
            }, { passive: true });
            listen(window, 'pointermove', event => { pointer = { x: event.clientX, y: event.clientY }; if (building) wake(); }, { passive: true });
            listen(window, 'resize', requestLayout);
            listen(document, 'keydown', event => {
                // Keyboard scrolling remains construction input. Tab provides immediate accessible content.
                if (event.key === 'Escape' || event.key === 'Tab') {
                    finish(event.key === 'Escape' ? 'skipped' : 'keyboard');
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
                }
            }, true);
            const preferences = new MutationObserver(records => {
                requestLayout(records.some(record => record.attributeName === 'lang') ? 'content' : 'geometry');
            });
            preferences.observe(root, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
            listeners.push(() => preferences.disconnect());
            const categories = new MutationObserver(records => {
                if (records.some(record => (record.oldValue ?? '').split(' ').includes('hidden') !== record.target.classList.contains('hidden'))) requestLayout();
            });
            for (const target of targets) if (target.node.matches('.bento-card')) {
                categories.observe(target.node, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
            }
            listeners.push(() => categories.disconnect());
            if (typeof ResizeObserver !== 'undefined') {
                const layout = new ResizeObserver(requestLayout);
                layout.observe(container); listeners.push(() => layout.disconnect());
            }
            listen(document, 'visibilitychange', () => {
                if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previousFrame = 0; motionFrame = -1; }
                else {
                    lastPaint = performance.now();
                    for (const target of targets) if (target.state === 'drawing' || target.state === 'typing') target.wallStart = lastPaint;
                    if (innerWidth !== width || innerHeight !== height) requestLayout();
                    else wake();
                }
            });
            listen(window, 'pagehide', () => finish('restored'));
            listen(motion, 'change', () => { if (motion.matches) finish('reduced'); });
            listen(window, 'swarm:finished', cleanup);
            const fontReady = document.fonts ? document.fonts.ready : Promise.resolve();
            Promise.race([fontReady, new Promise(resolve => { fontTimer = setTimeout(resolve, 650); })])
                .then(() => { ready = true; clearTimeout(fontTimer); wake(); }, () => { ready = true; wake(); });
            fontReady.then(() => { if (building) requestLayout(); }, () => {});
            if (document.fonts) listen(document.fonts, 'loadingdone', () => { if (building) requestLayout(); });
            window.portfolioSwarm = { snapshot, showAll: () => finish('skipped') };
            began = performance.now(); lastPaint = began;
            root.dataset.swarmState = 'orbit';
            // The independent head watchdog only protects startup, not unvisited content.
            boot.takeOver();
            healthTimer = setInterval(() => {
                if (!document.hidden && frame && performance.now() - lastPaint > 5000) finish('stalled');
            }, 2000);
            wake();
        } catch (error) {
            console.warn('Portfolio construction skipped:', error); finish('error');
        }
    }
    if (document.readyState === 'complete') start();
    else listen(window, 'DOMContentLoaded', start, { once: true });
})();
