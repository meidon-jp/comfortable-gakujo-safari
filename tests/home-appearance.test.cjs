const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/Comfortable_Gakujo.user.js', 'utf8');

function frameContext() {
    const context = vm.createContext({ URL, console,
        location: { origin: 'https://gakujo.shizuoka.ac.jp', href: 'https://gakujo.shizuoka.ac.jp/lcu-web/home' } });
    vm.runInContext(source.slice(source.indexOf('    function styleHomeGradeFrame('), source.indexOf('    function installHomeAppearance(')), context);
    return context;
}

test('grade transparency is added once per document and restored after frame navigation', () => {
    const context = frameContext();
    const document = () => ({ styles: [], head: { appendChild(style) { doc.styles.push(style); } },
        createElement: () => ({}), getElementById: id => doc.styles.find(style => style.id === id) });
    let doc = document();
    const frame = { src: '/lcu-web/SC_01002B00_01/recordDashBoard', get contentDocument() { return doc; } };
    context.styleHomeGradeFrame(frame);
    context.styleHomeGradeFrame(frame);
    assert.equal(doc.styles.length, 1);
    doc = document();
    context.styleHomeGradeFrame(frame);
    assert.equal(doc.styles.length, 1);
});

test('other frames and foreign origins are never inspected or modified', () => {
    const context = frameContext();
    for (const src of ['https://example.com/recordDashBoard', '/lcu-web/file-preview', 'about:blank']) {
        context.styleHomeGradeFrame({ src, get contentDocument() { assert.fail('unrelated frame accessed'); } });
    }
    context.styleHomeGradeFrame({ src: '/lcu-web/SC_01002B00_01/recordDashBoard', contentDocument: null });
});

function node() {
        return { children: [], style: {}, classList: { add() {} },
            appendChild(child) {
                if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(item => item !== child);
                this.children.push(child); child.parentElement = this;
            },
            append(...children) { children.forEach(child => this.appendChild(child)); },
            get lastElementChild() { return this.children.at(-1); },
            querySelector(selector) {
                for (const child of this.children) {
                    if (`#${child.id}` === selector) return child;
                    const match = child.querySelector?.(selector);
                    if (match) return match;
                }
                return null;
            },
            removeAttribute() {},
        };
}

test('portal notice replacement preserves grade controls and a single countdown', () => {
    const grade = node(), input = node(); input.id = 'cg-grade-save-toggle'; grade.append(input);
    let panel = node(), tick, listReady = true;
    const backgrounds = [], cached = [];
    panel.append(node());
    const context = vm.createContext({ Date, console, nearestHomeDeadline: () => Infinity,
        cacheHomeDeadlines: texts => cached.push(texts), updateDeadlineBackground: (visual, remaining) => backgrounds.push(remaining),
        window: { addEventListener() {} }, setInterval: callback => { tick = callback; },
        document: {
            getElementById: id => panel?.querySelector(`#${id}`), createElement: node, head: { appendChild() {} },
            querySelector: selector => selector === '.index-notice-other-items' ? panel
                : selector === '.submissionList' && listReady ? { querySelectorAll: () => [], querySelector: () => null } : null,
        } });
    vm.runInContext(source.slice(source.indexOf('    function installHomeTaskCountdown('), source.indexOf('    function formatClassPeriod(')), context);
    context.installHomeTaskCountdown(null, grade);
    const countdown = panel.querySelector('#cg-home-task-countdown');
    assert.ok(countdown);
    assert.equal(panel.querySelector('#cg-grade-save-toggle'), input);
    panel = node(); panel.append(node()); // The university replaces its notice markup.
    tick(); tick();
    assert.equal(panel.querySelector('#cg-grade-save-toggle'), input);
    assert.equal(panel.querySelector('#cg-home-task-countdown'), countdown);
    assert.equal(panel.children.length, 3);
    assert.equal(cached.length, 3);
    const renders = backgrounds.length;
    listReady = false;
    tick();
    panel = null;
    tick();
    assert.equal(backgrounds.length, renders, 'incomplete portal markup must preserve the initial cached background');
    assert.equal(cached.length, 3, 'incomplete markup must not clear cached deadlines');
});

for (const [urgency, hours] of [['warning', 36], ['critical', 12]]) {
    test(`reload keeps the ${urgency} background throughout asynchronous task loading`, () => {
        const now = Date.parse('2026-10-22T00:00:00+09:00');
        const deadline = now + hours * 3600000;
        let loading = true, items = [], tick;
        const panel = node(), visual = { dataset: { cgDeadlineUrgency: urgency } };
        const transitions = [], cacheWrites = [];
        const list = {
            // This spinner is present in the server HTML. The portal removes it in its AJAX success callback.
            querySelector: selector => selector === '#notSubmitReading' && loading ? {} : null,
            querySelectorAll: () => items,
        };
        const context = vm.createContext({ console, Date: class extends Date { static now() { return now; } },
            cacheHomeDeadlines: texts => cacheWrites.push(Array.from(texts)),
            window: { addEventListener() {} }, setInterval: callback => { tick = callback; },
            document: { getElementById: id => panel.querySelector(`#${id}`), createElement: node, head: { appendChild() {} },
                querySelector: selector => selector === '.submissionList' ? list : panel },
        });
        vm.runInContext(source.slice(source.indexOf('    function formatTimeLeft('), source.indexOf('    function formatClassPeriod(')), context);
        context.installHomeTaskCountdown({ settings: { warningDays: 2 }, render(remaining) {
            context.updateDeadlineBackground(visual, remaining, 2);
            transitions.push(visual.dataset.cgDeadlineUrgency);
        } });
        tick(); tick(); // The response can take longer than one countdown interval.
        assert.deepEqual(transitions, [], 'loading is not an authoritative empty task list');
        assert.deepEqual(cacheWrites, [], 'loading must not erase the deadline cache used on reload');
        assert.equal(visual.dataset.cgDeadlineUrgency, urgency);

        loading = false;
        const text = new Date(deadline + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ').replaceAll('-', '/');
        items = [{ classList: { contains: () => true }, querySelector: () => ({ textContent: text }) }];
        tick(); tick();
        assert.deepEqual(transitions, [urgency, urgency], 'normal must never appear between cached and live deadlines');
        assert.deepEqual(cacheWrites, [[text], [text]]);

        items = []; // A completed empty response must still restore the normal background.
        tick();
        assert.equal(visual.dataset.cgDeadlineUrgency, undefined);
        assert.deepEqual(cacheWrites.at(-1), []);
    });
}
