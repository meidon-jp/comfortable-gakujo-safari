const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/Comfortable_Gakujo.user.js', 'utf8');
const helpers = source.slice(source.indexOf('    function prepareHeaderImage('), source.indexOf('    function installHeaderBackgroundSettings('));

function setup({ png = 'data:image/png;base64,small', jpeg = 'data:image/jpeg;base64,small', noContext = false } = {}) {
    const draws = [], exports = [], fills = [];
    const ctx = { drawImage: (...args) => draws.push(args), fillRect: (...args) => fills.push(args) };
    const canvas = { getContext: () => noContext ? null : ctx, toDataURL(type, quality) {
        exports.push([type, quality]);
        return type === 'image/png' ? png : jpeg;
    } };
    const context = vm.createContext({ document: { createElement(tag) { assert.equal(tag, 'canvas'); return canvas; } } });
    vm.runInContext(helpers, context);
    return { context, canvas, draws, exports, fills, ctx };
}

test('whole landscape and portrait images are saved without a viewport-dependent crop', () => {
    for (const [width, height, outW, outH] of [[4000, 2000, 2048, 1024], [1000, 5000, 410, 2048], [137, 89, 137, 89]]) {
        const state = setup();
        const image = { naturalWidth: width, naturalHeight: height };
        assert.equal(state.context.prepareHeaderImage(image), 'data:image/png;base64,small');
        assert.equal(state.canvas.width, outW);
        assert.equal(state.canvas.height, outH);
        // Five arguments scale the entire source; there is no source crop rectangle.
        assert.deepEqual(state.draws, [[image, 0, 0, outW, outH]]);
        assert.deepEqual(state.exports, [['image/png', undefined]]);
    }
});

test('large PNG falls back to JPEG after placing white behind transparent pixels', () => {
    const state = setup({ png: 'x'.repeat(3 * 1024 * 1024 + 1) });
    assert.equal(state.context.prepareHeaderImage({ width: 800, height: 600 }), 'data:image/jpeg;base64,small');
    assert.equal(state.ctx.globalCompositeOperation, 'destination-over');
    assert.equal(state.ctx.fillStyle, 'white');
    assert.deepEqual(state.fills, [[0, 0, 800, 600]]);
    assert.deepEqual(state.exports, [['image/png', undefined], ['image/jpeg', 0.9]]);
});

test('oversized encoded image reports an error before saving', () => {
    const large = 'x'.repeat(3 * 1024 * 1024 + 1);
    const { context } = setup({ png: large, jpeg: large });
    assert.throws(() => context.prepareHeaderImage({ width: 800, height: 600 }), /3MB以下/);
});

test('invalid image dimensions and unavailable canvas report readable errors', () => {
    assert.throws(() => setup().context.prepareHeaderImage({ width: 0, height: 0 }), /サイズ/);
    assert.throws(() => setup({ noContext: true }).context.prepareHeaderImage({ width: 800, height: 600 }), /処理できません/);
});
