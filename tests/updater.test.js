const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const EventEmitter = require('events');

const zip = Buffer.from('mock verified update zip');
const spawnCalls = [];
const child = {
  spawn(command, args) {
    spawnCalls.push({command, args});
    const proc = new EventEmitter();
    proc.unref = () => {};
    setImmediate(() => proc.emit('spawn'));
    return proc;
  }
};
const https = {
  get(url, options, callback) {
    const req = new EventEmitter();
    req.destroy = (error) => req.emit('error', error);
    setImmediate(() => {
      const res = new EventEmitter();
      res.statusCode = 200;
      res.headers = {};
      res.resume = () => {};
      callback(res);
      res.emit('data', zip);
      res.emit('end');
    });
    return req;
  }
};
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'es-updater-test-'));
const window = {cep_node:{require(name){ return ({fs,path,os,https,crypto,child_process:child})[name]; }}};
vm.runInNewContext(fs.readFileSync('ExpressionShelf_Web/updater.js', 'utf8'), { window, Buffer, URL });
const updater = window.ESUpdater;
assert.strictEqual(updater.currentVersion, '0.6.5');
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

(async () => {
  try {
    const testFeed = {...good, version:'0.6.5', url:'https://github.com/luseuss/plugin/releases/download/v0.6.5/ExpressionShelf_Web.zip', size:zip.length, sha256:crypto.createHash('sha256').update(zip).digest('hex')};
    await updater.downloadAndSchedule(testFeed, path.join(tempRoot, 'extensions', 'ExpressionShelf_Web'));
    assert.strictEqual(spawnCalls.length, 1);
    assert.strictEqual(spawnCalls[0].command, 'powershell.exe');
    assert(spawnCalls[0].args.includes('-ExecutionPolicy'));
    assert(spawnCalls[0].args.includes('Bypass'));
    const psPath = spawnCalls[0].args[spawnCalls[0].args.indexOf('-File') + 1];
    const script = fs.readFileSync(psPath, 'utf8');
    assert(script.includes('PowerShell 설치 도우미 시작'));
    assert(script.includes('설치 실패:'));
    assert(fs.existsSync(path.join(os.tmpdir(), 'ExpressionShelf_update_log.txt')));
    console.log('Updater version/feed/install-launch tests passed.');
  } finally {
    fs.rmSync(tempRoot, {recursive:true, force:true});
    fs.rmSync(path.join(os.tmpdir(), 'ExpressionShelf_Update_v0.6.5'), {recursive:true, force:true});
    fs.rmSync(path.join(os.tmpdir(), 'ExpressionShelf_update_log.txt'), {force:true});
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
