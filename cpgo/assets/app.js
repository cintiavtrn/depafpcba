/* Monitor PPA PCBA — front-end estático, sem dependências.
   Dados em /data/*.json, gerados por scripts/build.py + scripts/ds.py a partir da planilha de monitoramento. */
(() => {
  'use strict';

  // ---------- estado ----------
  const S = { year: 2026, comp: '', usp: '', order: 'cadeia', sort: 'risco', path: [] };
  const D = {};
  const STAGES = ['Não iniciada', 'Iniciada', 'Em execução', 'Concluída', 'Descontinuada', 'Sem registro'];
  const FILL = { 'Não iniciada': 0, 'Iniciada': 0.25, 'Em execução': 0.5, 'Concluída': 1 };
  const TIME = { 2024: 0.25, 2025: 0.5, 2026: 0.75, 2027: 1 };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const nf = new Intl.NumberFormat('pt-BR');
  const pf = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
  const pf1 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
  const f2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // ---------- geometria ----------
  const pt = (cx, cy, r, f) => { const a = f * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (cx, cy, r, f) => {
    if (f <= 0) return '';
    if (f >= 1) return `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z`;
    const [x, y] = pt(cx, cy, r, f);
    return `M${cx},${cy - r} A${r},${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)}`;
  };
  const pie = (cx, cy, r, f) => {
    if (f <= 0) return '';
    if (f >= 1) return `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z`;
    const [x, y] = pt(cx, cy, r, f);
    return `M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)} Z`;
  };

  // Círculo de entrega: anel = tempo do PPA; miolo = etapa.
  const glyph = (stage, time, label) => {
    const s = sv('svg', { viewBox: '0 0 40 40', role: 'img' });
    s.setAttribute('aria-label', label || stage);
    s.append(sv('circle', { class: 'g-track', cx: 20, cy: 20, r: 17, 'stroke-width': 4 }));
    if (time > 0) s.append(sv('path', { class: 'g-time', d: arc(20, 20, 17, time), 'stroke-width': 4 }));
    const hole = sv('circle', { class: 'g-hole', cx: 20, cy: 20, r: 12 });
    if (stage === 'Não iniciada') hole.classList.add('risk');
    if (stage === 'Sem registro') hole.classList.add('none');
    s.append(hole);
    const f = FILL[stage];
    if (f) s.append(sv('path', { class: 'g-core', d: pie(20, 20, 12, f) }));
    if (stage === 'Descontinuada') s.append(sv('line', { class: 'g-slash', x1: 11, y1: 29, x2: 29, y2: 11 }));
    return s;
  };
  const shape = (kind) => {
    const s = sv('svg', { viewBox: '0 0 20 20', class: 'node-ic', 'aria-hidden': 'true' });
    if (kind === 'comp') s.append(sv('rect', { x: 4, y: 4, width: 12, height: 12, transform: 'rotate(45 10 10)', class: 'sh-comp' }));
    else if (kind === 'ini') s.append(sv('rect', { x: 4, y: 4, width: 12, height: 12, class: 'sh-ini' }));
    else if (kind === 'root') { s.append(sv('rect', { x: 5, y: 5, width: 10, height: 10, transform: 'rotate(45 10 10)', class: 'sh-comp' })); s.append(sv('circle', { cx: 10, cy: 10, r: 2.4, fill: 'var(--gold)' })); }
    else s.append(sv('circle', { cx: 10, cy: 10, r: 3, fill: 'var(--muted)' }));
    return s;
  };

  // ---------- dados ----------
  // Status no ano. Sem registro no ano, uma entrega já concluída ou descontinuada mantém o estado final.
  // Situação da entrega em um ano. A planilha só anota o que mudou: ano em branco ou "0" depois de um avanço não
  // quer dizer que voltou ao início. Por isso o status nunca recua em relação ao ano anterior (a não ser
  // descontinuada). A planilha original continua visível no detalhe da entrega.
  const ORD = { 'Sem registro': -1, 'Não iniciada': 0, 'Iniciada': 1, 'Em execução': 2, 'Concluída': 3 };
  const st = (e, y = S.year) => {
    y = Math.min(y, 2026);
    const raw = e['status_' + y];
    if (y === 2024) return raw;
    const before = st(e, y - 1);
    if (before === 'Descontinuada') return before;
    if (raw === 'Descontinuada') return raw;
    return (ORD[raw] ?? -1) >= (ORD[before] ?? -1) ? raw : before;
  };
  const carried = (e, y) => y > 2024 && st(e, y) !== e['status_' + Math.min(y, 2026)];
  const pass = (r) => (!S.comp || r.id_compromisso === S.comp) && (!S.usp || r.usp === S.usp);
  const ents = () => D.entregas.filter(pass);
  const progress = (rows) => rows.length ? rows.reduce((a, e) => a + (FILL[st(e)] ?? 0), 0) / rows.length : 0;
  const fmtInd = (v, u) => v == null ? '—' : u === '%' ? pf1.format(v) : u === 'razão' ? f2.format(v) : nf.format(v);
  const plural = (n, a, b) => `${nf.format(n)} ${n === 1 ? a : b}`;

  const fmtMeta = (m) => {
    if (m == null) return '—';
    const t = String(m).trim();
    if (/^NS\*?$/i.test(t)) return 'Não se aplica';
    const k = t.match(/^(\d+)\*\s*\((.*)\)$/);
    if (k) return `${k[1]} · ${k[2].charAt(0).toLowerCase()}${k[2].slice(1)}`;
    return t;
  };

  // ---------- painel lateral e topo ----------
  const markO = () => {
    const E = ents();
    const target = { t: TIME[S.year], c: E.length ? E.filter((e) => st(e) === 'Concluída').length / E.length : 0 };
    const t = $('.wo-time'), c = $('.wo-core');
    const from = markO.cur || { t: 0, c: 0 };
    const draw = (p) => { t.setAttribute('d', arc(50, 50, 40, p.t)); c.setAttribute('d', pie(50, 50, 27, p.c)); };
    if (reduce) { draw(target); markO.cur = target; return; }
    const t0 = performance.now(), dur = 800;
    cancelAnimationFrame(markO.raf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - k, 3);
      const p = { t: from.t + (target.t - from.t) * ease, c: from.c + (target.c - from.c) * ease };
      draw(p); markO.cur = p;
      if (k < 1) markO.raf = requestAnimationFrame(step);
    };
    markO.raf = requestAnimationFrame(step);
  };

  const renderTop = () => {
    $$('[data-year]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.year) === S.year)));
    $('#f-clear').hidden = !S.comp && !S.usp;
    const lg = $('#lg-ent'); const old = lg.querySelector('svg'); if (old) old.remove(); lg.prepend(glyph('Em execução', TIME[S.year], 'Entrega'));
    const E = ents(); const n = (f) => E.filter(f).length;
    const items = [
      ['Concluída', n((e) => st(e) === 'Concluída'), 'concluídas'],
      ['Em execução', n((e) => ['Iniciada', 'Em execução'].includes(st(e))), 'em andamento'],
      ['Não iniciada', n((e) => st(e) === 'Não iniciada'), 'não iniciadas'],
      ['Sem registro', n((e) => st(e) === 'Sem registro'), 'sem registro'],
      ['Descontinuada', n((e) => st(e) === 'Descontinuada'), 'descontinuadas'],
    ].filter((x, i) => i < 3 || x[1] > 0);
    const k = $('#kpis'); k.replaceChildren();
    const tot = h('div', 'kpi total'); tot.append(h('b', null, nf.format(E.length)), h('span', null, `entregas · ${S.year}`)); k.append(tot);
    items.forEach(([stg, v, lab]) => { const d = h('div', 'kpi'); d.append(glyph(stg, TIME[S.year], stg), h('b', null, nf.format(v)), h('span', null, lab)); k.append(d); });
    markO();
  };

  const renderCrumb = (labels) => {
    const c = $('#crumb'); c.replaceChildren();
    if (!labels.length) { c.textContent = 'Selecione um nó para abrir o próximo nível.'; return; }
    labels.forEach((l, i) => { if (i) c.append(document.createTextNode(' › ')); c.append(h(i === labels.length - 1 ? 'b' : 'span', null, l)); });
  };

  // ---------- árvore de decomposição ----------
  const LV = {
    comp: { title: 'Compromissos', icon: 'comp', key: (r) => r.id_compromisso, label: (r) => r.compromisso, code: (r) => r.cod_compromisso },
    ini: { title: 'Iniciativas', icon: 'ini', key: (r) => r.id_iniciativa, label: (r) => r.iniciativa, code: (r) => r.cod_iniciativa },
    usp: { title: 'Unidades (USP)', icon: 'cut', key: (r) => r.usp || 'Sem USP', label: (r) => r.usp || 'Sem USP' },
    stage: { title: 'Etapas', icon: 'stage', key: (r) => st(r), label: (r) => st(r) },
    ent: { title: 'Entregas', icon: 'ent', key: (r) => r.id_entrega, label: (r) => r.entrega, leaf: true },
  };
  const ORDERS = { cadeia: ['comp', 'ini', 'ent'], usp: ['usp', 'comp', 'ent'], status: ['stage', 'usp', 'ent'] };

  const detailCard = (e) => {
    const c = h('article', 'detail-card');
    c.append(h('h3', null, e.entrega));
    const dl = h('dl', 'facts');
    [['Compromisso', `${e.cod_compromisso} · ${e.compromisso}`], ['Iniciativa', `${e.cod_iniciativa} · ${e.iniciativa}`], ['USP', e.usp || '—'], ['Meta PPA', fmtMeta(e.meta_ppa)]]
      .forEach(([k, v]) => dl.append(h('dt', null, k), h('dd', null, v)));
    c.append(dl);
    const yrs = h('div', 'yrs');
    [2024, 2025, 2026].forEach((y) => {
      const s = st(e, y); const raw = e['texto_' + y];
      const row = h('div', 'yr' + (y > S.year ? ' future' : ''));
      const t = h('div', 'yr-t' + (raw ? '' : ' nil')); t.append(h('small', null, carried(e, y) ? `${s} · mantido do ano anterior` : s), document.createTextNode(raw || '—'));
      row.append(glyph(s, TIME[y], `${y}: ${s}`), h('span', 'yr-y', String(y)), t);
      yrs.append(row);
    });
    c.append(yrs);
    if (e.observacao) { const o = h('p', 'buy'); o.append(document.createTextNode('Observação: '), h('b', null, e.observacao)); c.append(o); }
    D.processos.filter((p) => p.id_entrega === e.id_entrega).forEach((p) => { const b = h('p', 'buy'); b.append(document.createTextNode('Aquisição: '), h('b', null, p.etapa), document.createTextNode(` · ${p.objeto}`)); c.append(b); });
    return c;
  };

  const renderDecomp = () => {
    const box = $('#decomp'); box.replaceChildren();
    const E = ents();
    if (!E.length) { box.append(h('p', 'empty', 'Nenhuma entrega nesse recorte.')); renderCrumb([]); return; }
    const levels = ORDERS[S.order].map((k) => LV[k]);
    const links = []; const crumb = [];
    const col = (title, n, cls) => { const c = h('div', 'col' + (cls ? ' ' + cls : '')); const hd = h('div', 'col-h'); hd.append(h('strong', null, title)); if (n != null) hd.append(h('span', null, n)); c.append(hd); box.append(c); return c; };
    const dots = (rows) => { const d = h('div', 'dots'); rows.slice().sort((a, b) => (FILL[st(b)] ?? -1) - (FILL[st(a)] ?? -1)).forEach((e) => d.append(glyph(st(e), TIME[S.year], `${e.entrega}: ${st(e)}`))); return d; };
    const meta = (rows) => { const m = h('div', 'node-meta'); m.append(h('b', null, nf.format(rows.filter((e) => st(e) === 'Concluída').length)), document.createTextNode(` de ${plural(rows.length, 'entrega concluída', 'entregas concluídas')}`)); return m; };

    const rc = col('Programa');
    const root = h('div', 'node root'); root.append(shape('root'), h('span', 'node-nm', '437 · Bahia mais Segura'), meta(E), dots(E));
    rc.append(root);
    let parent = root, rows = E;

    for (let k = 0; k < levels.length; k++) {
      const lv = levels[k];
      const groups = Array.from(rows.reduce((m, r) => { const key = lv.key(r); if (!m.has(key)) m.set(key, []); m.get(key).push(r); return m; }, new Map()), ([key, rs]) => ({ key, rs }));
      groups.sort(S.sort === 'risco' ? (a, b) => (progress(a.rs) - progress(b.rs)) || String(a.key).localeCompare(String(b.key)) : (a, b) => String(a.key).localeCompare(String(b.key), 'pt-BR', { numeric: true }));
      if (S.path[k] != null && !groups.some((g) => g.key === S.path[k])) S.path = S.path.slice(0, k);
      const c = col(lv.title, nf.format(groups.length));
      const sel = S.path[k];
      let selNode = null, selGroup = null;
      groups.forEach((g) => {
        const b = h('button', 'node'); b.type = 'button';
        const on = g.key === sel; b.setAttribute('aria-pressed', String(on));
        if (sel != null && !on) b.classList.add('dim');
        const r0 = g.rs[0];
        if (lv.leaf) {
          const gl = glyph(st(r0), TIME[S.year]); gl.classList.add('node-ic'); b.append(gl);
          b.append(h('span', 'node-nm', lv.label(r0)), h('div', 'node-meta', `${r0.usp || 'Sem USP'} · ${st(r0)}`));
          const tr = h('div', 'traj'); [2024, 2025, 2026].filter((y) => y <= S.year).forEach((y) => tr.append(glyph(st(r0, y), TIME[y], `${y}: ${st(r0, y)}`))); b.append(tr);
        } else {
          if (lv.icon === 'stage') { const gl = glyph(g.key, TIME[S.year]); gl.classList.add('node-ic'); b.append(gl); } else b.append(shape(lv.icon));
          const nm = h('span', 'node-nm'); if (lv.code) nm.append(h('span', 'node-code', lv.code(r0))); nm.append(document.createTextNode(lv.label(r0))); b.append(nm);
          b.append(meta(g.rs));
          if (lv === LV.ini) {
            const ind = D.indicadores.filter((r) => r.id_iniciativa === g.key && r.ano <= S.year && r.apurado != null).sort((a, z) => z.ano - a.ano)[0];
            if (ind) { const m = h('div', 'node-meta'); m.append(document.createTextNode(`Indicador ${ind.ano}${ind.apuracao_parcial ? ' (parcial)' : ''}: `), h('b', null, fmtInd(ind.apurado, ind.unidade)), document.createTextNode(` de ${fmtInd(ind.planejado, ind.unidade)}`)); b.append(m); }
          }
          b.append(dots(g.rs));
        }
        b.addEventListener('click', () => { S.path = S.path.slice(0, k); if (!on) S.path[k] = g.key; renderDecomp(); requestAnimationFrame(scrollToEnd); });
        b.addEventListener('mouseenter', () => { const l = links.find((x) => x.to === b); if (l) l.el.classList.add('lit'); b.classList.add('lit'); });
        b.addEventListener('mouseleave', () => { const l = links.find((x) => x.to === b); if (l) l.el.classList.remove('lit'); b.classList.remove('lit'); });
        c.append(b);
        links.push({ from: parent, to: b, on });
        if (on) { selNode = b; selGroup = g; }
      });
      if (!selGroup) break;
      const r0 = selGroup.rs[0];
      crumb.push(lv.code ? `${lv.code(r0)} ${lv.label(r0)}` : lv.label(r0));
      if (lv.leaf) { const dc = col('Detalhe', null, 'detail'); const card = detailCard(r0); dc.append(card); links.push({ from: selNode, to: card, on: true }); break; }
      parent = selNode; rows = selGroup.rs;
    }
    renderCrumb(crumb);

    const base = box.getBoundingClientRect();
    const svg = sv('svg', { class: 'links', width: box.scrollWidth, height: box.scrollHeight, 'aria-hidden': 'true' });
    links.forEach((l) => {
      const a = l.from.getBoundingClientRect(), b = l.to.getBoundingClientRect();
      const sx = a.right - base.left, sy = a.top - base.top + Math.min(a.height / 2, 30);
      const tx = b.left - base.left, ty = b.top - base.top + Math.min(b.height / 2, 30);
      const dx = (tx - sx) / 2;
      const p = sv('path', { d: `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}` });
      if (l.on) p.classList.add('on');
      l.el = p; svg.append(p);
    });
    box.prepend(svg);
  };
  const scrollToEnd = () => { const sc = $('.decomp-scroll'); if (sc) sc.scrollTo({ left: sc.scrollWidth, behavior: reduce ? 'auto' : 'smooth' }); };

  const render = () => { renderTop(); renderDecomp(); };

  // ---------- painel recolhível ----------
  const setCollapsed = (v) => {
    const app = $('#app'), btn = $('#collapse');
    app.classList.toggle('collapsed', v);
    btn.setAttribute('aria-expanded', String(!v));
    const lab = v ? 'Abrir painel' : 'Recolher painel';
    btn.title = lab; btn.querySelector('.sr').textContent = lab;
    try { localStorage.setItem('ppa-side', v ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
  };

  // ---------- eventos ----------
  const bind = () => {
    $$('[data-year]').forEach((b) => b.addEventListener('click', () => { if (b.disabled) return; S.year = Number(b.dataset.year); render(); }));
    $('.years-rail').addEventListener('keydown', (ev) => {
      const ys = [2024, 2025, 2026]; const i = ys.indexOf(S.year);
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); S.year = ys[Math.max(0, Math.min(2, i + (ev.key === 'ArrowRight' ? 1 : -1)))]; render(); $(`[data-year="${S.year}"]`).focus(); }
    });
    $('#f-comp').addEventListener('change', (e) => { S.comp = e.target.value; S.path = []; render(); });
    $('#f-usp').addEventListener('change', (e) => { S.usp = e.target.value; S.path = []; render(); });
    $('#f-clear').addEventListener('click', () => { S.comp = ''; S.usp = ''; $('#f-comp').value = ''; $('#f-usp').value = ''; S.path = []; render(); });
    $('#d-order').addEventListener('change', (e) => { S.order = e.target.value; S.path = []; renderDecomp(); });
    $$('[data-sort]').forEach((b) => b.addEventListener('click', () => { S.sort = b.dataset.sort; $$('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderDecomp(); }));
    $('#collapse').addEventListener('click', () => { setCollapsed(!$('#app').classList.contains('collapsed')); setTimeout(renderDecomp, reduce ? 0 : 280); });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderDecomp, 150); });
  };

  const load = async () => {
    const names = ['entregas', 'processos', 'indicadores'];
    try {
      const all = await Promise.all(names.map((n) => fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); })));
      names.forEach((n, i) => { D[n] = all[i]; });
    } catch (err) {
      $('#decomp').replaceChildren(h('p', 'empty', 'Não foi possível carregar os dados.'));
      return;
    }
    Array.from(new Map(D.entregas.map((e) => [e.id_compromisso, [e.cod_compromisso, e.compromisso]])).entries()).sort()
      .forEach(([id, [cod, nm]]) => $('#f-comp').append(new Option(`${cod} · ${nm}`, id)));
    Array.from(new Set(D.entregas.map((e) => e.usp).filter(Boolean))).sort().forEach((u) => $('#f-usp').append(new Option(u, u)));
    let saved = window.matchMedia('(max-width: 900px)').matches; try { const v = localStorage.getItem('ppa-side'); if (v != null) saved = v === '1'; } catch (e) { /* sem armazenamento */ }
    setCollapsed(saved);
    bind();
    render();
  };
  load();
})();
