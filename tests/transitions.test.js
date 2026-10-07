const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {};
vm.runInNewContext(fs.readFileSync('ExpressionShelf_Web/shelf-core.js', 'utf8'), context);
const core = context.ESCore;
const transitions = core.BUILTINS.filter((preset) => preset.transition);
assert.strictEqual(transitions.length, 28);
assert.strictEqual(new Set(transitions.map((preset) => preset.id)).size, transitions.length);

for (const preset of transitions) {
  const values = preset.params.map((param) => param.value);
  const code = core.buildCode(preset, values, {ms: preset.ms, ease: preset.ease});
  const parts = core.parseParts(code, preset.target);
  assert(parts.length > 0, preset.id + ' should generate expression parts');
  for (const part of parts) {
    assert(core.TARGET_NAMES.includes(part.target) || core.EFFECTS.some((effect) => effect.name === part.target), preset.id + ': unknown target ' + part.target);
  }
}

assert(core.EFFECTS.some((effect) => effect.name === '원형 와이프' && effect.fx === 'ADBE Radial Wipe'));
assert(core.EFFECTS.some((effect) => effect.name === '셔터 와이프' && effect.fx === 'ADBE Venetian Blinds'));
assert(core.EFFECTS.some((effect) => effect.name === '블록 디졸브' && effect.fx === 'ADBE Block Dissolve'));
for (const id of ['tr_film_burn','tr_flash_cut','tr_color_sweep']) {
  const preset = core.findBuiltin(id), values = preset.params.map((param) => param.value);
  const parts = core.buildOverlayParts(id, values, {ms:preset.ms, ease:preset.ease});
  assert.strictEqual(Array.from(parts, (part) => part.target).join(','), '위치,불투명도');
  assert(parts.every((part) => part.code.includes('time - inPoint - ES_DELAY')));
}
console.log('Transition catalog/code tests passed.');
