const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const window = {};
vm.runInNewContext(fs.readFileSync('ExpressionShelf_Web/updater.js', 'utf8'), { window, Buffer, URL });
const updater = window.ESUpdater;
assert.strictEqual(updater.compareVersions('0.6.10', '0.6.9'), 1);
assert.strictEqual(updater.compareVersions('1.0.0', '1.0.0'), 0);
assert.strictEqual(updater.compareVersions('0.6.0', '0.6.1'), -1);

const good = {
  schema: 1,
  version: '0.6.2',
  repository: 'luseuss/plugin',
  extension_id: 'com.expressionshelf.web.panel',
  url: 'https://github.com/luseuss/plugin/releases/download/v0.6.2/ExpressionShelf_Web.zip',
  sha256: 'a'.repeat(64),
  size: 1024
};
assert.strictEqual(updater.validateFeed(good), good);
assert.throws(() => updater.validateFeed({...good, url: 'http://example.com/update.zip'}), /주소|체크섬/);
assert.throws(() => updater.validateFeed({...good, repository: 'attacker/plugin'}), /형식/);
assert.throws(() => updater.validateFeed({...good, size: 30 * 1024 * 1024}), /주소|체크섬/);
console.log('Updater version/feed tests passed.');
