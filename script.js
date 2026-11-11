(() => {
  'use strict';
  /* ---- Configuração (dados simulados: troque por uma API real) ---- */
  const HOLD_MIN = 15, UPDATE_MS = 4000, KEY = 'sp_reserva';
  const LOTS = [
    { name: 'Carros', rows: ['A', 'B', 'C', 'D'], car: true },
    { name: 'Motos', rows: ['M1', 'M2'], car: false }
  ];
  const PER_ROW = 12;
  const CATS = {
    comum: { label: 'Carros comuns', short: 'Comuns', sym: '', busy: .6 },
    moto:  { label: 'Motos', short: 'Motos', sym: '', busy: .5 },
    pcd:   { label: 'PCD', short: 'PCD', sym: '♿', busy: .25 },
    idoso: { label: 'Idosos', short: 'Idosos', sym: '60+', busy: .25 },
    ev:    { label: 'Recarga elétrica', short: 'Recarga', sym: '⚡', busy: .25 }
  };
  const ST = { free: 'Livre', busy: 'Ocupada', res: 'Reservada' };
  const $ = (s, e = document) => e.querySelector(s);
  const spots = [];
  let filter = 'todas', selected = null, mine = null, timer = null;

  function catOf(lot, row, c) {
    if (!lot.car) return 'moto';
    if ((row === 'A' || row === 'B') && c < 2) return 'pcd';
    if ((row === 'A' || row === 'B') && c < 4) return 'idoso';
    if ((row === 'C' || row === 'D') && c >= 10) return 'ev';
    return 'comum';
  }

  function build() {
    const map = $('#map');
    LOTS.forEach(lot => {
      const box = document.createElement('div');
      box.className = 'lot';
      box.innerHTML = `<h4>${lot.name}</h4>`;
      lot.rows.forEach((row, i) => {
        const el = document.createElement('div');
        el.className = 'row' + (i % 2 === 1 && i < lot.rows.length - 1 ? ' lane' : '');
        for (let c = 0; c < PER_ROW; c++) {
          const cat = catOf(lot, row, c);
          const b = document.createElement('button');
          b.type = 'button';
          const s = { code: `${row}-${String(c + 1).padStart(2, '0')}`, cat, st: Math.random() < CATS[cat].busy ? 'busy' : 'free', el: b };
          b.textContent = CATS[cat].sym || c + 1;
          b.onclick = () => select(s);
          spots.push(s); el.appendChild(b);
        }
        box.appendChild(el);
      });
      map.appendChild(box);
    });
  }

  function paint(s) {
    const isMine = mine && mine.code === s.code;
    s.el.className = `spot ${s.st}` + (CATS[s.cat].sym ? ' sp' : '') + (isMine ? ' mine' : '') + (s === selected ? ' on' : '') +
      (filter !== 'todas' && s.cat !== filter ? ' dim' : '');
    s.el.setAttribute('aria-label', `Vaga ${s.code}, ${CATS[s.cat].label}, ${ST[s.st].toLowerCase()}`);
  }
  const paintAll = () => spots.forEach(paint);

  /* ---- Painel ---- */
  function dashboard() {
    const box = $('#stats');
    if (!box.children.length) {
      Object.keys(CATS).forEach(k => {
        const a = document.createElement('button');
        a.className = 'stat'; a.dataset.cat = k;
        a.onclick = () => { setFilter(filter === k ? 'todas' : k); $('#vagas').scrollIntoView(); };
        box.appendChild(a);
      });
    }
    let totalFree = 0; const none = [];
    Object.keys(CATS).forEach(k => {
      const list = spots.filter(s => s.cat === k), free = list.filter(s => s.st === 'free').length;
      totalFree += free; if (!free) none.push(CATS[k].short);
      const a = box.querySelector(`[data-cat=${k}]`);
      a.className = 'stat' + (free === 0 ? ' zero' : free <= 3 ? ' low' : '') + (filter === k ? ' is-on' : '');
      a.innerHTML = `<h3>${CATS[k].label}</h3><strong>${free}</strong><small>de ${list.length} vagas livres</small><div class="bar"><i style="width:${free / list.length * 100}%"></i></div>`;
    });
    const st = $('#status');
    if (!totalFree) { st.className = 'status full'; st.textContent = 'Estacionamento lotado. Aguarde a liberação de vagas.'; }
    else if (none.length) { st.className = 'status warn'; st.textContent = `Sem vagas livres: ${none.join(', ')}.`; }
    else { st.className = 'status'; st.textContent = 'Há vagas livres em todas as categorias.'; }
  }

  function setFilter(f) {
    filter = f;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === f));
    paintAll(); dashboard();
  }

  function chips() {
    const box = $('#chips');
    [['todas', 'Todas'], ...Object.entries(CATS).map(([k, v]) => [k, v.short])].forEach(([k, t]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (k === 'todas' ? ' on' : ''); b.dataset.f = k; b.textContent = t;
      b.onclick = () => setFilter(k); box.appendChild(b);
    });
  }

  /* ---- Seleção ---- */
  function select(s) {
    const prev = selected; selected = s;
    if (prev) paint(prev);
    paint(s); renderSel();
  }
  function renderSel() {
    const s = selected, box = $('#sel');
    if (!s) return;
    const isMine = mine && mine.code === s.code;
    const extra = s.cat === 'ev' ? ' · exclusiva para carros elétricos' : s.cat === 'pcd' || s.cat === 'idoso' ? ' · exige credencial' : '';
    box.innerHTML = `Vaga <b>${s.code}</b> · ${CATS[s.cat].label}${extra}<br><span class="tag ${s.st}">${isMine ? 'Sua reserva' : ST[s.st]}</span>`;
    if (s.st === 'free' && !mine) {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = 'Reservar esta vaga'; b.onclick = openDialog; box.appendChild(b);
    } else if (s.st === 'free' && mine) {
      box.insertAdjacentHTML('beforeend', '<p class="empty">Você já tem uma reserva ativa. Cancele-a para reservar outra vaga.</p>');
    }
  }

  /* ---- Reserva ---- */
  const dlg = $('#dlg');
  function openDialog() {
    const s = selected; if (!s) return;
    $('#dTitle').textContent = `Reservar vaga ${s.code}`;
    $('#form').reset();
    const needCred = s.cat === 'pcd' || s.cat === 'idoso';
    $('#credRow').hidden = !needCred; $('#cred').required = needCred;
    $('#credTxt').textContent = s.cat === 'pcd' ? 'Possuo credencial de pessoa com deficiência.' : 'Tenho 60 anos ou mais e credencial de idoso.';
    $('#evRow').hidden = s.cat !== 'ev'; $('#evChk').required = s.cat === 'ev';
    dlg.showModal();
  }
  $('#dCancel').onclick = () => dlg.close();
  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    const s = selected;
    if (!s || s.st !== 'free') { dlg.close(); return; }
    mine = { code: s.code, plate: $('#plate').value.toUpperCase(), until: Date.now() + HOLD_MIN * 60000 };
    s.st = 'res'; save(); dlg.close();
    paintAll(); renderSel(); dashboard(); renderRes();
    $('#reserva').scrollIntoView();
  });

  const save = () => { try { mine ? localStorage.setItem(KEY, JSON.stringify(mine)) : localStorage.removeItem(KEY); } catch (e) {} };
  function load() {
    try { mine = JSON.parse(localStorage.getItem(KEY)); } catch (e) { mine = null; }
    if (!mine || mine.until <= Date.now()) { mine = null; save(); return; }
    const s = spots.find(x => x.code === mine.code);
    if (s) s.st = 'res'; else mine = null;
  }
  function cancel(expired) {
    const s = spots.find(x => mine && x.code === mine.code);
    if (s) s.st = 'free';
    mine = null; save();
    paintAll(); renderSel(); dashboard(); renderRes();
    if (expired) alert('Sua reserva expirou e a vaga foi liberada.');
  }
  function renderRes() {
    const box = $('#resBox');
    clearInterval(timer);
    if (!mine) { box.innerHTML = '<p class="empty">Você não tem reserva. Escolha uma vaga verde no mapa e toque em “Reservar esta vaga”.</p>'; return; }
    box.innerHTML = `<div class="rcard"><span class="tag res">Reserva ativa</span><div class="big">Vaga ${mine.code}</div>
      <div>Placa <b>${mine.plate}</b></div><div>Tempo restante: <span class="time" id="left"></span></div>
      <div class="actions"><button class="btn ghost" id="goMap">Ver no mapa</button><button class="btn red" id="cancelRes">Cancelar reserva</button></div></div>`;
    $('#goMap').onclick = () => { select(spots.find(x => x.code === mine.code)); $('#vagas').scrollIntoView(); };
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
    $('#evList').innerHTML = spots.filter(s => s.cat === 'ev').map(s =>
      `<div class="evi"><b>Vaga ${s.code}</b><small>Piso térreo · ${s.code[0] === 'C' ? 'fileira C' : 'fileira D'}</small></div>`).join('');
  }

  /* ---- Simulação de movimento ---- */
  function traffic() {
    for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      if (s.st === 'res') continue;
      s.st = s.st === 'free' ? 'busy' : 'free';
      paint(s); s.el.classList.remove('flash'); void s.el.offsetWidth; s.el.classList.add('flash');
      if (s === selected) renderSel();
    }
    dashboard();
  }

  build(); load(); chips(); evList(); paintAll(); dashboard(); renderRes();
  $('#year').textContent = new Date().getFullYear();
  setInterval(traffic, UPDATE_MS);
})();
