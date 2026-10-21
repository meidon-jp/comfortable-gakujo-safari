const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/Comfortable_Gakujo.user.js', 'utf8');
const helpers = source.slice(source.indexOf('    function waitForSelector('), source.indexOf('    // Check existing content'));

test('existing elements are ready without a polling or stabilization delay', async () => {
    const node = {};
    const context = vm.createContext({ document: { querySelector: () => node },
        setTimeout: () => assert.fail('unexpected timer'), MutationObserver: class { constructor() { assert.fail('unexpected observer'); } } });
    vm.runInContext(helpers, context);
    assert.equal(await context.waitForSelector('.ready'), node);
});

test('later elements initialize on their first mutation and release the timeout', async () => {
    let node, notify, disconnected = false, cleared = false;
    const context = vm.createContext({ document: { documentElement: {}, querySelector: () => node },
        setTimeout: () => 7, clearTimeout: id => { assert.equal(id, 7); cleared = true; },
        MutationObserver: class { constructor(callback) { notify = callback; } observe() {} disconnect() { disconnected = true; } } });
    vm.runInContext(helpers, context);
    const promise = context.waitForSelector('.later');
    node = {};
    notify();
    assert.equal(await promise, node);
    assert.equal(disconnected, true);
    assert.equal(cleared, true);
});

function earlyPage({ embedded = false, hostname = 'gakujo.shizuoka.ac.jp', ready = false } = {}) {
    const nodes = new Map();
    let available = ready, notify, disconnected = false;
    const classes = new Set();
    const appendChild = node => nodes.set(node.id, node);
    const frame = {};
    const context = vm.createContext({
        window: { self: frame, top: embedded ? {} : frame }, location: { hostname },
        document: { body: null, head: null,
            documentElement: { appendChild, classList: { add: name => classes.add(name) } },
            querySelector: () => available ? { appendChild } : null,
            getElementById: id => nodes.get(id),
            createElement: () => ({ textContent: '', setAttribute(name, value) { this[name] = value; } }) },
        MutationObserver: class { constructor(callback) { notify = callback; } observe() {} disconnect() { disconnected = true; } },
        localStorage: { getItem: () => 'data:image/png;base64,old' }, console,
    });
    vm.runInContext(helpers, context);
    return { context, nodes, classes, ready() { available = true; notify(); }, disconnected: () => disconnected };
}

test('page background CSS is installed before body parsing; its layer waits for the real page shell', () => {
    const state = earlyPage();
    state.context.installEarlyAppearance();
    const style = state.nodes.get('cg-early-appearance');
    assert.match(style.textContent, /position: fixed/);
    assert.match(style.textContent, /data:image\/png;base64,old/);
    assert.match(style.textContent, /:not\(\[data-cg-background-ready\]\)/);
    assert.equal(state.nodes.has('cg-page-background'), false);
    state.ready();
    const layer = state.nodes.get('cg-page-background');
    assert.equal(layer['aria-hidden'], 'true');
    assert.equal(state.classes.has('cg-page-appearance'), true);
    assert.equal(state.disconnected(), true);
    state.context.installEarlyAppearance();
    assert.equal(state.nodes.get('cg-early-appearance'), style);
    assert.equal(state.nodes.get('cg-page-background'), layer);
});

test('background never modifies SSO or embedded pages', () => {
    for (const options of [{ hostname: 'idp.shizuoka.ac.jp', ready: true }, { embedded: true, ready: true }]) {
        const state = earlyPage(options);
        state.context.installEarlyAppearance();
        assert.equal(state.nodes.size, 0);
        assert.equal(state.classes.size, 0);
    }
});
