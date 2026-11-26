(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  const DEFAULT_CFG = { maxQueue: 3, maxWaitMin: 10, everySec: 45 };
  let cfg = Object.assign({}, DEFAULT_CFG, LS.get('cfg', {}));
  let token = LS.get('token', null);
  let lastOkAt = 0;
  let lastEval = null;
  let snooze = { until: 0, signature: '' };
  let pollTimer = null;
  let period = 'today';

  // ---------- API ----------
  // Com config.js (Supabase): chamadas vão à função bv-proxy e o token do botvendas segue em x-bv-token.
  // Sem config.js: chama o mesmo endereço do app (servidor Node.js do projeto).
  const CONF = window.MONITOR_CONFIG || {};
  const BASE = (CONF.API_BASE || '').replace(/\/$/, '');
  async function rawFetch(path, opts) {
    const headers = { Accept: 'application/json' };
    if (opts && opts.body) headers['Content-Type'] = 'application/json';
    const useToken = token && !(opts && opts.noAuth);
    if (CONF.SUPABASE_ANON_KEY) {
      headers.Authorization = 'Bearer ' + CONF.SUPABASE_ANON_KEY;
      headers.apikey = CONF.SUPABASE_ANON_KEY;
      if (useToken) headers['x-bv-token'] = token;
    } else if (useToken) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(BASE + path, { method: (opts && opts.method) || 'GET', headers, body: opts && opts.body, cache: 'no-store' });
    return r;
  }
  async function login(email, password) {
    const r = await rawFetch('/api/v2/login', { method: 'POST', noAuth: true, body: JSON.stringify({ email, password }) });
    let j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j.token) {
      const map = { invalid_credentials: 'E-mail ou senha incorretos.', not_allowed_this_user: 'Este usuário não tem permissão de API.' };
      throw new Error(map[j.error] || 'Não foi possível entrar (' + r.status + ').');
    }
    token = j.token;
    LS.set('token', token);
    return token;
  }
  async function api(path) {
    let r = await rawFetch(path);
    if (r.status === 401) {
      const c = LS.get('creds', null);
      if (c) { await login(c.email, c.password); r = await rawFetch(path); }
    }
    if (r.status === 401) throw Object.assign(new Error('Sessão expirada'), { auth: true });
    if (r.status === 429) {
      let secs = 20;
      try { const m = JSON.stringify(await r.json()).match(/em (\d+) segundos/); if (m) secs = Math.min(120, +m[1] + 2); } catch (e) {}
      throw Object.assign(new Error('Limite de requisições do botvendas, nova tentativa em ' + secs + 's'), { rate: secs });
    }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + path.split('?')[0]);
    return r.json();
  }

  // ---------- Dados ----------
  // UMA chamada por leitura (o botvendas limita requisições por minuto).
  // Tempo de espera = agora - updated_at do atendimento em "Aguardando vendedor" (status 2).
  // Obs.: o botvendas envia updated_at em horário de Brasília (UTC-3) escrito com "Z"; por isso o ajuste abaixo.
  // O campo te_in_seconds NÃO serve: fica parado (ex.: cliente há 2 h na fila marcava 17 s).
  function parseBR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso || '');
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + 3 * 3600 * 1000;
  }
  function ymd(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  async function fetchWaiting() {
    const now = Date.now(), ini = new Date(now - 3 * 86400000);
    const items = []; let page = 1, last = 1, calls = 0;
    do {
      calls++;
      const j = await api(`/api/v2/attendance/paginated?statuses[]=2&ini_updated_at=${ymd(ini)}&end_updated_at=${ymd(new Date(now))}&page_size=100&page=${page}`);
      last = j.last_page || 1;
      for (const o of j.data || []) {
        if (o.status != null && o.status !== 2) continue;
        const t = parseBR(o.updated_at);
        items.push({ id: o.id, name: o.client_name || 'Cliente', waitSec: isNaN(t) ? 0 : Math.max(0, Math.round((now - t) / 1000)), sector: o.previous_seller_name ? 'Antes: ' + o.previous_seller_name : '', since: isNaN(t) ? null : t });
      }
      page++;
    } while (page <= last && page <= 3);
    items.sort((a, b) => b.waitSec - a.waitSec);
    return { items, calls };
  }
  function isoDate(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function range(p) {
    const now = new Date(), end = isoDate(now);
    if (p === 'today') return [end, end];
    if (p === '7d') { const s = new Date(now); s.setDate(s.getDate() - 6); return [isoDate(s), end]; }
    return [isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), end];
  }
  async function fetchSellers(p) {
    const [a, b] = range(p);
    return api(`/api/v2/sales-summary/sellers?ini_date=${a}&end_date=${b}`);
  }

  // ---------- Som / alarme ----------
  let ctx = null, alarmTimer = null, alarmStep = 0;
  function ensureAudio() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume();
    } catch (e) {}
    updateSoundBar();
  }
  function beep(freq, dur, vol) {
    if (!ctx || ctx.state !== 'running') return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  function startAlarm() {
    if (alarmTimer) return;
    const tick = () => {
      beep(alarmStep++ % 2 ? 660 : 990, 0.3, 0.4);
      if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
    };
    tick(); alarmTimer = setInterval(tick, 700);
  }
  function stopAlarm() { if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; } }
  function updateSoundBar() {
    $('soundbar').classList.toggle('hidden', !!(ctx && ctx.state === 'running'));
  }

  // ---------- Notificação / tela ligada ----------
  async function keepAwake() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch (e) {}
  }
  function notify(text) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Monitor BotVendas', { body: text, tag: 'botvendas-critical', renotify: true, requireInteraction: true });
      }
    } catch (e) {}
  }

  // ---------- Tela ----------
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render(ev, meta) {
    const banner = $('banner');
    banner.className = ev.level;
    $('bCount').textContent = ev.count === 0 ? '✔ Fila vazia' : ev.count + (ev.count === 1 ? ' cliente na fila' : ' clientes na fila');
    $('bCount').style.fontSize = ev.count === 0 ? '28px' : '34px';
    $('bSub').textContent = ev.level === 'critical' ? 'ATENÇÃO: ação necessária' : ev.level === 'attention' ? 'Fila sob controle' : 'Todos atendidos';
    const ul = $('bReasons'); ul.textContent = '';
    ev.reasons.forEach((r) => ul.appendChild(el('li', '', r.text)));
    $('sCount').textContent = ev.count;
    $('sMax').textContent = ev.count ? Alerts.fmt(ev.maxWait) : '–';
    const old = meta.items.length ? meta.items[0].since : null;
    $('sSectors').textContent = old ? new Date(old).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '–';
    const list = $('queueList'); list.textContent = '';
    if (!ev.count) list.appendChild(el('p', 'muted', 'Nenhum cliente aguardando vendedor agora.'));
    meta.items.forEach((it) => {
      const c = el('div', 'card q'), l = el('div');
      l.style.minWidth = 0;
      l.appendChild(el('div', 'nm', it.name));
      l.appendChild(el('div', 'st', it.sector || ''));
      const w = el('div', 'w' + (it.waitSec > cfg.maxWaitMin * 60 ? ' crit' : it.waitSec > cfg.maxWaitMin * 30 ? ' att' : ''), Alerts.fmt(it.waitSec));
      c.appendChild(l); c.appendChild(w); list.appendChild(c);
    });
    $('updated').textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.title = (ev.level === 'critical' ? '🚨 ' : '') + ev.count + ' na fila · Monitor';
  }

  function handleAlarm(ev) {
    const snoozed = Date.now() < snooze.until && snooze.signature === ev.signature;
    const should = ev.level === 'critical' && !snoozed;
    $('snoozeBtn').classList.toggle('hidden', ev.level !== 'critical');
    if (should) {
      startAlarm();
      if (!lastEval || lastEval.signature !== ev.signature || lastEval.level !== 'critical') notify(ev.reasons.map((r) => r.text).join(' · '));
    } else stopAlarm();
    lastEval = ev;
  }

  async function poll() {
    try {
      const data = await fetchWaiting();
      lastOkAt = Date.now();
      const ev = Alerts.evaluate(data.items, cfg);
      render(ev, data);
      handleAlarm(ev);
    } catch (e) {
      if (e.auth) { showLogin('Sessão expirada. Entre novamente.'); return; }
      if (e.rate) { clearInterval(pollTimer); setTimeout(() => { poll(); schedule(); }, e.rate * 1000); }
      // sem dados: se passar de 2 min sem sucesso, trata como crítico
      $('updated').textContent = 'sem conexão';
      if (Date.now() - lastOkAt > 120000) {
        const ev = { level: 'critical', reasons: [{ type: 'stale', text: 'Sem dados do botvendas há mais de 2 min' }], count: 0, maxWait: 0, over: [], signature: 'stale' };
        $('banner').className = 'critical'; $('bCount').textContent = 'SEM DADOS'; $('bSub').textContent = e.message;
        const ul = $('bReasons'); ul.textContent = ''; ul.appendChild(el('li', '', ev.reasons[0].text));
        handleAlarm(ev);
      } else $('bSub').textContent = 'Falha ao atualizar: ' + e.message;
    }
  }
  function schedule() {
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, Math.max(30, cfg.everySec) * 1000);
  }

  // ---------- Vendedores ----------
  function moneyBR(n) { return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  async function renderSellers() {
    const box = $('sellersList'); box.textContent = '';
    box.appendChild(el('p', 'muted', 'Carregando…'));
    try {
      const rows = (await fetchSellers(period)) || [];
      box.textContent = '';
      rows.sort((a, b) => (b.attendance_count || 0) - (a.attendance_count || 0));
      const tot = rows.reduce((t, r) => ({ a: t.a + (r.attendance_count || 0), c: t.c + (r.closed_count || 0), v: t.v + (Number(r.closed_total) || 0) }), { a: 0, c: 0, v: 0 });
      const top = el('div', 'stats');
      [[tot.a, 'atendimentos'], [tot.c, 'vendas'], [tot.a ? Math.round((tot.c / tot.a) * 100) + '%' : '–', 'conversão']].forEach(([v, l]) => {
        const s = el('div', 'stat'); s.appendChild(el('b', '', v)); s.appendChild(el('span', '', l)); top.appendChild(s);
      });
      box.appendChild(top);
      rows.forEach((r) => {
        const conv = r.attendance_count ? Math.round(((r.closed_count || 0) / r.attendance_count) * 100) : 0;
        const c = el('div', 'card');
        const h = el('div', 'sel'); h.appendChild(el('span', 'name', r.name || 'Sem atendente')); h.appendChild(el('span', 'muted', conv + '% conv.'));
        const bar = el('div', 'bar'); const i = el('i'); i.style.width = Math.min(100, conv) + '%'; bar.appendChild(i);
        const g = el('div', 'grid4');
        [[r.attendance_count || 0, 'atend.'], [r.closed_count || 0, 'vendas'], [moneyBR(r.closed_total), 'vendido'], [r.tma ? Alerts.fmt(r.tma) : '–', 'tempo médio']].forEach(([v, l]) => {
          const d = el('div'); d.appendChild(el('b', '', v)); d.appendChild(document.createTextNode(l)); g.appendChild(d);
        });
        c.appendChild(h); c.appendChild(bar); c.appendChild(g); box.appendChild(c);
      });
      if (!rows.length) box.appendChild(el('p', 'muted', 'Sem dados no período.'));
    } catch (e) { box.textContent = ''; box.appendChild(el('p', 'err', 'Erro: ' + e.message)); }
  }

  // ---------- Navegação ----------
  function showTab(t) {
    ['queue', 'sellers', 'settings'].forEach((x) => $('tab-' + x).classList.toggle('hidden', x !== t));
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    if (t === 'sellers') renderSellers();
    if (t === 'settings') refreshNotifState();
  }
  function refreshNotifState() {
    const nb = $('notifBtn'), st = $('notifState');
    if (!('Notification' in window)) { st.textContent = 'Notificações não disponíveis neste navegador.'; nb.classList.add('hidden'); return; }
    st.textContent = 'Notificações: ' + ({ granted: 'ativadas', denied: 'bloqueadas', default: 'desativadas' }[Notification.permission]);
    nb.classList.toggle('hidden', Notification.permission !== 'default');
  }
  function showLogin(msg) {
    stopAlarm(); clearInterval(pollTimer);
    $('appView').classList.add('hidden'); $('loginView').classList.remove('hidden');
    $('loginErr').textContent = msg || '';
    const c = LS.get('creds', null); if (c) $('email').value = c.email;
  }
  function showApp() {
    $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden');
    $('cfgQueue').value = cfg.maxQueue; $('cfgWait').value = cfg.maxWaitMin; $('cfgEvery').value = cfg.everySec;
    lastOkAt = Date.now();
    poll(); schedule(); keepAwake(); updateSoundBar();
  }

  // ---------- Eventos ----------
  $('loginBtn').addEventListener('click', async () => {
    ensureAudio();
    const email = $('email').value.trim(), password = $('password').value;
    if (!email || !password) { $('loginErr').textContent = 'Preencha e-mail e senha.'; return; }
    $('loginBtn').disabled = true; $('loginErr').textContent = '';
    try { await login(email, password); LS.set('creds', { email, password }); $('password').value = ''; showApp(); }
    catch (e) { $('loginErr').textContent = e.message; }
    $('loginBtn').disabled = false;
  });
  $('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.t); });
  $('period').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    period = b.dataset.p;
    document.querySelectorAll('#period button').forEach((x) => x.classList.toggle('on', x === b));
    renderSellers();
  });
  $('refreshBtn').addEventListener('click', () => { ensureAudio(); poll(); });
  $('snoozeBtn').addEventListener('click', () => {
    snooze = { until: Date.now() + 5 * 60 * 1000, signature: lastEval ? lastEval.signature : '' };
    stopAlarm();
  });
  $('soundbar').addEventListener('click', ensureAudio);
  $('testSound').addEventListener('click', () => { ensureAudio(); setTimeout(() => { let n = 0; const t = setInterval(() => { beep(n++ % 2 ? 660 : 990, 0.3, 0.4); if (n > 5) clearInterval(t); }, 350); if (navigator.vibrate) navigator.vibrate([250, 120, 250]); }, 100); });
  $('saveCfg').addEventListener('click', () => {
    const q = parseInt($('cfgQueue').value, 10), w = parseFloat($('cfgWait').value), s = parseInt($('cfgEvery').value, 10);
    cfg = { maxQueue: q > 0 ? q : DEFAULT_CFG.maxQueue, maxWaitMin: w > 0 ? w : DEFAULT_CFG.maxWaitMin, everySec: s >= 30 ? s : DEFAULT_CFG.everySec };
    LS.set('cfg', cfg); schedule(); poll(); showTab('queue');
  });
  $('notifBtn').addEventListener('click', async () => { try { await Notification.requestPermission(); } catch (e) {} refreshNotifState(); });
  $('logoutBtn').addEventListener('click', () => { LS.del('token'); LS.del('creds'); token = null; showLogin(''); });
  document.addEventListener('pointerdown', ensureAudio, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); poll(); ensureAudio(); } });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // início
  if (token || LS.get('creds', null)) showApp(); else showLogin('');
})();
