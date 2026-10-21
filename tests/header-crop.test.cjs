const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/Comfortable_Gakujo.user.js', 'utf8');
const cropSource = source.slice(source.indexOf('    function headerCropRectangle('), source.indexOf('    function installHeaderBackgroundSettings('));
const image = { naturalWidth: 2000, naturalHeight: 1000 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);

test('crop keeps the page background aspect ratio and stays inside the image', () => {
    const context = vm.createContext({});
    vm.runInContext(cropSource, context);
    const center = context.headerCropRectangle(image);
    near(center.width / center.height, 16 / 9);
    near(center.x, (2000 - center.width) / 2);
    near(context.headerCropRectangle(image, { y: 0 }).y, 0);
    const bottom = context.headerCropRectangle(image, { y: 1 });
    near(bottom.y + bottom.height, 1000);
});

test('zoom permits moving on both axes and clamps the crop inside any image', () => {
    const context = vm.createContext({});
    vm.runInContext(cropSource, context);
    for (const img of [image, { width: 3000, height: 100 }, { width: 100, height: 3000 }, { width: 12, height: 8 }]) {
        for (const selection of [{ x: -1, y: 2, zoom: 2 }, { x: 1, y: 1, zoom: 4 }, { x: NaN, y: Infinity, zoom: -1 }]) {
            const crop = context.headerCropRectangle(img, selection);
            assert.ok(crop.x >= 0 && crop.y >= 0);
            assert.ok(crop.x + crop.width <= (img.naturalWidth || img.width) + 0.001);
            assert.ok(crop.y + crop.height <= (img.naturalHeight || img.height) + 0.001);
            near(crop.width / crop.height, 16 / 9);
        }
    }
    const crop = context.headerCropRectangle(image, { x: 1, y: 1, zoom: 2 });
    near(crop.width, 8000 / 9);
    near(crop.x, 10000 / 9);
});

test('selection follows the viewport ratio on wide and narrow screens', () => {
    const context = vm.createContext({});
    vm.runInContext(cropSource, context);
    for (const ratio of [2200 / 1000, 390 / 760]) {
        const crop = context.headerCropRectangle(image, { x: 1, y: 1, zoom: 2 }, ratio);
        near(crop.width / crop.height, ratio);
        near(crop.x + crop.width, 2000);
        near(crop.y + crop.height, 1000);
    }
});

function setupEditor(save) {
    const nodes = [];
    const draws = [];
    function element(tagName) {
        const node = { tagName, style: {}, children: [], listeners: {},
            append(...children) { children.forEach(child => this.appendChild(child)); },
            appendChild(child) { child.parentNode = this; this.children.push(child); },
            setAttribute() {},
            addEventListener(name, fn) { this.listeners[name] = fn; },
            click() { this.listeners.click?.(); },
            remove() { this.removed = true; },
            showModal() { this.open = true; },
            close(value) { this.returnValue = value; this.open = false; this.listeners.close?.(); },
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 250 }),
            setPointerCapture() {},
        };
        if (tagName === 'canvas') node.getContext = () => ({
            drawImage: (...args) => draws.push(args),
            fillRect() {}, save() {}, beginPath() {}, rect() {}, clip() {}, restore() {}, strokeRect() {},
        });
        nodes.push(node);
        return node;
    }
    const context = vm.createContext({ document: { createElement: element, body: element('body') } });
    vm.runInContext(cropSource, context);
    const promise = context.chooseHeaderCrop(image, save);
    return { nodes, draws, promise, byId: id => nodes.find(node => node.id === id),
        button: text => nodes.find(node => node.tagName === 'button' && node.textContent === text) };
}

test('dragging and sliders select a region; saving exports only that region', async () => {
    let saved;
    const state = setupEditor(canvas => { saved = canvas; });
    const zoom = state.byId('cg-header-crop-zoom');
    zoom.value = '2';
    zoom.listeners.input();
    const preview = state.nodes.find(node => node.tagName === 'canvas');
    preview.listeners.pointerdown({ pointerId: 1, clientX: 250, clientY: 125, preventDefault() {} });
    preview.listeners.pointermove({ pointerId: 1, clientX: 500, clientY: 250 });
    preview.listeners.pointerup({ pointerId: 1 });
    state.button('この範囲で保存').click();
    assert.equal(await state.promise, true);
    const draw = state.draws.at(-1);
    near(draw[1], 10000 / 9);
    near(draw[2] + draw[4], 1000);
    near(draw[3] / draw[4], 16 / 9);
    assert.equal(saved.width, 889);
    assert.equal(saved.height, 500);
    assert.equal(state.byId('cg-header-crop-dialog').removed, true);
});

test('cancel leaves the existing background untouched', async () => {
    const state = setupEditor(() => assert.fail('unexpected save'));
    state.button('キャンセル').click();
    assert.equal(await state.promise, false);
});

test('save errors keep the editor open so the selected range can be adjusted', async () => {
    const state = setupEditor(() => { throw new Error('保存できません'); });
    state.button('この範囲で保存').click();
    assert.equal(state.byId('cg-header-crop-dialog').open, true);
    assert.equal(state.byId('cg-header-crop-error').textContent, '保存できません');
    state.button('キャンセル').click();
    await state.promise;
});
