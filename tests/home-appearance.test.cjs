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

test('portal notice replacement preserves grade controls and a single countdown', () => {
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
    const grade = node(), input = node(); input.id = 'cg-grade-save-toggle'; grade.append(input);
    let panel = node(), tick;
    panel.append(node());
    const context = vm.createContext({ Date, console, nearestHomeDeadline: () => Infinity, updateDeadlineBackground() {},
        window: { addEventListener() {} }, setInterval: callback => { tick = callback; },
        document: {
            getElementById: id => panel.querySelector(`#${id}`), createElement: node, head: { appendChild() {} },
            querySelector: selector => selector === '.index-notice-other-items' ? panel
                : selector === '.submissionList' ? { querySelectorAll: () => [] } : null,
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
});
