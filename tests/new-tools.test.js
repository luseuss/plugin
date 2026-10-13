const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {};
vm.runInNewContext(fs.readFileSync('ExpressionShelf_Web/shelf-core.js', 'utf8'), context);
const core = context.ESCore;

const depth = core.findBuiltin('camera_depth_fade');
assert(depth, 'camera depth fade preset exists');
assert.deepStrictEqual(Array.from(depth.params, p => p.value), [1000, 5000]);
const code = core.buildCode(depth, depth.params.map(p => p.value));
assert(code.includes('thisComp.activeCamera') && code.includes('thisLayer.toWorld'));
assert.strictEqual(core.install({locked:false, threeDLayer:false}, {p:{recipe:depth.recipe}}, 0, false, 0).skip, true);
assert.match(core.install({locked:false, threeDLayer:false}, {p:{recipe:depth.recipe}}, 0, false, 0).message, /3D/);

const ui = fs.readFileSync('ExpressionShelf_Web/index.html', 'utf8');
const app = fs.readFileSync('ExpressionShelf_Web/app.js', 'utf8');
const host = fs.readFileSync('ExpressionShelf_Web/host/textbox.jsx', 'utf8');
assert(ui.includes('id="textToolsShelf"') && ui.includes('id="tbCreate"'));
assert(app.includes("callHost('ES_textbox'") && app.includes("camera_depth_fade"));
assert(host.includes('sourceRectAtTime(time,false)') && host.includes('ES Text Background'));
assert(fs.readFileSync('ExpressionShelf_Web/host/host.jsx', 'utf8').includes("host/textbox.jsx"));
console.log('Camera depth fade and text background tool checks passed.');
