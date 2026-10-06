/* Expression Shelf Web — ExtendScript side. ES3.
   The panel calls these ES_* functions through evalScript with a JSON object literal;
   every function returns a JSON string {ok: true, ...} or {ok: false, error}.
   Expressions are assigned to AE properties through ESCore.install, never evaluated as scripts. */
var ES_STATE = {ready: false, targets: [], comp: null, previewComp: null, previewSample: null, previewLayers: [], previewSources: []};
var ES_PREVIEW_TAG = 'ExpressionShelf:preview:v1';

function ES_json(v) {
    var i, out, k;
    if (v === null || v === undefined) { return 'null'; }
    if (typeof v === 'number') { return isFinite(v) ? String(v) : 'null'; }
    if (typeof v === 'boolean') { return v ? 'true' : 'false'; }
    if (typeof v === 'string') {
        return '"' + v.replace(/[\\"\u0000-\u001f\u2028\u2029]/g, function (c) {
            if (c === '"') { return '\\"'; }
            if (c === '\\') { return '\\\\'; }
            return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
        }) + '"';
    }
    if (v instanceof Array) {
        out = [];
        for (i = 0; i < v.length; i++) { out.push(ES_json(v[i])); }
        return '[' + out.join(',') + ']';
    }
    out = [];
    for (k in v) { if (v.hasOwnProperty(k)) { out.push(ES_json(k) + ':' + ES_json(v[k])); } }
    return '{' + out.join(',') + '}';
}
function ES_call(fn) {
    try { var r = fn(); r.ok = true; return ES_json(r); }
    catch (e) { return ES_json({ok: false, error: String(e)}); }
}
function ES_need() { if (!ES_STATE.ready) { throw new Error('패널 초기화 전입니다. 패널을 다시 열어주세요.'); } }
function ES_validComp(c) { try { return c && c instanceof CompItem && c.name !== undefined; } catch (e) { return false; } }
function ES_targetInfo() {
    var lines = [], i;
    if (!ES_validComp(ES_STATE.comp)) { return {comp: '', count: 0, layers: []}; }
    for (i = 0; i < ES_STATE.targets.length; i++) {
        try { lines.push('#' + ES_STATE.targets[i].index + ' ' + ES_STATE.targets[i].name); } catch (e) { lines.push('(삭제된 레이어)'); }
    }
    return {comp: ES_STATE.comp.name, count: ES_STATE.targets.length, layers: lines};
}
// Checks the panel payload and adds the parsed property sections.
function ES_prepare(d) {
    ES_need();
    if (!d || !d.p || typeof d.code !== 'string' || !(d.values instanceof Array)) { throw new Error('잘못된 요청입니다.'); }
    var p = d.p, i;
    if (p.recipe !== 'custom' && !ESCore.findBuiltin(p.recipe)) { throw new Error('알 수 없는 프리셋입니다: ' + p.recipe); }
    if (!/^[A-Za-z0-9_]+$/.test(String(p.id))) { throw new Error('프리셋 ID 오류'); }
    if (d.values.length > 5) { throw new Error('수치 데이터 오류'); }
    for (i = 0; i < d.values.length; i++) { d.values[i] = ESCore.parseNumber(String(d.values[i]), -100000, 100000, '수치'); }
    d.code = d.code.replace(/\r\n?/g, '\n');
    if (!d.code.replace(/\s/g, '')) { throw new Error('익스프레션 코드를 입력하세요.'); }
    if (d.code.length > 24000) { throw new Error('코드는 최대 24,000자입니다.'); }
    d.start = ESCore.parseNumber(String(d.start), 0, 3600, '시작 지연');
    d.stagger = ESCore.parseNumber(String(d.stagger), 0, 60, '레이어 간격');
    p.target = ESCore.isTextRecipe(p.recipe) ? -1 : Number(p.target) || 0;
    if (!ESCore.isTextRecipe(p.recipe)) { d.parts = ESCore.parseParts(d.code, p.target); }
    if (p.recipe === 'tr_glitch') {
        if (!d.motion || d.values.length !== 5) { throw new Error('글리치 패널을 최신 버전으로 다시 열어주세요.'); }
        d.motion.ms = ESCore.parseNumber(String(d.motion.ms), 100, 3000, '글리치 길이');
        var spec = ESCore.findBuiltin(p.recipe);
        for (i = 0; i < 5; i++) { d.values[i] = ESCore.parseNumber(String(d.values[i]), spec.params[i].min, spec.params[i].max, spec.params[i].label); }
    }
    if (p.recipe === 'tr_light_leak') {
        if (!d.motion || d.values.length !== 2) { throw new Error('라이트 리크의 길이와 수치를 확인하세요.'); }
        d.motion.ms = ESCore.parseNumber(String(d.motion.ms), 100, 3000, '길이(ms)');
        d.values[0] = ESCore.parseNumber(String(d.values[0]), 0, 100, '빛 강도');
        d.values[1] = ESCore.parseNumber(String(d.values[1]), 30, 180, '빛 폭');
        d.lightParts = ESCore.parseParts(ESCore.buildLightCode(d.values, d.motion), 0);
    }
    return d;
}

function ES_init(root) {
    return ES_call(function () {
        var f = new File(root + '/shelf-core.js');
        if (!f.exists) { throw new Error('shelf-core.js를 찾지 못했습니다: ' + f.fsName); }
        $.evalFile(f);
        if (typeof ESCore === 'undefined') { throw new Error('코어를 불러오지 못했습니다.'); }
        var typography = new File(root + '/host/typo.jsx');
        if (!typography.exists) { throw new Error('host/typo.jsx를 찾지 못했습니다. 다시 설치해주세요.'); }
        $.evalFile(typography);
        var letterbox = new File(root + '/host/letterbox.jsx');
        if (!letterbox.exists) { throw new Error('host/letterbox.jsx를 찾지 못했습니다. 다시 설치해주세요.'); }
        $.evalFile(letterbox);
        ES_STATE.ready = true;
        return {motions: ESCore.BUILTINS.length, target: ES_targetInfo()};
    });
}
function ES_bind() {
    return ES_call(function () {
        ES_need();
        var c = app.project ? app.project.activeItem : null, chosen = [], i;
        if (!ES_validComp(c)) { throw new Error('작업 컴포지션을 열고 레이어를 선택하세요.'); }
        if (c.comment === ES_PREVIEW_TAG) { throw new Error('미리보기 컴포지션은 적용 대상으로 지정할 수 없습니다.'); }
        for (i = 0; i < c.selectedLayers.length; i++) { chosen.push(c.selectedLayers[i]); }
        if (!chosen.length) { throw new Error('적용할 레이어를 선택하세요.'); }
        chosen.sort(function (a, b) { return a.index - b.index; });
        ES_STATE.comp = c; ES_STATE.targets = chosen;
        return {target: ES_targetInfo()};
    });
}
function ES_openTarget() {
    return ES_call(function () {
        if (!ES_validComp(ES_STATE.comp)) { throw new Error('먼저 작업 레이어를 대상으로 지정하세요.'); }
        ES_STATE.comp.openInViewer();
        return {};
    });
}
// A procedural warm light pass, generated with shapes (no external footage).
function ES_createLight(layer, d, delay, time, tag) {
    var c = layer.containingComp, light = null, i, f, group, content, ellipse, fill, r;
    try {
        light = c.layers.addShape(); light.name = 'ES Light Leak · ' + layer.name; light.comment = tag;
        light.moveBefore(layer); light.blendingMode = BlendingMode.SCREEN;
        light.startTime = layer.inPoint; light.inPoint = layer.inPoint; light.outPoint = layer.outPoint;
        for (i = 0; i < 20; i++) {
            f = 1 - i / 20;
            group = light.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group'); group.name = 'Light band ' + (i + 1);
            content = group.property('ADBE Vectors Group');
            ellipse = content.addProperty('ADBE Vector Shape - Ellipse');
            ellipse.property('ADBE Vector Ellipse Size').setValue([c.width * 1.1 * f, c.height * 2.4 * f]);
            fill = content.addProperty('ADBE Vector Graphic - Fill');
            fill.property('ADBE Vector Fill Color').setValue([1, 0.12 + 0.8 * (1 - f), 0.02 + 0.6 * (1 - f), 1]);
            fill.property('ADBE Vector Fill Opacity').setValue(24);
        }
        var blur = light.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2'); blur.name = 'ES Light Softness';
        blur.property(1).setValue(c.width * 0.025);
        r = ESCore.install(light, {p:{recipe:'custom'}, parts:d.lightParts}, delay, true, time);
        if (r.skip) { throw new Error(r.message); }
        return light;
    } catch (err) { if (light) { try { light.remove(); } catch (ignore) {} } throw err; }
}
function ES_setExpression(prop, code, delay, time) {
    if (!prop || !prop.canSetExpression) { throw new Error('보조 레이어 속성을 찾지 못했습니다.'); }
    prop.expression = ESCore.fullCode(code, delay); prop.expressionEnabled = true;
    prop.valueAtTime(time, false); if (prop.expressionError) { throw new Error(prop.expressionError); }
}
function ES_installGlitch(layer, d, delay, overwrite, time) {
    if (layer.locked || layer.threeDLayer || layer.parent || layer.adjustmentLayer || layer.nullLayer ||
        layer.hasTrackMatte || layer.matchName === 'ADBE Camera Layer' || layer.matchName === 'ADBE Light Layer') {
        return {skip:true, message:'RGB 글리치는 잠금·부모·매트 없는 2D 장면에 적용하세요. 필요한 경우 먼저 프리컴프하세요.'};
    }
    if (layer.id === undefined) { throw new Error('RGB 글리치는 After Effects 2022 이상이 필요합니다.'); }
    var c = layer.containingComp, tag = 'ExpressionShelf:rgb:v1:' + layer.id + ':', old = [], created = [], i, j, l, fx, result;
    for (i = 1; i <= c.numLayers; i++) { if (String(c.layer(i).comment).indexOf(tag) === 0) { old.push(c.layer(i)); } }
    if (old.length && !overwrite) { return {skip:true, message:'기존 RGB 글리치 유지'}; }
    for (i = 0; i < old.length; i++) { if (old[i].locked) { return {skip:true, message:'기존 RGB/색 플래시 레이어가 잠겨 있습니다'}; } }
    try {
        if (d.values[3] > 0) {
            for (i = 0; i < 3; i++) {
                l = layer.duplicate(); created.push(l); l.name = 'ES RGB ' + ['R','G','B'][i] + ' · ' + layer.name;
                l.comment = tag + i; l.moveBefore(layer); l.blendingMode = BlendingMode.ADD;
                if (l.hasAudio) { l.audioEnabled = false; }
                fx = l.property('ADBE Effect Parade').addProperty('ADBE Shift Channels'); fx.name = 'ES RGB Channel';
                // Take Alpha From retains original alpha. RGB menu: Red=2, Green=3, Blue=4, Full Off=10.
                for (j = 0; j < 3; j++) { fx.property(j + 2).setValue(i === j ? j + 2 : 10); }
                result = ESCore.install(l, {p:{recipe:'custom'}, parts:ESCore.buildRGBParts(d.values,d.motion,i)}, delay, true, time);
                if (result.skip) { throw new Error(result.message); }
            }
        }
        if (d.values[4] > 0) {
            l = c.layers.addShape(); created.push(l); l.name = 'ES Color Flash · ' + layer.name; l.comment = tag + 'flash';
            l.moveBefore(layer); for (i = 0; i < created.length - 1; i++) { l.moveBefore(created[i]); }
            l.blendingMode = BlendingMode.ADD; l.startTime = layer.inPoint; l.inPoint = layer.inPoint; l.outPoint = layer.outPoint;
            var content = l.property('ADBE Root Vectors Group');
            content.addProperty('ADBE Vector Shape - Rect').property('ADBE Vector Rect Size').setValue([c.width,c.height]);
            var fill = content.addProperty('ADBE Vector Graphic - Fill'), flash = ESCore.buildGlitchFlash(d.values,d.motion);
            ES_setExpression(fill.property('ADBE Vector Fill Color'), flash.color, delay, time);
            l.property('ADBE Transform Group').property('ADBE Position').setValue([c.width/2,c.height/2]);
            ES_setExpression(l.property('ADBE Transform Group').property('ADBE Opacity'), flash.opacity, delay, time);
        }
        // Main layer changes last: failed or skipped applies leave the prior rig intact.
        result = ESCore.install(layer, d, delay, overwrite, time);
        if (result.skip) { for (i = created.length - 1; i >= 0; i--) { created[i].remove(); } return result; }
    } catch (err) {
        for (i = created.length - 1; i >= 0; i--) { try { created[i].remove(); } catch (ignore) {} }
        throw err;
    }
    for (i = old.length - 1; i >= 0; i--) { old[i].remove(); }
    return {skip:false, createdLayers:created};
}
function ES_install(layer, d, delay, overwrite, time) {
    if (d.p.recipe === 'tr_glitch') { return ES_installGlitch(layer,d,delay,overwrite,time); }
    if (d.p.recipe !== 'tr_light_leak') { return ESCore.install(layer, d, delay, overwrite, time); }
    if (layer.locked || layer.threeDLayer || layer.parent || layer.adjustmentLayer || layer.nullLayer ||
        layer.matchName === 'ADBE Camera Layer' || layer.matchName === 'ADBE Light Layer') {
        return {skip:true, message:'라이트 리크는 잠기지 않은, 부모 연결 없는 2D 장면 레이어에 적용하세요'};
    }
    if (layer.id === undefined) { throw new Error('라이트 리크는 After Effects 2022 이상이 필요합니다.'); }
    var c = layer.containingComp, tag = 'ExpressionShelf:light:v1:' + layer.id, old = [], i, light = null, r;
    for (i = 1; i <= c.numLayers; i++) { if (c.layer(i).comment === tag) { old.push(c.layer(i)); } }
    if (old.length && !overwrite) { return {skip:true, message:'기존 라이트 리크 유지'}; }
    for (i = 0; i < old.length; i++) { if (old[i].locked) { return {skip:true, message:'기존 라이트 레이어가 잠겨 있습니다'}; } }
    // Validate the new light before touching B; main-layer installation is transactional in ESCore.
    light = ES_createLight(layer, d, delay, time, tag);
    try {
        r = ESCore.install(layer, d, delay, overwrite, time);
        if (r.skip) { light.remove(); return r; }
    } catch (err) { try { light.remove(); } catch (ignore) {} throw err; }
    for (i = old.length - 1; i >= 0; i--) { old[i].remove(); }
    return {skip:false, createdLayers:[light]};
}
function ES_makeSample(comp, d) {
    var layer = null, tp, doc, rect, root, group, content, shape, fill, r;
    try {
        if (d.p.preview === 'text' || ESCore.isTextRecipe(d.p.recipe)) {
            layer = comp.layers.addText(String(d.sampleText || '').replace(/^\s+|\s+$/g, '') || 'MOTION TYPE'); layer.name = 'ES · 텍스트 예제';
            tp = layer.property('ADBE Text Properties').property('ADBE Text Document'); doc = tp.value;
            doc.fontSize = 72; doc.applyFill = true; doc.fillColor = [0.92, 0.95, 1]; doc.applyStroke = false;
            doc.justification = ParagraphJustification.CENTER_JUSTIFY; tp.setValue(doc);
            rect = layer.sourceRectAtTime(0, false);
            layer.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([rect.left + rect.width / 2, rect.top + rect.height / 2]);
        } else {
            layer = comp.layers.addShape(); layer.name = 'ES · 도형 예제';
            root = layer.property('ADBE Root Vectors Group'); group = root.addProperty('ADBE Vector Group'); group.name = 'Preview Shape';
            content = group.property('ADBE Vectors Group'); shape = content.addProperty('ADBE Vector Shape - Rect');
            shape.property('ADBE Vector Rect Size').setValue([170, 120]); shape.property('ADBE Vector Rect Roundness').setValue(22);
            fill = content.addProperty('ADBE Vector Graphic - Fill'); fill.property('ADBE Vector Fill Color').setValue([0.2, 0.83, 0.6, 1]);
        }
        layer.comment = ES_PREVIEW_TAG;
        layer.property('ADBE Transform Group').property('ADBE Position').setValue([480, 270]);
        layer.inPoint = 0; layer.outPoint = comp.duration;
        r = ES_install(layer, d, d.start, true, 0);
        if (r.skip) { throw new Error(r.message); }
        return layer;
    } catch (err) { if (layer) { try { layer.remove(); } catch (ignore) {} } throw err; }
}
// Generated A/B scenes are precomps, so position, opacity and effects affect the entire scene.
function ES_cleanupPreview(layers, sources) {
    var i;
    for (i = layers.length - 1; i >= 0; i--) {
        try { if (layers[i].comment === ES_PREVIEW_TAG) { layers[i].remove(); } } catch (ignore) {}
    }
    for (i = sources.length - 1; i >= 0; i--) {
        try { if (sources[i].comment === ES_PREVIEW_TAG && sources[i].usedIn.length === 0) { sources[i].remove(); } } catch (ignore2) {}
    }
}
function ES_sceneSource(letter, color, duration, sources) {
    var c = app.project.items.addComp('ES Scene ' + letter, 960, 540, 1, duration, 30);
    c.comment = ES_PREVIEW_TAG; sources.push(c);
    var bg = c.layers.addShape(), content = bg.property('ADBE Root Vectors Group');
    bg.name = 'Scene background';
    var rect = content.addProperty('ADBE Vector Shape - Rect');
    rect.property('ADBE Vector Rect Size').setValue([960, 540]);
    content.addProperty('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').setValue(color);
    bg.property('ADBE Transform Group').property('ADBE Position').setValue([480, 270]);
    var label = c.layers.addText('SCENE ' + letter), tp = label.property('ADBE Text Properties').property('ADBE Text Document'), doc = tp.value;
    doc.fontSize = 78; doc.applyFill = true; doc.fillColor = [0.93, 0.98, 1]; doc.applyStroke = false;
    doc.justification = ParagraphJustification.CENTER_JUSTIFY; tp.setValue(doc);
    var bounds = label.sourceRectAtTime(0, false);
    label.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([bounds.left + bounds.width / 2, bounds.top + bounds.height / 2]);
    label.property('ADBE Transform Group').property('ADBE Position').setValue([480, 270]);
    return c;
}
function ES_makeTransition(comp, d) {
    var layers = [], sources = [], a, b, r;
    try {
        a = comp.layers.add(ES_sceneSource('A', [0.16, 0.21, 0.31, 1], comp.duration, sources));
        a.comment = ES_PREVIEW_TAG; layers.push(a); a.name = 'ES · 이전 장면 A';
        b = comp.layers.add(ES_sceneSource('B', [0.03, 0.47, 0.36, 1], comp.duration, sources));
        b.comment = ES_PREVIEW_TAG; layers.push(b); b.name = 'ES · 다음 장면 B';
        b.startTime = 0.35; b.inPoint = 0.35; b.outPoint = comp.duration;
        r = ES_install(b, d, d.start, true, b.inPoint);
        if (r.createdLayers) { for (var j = 0; j < r.createdLayers.length; j++) { r.createdLayers[j].comment = ES_PREVIEW_TAG; layers.push(r.createdLayers[j]); } }
        if (r.skip) { throw new Error(r.message); }
        return {layers: layers, sources: sources, sample: b};
    } catch (err) { ES_cleanupPreview(layers, sources); throw err; }
}
function ES_preview(d) {
    return ES_call(function () {
        ES_prepare(d);
        var c = ES_STATE.previewComp, madeComp = false, next, bundle = null;
        var isTransition = !!(ESCore.findBuiltin(d.p.recipe) || {}).transition;
        app.beginUndoGroup('Expression Shelf Preview');
        try {
            if (!ES_validComp(c) || c.comment !== ES_PREVIEW_TAG) {
                c = app.project.items.addComp('ES Preview · 미리보기', 960, 540, 1, 6, 30); c.comment = ES_PREVIEW_TAG; c.bgColor = [0.055, 0.07, 0.08]; madeComp = true;
            }
            bundle = isTransition ? ES_makeTransition(c, d) : {layers: [ES_makeSample(c, d)], sources: []};
            next = bundle.sample || bundle.layers[0];
            ES_cleanupPreview(ES_STATE.previewLayers, ES_STATE.previewSources);
            ES_STATE.previewComp = c; ES_STATE.previewSample = next;
            ES_STATE.previewLayers = bundle.layers; ES_STATE.previewSources = bundle.sources;
            c.time = 0; c.workAreaStart = 0; c.workAreaDuration = c.duration; c.openInViewer();
        } catch (err) { if (bundle) { ES_cleanupPreview(bundle.layers, bundle.sources); } if (madeComp && c) { try { c.remove(); } catch (ignore2) {} } throw err; }
        finally { app.endUndoGroup(); }
        return {};
    });
}
function ES_apply(d) {
    return ES_call(function () {
        ES_prepare(d);
        // Read the active comp's live selection at Apply time. This lets users
        // choose layers in the timeline and apply directly without binding first.
        var c = app.project ? app.project.activeItem : null;
        var j, r, ok = 0, skip = 0, fail = 0, lines = [], name, delay, t = [], selected, i;
        if (!ES_validComp(c)) { throw new Error('작업 컴포지션을 열고 레이어를 선택하세요.'); }
        if (c.comment === ES_PREVIEW_TAG) { throw new Error('미리보기 컴포지션에는 적용할 수 없습니다. 작업 컴포지션을 선택하세요.'); }
        selected = c.selectedLayers;
        for (i = 0; i < selected.length; i++) { t.push(selected[i]); }
        if (!t.length) { throw new Error('에펙 타임라인에서 적용할 레이어를 선택하세요.'); }
        t.sort(function (a, b) { return a.index - b.index; });
        ES_STATE.comp = c; ES_STATE.targets = t;
        app.beginUndoGroup('Expression Shelf Apply');
        try {
            for (j = 0; j < t.length; j++) {
                name = '지정 대상 ' + (j + 1); delay = d.start + j * d.stagger;
                try {
                    name = '#' + t[j].index + ' ' + t[j].name;
                    if (t[j].containingComp !== c) { throw new Error('대상 레이어가 변경되었습니다. 다시 선택하세요.'); }
                    r = ES_install(t[j], d, delay, !!d.overwrite, c.time);
                    if (r.skip) { skip++; lines.push(name + ' · 건너뜀: ' + r.message); }
                    else { ok++; lines.push(name + ' · 적용 완료 (지연 ' + delay.toFixed(2) + '초)'); }
                } catch (err) { fail++; lines.push(name + ' · 오류: ' + String(err)); }
            }
        } finally { app.endUndoGroup(); }
        c.openInViewer();
        return {applied: ok, skipped: skip, failed: fail, lines: lines};
    });
}
