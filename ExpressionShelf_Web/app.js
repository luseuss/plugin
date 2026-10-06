/* Expression Shelf Web — panel UI.
   Previews run the exact expressions ESCore generates for AE, evaluated here with a small
   stand-in for the AE expression globals (time, value, wiggle, seedRandom, random, ease...). */
(function () {
  'use strict';
  const C = window.ESCore;
  const cep = window.__adobe_cep__ || null;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---------------------------------------------------------------- expression runtime
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(i, s) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
  function vnoise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; }
  function mapVal(v, fn) { return Array.isArray(v) ? v.map(fn) : fn(v, 0); }
  function lerp(a, b, k) { return Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * k) : a + (b - a) * k; }
  function interp(shape) {
    return function (t, a, b, c, d) {
      let tMin = 0, tMax = 1, v1 = a, v2 = b;
      if (d !== undefined) { tMin = a; tMax = b; v1 = c; v2 = d; }
      let k = tMax === tMin ? 1 : Math.min(1, Math.max(0, (t - tMin) / (tMax - tMin)));
      k = shape(k);
      return lerp(v1, v2, k);
    };
  }
  const aeLinear = interp((k) => k);
  const aeEase = interp((k) => k * k * (3 - 2 * k));
  const aeEaseIn = interp((k) => k * k);
  const aeEaseOut = interp((k) => 1 - (1 - k) * (1 - k));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ARGS = ['time', 'inPoint', 'outPoint', 'value', 'textIndex', 'wiggle', 'seedRandom', 'random', 'linear', 'ease', 'easeIn', 'easeOut', 'clamp', 'thisComp'];

  // Turns the last expression statement into a return; falls back to eval for unusual endings.
  function compile(code) {
    const lines = code.replace(/\r\n?/g, '\n').split('\n');
    let last = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const s = lines[i].trim();
      if (s && s.indexOf('//') !== 0) { last = i; break; }
    }
    if (last < 0) throw new Error('코드가 비어 있습니다.');
    const cand = lines.slice();
    cand[last] = 'return (' + lines[last].trim().replace(/;\s*$/, '') + ');';
    try { return new Function(ARGS.join(','), cand.join('\n')); }
    catch (e) { return new Function(ARGS.join(','), 'return eval(' + JSON.stringify(code) + ');'); }
  }
  function run(fn, ctx) {
    let rng = mulberry32(1);
    const seedRandom = (s) => { rng = mulberry32(Math.floor(Number(s) * 9973) + 17); };
    const random = (a, b) => { const r = rng(); if (a === undefined) return r; if (b === undefined) return r * a; return a + (b - a) * r; };
    const wiggle = (freq, amp, oct, mult, t) => {
      const tt = (t === undefined ? ctx.time : t) * freq;
      return mapVal(ctx.value, (x, d) => x + amp * (vnoise(tt, d + 1) + 0.5 * vnoise(tt * 2, d + 7)) / 1.5);
    };
    return fn(ctx.time, ctx.inPoint, ctx.outPoint, ctx.value, ctx.textIndex, wiggle, seedRandom, random, aeLinear, aeEase, aeEaseIn, aeEaseOut, clamp, {width: 640, height: 360});
  }

  // ---------------------------------------------------------------- preview renderer
  const BASE = { '위치': [0, 0], '크기': [100, 100], 'Z 회전': 0, '불투명도': 100, '기준점': [0, 0], '블러': 0, '와이프': 0, '원형 와이프': 0 };
  const LEAD = 0.35;
  function cycleFor(preset, ms) {
    const continuous = preset.cat === 6 || preset.id === 'text_wave';
    if (continuous) return { continuous: true, len: Infinity };
    const D = (ms || 0) / 1000, isText = !!preset.anim;
    const len = ms ? Math.max(isText ? 3.4 : 2.4, D + (isText ? 2.4 : 1.4)) : 3.2;
    return { continuous: false, len };
  }

  class Renderer {
    constructor(stage) { this.stage = stage; this.width = 0; this.error = ''; }
    // spec: {preset, code, previewType, sampleText, ms}
    setup(spec) {
      this.spec = spec;
      this.cycle = cycleFor(spec.preset, spec.ms);
      this.isTextAnim = C.isTextRecipe(spec.preset.recipe);
      this.isTransition = !!spec.preset.transition;
      this.isLight = spec.preset.recipe === 'tr_light_leak';
      this.isGlitch = spec.preset.recipe === 'tr_glitch';
      this.stage.classList.toggle('transition-stage', this.isTransition);
      this.error = '';
      const kind = this.isTextAnim || spec.previewType === 'text' ? 'text' : 'shape';
      this.stage.innerHTML = '';
      const wrap = el('div', 'obj-wrap');
      this.root = el('div', 'obj ' + (this.isTransition ? 'scene scene-b' : kind));
      this.chars = [];
      if (this.isTransition) {
        const previous = el('div', 'scene scene-a');
        previous.appendChild(el('strong', null, 'SCENE A'));
        this.stage.appendChild(previous);
        this.root.appendChild(el('strong', null, 'SCENE B'));
      } else if (kind === 'text') {
        for (const ch of (spec.sampleText || 'MOTION')) {
          const s = el('span', 'ch', ch === ' ' ? '\u00a0' : ch);
          this.root.appendChild(s); this.chars.push(s);
        }
      }
      wrap.appendChild(this.root); this.stage.appendChild(wrap);
      if (this.isLight) {
        this.leak = el('div', 'light-leak');
        for (let i = 0; i < 20; i++) {
          const band = el('i', 'leak-band'), f = 1 - i / 20;
          band.style.width = (110 * f) + '%'; band.style.height = (240 * f) + '%';
          band.style.background = `rgba(255,${Math.round((0.12 + 0.8 * (1 - f)) * 255)},${Math.round((0.02 + 0.6 * (1 - f)) * 255)},0.24)`;
          this.leak.appendChild(band);
        }
        this.stage.appendChild(this.leak);
      }
      if (this.isGlitch) {
        this.rgbPasses = ['r','g','b'].map((channel) => {
          const pass = el('div','rgb-pass');
          const scene = el('div','scene scene-b'); scene.appendChild(el('strong',null,'SCENE B'));
          pass.appendChild(scene); pass.style.filter = 'url(#es-rgb-' + channel + ')';
          this.stage.appendChild(pass); return pass;
        });
        this.flash = el('div','glitch-flash'); this.stage.appendChild(this.flash);
      }
      this.errEl = el('div', 'stage-err'); this.errEl.hidden = true; this.stage.appendChild(this.errEl);
      this.width = 0;
      try {
        const code = C.fullCode(spec.code, 0);
        if (this.isGlitch) {
          const motion = {ms:spec.ms, ease:spec.ease || spec.preset.ease};
          this.rgbParts = [0,1,2].map((i) => C.buildRGBParts(spec.values,motion,i).map((part) => ({target:part.target, fn:compile(C.fullCode(part.code,0))})));
          const flash = C.buildGlitchFlash(spec.values,motion);
          this.flashOpacity = compile(C.fullCode(flash.opacity,0)); this.flashColor = compile(C.fullCode(flash.color,0));
        }
        if (this.isLight) {
          this.lightParts = C.parseParts(C.buildLightCode(spec.values, {ms:spec.ms, ease:spec.ease || spec.preset.ease}), 0)
            .map((p) => ({target:p.target, fn:compile(C.fullCode(p.code, 0))}));
        }
        if (this.isTextAnim) {
          const b = C.findBuiltin(spec.preset.recipe);
          this.anim = b.anim(spec.values);
          this.fn = compile(code);
        } else {
          this.parts = C.parseParts(spec.code, spec.preset.target >= 0 ? spec.preset.target : 0)
            .map((p) => ({ target: p.target, fn: compile(C.fullCode(p.code, 0)) }));
        }
      } catch (e) { this.fail(e); return; }
      // Evaluate once now so runtime errors (eval fallback, bad results) show up immediately.
      this.render(LEAD + 0.2);
    }
    fail(e) { this.error = String(e && e.message || e); this.errEl.textContent = this.error; this.errEl.hidden = false; this.root.style.opacity = 0.25; }
    layout() {
      const w = this.stage.clientWidth;
      if (w === this.width || !w) return;
      this.width = w; this.k = w / 640;
      if (this.isTransition) {
        this.stage.style.setProperty('--scene-font', 52 * this.k + 'px');
      } else if (this.root.classList.contains('shape')) {
        this.root.style.width = 170 * this.k + 'px'; this.root.style.height = 120 * this.k + 'px';
      } else {
        this.fontPx = 72 * this.k; this.root.style.fontSize = this.fontPx + 'px';
      }
    }
    // Returns normalized progress 0..1 for the timeline/curve (or -1 for loops).
    render(clock) {
      if (this.error) return -1;
      this.layout();
      const c = this.cycle, k = this.k;
      const time = c.continuous ? clock : clock % c.len;
      const ctx = { time, inPoint: c.continuous ? 0 : LEAD, outPoint: this.spec.preset.exit ? c.len - LEAD : 1e6 };
      try {
        if (this.isTextAnim) this.renderText(ctx, k);
        else this.renderLayer(ctx, k);
        if (this.isLight) this.renderLight(ctx, k);
        if (this.isGlitch) this.renderGlitch(ctx, k);
      } catch (e) { this.fail(e); return -1; }
      return c.continuous ? -1 : time / c.len;
    }
    renderLayer(ctx, k) {
      const v = {};
      for (const p of this.parts) {
        const base = BASE[p.target];
        ctx.value = Array.isArray(base) ? base.slice() : base;
        const r = run(p.fn, ctx);
        if (Array.isArray(base) ? !Array.isArray(r) || !r.every(isFinite) : !isFinite(r)) throw new Error('[' + p.target + '] 결과 값 오류');
        v[p.target] = r;
      }
      const pos = v['위치'] || [0, 0], an = v['기준점'] || [0, 0], s = v['크기'] || [100, 100];
      const rot = v['Z 회전'] || 0, op = v['불투명도'] === undefined ? 100 : v['불투명도'];
      const blur = Math.max(0, v['블러'] || 0), wipe = clamp(v['와이프'] || 0, 0, 100), radialWipe = clamp(v['원형 와이프'] || 0, 0, 100);
      const st = this.root.style;
      st.transform = `translate(${(pos[0] - an[0]) * k}px, ${(pos[1] - an[1]) * k}px) rotate(${rot}deg) scale(${s[0] / 100}, ${s[1] / 100})`;
      st.opacity = clamp(op / 100, 0, 1);
      st.filter = blur > 0.05 ? `blur(${blur * k}px)` : 'none';
      st.clipPath = radialWipe > 0.05 ? `circle(${(100 - radialWipe) * 0.75}% at 50% 50%)` : wipe > 0.05 ? `inset(0 0 0 ${wipe}%)` : 'none';
    }
    renderGlitch(ctx, k) {
      for (let i=0;i<3;i++) {
        const v = {};
        for (const part of this.rgbParts[i]) { ctx.value = BASE[part.target]; v[part.target] = run(part.fn,ctx); }
        const pos=v['위치'], scale=v['크기'], style=this.rgbPasses[i].style;
        style.transform=`translate(${pos[0]*k}px,${pos[1]*k}px) scale(${scale[0]/100},${scale[1]/100})`;
        style.opacity=clamp(v['불투명도']/100,0,1);
      }
      ctx.value=100;
      this.flash.style.opacity=clamp(run(this.flashOpacity,ctx)/100,0,1);
      const color=run(this.flashColor,ctx);
      this.flash.style.background=`rgb(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)})`;
    }
    renderLight(ctx, k) {
      const v = {};
      for (const p of this.lightParts) {
        ctx.value = BASE[p.target];
        v[p.target] = run(p.fn, ctx);
      }
      const pos = v['위치'], scale = v['크기'];
      this.leak.style.transform = `translate(${(pos[0] - 320) * k}px, ${(pos[1] - 180) * k}px) scale(${scale[0] / 100},${scale[1] / 100})`;
      this.leak.style.opacity = clamp(v['불투명도'] / 100, 0, 1);
      this.leak.style.filter = `blur(${16 * k}px)`;
    }
    renderText(ctx, k) {
      for (let i = 0; i < this.chars.length; i++) {
        ctx.textIndex = i + 1; ctx.value = [100, 100, 100];
        let a = run(this.fn, ctx);
        if (!Array.isArray(a)) a = [a, a, a];
        if (!a.every(isFinite)) throw new Error('Amount 결과 값 오류');
        let tx = 0, ty = 0, op = 100, bl = 0, sc = 1, tr = 0;
        for (const [mn, val] of this.anim) {
          if (mn === 'ADBE Text Position 3D') { tx += val[0] * a[0] / 100; ty += val[1] * a[1] / 100; }
          else if (mn === 'ADBE Text Opacity') op += (val - 100) * a[0] / 100;
          else if (mn === 'ADBE Text Blur') bl = Math.abs(val[0] * a[0] / 100);
          else if (mn === 'ADBE Text Scale 3D') sc = 1 + (val[0] - 100) / 100 * a[0] / 100;
          else if (mn === 'ADBE Text Tracking Amount') tr = val * a[0] / 100;
        }
        const st = this.chars[i].style;
        st.transform = `translate(${tx * k}px, ${ty * k}px) scale(${sc})`;
        st.opacity = clamp(op / 100, 0, 1);
        st.filter = bl > 0.05 ? `blur(${bl * k}px)` : 'none';
        st.marginRight = (tr / 1000) * this.fontPx + 'px';
      }
    }
  }

  // ---------------------------------------------------------------- state
  const state = {
    scope: 'motion', cat: -1, feel: -1, q: '', speed: 1, paused: false, clock: 0,
    sel: null, values: [], ms: null, ease: null, previewType: 'shape', sampleText: 'MOTION',
    code: '', dirty: false, busy: false,
  };
  const cards = new Map();          // id -> {elem, renderer, visible}
  let detailRenderer = null;
  const ALL_EASES = C.EASES.map((e) => e[0]);

  // ---------------------------------------------------------------- filters & grid
  function catChip(label, idx, count) {
    const b = el('button', 'chip' + (state.cat === idx ? ' on' : ''));
    b.textContent = label;
    if (count != null) b.appendChild(el('span', 'n', count));
    b.onclick = () => { state.cat = idx; renderFilters(); renderGrid(); };
    return b;
  }
  function renderFilters() {
    const cats = $('#cats'); cats.innerHTML = '';
    const group = C.BUILTINS.filter((p) => !!p.transition === (state.scope === 'transition'));
    cats.appendChild(catChip('전체', -1, group.length));
    C.CATS.forEach((c, i) => { const n = group.filter((b) => b.cat === i).length; if (n && state.scope !== 'transition') cats.appendChild(catChip(c, i, n)); });
    document.querySelectorAll('#shelfType button').forEach((b) => b.classList.toggle('on', b.dataset.scope === state.scope));
    const feels = $('#feels'); feels.innerHTML = '';
    ['느낌 전체'].concat(C.FEELS).forEach((f, i) => {
      const b = el('button', 'chip' + (state.feel === i - 1 ? ' on' : ''), f);
      b.onclick = () => { state.feel = i - 1; renderFilters(); renderGrid(); };
      feels.appendChild(b);
    });
  }
  function matches(p) {
    if (state.scope === 'typo' || !!p.transition !== (state.scope === 'transition')) return false;
    if (state.cat >= 0 && p.cat !== state.cat) return false;
    if (state.feel >= 0 && p.feel !== C.FEELS[state.feel]) return false;
    const q = state.q.trim().toLowerCase();
    if (!q) return true;
    return (p.name + ' ' + (p.ease || '') + ' ' + p.desc + ' ' + C.CATS[p.cat]).toLowerCase().indexOf(q) >= 0;
  }
  function metaText(p) { return p.ms ? p.ms + 'ms' + (p.ease ? ' · ' + p.ease : '') : (p.cat === 6 ? '루프' : '수치 기반'); }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) { const c = cards.get(en.target.dataset.id); if (c) c.visible = en.isIntersecting; }
  }, { root: $('.grid-wrap'), rootMargin: '80px' });
  function buildCards() {
    const grid = $('#grid');
    for (const p of C.BUILTINS) {
      const card = el('div', 'card'); card.tabIndex = 0; card.dataset.id = p.id; card.setAttribute('role', 'button');
      const stage = el('div', 'stage');
      const meta = el('div', 'meta');
      meta.appendChild(el('div', 'name', p.name));
      const sub = el('div', 'sub');
      sub.appendChild(el('span', 'tag' + (p.anim ? ' text' : ''), C.CAT_SHORT[p.cat]));
      sub.appendChild(el('span', null, metaText(p)));
      meta.appendChild(sub);
      card.appendChild(stage); card.appendChild(meta);
      card.onclick = () => openDetail(p);
      card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(p); } };
      grid.appendChild(card);
      const r = new Renderer(stage);
      r.setup({ preset: p, values: defaults(p), code: C.buildCode(p, defaults(p), p.ms ? { ms: p.ms, ease: p.ease } : null),
        previewType: p.anim ? 'text' : 'shape', sampleText: 'MOTION', ms: p.ms, ease: p.ease });
      cards.set(p.id, { elem: card, renderer: r, visible: false });
      io.observe(card);
    }
  }
  function renderGrid() {
    let shown = 0;
    for (const p of C.BUILTINS) {
      const ok = matches(p);
      cards.get(p.id).elem.hidden = !ok;
      if (ok) shown++;
    }
    $('#empty').hidden = shown > 0;
    const total = C.BUILTINS.filter((p) => !!p.transition === (state.scope === 'transition')).length;
    $('#count').textContent = shown + ' / ' + total + (state.scope === 'transition' ? ' TRANSITIONS' : ' MOTIONS');
  }
  function defaults(p) { return p.params.map((x) => x.value); }

  // ---------------------------------------------------------------- detail
  function sliderRange(pm) {
    const span = Math.max(Math.abs(pm.value) * 3, 1);
    if (pm.min >= 0) return [pm.min, Math.min(pm.max, Math.max(span, pm.min + (pm.max - pm.min) / 10))];
    return [Math.max(pm.min, -span), Math.min(pm.max, span)];
  }
  function stepFor(lo, hi) { const r = hi - lo; return r <= 2 ? 0.01 : r <= 20 ? 0.1 : 1; }
  function setFill(range) { const lo = +range.min, hi = +range.max; range.style.setProperty('--fill', ((+range.value - lo) / (hi - lo || 1)) * 100 + '%'); }

  function openDetail(p) {
    if (state.sel) { const prev = cards.get(state.sel.id); if (prev) prev.elem.classList.remove('sel'); }
    state.sel = p; cards.get(p.id).elem.classList.add('sel');
    state.values = defaults(p); state.ms = p.ms; state.ease = p.ease;
    state.previewType = p.anim ? 'text' : 'shape';
    $('#dCat').textContent = C.CATS[p.cat] + ' · ' + p.feel + (p.exit ? ' · 퇴장' : '');
    $('#dName').textContent = p.name;
    $('#dDesc').textContent = p.desc;
    $('#transitionHelp').hidden = !p.transition;
    $('#exampleSection').hidden = !!p.transition;
    $('#applyBtn').textContent = p.transition ? '선택한 다음 장면에 적용' : '선택 레이어에 적용';
    // timing
    const timed = p.ms !== null;
    $('#secTiming').hidden = !timed;
    if (timed) {
      const r = $('#msRange'); r.value = Math.min(3000, p.ms); setFill(r); $('#msVal').textContent = p.ms + 'ms';
      const sel = $('#easeSel'); sel.disabled = !p.ease;
      sel.innerHTML = '';
      if (!p.ease) sel.appendChild(el('option', null, '이징 없음 (일정 구간)'));
      else ALL_EASES.forEach((n) => { const o = el('option', null, n); o.value = n; sel.appendChild(o); });
      if (p.ease) sel.value = p.ease;
      drawCurve();
    }
    // params
    const box = $('#params'); box.innerHTML = '';
    $('#secParams').hidden = !p.params.length;
    p.params.forEach((pm, i) => {
      const row = el('div', 'param');
      row.appendChild(el('label', null, pm.label));
      const [lo, hi] = sliderRange(pm);
      const range = el('input'); range.type = 'range'; range.min = lo; range.max = hi; range.step = stepFor(lo, hi); range.value = pm.value;
      const num = el('input'); num.type = 'number'; num.min = pm.min; num.max = pm.max; num.step = range.step; num.value = pm.value;
      range.oninput = () => { num.value = range.value; setFill(range); setValue(i, range.value); };
      num.onchange = () => { range.value = num.value; setFill(range); setValue(i, num.value); };
      setFill(range);
      row.appendChild(range); row.appendChild(num); box.appendChild(row);
    });
    // preview type
    document.querySelectorAll('#previewType button').forEach((b) => {
      b.classList.toggle('on', b.dataset.type === state.previewType);
      b.disabled = !!p.anim && b.dataset.type === 'shape';
    });
    $('#sampleText').disabled = state.previewType !== 'text';
    $('#logBox').hidden = true;
    regenerate();
    $('#detail').hidden = false;
    $('#scrim').hidden = !isNarrow();
  }
  function closeDetail() {
    $('#detail').hidden = true; $('#scrim').hidden = true;
    if (state.sel) { const c = cards.get(state.sel.id); if (c) c.elem.classList.remove('sel'); }
    state.sel = null; detailRenderer = null;
  }
  const isNarrow = () => window.matchMedia('(max-width: 760px)').matches;

  function setValue(i, raw) {
    const pm = state.sel.params[i], n = Number(raw);
    if (!isFinite(n) || n < pm.min || n > pm.max) { toast(pm.label + ': ' + pm.min + ' ~ ' + pm.max + ' 범위로 입력하세요.', 'warn'); return; }
    state.values[i] = n; regenerate();
  }
  function motion() { return state.sel.ms === null ? null : { ms: state.ms, ease: state.ease }; }
  function regenerate() {
    try { state.code = C.buildCode(state.sel, state.values, motion()); }
    catch (e) { toast(String(e.message || e), 'err'); return; }
    state.dirty = false;
    $('#code').value = state.code; $('#dirty').hidden = true; $('#codeErr').hidden = true;
    rebuildDetailPreview();
  }
  function rebuildDetailPreview() {
    detailRenderer = new Renderer($('#dStage'));
    detailRenderer.setup({ preset: state.sel, values: state.values, code: state.code, previewType: state.previewType,
      sampleText: state.sampleText || 'MOTION', ms: state.ms, ease: state.ease });
    const err = $('#codeErr');
    err.hidden = !detailRenderer.error; err.textContent = detailRenderer.error;
  }
  function easeFn(name) {
    const i = C.easeIndex(name);
    return i < 0 ? null : new Function('x', 'x = Math.min(1, Math.max(0, x)); ' + C.EASES[i][1]);
  }
  function drawCurve() {
    const f = state.ease ? easeFn(state.ease) : (x) => x;
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const x = i / 60, y = f(x);
      d += (i ? 'L' : 'M') + (10 + x * 100).toFixed(1) + ' ' + (76 - y * 56).toFixed(1);
    }
    $('#curvePath').setAttribute('d', d);
    $('#curve').classList.toggle('off', !state.ease);
    state.curveFn = f;
  }
  function moveCurveDot(progress) {
    const dot = $('#curveDot');
    if (!state.sel || state.sel.ms === null || progress < 0) { dot.style.display = 'none'; return; }
    const c = detailRenderer.cycle, time = progress * c.len, D = state.ms / 1000;
    const t = state.sel.exit ? time - (c.len - LEAD) + D : time - LEAD;
    const x = clamp(t / D, 0, 1), y = state.curveFn(x);
    dot.style.display = '';
    dot.setAttribute('cx', 10 + x * 100); dot.setAttribute('cy', 76 - y * 56);
  }

  // ---------------------------------------------------------------- AE bridge
  function toHostLiteral(obj) {
    // JSON is a valid ExtendScript object literal; escape non-ASCII so nothing is lost in transit.
    return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
  }
  function callHost(fn, payload) {
    return new Promise((resolve) => {
      if (!cep) { resolve({ ok: false, error: '에펙 패널에서만 동작합니다. 지금은 브라우저 미리보기 모드입니다.', offline: true }); return; }
      const arg = payload === undefined ? '' : payload;
      cep.evalScript(fn + '(' + arg + ')', (res) => {
        try { resolve(JSON.parse(res)); } catch (e) { resolve({ ok: false, error: String(res || (fn + ': 에펙이 빈 응답을 반환했습니다. 저장을 다시 누르기 전에 보관함을 새로고침하세요. 에펙 재시작·재설치 후에도 같으면 이 문구와 에펙 버전을 알려주세요.')) }); }
      });
    });
  }
  function extensionPath() {
    let p = cep.getSystemPath('extension');
    p = p.replace(/^file:\/{2,3}/, '');
    return decodeURIComponent(p);
  }
  function payload() {
    const p = state.sel;
    return toHostLiteral({
      p: { id: p.id, name: p.name, recipe: p.recipe, target: p.target, preview: state.previewType },
      values: state.values, code: $('#code').value, sampleText: state.sampleText,
      motion: {ms:state.ms, ease:state.ease},
      start: $('#startDelay').value || '0', stagger: $('#stagger').value || '0', overwrite: $('#overwrite').checked,
    });
  }
  async function withBusy(btn, fn) {
    if (state.busy) return;
    state.busy = true; btn.disabled = true;
    try { await fn(); } finally { state.busy = false; btn.disabled = false; }
  }

  // ---------------------------------------------------------------- toasts
  function toast(msg, kind) {
    const t = el('div', 'toast ' + (kind || ''), msg);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3200);
  }

  // ---------------------------------------------------------------- events
  let typoShelf;
  function wire() {
    document.querySelectorAll('#shelfType button').forEach((b) => b.onclick = () => {
      closeDetail(); state.scope = b.dataset.scope; state.cat = -1; state.feel = -1; state.q = ''; $('#search').value = ''; renderFilters(); renderGrid();
      const isTypo = state.scope === 'typo', isLetterbox = state.scope === 'letterbox';
      $('#motionShelf').hidden = isTypo || isLetterbox; $('#cats').hidden = isTypo || isLetterbox; $('#motionFilters').hidden = isTypo || isLetterbox; $('#target').hidden = isTypo || isLetterbox;
      $('#letterboxShelf').hidden = !isLetterbox;
      $('#search').placeholder = isTypo ? '저장한 타이포 이름·분류 검색' : '모션·트랜지션·이징 검색';
      if (typoShelf) typoShelf.show(isTypo);
    });

    $('#lbRatio').onchange = (e) => { $('#lbCustomWrap').hidden = e.target.value !== 'custom'; };
    $('#lbColor').oninput = (e) => { $('#lbColorHex').value = e.target.value.toUpperCase(); };
    $('#lbColorHex').onchange = (e) => {
      const v = e.target.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(v)) { const normalized = '#' + v.replace(/^#/, '').toUpperCase(); $('#lbColor').value = normalized; e.target.value = normalized; }
      else { e.target.value = $('#lbColor').value.toUpperCase(); toast('색상 코드는 #RRGGBB 형식이어야 합니다.', 'warn'); }
    };
    $('#lbCreate').onclick = () => withBusy($('#lbCreate'), async () => {
      const ratio = $('#lbRatio').value === 'custom' ? $('#lbCustomRatio').value : $('#lbRatio').value;
      const r = await callHost('ES_letterbox', toHostLiteral({ratio, color:$('#lbColorHex').value, fade:$('#lbFade').value}));
      if (!r.ok) { $('#lbStatus').textContent = r.error; $('#lbStatus').classList.add('bad'); toast(r.error, r.offline ? 'warn' : 'err'); return; }
      $('#lbStatus').classList.remove('bad'); $('#lbStatus').textContent = `생성 완료: ${r.name} · ${r.ratio}:1 · 막대 높이 ${r.barPercent}% · ${r.color} · 페이드 ${r.fade}초 (Ctrl+Z로 취소)`;
    });
    $('#checkUpdateBtn').onclick = async () => {
      const button = $('#checkUpdateBtn'), status = $('#updateStatus');
      button.disabled = true; $('#installUpdateBtn').hidden = true; status.textContent = 'GitHub에서 업데이트 확인 중…';
      try {
        const result = await window.ESUpdater.check();
        if (result.available) {
          status.textContent = `새 버전 v${result.latest.version}을 찾았습니다. (현재 v${result.currentVersion})`;
          $('#installUpdateBtn').hidden = false; $('#installUpdateBtn')._feed = result.latest;
          toast('새 버전 v' + result.latest.version + '을 사용할 수 있습니다.', 'ok');
        } else status.textContent = `최신 버전입니다 · v${result.currentVersion}`;
      } catch (e) {
        status.textContent = '업데이트 확인 실패';
        toast(String(e && e.message || e), 'err');
      } finally { button.disabled = false; }
    };
    $('#installUpdateBtn').onclick = async () => {
      const button = $('#installUpdateBtn'), feed = button._feed;
      if (!feed) return;
      if (!window.confirm(`v${feed.version} 업데이트 파일을 내려받아 검사한 뒤 설치를 예약합니다. 작업 중인 프로젝트를 저장하고 After Effects를 종료하면 자동으로 설치됩니다. 계속할까요?`)) return;
      button.disabled = true; $('#updateStatus').textContent = `v${feed.version} 다운로드 및 파일 검사 중…`;
      try {
        const result = await window.ESUpdater.downloadAndSchedule(feed, extensionPath());
        $('#updateStatus').textContent = `v${result.version} 설치 예약 완료 · 프로젝트 저장 후 After Effects를 종료하세요.`;
        button.hidden = true;
        toast('파일 검사 완료. After Effects를 종료하면 업데이트가 설치됩니다.', 'ok');
      } catch (e) {
        $('#updateStatus').textContent = '업데이트 설치 예약 실패';
        toast(String(e && e.message || e), 'err');
      } finally { button.disabled = false; }
    };
    $('#search').addEventListener('input', (e) => { state.q = e.target.value; if (state.scope === 'typo' && typoShelf) typoShelf.search(state.q); else renderGrid(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); $('#search').focus(); }
      if (e.key === 'Escape' && !$('#detail').hidden) closeDetail();
    });
    document.querySelectorAll('#speed button').forEach((b) => b.onclick = () => {
      state.speed = +b.dataset.speed;
      document.querySelectorAll('#speed button').forEach((x) => x.classList.toggle('on', x === b));
    });
    $('#pauseBtn').onclick = () => { state.paused = !state.paused; $('#pauseBtn').textContent = state.paused ? '▶' : '❚❚'; };
    $('#dClose').onclick = closeDetail;
    $('#scrim').onclick = closeDetail;
    $('#bannerClose').onclick = () => { $('#banner').hidden = true; };
    $('#msRange').oninput = (e) => { state.ms = +e.target.value; setFill(e.target); $('#msVal').textContent = state.ms + 'ms'; regenerate(); };
    $('#easeSel').onchange = (e) => { state.ease = e.target.value; drawCurve(); regenerate(); };
    document.querySelectorAll('#previewType button').forEach((b) => b.onclick = () => {
      if (b.disabled) return;
      state.previewType = b.dataset.type;
      document.querySelectorAll('#previewType button').forEach((x) => x.classList.toggle('on', x === b));
      $('#sampleText').disabled = state.previewType !== 'text';
      rebuildDetailPreview();
    });
    $('#sampleText').oninput = (e) => { state.sampleText = e.target.value; rebuildDetailPreview(); };
    $('#code').oninput = (e) => {
      state.code = e.target.value; state.dirty = true; $('#dirty').hidden = false;
      rebuildDetailPreview();
    };
    $('#aePreviewBtn').onclick = () => withBusy($('#aePreviewBtn'), async () => {
      const r = await callHost('ES_preview', payload());
      toast(r.ok ? '에펙에 미리보기 컴포지션을 만들었습니다.' : r.error, r.ok ? 'ok' : r.offline ? 'warn' : 'err');
    });
    $('#applyBtn').onclick = () => withBusy($('#applyBtn'), async () => {
      const r = await callHost('ES_apply', payload());
      if (!r.ok) { toast(r.error, r.offline ? 'warn' : 'err'); return; }
      const log = $('#log'); log.innerHTML = '';
      r.lines.forEach((l) => log.appendChild(el('li', /오류/.test(l) ? 'bad' : /완료/.test(l) ? 'ok' : '', l)));
      $('#logBox').hidden = false; $('#logBox').open = true;
      toast(`적용 ${r.applied} · 건너뜀 ${r.skipped} · 오류 ${r.failed}  (Ctrl+Z로 실행 취소)`, r.failed ? 'err' : 'ok');
    });
    window.addEventListener('resize', () => { if (!$('#detail').hidden) $('#scrim').hidden = !isNarrow(); });
  }

  // ---------------------------------------------------------------- loop
  let lastTs = performance.now();
  function frame(ts) {
    const dt = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
    if (!state.paused) state.clock += dt * state.speed;
    for (const c of cards.values()) if (c.visible && !c.elem.hidden) c.renderer.render(state.clock);
    if (detailRenderer && !$('#detail').hidden) {
      const prog = detailRenderer.render(state.clock);
      $('#dTimeline i').style.width = prog < 0 ? '100%' : prog * 100 + '%';
      moveCurveDot(prog);
    }
    requestAnimationFrame(frame);
  }

  async function init() {
    renderFilters(); buildCards(); renderGrid();
    if (window.ESTypo) typoShelf = window.ESTypo({call:callHost, literal:toHostLiteral, busy:withBusy});
    wire();
    requestAnimationFrame(frame);
    $('#updateStatus').textContent = '현재 버전 v' + window.ESUpdater.currentVersion;
    if (!cep) { $('#banner').hidden = false; $('#updateStatus').textContent = '업데이트 확인은 After Effects 패널에서 사용할 수 있습니다.'; $('#checkUpdateBtn').disabled = true; return; }
    const updateResult = window.ESUpdater.consumeResult();
    if (updateResult) {
      if (/^v\d+\.\d+\.\d+$/.test(updateResult)) {
        $('#updateStatus').textContent = `업데이트 설치 완료 · ${updateResult}`;
        toast(`${updateResult} 업데이트 설치가 완료됐습니다.`, 'ok');
      } else if (updateResult.indexOf('ERROR:') === 0) {
        $('#updateStatus').textContent = '업데이트 설치에 실패했습니다.';
        toast(updateResult, 'err');
      }
    }
    const r = await callHost('ES_init', toHostLiteral(extensionPath()));
    if (!r.ok) { toast('에펙 연결 실패: ' + r.error, 'err'); return; }
  }
  init();
})();
