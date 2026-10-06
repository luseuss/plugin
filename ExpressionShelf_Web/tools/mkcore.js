// Regeneration requires an upstream JSX core that includes the transition definitions.
var fs=require('fs');
var src=fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'');
var m=src.match(/\/\/ CORE_START\n([\s\S]*?)\n\s*\/\/ CORE_END/); if(!m) throw 'no core';
var out='\uFEFF/* Expression Shelf core — shared by the web panel (browser) and host.jsx (ExtendScript). ES3.\n'+
 '   Copied from ExpressionShelf.jsx (CORE_START..CORE_END). Regenerate instead of editing by hand. */\n'+
 'var ESCore = (function () {\n'+m[1]+'\n'+
 '    return {TARGETS: TARGETS, TARGET_NAMES: TARGET_NAMES, EFFECTS: EFFECTS, CATS: CATS, CAT_SHORT: CAT_SHORT, FEELS: FEELS,\n'+
 '        EASES: EASES, BUILTINS: BUILTINS, buildLightCode: buildLightCode, buildRGBParts: buildRGBParts, buildGlitchFlash: buildGlitchFlash, buildCode: buildCode, fullCode: fullCode, parseParts: parseParts, parseNumber: parseNumber,\n'+
 '        isTextRecipe: isTextRecipe, findBuiltin: findBuiltin, easeIndex: easeIndex, install: install,\n'+
 '        serialize: serialize, deserialize: deserialize, loadPresets: loadPresets, savePresets: savePresets};\n'+
 '})();\n'+
 'if (typeof $ !== \'undefined\' && $.global) { $.global.ESCore = ESCore; }\n';
if (out.indexOf("'tr_dissolve'") < 0 || out.indexOf("function buildLightCode") < 0 || out.indexOf("function buildRGBParts") < 0) { throw new Error('트랜지션 정의가 없는 구형 JSX 코어입니다. 현재 shelf-core.js를 덮어쓰지 않았습니다.'); }
fs.writeFileSync(process.argv[3],out,'utf8');
