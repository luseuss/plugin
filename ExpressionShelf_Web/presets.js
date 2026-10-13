/* Persistent user-authored motion/expression presets. */
(function () {
  'use strict';
  window.ESPresets = function (bridge) {
    const $ = (s) => document.querySelector(s);
    const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    let items = [], query = '', active = false, loaded = false;
    function status(message, bad) { $('#presetStatus').textContent = message || ''; $('#presetStatus').classList.toggle('bad', !!bad); }
    async function request(fn, data) {
      const r = await bridge.call(fn, data === undefined ? undefined : bridge.literal(data));
      if (!r || !r.ok) throw new Error((r && r.error) || 'After Effects 응답이 비어 있습니다.');
      return r;
    }
    function job(button, message, fn) {
      return bridge.busy(button, async () => {
        status(message);
        try { await fn(); } catch (e) { status(e.message || String(e), true); }
      });
    }
    function render() {
      const grid = $('#presetGrid'); grid.innerHTML = '';
      const q = query.trim().toLowerCase();
      const visible = items.filter((item) => !q || (item.name + ' ' + item.recipe + ' ' + item.code).toLowerCase().indexOf(q) >= 0);
      visible.forEach((item) => {
        const card = make('article', 'typo-card preset-card');
        const body = make('div', 'typo-card-body');
        body.appendChild(make('h3', '', item.name));
        const spec = window.ESCore.findBuiltin(item.recipe);
        body.appendChild(make('p', 'typo-meta', (spec ? spec.name : item.recipe) + ' · ' + (item.ms ? item.ms + 'ms' : '수치 기반') + (item.ease ? ' · ' + item.ease : '')));
        body.appendChild(make('p', 'typo-meta', new Date(item.created).toLocaleString() + ' · 코드 ' + item.code.length + '자'));
        const actions = make('div', 'typo-actions');
        const load = make('button', 'btn primary', '불러와 적용 준비');
        load.onclick = () => job(load, '저장한 설정을 여는 중…', async () => { await bridge.load(item); status('설정을 불러왔습니다. 미리보기를 확인한 뒤 적용하세요.'); });
        const remove = make('button', 'btn ghost', '삭제');
        remove.onclick = () => {
          if (!window.confirm('“' + item.name + '” 프리셋을 삭제할까요?')) return;
          job(remove, '프리셋 삭제 중…', async () => { await request('ES_presetDelete', {id:item.id}); await refresh(); status('프리셋을 삭제했습니다.'); });
        };
        actions.appendChild(load); actions.appendChild(remove); body.appendChild(actions); card.appendChild(body); grid.appendChild(card);
      });
      $('#presetEmpty').hidden = visible.length > 0;
      $('#presetEmpty').textContent = items.length ? '검색 결과가 없습니다.' : '아직 저장한 프리셋이 없습니다. 모션 상세에서 프리셋을 저장해 보세요.';
      if (active) $('#count').textContent = visible.length + ' / ' + items.length + ' PRESETS';
    }
    async function refresh() {
      const r = await request('ES_presetList'); items = r.items || []; loaded = true; render();
      return r.skipped ? '읽을 수 없는 프리셋 ' + r.skipped + '개를 건너뛰었습니다.' : '';
    }
    $('#presetRefresh').onclick = () => job($('#presetRefresh'), '프리셋을 읽는 중…', async () => { status(await refresh() || '내 프리셋을 새로고침했습니다.'); });
    $('#presetFolder').onclick = () => job($('#presetFolder'), '저장 폴더를 여는 중…', async () => { const r = await request('ES_presetFolder'); status(r.path); });
    return {
      show(on) {
        active = on; $('#presetShelf').hidden = !on;
        if (!on) return;
        query = ''; render();
        if (!loaded) return job($('#presetRefresh'), '프리셋을 읽는 중…', async () => { status(await refresh() || '저장한 모션 설정이 이 목록에 표시됩니다.'); });
      },
      search(value) { query = value || ''; render(); },
      async save(data) {
        const r = await request('ES_presetSave', data);
        items.unshift(r.item); loaded = true; render();
        return r;
      }
    };
  };
})();
