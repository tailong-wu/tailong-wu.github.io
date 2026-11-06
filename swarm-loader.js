/* Swarm-inspired loading, implemented for this portfolio without dependencies. */
(() => {
    'use strict';

    const COLORS = ['#F24E1E', '#A259FF', '#1ABCFE', '#0ACF83', '#FF7262', '#FFC700',
        '#9747FF', '#E8467C', '#14AE5C', '#0D99FF', '#FF8A00', '#00B5CE'];
    const ARROW = 'M4.6 3.9C4.2 3.1 4.9 2.4 5.7 2.8L20.6 9.4C21.5 9.8 21.4 11.1 20.4 11.3L13.9 12.9C13.4 13 13 13.4 12.9 13.9L11.3 20.4C11.1 21.4 9.8 21.5 9.4 20.6Z';
    const ORBIT_MS = 700;
    const BUILD_MS = 3300;
    const OUTRO_MS = 240;
    const IBEAM = 'M8 4H10Q12 4 12 6Q12 4 14 4H16M12 6V20M8 22H10Q12 22 12 20Q12 22 14 22H16';
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
        const weight = Math.max(0, Math.min(1, progress)) * plan.weight;
        let low = 0, high = plan.stops.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (plan.stops[mid] <= weight) low = mid + 1;
            else high = mid;
        }
        return low;
    }
    const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
    const ease = value => 1 - (1 - clamp(value)) ** 3;
    const lerp = (from, to, progress) => from + (to - from) * progress;

    /** A point and tangent on the actual rounded card perimeter, clockwise. */
    function perimeterPoint(box, progress) {
        const { x, y } = box;
        const w = Math.max(0, box.width);
        const h = Math.max(0, box.height);
        const r = clamp(box.radius ?? 0, 0, Math.min(w, h) / 2);
        const arc = Math.PI * r / 2;
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
            if (distance <= length) {
                const [px, py, angle] = point(distance);
                return { x: px, y: py, angle };
            }
            distance -= length;
        }
        return { x: x + r, y, angle: 0 };
    }

    // The geometry can be unit-tested using Node, without shipping a DOM library.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { clamp, ease, lerp, perimeterPoint, splitText, typingPlan, typingCount, COLORS, ORBIT_MS, BUILD_MS, OUTRO_MS };
        return;
    }

    const boot = window.__portfolioSwarm;
    if (!boot || boot.done) return;
    const root = document.documentElement;
    const svgNS = 'http://www.w3.org/2000/svg';
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let loader, container, frame = 0, fontTimer = 0, exitTimer = 0;
    let ended = false, ready = false, buildStarted = null, began = 0;
    let targets = [], cursors = [], surface, guides, ruler, track;
    let width = 0, height = 0;
    const listeners = [];
    const listen = (node, type, callback, options) => {
        node.addEventListener(type, callback, options);
        listeners.push(() => node.removeEventListener(type, callback, options));
    };
    const svg = (tag, attributes, parent = surface) => {
        const node = document.createElementNS(svgNS, tag);
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
        parent.append(node);
        return node;
    };

    const writers = [];
    const textSelector = [
        '.status-badge > span:last-child', '.greeting', '.card-header h3', '.tech-item > span',
        '.location-label', '.location-value', '.stat-label', '.github-link > span',
        '.hf-value', '.hf-label', '.project-info h3', '.project-info p', '.tag',
        '.project-bullets li', '.focus-label', '.focus-title', '.focus-desc', '.contact-text',
        '.contact-method > span', '.award-title', '.award-event', '.award-year'
    ].join(',');

    function restoreWriter(writer) {
        if (writer.restored) return;
        writer.restored = true;
        writer.copy.remove();
        writer.frame.remove();
        writer.element.classList.remove('swarm-typing-source');
        if (writer.originalStyle === null) writer.element.removeAttribute('style');
        else writer.element.setAttribute('style', writer.originalStyle);
    }

    function restoreTyping() {
        writers.forEach(restoreWriter);
    }

    function prepareText(target) {
        const elements = [...target.node.querySelectorAll(target.nav ? '.tab' : textSelector)]
            .filter(element => element.textContent.trim() && !element.querySelector('svg, img, iframe, a, button, input'));
        target.writers = elements.map((element, index) => {
            const originalStyle = element.getAttribute('style');
            const computed = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            const copy = document.createElement('span');
            copy.className = 'swarm-typed-copy';
            copy.setAttribute('aria-hidden', 'true');
            for (const child of element.childNodes) copy.append(child.cloneNode(true));
            copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            const sourceWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            const copyWalker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
            const parts = [];
            let sourceNode, copyNode, offset = 0;
            while ((sourceNode = sourceWalker.nextNode()) && (copyNode = copyWalker.nextNode())) {
                const units = splitText(sourceNode.data);
                parts.push({ source: sourceNode, node: copyNode, units, start: offset });
                offset += units.length;
                copyNode.data = '';
            }
            const plan = typingPlan(parts.flatMap(part => part.units));
            const frame = svg('g', { opacity: 0 });
            svg('rect', { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4,
                class: 'swarm-outline', 'stroke-opacity': .55 }, frame);
            const start = target.start + 160 + target.duration + 120 + Math.min(index * 75, 300);
            const duration = Math.min(clamp(plan.units.length * 16, 260, 1800), BUILD_MS - 180 - start);
            const writer = { element, copy, parts, plan, frame, start, duration, count: -1,
                originalStyle, restored: false, point: null };
            // Keep the original rich text in flow, untouched. Only this absolute copy types.
            copy.style.left = computed.paddingLeft;
            copy.style.top = computed.paddingTop;
            copy.style.width = `${Math.max(1, box.width - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight)
                - parseFloat(computed.borderLeftWidth) - parseFloat(computed.borderRightWidth))}px`;
            element.style.setProperty('--swarm-text-ink', computed.color);
            element.classList.add('swarm-typing-source');
            element.append(copy);
            writers.push(writer);
            return writer;
        });
    }

    function updateWriter(writer, drawing) {
        if (writer.restored) return;
        const elapsed = drawing - writer.start;
        writer.frame.setAttribute('opacity', elapsed >= 0 && elapsed < writer.duration ? 1 : 0);
        if (elapsed < 0) return;
        const count = typingCount(writer.plan, elapsed / writer.duration);
        writer.copy.classList.add('is-typing');
        if (count !== writer.count) {
            writer.count = count;
            writer.copy.dataset.typedChars = count;
            writer.copy.dataset.totalChars = writer.plan.units.length;
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
                const rectangles = range.getClientRects();
                const rect = rectangles[rectangles.length - 1] ?? writer.element.getBoundingClientRect();
                writer.point = { x: end ? rect.right : rect.left, y: rect.top + rect.height / 2 };
            }
        }
        if (count === writer.plan.units.length) restoreWriter(writer);
    }

    function cursorTool(cursor, tool) {
        if (cursor.tool === tool) return;
        cursor.tool = tool;
        const color = COLORS[cursor.index % COLORS.length];
        cursor.icon.innerHTML = tool === 'text'
            ? `<path d="${IBEAM}" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="${IBEAM}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>`
            : `<path d="${ARROW}" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>`;
    }

    function cleanup() {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(frame);
        clearTimeout(fontTimer);
        clearTimeout(exitTimer);
        listeners.splice(0).forEach(remove => remove());
    }

    function finish(reason = 'complete') {
        if (ended) return;
        const restoreFocus = loader?.contains(document.activeElement);
        cleanup();
        boot.release(reason);
        if (restoreFocus) container?.querySelector('.tab')?.focus({ preventScroll: true });
    }

    function createCursor(index, labels) {
        const node = document.createElement('div');
        node.className = 'swarm-cursor';
        node.setAttribute('aria-hidden', 'true');
        node.innerHTML = `<svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true"><path d="${ARROW}" fill="${COLORS[index % COLORS.length]}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="swarm-cursor-label"></span>`;
        const label = node.querySelector('span');
        label.style.background = COLORS[index % COLORS.length];
        label.textContent = labels[index % labels.length];
        loader.append(node);
        return { node, icon: node.firstElementChild, index, tool: 'arrow', x: width / 2, y: height / 2, angle: 0, seed: Math.random() * Math.PI * 2, from: null };
    }

    function measureTargets() {
        const nodes = [document.querySelector('.tab-nav'), ...document.querySelectorAll('.bento-card')];
        return nodes.filter(Boolean).map(node => {
            const box = node.getBoundingClientRect();
            const nav = node.classList.contains('tab-nav');
            // The outer navigation is wider than its pill; outline the pill itself.
            const measured = nav ? node.querySelector('.tab-list').getBoundingClientRect() : box;
            return { node, box: { x: measured.x, y: measured.y, width: measured.width, height: measured.height,
                radius: nav ? Math.min(measured.height / 2, 24) : parseFloat(getComputedStyle(node).borderTopLeftRadius) || 32 }, nav };
        }).filter(target => target.box.width > 0 && target.box.y < height - 24 && target.box.y + target.box.height > 24);
    }

    function beginDrawing(now) {
        buildStarted = now;
        root.classList.add('swarm-building');
        root.dataset.swarmState = 'drawing';
        loader.classList.add('is-building');
        targets = measureTargets();
        if (!targets.length) return finish('complete');
        cursors.forEach(cursor => { cursor.from = { x: cursor.x, y: cursor.y }; });
        const gap = Math.min(115, 600 / Math.max(1, targets.length - 1));
        targets.forEach((target, index) => {
            target.start = index * gap;
            target.duration = target.nav ? 420 : 610;
            const { x, y, width: w, height: h, radius } = target.box;
            target.group = svg('g', { opacity: 0 });
            target.outline = svg('rect', { x, y, width: w, height: h, rx: radius, pathLength: 1,
                'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, class: 'swarm-outline' }, target.group);
            target.handles = svg('g', {}, target.group);
            for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
                svg('rect', { x: hx - 3, y: hy - 3, width: 6, height: 6, class: 'swarm-handle' }, target.handles);
            }
            const badgeY = Math.min(height - 17, y + h + 8);
            svg('rect', { x: x + w / 2 - 32, y: badgeY, width: 64, height: 15, rx: 2, class: 'swarm-measure' }, target.handles);
            const text = svg('text', { x: x + w / 2, y: badgeY + 10, class: 'swarm-measure-text' }, target.handles);
            text.textContent = `${Math.round(w)} × ${Math.round(h)}`;
            prepareText(target);
        });
        guides = svg('g', { opacity: 0 });
        const primary = targets.find(target => !target.nav)?.box ?? targets[0].box;
        svg('line', { x1: primary.x, x2: primary.x, y1: 0, y2: height, class: 'swarm-guide' }, guides);
        svg('line', { x1: 0, x2: width, y1: primary.y, y2: primary.y, class: 'swarm-guide' }, guides);
        ruler = svg('g', { opacity: 0 });
        svg('rect', { x: 0, y: 0, width, height: 16, class: 'swarm-ruler' }, ruler);
        svg('rect', { x: 0, y: 0, width: 16, height, class: 'swarm-ruler' }, ruler);
        for (let x = 50; x < width; x += 50) {
            svg('line', { x1: x, x2: x, y1: x % 100 ? 12 : 9, y2: 16, class: 'swarm-ruler-tick' }, ruler);
            if (!(x % 100)) { const label = svg('text', { x: x + 3, y: 8, class: 'swarm-ruler-number' }, ruler); label.textContent = x; }
        }
        for (let y = 50; y < height; y += 50) svg('line', { x1: y % 100 ? 12 : 9, x2: 16, y1: y, y2: y, class: 'swarm-ruler-tick' }, ruler);
    }

    function orbit(cursor, index, elapsed, delta) {
        const angle = index / cursors.length * Math.PI * 2 + elapsed * .0007;
        const radius = Math.min(width * .25, width < 600 ? 87 : 105) + Math.sin(elapsed * .0018 + cursor.seed) * 9;
        const desiredX = width / 2 + Math.cos(angle) * radius;
        const desiredY = height / 2 - 8 + Math.sin(angle) * radius * .86;
        const oldX = cursor.x, oldY = cursor.y;
        cursor.x = lerp(cursor.x, desiredX, Math.min(1, delta * .012));
        cursor.y = lerp(cursor.y, desiredY, Math.min(1, delta * .012));
        cursor.angle = Math.atan2(cursor.y - oldY, cursor.x - oldX) * 180 / Math.PI + 128;
    }

    function drawFrame(now) {
        if (ended) return;
        try {
            const elapsed = now - began;
            const delta = Math.min(40, now - (drawFrame.previous ?? now - 16));
            drawFrame.previous = now;
            if (buildStarted === null && ready && elapsed >= ORBIT_MS) beginDrawing(now);
            if (ended) return;
            if (buildStarted === null) {
                track.style.width = `${clamp(elapsed / ORBIT_MS) * 80}%`;
                cursors.forEach((cursor, index) => orbit(cursor, index, elapsed, delta));
            } else {
                const drawing = now - buildStarted;
                const fade = 1 - clamp((drawing - 1080) / 320);
                guides?.setAttribute('opacity', Math.min(drawing / 150, fade));
                ruler?.setAttribute('opacity', Math.min(drawing / 150, fade));
                targets.forEach(target => {
                    const progress = clamp((drawing - target.start - 160) / target.duration);
                    const visible = drawing >= target.start + 110;
                    target.group.setAttribute('opacity', visible ? 1 - clamp((drawing - target.start - target.duration - 380) / 220) : 0);
                    target.outline.setAttribute('stroke-dashoffset', 1 - progress);
                    target.handles.setAttribute('opacity', progress > .05 ? 1 : 0);
                    if (progress === 1 && !target.revealed) {
                        target.revealed = true;
                        if (!target.nav) target.node.classList.add('swarm-card-visible');
                    }
                });
                writers.forEach(writer => updateWriter(writer, drawing));
                cursors.forEach((cursor, index) => {
                    const target = targets[index % targets.length];
                    const local = drawing - target.start;
                    const helper = index >= targets.length;
                    const active = target.writers.filter(writer => !writer.restored && writer.point && drawing >= writer.start);
                    const writer = active[Math.floor(index / targets.length)];
                    if (writer) {
                        cursorTool(cursor, 'text');
                        cursor.x = writer.point.x;
                        cursor.y = writer.point.y;
                        cursor.angle = 0;
                        cursor.node.style.opacity = 1;
                        cursor.node.classList.add('is-working');
                        return;
                    }
                    cursorTool(cursor, 'arrow');
                    const progress = clamp((local - 160) / target.duration);
                    const point = perimeterPoint(target.box, helper ? clamp(progress + .33) : progress);
                    const travel = ease(local / 220);
                    const departing = ease((drawing - (BUILD_MS - 360) - index * 3) / 320);
                    let x = lerp(cursor.from.x, point.x, travel);
                    let y = lerp(cursor.from.y, point.y, travel);
                    x = lerp(x, index % 2 ? width + 50 : -50, departing);
                    y += Math.sin(travel * Math.PI) * (helper ? -25 : 25);
                    cursor.x = x; cursor.y = y;
                    cursor.angle = local > 200 && progress < 1 ? point.angle + 128 : 0;
                    cursor.node.style.opacity = helper ? .72 : 1;
                    cursor.node.classList.toggle('is-working', !helper && local > 160 && progress < 1);
                });
                if (drawing >= BUILD_MS) {
                    loader.classList.add('is-leaving');
                    exitTimer = setTimeout(() => finish('complete'), OUTRO_MS);
                    return;
                }
            }
            for (const cursor of cursors) {
                const textTool = cursor.tool === 'text';
                cursor.node.style.transform = `translate(${cursor.x - (textTool ? 12 : 4)}px, ${cursor.y - (textTool ? 12 : 3)}px)`;
                cursor.icon.style.transform = `rotate(${cursor.angle}deg)`;
                cursor.icon.style.transformOrigin = textTool ? '12px 12px' : '4px 3px';
            }
            frame = requestAnimationFrame(drawFrame);
        } catch (error) {
            console.warn('Portfolio intro skipped:', error);
            finish('error');
        }
    }

    function start() {
        if (boot.done) return;
        try {
            if (motion.matches) return boot.release('reduced');
            if (getComputedStyle(root).getPropertyValue('--swarm-loader-ready').trim() !== '1') return boot.release('no-style');
            container = document.querySelector('body > .container');
            if (!container) return boot.release('no-content');
            width = innerWidth; height = innerHeight;
            const wasInert = container.inert;
            const previousBusy = container.getAttribute('aria-busy');
            container.inert = true;
            container.setAttribute('aria-busy', 'true');
            boot.restore = () => {
                try { restoreTyping(); }
                finally {
                    container.inert = wasInert;
                    if (previousBusy === null) container.removeAttribute('aria-busy');
                    else container.setAttribute('aria-busy', previousBusy);
                }
            };
            const chinese = root.lang.startsWith('zh');
            loader = document.createElement('div');
            loader.id = 'swarm-loader';
            loader.innerHTML = `<div class="swarm-paper" aria-hidden="true"></div>
                <div class="swarm-intro" aria-hidden="true"><div class="swarm-monogram">TW</div><div class="swarm-signature">TAILONG WU</div></div>
                <div class="swarm-caption" role="status" aria-live="polite"><div class="swarm-status"><span class="swarm-status-label"><i class="swarm-status-dot"></i>${chinese ? '正在召集智能体' : 'Gathering the swarm'}</span><span>${chinese ? '18 个智能体' : '18 agents'}</span></div><div class="swarm-track" aria-hidden="true"><div class="swarm-track-fill"></div></div></div>
                <svg class="swarm-surface" viewBox="0 0 ${width} ${height}" aria-hidden="true"></svg>
                <button type="button" class="swarm-skip" id="swarm-skip">${chinese ? '跳过开场' : 'Skip intro'} <span aria-hidden="true">↗</span></button>`;
            document.body.append(loader);
            surface = loader.querySelector('svg');
            track = loader.querySelector('.swarm-track-fill');
            const labels = chinese ? ['布局', '机器人', '视觉语言动作', '智能体', '研究', '代码', '设计', '联系'] : ['layout', 'robotics', 'VLA', 'agents', 'research', 'code', 'design', 'contact'];
            cursors = Array.from({ length: 18 }, (_, index) => createCursor(index, labels));
            // Start in a ring, not as a pile of arrows at the centre.
            cursors.forEach((cursor, index) => {
                const angle = index / cursors.length * Math.PI * 2;
                const radius = width < 600 ? 87 : 105;
                cursor.x = width / 2 + Math.cos(angle) * radius;
                cursor.y = height / 2 - 8 + Math.sin(angle) * radius * .86;
            });
            listen(loader.querySelector('button'), 'click', () => finish('skipped'));
            listen(document, 'keydown', event => {
                if (['Escape', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) {
                    finish('skipped');
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
                }
            }, true);
            listen(window, 'resize', () => { if (Math.abs(innerWidth - width) > 2 || Math.abs(innerHeight - height) > 2) finish('resized'); });
            // A visitor who starts navigating should never wait for decorative motion.
            listen(window, 'scroll', () => finish('scrolled'), { passive: true });
            listen(window, 'pagehide', () => finish('restored'));
            listen(document, 'visibilitychange', () => { if (document.hidden) finish('background'); });
            listen(motion, 'change', () => { if (motion.matches) finish('reduced'); });
            listen(window, 'swarm:finished', cleanup);
            const fontReady = document.fonts ? document.fonts.ready : Promise.resolve();
            Promise.race([fontReady, new Promise(resolve => { fontTimer = setTimeout(resolve, 650); })])
                .then(() => { ready = true; clearTimeout(fontTimer); });
            began = performance.now();
            root.dataset.swarmState = 'orbit';
            frame = requestAnimationFrame(drawFrame);
        } catch (error) {
            console.warn('Portfolio intro skipped:', error);
            finish('error');
        }
    }

    // Window receives DOMContentLoaded after the existing document-level theme/i18n handlers.
    if (document.readyState === 'complete') start();
    else listen(window, 'DOMContentLoaded', start, { once: true });
})();
