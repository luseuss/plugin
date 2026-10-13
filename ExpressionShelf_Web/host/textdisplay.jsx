/* Slider-driven source text counters and progress labels. ExtendScript ES3. */
function ES_textdisplay(d) {
    return ES_call(function () {
        ES_need();
        var c = app.project ? app.project.activeItem : null, selected, i, layer, textGroup, source, effects;
        if (!ES_validComp(c) || c.comment === ES_PREVIEW_TAG) { throw new Error('텍스트 표시를 만들 작업 컴프를 열어주세요.'); }
        selected = c.selectedLayers;
        if (!selected || !selected.length) { throw new Error('타임라인에서 텍스트 레이어를 선택하세요.'); }
        d = d || {};
        var mode = String(d.mode || 'counter');
        if (mode !== 'counter' && mode !== 'progress') { throw new Error('표시 형식을 확인하세요.'); }
        var decimals = ESCore.parseNumber(String(d.decimals), 0, 6, '소수 자릿수');
        if (decimals % 1) { throw new Error('소수 자릿수는 정수로 입력하세요.'); }
        var prefix = String(d.prefix || ''), suffix = String(d.suffix || '');
        if (prefix.length > 40 || suffix.length > 40) { throw new Error('앞·뒤 문자는 각각 40자까지 입력할 수 있습니다.'); }
        if (mode === 'progress' && !suffix) { suffix = '%'; }
        var labelBase = mode === 'progress' ? 'ES 진행률' : 'ES 카운터';
        var made = 0, skipped = 0, errors = [], fx = null, exp, valueName, found, j, serial, oldExpression;
        app.beginUndoGroup(mode === 'progress' ? '텍스트 진행률 생성' : '텍스트 카운터 생성');
        try {
            for (i = 0; i < selected.length; i++) {
                layer = selected[i]; fx = null; source = null; oldExpression = '';
                try {
                    textGroup = layer.property('ADBE Text Properties');
                    if (!textGroup) { skipped++; errors.push(layer.name + ': 텍스트 레이어가 아님'); continue; }
                    source = textGroup.property('ADBE Text Document');
                    if (!source || !source.canSetExpression) { skipped++; errors.push(layer.name + ': Source Text 표현식을 지원하지 않음'); continue; }
                    oldExpression = String(source.expression || '');
                    if (oldExpression.replace(/\s/g, '') !== '') { skipped++; errors.push(layer.name + ': 기존 Source Text 표현식 유지'); continue; }
                    effects = layer.property('ADBE Effect Parade');
                    valueName = labelBase; serial = 2; found = true;
                    while (found) {
                        found = false;
                        for (j = 1; j <= effects.numProperties; j++) { if (effects.property(j).name === valueName) { found = true; valueName = labelBase + ' ' + serial; serial++; break; } }
                    }
                    fx = effects.addProperty('ADBE Slider Control'); fx.name = valueName; fx.property(1).setValue(0);
                    exp = 'var n=effect(' + ES_json(valueName) + ')(1);\n' +
                        (mode === 'progress' ? 'n=Math.max(0,Math.min(100,n));\n' : '') +
                        'var d=' + decimals + ';\nvar m=Math.pow(10,d);\n' +
                        ES_json(prefix) + '+(Math.round(n*m)/m).toFixed(d)+' + ES_json(suffix) + ';';
                    source.expression = exp;
                    if (source.expressionError) { throw new Error(source.expressionError); }
                    made++; fx = null;
                } catch (e1) {
                    if (source) { try { source.expression = oldExpression; } catch (restore) {} }
                    if (fx) { try { fx.remove(); } catch (e2) {} }
                    errors.push(layer.name + ': ' + String(e1)); skipped++;
                }
            }
            if (!made) { throw new Error('텍스트 카운터를 만들지 못했습니다. ' + errors.join(' / ')); }
            c.openInViewer();
            return {created:made, skipped:skipped, mode:mode, errors:errors};
        } finally { app.endUndoGroup(); }
    });
}
if (typeof $ !== 'undefined' && $.global) { $.global.ES_textdisplay = ES_textdisplay; }
