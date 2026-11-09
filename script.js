(() => {
  'use strict';

  /* ------------------------------------------------------------
   * Configuração (dados simulados – troque por uma API real)
   * ------------------------------------------------------------ */
  const ROWS = 6;            // fileiras no mapa
  const PER_ROW = 59;        // vagas por fileira
  const PCD_PER_ROW = 5;     // vagas PCD no início de cada fileira (perto do shopping)
  const IDOSO_PER_ROW = 4;   // vagas idosos logo após as PCD
  const INITIAL_BUSY = { comum: 52, pcd: 6, idoso: 6 };
  const UPDATE_MS = 3500;    // intervalo da simulação

  const LABEL = { comum: 'Comum', pcd: 'PCD', idoso: 'Idosos' };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ------------------------------------------------------------
   * Estado
   * ------------------------------------------------------------ */
  const spots = [];          // { id, code, type, free, el }
  let filter = 'todas';
  let zoom = 1;
  let selected = null;

  /* ------------------------------------------------------------
   * Construção do mapa
   * ------------------------------------------------------------ */
  function buildMap() {
    const lot = $('#lot');
    const letters = 'ABCDEF';

    for (let r = 0; r < ROWS; r++) {
      const row = document.createElement('div');
      row.className = 'row' + (r % 2 === 1 && r < ROWS - 1 ? ' lane-after' : '');

      for (let c = 0; c < PER_ROW; c++) {
        let type = 'comum';
        if (c < PCD_PER_ROW) type = 'pcd';
        else if (c < PCD_PER_ROW + IDOSO_PER_ROW) type = 'idoso';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `spot t-${type}` + ((c + 1) % 10 === 0 && c < PER_ROW - 1 ? ' gap' : '');

        const spot = {
          id: spots.length,
          code: `${letters[r]}-${String(c + 1).padStart(2, '0')}`,
          type,
          free: true,
          el: btn,
        };
        btn.addEventListener('click', () => selectSpot(spot));
        spots.push(spot);
        row.appendChild(btn);
      }
      lot.appendChild(row);
    }

    // ocupa vagas aleatórias respeitando a quantidade inicial por tipo
    Object.entries(INITIAL_BUSY).forEach(([type, qty]) => {
      const pool = spots.filter(s => s.type === type);
      shuffle(pool).slice(0, qty).forEach(s => (s.free = false));
    });
    spots.forEach(paintSpot);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function paintSpot(s) {
    s.el.classList.toggle('is-free', s.free);
    s.el.setAttribute('aria-label',
      `Vaga ${s.code}, ${LABEL[s.type]}, ${s.free ? 'livre' : 'ocupada'}`);
  }

  /* ------------------------------------------------------------
   * Contadores e status
   * ------------------------------------------------------------ */
  function counts() {
    const res = { comum: { free: 0, total: 0 }, pcd: { free: 0, total: 0 }, idoso: { free: 0, total: 0 } };
    spots.forEach(s => {
      res[s.type].total++;
      if (s.free) res[s.type].free++;
    });
    return res;
  }

  const animated = {};
  function animateNumber(el, to) {
    const from = animated[el.id] ?? 0;
    animated[el.id] = to;
    const start = performance.now(), dur = 600;
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(from + (to - from) * p);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function updateDashboard() {
    const c = counts();
    const map = { comum: 'Comum', pcd: 'Pcd', idoso: 'Idoso' };

    Object.entries(map).forEach(([type, suffix]) => {
      const { free, total } = c[type];
      animateNumber($('#num' + suffix), free);
      $('#bar' + suffix).style.width = (free / total * 100) + '%';
      $('#sub' + suffix).textContent = `de ${total} vagas · ${Math.round((total - free) / total * 100)}% ocupadas`;
    });

    // caixa de status
    const box = $('#statusBox');
    const noneFree = Object.values(c).filter(x => x.free === 0);
    const allFull = noneFree.length === 3;
    box.classList.toggle('is-full', allFull);

    if (allFull) {
      $('#statusTitle').textContent = 'Estacionamento lotado';
      $('#statusMsg').textContent = 'Aguarde a liberação de vagas.';
    } else if (noneFree.length > 0) {
      const names = Object.entries(c).filter(([, x]) => x.free === 0).map(([t]) => LABEL[t]);
      $('#statusTitle').textContent = 'Vagas encontradas!';
      $('#statusMsg').textContent = `Sem vagas livres: ${names.join(', ')}.`;
    } else {
      $('#statusTitle').textContent = 'Vagas encontradas!';
      $('#statusMsg').textContent = 'Há vagas disponíveis para todos.';
    }

    // seção "Sobre"
    const total = spots.length;
    const free = spots.filter(s => s.free).length;
    $('#factTotal').textContent = total;
    $('#factOcc').textContent = Math.round((total - free) / total * 100) + '%';
    $('#factUpd').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  /* ------------------------------------------------------------
   * Interações
   * ------------------------------------------------------------ */
  function selectSpot(s) {
    if (selected) selected.el.classList.remove('is-selected');
    selected = s;
    s.el.classList.add('is-selected');
    $('#spotInfo').innerHTML =
      `Vaga <b>${s.code}</b> · ${LABEL[s.type]} · ` +
      (s.free ? '<b style="color:#16913a">Livre</b>' : '<b style="color:#6b7280">Ocupada</b>');
  }

  function applyFilter(f) {
    filter = f;
    $$('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.filter === f));
    spots.forEach(s => s.el.classList.toggle('dim', f !== 'todas' && s.type !== f));
  }

  function setZoom(z) {
    zoom = Math.min(2, Math.max(0.7, z));
    const map = $('#map');
    map.style.transform = `scale(${zoom})`;
    // compensa o espaço ocupado pela escala
    map.style.width = (100 / zoom) + '%';
    map.style.minWidth = (700) + 'px';
  }

  function simulateTraffic() {
    // 1–3 vagas mudam de estado; mais chance de ocupar do que liberar quando há muitas livres
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      s.free = !s.free;
      paintSpot(s);
      s.el.classList.remove('flash');
      void s.el.offsetWidth;
      s.el.classList.add('flash');
      if (s === selected) selectSpot(s);
    }
    updateDashboard();
  }

  /* ------------------------------------------------------------
   * Relógio
   * ------------------------------------------------------------ */
  function tickClock() {
    const now = new Date();
    $('#clockTime').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('#clockDate').textContent = now.toLocaleDateString('pt-BR');
  }

  /* ------------------------------------------------------------
   * Navegação: destaca o link da seção visível
   * ------------------------------------------------------------ */
  function setupNav() {
    const links = $$('.nav__link');
    const sections = links.map(l => document.getElementById(l.dataset.target));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.toggle('is-active', l.dataset.target === e.target.id));
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    sections.forEach(s => s && io.observe(s));
  }

  /* ------------------------------------------------------------
   * Inicialização
   * ------------------------------------------------------------ */
  function init() {
    buildMap();
    updateDashboard();
    tickClock();
    setupNav();
    $('#year').textContent = new Date().getFullYear();

    setInterval(tickClock, 1000);
    setInterval(simulateTraffic, UPDATE_MS);

    $$('.chip').forEach(c => c.addEventListener('click', () => applyFilter(c.dataset.filter)));
    $$('.stat').forEach(card => card.addEventListener('click', () => {
      applyFilter(card.dataset.type);
      $('#estacionamento').scrollIntoView({ behavior: 'smooth' });
    }));
    $('#zoomIn').addEventListener('click', () => setZoom(zoom + 0.15));
    $('#zoomOut').addEventListener('click', () => setZoom(zoom - 0.15));
  }

  init();
})();
