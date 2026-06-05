'use strict';

let COLS = 14, ROWS = 10; const RLBLS = 'ABCDEFGHIJKLMNO';
let sb = null, me = null, userId = null, token = null;
let hives = [], insps = [];
let selId = null, dragId = null, pendX = null, pendY = null;
let editId = null, inspHiveId = null, inspEditId = null, aiTxt = '';
let delStep = 0, delTimer = null;
let expenses = [], members = [], materials = [];
let expEditId = null, matEditId = null;
let pollTimer = null;

// ── Supabase ──────────────────────────────────────────────────────────────────
async function initSB() {
  const cfg = await fetch('/api/config').then(r => r.json());
  if (!cfg.supabaseUrl) throw new Error('SUPABASE_URL ingurune-aldagaia falta da.');
  const { createClient } = supabase;
  sb = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  sb.auth.onAuthStateChange((_e, session) => { token = session?.access_token || null; });
}

async function boot() {
  try {
    await initSB();
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      me = session.user.user_metadata?.username || session.user.email.split('@')[0];
      userId = session.user.id;
      token = session.access_token;
      await enterApp();
    } else { showLogin(); }
  } catch (e) { showLogin(); toast('Konexio errorea: ' + e.message, 'bad'); }
  document.getElementById('loading').style.display = 'none';
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function showTab(t) {
  document.getElementById('tab-in').style.display = t === 'in' ? '' : 'none';
  document.getElementById('tab-up').style.display = t === 'up' ? '' : 'none';
  document.getElementById('tbin').classList.toggle('on', t === 'in');
  document.getElementById('tbup').classList.toggle('on', t === 'up');
}

async function doLogin() {
  const username = document.getElementById('liu').value.trim();
  const password = document.getElementById('lip').value;
  const er = document.getElementById('lie');
  er.textContent = '';
  if (!username) { er.textContent = 'Idatzi erabiltzaile izena.'; return; }
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email: `${username}@erlekide.local`, password });
    if (error) throw new Error('Erabiltzaile izena edo pasahitza okerrak.');
    me = data.user.user_metadata?.username || username;
    userId = data.user.id; token = data.session.access_token;
    await enterApp();
  } catch (e) { er.textContent = e.message; }
}

async function doReg() {
  const username = document.getElementById('ruu').value.trim();
  const password = document.getElementById('rup').value;
  const p2 = document.getElementById('rup2').value;
  const er = document.getElementById('rue');
  er.textContent = '';
  if (username.length < 2) { er.textContent = 'Erabiltzaile izenak gutxienez 2 karaktere behar ditu.'; return; }
  if (password.length < 6) { er.textContent = 'Pasahitzak gutxienez 6 karaktere behar ditu.'; return; }
  if (password !== p2) { er.textContent = 'Pasahitzak ez datoz bat.'; return; }
  try {
    const { data, error } = await sb.auth.signUp({
      email: `${username}@erlekide.local`, password,
      options: { data: { username } }
    });
    if (error) {
      throw new Error((error.message || '').toLowerCase().includes('already') || error.status === 422
        ? 'Erabiltzaile izen hori dagoeneko hartuta dago.'
        : error.message);
    }
    if (!data.session) {
      er.style.color = 'var(--honey-d)';
      er.textContent = 'Kontua sortuta. Saioa hasi beharko duzu.';
      return;
    }
    me = username; userId = data.user.id; token = data.session.access_token;
    await enterApp();
  } catch (e) { er.textContent = e.message; }
}

async function doLogout() {
  await sb.auth.signOut();
  me = userId = token = selId = null; hives = []; insps = [];
  clearInterval(pollTimer);
  document.getElementById('scr-app').style.display = 'none';
  showLogin();
}

function showLogin() {
  document.getElementById('scr-login').style.display = 'flex';
  document.getElementById('scr-app').style.display = 'none';
}

async function enterApp() {
  document.getElementById('scr-login').style.display = 'none';
  const app = document.getElementById('scr-app');
  app.style.display = 'flex';
  document.getElementById('ubadge').textContent = '👤 ' + me;
  if (window.innerWidth <= 700)
    document.getElementById('hdr-add-btn').style.display = 'inline-flex';
  await Promise.all([loadSettings(), loadHives(), loadMembers(), loadExpenses(), loadMaterials()]);
  buildGrid();
  renderAll();
  pollTimer = setInterval(async () => {
    await Promise.all([loadHives(), loadExpenses(), loadMaterials()]);
    renderAll();
    if (document.getElementById('view-gastuak').style.display !== 'none') renderExpenses();
    if (document.getElementById('view-materialak').style.display !== 'none') renderMaterials();
  }, 30000);
}

// ── Datuak ────────────────────────────────────────────────────────────────────
async function loadHives() {
  const { data, error } = await sb.from('hives').select('*').order('name');
  if (!error && data) hives = data;
}

async function loadInsps(hiveId) {
  const { data } = await sb.from('inspections').select('*')
    .eq('hive_id', hiveId).order('date', { ascending: false }).order('created_at', { ascending: false });
  insps = data || [];
}

// ── Konfigurazioa / Settings ──────────────────────────────────────────────────
async function loadSettings() {
  try {
    const { data } = await sb.from('settings').select('cols,rows').eq('id', 'main').maybeSingle();
    if (data) { COLS = Math.max(3, Math.min(20, data.cols || 14)); ROWS = Math.max(1, Math.min(15, data.rows || 10)); }
  } catch { /* use defaults 14×10 */ }
  updateHint();
}

function updateHint() {
  const el = document.getElementById('mhint');
  if (el) el.textContent = `Arrastatu erlauntzak mugitzeko · Sareta: ${COLS}×${ROWS} · ⚙ konfiguratu goiburuan`;
}

function openCfg() {
  document.getElementById('cfg-cols').value = COLS;
  document.getElementById('cfg-rows').value = ROWS;
  document.getElementById('cfg-cols-now').textContent = COLS;
  document.getElementById('cfg-rows-now').textContent = ROWS;
  const warn = document.getElementById('cfg-warn');
  warn.style.display = 'none'; warn.dataset.confirmed = '0';
  document.getElementById('cfg-save-btn').textContent = '✓ Gorde';
  openM('cfg');
}

async function saveSettings() {
  const newCols = Math.min(20, Math.max(3, +document.getElementById('cfg-cols').value || COLS));
  const newRows = Math.min(15, Math.max(1, +document.getElementById('cfg-rows').value || ROWS));
  const warn = document.getElementById('cfg-warn');

  const out = hives.filter(h => h.grid_x != null && h.grid_y != null && (h.grid_x >= newCols || h.grid_y >= newRows));

  if (out.length && warn.dataset.confirmed !== '1') {
    warn.innerHTML = `⚠️ ${out.length} erlauntz mapan kokatuta daude eremu berritik kanpo:<br><strong>${out.map(h => esc(h.name)).join(', ')}</strong><br>Posizioa ezabatuko zaie (erlauntzak bere horretan geratuko dira zerrendan). Berriro sakatu baieztatzeko.`;
    warn.style.display = '';
    warn.dataset.confirmed = '1';
    document.getElementById('cfg-save-btn').textContent = '⚠ Berretsi eta gorde';
    return;
  }

  for (const h of out) {
    await sb.from('hives').update({ grid_x: null, grid_y: null }).eq('id', h.id);
    h.grid_x = null; h.grid_y = null;
  }

  await sb.from('settings').upsert({ id: 'main', cols: newCols, rows: newRows });

  COLS = newCols; ROWS = newRows;
  closeM('cfg');
  updateHint();
  buildGrid();
  renderAll();
  toast(`Sareta ${COLS}×${ROWS} gordeta ✓`);
}

function buildGrid() {
  const g = document.getElementById('agrid');
  let h = '<div class="gcont"><div class="ghrow"><div class="gcorner"></div>';
  for (let c = 0; c < COLS; c++) h += `<div class="clbl">${c + 1}</div>`;
  h += '</div>';
  for (let r = 0; r < ROWS; r++) {
    h += `<div class="gbrow"><div class="rlbl">${RLBLS[r]}</div>`;
    for (let c = 0; c < COLS; c++)
      h += `<div class="cell" id="c${c}_${r}" ondragover="ov(event,${c},${r})" ondragleave="ol(event,${c},${r})" ondrop="od(event,${c},${r})" onclick="cc(${c},${r})"><div class="cempty">+</div></div>`;
    h += '</div>';
  }
  h += '</div>';
  g.innerHTML = h;
  // Necesitamos dos frames para que el navegador calcule el layout antes de medir
  requestAnimationFrame(() => requestAnimationFrame(applyMobileRotation));
}

function applyMobileRotation() {
  const agrid = document.getElementById('agrid');
  const gcont = agrid && agrid.querySelector('.gcont');
  if (!gcont) return;

  if (window.innerWidth > 700) {
    // Desktop: sin rotación
    gcont.style.cssText = '';
    agrid.style.position = '';
    agrid.style.width = '';
    agrid.style.height = '';
    agrid.style.margin = '';
    return;
  }

  const W = gcont.offsetWidth;
  const H = gcont.offsetHeight;
  if (!W || !H) return;

  // Escala: cabe todo el grid en pantalla
  const maxW = Math.max(1, window.innerWidth - 20);
  const maxH = Math.max(1, window.innerHeight - 120);
  const scale = Math.min(maxW / H, maxH / W);

  // Rotar 90° CW: columna 1 queda arriba, última abajo.
  // Tras rotate(90deg) el elemento va hacia la izquierda H*scale px,
  // así que lo compensamos con `left`.
  gcont.style.transformOrigin = 'top left';
  gcont.style.transform = `rotate(90deg) scale(${scale})`;
  gcont.style.position = 'absolute';
  gcont.style.top = '0';
  gcont.style.left = H * scale + 'px';

  // El contenedor adopta las dimensiones visuales tras la rotación
  agrid.style.position = 'relative';
  agrid.style.width = H * scale + 'px';
  agrid.style.height = W * scale + 'px';
  agrid.style.margin = 'auto';
}

function renderAll() { renderGrid(); renderSB(); }

function renderGrid() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const el = document.getElementById(`c${c}_${r}`);
      if (el) el.innerHTML = '<div class="cempty">+</div>';
    }
  hives.forEach(h => {
    if (h.grid_x == null || h.grid_y == null) return;
    const el = document.getElementById(`c${h.grid_x}_${h.grid_y}`);
    if (!el) return;
    el.innerHTML = `<div class="tok st-${h.status}" id="t${h.id}" draggable="true"
      style="--tok-w:${h.frames != null ? (0.5 + (h.frames - 5) * 0.08).toFixed(2) : 0.85}"
      ondragstart="ds(event,'${h.id}')" ondragend="de(event,'${h.id}')"
      onclick="tc(event,'${h.id}')">
      <div class="troof"></div>
      <div class="tbody">
        <span class="tbody-bee">🐝</span>
        ${h.frames != null ? `<span class="tframes">${h.frames}mk</span>` : ''}
      </div>
      <div class="tname">${esc(h.name)}</div>
    </div>`;
  });
}

function renderSB() {
  const hl = document.getElementById('hl');
  if (!hives.length) {
    hl.innerHTML = '<div class="empty-st"><span class="ei">🐝</span>Oraindik erlauntzik ez.<br>Egin klik mapan gehitzeko.</div>';
    document.getElementById('sbfoot').innerHTML = ''; return;
  }
  hl.innerHTML = hives.map(h => {
    const pos = h.grid_x != null ? `${RLBLS[h.grid_y]}${h.grid_x + 1}` : '—';
    return `<div class="hli ${selId === h.id ? 'on' : ''}" onclick="selHive('${h.id}')">
      <div class="sdot ${h.status[0]}"></div>
      <span class="hln">${esc(h.name)}</span>
      <span class="hpos">${pos}</span>
    </div>`;
  }).join('');
  const g = hives.filter(h => h.status === 'good').length;
  const w = hives.filter(h => h.status === 'warn').length;
  const b = hives.filter(h => h.status === 'bad').length;
  document.getElementById('sbfoot').innerHTML =
    `<span style="color:var(--good)">● ${g} on</span> &nbsp;<span style="color:var(--warn)">● ${w} kontuz</span> &nbsp;<span style="color:var(--bad)">● ${b} kritiko</span>`;
}

// ── Detail modal ──────────────────────────────────────────────────────────────
async function renderDP(id) {
  const h = hives.find(x => x.id === id);
  if (!h) return;
  await loadInsps(id);
  const pos = h.grid_x != null ? `${RLBLS[h.grid_y]}${h.grid_x + 1} posizioa` : 'Mapan kokatu gabe';
  const stL = { good: 'Ona', warn: 'Kontuz', bad: 'Kritikoa' };
  const stC = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' };
  document.getElementById('mod-dp-content').innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px">
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700">${esc(h.name)}</div>
        <div style="font-size:11px;color:var(--bark-l);margin-top:2px;line-height:1.55">${esc(h.type)} · ${esc(h.race)}<br>${pos}</div>
      </div>
      <button class="mclose" onclick="closeM('dp')">✕</button>
    </div>
    <div class="strow">
      <div class="mstat"><div class="n" style="color:${stC[h.status]};font-size:14px">${stL[h.status]}</div><div class="l">Egoera</div></div>
      <div class="mstat"><div class="n">${insps.length}</div><div class="l">Inspekzioak</div></div>
      <div class="mstat"><div class="n" style="font-size:13px">${h.frames != null ? h.frames + 'mk' : '—'}</div><div class="l">Markoak</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn primary" style="flex:1" onclick="closeM('dp');openInsp('${h.id}')">＋ Inspekzioa</button>
      <button class="btn" onclick="closeM('dp');openEdit('${h.id}')">✎ Editatu</button>
    </div>
    ${h.notes ? `<div style="font-size:12px;color:var(--bark-m);background:var(--cream);padding:8px 10px;border-radius:8px;margin-bottom:12px;line-height:1.6">${esc(h.notes)}</div>` : ''}
    <div class="sec-title">Inspekzio historia</div>
    ${insps.length ? insps.slice(0, 15).map(i => `
      <div class="icard">
        <div class="ichdr">
          <span class="idate">${i.date}</span>
          <span class="iusr">${esc(i.username)}</span>
          <button class="icon-btn" style="margin-left:auto" onclick="openEditInsp('${i.id}')">✎ Editatu</button>
        </div>
        <div style="color:var(--bark);line-height:1.55">${esc(i.notes) || '<em style="color:var(--bark-l)">Oharrik gabe</em>'}</div>
        <div class="ichips">
          <span class="chip">💪 ${i.strength}/10</span>
          <span class="chip">🍯 ${i.honey} mko.</span>
          <span class="chip">👑 ${i.queen === 'yes' ? 'Ikusi' : i.queen === 'signs' ? 'Aztarnak' : 'Ez aurkitua'}</span>
          ${i.varroa !== 'unknown' ? `<span class="chip ${i.varroa === 'high' ? 'bad' : ''}">Varroa: ${i.varroa === 'low' ? 'Baxua' : i.varroa === 'med' ? 'Ertaina' : 'Altua'}</span>` : ''}
        </div>
        ${i.ai_summary ? `<div class="ainote"><div class="ainote-lbl">✦ IA ANALISIA</div>${esc(i.ai_summary)}</div>` : ''}
      </div>`).join('') :
      '<div style="font-size:12px;color:var(--bark-l)">Oraindik ez du inspekziorik.</div>'}
  `;
  openM('dp');
}

function selHive(id) { selId = id; renderSB(); renderDP(id); }

// ── Drag & Drop ───────────────────────────────────────────────────────────────
function ds(e, id) { dragId = id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => document.getElementById('t' + id)?.classList.add('drag'), 0); }
function de(e, id) { document.getElementById('t' + id)?.classList.remove('drag'); dragId = null; }
function ov(e, x, y) { if (!dragId) return; e.preventDefault(); document.getElementById(`c${x}_${y}`)?.classList.add('dov'); }
function ol(e, x, y) { document.getElementById(`c${x}_${y}`)?.classList.remove('dov'); }

async function od(e, x, y) {
  e.preventDefault();
  document.getElementById(`c${x}_${y}`)?.classList.remove('dov');
  if (!dragId) return;
  const occ = hives.find(h => h.grid_x === x && h.grid_y === y && h.id !== dragId);
  if (occ) { toast(`${occ.name}ek hartuta`, 'warn'); dragId = null; return; }
  const hive = hives.find(h => h.id === dragId);
  if (!hive) return;
  const [px, py] = [hive.grid_x, hive.grid_y];
  hive.grid_x = x; hive.grid_y = y; renderGrid();
  const { error } = await sb.from('hives').update({ grid_x: x, grid_y: y }).eq('id', dragId);
  if (error) { hive.grid_x = px; hive.grid_y = py; renderGrid(); toast(error.message, 'bad'); }
  else toast(`${hive.name} → ${RLBLS[y]}${x + 1}`);
  dragId = null;
}

function cc(x, y) {
  const occ = hives.find(h => h.grid_x === x && h.grid_y === y);
  if (occ) selHive(occ.id); else openAddModal(x, y);
}
function tc(e, id) { e.stopPropagation(); selHive(id); }

// ── Modalak ───────────────────────────────────────────────────────────────────
function openM(n) { document.getElementById('mod-' + n).style.display = 'flex'; }
function closeM(n) { document.getElementById('mod-' + n).style.display = 'none'; }

// ── Kokapena hautatzeko (position selects) ────────────────────────────────────
function fillPosSelects(rowSelId, colSelId, selX, selY) {
  let rh = '<option value="">— (kokatu gabe)</option>';
  for (let r = 0; r < ROWS; r++) rh += `<option value="${r}">${RLBLS[r]}</option>`;
  let ch = '<option value="">—</option>';
  for (let c = 0; c < COLS; c++) ch += `<option value="${c}">${c + 1}</option>`;
  const rs = document.getElementById(rowSelId), cs = document.getElementById(colSelId);
  rs.innerHTML = rh; cs.innerHTML = ch;
  rs.value = selY != null ? String(selY) : '';
  cs.value = selX != null ? String(selX) : '';
}

function readPosSelects(rowSelId, colSelId, ignoreId) {
  const rv = document.getElementById(rowSelId).value;
  const cv = document.getElementById(colSelId).value;
  if (rv === '' || cv === '') return { ok: true, x: null, y: null };
  const x = +cv, y = +rv;
  const occ = hives.find(h => h.grid_x === x && h.grid_y === y && h.id !== ignoreId);
  if (occ) { toast(`${occ.name}ek hartuta dago posizio hori`, 'warn'); return { ok: false }; }
  return { ok: true, x, y };
}

function openAddModal(x, y) {
  pendX = x; pendY = y;
  ['ahn', 'ahno'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('ahf').value = '';
  document.getElementById('ahd').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ahs').value = 'good';
  const pi = document.getElementById('ahpos');
  if (x != null) { pi.textContent = `📍 ${RLBLS[y]}${x + 1} posizioan kokatuko da`; pi.style.display = ''; }
  else pi.style.display = 'none';
  fillPosSelects('ahpy', 'ahpx', x, y);
  openM('ah');
}

async function saveHive() {
  const name = document.getElementById('ahn').value.trim();
  if (!name) { toast('Idatzi izen bat', 'warn'); return; }
  const rawF = document.getElementById('ahf').value;
  const frames = rawF === '' ? null : Math.min(10, Math.max(5, +rawF));
  const pos = readPosSelects('ahpy', 'ahpx', null);
  if (!pos.ok) return;
  const { data, error } = await sb.from('hives').insert({
    name, type: document.getElementById('aht').value, race: document.getElementById('ahr').value,
    status: document.getElementById('ahs').value, color: document.getElementById('ahc').value,
    install_date: document.getElementById('ahd').value || null,
    notes: document.getElementById('ahno').value,
    frames, grid_x: pos.x, grid_y: pos.y, created_by: userId
  }).select().single();
  if (error) { toast(error.message, 'bad'); return; }
  hives.push(data); hives.sort((a, b) => a.name.localeCompare(b.name));
  closeM('ah'); renderAll(); selHive(data.id); toast(`${name} sortuta ✓`);
}

function openEdit(id) {
  editId = id; const h = hives.find(x => x.id === id); if (!h) return;
  document.getElementById('ehn').value = h.name;
  document.getElementById('eht').value = h.type;
  document.getElementById('ehr').value = h.race;
  document.getElementById('ehs').value = h.status;
  document.getElementById('ehf').value = h.frames ?? '';
  document.getElementById('ehc').value = h.color || '#C8780A';
  document.getElementById('ehno').value = h.notes || '';
  fillPosSelects('ehpy', 'ehpx', h.grid_x, h.grid_y);
  resetDelBtn();
  openM('eh');
}

async function updHive() {
  const h = hives.find(x => x.id === editId); if (!h) return;
  const rawF = document.getElementById('ehf').value;
  const frames = rawF === '' ? null : Math.min(10, Math.max(5, +rawF));
  const pos = readPosSelects('ehpy', 'ehpx', editId);
  if (!pos.ok) return;
  const upd = {
    name: document.getElementById('ehn').value.trim() || h.name,
    type: document.getElementById('eht').value,
    race: document.getElementById('ehr').value,
    status: document.getElementById('ehs').value,
    color: document.getElementById('ehc').value,
    notes: document.getElementById('ehno').value,
    frames,
    grid_x: pos.x, grid_y: pos.y
  };
  const { error } = await sb.from('hives').update(upd).eq('id', editId);
  if (error) { toast(error.message, 'bad'); return; }
  Object.assign(h, upd); closeM('eh'); renderAll();
  if (selId === editId) renderDP(editId);
  toast('Erlaunutza eguneratuta ✓');
}

function stepDelete() {
  const btn = document.getElementById('btn-del');
  const warn = document.getElementById('del-warn');
  if (delStep === 0) {
    delStep = 1;
    warn.style.display = '';
    btn.textContent = '⚠ Berretsi ezabatzea';
    btn.style.cssText = 'background:var(--bad);border-color:var(--bad);color:#fff';
    delTimer = setTimeout(resetDelBtn, 4000);
  } else {
    clearTimeout(delTimer);
    delHive();
  }
}

function resetDelBtn() {
  delStep = 0;
  clearTimeout(delTimer);
  const btn = document.getElementById('btn-del');
  const warn = document.getElementById('del-warn');
  if (btn) { btn.textContent = '🗑 Ezabatu'; btn.style.cssText = ''; }
  if (warn) warn.style.display = 'none';
}

async function delHive() {
  const { error } = await sb.from('hives').delete().eq('id', editId);
  if (error) { toast(error.message, 'bad'); return; }
  hives = hives.filter(h => h.id !== editId);
  closeM('eh'); closeM('dp'); selId = null; renderAll(); toast('Erlaunutza ezabatuta');
}

function openInsp(hiveId) {
  inspHiveId = hiveId; inspEditId = null; aiTxt = '';
  document.getElementById('ai-modal-title').innerHTML = 'Inspekzio berria <button class="mclose" onclick="closeM(\'ai\')">✕</button>';
  document.getElementById('aid').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ais').value = '7';
  document.getElementById('aib').value = '6';
  document.getElementById('aim').value = '4';
  document.getElementById('aiq').value = 'yes';
  document.getElementById('aiv').value = 'low';
  document.getElementById('aist').value = 'good';
  document.getElementById('aino').value = '';
  document.getElementById('aibox-wrap').innerHTML = '';
  const btn = document.getElementById('btn-ai'); btn.innerHTML = '✦ IArekin aztertu'; btn.disabled = false;
  openM('ai');
}

function openEditInsp(inspId) {
  const i = insps.find(x => x.id === inspId); if (!i) return;
  inspHiveId = i.hive_id; inspEditId = inspId; aiTxt = i.ai_summary || '';
  document.getElementById('ai-modal-title').innerHTML = 'Inspekzioa editatu <button class="mclose" onclick="closeM(\'ai\')">✕</button>';
  document.getElementById('aid').value = i.date;
  document.getElementById('ais').value = i.strength;
  document.getElementById('aib').value = i.brood;
  document.getElementById('aim').value = i.honey;
  document.getElementById('aiq').value = i.queen;
  document.getElementById('aiv').value = i.varroa;
  document.getElementById('aist').value = i.status;
  document.getElementById('aino').value = i.notes || '';
  document.getElementById('aibox-wrap').innerHTML = i.ai_summary
    ? `<div class="aibox"><div class="aibox-lbl">✦ IA ANALISIA (gordeta)</div>${esc(i.ai_summary)}</div>` : '';
  const btn = document.getElementById('btn-ai'); btn.innerHTML = '✦ IArekin aztertu'; btn.disabled = false;
  openM('ai');
}

async function runAI() {
  const h = hives.find(x => x.id === inspHiveId);
  const btn = document.getElementById('btn-ai');
  btn.innerHTML = '<span class="spin"></span> Aztertzen...'; btn.disabled = true;
  const prompt = `Erlazain esperta zara. Ikuskaritza hau aztertu eta 2-3 gomendio zehatz eta praktiko eman itzazu euskaraz (gehienez 90 hitz).
Erlaunutza: ${h ? h.name : ''} (${h ? h.type : ''}, ${h ? h.race : ''})
Indarra: ${document.getElementById('ais').value}/10 · Hazkuntza: ${document.getElementById('aib').value} · Eztia: ${document.getElementById('aim').value}
Erregina: ${document.getElementById('aiq').value} · Varroa: ${document.getElementById('aiv').value}
Behaketak: ${document.getElementById('aino').value || 'bat ere ez'}`;
  try {
    const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ prompt }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'AI errorea');
    aiTxt = d.text;
    document.getElementById('aibox-wrap').innerHTML = `<div class="aibox"><div class="aibox-lbl">✦ IA GOMENDIAK</div>${esc(aiTxt)}</div>`;
  } catch (e) {
    document.getElementById('aibox-wrap').innerHTML = `<div style="font-size:11px;color:var(--bad);margin-top:8px">${esc(e.message)}</div>`;
  }
  btn.innerHTML = '✦ IArekin aztertu'; btn.disabled = false;
}

async function saveInsp() {
  if (!inspHiveId) return;
  const status = document.getElementById('aist').value;
  const payload = {
    date: document.getElementById('aid').value,
    strength: +document.getElementById('ais').value,
    brood: +document.getElementById('aib').value,
    honey: +document.getElementById('aim').value,
    queen: document.getElementById('aiq').value,
    varroa: document.getElementById('aiv').value,
    status,
    notes: document.getElementById('aino').value,
    ai_summary: aiTxt
  };

  let error;
  if (inspEditId) {
    ({ error } = await sb.from('inspections').update(payload).eq('id', inspEditId));
  } else {
    ({ error } = await sb.from('inspections').insert({
      ...payload, hive_id: inspHiveId, username: me, created_by: userId
    }));
  }
  if (error) { toast(error.message, 'bad'); return; }

  await sb.from('hives').update({ status }).eq('id', inspHiveId);
  const h = hives.find(x => x.id === inspHiveId); if (h) h.status = status;
  closeM('ai'); renderAll();
  if (selId === inspHiveId) await renderDP(inspHiveId);
  toast(inspEditId ? 'Inspekzioa eguneratuta ✓' : 'Inspekzioa gordeta ✓');
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function toast(msg, t = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = t === 'bad' ? 'var(--bad)' : t === 'warn' ? 'var(--warn)' : 'var(--bark)';
  el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Ikuspegia aldatu / Switch main view ──────────────────────────────────────
function setMainView(v) {
  const views = ['map', 'gastuak', 'materialak'];
  views.forEach(n => {
    const el = document.getElementById('view-' + n);
    if (el) el.style.display = n === v ? 'flex' : 'none';
  });
  document.querySelectorAll('.mnav').forEach((b, i) => b.classList.toggle('on', views[i] === v));
  const sidebar = document.getElementById('sb');
  if (sidebar) sidebar.style.display = v === 'map' ? '' : 'none';
  if (v === 'gastuak') renderExpenses();
  if (v === 'materialak') renderMaterials();
}

// ── Datuak kargatu / Load data ────────────────────────────────────────────────
async function loadExpenses() {
  const { data } = await sb.from('expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  expenses = data || [];
}
async function loadMembers() {
  const { data } = await sb.from('members').select('*').order('name');
  members = data || [];
}
async function loadMaterials() {
  const { data } = await sb.from('materials').select('*').order('category').order('name');
  materials = data || [];
}

// ── Tricount algoritmoa / Debt calculation ────────────────────────────────────
function calcDebts() {
  const N = members.length;
  if (!N || !expenses.length) return { balances: {}, transactions: [] };
  const bal = {};
  members.forEach(m => bal[m.name] = 0);
  expenses.forEach(exp => {
    const share = exp.amount / N;
    bal[exp.paid_by] = (bal[exp.paid_by] || 0) + Number(exp.amount);
    members.forEach(m => { bal[m.name] = (bal[m.name] || 0) - share; });
  });
  const cred = Object.entries(bal).filter(([, v]) => v > 0.005).map(([k, v]) => ({ n: k, v })).sort((a, b) => b.v - a.v);
  const debt = Object.entries(bal).filter(([, v]) => v < -0.005).map(([k, v]) => ({ n: k, v: -v })).sort((a, b) => b.v - a.v);
  const txns = [];
  let ci = 0, di = 0;
  while (ci < cred.length && di < debt.length) {
    const amt = Math.min(cred[ci].v, debt[di].v);
    txns.push({ from: debt[di].n, to: cred[ci].n, amt: Math.round(amt * 100) / 100 });
    cred[ci].v -= amt; debt[di].v -= amt;
    if (cred[ci].v < 0.005) ci++;
    if (debt[di].v < 0.005) di++;
  }
  return { balances: bal, transactions: txns };
}

// ── Gastuak errendatu / Render expenses ──────────────────────────────────────
function renderExpenses() {
  const { balances, transactions } = calcDebts();
  let html = '';

  html += '<div style="margin-bottom:16px">';
  html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--bark-l);margin-bottom:8px">Saldoak</div>';
  if (!members.length) {
    html += '<div style="font-size:13px;color:var(--bark-l);padding:10px;background:#fff;border:1px solid var(--border);border-radius:10px">Ez dago soziorik. Gehitu sozioak 👥 botoiarekin.</div>';
  } else {
    html += '<div class="balance-grid">';
    members.forEach(m => {
      const bal = balances[m.name] || 0;
      const color = bal > 0.5 ? 'var(--good)' : bal < -0.5 ? 'var(--bad)' : 'var(--bark-l)';
      const lbl = bal > 0.5 ? 'besteak zor diote' : bal < -0.5 ? 'zor du' : 'kitto';
      html += `<div class="bal-card"><div class="bal-name">${esc(m.name)}</div><div class="bal-amt" style="color:${color}">${bal >= 0 ? '+' : ''}${bal.toFixed(2)}€</div><div class="bal-lbl">${lbl}</div></div>`;
    });
    html += '</div>';
  }
  html += '</div>';

  if (transactions.length) {
    html += '<div style="margin-bottom:16px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--bark-l);margin-bottom:8px">Kitapena (beharrezko transferentziak)</div>';
    html += '<div class="txn-box">';
    transactions.forEach(t => {
      html += `<div class="txn-item"><span class="txn-from">${esc(t.from)}</span><span class="txn-arr">→</span><span class="txn-to">${esc(t.to)}</span><span class="txn-amt">${t.amt.toFixed(2)}€</span></div>`;
    });
    html += '</div></div>';
  } else if (members.length && expenses.length) {
    html += '<div style="font-size:12px;color:var(--good);background:var(--good-bg);border:1px solid rgba(30,107,64,.2);border-radius:8px;padding:8px 11px;margin-bottom:14px">✓ Denek kitto daude</div>';
  }

  html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--bark-l);margin-bottom:8px">Gastu historia (' + expenses.length + ')</div>';
  if (!expenses.length) {
    html += '<div style="font-size:13px;color:var(--bark-l);text-align:center;padding:20px">Oraindik ez dago gasturik</div>';
  } else {
    expenses.forEach(e => {
      const total = Number(e.amount).toFixed(2);
      html += `<div class="exp-item">
        <div class="exp-body">
          <div class="exp-desc">${esc(e.description)}</div>
          <div class="exp-meta">${e.date} · <span class="paid-chip">${esc(e.paid_by)}</span>${e.notes ? ' · ' + esc(e.notes) : ''}</div>
        </div>
        <div class="exp-amt">${total}€</div>
        <button class="exp-del" onclick="deleteExp('${e.id}')" title="Ezabatu">🗑</button>
      </div>`;
    });
  }

  document.getElementById('exp-balances').innerHTML = '';
  document.getElementById('exp-list').innerHTML = html;
}

// ── Gastu CRUD ────────────────────────────────────────────────────────────────
function openAddExp() {
  document.getElementById('exp-modal-title').innerHTML = `Gastu berria <button class="mclose" onclick="closeM('exp')">✕</button>`;
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-amt').value = '';
  document.getElementById('exp-notes').value = '';
  document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
  const sel = document.getElementById('exp-payer');
  sel.innerHTML = members.length
    ? members.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('')
    : `<option value="${esc(me)}">${esc(me)}</option>`;
  expEditId = null;
  openM('exp');
}

async function saveExp() {
  const description = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amt').value);
  const paid_by = document.getElementById('exp-payer').value;
  const date = document.getElementById('exp-date').value;
  const notes = document.getElementById('exp-notes').value;
  if (!description) { toast('Idatzi deskribapena', 'warn'); return; }
  if (!amount || amount <= 0) { toast('Sartu zenbateko baliogarri bat', 'warn'); return; }
  const { error } = await sb.from('expenses').insert({ description, amount, paid_by, date, notes, created_by: userId });
  if (error) { toast(error.message, 'bad'); return; }
  await loadExpenses();
  closeM('exp'); renderExpenses(); toast('Gastua gordeta ✓');
}

async function deleteExp(id) {
  if (!confirm('Gastua ezabatu nahi duzu?')) return;
  const { error } = await sb.from('expenses').delete().eq('id', id);
  if (error) { toast(error.message, 'bad'); return; }
  await loadExpenses(); renderExpenses(); toast('Gastua ezabatuta');
}

// ── Sozioak CRUD / Members ────────────────────────────────────────────────────
function openMembers() {
  renderMembersList();
  document.getElementById('mbr-name').value = '';
  openM('members');
}

function renderMembersList() {
  const el = document.getElementById('members-list');
  if (!members.length) { el.innerHTML = '<div style="font-size:12px;color:var(--bark-l);padding:6px 0">Oraindik soziorik ez.</div>'; return; }
  el.innerHTML = members.map(m =>
    `<div class="member-row"><span>${esc(m.name)}</span><button class="member-del" onclick="deleteMember('${m.id}')" title="Ezabatu">✕</button></div>`
  ).join('');
}

async function addMember() {
  const name = document.getElementById('mbr-name').value.trim();
  if (!name) return;
  const { error } = await sb.from('members').insert({ name });
  if (error) { toast(error.message, 'bad'); return; }
  await loadMembers();
  document.getElementById('mbr-name').value = '';
  renderMembersList();
  toast(`${name} gehituta ✓`);
}

async function deleteMember(id) {
  const m = members.find(x => x.id === id);
  if (!confirm(`"${m?.name}" sozioa ezabatu nahi duzu?`)) return;
  const { error } = await sb.from('members').delete().eq('id', id);
  if (error) { toast(error.message, 'bad'); return; }
  await loadMembers(); renderMembersList();
  toast('Sozioa ezabatuta');
}

// ── Materialak CRUD ──────────────────────────────────────────────────────────
const MAT_ICONS = { kaxak: '📦', jantziak: '🥼', tresnak: '🔧', bestelakoa: '📋' };
const MAT_LABELS = { kaxak: 'Kaxak', jantziak: 'Jantziak', tresnak: 'Tresnak', bestelakoa: 'Bestelakoa' };

function renderMaterials() {
  const cats = ['kaxak', 'jantziak', 'tresnak', 'bestelakoa'];
  let html = '';
  cats.forEach(cat => {
    const items = materials.filter(m => m.category === cat);
    html += `<div class="mat-cat">
      <div class="mat-cat-hdr">${MAT_ICONS[cat]} ${MAT_LABELS[cat]} <span class="mat-cat-count">${items.length}</span></div>`;
    if (!items.length) {
      html += `<div style="font-size:12px;color:var(--bark-l);padding:4px 2px">Ez dago materialik kategoria honetan.</div>`;
    } else {
      items.forEach(m => {
        html += `<div class="mat-item">
          <div class="mat-body">
            <div class="mat-name">${esc(m.name)}</div>
            ${m.notes ? `<div class="mat-notes">${esc(m.notes)}</div>` : ''}
          </div>
          <div class="mat-qty">×${m.quantity}</div>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" onclick="openEditMat('${m.id}')">✎</button>
            <button class="icon-btn del" onclick="deleteMat('${m.id}')">🗑</button>
          </div>
        </div>`;
      });
    }
    html += '</div>';
  });
  document.getElementById('mat-list').innerHTML = html;
}

function openAddMat() {
  matEditId = null;
  document.getElementById('mat-modal-title').innerHTML = `Material berria <button class="mclose" onclick="closeM('mat')">✕</button>`;
  document.getElementById('mat-name').value = '';
  document.getElementById('mat-cat').value = 'kaxak';
  document.getElementById('mat-qty').value = '1';
  document.getElementById('mat-notes').value = '';
  openM('mat');
}

function openEditMat(id) {
  const m = materials.find(x => x.id === id); if (!m) return;
  matEditId = id;
  document.getElementById('mat-modal-title').innerHTML = `Materiala editatu <button class="mclose" onclick="closeM('mat')">✕</button>`;
  document.getElementById('mat-name').value = m.name;
  document.getElementById('mat-cat').value = m.category;
  document.getElementById('mat-qty').value = m.quantity;
  document.getElementById('mat-notes').value = m.notes || '';
  openM('mat');
}

async function saveMat() {
  const name = document.getElementById('mat-name').value.trim();
  const category = document.getElementById('mat-cat').value;
  const quantity = Math.max(0, parseInt(document.getElementById('mat-qty').value) || 0);
  const notes = document.getElementById('mat-notes').value;
  if (!name) { toast('Idatzi izena', 'warn'); return; }
  const payload = { name, category, quantity, notes };
  const { error } = matEditId
    ? await sb.from('materials').update(payload).eq('id', matEditId)
    : await sb.from('materials').insert({ ...payload, created_by: userId });
  if (error) { toast(error.message, 'bad'); return; }
  await loadMaterials();
  closeM('mat'); renderMaterials(); toast(matEditId ? 'Materiala eguneratuta ✓' : 'Materiala gordeta ✓');
}

async function deleteMat(id) {
  const m = materials.find(x => x.id === id);
  if (!confirm(`"${m?.name}" ezabatu nahi duzu?`)) return;
  const { error } = await sb.from('materials').delete().eq('id', id);
  if (error) { toast(error.message, 'bad'); return; }
  await loadMaterials(); renderMaterials(); toast('Materiala ezabatuta');
}

window.addEventListener('resize', () => {
  if (document.getElementById('agrid').querySelector('.gcont')) applyMobileRotation();
});

boot();
