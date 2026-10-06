/* Typography shelf: native AEP snapshots. ES3. Never close/reduce/replace the open project.
   Plain URI-encoded metadata, parsed without eval. Commit metadata LAST. */
var ES_TYPO_KEYS = ['name','category','comp','width','height','duration','fps','time','created','engine','space','bits','linear','gamma'];
function ES_typoRoot(create) {
    var base = new Folder(Folder.myDocuments.fsName + '/ExpressionShelf');
    var root = new Folder(base.fsName + '/Typography');
    if (create && ((!base.exists && !base.create()) || (!root.exists && !root.create()))) {
        throw new Error('보관함 폴더를 만들지 못했습니다. 에펙 환경 설정 > 스크립팅 및 표현식 > 스크립트의 파일 쓰기 허용을 확인하세요.');
    }
    return root;
}
function ES_typoDir(id) {
    if (!/^typo_[0-9]+_[0-9]+$/.test(String(id))) { throw new Error('보관함 항목 ID가 올바르지 않습니다.'); }
    return new Folder(ES_typoRoot(false).fsName + '/' + id);
}
function ES_typoWrite(file, body) {
    file.encoding = 'UTF-8';
    if (!file.open('w')) { throw new Error('파일을 쓸 수 없습니다: ' + file.fsName); }
    try { if (!file.write(body)) { throw new Error('파일 쓰기 실패: ' + file.fsName); } }
    finally { file.close(); }
}
function ES_typoRead(dir) {
    var file = new File(dir.fsName + '/info.txt'), a, m = {}, i;
    if (!file.exists || file.length > 32000 || !file.open('r')) { throw new Error('정보 파일 없음'); }
    try { a = file.read().replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n'); } finally { file.close(); }
    if (a[0] !== 'ES_TYPO_1' || a.length !== ES_TYPO_KEYS.length + 1) { throw new Error('정보 파일 형식 오류'); }
    for (i = 0; i < ES_TYPO_KEYS.length; i++) { m[ES_TYPO_KEYS[i]] = decodeURIComponent(a[i + 1]); }
    if (!m.name || !m.comp) { throw new Error('이름 없음'); }
    var numeric = ['width','height','duration','fps','time','created','bits'];
    for (i = 0; i < numeric.length; i++) {
        if (!m[numeric[i]] || !isFinite(Number(m[numeric[i]]))) { throw new Error('수치 정보 오류'); }
        m[numeric[i]] = Number(m[numeric[i]]);
    }
    if (m.duration <= 0 || m.fps <= 0 || m.width <= 0 || m.height <= 0 || m.time < 0 || m.time >= m.duration) { throw new Error('컴포지션 정보 오류'); }
    m.id = dir.name;
    var aep = new File(dir.fsName + '/design.aep'), png = new File(dir.fsName + '/preview.png');
    if (!aep.exists || aep.length === 0) { throw new Error('AEP 파일 없음'); }
    m.thumbnail = png.exists && png.length > 0 ? png.fsName : '';
    m.sizeMB = Math.round(aep.length / 104857.6) / 10;
    return m;
}
function ES_typoList() {
    return ES_call(function () {
        ES_need();
        var root = ES_typoRoot(false), dirs = root.exists ? root.getFiles() : [], out = [], skipped = 0, i;
        for (i = 0; i < dirs.length; i++) {
            if (dirs[i] instanceof Folder && /^typo_[0-9]+_[0-9]+$/.test(dirs[i].name)) {
                try { out.push(ES_typoRead(dirs[i])); } catch (ignore) { skipped++; }
            }
        }
        out.sort(function (a,b) { return b.created - a.created; });
        return {items:out, skipped:skipped, path:root.fsName};
    });
}
function ES_typoSave(d) {
    return ES_call(function () {
        ES_need();
        var p = app.project, c = p ? p.activeItem : null, i, count = 0;
        if (!ES_validComp(c) || c.comment === ES_PREVIEW_TAG) { throw new Error('저장할 타이포 컴포지션을 먼저 열어주세요.'); }
        if (!p.file || !/\.aep$/i.test(p.file.name)) { throw new Error('먼저 Ctrl+S로 프로젝트를 일반 .aep 파일로 저장하세요.'); }
        if (p.dirty !== false) { throw new Error('저장되지 않은 변경 사항이 있습니다. Ctrl+S로 저장을 마친 뒤 다시 보관하세요.'); }
        var name = String(d && d.name || '').replace(/^\s+|\s+$/g, ''), cat = String(d && d.category || '').replace(/^\s+|\s+$/g, '');
        if (!name || name.length > 80 || cat.length > 40) { throw new Error('저장 이름(1~80자)과 분류(최대 40자)를 확인하세요.'); }
        for (i = 1; i <= p.numItems; i++) { if (p.item(i) instanceof CompItem && p.item(i).name === c.name) { count++; } }
        if (count !== 1) { throw new Error('같은 이름의 컴포지션이 있습니다. 저장할 컴프 이름을 고유하게 바꿔주세요: ' + c.name); }
        var root = ES_typoRoot(true), dir, id, stamp = new Date().getTime();
        do { id = 'typo_' + stamp + '_' + Math.floor(Math.random() * 1000000000); dir = new Folder(root.fsName + '/' + id); } while (dir.exists);
        if (!dir.create()) { throw new Error('저장 폴더를 만들지 못했습니다. 파일 쓰기 권한을 확인하세요.'); }
        var warnings = [], m, lines, snapshot = new File(dir.fsName + '/design.aep'), png = new File(dir.fsName + '/preview.png');
        try {
            // Copy only a clean, already-saved project. Do not call native save or render in CEP.
            var original = p.file.fsName, source = new File(original);
            if (!source.exists || source.length === 0) { throw new Error('AEP 파일을 읽지 못했습니다. Ctrl+S로 저장을 마친 뒤 다시 시도하세요.'); }
            ES_typoWrite(new File(root.fsName + '/last-operation.txt'), 'COPY AEP: ' + id);
            if (!source.copy(snapshot.fsName) || !snapshot.exists || snapshot.length !== source.length) { throw new Error('AEP 사본 저장에 실패했습니다. 저장 공간과 파일 쓰기 권한을 확인하세요.'); }
            var t = Math.max(0, Math.min(c.time, c.duration - c.frameDuration));
            m = {name:name, category:cat || '미분류', comp:c.name, width:c.width, height:c.height, duration:c.duration,
                fps:c.frameRate, time:t, created:stamp, engine:p.expressionEngine || '', space:p.workingSpace || '',
                bits:p.bitsPerChannel, linear:String(p.linearizeWorkingSpace), gamma:String(p.workingGamma)};
            lines = ['ES_TYPO_1'];
            for (i = 0; i < ES_TYPO_KEYS.length; i++) { lines.push(encodeURIComponent(String(m[ES_TYPO_KEYS[i]]))); }
            var temp = new File(dir.fsName + '/info.tmp');
            ES_typoWrite(temp, lines.join('\n'));
            if (!temp.rename('info.txt')) { throw new Error('보관함 정보 저장에 실패했습니다.'); }
            var savedItem = ES_typoRead(dir);
            try { ES_typoWrite(new File(root.fsName + '/last-operation.txt'), 'COMPLETE: ' + id); } catch (logError) {}
            return {item:savedItem, warnings:warnings};
        } catch (err) {
            // Only delete files created by this save. Existing entries and the working project are untouched.
            var names = ['info.tmp','info.txt','preview.png','design.aep'];
            for (i = 0; i < names.length; i++) { try { new File(dir.fsName + '/' + names[i]).remove(); } catch (ignore2) {} }
            try { dir.remove(); } catch (ignore3) {}
            throw err;
        }
    });
}
function ES_typoImport(d) {
    return ES_call(function () {
        ES_need();
        if (!d || (d.mode !== 'insert' && d.mode !== 'open')) { throw new Error('불러오기 요청 오류'); }
        var m = ES_typoRead(ES_typoDir(d.id)), p = app.project;
        if (!p) { throw new Error('프로젝트를 먼저 열어주세요.'); }
        var target = d.mode === 'insert' ? p.activeItem : null, at = 0;
        if (d.mode === 'insert') {
            if (!ES_validComp(target) || target.comment === ES_PREVIEW_TAG) { throw new Error('타이포를 넣을 작업 컴포지션을 먼저 열어주세요. 레이어 지정은 필요 없습니다.'); }
            at = target.time;
            if (at < 0 || at >= target.duration) { throw new Error('작업 컴프 안의 유효한 시간으로 재생 헤드를 옮겨주세요.'); }
        }
        var before = {}, added = [], chosen = null, layer = null, imported, i, item, matches = 0, warnings = [];
        for (i = 1; i <= p.numItems; i++) { before['i' + p.item(i).id] = true; }
        if (m.engine && m.engine !== p.expressionEngine) { warnings.push('저장 당시와 표현식 엔진이 다릅니다. 프로젝트 설정을 확인하세요.'); }
        if (m.space !== (p.workingSpace || '') || m.bits !== p.bitsPerChannel || m.linear !== String(p.linearizeWorkingSpace) || m.gamma !== String(p.workingGamma)) { warnings.push('저장 당시와 색상 설정이 다릅니다. 색상·빛 효과를 확인하세요.'); }
        app.beginUndoGroup('타이포 보관함 불러오기');
        try {
            try {
                imported = p.importFile(new ImportOptions(new File(ES_typoDir(d.id).fsName + '/design.aep')));
            } finally {
                // Capture even partially imported items so an import failure can be rolled back safely.
                for (i = 1; i <= p.numItems; i++) { item = p.item(i); if (!before['i' + item.id]) { added.push(item); } }
            }
            for (i = 0; i < added.length; i++) {
                item = added[i];
                if (item instanceof CompItem && item.name === m.comp) { chosen = item; matches++; }
            }
            if (matches !== 1) { throw new Error('저장한 타이포 컴프를 식별하지 못했습니다. 새로 저장해 주세요.'); }
            if (imported instanceof FolderItem) { imported.name = 'ES Typo · ' + m.name; }
            if (target) {
                layer = target.layers.add(chosen);
                layer.name = m.name; layer.startTime = at; layer.inPoint = at; layer.outPoint = Math.min(at + chosen.duration, target.duration);
                layer.selected = true;
                if (target.width !== chosen.width || target.height !== chosen.height) { warnings.push('컴프 크기가 달라 원본 100% 크기로 추가했습니다. 필요하면 크기·위치를 조절하세요.'); }
                if (at + chosen.duration > target.duration) { warnings.push('작업 컴프 끝에 맞춰 레이어 끝을 잘랐습니다.'); }
                target.openInViewer();
            } else { chosen.time = Math.min(m.time, chosen.duration - chosen.frameDuration); chosen.openInViewer(); }
            return {name:m.name, comp:chosen.name, inserted:!!target, warnings:warnings};
        } catch (err) {
            if (layer) { try { layer.remove(); } catch (ignore) {} }
            for (i = added.length - 1; i >= 0; i--) { try { added[i].remove(); } catch (ignore2) {} }
            throw err;
        } finally { app.endUndoGroup(); }
    });
}
function ES_typoFolder() {
    return ES_call(function () { ES_need(); var f = ES_typoRoot(true); if (!f.execute()) { throw new Error('폴더를 열지 못했습니다: ' + f.fsName); } return {path:f.fsName}; });
}

// PNG registration is independent of the AEP save; no AE rendering is involved.
function ES_typoThumbnail(d) {
    return ES_call(function () {
        ES_need(); var dir = ES_typoDir(d && d.id); ES_typoRead(dir);
        var source = File.openDialog('썸네일 PNG 선택', '*.png', false);
        if (!source) { return {cancelled:true}; }
        if (!/\.png$/i.test(source.name) || source.length <= 0 || source.length > 20971520) { throw new Error('20MB 이하의 PNG 파일을 선택하세요.'); }
        // Stage the replacement and keep the old thumbnail intact on failure.
        var temp = new File(dir.fsName + '/preview-new.png'), target = new File(dir.fsName + '/preview.png');
        var backup = new File(dir.fsName + '/preview-old.png'), moved = false;
        if (source.fsName === target.fsName) { return {cancelled:false}; }
        try {
            if (!source.copy(temp.fsName) || !temp.exists || temp.length !== source.length) { throw new Error('PNG 복사 실패'); }
            if (backup.exists && !backup.remove()) { throw new Error('이전 PNG 백업을 정리하지 못했습니다.'); }
            if (target.exists) { if (!target.rename('preview-old.png')) { throw new Error('기존 PNG를 보존하지 못했습니다.'); } moved = true; }
            if (!temp.rename('preview.png')) { throw new Error('PNG 등록 실패'); }
            try { if (backup.exists) { backup.remove(); } } catch (ignore) {}
            return {cancelled:false};
        } catch (err) {
            if (moved) { try { backup.rename('preview.png'); } catch (ignore2) {} }
            try { if (temp.exists) { temp.remove(); } } catch (ignore3) {}
            throw err;
        }
    });
}
// Explicit entry points when evalFile is called during panel initialization.
if (typeof $ !== 'undefined' && $.global) {
    $.global.ES_typoList = ES_typoList; $.global.ES_typoSave = ES_typoSave;
    $.global.ES_typoImport = ES_typoImport; $.global.ES_typoFolder = ES_typoFolder;
    $.global.ES_typoThumbnail = ES_typoThumbnail;
}
