/* Persistent typography gallery. Host returns data only; names never become HTML or script. */
(function () {
  'use strict';
  window.ESTypo = function (bridge) {
    const $ = (s) => document.querySelector(s);
    const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    let items = [], query = '', active = false, loaded = false;
    const status = (msg, bad) => { $('#typoStatus').textContent = msg; $('#typoStatus').classList.toggle('bad', !!bad); };
    function fileURL(path) {
      const p = path.replace(/\\/g, '/');
      return encodeURI(p.indexOf('//') === 0 ? 'file:' + p : (p.charAt(0) === '/' ? 'file://' : 'file:///') + p).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }
    async function request(fn, data) {
      const r = await bridge.call(fn, data === undefined ? undefined : bridge.literal(data));
      if (!r || !r.ok) throw new Error((r && r.error) || '에펙 응답이 비어 있습니다. 에펙을 완전히 종료하고 수정판을 재설치해 주세요.');
      return r;
    }
    function job(button, message, fn) {
      return bridge.busy(button, async () => {
        status(message);
        $('#typoShelf').setAttribute('aria-busy', 'true');
        try { await fn(); } catch (e) { status(e.message || String(e), true); }
        finally { $('#typoShelf').setAttribute('aria-busy', 'false'); }
      });
    }
    function render() {
      const grid = $('#typoGrid'); grid.innerHTML = '';
      const q = query.trim().toLowerCase(), category = $('#typoFilter').value;
      const visible = items.filter((m) => (!category || m.category === category) && (!q || (m.name + ' ' + m.category + ' ' + m.comp).toLowerCase().indexOf(q) >= 0));
      visible.forEach((m) => {
        const card = make('article', 'typo-card'), preview = make('div', 'typo-preview');
        const placeholder = make('span', 'typo-placeholder', 'Aa'); preview.appendChild(placeholder);
        if (m.thumbnail) {
          const img = make('img'); img.alt = m.name + ' 저장 프레임'; img.loading = 'lazy'; img.src = fileURL(m.thumbnail) + '?v=' + Date.now();
          img.onload = () => { placeholder.hidden = true; }; img.onerror = () => { img.hidden = true; placeholder.hidden = false; }; preview.appendChild(img);
        }
        preview.appendChild(make('span', 'typo-still', m.thumbnail ? '정지 프레임 · ' + m.time.toFixed(2) + 's' : '미리보기 없음'));
        card.appendChild(preview);
        const body = make('div', 'typo-card-body'); body.appendChild(make('h3', '', m.name));
        body.appendChild(make('p', 'typo-meta', m.category + ' · ' + m.width + ' × ' + m.height + ' · ' + m.duration.toFixed(2) + '초'));
        body.appendChild(make('p', 'typo-meta', new Date(m.created).toLocaleDateString() + ' · AEP ' + m.sizeMB + ' MB'));
        const actions = make('div', 'typo-actions');
        [['insert','현재 컴프에 추가'],['open','컴프 불러와 열기']].forEach(([mode, label]) => {
          const b = make('button', mode === 'insert' ? 'btn primary' : 'btn ghost', label);
          b.onclick = () => job(b, '타이포를 불러오는 중입니다…', async () => {
            const r = await request('ES_typoImport', {id:m.id, mode});
            status((r.inserted ? '현재 시간에 추가했습니다: ' : '새 사본을 불러와 열었습니다: ') + r.name + ' · Ctrl+Z로 취소할 수 있습니다.' + (r.warnings.length ? '\n' + r.warnings.join('\n') : ''));
          });
          actions.appendChild(b);
        });
        const thumb = make('button', 'chip-btn', '썸네일 PNG 등록');
        thumb.onclick = () => job(thumb, 'PNG 선택 창을 확인하세요…', async () => {
          const result = await request('ES_typoThumbnail', {id:m.id});
          if (result.cancelled) { status('PNG 선택을 취소했습니다.'); return; }
          await refresh(); status('썸네일을 등록했습니다.');
        });
        body.appendChild(actions); body.appendChild(thumb); card.appendChild(body); grid.appendChild(card);
      });
      $('#typoEmpty').hidden = visible.length > 0;
      $('#typoEmpty').textContent = items.length ? '검색·분류에 맞는 타이포가 없습니다.' : '아직 저장한 타이포가 없습니다. 완성한 타이포 컴프를 열고 위에서 저장해 보세요.';
      if (active) $('#count').textContent = visible.length + ' / ' + items.length + ' TYPOGRAPHY';
    }
    async function refresh() {
      const r = await request('ES_typoList'); items = r.items; loaded = true;
      const select = $('#typoFilter'), prior = select.value;
      select.innerHTML = ''; const all = make('option', '', '모든 분류'); all.value = ''; select.appendChild(all);
      const categories = Array.from(new Set(items.map((m) => m.category))).sort();
      categories.forEach((s) => { const o = make('option', '', s); o.value = s; select.appendChild(o); });
      select.value = categories.indexOf(prior) >= 0 ? prior : '';
      $('#typoPath').textContent = r.path; render();
      return r.skipped ? '읽을 수 없는 항목 ' + r.skipped + '개는 목록에서 제외했습니다. 저장 폴더를 확인하세요.' : '';
    }
    $('#typoSave').onclick = () => job($('#typoSave'), '저장된 AEP 사본을 보관하는 중…', async () => {
      const r = await request('ES_typoSave', {name:$('#typoName').value, category:$('#typoCategory').value});
      let note = '';
      try { note = await refresh(); } catch (e) { note = '저장은 완료했지만 목록 갱신에 실패했습니다. 새로고침을 누르세요.'; }
      status('저장했습니다: ' + r.item.name + (r.warnings.length ? '\n' + r.warnings.join('\n') : '') + (note ? '\n' + note : ''));
    });
    $('#typoRefresh').onclick = () => job($('#typoRefresh'), '보관함을 읽는 중…', async () => { status(await refresh() || '보관함을 새로고침했습니다.'); });
    $('#typoFolder').onclick = () => job($('#typoFolder'), '저장 폴더를 여는 중…', async () => { const r = await request('ES_typoFolder'); status(r.path); });
    $('#typoFilter').onchange = render;
    return {
      show(on) {
        active = on; $('#typoShelf').hidden = !on;
        if (!on) return;
        query = ''; render();
        if (!loaded) return job($('#typoRefresh'), '보관함을 읽는 중…', async () => { status(await refresh() || '타이포 컴프 전체를 저장하고 새 사본으로 불러옵니다.'); });
      },
      search(q) { query = q; render(); }
    };
  };
})();
