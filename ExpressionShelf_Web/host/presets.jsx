/* User motion/expression presets. Plain URI-encoded records; never eval saved data. ES3. */
var ES_PRESET_FIELDS = ['name','recipe','ms','ease','values','preview','sampleText','start','stagger','overwrite','code','created'];
function ES_presetRoot(create) {
    var base = new Folder(Folder.myDocuments.fsName + '/ExpressionShelf');
    var root = new Folder(base.fsName + '/Presets');
    if (create && ((!base.exists && !base.create()) || (!root.exists && !root.create()))) {
        throw new Error('프리셋 폴더를 만들지 못했습니다. 파일 쓰기 권한을 확인하세요.');
    }
    return root;
}
function ES_presetWrite(file, body) {
    file.encoding = 'UTF-8';
    if (!file.open('w')) { throw new Error('프리셋 파일을 쓸 수 없습니다.'); }
    try { if (!file.write(body)) { throw new Error('프리셋 저장에 실패했습니다.'); } }
    finally { file.close(); }
}
function ES_presetId(id) { return /^preset_[0-9]+_[0-9]+$/.test(String(id)); }
function ES_presetRead(file) {
    var lines, i, item = {};
    if (!file.exists || file.length > 100000 || !file.open('r')) { throw new Error('프리셋 파일을 읽지 못했습니다.'); }
    try { lines = file.read().replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n'); } finally { file.close(); }
    if (!lines.length || lines[0] !== 'ES_PRESET_1' || lines.length !== ES_PRESET_FIELDS.length + 1) { throw new Error('프리셋 파일 형식이 올바르지 않습니다.'); }
    for (i = 0; i < ES_PRESET_FIELDS.length; i++) { item[ES_PRESET_FIELDS[i]] = decodeURIComponent(lines[i + 1]); }
    var spec = ESCore.findBuiltin(item.recipe), vals = item.values ? item.values.split(',') : [], j;
    if (!item.name || item.name.length > 80 || !spec || vals.length !== spec.params.length || !item.code || item.code.length > 24000) { throw new Error('프리셋 데이터가 유효하지 않습니다.'); }
    item.ms = item.ms === '' ? null : Number(item.ms);
    if (item.ms !== null && (!isFinite(item.ms) || item.ms < 100 || item.ms > 3000)) { throw new Error('프리셋 길이 값이 올바르지 않습니다.'); }
    if ((spec.ms !== null && item.ms === null) || (spec.ms === null && item.ms !== null)) { throw new Error('프리셋 길이 설정이 원본 모션과 맞지 않습니다.'); }
    if (item.ease && ESCore.easeIndex(item.ease) < 0) { throw new Error('프리셋 이징 설정이 올바르지 않습니다.'); }
    item.values = [];
    for (j = 0; j < vals.length; j++) {
        var n = ESCore.parseNumber(vals[j], spec.params[j].min, spec.params[j].max, spec.params[j].label);
        item.values.push(n);
    }
    item.start = ESCore.parseNumber(item.start, 0, 3600, '시작 지연');
    item.stagger = ESCore.parseNumber(item.stagger, 0, 60, '레이어 간격');
    item.overwrite = item.overwrite === 'true';
    item.id = file.name.replace(/\.espreset$/i, '');
    item.created = Number(item.created) || 0;
    return item;
}
function ES_presetList() {
    return ES_call(function () {
        ES_need();
        var root = ES_presetRoot(false), files = root.exists ? root.getFiles('*.espreset') : [], items = [], skipped = 0, i;
        for (i = 0; i < files.length; i++) {
            if (files[i] instanceof File) { try { items.push(ES_presetRead(files[i])); } catch (e) { skipped++; } }
        }
        items.sort(function (a,b) { return b.created - a.created; });
        return {items:items, skipped:skipped, path:root.fsName};
    });
}
function ES_presetFolder() {
    return ES_call(function () {
        ES_need();
        var root = ES_presetRoot(true);
        root.execute();
        return {path:root.fsName};
    });
}
function ES_presetSave(d) {
    return ES_call(function () {
        ES_need();
        if (!d || !/^[A-Za-z0-9_]+$/.test(String(d.recipe || ''))) { throw new Error('프리셋 정보를 확인하세요.'); }
        var spec = ESCore.findBuiltin(d.recipe), vals = d.values, i, lines, root, stamp, id, file, item;
        if (!spec || !(vals instanceof Array) || vals.length !== spec.params.length) { throw new Error('저장할 프리셋이 올바르지 않습니다.'); }
        d.name = String(d.name || '').replace(/^\s+|\s+$/g, '');
        d.code = String(d.code || '').replace(/\r\n?/g, '\n');
        if (!d.name || d.name.length > 80) { throw new Error('저장 이름을 1~80자로 입력하세요.'); }
        if (!d.code.replace(/\s/g, '') || d.code.length > 24000) { throw new Error('익스프레션 코드는 1~24,000자여야 합니다.'); }
        if (spec.ms !== null) { d.ms = ESCore.parseNumber(String(d.ms), 100, 3000, '길이(ms)'); }
        else { d.ms = ''; }
        for (i = 0; i < vals.length; i++) { vals[i] = ESCore.parseNumber(String(vals[i]), spec.params[i].min, spec.params[i].max, spec.params[i].label); }
        d.start = ESCore.parseNumber(String(d.start), 0, 3600, '시작 지연');
        d.stagger = ESCore.parseNumber(String(d.stagger), 0, 60, '레이어 간격');
        d.preview = d.preview === 'text' ? 'text' : 'shape';
        d.sampleText = String(d.sampleText || '').substring(0, 24);
        d.overwrite = !!d.overwrite;
        d.created = new Date().getTime();
        root = ES_presetRoot(true); stamp = new Date().getTime();
        do { id = 'preset_' + stamp + '_' + Math.floor(Math.random() * 1000000000); file = new File(root.fsName + '/' + id + '.espreset'); } while (file.exists);
        lines = ['ES_PRESET_1'];
        for (i = 0; i < ES_PRESET_FIELDS.length; i++) {
            var value = d[ES_PRESET_FIELDS[i]];
            if (ES_PRESET_FIELDS[i] === 'values') { value = vals.join(','); }
            lines.push(encodeURIComponent(String(value === null || value === undefined ? '' : value)));
        }
        ES_presetWrite(file, lines.join('\n'));
        item = ES_presetRead(file);
        return {item:item, path:root.fsName};
    });
}
function ES_presetGet(d) {
    return ES_call(function () {
        ES_need();
        if (!d || !ES_presetId(d.id)) { throw new Error('프리셋 ID가 올바르지 않습니다.'); }
        var file = new File(ES_presetRoot(false).fsName + '/' + d.id + '.espreset');
        if (!file.exists) { throw new Error('프리셋을 찾지 못했습니다. 목록을 새로고침하세요.'); }
        return {item:ES_presetRead(file)};
    });
}
function ES_presetDelete(d) {
    return ES_call(function () {
        ES_need();
        if (!d || !ES_presetId(d.id)) { throw new Error('프리셋 ID가 올바르지 않습니다.'); }
        var file = new File(ES_presetRoot(false).fsName + '/' + d.id + '.espreset');
        if (!file.exists) { throw new Error('이미 삭제되었거나 찾을 수 없는 프리셋입니다.'); }
        if (!file.remove()) { throw new Error('프리셋 파일을 삭제하지 못했습니다.'); }
        return {id:d.id};
    });
}
