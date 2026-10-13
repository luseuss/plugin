/* Text background shape layers sized from sourceRectAtTime. ExtendScript ES3. */
function ES_tbControl(layer, matchName, name, value) {
    var fx = layer.property('ADBE Effect Parade').addProperty(matchName);
    fx.name = name; fx.property(1).setValue(value); return fx;
}
function ES_textbox(d) {
    return ES_call(function () {
        ES_need();
        var c = app.project ? app.project.activeItem : null, chosen, i, txt, shape, group, vectors, rect, fill, name, q;
        if (!ES_validComp(c) || c.comment === ES_PREVIEW_TAG) { throw new Error('텍스트 배경을 만들 작업 컴프를 열어주세요.'); }
        chosen = c.selectedLayers;
        if (!chosen || !chosen.length) { throw new Error('타임라인에서 텍스트 레이어를 선택하세요.'); }
        d = d || {};
        var px = ESCore.parseNumber(String(d.padX), 0, 2000, '가로 여백');
        var py = ESCore.parseNumber(String(d.padY), 0, 2000, '세로 여백');
        var radius = ESCore.parseNumber(String(d.radius), 0, 2000, '모서리 둥글기');
        var color = String(d.color || '#111827').replace(/^#/, '');
        if (!/^[0-9a-fA-F]{6}$/.test(color)) { throw new Error('색상은 #RRGGBB 형식으로 입력하세요.'); }
        var rgb = [parseInt(color.substr(0,2),16)/255, parseInt(color.substr(2,2),16)/255, parseInt(color.substr(4,2),16)/255];
        var selected = [];
        for (i = 0; i < chosen.length; i++) { if (chosen[i].property('ADBE Text Properties') !== null) { selected.push(chosen[i]); } }
        if (!selected.length) { throw new Error('선택한 레이어 중 텍스트 레이어가 없습니다.'); }
        var made = 0, failed = [], ref, tag = 'ExpressionShelf:textbox:v1';
        app.beginUndoGroup('텍스트 배경 생성');
        try {
            for (i = 0; i < selected.length; i++) {
                txt = selected[i]; shape = null;
                try {
                    shape = c.layers.addShape(); shape.name = 'ES Text Background · ' + txt.name; shape.comment = tag;
                    shape.parent = txt;
                    shape.moveAfter(txt);
                    ref = 'thisComp.layer(' + txt.index + ')';
                    shape.property('ADBE Transform Group').property('ADBE Position').setValue([0,0]);
                    group = shape.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group'); group.name = 'Text Background';
                    vectors = group.property('ADBE Vectors Group');
                    rect = vectors.addProperty('ADBE Vector Shape - Rect');
                    ES_tbControl(shape, 'ADBE Slider Control', 'ES 가로 여백', px);
                    ES_tbControl(shape, 'ADBE Slider Control', 'ES 세로 여백', py);
                    ES_tbControl(shape, 'ADBE Slider Control', 'ES 모서리', radius);
                    ES_tbControl(shape, 'ADBE Color Control', 'ES 배경색', rgb);
                    rect.property('ADBE Vector Rect Size').expression = 'var r=' + ref + '.sourceRectAtTime(time,false); [r.width+2*effect("ES 가로 여백")(1),r.height+2*effect("ES 세로 여백")(1)];';
                    rect.property('ADBE Vector Rect Position').expression = 'var r=' + ref + '.sourceRectAtTime(time,false); [r.left+r.width/2,r.top+r.height/2];';
                    rect.property('ADBE Vector Rect Roundness').expression = 'effect("ES 모서리")(1);';
                    fill = vectors.addProperty('ADBE Vector Graphic - Fill');
                    fill.property('ADBE Vector Fill Color').expression = 'effect("ES 배경색")(1);';
                    q = [rect.property('ADBE Vector Rect Size'), rect.property('ADBE Vector Rect Position'), rect.property('ADBE Vector Rect Roundness'), fill.property('ADBE Vector Fill Color')];
                    var qi;
                    for (qi = 0; qi < q.length; qi++) { if (q[qi].expressionError) { throw new Error(q[qi].expressionError); } }
                    shape.selected = false; made++;
                } catch (e1) { if (shape) { try { shape.remove(); } catch (e2) {} } failed.push(txt.name + ': ' + String(e1)); }
            }
            if (!made) { throw new Error('배경 도형을 만들지 못했습니다. ' + failed.join(' / ')); }
            c.openInViewer();
            return {created:made, skipped:selected.length-made, color:'#'+color.toUpperCase(), errors:failed};
        } finally { app.endUndoGroup(); }
    });
}
if (typeof $ !== 'undefined' && $.global) { $.global.ES_textbox = ES_textbox; }
