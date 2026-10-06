/* Editable native shape-layer letterbox bars, attached to the active composition. ES3. */
function ES_lbMakeControl(layer, matchName, name, value) {
    var fx = layer.property('ADBE Effect Parade').addProperty(matchName);
    fx.name = name; fx.property(1).setValue(value); return fx;
}
function ES_lbBar(layer, name, y, height, rgb) {
    var content = layer.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
    content.name = name;
    var vectors = content.property('ADBE Vectors Group');
    var rect = vectors.addProperty('ADBE Vector Shape - Rect');
    rect.property('ADBE Vector Rect Size').setValue([layer.containingComp.width + 4, height + 2]);
    rect.property('ADBE Vector Rect Position').setValue([0, y]);
    var fill = vectors.addProperty('ADBE Vector Graphic - Fill');
    fill.property('ADBE Vector Fill Color').setValue(rgb);
    fill.property('ADBE Vector Fill Color').expression = 'effect("ES 색상")(1)';
    rect.property('ADBE Vector Rect Size').expression =
        'var h=thisComp.height*effect("ES 막대 높이 (%)")(1)/200; [thisComp.width+4,h+2]';
    var pos = rect.property('ADBE Vector Rect Position');
    pos.expression = 'var h=thisComp.height*effect("ES 막대 높이 (%)")(1)/200; [0,' +
        (y < 0 ? '-thisComp.height/2+h/2' : 'thisComp.height/2-h/2') + ']';
}
function ES_letterbox(d) {
    return ES_call(function () {
        ES_need();
        var c = app.project ? app.project.activeItem : null;
        if (!ES_validComp(c) || c.comment === ES_PREVIEW_TAG) { throw new Error('레터박스를 만들 작업 컴프를 열어주세요.'); }
        if (c.width <= 0 || c.height <= 0) { throw new Error('컴프 크기를 확인하세요.'); }
        d = d || {};
        var ratio = ESCore.parseNumber(String(d.ratio), 1.2, 4.0, '화면비');
        var fade = ESCore.parseNumber(String(d.fade), 0, 2, '페이드 시간');
        var color = String(d.color || '000000').replace(/^#/, '');
        if (!/^[0-9a-fA-F]{6}$/.test(color)) { throw new Error('색상은 #RRGGBB 형식으로 입력하세요.'); }
        var currentRatio = c.width / c.height;
        if (ratio <= currentRatio + 0.0001) { throw new Error('선택한 화면비(' + ratio + ':1)는 컴프보다 넓습니다. 더 넓은 비율을 골라주세요.'); }
        var pct = (1 - currentRatio / ratio) * 100;
        if (pct > 45) { throw new Error('막대가 너무 두꺼워집니다. 컴프에 맞는 더 넓은 화면비를 선택하세요.'); }
        var rgb = [parseInt(color.substr(0,2),16)/255, parseInt(color.substr(2,2),16)/255, parseInt(color.substr(4,2),16)/255];
        var layer = null;
        app.beginUndoGroup('레터박스 생성');
        try {
            layer = c.layers.addShape(); layer.name = 'ES Letterbox'; layer.comment = 'ExpressionShelf:letterbox:v1';
            layer.startTime = 0; layer.inPoint = 0; layer.outPoint = c.duration; layer.moveToBeginning();
            ES_lbMakeControl(layer, 'ADBE Slider Control', 'ES 막대 높이 (%)', pct);
            ES_lbMakeControl(layer, 'ADBE Color Control', 'ES 색상', rgb);
            ES_lbMakeControl(layer, 'ADBE Slider Control', 'ES 페이드 (초)', fade);
            var group = layer.property('ADBE Root Vectors Group');
            ES_lbBar(layer, '상단 바', -c.height/2, c.height*pct/200, rgb);
            ES_lbBar(layer, '하단 바', c.height/2, c.height*pct/200, rgb);
            var opacity = layer.property('ADBE Transform Group').property('ADBE Opacity');
            opacity.expression = 'var f=Math.max(0,effect("ES 페이드 (초)")(1));\n' +
                'if(f<=0) 100; else Math.min(linear(time,inPoint,inPoint+f,0,100),linear(time,outPoint-f,outPoint,100,0));';
            opacity.expressionEnabled = true;
            if (opacity.expressionError) { throw new Error(opacity.expressionError); }
            layer.selected = true; c.openInViewer();
            return {name:layer.name, ratio:ratio, barPercent:Math.round(pct*100)/100, color:'#'+color.toUpperCase(), fade:fade};
        } catch (err) { if (layer) { try { layer.remove(); } catch (ignore) {} } throw err; }
        finally { app.endUndoGroup(); }
    });
}
if (typeof $ !== 'undefined' && $.global) { $.global.ES_letterbox = ES_letterbox; }
