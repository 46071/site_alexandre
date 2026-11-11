(() => {
  'use strict';
  /* ---- Configuração (dados simulados: troque por uma API real) ---- */
  const HOLD_MIN = 15, UPDATE_MS = 4000, KEY = 'sp_reserva';
  const CATS = {
    comum: { label: 'Carros comuns', busy: .6 },
    moto:  { label: 'Motos', busy: .5 },
    pcd:   { label: 'Vagas PCD', busy: .3 },
    idoso: { label: 'Vagas Idosos', busy: .3 },
    ev:    { label: 'Recarga elétrica', busy: .3 }
  };
  const SECTORS = [
    ...[...'ABCDEF'].map(l => ({ pre: l, name: `Carros · Setor ${l}`, cat: 'comum', n: 50 })), // 300 comuns
    { pre: 'PCD',  name: 'Vagas PCD',        cat: 'pcd',   n: 20 },
    { pre: 'IDO',  name: 'Vagas Idosos',     cat: 'idoso', n: 38 },
    { pre: 'MOTO', name: 'Motos',            cat: 'moto',  n: 30 },
    { pre: 'EV',   name: 'Recarga elétrica', cat: 'ev',    n: 6 }
  ];
  const ST = { free: 'Livre', busy: 'Ocupada', res: 'Reservada' };
  const $ = (s, e = document) => e.querySelector(s);
  const spots = [];
  let filter = 'todas', sector = null, selected = null, mine = null, timer = null;

  /* ---- Construção ---- */
  SECTORS.forEach(sec => {
    sec.grid = document.createElement('div');
    sec.grid.className = 'grid';
    sec.spots = [];
    for (let i = 1; i <= sec.n; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      const s = { code: `${sec.pre}-${String(i).padStart(2, '0')}`, cat: sec.cat, sec,
        st: Math.random() < CATS[sec.cat].busy ? 'busy' : 'free', el: b };
      b.textContent = String(i).padStart(2, '0');
      b.onclick = () => select(s);
      sec.spots.push(s); spots.push(s); sec.grid.appendChild(b);
    }
  });
  const freeOf = list => list.filter(s => s.st === 'free').length;

  function paint(s) {
    const isMine = mine && mine.code === s.code;
    s.el.className = `spot ${s.st}` + (isMine ? ' mine' : '') + (s === selected ? ' on' : '');
    s.el.setAttribute('aria-label', `Vaga ${s.code}, ${CATS[s.cat].label}, ${isMine ? 'sua reserva' : ST[s.st].toLowerCase()}`);
  }

  /* ---- Telas: lista de setores / setor aberto ---- */
  function renderView() {
    const v = $('#view'); v.textContent = '';
    $('#sel').hidden = !sector;
    if (sector) {
      const head = document.createElement('div');
      head.className = 'vh';
      head.innerHTML = `<h2>${sector.name}<small id="vhFree"></small></h2><button class="btn ghost" id="back">← Setores</button>`;
      v.append(head, sector.grid);
      $('#back').onclick = () => { sector = null; renderView(); };
      sector.spots.forEach(paint);
      renderSel(); updHead();
      return;
    }
    const h = document.createElement('div');
    h.className = 'vh';
    h.innerHTML = `<h2>Setores<small>${filter === 'todas' ? 'Toque num setor para ver as vagas' : 'Filtro: ' + CATS[filter].label}</small></h2>` +
      (filter !== 'todas' ? '<button class="btn ghost" id="clr">Ver todos</button>' : '');
    const list = document.createElement('div');
    list.className = 'sectors';
    SECTORS.filter(s => filter === 'todas' || s.cat === filter).forEach(sec => {
      const f = freeOf(sec.spots), b = document.createElement('button');
      b.className = 'sec' + (f === 0 ? ' zero' : f <= 3 ? ' low' : '');
      b.innerHTML = `<b>${sec.name}<span>${f} livres</span></b><span>${sec.n} vagas no total</span><div class="bar"><i style="width:${f / sec.n * 100}%"></i></div>`;
      b.onclick = () => openSector(sec);
      list.appendChild(b);
    });
    v.append(h, list);
    if ($('#clr')) $('#clr').onclick = () => setFilter('todas');
  }
  function updHead() {
    const el = $('#vhFree');
    if (el && sector) el.textContent = `${freeOf(sector.spots)} livres de ${sector.n}`;
  }
  function openSector(sec, scroll = true) {
    sector = sec; renderView();
    if (scroll) $('#vagas').scrollIntoView();
  }
  function setFilter(f) { filter = f; dashboard(); if (!sector) renderView(); }

  /* ---- Contadores ---- */
  function dashboard() {
    const box = $('#stats');
    if (!box.children.length) Object.keys(CATS).forEach(k => {
      const a = document.createElement('button');
      a.dataset.cat = k;
      a.onclick = () => { sector = null; setFilter(filter === k ? 'todas' : k); renderView(); $('#vagas').scrollIntoView(); };
      box.appendChild(a);
    });
    let total = 0; const none = [];
    Object.keys(CATS).forEach(k => {
      const list = spots.filter(s => s.cat === k), f = freeOf(list);
      total += f; if (!f) none.push(CATS[k].label);
      const a = box.querySelector(`[data-cat=${k}]`);
      a.className = 'stat' + (f === 0 ? ' zero' : f <= 3 ? ' low' : '') + (filter === k ? ' on' : '');
      a.innerHTML = `<h3>${CATS[k].label}</h3><strong>${f}</strong><small>de ${list.length} livres</small><div class="bar"><i style="width:${f / list.length * 100}%"></i></div>`;
    });
    const st = $('#status');
    if (!total) { st.className = 'status full'; st.textContent = 'Estacionamento lotado. Aguarde a liberação de vagas.'; }
    else if (none.length) { st.className = 'status warn'; st.textContent = `Sem vagas livres: ${none.join(', ')}.`; }
    else { st.className = 'status'; st.textContent = 'Há vagas livres em todas as categorias.'; }
  }

  /* ---- Seleção ---- */
  function select(s) {
    const prev = selected; selected = s;
    if (prev) paint(prev);
    paint(s); renderSel();
  }
  function renderSel() {
    const s = selected, box = $('#sel');
    if (!sector) return;
    if (!s || s.sec !== sector) { box.innerHTML = 'Toque em uma vaga para ver os detalhes.'; return; }
    const isMine = mine && mine.code === s.code;
    const extra = s.cat === 'ev' ? ' · só carros elétricos' : s.cat === 'pcd' || s.cat === 'idoso' ? ' · exige credencial' : '';
    box.innerHTML = `Vaga <b>${s.code}</b>${extra} <span class="tag ${isMine ? 'res' : s.st}">${isMine ? 'Sua reserva' : ST[s.st]}</span>`;
    if (s.st === 'free' && !mine) {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = 'Reservar esta vaga';
      b.onclick = () => openDialog(false); box.appendChild(b);
    } else if (s.st === 'free') {
      box.insertAdjacentHTML('beforeend', '<p class="note">Você já tem uma reserva ativa. Cancele-a para reservar outra.</p>');
    }
  }

  /* ---- Reserva ---- */
  const dlg = $('#dlg');
  let quick = false;
  $('#qcat').innerHTML = Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

  function openDialog(isQuick) {
    if (mine) { alert('Você já tem uma reserva ativa. Cancele-a para reservar outra vaga.'); $('#reserva').scrollIntoView(); return; }
    quick = isQuick;
    if (!quick && !selected) return;
    $('#form').reset();
    $('#qRow').hidden = !quick;
    refreshDialog();
    dlg.showModal();
  }
  function refreshDialog() {
    const cat = quick ? $('#qcat').value : selected.cat;
    $('#dTitle').textContent = quick ? 'Reservar uma vaga' : `Reservar vaga ${selected.code}`;
    const cred = cat === 'pcd' || cat === 'idoso';
    $('#credRow').hidden = !cred; $('#cred').required = cred;
    $('#credTxt').textContent = cat === 'pcd' ? 'Possuo credencial de pessoa com deficiência.' : 'Tenho 60 anos ou mais e credencial de idoso.';
    $('#evRow').hidden = cat !== 'ev'; $('#evChk').required = cat === 'ev';
    const none = quick && !freeOf(spots.filter(s => s.cat === cat));
    $('#noFree').hidden = !none; $('#dOk').disabled = none;
  }
  $('#qcat').onchange = refreshDialog;
  $('#quick').onclick = () => openDialog(true);
  $('#dCancel').onclick = () => dlg.close();

  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    let s = selected;
    if (quick) {
      const pool = spots.filter(x => x.cat === $('#qcat').value && x.st === 'free');
      s = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!s || s.st !== 'free') { dlg.close(); return; }
    mine = { code: s.code, plate: $('#plate').value.toUpperCase(), until: Date.now() + HOLD_MIN * 60000 };
    s.st = 'res'; save(); dlg.close();
    selected = s; paint(s); dashboard(); renderView(); renderRes();
    $('#reserva').scrollIntoView();
  });

  const save = () => { try { mine ? localStorage.setItem(KEY, JSON.stringify(mine)) : localStorage.removeItem(KEY); } catch (e) {} };
  function load() {
    try { mine = JSON.parse(localStorage.getItem(KEY)); } catch (e) { mine = null; }
    const s = mine && mine.until > Date.now() && spots.find(x => x.code === mine.code);
    if (s) s.st = 'res'; else { mine = null; save(); }
  }
  function cancel(expired) {
    const s = spots.find(x => mine && x.code === mine.code);
    if (s) { s.st = 'free'; paint(s); }
    mine = null; save();
    dashboard(); renderView(); renderRes();
    if (expired) alert('Sua reserva expirou e a vaga foi liberada.');
  }
  function renderRes() {
    const box = $('#resBox');
    clearInterval(timer);
    if (!mine) { box.innerHTML = '<p class="empty">Você não tem reserva. Toque em “Reservar uma vaga” no topo ou escolha uma vaga verde num setor.</p>'; return; }
    box.innerHTML = `<div class="rcard"><span class="tag res">Reserva ativa</span><div class="big">Vaga ${mine.code}</div>
      <div>Placa <b>${mine.plate}</b></div><div>Tempo restante: <span class="time" id="left"></span></div>
      <div class="actions"><button class="btn ghost" id="goMap">Ver no mapa</button><button class="btn red" id="cancelRes">Cancelar</button></div></div>`;
    $('#goMap').onclick = () => { const s = spots.find(x => x.code === mine.code); selected = s; openSector(s.sec); };
    $('#cancelRes').onclick = () => { if (confirm('Cancelar a reserva?')) cancel(false); };
    const tick = () => {
      const ms = mine.until - Date.now();
      if (ms <= 0) return cancel(true);
      const el = $('#left'); if (!el) return;
      el.textContent = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
      el.classList.toggle('late', ms < 120000);
    };
    tick(); timer = setInterval(tick, 1000);
  }

  /* ---- Recarga ---- */
  function evList() {
    $('#evList').innerHTML = spots.filter(s => s.cat === 'ev').map(s => `<div class="evi"><b>Vaga ${s.code}</b>Setor Recarga elétrica</div>`).join('');
  }

  /* ---- Simulação de movimento ---- */
  function traffic() {
    for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      if (s.st === 'res') continue;
      s.st = s.st === 'free' ? 'busy' : 'free';
      paint(s);
      if (sector === s.sec) { s.el.classList.remove('flash'); void s.el.offsetWidth; s.el.classList.add('flash'); }
      if (s === selected) renderSel();
    }
    dashboard();
    if (sector) updHead(); else renderView();
  }

  load(); evList(); dashboard(); renderView(); renderRes();
  $('#year').textContent = new Date().getFullYear();
  setInterval(traffic, UPDATE_MS);
})();
