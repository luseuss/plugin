const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const folders = new Set(['/Documents']);
const files = new Map();
class Folder {
  constructor(path) { this.fsName = path; this.name = path.split('/').pop(); }
  get exists() { return folders.has(this.fsName); }
  create() { folders.add(this.fsName); return true; }
  getFiles(pattern) {
    return Array.from(files.keys()).filter((p) => p.indexOf(this.fsName + '/') === 0 && (!pattern || p.endsWith('.espreset'))).map((p) => new File(p));
  }
  execute() { return true; }
}
Folder.myDocuments = new Folder('/Documents');
class File {
  constructor(path) { this.fsName = path; this.name = path.split('/').pop(); this.encoding = 'UTF-8'; }
  get exists() { return files.has(this.fsName); }
  get length() { return (files.get(this.fsName) || '').length; }
  open(mode) { this.mode = mode; this.buffer = mode === 'r' ? (files.get(this.fsName) || '') : ''; return mode === 'r' ? files.has(this.fsName) : true; }
  read() { return this.buffer; }
  write(value) { this.buffer += value; return true; }
  close() { if (this.mode === 'w') files.set(this.fsName, this.buffer); }
  remove() { return files.delete(this.fsName); }
}
const context = {Folder, File, Math, Date, isFinite, encodeURIComponent, decodeURIComponent};
vm.createContext(context);
vm.runInContext(fs.readFileSync('ExpressionShelf_Web/shelf-core.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('ExpressionShelf_Web/host/host.jsx', 'utf8'), context);
vm.runInContext(fs.readFileSync('ExpressionShelf_Web/host/presets.jsx', 'utf8'), context);
context.ES_STATE.ready = true;
const motion = context.ESCore.findBuiltin('fade');
assert(motion, 'source motion exists');
const payload = {name:'My Bounce',recipe:motion.recipe,ms:motion.ms,ease:motion.ease,values:motion.params.map(p=>p.value),preview:'shape',sampleText:'MOTION',start:'0.2',stagger:'0.1',overwrite:false,code:context.ESCore.buildCode(motion,motion.params.map(p=>p.value),{ms:motion.ms,ease:motion.ease})};
const save = JSON.parse(vm.runInContext('ES_presetSave(' + JSON.stringify(payload) + ')', context));
assert(save.ok, save.error);
assert.strictEqual(save.item.name, 'My Bounce');
assert.strictEqual(save.item.start, 0.2);
const id = save.item.id;
const list = JSON.parse(vm.runInContext('ES_presetList()', context));
assert(list.ok && list.items.length === 1);
assert.strictEqual(list.items[0].code, payload.code);
const loaded = JSON.parse(vm.runInContext('ES_presetGet({id:' + JSON.stringify(id) + '})', context));
assert(loaded.ok && loaded.item.values.length === motion.params.length);
const rejected = JSON.parse(vm.runInContext("ES_presetGet({id:'../../bad'})", context));
assert.strictEqual(rejected.ok, false);
const deleted = JSON.parse(vm.runInContext('ES_presetDelete({id:' + JSON.stringify(id) + '})', context));
assert(deleted.ok);
assert.strictEqual(JSON.parse(vm.runInContext('ES_presetList()', context)).items.length, 0);
console.log('User preset persistence, validation, retrieval and deletion tests passed.');
