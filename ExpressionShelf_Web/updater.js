/* GitHub Releases updater for the CEP panel. */
(function (global) {
  'use strict';

  const CURRENT_VERSION = '0.6.1';
  const REPOSITORY = 'luseuss/plugin';
  const FEED_URL = 'https://github.com/' + REPOSITORY + '/releases/latest/download/latest.json';
  const MAX_ZIP_BYTES = 25 * 1024 * 1024;

  function nodeModules() {
    const bridge = global.cep_node;
    if (!bridge || typeof bridge.require !== 'function') throw new Error('CEP Node.js 기능을 찾을 수 없습니다. Expression Shelf를 다시 설치하고 After Effects를 재시작하세요.');
    return {
      fs: bridge.require('fs'), path: bridge.require('path'), os: bridge.require('os'),
      https: bridge.require('https'), crypto: bridge.require('crypto'), child: bridge.require('child_process')
    };
  }

  function compareVersions(a, b) {
    const aa = String(a).split('.').map(Number), bb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((aa[i] || 0) > (bb[i] || 0)) return 1;
      if ((aa[i] || 0) < (bb[i] || 0)) return -1;
    }
    return 0;
  }

  function validateFeed(data) {
    if (!data || data.schema !== 1 || data.repository !== REPOSITORY || data.extension_id !== 'com.expressionshelf.web.panel') throw new Error('업데이트 정보의 형식이 올바르지 않습니다.');
    if (!/^\d+\.\d+\.\d+$/.test(data.version || '') || !/^v\d+\.\d+\.\d+$/.test('v' + data.version)) throw new Error('버전 표기를 확인할 수 없습니다.');
    const expected = 'https://github.com/' + REPOSITORY + '/releases/download/v' + data.version + '/ExpressionShelf_Web.zip';
    if (data.url !== expected || !/^[a-f0-9]{64}$/i.test(data.sha256 || '') || !Number.isInteger(data.size) || data.size < 1 || data.size > MAX_ZIP_BYTES) throw new Error('업데이트 파일 주소 또는 체크섬 정보가 올바르지 않습니다.');
    return data;
  }

  function getBuffer(modules, url, maxBytes, redirects) {
    return new Promise((resolve, reject) => {
      if ((redirects || 0) > 5) { reject(new Error('다운로드 주소가 여러 번 변경되어 중단했습니다.')); return; }
      let parsed;
      try { parsed = new URL(url); } catch (e) { reject(new Error('다운로드 주소를 읽지 못했습니다.')); return; }
      if (parsed.protocol !== 'https:') { reject(new Error('보안 연결(HTTPS)만 허용됩니다.')); return; }
      const req = modules.https.get(parsed.href, { headers: { 'User-Agent': 'ExpressionShelf-Web-Updater', 'Accept': 'application/octet-stream, application/json' }, timeout: 30000 }, (res) => {
        if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location) {
          res.resume(); getBuffer(modules, new URL(res.headers.location, parsed).href, maxBytes, (redirects || 0) + 1).then(resolve, reject); return;
        }
        if (res.statusCode !== 200) { res.resume(); reject(new Error('GitHub 응답 오류 (HTTP ' + res.statusCode + '). 공개 릴리스인지 확인하세요.')); return; }
        const chunks = []; let length = 0;
        res.on('data', (chunk) => {
          length += chunk.length;
          if (length > maxBytes) { req.destroy(new Error('다운로드 크기 제한을 초과했습니다.')); return; }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('다운로드 시간이 초과됐습니다.')));
      req.on('error', reject);
    });
  }

  async function check() {
    const modules = nodeModules();
    const raw = await getBuffer(modules, FEED_URL, 64 * 1024, 0);
    let data;
    try { data = JSON.parse(raw.toString('utf8')); } catch (e) { throw new Error('GitHub 업데이트 응답을 읽지 못했습니다.'); }
    data = validateFeed(data);
    return { currentVersion: CURRENT_VERSION, latest: data, available: compareVersions(data.version, CURRENT_VERSION) > 0 };
  }

  function b64(value) { return Buffer.from(value, 'utf8').toString('base64'); }

  function scheduleInstall(modules, feed, zipPath, extensionFolder) {
    const path = modules.path, fs = modules.fs, os = modules.os, child = modules.child;
    const stage = path.dirname(zipPath);
    const resultPath = path.join(os.tmpdir(), 'ExpressionShelf_update_result.txt');
    const psPath = path.join(stage, 'install-after-ae-exits.ps1');
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$stage = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + b64(stage) + "'))",
      "$zip = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + b64(zipPath) + "'))",
      "$dest = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + b64(extensionFolder) + "'))",
      "$result = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + b64(resultPath) + "'))",
      "$version = 'v" + feed.version + "'",
      "$utf8 = [System.Text.UTF8Encoding]::new($false)",
      "try {",
      "  while (Get-Process -Name 'AfterFX' -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 2 }",
      "  $extract = Join-Path $stage 'extracted'",
      "  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force",
      "  $source = Join-Path $extract 'ExpressionShelf_Web'",
      "  if (!(Test-Path (Join-Path $source 'CSXS\\manifest.xml'))) { throw '설치 파일에 CEP 확장 manifest가 없습니다.' }",
      "  New-Item -ItemType Directory -Path $dest -Force | Out-Null",
      "  & robocopy.exe $source $dest /MIR /XD tools /XF '*.bat' 'README*.txt' | Out-Null",
      "  if ($LASTEXITCODE -ge 8) { throw ('파일 복사 실패: robocopy ' + $LASTEXITCODE) }",
      "  [IO.File]::WriteAllText($result, $version, $utf8)",
      "} catch {",
      "  [IO.File]::WriteAllText($result, ('ERROR: ' + $_.Exception.Message), $utf8)",
      "} finally { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }"
    ].join('\r\n');
    fs.writeFileSync(psPath, script, 'utf8');
    const proc = child.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', psPath], { detached: true, stdio: 'ignore', windowsHide: true });
    proc.on('error', (error) => {
      try { fs.writeFileSync(resultPath, 'ERROR: 설치 도우미를 실행하지 못했습니다. ' + error.message, 'utf8'); } catch (e) {}
    });
    proc.unref();
  }

  async function downloadAndSchedule(feed, extensionFolder) {
    const modules = nodeModules();
    feed = validateFeed(feed);
    const zip = await getBuffer(modules, feed.url, MAX_ZIP_BYTES, 0);
    if (zip.length !== feed.size) throw new Error('다운로드 파일 크기가 예상과 다릅니다. 다시 시도하세요.');
    const digest = modules.crypto.createHash('sha256').update(zip).digest('hex');
    if (digest.toLowerCase() !== feed.sha256.toLowerCase()) throw new Error('체크섬이 일치하지 않아 설치를 중단했습니다.');
    const stage = modules.path.join(modules.os.tmpdir(), 'ExpressionShelf_Update_v' + feed.version);
    modules.fs.rmSync(stage, { recursive: true, force: true });
    modules.fs.mkdirSync(stage, { recursive: true });
    const zipPath = modules.path.join(stage, 'ExpressionShelf_Web.zip');
    modules.fs.writeFileSync(zipPath, zip);
    try { scheduleInstall(modules, feed, zipPath, extensionFolder); }
    catch (e) { modules.fs.rmSync(stage, { recursive: true, force: true }); throw e; }
    return { version: feed.version };
  }

  function consumeResult() {
    try {
      const modules = nodeModules();
      const file = modules.path.join(modules.os.tmpdir(), 'ExpressionShelf_update_result.txt');
      if (!modules.fs.existsSync(file)) return '';
      const result = modules.fs.readFileSync(file, 'utf8').trim();
      modules.fs.unlinkSync(file);
      return result;
    } catch (e) { return ''; }
  }

  global.ESUpdater = { currentVersion: CURRENT_VERSION, compareVersions, validateFeed, check, downloadAndSchedule, consumeResult };
}(window));
