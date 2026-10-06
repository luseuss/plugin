/* Expression Shelf core — shared by the web panel (browser) and host.jsx (ExtendScript). ES3.
   Canonical web core. Includes transition presets; do not overwrite with an older JSX core. */
var ESCore = (function () {
    var SECTION = 'ExpressionShelf_1', PREVIEW_TAG = 'ExpressionShelf:preview:v1';
    var TARGETS = ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity', 'ADBE Anchor Point'];
    var TARGET_NAMES = ['위치', '크기', 'Z 회전', '불투명도', '기준점'];
    // Effect sections: the panel adds (or reuses) an effect with this label and drives its first property.
    var EFFECTS = [{name: '블러', fx: 'ADBE Gaussian Blur 2', label: 'ES 블러'},
                   {name: '와이프', fx: 'ADBE Linear Wipe', label: 'ES 와이프'}];
    var CATS = ['등장·퇴장', '이동', '확대·축소', '회전', '탄성·반동', '강조', '반복(루프)', '텍스트', '트랜지션'];
    var CAT_SHORT = ['등장', '이동', '크기', '회전', '탄성', '강조', '루프', '텍스트', '전환'];
    var FEELS = ['부드러움', '경쾌함', '통통 튐', '무거움', '일정함'];
    // Standard easing curves; x is clamped to 0..1 before the body runs.
    var EASES = [
        ['linear', 'return x;'],
        ['easeInSine', 'return 1 - Math.cos(x * Math.PI / 2);'],
        ['easeOutSine', 'return Math.sin(x * Math.PI / 2);'],
        ['easeInOutSine', 'return -(Math.cos(Math.PI * x) - 1) / 2;'],
        ['easeInCubic', 'return x * x * x;'],
        ['easeOutCubic', 'return 1 - Math.pow(1 - x, 3);'],
        ['easeInOutCubic', 'return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;'],
        ['easeInQuart', 'return x * x * x * x;'],
        ['easeOutQuart', 'return 1 - Math.pow(1 - x, 4);'],
        ['easeInOutQuart', 'return x < 0.5 ? 8 * Math.pow(x, 4) : 1 - Math.pow(-2 * x + 2, 4) / 2;'],
        ['easeInQuint', 'return Math.pow(x, 5);'],
        ['easeOutQuint', 'return 1 - Math.pow(1 - x, 5);'],
        ['easeInOutQuint', 'return x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2;'],
        ['easeInExpo', 'return x === 0 ? 0 : Math.pow(2, 10 * x - 10);'],
        ['easeOutExpo', 'return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);'],
        ['easeInOutExpo', 'return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;'],
        ['easeInBack', 'return 2.70158 * x * x * x - 1.70158 * x * x;'],
        ['easeOutBack', 'return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);'],
        ['easeInOutBack', 'return x < 0.5 ? (Math.pow(2 * x, 2) * (3.5949095 * 2 * x - 2.5949095)) / 2 : (Math.pow(2 * x - 2, 2) * (3.5949095 * (2 * x - 2) + 2.5949095) + 2) / 2;'],
        ['easeOutElastic', 'return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * 2.0943951) + 1;'],
        ['easeOutBounce', 'var n = 7.5625, d = 2.75; if (x < 1 / d) { return n * x * x; } if (x < 2 / d) { x -= 1.5 / d; return n * x * x + 0.75; } if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; } x -= 2.625 / d; return n * x * x + 0.984375;'],
        ['spring', 'return x === 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(6 * Math.PI * x);']
    ];
    var ADD_FN = 'function ES_add(v, dx, dy) { return v.length > 2 ? [v[0] + dx, v[1] + dy, v[2]] : [v[0] + dx, v[1] + dy]; }\n';
    var MUL_FN = 'function ES_mul(v, sx, sy) { return v.length > 2 ? [v[0] * sx, v[1] * sy, v[2]] : [v[0] * sx, v[1] * sy]; }\n';
    var MARK = /^\/\/\s*\[([^\]]+)\]\s*$/;
    function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
    function copyArray(a) { var b = [], i; for (i = 0; i < a.length; i++) { b.push(a[i]); } return b; }
    function indexOf(a, x) { var i; for (i = 0; i < a.length; i++) { if (a[i] === x) { return i; } } return -1; }
    function n(x) { return String(Number(x)); }
    function param(label, value, min, max) { return {label: label, value: value, min: min, max: max}; }
    function isTextRecipe(r) { return String(r).indexOf('text_') === 0; }
    function easeIndex(name) { var i; for (i = 0; i < EASES.length; i++) { if (EASES[i][0] === name) { return i; } } return -1; }
    function effectInfo(name) { var i; for (i = 0; i < EFFECTS.length; i++) { if (EFFECTS[i].name === name) { return EFFECTS[i]; } } return null; }
    function isPartName(name) { return indexOf(TARGET_NAMES, name) >= 0 || !!effectInfo(name); }
    function motion(id, name, cat, feel, ms, ease, desc, params, gen, opts) {
        return {id: id, name: name, recipe: id, cat: cat, feel: feel, ms: ms, ease: ease, desc: desc, params: params, gen: gen,
            exit: !!(opts && opts.exit), anim: opts && opts.anim ? opts.anim : null,
            target: isTextRecipe(id) ? -1 : 0, preview: isTextRecipe(id) ? 'text' : 'shape', custom: false};
    }
    // Shared generators ------------------------------------------------------
    function fromLeft(v) { return [['위치', 'ES_add(value, -(' + n(v[0]) + ') * (1 - p), 0);']]; }
    function fromBelow(v) { return [['위치', 'ES_add(value, 0, ' + n(v[0]) + ' * (1 - p));']]; }
    function dropIn(v) { return [['위치', 'ES_add(value, 0, -(' + n(v[0]) + ') * (1 - p));']]; }
    function scaleUp() { return [['크기', 'ES_mul(value, p, p);']]; }
    function zoomIn(v) {
        return [['크기', 'var s = (' + n(v[0]) + ' + (100 - ' + n(v[0]) + ') * p) / 100;\nES_mul(value, s, s);'],
            ['블러', n(v[1]) + ' * (1 - p);'], ['불투명도', 'value * p;']];
    }
    function txtT(stagger) { return 'var t = time - inPoint - ES_DELAY - (ES_i - 1) * ' + n(stagger) + ';\n'; }
    var TXT_OUT = 'var a = 100 * (1 - ES_e(t / D));\n[a, a, a];';
    function animOpacity() { return [['ADBE Text Opacity', 0]]; }
    function animRise(v) { return [['ADBE Text Position 3D', [0, v[0], 0]], ['ADBE Text Opacity', 0]]; }
    var BUILTINS = [
        // 등장·퇴장
        motion('fade', '부드러운 등장', 0, '부드러움', 600, 'easeOutCubic', '불투명도 0에서 원래 값까지 서서히 나타납니다.', [],
            function () { return [['불투명도', 'value * p;']]; }),
        motion('fade_slide', '페이드+슬라이드', 0, '부드러움', 600, 'easeOutCubic', '투명도와 짧은 상승이 동시에 끝나며 조용히 제자리에 멈춥니다.',
            [param('이동 거리 (px)', 40, -2000, 2000)],
            function (v) { return [['불투명도', 'value * p;']].concat(fromBelow(v)); }),
        motion('slide', '아래에서 올라오기', 0, '부드러움', 700, 'easeOutCubic', '아래쪽에서 원래 위치로 이동합니다. 불투명도는 바꾸지 않습니다.',
            [param('이동 거리 (px)', 180, -2000, 2000)], fromBelow),
        motion('soft_rise', '소프트 라이즈', 0, '부드러움', 900, 'easeOutSine', '올라오는 동안 블러와 투명함이 풀리고, 멈출 때 윤곽이 완전히 돌아옵니다.',
            [param('이동 거리 (px)', 30, -2000, 2000), param('블러 (px)', 20, 0, 500)],
            function (v) { return [['불투명도', 'value * p;']].concat(fromBelow(v), [['블러', n(v[1]) + ' * (1 - p);']]); }),
        motion('snap_in', '스냅 인', 0, '경쾌함', 380, 'easeOutExpo', '목표 직전의 짧은 거리를 빠르게 좁혀 즉각적인 반응감을 줍니다.',
            [param('이동 거리 (px)', 160, -2000, 2000)],
            function (v) { return [['불투명도', 'value * p;']].concat(fromLeft(v)); }),
        motion('blur_zoom', '블러 줌', 0, '부드러움', 720, 'easeOutQuart', '크기·블러·불투명도가 동시에 끝나며 마지막 윤곽만 선명하게 남습니다.',
            [param('시작 크기 (%)', 60, 0, 500), param('블러 (px)', 30, 0, 500)], zoomIn),
        motion('depth_zoom', '깊이 줌', 0, '무거움', 740, 'easeInOutQuint', '작고 흐린 상태에서 앞으로 크게 다가오며 깊이감을 줍니다.',
            [param('시작 크기 (%)', 30, 0, 500), param('블러 (px)', 25, 0, 500)], zoomIn),
        motion('wipe_in', '와이프 등장', 0, '일정함', 700, 'easeInOutQuint', '레이어는 움직이지 않고 가려진 경계만 한 방향으로 빠져나갑니다. 방향은 ES 와이프 이펙트의 Wipe Angle에서 바꿉니다.', [],
            function () { return [['와이프', '100 * (1 - p);']]; }),
        motion('fade_out', '페이드 아웃+슬라이드', 0, '부드러움', 520, 'easeInCubic', '[퇴장] 레이어 끝(아웃 포인트)에 맞춰 위로 사라집니다.',
            [param('이동 거리 (px)', 40, -2000, 2000)],
            function (v) { return [['불투명도', 'value * (1 - p);'], ['위치', 'ES_add(value, 0, -(' + n(v[0]) + ') * p);']]; }, {exit: true}),
        motion('soft_shrink', '소프트 슈링크', 0, '부드러움', 600, 'easeInCubic', '[퇴장] 레이어 끝에 맞춰 제자리에서 작아지며 흐려집니다.',
            [param('끝 크기 (%)', 60, 0, 500)],
            function (v) { return [['크기', 'var s = 1 - (1 - ' + n(v[0]) + ' / 100) * p;\nES_mul(value, s, s);'], ['불투명도', 'value * (1 - p);']]; }, {exit: true}),
        motion('fold_out', '접혀서 퇴장', 0, '경쾌함', 560, 'easeInBack', '[퇴장] 레이어 끝에 맞춰 세로로 접히며 사라집니다. 기준점을 아래쪽에 두면 바닥을 기준으로 접힙니다.', [],
            function () { return [['크기', 'ES_mul(value, 1, 1 - p);'], ['불투명도', 'value * (1 - p);']]; }, {exit: true}),
        // 이동
        motion('move_smooth', '부드러운 도착', 1, '부드러움', 760, 'easeInOutCubic', '출발과 도착에서 느려지고 중간이 가장 빠릅니다. 왼쪽에서 원래 위치로 들어옵니다.',
            [param('이동 거리 (px)', 300, -4000, 4000)], fromLeft),
        motion('move_linear', '일정한 속도 이동', 1, '일정함', 800, 'linear', '처음부터 끝까지 같은 속도로 이동합니다.',
            [param('이동 거리 (px)', 300, -4000, 4000)], fromLeft),
        motion('move_anticipate', '예비동작 이동', 1, '경쾌함', 820, 'easeInOutBack', '움직이기 전에 반대쪽으로 살짝 당겼다가 이동합니다.',
            [param('이동 거리 (px)', 300, -4000, 4000)], fromLeft),
        motion('move_heavy', '무거운 정지', 1, '무거움', 680, 'easeOutQuart', '도착하는 순간 진행 방향으로 눌렸다가 작은 반동으로 무게를 받아냅니다.',
            [param('이동 거리 (px)', 300, -4000, 4000), param('눌림 (%)', 10, 0, 50)],
            function (v) {
                return fromLeft(v).concat([['크기', 'var k = t - D;\nvar q = k < 0 ? 0 : ' + n(v[1]) + ' / 100 * Math.exp(-8 * k) * Math.sin(k * 18);\nES_mul(value, 1 - q, 1 + q);']]);
            }),
        motion('move_arc', '호를 그리며 이동', 1, '부드러움', 1200, 'easeInOutSine', '꺾임 없는 곡선(2차 베지어)을 따라 원래 위치로 들어옵니다.',
            [param('가로 거리 (px)', 400, -4000, 4000), param('곡선 높이 (px)', 200, -4000, 4000)],
            function (v) { return [['위치', 'var q = 1 - p;\nES_add(value, -(' + n(v[0]) + ') * q, -2 * (' + n(v[1]) + ') * q * p);']]; }),
        // 확대·축소
        motion('pop', '팝 스케일', 2, '통통 튐', 520, 'easeOutBack', '작은 상태에서 기준 크기를 살짝 넘었다가 100%로 돌아옵니다.', [], scaleUp),
        motion('scale_elastic', '엘라스틱 스케일', 2, '통통 튐', 900, 'easeOutElastic', '크게 넘친 뒤 반동 폭을 줄이며 100%로 수렴합니다.', [], scaleUp),
        motion('stretch', '축 방향 스트레치', 2, '경쾌함', 700, 'easeInOutBack', '이동 방향으로 길어지고 반대 방향으로 짧아지며 속도감을 강조합니다.',
            [param('이동 거리 (px)', 300, -4000, 4000), param('늘어남 (%)', 25, 0, 200)],
            function (v) {
                return fromLeft(v).concat([['크기', 'var q = ' + n(v[1]) + ' / 100 * Math.sin(Math.PI * Math.min(1, Math.max(0, t / D)));\nES_mul(value, 1 + q, 1 - q);']]);
            }),
        // 회전
        motion('turn', '심플 턴', 3, '부드러움', 1200, 'easeInOutCubic', '천천히 시작해 중간에 빠르게 돌고 천천히 원래 각도에 멈춥니다.',
            [param('회전 각도 (도)', 180, -3600, 3600)],
            function (v) { return [['Z 회전', 'value - (' + n(v[0]) + ') * (1 - p);']]; }),
        motion('spin_stop', '스핀 정지', 3, '무거움', 1600, 'easeOutQuart', '빠른 회전에서 서서히 감속해 원래 각도에 정확히 멈춥니다.',
            [param('회전 수', 3, -50, 50)],
            function (v) { return [['Z 회전', 'value - (' + n(v[0]) + ') * 360 * (1 - p);']]; }),
        motion('pendulum', '진자 흔들림', 3, '부드러움', null, null, '좌우로 흔들리며 진폭이 줄어 제자리로 돌아옵니다. 기준점을 위쪽 끝에 두세요.',
            [param('각도 (도)', 30, 0, 180), param('감쇠', 1.2, 0, 20), param('빈도 (회/초)', 1, 0.01, 20)],
            function (v) { return [['Z 회전', 'value + ' + n(v[0]) + ' * Math.exp(-' + n(v[1]) + ' * u) * Math.cos(2 * Math.PI * ' + n(v[2]) + ' * u);']]; }),
        motion('tumble_in', '텀블 인', 3, '경쾌함', 820, 'easeOutCubic', '이동이 먼저 끝나고 회전이 조금 늦게 제자리를 찾습니다.',
            [param('이동 거리 (px)', 250, -4000, 4000), param('회전 각도 (도)', 120, -3600, 3600)],
            function (v) { return fromLeft(v).concat([['Z 회전', 'value - (' + n(v[1]) + ') * (1 - ES_e(t / (D * 1.3)));']]); }),
        // 탄성·반동
        motion('overshoot', '오버슈트', 4, '통통 튐', 600, 'easeOutBack', '목표 위치를 살짝 넘은 뒤 짧게 돌아와 멈춥니다.',
            [param('이동 거리 (px)', 200, -4000, 4000)], fromLeft),
        motion('bounce_land', '바운스 착지', 4, '통통 튐', 700, 'easeOutBounce', '떨어진 뒤 튀어 오르는 높이가 점점 낮아지며 착지합니다.',
            [param('낙하 높이 (px)', 250, -4000, 4000)], dropIn),
        motion('spring_follow', '스프링 추종', 4, '통통 튐', 1800, 'spring', '목표를 넘었다가 반동을 줄이며 모입니다. 여러 레이어에 레이어 간격 0.08초로 적용하면 앞 레이어를 따라오는 느낌이 납니다.',
            [param('이동 거리 (px)', 250, -4000, 4000)], fromLeft),
        motion('land_squash', '착지 스쿼시', 4, '무거움', 450, 'easeInCubic', '떨어져 닿는 순간 세로로 눌리고 가로로 퍼졌다가 원래 모양으로 돌아옵니다.',
            [param('낙하 높이 (px)', 250, -4000, 4000), param('눌림 (%)', 20, 0, 80)],
            function (v) {
                return dropIn(v).concat([['크기', 'var k = t - D;\nvar q = k < 0 ? 0 : ' + n(v[1]) + ' / 100 * Math.exp(-9 * k) * Math.cos(k * 22);\nES_mul(value, 1 + q, 1 - q);']]);
            }),
        motion('recoil', '리코일', 4, '경쾌함', 520, 'easeOutQuart', '강하게 앞으로 나간 직후 짧게 물러났다가 최종 위치에 자리 잡습니다.',
            [param('이동 거리 (px)', 200, -4000, 4000), param('반동 (px)', 24, 0, 500)],
            function (v) {
                return [['위치', 'var k = Math.max(0, t - D * 0.6);\nES_add(value, -(' + n(v[0]) + ') * (1 - p) - ' + n(v[1]) + ' * Math.exp(-10 * k) * Math.sin(k * 16), 0);']];
            }),
        motion('aftershock', '여진', 4, '경쾌함', null, null, '충격 직후 좌우 흔들림이 번갈아 뒤집히며 빠르게 잦아듭니다.',
            [param('흔들림 (px)', 30, 0, 1000), param('감쇠', 6, 0, 50), param('빈도 (회/초)', 8, 0.1, 40)],
            function (v) { return [['위치', 'ES_add(value, t < 0 ? 0 : ' + n(v[0]) + ' * Math.exp(-' + n(v[1]) + ' * u) * Math.sin(2 * Math.PI * ' + n(v[2]) + ' * u), 0);']]; }),
        // 강조
        motion('nudge', '넛지', 5, '경쾌함', 520, 'easeOutCubic', '옆으로 짧게 움직였다가 원래 위치로 돌아옵니다.',
            [param('거리 (px)', 20, -1000, 1000)],
            function (v) { return [['위치', 'ES_add(value, (' + n(v[0]) + ') * Math.sin(Math.PI * p), 0);']]; }),
        motion('attention', '주목 바운스', 5, '통통 튐', 620, 'easeOutSine', '위로 한 번 튀었다가 제자리에 착지해, 위치를 바꾸지 않고 강조합니다.',
            [param('높이 (px)', 40, -1000, 1000)],
            function (v) { return [['위치', 'ES_add(value, 0, -(' + n(v[0]) + ') * Math.sin(Math.PI * p));']]; }),
        motion('press', '프레스 피드백', 5, '경쾌함', 420, 'easeOutCubic', '제자리에서 짧게 눌렸다가 바로 원래 크기로 돌아옵니다.',
            [param('눌림 (%)', 8, 0, 90)],
            function (v) { return [['크기', 'var s = 1 - ' + n(v[0]) + ' / 100 * Math.sin(Math.PI * p);\nES_mul(value, s, s);']]; }),
        motion('jelly', '젤리 강조', 5, '통통 튐', null, null, '가로·세로 늘어남이 번갈아 약해지며 부피감 있게 원래 모양으로 돌아옵니다.',
            [param('폭 (%)', 25, 0, 100), param('감쇠', 4, 0, 50), param('빈도 (회/초)', 3, 0.1, 30)],
            function (v) {
                return [['크기', 'var q = t < 0 ? 0 : ' + n(v[0]) + ' / 100 * Math.exp(-' + n(v[1]) + ' * u) * Math.sin(2 * Math.PI * ' + n(v[2]) + ' * u);\nES_mul(value, 1 + q, 1 - q);']];
            }),
        motion('tilt', '틸트 리액션', 5, '경쾌함', 600, 'easeOutCubic', '한쪽으로 짧게 기울었다가 곧 원래 각도로 돌아옵니다.',
            [param('각도 (도)', 8, -90, 90)],
            function (v) { return [['Z 회전', 'value + (' + n(v[0]) + ') * Math.sin(Math.PI * p);']]; }),
        motion('neon', '네온 깜빡임', 5, '일정함', 900, null, '불규칙하게 짧게 꺼졌다 켜지다가 안정된 밝기로 자리 잡습니다.',
            [param('깜빡임 (회/초)', 20, 1, 60)],
            function (v) {
                return [['불투명도', 'var o = value;\nif (t < 0) { o = 0; } else if (t < D) { seedRandom(Math.floor(t * ' + n(v[0]) + '), true); if (random() < 0.45) { o = value * 0.15; } }\no;']];
            }),
        // 반복(루프)
        motion('wiggle', '랜덤 흔들림', 6, '경쾌함', null, null, '위치를 자연스럽게 흔듭니다. 강도는 px, 빈도는 초당 횟수입니다.',
            [param('강도 (px)', 20, 0, 2000), param('빈도 (회/초)', 2, 0.01, 30)],
            function (v) { return [['위치', 't < 0 ? value : wiggle(' + n(v[1]) + ', ' + n(v[0]) + ', 1, 0.5, inPoint + t);']]; }),
        motion('float', '위아래 둥둥', 6, '부드러움', null, null, '원래 위치를 중심으로 부드럽게 상하 왕복합니다.',
            [param('높이 (px)', 35, 0, 2000), param('빈도 (회/초)', 0.5, 0.01, 20)],
            function (v) { return [['위치', 'ES_add(value, 0, ' + n(v[0]) + ' * Math.sin(u * 2 * Math.PI * ' + n(v[1]) + '));']]; }),
        motion('pulse', '크기 숨쉬기', 6, '부드러움', null, null, '현재 크기를 중심으로 커졌다 작아집니다. 기준점이 중심이면 자연스럽습니다.',
            [param('변화 폭 (%)', 8, 0, 90), param('빈도 (회/초)', 0.6, 0.01, 20)],
            function (v) { return [['크기', 'var s = 1 + ' + n(v[0]) + ' / 100 * Math.sin(u * 2 * Math.PI * ' + n(v[1]) + ');\nES_mul(value, s, s);']]; }),
        motion('spin', '일정한 회전', 6, '일정함', null, null, '레이어 시작 이후 일정한 속도로 Z 회전합니다.',
            [param('회전 속도 (도/초)', 45, -1440, 1440)],
            function (v) { return [['Z 회전', 'value + u * (' + n(v[0]) + ');']]; }),
        motion('swing', '좌우 흔들 회전', 6, '부드러움', null, null, '원래 각도를 중심으로 왕복합니다.',
            [param('각도 (도)', 12, 0, 180), param('빈도 (회/초)', 0.8, 0.01, 20)],
            function (v) { return [['Z 회전', 'value + ' + n(v[0]) + ' * Math.sin(u * 2 * Math.PI * ' + n(v[1]) + ');']]; }),
        motion('orbit', '궤도 회전', 6, '일정함', null, null, '원래 위치에서 출발해 일정한 반지름으로 원을 그리며 돕니다.',
            [param('반지름 (px)', 80, 0, 4000), param('한 바퀴 (초)', 2.6, 0.05, 600)],
            function (v) {
                return [['위치', 'var w = u * 2 * Math.PI / ' + n(v[1]) + ';\nES_add(value, ' + n(v[0]) + ' * (Math.cos(w) - 1), ' + n(v[0]) + ' * Math.sin(w));']];
            }),
        // 텍스트 (글자별 애니메이터 + 표현식 선택기)
        motion('text_fade', '글자별 페이드', 7, '부드러움', 400, 'easeOutCubic', '한 글자씩 순서대로 나타납니다. 원본 텍스트는 유지합니다.',
            [param('글자 간격 (초)', 0.07, 0, 2)],
            function (v) { return txtT(v[0]) + TXT_OUT; }, {anim: animOpacity}),
        motion('text_rise', '글자별 올라오기', 7, '부드러움', 500, 'easeOutCubic', '각 글자가 아래에서 올라오며 나타납니다.',
            [param('이동 거리 (px)', 65, -1000, 1000), param('글자 간격 (초)', 0.06, 0, 2)],
            function (v) { return txtT(v[1]) + TXT_OUT; }, {anim: animRise}),
        motion('text_elastic', '글자별 탄성 등장', 7, '통통 튐', 1000, 'easeOutElastic', '각 글자가 아래에서 탄성 있게 올라옵니다.',
            [param('이동 거리 (px)', 80, -1000, 1000), param('글자 간격 (초)', 0.07, 0, 2)],
            function (v) { return txtT(v[1]) + TXT_OUT; }, {anim: animRise}),
        motion('text_random', '랜덤 탄성 등장', 7, '통통 튐', 700, 'easeOutBack', '글자별 시작 시간이 무작위입니다. 같은 글자 순서는 항상 같은 지연을 사용합니다.',
            [param('이동 거리 (px)', 80, -1000, 1000), param('최대 랜덤 지연 (초)', 0.8, 0, 10)],
            function (v) { return 'seedRandom(ES_i, true);\nvar t = time - inPoint - ES_DELAY - random(0, ' + n(v[1]) + ');\n' + TXT_OUT; }, {anim: animRise}),
        motion('text_drop', '글자 떨어지기', 7, '통통 튐', 800, 'easeOutBounce', '각 글자가 위에서 떨어져 튕기며 자리 잡습니다.',
            [param('시작 위치 (px, 음수=위)', -80, -1000, 1000), param('글자 간격 (초)', 0.05, 0, 2)],
            function (v) { return txtT(v[1]) + TXT_OUT; }, {anim: animRise}),
        motion('text_blur', '글자 블러 해상', 7, '부드러움', 820, 'easeOutSine', '윤곽의 흐림과 투명함이 함께 줄며 글자가 초점 안으로 들어옵니다.',
            [param('블러 (px)', 20, 0, 500), param('글자 간격 (초)', 0.03, 0, 2)],
            function (v) { return txtT(v[1]) + TXT_OUT; },
            {anim: function (v) { return [['ADBE Text Blur', [v[0], v[0]]], ['ADBE Text Opacity', 0]]; }}),
        motion('text_pop', '글자 팝', 7, '통통 튐', 500, 'easeOutBack', '글자가 0%에서 살짝 넘쳤다가 100% 크기로 자리 잡습니다.',
            [param('글자 간격 (초)', 0.05, 0, 2)],
            function (v) { return txtT(v[0]) + TXT_OUT; },
            {anim: function () { return [['ADBE Text Scale 3D', [0, 0, 100]]]; }}),
        motion('text_track', '자간 벌리기', 7, '부드러움', 760, 'easeOutQuart', '좁은 자간에서 원래 자간으로 넓어지며 문자열의 윤곽과 여백이 정돈됩니다.',
            [param('시작 자간', -60, -1000, 1000), param('글자 간격 (초)', 0, 0, 2)],
            function (v) { return txtT(v[1]) + TXT_OUT; },
            {anim: function (v) { return [['ADBE Text Tracking Amount', v[0]], ['ADBE Text Opacity', 0]]; }}),
        motion('text_wave', '글자 웨이브', 7, '부드러움', null, null, '글자마다 위상이 다른 상하 물결 움직임을 만듭니다.',
            [param('높이 (px)', 20, 0, 500), param('빈도 (회/초)', 1, 0.01, 15), param('글자 위상 차 (도)', 35, -360, 360)],
            function (v) {
                return 'var t = time - inPoint - ES_DELAY;\nvar s = t < 0 ? 0 : 100 * Math.sin(2 * Math.PI * ' + n(v[1]) + ' * t - (ES_i - 1) * ' + n(v[2]) + ' * Math.PI / 180);\n[s, s, s];';
            },
            {anim: function (v) { return [['ADBE Text Position 3D', [0, v[0], 0]]]; }}),
        motion('text_type', '타자기 등장', 7, '일정함', null, null, '글자를 한 개씩 즉시 표시합니다. 소스 텍스트를 잘라내지 않습니다.',
            [param('초당 글자 수', 12, 0.1, 100)],
            function (v) { return 'var t = time - inPoint - ES_DELAY;\nvar s = t < (ES_i - 1) / ' + n(v[0]) + ' ? 100 : 0;\n[s, s, s];'; },
            {anim: animOpacity})
    ];
    // Incoming-scene transitions: B is above A and starts at its own inPoint.
    function transition(id, name, feel, ms, ease, desc, params, gen) {
        var p = motion(id, name, 8, feel, ms, ease, desc, params, gen);
        p.transition = true;
        return p;
    }
    BUILTINS = BUILTINS.concat([
        transition('tr_dissolve', '디졸브', '부드러움', 700, 'easeInOutSine', '아래의 장면 A 위로 다음 장면 B가 서서히 나타납니다.', [],
            function () { return [['불투명도', 'value * p;']]; }),
        transition('tr_blur', '블러 디졸브', '부드러움', 650, 'easeOutCubic', '다음 장면이 흐린 상태에서 선명해지며 겹쳐집니다.', [param('블러 (px)', 45, 0, 300)],
            function (v) { return [['불투명도', 'value * p;'], ['블러', n(v[0]) + ' * (1 - p);']]; }),
        transition('tr_zoom_in', '줌 인 전환', '경쾌함', 600, 'easeOutQuart', '확대된 다음 장면이 원래 크기로 돌아오며 선명해집니다.', [param('시작 크기 (%)', 145, 100, 300), param('블러 (px)', 25, 0, 300)], zoomIn),
        transition('tr_zoom_out', '줌 아웃 전환', '부드러움', 650, 'easeOutCubic', '작은 다음 장면이 커지면서 화면을 채웁니다.', [param('시작 크기 (%)', 65, 1, 100), param('블러 (px)', 20, 0, 300)], zoomIn),
        transition('tr_slide_left', '슬라이드 ←', '경쾌함', 600, 'easeInOutCubic', '다음 장면이 오른쪽에서 들어와 이전 장면을 덮습니다.', [],
            function () { return [['위치', 'ES_add(value, thisComp.width * (1 - p), 0);']]; }),
        transition('tr_slide_right', '슬라이드 →', '경쾌함', 600, 'easeInOutCubic', '다음 장면이 왼쪽에서 들어와 이전 장면을 덮습니다.', [],
            function () { return [['위치', 'ES_add(value, -thisComp.width * (1 - p), 0);']]; }),
        transition('tr_slide_up', '슬라이드 ↑', '부드러움', 650, 'easeInOutCubic', '다음 장면이 아래에서 올라와 화면을 채웁니다.', [],
            function () { return [['위치', 'ES_add(value, 0, thisComp.height * (1 - p));']]; }),
        transition('tr_slide_down', '슬라이드 ↓', '부드러움', 650, 'easeInOutCubic', '다음 장면이 위에서 내려와 화면을 채웁니다.', [],
            function () { return [['위치', 'ES_add(value, 0, -thisComp.height * (1 - p));']]; }),
        transition('tr_wipe', '리니어 와이프', '일정함', 700, 'linear', '다음 장면의 경계가 열리며 이전 장면을 덮습니다. 실제 방향과 페더는 ES 와이프 이펙트에서 조절합니다.', [],
            function () { return [['와이프', '100 * (1 - p);']]; }),
        transition('tr_spin', '스핀 줌 전환', '경쾌함', 800, 'easeOutCubic', '작고 회전된 다음 장면이 커지며 원래 각도에 멈춥니다.', [param('시작 각도 (도)', -90, -720, 720), param('시작 크기 (%)', 60, 1, 200)],
            function (v) { return [['불투명도', 'value * p;'], ['크기', 'var s = (' + n(v[1]) + ' + (100 - ' + n(v[1]) + ') * p) / 100;\nES_mul(value, s, s);'], ['Z 회전', 'value + (' + n(v[0]) + ') * (1 - p);']]; })
    ]);
    BUILTINS = BUILTINS.concat([
        transition('tr_glitch', '글리치 전환', '경쾌함', 450, 'linear', '화면이 가로로 튀고 늘어나며 순간적으로 깜빡이는 디지털 전환입니다. R/G/B 채널 잔상을 분리하고 색 플래시를 더합니다. RGB 3개와 색 플래시 1개 보조 레이어가 생성됩니다.',
            [param('떨림 (px)', 70, 0, 400), param('변화 횟수 (회/초)', 24, 1, 60), param('가로 왜곡 (%)', 12, 0, 60), param('RGB 분리 폭 (px)', 28, 0, 200), param('색 날림 (%)', 45, 0, 100)],
            function (v) {
                var pre = 'var q = Math.min(1, Math.max(0, t / D));\nvar g = Math.sin(Math.PI * q);\nvar f = Math.floor(u * ' + n(v[1]) + ');\n';
                return [['위치', pre + 'ES_add(value, ' + n(v[0]) + ' * g * Math.sin(f * 2.17), ' + n(v[0]) + ' * 0.12 * g * Math.sin(f * 4.1));'],
                    ['크기', pre + 'ES_mul(value, 1 + ' + n(v[2]) + ' / 100 * g * Math.sin(f * 3.3), 1);'],
                    ['불투명도', pre + 'var flicker = Math.sin(f * 2.7) > 0.6 ? 0.45 : 1;\nt < 0 ? 0 : t >= D ? value : value * Math.min(1, q * 1.9) * flicker;']];
            }),
        transition('tr_light_leak', '라이트 리크', '부드러움', 1100, 'easeInOutSine', '따뜻한 주황·노란 빛이 화면을 쓸고 지나가며 장면이 바뀝니다. 적용 시 B 위에 Screen 모드의 ES Light Leak 레이어 1개를 자동 생성합니다. 빛은 수치·길이·이징으로, 코드창은 B의 페이드만 조절합니다.',
            [param('빛 강도 (%)', 90, 0, 100), param('빛 폭 (%)', 100, 30, 180)],
            function () { return [['불투명도', 'var q = Math.min(1, Math.max(0, (t / D - 0.2) / 0.6));\nvalue * (q * q * (3 - 2 * q));']]; })
    ]);
    // Same generated expressions drive the web light and the real AE overlay.
    function buildLightCode(v, m) {
        var p = {name:'Light Leak overlay', ms:m.ms, ease:m.ease, exit:false, anim:null,
            gen:function () {
                return [['위치', '[thisComp.width * (-0.15 + 1.3 * p), thisComp.height * (0.4 + 0.2 * p)];'],
                    ['크기', '[' + n(v[1]) + ', 100];'],
                    ['불투명도', 'var q = Math.min(1, Math.max(0, t / D));\n' + n(v[0]) + ' * Math.pow(Math.max(0, Math.sin(Math.PI * q)), 1.3);']];
            }};
        return buildCode(p, v, m);
    }
    function glitchPrelude(v, m) {
        return 'var D = ' + n(m.ms / 1000) + ';\nvar t = time - inPoint - ES_DELAY;\nvar u = Math.max(0, t);\nvar q = Math.min(1, Math.max(0, t / D));\nvar g = t <= 0 || t >= D ? 0 : Math.sin(Math.PI * q);\nvar f = Math.floor(u * ' + n(v[1]) + ');\n';
    }
    function buildRGBParts(v, m, channel) {
        var h = glitchPrelude(v, m), dir = channel === 0 ? -1 : channel === 2 ? 1 : 0;
        return [
            {target:'위치', code:h + ADD_FN + 'var dx = ' + n(v[0]) + '*g*Math.sin(f*2.17) + ' + n(dir*v[3]) + '*g*(0.4+0.6*Math.abs(Math.sin(f*1.73)));\nvar dy = '+n(v[0])+'*0.12*g*Math.sin(f*4.1) + '+n(channel===1?v[3]*0.22:0)+'*g*Math.sin(f*2.3);\nES_add(value, dx, dy);'},
            {target:'크기', code:h + MUL_FN + 'ES_mul(value, 1 + '+n(v[2])+'/100*g*Math.sin(f*3.3), 1);'},
            {target:'불투명도', code:h + 'value * g * '+n(v[3]>0?0.7:0)+' * (Math.sin(f*2.7)>0.6 ? 0.45 : 1);'}
        ];
    }
    function buildGlitchFlash(v, m) {
        var h = glitchPrelude(v, m);
        return {opacity:h + n(v[4])+' * g * (Math.sin(f*3.7)>0.15 ? 1 : 0);',
            color:h+'var phase = f % 3;\nphase === 0 ? [1,1,1,1] : phase === 1 ? [1,0.08,0.65,1] : [0.08,0.8,1,1];'};
    }
    function findBuiltin(recipe) { var i; for (i = 0; i < BUILTINS.length; i++) { if (BUILTINS[i].recipe === recipe) { return BUILTINS[i]; } } return null; }
    // m = {ms, ease} from the panel; null for presets without timing controls.
    function buildCode(p, v, m) {
        var head = '// Expression Shelf | ' + p.name, pre = '', body = '', parts, i, e;
        if (p.ms !== null) {
            if (!m) { throw new Error('길이(ms)를 입력하세요.'); }
            head += '  (' + m.ms + 'ms' + (p.ease ? ' · ' + m.ease : '') + ')';
            pre += 'var D = ' + n(m.ms / 1000) + ';\n';
        }
        if (p.ease) {
            e = easeIndex(m.ease);
            if (e < 0) { throw new Error('지원하지 않는 이징입니다: ' + m.ease); }
            pre += 'function ES_e(x) { x = Math.min(1, Math.max(0, x)); ' + EASES[e][1] + ' }\n';
        }
        if (p.anim) {
            return head + '\n// 텍스트 애니메이터 > 표현식 선택기 > 양(Amount)용 코드. ES_DELAY는 패널이 자동 입력\n' +
                'var ES_i = (typeof textIndex === "undefined") ? 1 : textIndex;\n' + pre + p.gen(v);
        }
        pre += p.exit ? 'var t = time - outPoint + D + ES_DELAY;\n' : 'var t = time - inPoint - ES_DELAY;\n';
        pre += 'var u = Math.max(0, t);\n';
        if (p.ease) { pre += 'var p = ES_e(t / D);\n'; }
        parts = p.gen(v);
        for (i = 0; i < parts.length; i++) { body += '// [' + parts[i][0] + ']\n' + parts[i][1] + '\n'; }
        if (body.indexOf('ES_add(') >= 0) { pre += ADD_FN; }
        if (body.indexOf('ES_mul(') >= 0) { pre += MUL_FN; }
        return head + '\n// ES_DELAY: 시작 지연(패널이 자동 입력). "// [속성]" 줄 아래 코드가 그 속성에 적용됩니다.\n' + pre + body;
    }
    function fullCode(code, delay) { return 'var ES_DELAY = ' + Number(delay) + ';\n' + code; }
    // Splits code into {target, code} parts at "// [속성]" lines; text before the first marker is shared.
    function parseParts(code, fallbackTarget) {
        var lines = code.split('\n'), shared = [], parts = [], cur = null, seen = {}, i, m, j, out = [];
        for (i = 0; i < lines.length; i++) {
            m = MARK.exec(trim(lines[i]));
            if (m && isPartName(trim(m[1]))) {
                if (seen[trim(m[1])]) { throw new Error('같은 속성 구역이 두 번 있습니다: ' + trim(m[1])); }
                seen[trim(m[1])] = true;
                cur = {target: trim(m[1]), lines: []}; parts.push(cur);
            } else if (cur) { cur.lines.push(lines[i]); } else { shared.push(lines[i]); }
        }
        if (!parts.length) {
            if (fallbackTarget < 0 || fallbackTarget >= TARGET_NAMES.length) { throw new Error('코드 대상 속성이 없습니다.'); }
            return [{target: TARGET_NAMES[fallbackTarget], code: code}];
        }
        for (j = 0; j < parts.length; j++) {
            if (!trim(parts[j].lines.join('\n').replace(/\/\/[^\n]*/g, ''))) { throw new Error('[' + parts[j].target + '] 구역에 코드가 없습니다.'); }
            out.push({target: parts[j].target, code: shared.concat(parts[j].lines).join('\n')});
        }
        return out;
    }
    function parseNumber(s, min, max, name) {
        if (trim(s) === '' || !isFinite(Number(s)) || Number(s) < min || Number(s) > max) {
            throw new Error(name + ': ' + min + ' ~ ' + max + ' 범위의 숫자를 입력하세요.');
        }
        return Number(s);
    }
    function serialize(items) {
        var lines = ['ESHELF1'], i, p, f, j;
        for (i = 0; i < items.length; i++) {
            p = items[i]; f = [p.id, p.name, p.recipe, p.target, p.preview, p.values.join(','), p.code];
            for (j = 0; j < f.length; j++) { f[j] = encodeURIComponent(String(f[j])); }
            lines.push(f.join('|'));
        }
        return lines.join('\n');
    }
    function deserialize(s) {
        var lines = s.split('\n'), out = [], i, j, f, p, seen = {};
        if (lines.shift() !== 'ESHELF1') { throw new Error('프리셋 저장 형식이 올바르지 않습니다.'); }
        for (i = 0; i < lines.length; i++) {
            if (!lines[i]) { continue; } f = lines[i].split('|');
            if (f.length !== 7) { throw new Error('손상된 프리셋 항목입니다.'); }
            for (j = 0; j < f.length; j++) { f[j] = decodeURIComponent(f[j]); }
            if (!/^user_[0-9_]+$/.test(f[0]) || seen[f[0]]) { throw new Error('프리셋 ID 오류'); }
            seen[f[0]] = true;
            if ((f[2] !== 'custom' && !findBuiltin(f[2])) || (f[4] !== 'shape' && f[4] !== 'text')) { throw new Error('프리셋 종류 오류'); }
            var target = Number(f[3]), isText = isTextRecipe(f[2]);
            if (!isFinite(target) || target % 1 !== 0 || (isText ? target !== -1 : (target < 0 || target >= TARGETS.length))) { throw new Error('대상 속성 오류'); }
            var values = f[5] ? f[5].split(',') : [];
            if (values.length > 5) { throw new Error('수치 데이터 오류'); }
            for (j = 0; j < values.length; j++) { values[j] = parseNumber(values[j], -100000, 100000, '저장 수치'); }
            if (isText && values.length < 1) { throw new Error('텍스트 수치 데이터 없음'); }
            if (!trim(f[1]) || f[1].length > 80 || !trim(f[6]) || f[6].length > 24000) { throw new Error('프리셋 이름 또는 코드 오류'); }
            p = {id: f[0], name: f[1], recipe: f[2], target: target, preview: isText ? 'text' : f[4], values: values, code: f[6],
                custom: true, params: [], ms: null, ease: null,
                desc: '저장된 코드와 수치의 스냅샷입니다. 코드 수정 후 새 이름으로 저장할 수 있습니다.'};
            out.push(p);
        }
        if (out.length > 60) { throw new Error('사용자 프리셋은 최대 60개입니다.'); }
        return out;
    }
    function loadPresets(settings) {
        if (!settings.haveSetting(SECTION, 'active')) { return []; }
        var slot = settings.getSetting(SECTION, 'active'), sec = SECTION + '_' + slot, raw = '', i, count;
        if (slot !== 'A' && slot !== 'B') { throw new Error('프리셋 저장 슬롯 오류'); }
        count = parseNumber(settings.getSetting(sec, 'count'), 1, 5000, '저장 조각');
        if (count % 1) { throw new Error('저장 조각 오류'); }
        for (i = 0; i < count; i++) { raw += settings.getSetting(sec, 'data' + i); }
        return deserialize(raw);
    }
    function savePresets(settings, items) {
        var raw = serialize(items), prev = settings.haveSetting(SECTION, 'active') ? settings.getSetting(SECTION, 'active') : 'B';
        var slot = prev === 'A' ? 'B' : 'A', sec = SECTION + '_' + slot, n2 = Math.ceil(raw.length / 1500), i;
        if (n2 > 5000) { throw new Error('저장 가능한 전체 용량을 초과했습니다. 긴 프리셋을 줄여주세요.'); }
        // Only ASCII chunks; switch active slot after a complete write.
        for (i = 0; i < n2; i++) { settings.saveSetting(sec, 'data' + i, raw.substr(i * 1500, 1500)); }
        settings.saveSetting(sec, 'count', String(n2));
        settings.saveSetting(SECTION, 'active', slot);
    }
    function checkedExpression(prop, code, time) {
        if (!prop || !prop.canSetExpression) { throw new Error('익스프레션을 적용할 수 없는 속성입니다.'); }
        prop.expression = code; prop.expressionEnabled = true;
        prop.valueAtTime(time, false);
        if (prop.expressionError) { throw new Error(prop.expressionError); }
    }
    function textAnimatorName(p) { return '[ES:' + p.id + '] ' + p.name; }
    function installText(layer, p, values, code, overwrite, time) {
        var text = layer.property('ADBE Text Properties'), spec = findBuiltin(p.recipe);
        if (!text) { return {skip: true, message: '텍스트 레이어만 적용 가능'}; }
        if (!spec || !spec.anim) { throw new Error('텍스트 프리셋 정보를 찾지 못했습니다: ' + p.recipe); }
        var anims = text.property('ADBE Text Animators'), old = [], i, marker = '[ES:' + p.id + '] ', list = spec.anim(values);
        for (i = 1; i <= anims.numProperties; i++) { if (anims.property(i).name.indexOf(marker) === 0) { old.push(i); } }
        if (old.length && !overwrite) { return {skip: true, message: '같은 프리셋의 기존 애니메이터 유지'}; }
        var created = 0, animator, selectors, sel, amount;
        try {
            animator = anims.addProperty('ADBE Text Animator'); created = animator.propertyIndex;
            animator.name = textAnimatorName(p);
            for (i = 0; i < list.length; i++) {
                // Adding to indexed groups can invalidate property handles: reacquire each time.
                anims.property(created).property('ADBE Text Animator Properties').addProperty(list[i][0]).setValue(list[i][1]);
            }
            animator = anims.property(created);
            selectors = animator.property('ADBE Text Selectors');
            while (selectors.numProperties) { selectors.property(selectors.numProperties).remove(); }
            sel = selectors.addProperty('ADBE Text Expressible Selector');
            amount = sel.property('ADBE Text Expressible Amount');
            if (!amount) { throw new Error('이 에펙 버전에서 텍스트 표현식 선택기를 찾지 못했습니다.'); }
            checkedExpression(amount, code, time);
        } catch (err) {
            if (created) {
                try { anims.property(created).remove(); }
                catch (cleanErr) { throw new Error(String(err) + ' / 새 애니메이터 복구 실패: 실행 취소하세요.'); }
            }
            throw err;
        }
        // Old managed animators survive until the replacement validates.
        for (i = old.length - 1; i >= 0; i--) { anims.property(old[i]).remove(); }
        return {skip: false};
    }
    function transformProp(layer, name) {
        var tg = layer.property('ADBE Transform Group'), k = indexOf(TARGET_NAMES, name);
        return tg && k >= 0 ? tg.property(TARGETS[k]) : null;
    }
    function findEffect(layer, label) {
        var fx = layer.property('ADBE Effect Parade'), i;
        if (!fx) { return null; }
        for (i = 1; i <= fx.numProperties; i++) { if (fx.property(i).name === label) { return fx.property(i); } }
        return null;
    }
    function partProp(layer, name) {
        var e = effectInfo(name), fx;
        if (!e) { return transformProp(layer, name); }
        fx = findEffect(layer, e.label);
        return fx ? fx.property(1) : null;
    }
    // All parts are checked first so a layer is either fully updated or skipped.
    function installLayer(layer, parts, delay, overwrite, time) {
        var i, e, prop, fxGroup = layer.property('ADBE Effect Parade'), created = [], done = [];
        for (i = 0; i < parts.length; i++) {
            e = effectInfo(parts[i].target);
            if (e) {
                if (!fxGroup || !fxGroup.canAddProperty(e.fx)) { return {skip: true, message: parts[i].target + ' 이펙트를 추가할 수 없는 레이어'}; }
                prop = partProp(layer, parts[i].target);
            } else {
                prop = transformProp(layer, parts[i].target);
                if (!prop || !prop.canSetExpression) { return {skip: true, message: parts[i].target + ' 속성 없음 / 미지원'}; }
                if (prop.isSeparationLeader && prop.dimensionsSeparated) { return {skip: true, message: '차원 분리된 위치: 통합 위치용 코드는 적용하지 않음'}; }
            }
            if (prop && prop.expression && !overwrite) { return {skip: true, message: '기존 익스프레션 유지 (' + parts[i].target + ')'}; }
        }
        try {
            for (i = 0; i < parts.length; i++) {
                e = effectInfo(parts[i].target);
                if (e && !findEffect(layer, e.label)) {
                    layer.property('ADBE Effect Parade').addProperty(e.fx).name = e.label;
                    created.push(e.label);
                }
            }
            for (i = 0; i < parts.length; i++) {
                prop = partProp(layer, parts[i].target);
                done.push({target: parts[i].target, old: prop.expression, enabled: prop.expressionEnabled});
                checkedExpression(prop, fullCode(parts[i].code, delay), time);
            }
        } catch (err) {
            try {
                for (i = done.length - 1; i >= 0; i--) {
                    prop = partProp(layer, done[i].target);
                    if (prop) { prop.expression = done[i].old; if (done[i].old) { prop.expressionEnabled = done[i].enabled; } }
                }
                for (i = created.length - 1; i >= 0; i--) { prop = findEffect(layer, created[i]); if (prop) { prop.remove(); } }
            } catch (restoreErr) { throw new Error(String(err) + ' / 복구 실패: 실행 취소하세요.'); }
            throw err;
        }
        return {skip: false};
    }
    // d = selectionData(); delay includes the per-layer stagger.
    function install(layer, d, delay, overwrite, time) {
        if (layer.locked) { return {skip: true, message: '잠긴 레이어'}; }
        var spec = findBuiltin(d.p.recipe);
        if (spec && spec.transition && (layer.threeDLayer || layer.parent || layer.adjustmentLayer || layer.nullLayer)) { return {skip: true, message: '트랜지션은 부모 연결 없는 2D 장면 레이어에 적용하세요'}; }
        if (layer.matchName === 'ADBE Camera Layer' || layer.matchName === 'ADBE Light Layer') { return {skip: true, message: '카메라/조명 제외'}; }
        return isTextRecipe(d.p.recipe) ? installText(layer, d.p, d.values, fullCode(d.code, delay), overwrite, time) :
            installLayer(layer, d.parts, delay, overwrite, time);
    }
    return {TARGETS: TARGETS, TARGET_NAMES: TARGET_NAMES, EFFECTS: EFFECTS, CATS: CATS, CAT_SHORT: CAT_SHORT, FEELS: FEELS,
        EASES: EASES, BUILTINS: BUILTINS, buildLightCode: buildLightCode, buildRGBParts: buildRGBParts, buildGlitchFlash: buildGlitchFlash, buildCode: buildCode, fullCode: fullCode, parseParts: parseParts, parseNumber: parseNumber,
        isTextRecipe: isTextRecipe, findBuiltin: findBuiltin, easeIndex: easeIndex, install: install,
        serialize: serialize, deserialize: deserialize, loadPresets: loadPresets, savePresets: savePresets};
})();
if (typeof $ !== 'undefined' && $.global) { $.global.ESCore = ESCore; }
