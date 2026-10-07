const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let items = [], active = null, nextId = 1, installs = [];
class Property {
  constructor() { this.value = null; this.children = {}; this.canSetExpression = true; this.expression = ''; this.expressionEnabled = false; }
  property(key) {
    if (!this.children[key]) {
      this.children[key] = new Property();
      if (key === 'ADBE Text Document') this.children[key].value = {fontSize:72, applyFill:true, fillColor:[1,1,1], applyStroke:false, justification:1};
    }
    return this.children[key];
  }
  addProperty(key) { return this.property(key); }
  setValue(value) { this.value = value; }
}
class Layer {
  constructor(comp, source) {
    this.containingComp = comp; this.source = source; this.root = new Property(); this.inPoint = 0; this.outPoint = 6;
    this.index = comp.list.length + 1; this.id = nextId++; this.name = 'Layer'; this.comment = ''; this.locked = false;
    this.threeDLayer = false; this.parent = null; this.adjustmentLayer = false; this.nullLayer = false; this.hasTrackMatte = false;
  }
  property(key) { return this.root.property(key); }
  sourceRectAtTime() { return {left:0, top:0, width:400, height:80}; }
  moveBefore() {}
  remove() { this.containingComp.list = this.containingComp.list.filter((layer) => layer !== this); this.removed = true; }
}
class CompItem {
  constructor(name, width, height, duration, frameRate) {
    this.name = name; this.width = width; this.height = height; this.duration = duration; this.frameRate = frameRate;
    this.time = 0; this.list = []; this.selectedLayers = [];
    this.layers = {add:(source) => this.add(source), addShape:() => this.add(null), addText:() => this.add(null)};
    items.push(this);
  }
  get numLayers() { return this.list.length; }
  layer(i) { return this.list[i - 1]; }
  add(source) { const layer = new Layer(this, source); this.list.push(layer); return layer; }
  get usedIn() { return items.filter((comp) => !comp.removed && comp.list.some((layer) => layer.source === this)); }
  openInViewer() { active = this; }
  remove() { this.removed = true; this.name = undefined; this.list = []; }
}

const host = {
  CompItem,
  ParagraphJustification:{CENTER_JUSTIFY:1},
  BlendingMode:{ADD:'add', SCREEN:'screen'},
  app:{project:{items:{addComp:(name,w,h,pa,d,fr) => new CompItem(name,w,h,d,fr)},get activeItem(){return active;}},beginUndoGroup(){},endUndoGroup(){}}
};
vm.createContext(host);
vm.runInContext(fs.readFileSync('ExpressionShelf_Web/shelf-core.js','utf8'), host);
vm.runInContext(fs.readFileSync('ExpressionShelf_Web/host/host.jsx','utf8'), host);
host.ES_STATE.ready = true;
host.ESCore.install = (layer, data) => { installs.push({layer, recipe:data.p.recipe, parts:data.parts}); return {skip:false}; };

function makeRequest(id) {
  const preset = host.ESCore.findBuiltin(id), values = preset.params.map((param) => param.value);
  return {p:{id,recipe:id,target:0}, values, code:host.ESCore.buildCode(preset, values, {ms:preset.ms,ease:preset.ease}),
    motion:{ms:preset.ms,ease:preset.ease}, start:0, stagger:0};
}
for (const id of ['tr_film_burn','tr_flash_cut','tr_color_sweep']) {
  const response = JSON.parse(vm.runInContext('ES_preview(' + JSON.stringify(makeRequest(id)) + ')', host));
  assert(response.ok, id + ': ' + response.error);
  const rig = host.ES_STATE.previewLayers;
  assert.strictEqual(rig.length, 3, id + ' preview should include A, B and its overlay');
  assert(rig.some((layer) => layer.name.indexOf('ES ') === 0), id + ' overlay layer missing');
  assert(installs.some((entry) => entry.recipe === 'custom' && entry.parts.length === 2), id + ' overlay expressions missing');
}

const target = new CompItem('Apply target',960,540,6,30), selected = target.add(null);
selected.name = 'Scene B'; target.selectedLayers = [selected]; active = target;
const applied = JSON.parse(vm.runInNewContext('ES_apply(' + JSON.stringify(makeRequest('tr_film_burn')) + ')', host));
assert(applied.ok, applied.error);
assert.strictEqual(applied.applied, 1);
assert.strictEqual(applied.failed, 0);
assert(target.list.some((layer) => layer.name.indexOf('ES Film Burn') === 0));
console.log('Transition host tests passed: overlay preview, cleanup, expression setup, and selected-layer application.');
