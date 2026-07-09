'use strict';

let COLS = 14, ROWS = 10; const RLBLS = 'ABCDEFGHIJKLMNO';
let sb = null, me = null, userId = null, token = null;
let hives = [], insps = [];
let selId = null, dragId = null, moveId = null, pendX = null, pendY = null;
let saving = false;
let editId = null, inspHiveId = null, inspEditId = null, aiTxt = '';
let delStep = 0, delTimer = null;
let expenses = [], members = [], materials = [];
let expEditId = null, matEditId = null;
let velutinas = [], velTimers = [];
let pollTimer = null;
// ── Proiektuak / Proyectos ──
let projectId = null, projects = [], myRole = 'viewer', projMembers = [];
let pdelStep = 0, pdelTimer = null;
const canEdit = () => myRole === 'owner' || myRole === 'editor';
const isOwner = () => myRole === 'owner';

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
  me = userId = token = selId = projectId = null;
  hives = []; insps = []; projects = []; projMembers = []; myRole = 'viewer';
  velutinas = []; clearVelutinas();
  document.body.classList.remove('viewer');
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
  initSky();
  await loadProjects();
  if (!projects.length) { showFirstProject(); return; }
  const saved = localStorage.getItem('erlekide.project');
  const p = projects.find(x => x.id === saved) || projects[0];
  await selectProject(p.id);
}

// ── Proiektuak kargatu/aukeratu / Cargar y seleccionar proyectos ───────────────
async function loadProjects() {
  const { data } = await sb.from('project_members').select('role, projects(*)').eq('user_id', userId);
  projects = (data || [])
    .filter(r => r.projects)
    .map(r => ({ ...r.projects, role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function selectProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  projectId = id; myRole = p.role;
  localStorage.setItem('erlekide.project', id);
  clampGrid(p.cols, p.rows);
  selId = null; moveId = null;
  clearInterval(pollTimer);
  await Promise.all([loadHives(), loadMembers(), loadExpenses(), loadMaterials(), loadVelutinas()]);
  renderProjectBar();
  renderVelBtn();
  applyRoleUI();
  if (window.innerWidth <= 700 && canEdit())
    document.getElementById('hdr-add-btn').style.display = 'inline-flex';
  buildGrid();
  renderAll();
  setMainView('map');
  pollTimer = setInterval(async () => {
    const pv = velCount();
    await Promise.all([loadHives(), loadExpenses(), loadMaterials(), loadVelutinas()]);
    renderAll();
    renderVelBtn();
    if (velCount() !== pv) renderVelutinas();
    if (document.getElementById('view-gastuak').style.display !== 'none') renderExpenses();
    if (document.getElementById('view-materialak').style.display !== 'none') renderMaterials();
  }, 30000);
}

function clampGrid(c, r) {
  COLS = Math.max(3, Math.min(20, c || 14));
  ROWS = Math.max(1, Math.min(15, r || 10));
}

async function switchProject(id) {
  if (id === projectId) { closeM('proj'); return; }
  closeM('proj');
  await selectProject(id);
  toast(`${projects.find(p => p.id === id)?.name || ''} ✓`);
}

// ── Proiektu-barra goiburuan / Barra de proyecto en la cabecera ────────────────
function renderProjectBar() {
  const cur = projects.find(p => p.id === projectId);
  const el = document.getElementById('proj-name');
  if (el && cur) el.textContent = cur.name;
}

// ── Lehen proiektua sortu (erabiltzaile berria) / Crear el primer proyecto ─────
function showFirstProject() {
  document.getElementById('fp-name').value = me ? `${me} erlategia` : '';
  document.getElementById('fp-err').textContent = '';
  openM('fp');
}

async function createFirstProject() {
  const name = document.getElementById('fp-name').value.trim();
  const er = document.getElementById('fp-err');
  if (name.length < 2) { er.textContent = 'Idatzi proiektuaren izena (gutxienez 2 karaktere).'; return; }
  const ok = await doCreateProject(name);
  if (ok) closeM('fp');
}

async function doCreateProject(name) {
  const { data, error } = await sb.rpc('create_project', { p_name: name });
  if (error) { toast(error.message, 'bad'); return false; }
  const row = Array.isArray(data) ? data[0] : data;
  await loadProjects();
  await selectProject(row.id);
  toast(`«${row.name}» sortuta ✓`);
  return true;
}

async function joinProject() {
  const code = document.getElementById('join-code').value.trim();
  const er = document.getElementById('join-err');
  er.textContent = '';
  if (code.length < 4) { er.textContent = 'Idatzi gonbidapen-kodea.'; return; }
  const { data, error } = await sb.rpc('join_project', { p_code: code });
  if (error) { er.textContent = 'Kode baliogabea.'; return; }
  const row = Array.isArray(data) ? data[0] : data;
  closeM('join'); closeM('proj'); closeM('fp');
  await loadProjects();
  await selectProject(row.id);
  toast(`«${row.name}» proiektura batu zara ✓`);
}

// ── Rol-aren araberako UI / UI según el rol (viewer = solo lectura) ────────────
function applyRoleUI() {
  const ed = canEdit();
  document.body.classList.toggle('viewer', !ed);
  const addBtn = document.getElementById('hdr-add-btn');
  if (addBtn && (!ed || window.innerWidth > 700)) addBtn.style.display = 'none';
}

// ── Proiektua kudeatu / Gestionar proyecto (modal) ────────────────────────────
function roleLabel(r) { return r === 'owner' ? 'Jabea' : r === 'editor' ? 'Editorea' : 'Ikuslea'; }

async function loadProjMembers() {
  const { data } = await sb.from('project_members').select('user_id, role, username').eq('project_id', projectId);
  projMembers = (data || []).sort((a, b) => (a.role === 'owner' ? -1 : 1) - (b.role === 'owner' ? -1 : 1));
}

async function openProj() {
  if (projectId) await loadProjMembers();
  renderProj();
  openM('proj');
}

function openNewProject() {
  closeM('proj');
  document.getElementById('fp-name').value = '';
  document.getElementById('fp-err').textContent = '';
  document.getElementById('fp-cancel').style.display = '';
  openM('fp');
}

function openJoin() {
  closeM('proj');
  document.getElementById('join-code').value = '';
  document.getElementById('join-err').textContent = '';
  openM('join');
}

function renderProj() {
  const cur = projects.find(p => p.id === projectId);
  const owner = isOwner();
  let h = '<div class="sec-title">Zure proiektuak</div><div class="proj-list">';
  projects.forEach(p => {
    h += `<button class="proj-row ${p.id === projectId ? 'on' : ''}" onclick="switchProject('${p.id}')">
      <span class="proj-row-name">${esc(p.name)}</span>
      <span class="proj-row-role">${roleLabel(p.role)}</span>
    </button>`;
  });
  h += '</div><div style="display:flex;gap:7px;margin:10px 0 4px">'
    + '<button class="btn sm" style="flex:1" onclick="openNewProject()">＋ Proiektu berria</button>'
    + '<button class="btn sm" style="flex:1" onclick="openJoin()">🔑 Kodearekin batu</button></div>';

  if (cur) {
    h += '<hr class="proj-hr">';
    if (owner) {
      h += `<div class="sec-title">Proiektua</div>
      <div style="display:flex;gap:7px;margin-bottom:14px">
        <input id="proj-rename" value="${esc(cur.name)}" style="flex:1">
        <button class="btn sm" onclick="doRename()">Izena</button>
      </div>
      <div class="sec-title">Gonbidapen-kodea</div>
      <div style="font-size:11px;color:var(--bark-l);margin-bottom:7px;line-height:1.55">Partekatu kode hau norbaitek proiektura batzeko. Ikusle gisa sartuko da; ondoren editore bihur dezakezu.</div>
      <div class="code-box">
        <span class="code-val" id="code-val">${esc(cur.join_code || '——')}</span>
        <button class="btn sm" onclick="copyCode()">📋 Kopiatu</button>
        <button class="btn sm" onclick="doRegenCode()" title="Kode berria">↻</button>
      </div>
      <div class="sec-title">Taldekideak (${projMembers.length})</div><div class="pm-list">`;
      projMembers.forEach(m => {
        const isMe = m.user_id === userId;
        const meTag = isMe ? ' <em style="color:var(--bark-l)">(zu)</em>' : '';
        if (m.role === 'owner') {
          h += `<div class="pm-row"><span class="pm-name">${esc(m.username || '—')}${meTag}</span><span class="pm-role">Jabea</span></div>`;
        } else {
          h += `<div class="pm-row"><span class="pm-name">${esc(m.username || '—')}${meTag}</span>
            <select class="pm-sel" onchange="setRole('${m.user_id}', this.value)">
              <option value="editor" ${m.role === 'editor' ? 'selected' : ''}>Editorea</option>
              <option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>Ikuslea</option>
            </select>
            <button class="member-del" onclick="removeMemberP('${m.user_id}')" title="Kendu">✕</button></div>`;
        }
      });
      h += `</div>
      <div id="pdel-warn" style="display:none;background:var(--bad-bg);border:1px solid rgba(174,43,43,.3);border-radius:8px;padding:9px 11px;font-size:12px;color:var(--bad);margin:10px 0;line-height:1.55">⚠️ Proiektua eta bere datu GUZTIAK behin betiko ezabatuko dira. Berriro sakatu baieztatzeko.</div>
      <button class="btn danger full" id="pdel-btn" style="margin-top:10px" onclick="stepDeleteProject()">🗑 Proiektua ezabatu</button>`;
    } else {
      h += `<hr class="proj-hr"><div class="sec-title">Taldekideak (${projMembers.length})</div><div class="pm-list">`;
      projMembers.forEach(m => {
        const meTag = m.user_id === userId ? ' <em style="color:var(--bark-l)">(zu)</em>' : '';
        h += `<div class="pm-row"><span class="pm-name">${esc(m.username || '—')}${meTag}</span><span class="pm-role">${roleLabel(m.role)}</span></div>`;
      });
      h += '</div>';
    }
  }
  document.getElementById('proj-body').innerHTML = h;
  pdelStep = 0;
}

async function doRename() {
  const name = document.getElementById('proj-rename').value.trim();
  if (name.length < 2) { toast('Izen laburregia', 'warn'); return; }
  const { error } = await sb.from('projects').update({ name }).eq('id', projectId);
  if (error) { toast(error.message, 'bad'); return; }
  const p = projects.find(x => x.id === projectId); if (p) p.name = name;
  renderProjectBar(); renderProj(); toast('Izena aldatuta ✓');
}

function copyCode() {
  const code = projects.find(p => p.id === projectId)?.join_code || '';
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('Kodea kopiatuta ✓'), () => toast(code, 'warn'));
  else toast(code, 'warn');
}

async function doRegenCode() {
  if (!confirm('Kode berria sortu? Kode zaharrak balioa galduko du.')) return;
  const { data, error } = await sb.rpc('regenerate_join_code', { p_pid: projectId });
  if (error) { toast(error.message, 'bad'); return; }
  const p = projects.find(x => x.id === projectId); if (p) p.join_code = data;
  const el = document.getElementById('code-val'); if (el) el.textContent = data;
  toast('Kode berria sortuta ✓');
}

async function setRole(uid, role) {
  const { error } = await sb.rpc('set_member_role', { p_pid: projectId, p_uid: uid, p_role: role });
  if (error) { toast(error.message, 'bad'); return; }
  const m = projMembers.find(x => x.user_id === uid); if (m) m.role = role;
  toast('Rola eguneratuta ✓');
}

async function removeMemberP(uid) {
  const m = projMembers.find(x => x.user_id === uid);
  if (!confirm(`«${m?.username || ''}» proiektutik kendu?`)) return;
  const { error } = await sb.rpc('remove_member', { p_pid: projectId, p_uid: uid });
  if (error) { toast(error.message, 'bad'); return; }
  projMembers = projMembers.filter(x => x.user_id !== uid);
  renderProj(); toast('Kidea kenduta');
}

function stepDeleteProject() {
  const btn = document.getElementById('pdel-btn');
  const warn = document.getElementById('pdel-warn');
  if (pdelStep === 0) {
    pdelStep = 1; warn.style.display = '';
    btn.textContent = '⚠ Berretsi ezabatzea';
    pdelTimer = setTimeout(() => {
      pdelStep = 0; warn.style.display = 'none'; btn.textContent = '🗑 Proiektua ezabatu';
    }, 4000);
  } else { clearTimeout(pdelTimer); deleteProject(); }
}

async function deleteProject() {
  const { error } = await sb.from('projects').delete().eq('id', projectId);
  if (error) { toast(error.message, 'bad'); return; }
  projects = projects.filter(p => p.id !== projectId);
  localStorage.removeItem('erlekide.project');
  closeM('proj');
  clearInterval(pollTimer);
  if (projects.length) { await selectProject(projects[0].id); toast('Proiektua ezabatuta'); }
  else { projectId = null; showFirstProject(); toast('Proiektua ezabatuta'); }
}

// ── Datuak ────────────────────────────────────────────────────────────────────
async function loadHives() {
  if (!projectId) { hives = []; return; }
  const { data, error } = await sb.from('hives').select('*').eq('project_id', projectId).order('name');
  if (!error && data) hives = data;
}

async function loadInsps(hiveId) {
  const { data } = await sb.from('inspections').select('*')
    .eq('hive_id', hiveId).order('date', { ascending: false }).order('created_at', { ascending: false });
  insps = data || [];
}


function openCfg() {
  if (!canEdit()) return;
  document.getElementById('cfg-cols').value = COLS;
  document.getElementById('cfg-rows').value = ROWS;
  document.getElementById('cfg-cols-now').textContent = COLS;
  document.getElementById('cfg-rows-now').textContent = ROWS;
  const warn = document.getElementById('cfg-warn');
  warn.style.display = 'none'; warn.dataset.confirmed = '0';
  document.getElementById('cfg-save-btn').textContent = '✓ Gorde';
  const sh = document.getElementById('cfg-sky-hour');
  if (!sh.options.length) {
    sh.innerHTML = '<option value="">Auto (orain)</option>'
      + Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('');
  }
  sh.value = skyOverride.hour != null ? String(skyOverride.hour) : '';
  document.getElementById('cfg-sky-w').value = skyOverride.cond || '';
  openM('cfg');
}

async function saveSettings() {
  const newCols = Math.min(20, Math.max(3, +document.getElementById('cfg-cols').value || COLS));
  const newRows = Math.min(15, Math.max(1, +document.getElementById('cfg-rows').value || ROWS));
  const warn = document.getElementById('cfg-warn');

  const out = hives.filter(h => h.grid_x != null && h.grid_y != null &&
    (h.grid_x >= newCols || h.grid_y >= newRows || (isWide(h) && h.grid_x + 1 >= newCols)));

  if (out.length && warn.dataset.confirmed !== '1') {
    warn.innerHTML = `⚠️ ${out.length} erlauntza mapan kokatuta daude eremu berritik kanpo:<br><strong>${out.map(h => esc(h.name)).join(', ')}</strong><br>Posizioa ezabatuko zaie (erlauntzak bere horretan geratuko dira zerrendan). Berriro sakatu baieztatzeko.`;
    warn.style.display = '';
    warn.dataset.confirmed = '1';
    document.getElementById('cfg-save-btn').textContent = '⚠ Berretsi eta gorde';
    return;
  }

  for (const h of out) {
    await sb.from('hives').update({ grid_x: null, grid_y: null }).eq('id', h.id);
    h.grid_x = null; h.grid_y = null;
  }

  const { error } = await sb.rpc('set_grid', { p_pid: projectId, p_cols: newCols, p_rows: newRows });
  if (error) { toast(error.message, 'bad'); return; }
  const cp = projects.find(p => p.id === projectId); if (cp) { cp.cols = newCols; cp.rows = newRows; }

  COLS = newCols; ROWS = newRows;
  closeM('cfg');
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
  h += '<div id="vel-layer" aria-hidden="true"></div></div>';
  g.innerHTML = h;
  // Necesitamos dos frames para que el navegador calcule el layout antes de medir
  requestAnimationFrame(() => requestAnimationFrame(applyMobileRotation));
  renderVelutinas();
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

  const maxW = Math.max(1, window.innerWidth - 20);
  const maxH = Math.max(1, window.innerHeight - 120);

  // Tras la rotación 90° CW: la dirección FILAS ocupa el ancho (H→screen X)
  // y la dirección COLUMNAS ocupa el alto (W→screen Y).
  const firstRow = gcont.querySelector('.gbrow');
  const rowH = firstRow ? firstRow.offsetHeight : 68;

  // Escala mínima: cada fila (gbrow) ocupa al menos el 75% del ancho de pantalla
  const minScale = (maxW * 0.75) / Math.max(1, rowH);
  // Escala máxima: las columnas no superan 2× la altura de pantalla (evitar "demasiado altos")
  const maxScale = (maxH * 2) / Math.max(1, W);
  // fitScale: todo cabe sin scroll
  const fitScale = Math.min(maxW / H, maxH / W);

  const scale = Math.min(maxScale, Math.max(fitScale, minScale));

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

// ── Belar-izpiak erlauntzaren oinarrian / Briznas delante de la base ─────────
const GRASS_BLADES = (() => {
  const cols = ['#4e6b2a', '#557334', '#62823a'];
  let p = '';
  for (let x = 2; x < 98; x += 4 + Math.random() * 7) {
    const hh = 5 + Math.random() * 8;
    const lean = (Math.random() - .5) * 5;
    const c = cols[Math.floor(Math.random() * cols.length)];
    p += `<path d="M${x.toFixed(1)} 14 Q${(x + lean).toFixed(1)} ${(14 - hh).toFixed(1)} ${(x + lean * 1.5).toFixed(1)} ${(13 - hh).toFixed(1)} Q${(x + lean + 1.5).toFixed(1)} ${(14 - hh * .4).toFixed(1)} ${(x + 2.6).toFixed(1)} 14 Z" fill="${c}"/>`;
  }
  return p;
})();

// ── Erle txikiak piqueran / Abejas animadas en la piquera ────────────────────
// Kopurua egoeraren araberakoa: ona=3, kontuz=2, kritikoa=1
function beesHTML(status) {
  const n = status === 'bad' ? 3 : status === 'warn' ? 7 : 15;
  let out = '<div class="bees" aria-hidden="true">';
  for (let i = 0; i < n; i++) {
    const dir = Math.random() < .5 ? -1 : 1;
    const x1 = (dir * (16 + Math.random() * 20)).toFixed(0);
    const y1 = (-(8 + Math.random() * 16)).toFixed(0);
    const x2 = (dir * (8 + Math.random() * 36)).toFixed(0);
    const y2 = (-(22 + Math.random() * 20)).toFixed(0);
    const d = (3.6 + Math.random() * 3.2).toFixed(2);
    const dl = (-Math.random() * 7).toFixed(2); // atzerapen negatiboa: hegaldia jada hasita
    out += `<span class="bee" style="--x1:${x1}px;--y1:${y1}px;--x2:${x2}px;--y2:${y2}px;--d:${d}s;--dl:${dl}s"></span>`;
  }
  return out + '</div>';
}

// Dimensiones exactas (px) de cada SVG de alza y de la caja sin tapa
const ALZA_H = { osoa_st: 390.967, erdia_st: 198.546 };
const ALZA_W = 733.869;
const KAJA_ST_H = 491.055;
const TAPA_W = 819.576;
const TAPA_H = 113.319;

// Genera un <svg> inline que combina caja + alzas en el mismo sistema de coordenadas.
// La caja ocupa y=[0, KAJA_ST_H]; cada alza se apila en y negativa (overflow visible).
// Todos los cuerpos usan _sinTapa; la tapa se añade como <image> separado encima.
function alzaHiveSvg(h) {
  const wide = isWide(h);
  const alzas = h.alzas || [];
  if (!alzas.length || !wide)
    return `<img class="tok-svg" src="/images/${wide ? 'kaja' : 'nukleoa'}.svg" draggable="false" alt="">`;
  let imgs = '';
  let yUp = 0;
  const tx = -((TAPA_W - ALZA_W) / 2);
  alzas.forEach((a, i) => {
    const isTop = i === alzas.length - 1;
    const t = a.type === 'osoa' ? 'osoa' : 'erdia';
    const ah = ALZA_H[t + '_st'];
    imgs += `<image href="/images/alza${a.type === 'osoa' ? 'Osoa' : 'Erdia'}_sinTapa.svg" x="0" y="${(-(yUp + ah)).toFixed(2)}" width="${ALZA_W}" height="${ah}"/>`;
    yUp += ah;
    if (isTop)
      imgs += `<image href="/images/alzaTapa.svg" x="${tx.toFixed(2)}" y="${(-(yUp + TAPA_H)).toFixed(2)}" width="${TAPA_W}" height="${TAPA_H}"/>`;
  });
  imgs += `<image href="/images/kaja_sinTapa.svg" x="0" y="0" width="${ALZA_W}" height="${KAJA_ST_H}"/>`;
  return `<svg class="tok-svg" viewBox="0 0 ${ALZA_W} ${KAJA_ST_H}" overflow="visible" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">${imgs}</svg>`;
}

function buildAlzaCards(h) {
  if (!isWide(h)) return '';
  const alzas = h.alzas || [];
  if (!alzas.length && !canEdit()) return '';
  let out = '<div class="sec-title" style="margin-top:8px">Alzak</div>';
  if (canEdit()) out += `<div style="display:flex;gap:8px;margin-bottom:8px">
      <button class="btn sm" onclick="addAlza('${h.id}','osoa')">＋ Osoa</button>
      <button class="btn sm" onclick="addAlza('${h.id}','erdia')">＋ Erdia</button>
    </div>`;
  alzas.forEach((a, i) => {
    const badge = a.type === 'osoa' ? 'OSOA' : 'ERDIA';
    const del = canEdit() ? `<button class="icon-btn" style="margin-left:auto" onclick="removeAlza('${h.id}',${i})">✕</button>` : '';
    const mkFld = (lbl, key) => `<div class="alza-fld"><label>${lbl}</label><input type="number" min="0" max="20" value="${a[key]}"${canEdit() ? ` onchange="updateAlzaField('${h.id}',${i},'${key}',+this.value)"` : ' disabled'}></div>`;
    out += `<div class="alza-card">
      <div class="alza-hdr"><span class="alza-badge alza-badge-${a.type}">${badge}</span><span style="font-size:11px;color:var(--bark-l);margin-left:4px">${i + 1}. alza</span>${del}</div>
      <div class="alza-fields">${mkFld('Markoak', 'frames')}${mkFld('Estiratuta', 'stretched')}${mkFld('Eztiduna', 'honey')}</div>
    </div>`;
  });
  return out;
}

// Erlauntza zabala (kaja) bi gelaxka hartzen ditu: berea eta eskuinekoa /
// la colmena ancha ocupa su celda y la contigua derecha
const isWide = h => h && h.frames != null && h.frames > 5;

function occAt(x, y, ignoreId) {
  return hives.find(h => h.id !== ignoreId && h.grid_y === y && h.grid_x === x);
}


function canPlace(x, y, wide, ignoreId) {
  const occ = occAt(x, y, ignoreId);
  if (occ) { toast(`${occ.name}ek hartuta dago`, 'warn'); return false; }
  return true;
}

function renderGrid() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const el = document.getElementById(`c${c}_${r}`);
      if (el) { el.innerHTML = '<div class="cempty">+</div>'; el.classList.remove('covered', 'wide'); }
    }
  hives.forEach(h => {
    if (h.grid_x == null || h.grid_y == null) return;
    const el = document.getElementById(`c${h.grid_x}_${h.grid_y}`);
    if (!el) return;
    const wide = isWide(h);
    const svgBase = wide ? 'kaja' : 'nukleoa';
    if (wide) el.classList.add('wide');
    el.innerHTML = `<div class="tok tok-${svgBase} st-${h.status}" id="t${h.id}" draggable="${canEdit()}"
      ondragstart="ds(event,'${h.id}')" ondragend="de(event,'${h.id}')"
      onclick="tc(event,'${h.id}')">
      ${alzaHiveSvg(h)}
      ${beesHTML(h.status)}
      <svg class="tgrass" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">${GRASS_BLADES}</svg>
      <div class="tbrand">${esc(h.name)}</div>
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
    `<span style="color:var(--good)">● ${g} ondo</span> &nbsp;<span style="color:var(--warn)">● ${w} kontuz</span> &nbsp;<span style="color:var(--bad)">● ${b} kritiko</span>`;
}

// ── Detail modal ──────────────────────────────────────────────────────────────
async function renderDP(id) {
  const h = hives.find(x => x.id === id);
  if (!h) return;
  await loadInsps(id);
  const pos = h.grid_x != null ? `${RLBLS[h.grid_y]}${h.grid_x + 1} posizioa` : 'Mapan kokatu gabe';
  const stL = { good: 'Ona', warn: 'Kontuz', bad: 'Kritikoa' };
  const stC = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' };
  const alzaSection = buildAlzaCards(h);
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
      <div class="mstat"><div class="n" style="font-size:13px">${h.frames != null ? h.frames : '—'}</div><div class="l">Markoak</div></div>
    </div>
    ${canEdit() ? `<div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn primary" style="flex:1" onclick="closeM('dp');openInsp('${h.id}')">＋ Inspekzioa</button>
      <button class="btn" onclick="closeM('dp');startMove('${h.id}')">📍 Mugitu</button>
      <button class="btn" onclick="closeM('dp');openEdit('${h.id}')">✎ Editatu</button>
    </div>` : ''}
    ${h.notes ? `<div style="font-size:12px;color:var(--bark-m);background:var(--cream);padding:8px 10px;border-radius:8px;margin-bottom:12px;line-height:1.6">${esc(h.notes)}</div>` : ''}
    ${alzaSection}
    <div class="sec-title">Inspekzio historia</div>
    ${insps.length ? insps.slice(0, 15).map(i => `
      <div class="icard">
        <div class="ichdr">
          <span class="idate">${i.date}</span>
          <span class="iusr">${esc(i.username)}</span>
          ${canEdit() ? `<button class="icon-btn" style="margin-left:auto" onclick="openEditInsp('${i.id}')">✎ Editatu</button>` : ''}
        </div>
        <div style="color:var(--bark);line-height:1.55">${esc(i.notes) || '<em style="color:var(--bark-l)">Oharrik gabe</em>'}</div>
        <div class="ichips">
          <span class="chip">💪 ${i.strength}/10</span>
          <span class="chip">🍯 ${i.honey} mko.</span>
          <span class="chip">👑 ${i.queen === 'yes' ? 'Ikusi' : i.queen === 'signs' ? 'Aztarnak' : 'Ez aurkitua'}</span>
          ${i.varroa !== 'unknown' ? `<span class="chip ${i.varroa === 'high' ? 'bad' : ''}">Varroa: ${i.varroa === 'low' ? 'Baxua' : i.varroa === 'med' ? 'Ertaina' : 'Altua'}</span>` : ''}
        </div>
      </div>`).join('') :
      '<div style="font-size:12px;color:var(--bark-l)">Oraindik ez du inspekziorik.</div>'}
  `;
  openM('dp');
}

function selHive(id) { selId = id; renderSB(); renderDP(id); }

// ── Alzak CRUD ────────────────────────────────────────────────────────────────
async function saveAlzas(hiveId, alzas) {
  const { error } = await sb.from('hives').update({ alzas }).eq('id', hiveId);
  if (error) { toast('Errorea gordetzean', 'bad'); return; }
  const h = hives.find(x => x.id === hiveId);
  if (h) h.alzas = alzas;
  renderGrid();
  renderDP(hiveId);
}

async function addAlza(hiveId, type) {
  const h = hives.find(x => x.id === hiveId);
  if (!h) return;
  await saveAlzas(hiveId, [...(h.alzas || []), { type, frames: 0, stretched: 0, honey: 0 }]);
}

async function removeAlza(hiveId, idx) {
  const h = hives.find(x => x.id === hiveId);
  if (!h) return;
  await saveAlzas(hiveId, (h.alzas || []).filter((_, i) => i !== idx));
}

async function updateAlzaField(hiveId, idx, field, value) {
  const h = hives.find(x => x.id === hiveId);
  if (!h) return;
  await saveAlzas(hiveId, (h.alzas || []).map((a, i) => i === idx ? { ...a, [field]: value } : a));
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
function ds(e, id) { if (!canEdit()) { e.preventDefault(); return; } dragId = id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => document.getElementById('t' + id)?.classList.add('drag'), 0); }
function de(e, id) { document.getElementById('t' + id)?.classList.remove('drag'); dragId = null; }
function ov(e, x, y) { if (!dragId) return; e.preventDefault(); document.getElementById(`c${x}_${y}`)?.classList.add('dov'); }
function ol(e, x, y) { document.getElementById(`c${x}_${y}`)?.classList.remove('dov'); }

async function placeHive(id, x, y) {
  if (!canEdit()) return;
  const hive = hives.find(h => h.id === id);
  if (!hive) return;
  const [px, py] = [hive.grid_x, hive.grid_y];
  hive.grid_x = x; hive.grid_y = y; renderGrid();
  const { error } = await sb.from('hives').update({ grid_x: x, grid_y: y }).eq('id', id);
  if (error) { hive.grid_x = px; hive.grid_y = py; renderGrid(); toast(error.message, 'bad'); }
  else { toast(`${hive.name} → ${RLBLS[y]}${x + 1}`); renderSB(); }
}

async function od(e, x, y) {
  e.preventDefault();
  document.getElementById(`c${x}_${y}`)?.classList.remove('dov');
  if (!dragId) return;
  const id = dragId; dragId = null;
  const hive = hives.find(h => h.id === id);
  if (!hive || !canPlace(x, y, isWide(hive), id)) return;
  await placeHive(id, x, y);
}

// Mugitzeko modua (mugikorrean drag & drop ez dabilenez): hautatu eta ukitu helmuga
function startMove(id) {
  if (!canEdit()) return;
  const h = hives.find(x => x.id === id);
  if (!h) return;
  moveId = id;
  document.getElementById('t' + id)?.classList.add('moving');
  toast(`Ukitu gelaxka huts bat "${h.name}" hara mugitzeko`, 'warn');
}

function cancelMove() {
  document.getElementById('t' + moveId)?.classList.remove('moving');
  moveId = null;
  toast('Mugitzea bertan behera utzita');
}

async function cc(x, y) {
  const occ = occAt(x, y, null);
  if (moveId) {
    if (occ && occ.id === moveId) { cancelMove(); return; }
    const mv = hives.find(h => h.id === moveId);
    if (!mv || !canPlace(x, y, isWide(mv), moveId)) return;
    const id = moveId; moveId = null;
    await placeHive(id, x, y);
    return;
  }
  if (occ) selHive(occ.id);
  else if (canEdit()) openAddModal(x, y);
}

function tc(e, id) {
  e.stopPropagation();
  if (moveId) {
    if (id === moveId) cancelMove();
    else toast('Gelaxka hori hartuta dago', 'warn');
    return;
  }
  selHive(id);
}

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

function readPosSelects(rowSelId, colSelId, ignoreId, wide) {
  const rv = document.getElementById(rowSelId).value;
  const cv = document.getElementById(colSelId).value;
  if (rv === '' || cv === '') return { ok: true, x: null, y: null };
  const x = +cv, y = +rv;
  if (!canPlace(x, y, !!wide, ignoreId)) return { ok: false };
  return { ok: true, x, y };
}

function openAddModal(x, y) {
  if (!canEdit()) return;
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
  if (saving) return;
  const name = document.getElementById('ahn').value.trim();
  if (!name) { toast('Idatzi izen bat', 'warn'); return; }
  const rawF = document.getElementById('ahf').value;
  const frames = rawF === '' ? null : Math.min(10, Math.max(5, +rawF));
  const pos = readPosSelects('ahpy', 'ahpx', null, frames != null && frames > 5);
  if (!pos.ok) return;
  saving = true;
  try {
    const { data, error } = await sb.from('hives').insert({
      project_id: projectId,
      name, type: document.getElementById('aht').value, race: document.getElementById('ahr').value,
      status: document.getElementById('ahs').value, color: document.getElementById('ahc').value,
      install_date: document.getElementById('ahd').value || null,
      notes: document.getElementById('ahno').value,
      frames, grid_x: pos.x, grid_y: pos.y, created_by: userId
    }).select().single();
    if (error) { toast(error.message, 'bad'); return; }
    hives.push(data); hives.sort((a, b) => a.name.localeCompare(b.name));
    closeM('ah'); renderAll(); selHive(data.id); toast(`${name} sortuta ✓`);
  } finally { saving = false; }
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
  if (saving) return;
  const h = hives.find(x => x.id === editId); if (!h) return;
  const rawF = document.getElementById('ehf').value;
  const frames = rawF === '' ? null : Math.min(10, Math.max(5, +rawF));
  const pos = readPosSelects('ehpy', 'ehpx', editId, frames != null && frames > 5);
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
  saving = true;
  try {
    const { error } = await sb.from('hives').update(upd).eq('id', editId);
    if (error) { toast(error.message, 'bad'); return; }
    Object.assign(h, upd); closeM('eh'); renderAll();
    if (selId === editId) renderDP(editId);
    toast('Erlauntza eguneratuta ✓');
  } finally { saving = false; }
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
  closeM('eh'); closeM('dp'); selId = null; renderAll(); toast('Erlauntza ezabatuta');
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
  inspHiveId = i.hive_id; inspEditId = inspId || '';
  document.getElementById('ai-modal-title').innerHTML = 'Inspekzioa editatu <button class="mclose" onclick="closeM(\'ai\')">✕</button>';
  document.getElementById('aid').value = i.date;
  document.getElementById('ais').value = i.strength;
  document.getElementById('aib').value = i.brood;
  document.getElementById('aim').value = i.honey;
  document.getElementById('aiq').value = i.queen;
  document.getElementById('aiv').value = i.varroa;
  document.getElementById('aist').value = i.status;
  document.getElementById('aino').value = i.notes || '';
  openM('ai');
}


function clampNum(v, lo, hi, def) {
  const n = v === '' ? NaN : +v;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
}

async function saveInsp() {
  if (!inspHiveId || saving) return;
  const status = document.getElementById('aist').value;
  const payload = {
    date: document.getElementById('aid').value || new Date().toISOString().slice(0, 10),
    strength: clampNum(document.getElementById('ais').value, 1, 10, 5),
    brood: clampNum(document.getElementById('aib').value, 0, 20, 0),
    honey: clampNum(document.getElementById('aim').value, 0, 20, 0),
    queen: document.getElementById('aiq').value,
    varroa: document.getElementById('aiv').value,
    status,
    notes: document.getElementById('aino').value
  };

  saving = true;
  try {
    let error;
    if (inspEditId) {
      ({ error } = await sb.from('inspections').update(payload).eq('id', inspEditId));
    } else {
      ({ error } = await sb.from('inspections').insert({
        ...payload, project_id: projectId, hive_id: inspHiveId, username: me, created_by: userId
      }));
    }
    if (error) { toast(error.message, 'bad'); return; }

    await sb.from('hives').update({ status }).eq('id', inspHiveId);
    const h = hives.find(x => x.id === inspHiveId); if (h) h.status = status;
    closeM('ai'); renderAll();
    if (selId === inspHiveId) await renderDP(inspHiveId);
    toast(inspEditId ? 'Inspekzioa eguneratuta ✓' : 'Inspekzioa gordeta ✓');
  } finally { saving = false; }
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

let toastTimer = null;
function toast(msg, t = 'ok', ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = t === 'bad' ? 'var(--bad)' : t === 'warn' ? 'var(--warn)' : 'var(--bark)';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
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
  if (!projectId) { expenses = []; return; }
  const { data } = await sb.from('expenses').select('*').eq('project_id', projectId).order('date', { ascending: false }).order('created_at', { ascending: false });
  expenses = data || [];
}
async function loadMembers() {
  if (!projectId) { members = []; return; }
  const { data } = await sb.from('members').select('*').eq('project_id', projectId).order('name');
  members = data || [];
}
async function loadMaterials() {
  if (!projectId) { materials = []; return; }
  const { data } = await sb.from('materials').select('*').eq('project_id', projectId).order('category').order('name');
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
  if (saving) return;
  const description = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amt').value);
  const paid_by = document.getElementById('exp-payer').value;
  const date = document.getElementById('exp-date').value || new Date().toISOString().slice(0, 10);
  const notes = document.getElementById('exp-notes').value;
  if (!description) { toast('Idatzi deskribapena', 'warn'); return; }
  if (!amount || amount <= 0) { toast('Sartu zenbateko baliogarri bat', 'warn'); return; }
  saving = true;
  try {
    const { error } = await sb.from('expenses').insert({ project_id: projectId, description, amount, paid_by, date, notes, created_by: userId });
    if (error) { toast(error.message, 'bad'); return; }
    await loadExpenses();
    closeM('exp'); renderExpenses(); toast('Gastua gordeta ✓');
  } finally { saving = false; }
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
  const { error } = await sb.from('members').insert({ project_id: projectId, name });
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
  if (saving) return;
  const name = document.getElementById('mat-name').value.trim();
  const category = document.getElementById('mat-cat').value;
  const quantity = Math.max(0, parseInt(document.getElementById('mat-qty').value) || 0);
  const notes = document.getElementById('mat-notes').value;
  if (!name) { toast('Idatzi izena', 'warn'); return; }
  saving = true;
  try {
    const payload = { name, category, quantity, notes };
    const { error } = matEditId
      ? await sb.from('materials').update(payload).eq('id', matEditId)
      : await sb.from('materials').insert({ ...payload, project_id: projectId, created_by: userId });
    if (error) { toast(error.message, 'bad'); return; }
    await loadMaterials();
    closeM('mat'); renderMaterials(); toast(matEditId ? 'Materiala eguneratuta ✓' : 'Materiala gordeta ✓');
  } finally { saving = false; }
}

async function deleteMat(id) {
  const m = materials.find(x => x.id === id);
  if (!confirm(`"${m?.name}" ezabatu nahi duzu?`)) return;
  const { error } = await sb.from('materials').delete().eq('id', id);
  if (error) { toast(error.message, 'bad'); return; }
  await loadMaterials(); renderMaterials(); toast('Materiala ezabatuta');
}

// ── VESPA VELUTINA / Liztor asiarra ──────────────────────────────────────────
const VEL_MAX_VISIBLE = 8; // errendimendua zaintzeko gehienezko kopurua mapan

const VEL_SVG = `<svg viewBox="0 0 64 36" xmlns="http://www.w3.org/2000/svg">
  <g class="vw"><ellipse cx="34" cy="7" rx="13" ry="4.5" fill="rgba(190,205,225,.6)"/></g>
  <g class="vw2"><ellipse cx="41" cy="9" rx="9" ry="3.5" fill="rgba(190,205,225,.42)"/></g>
  <path d="M31 18 Q29 10 19 11 Q7 13 4 18.5 Q7 24 19 26 Q29 27 31 18 Z" fill="#26190d"/>
  <path d="M13.5 12.3 Q8.5 14.5 7 18.5 Q8.5 22.5 13.5 24.7 L17 25.4 L17 11.6 Z" fill="#E8930C"/>
  <ellipse cx="39" cy="18" rx="9.5" ry="8" fill="#1d1409"/>
  <ellipse cx="52.5" cy="18" rx="6.5" ry="5.5" fill="#3a2a16"/>
  <path d="M50 14 Q52 12 56 13.5 Q58 15 58 17 Q55 15.5 50 16 Z" fill="#E8930C" opacity=".85"/>
  <circle cx="55" cy="16.5" r="1.7" fill="#0d0a06"/>
  <path d="M56.5 12.5 q3 -4 6.5 -4.5 M55 11.8 q1.5 -4 4.5 -5.6" stroke="#26190d" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <path d="M36 25 q-2 6 -6.5 7.5 M42 25.5 q-.5 6 -4.5 8.5 M48 24.5 q1.5 5.5 -1 9" stroke="#E8B84B" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M4.5 18.5 L0.5 19.5 L4.8 20.6 Z" fill="#0d0a06"/>
</svg>`;

const velCount = () => velutinas.length ? velutinas[0].count : 0;

async function loadVelutinas() {
  if (!projectId) { velutinas = []; return; }
  const { data } = await sb.from('velutina_sightings').select('*')
    .eq('project_id', projectId).order('created_at', { ascending: false }).limit(50);
  velutinas = data || [];
}

function renderVelBtn() {
  const btn = document.getElementById('vel-btn');
  if (!btn) return;
  if (!btn.querySelector('svg')) btn.insertAdjacentHTML('afterbegin', VEL_SVG);
  const n = velCount();
  const badge = document.getElementById('vel-badge');
  badge.textContent = n;
  badge.style.display = n > 0 ? '' : 'none';
  btn.classList.toggle('alert', n > 0);
}

function clearVelutinas() {
  velTimers.forEach(clearTimeout);
  velTimers = [];
  const layer = document.getElementById('vel-layer');
  if (layer) layer.innerHTML = '';
}

function renderVelutinas() {
  clearVelutinas();
  const layer = document.getElementById('vel-layer');
  if (!layer) return;
  const n = Math.min(velCount(), VEL_MAX_VISIBLE);
  for (let i = 0; i < n; i++) spawnVel(layer, i);
}

function spawnVel(layer, i) {
  const el = document.createElement('div');
  el.className = 'vel';
  el.innerHTML = `<div class="vel-body">${VEL_SVG}<span class="vel-prey"></span></div>`;
  const W = layer.offsetWidth || 600, H = layer.offsetHeight || 400;
  el._x = Math.random() * W;
  el._y = Math.random() * H * .5;
  el.style.left = el._x + 'px';
  el.style.top = el._y + 'px';
  layer.appendChild(el);
  velTimers.push(setTimeout(() => velHop(el, layer), 300 + i * 600));
}

// Puntu batera hegan egin eta amaitzean callback-a deitu / vuela a un punto
function velFlyTo(el, x, y, done, speed = 110) {
  const dx = x - el._x, dy = y - el._y;
  const dur = Math.max(.5, Math.hypot(dx, dy) / speed);
  el.querySelector('.vel-body').style.setProperty('--fx', dx < 0 ? -1 : 1);
  el.style.transition = `left ${dur}s cubic-bezier(.45,.1,.4,1), top ${dur}s cubic-bezier(.55,.25,.45,.95), opacity ${dur}s linear`;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el._x = x; el._y = y;
  velTimers.push(setTimeout(() => { if (el.isConnected) done(); }, dur * 1000 + 80));
}

// Hurrengo helmuga aukeratu: batzuetan erlauntza baten gainean gelditzen da
// (perch), batzuetan piqueran ehizatzen du (hunt), bestela puntu aleatorio bat.
function velHop(el, layer) {
  if (!el.isConnected) return;
  const W = Math.max(layer.offsetWidth, 100), H = Math.max(layer.offsetHeight, 80);
  const placed = hives.filter(h => h.grid_x != null && h.grid_y != null);
  let x = null, y = null, perch = false;
  if (placed.length && Math.random() < .6) {
    const h = placed[Math.floor(Math.random() * placed.length)];
    const cell = document.getElementById(`c${h.grid_x}_${h.grid_y}`);
    if (cell) {
      if (Math.random() < .25) { velHunt(el, layer, cell); return; }
      x = cell.offsetLeft + cell.offsetWidth * (.3 + Math.random() * .4);
      y = cell.offsetTop + cell.offsetHeight * (.05 + Math.random() * .3);
      perch = Math.random() < .55;
    }
  }
  if (x == null) {
    x = 20 + Math.random() * (W - 40);
    y = 10 + Math.random() * (H * .6);
  }
  el.classList.remove('perch');
  velFlyTo(el, x, y, () => {
    if (perch) {
      el.classList.add('perch');
      velTimers.push(setTimeout(() => velHop(el, layer), 1500 + Math.random() * 3000));
    } else velHop(el, layer);
  });
}

// Ehiza: piquerara hurbildu, erle bat harrapatu, eszenatik atera hegan eta
// 5 segundora itzuli / caza en la piquera, sale de escena y vuelve a los 5 s
function velHunt(el, layer, cell) {
  if (!el.isConnected) return;
  el.classList.remove('perch');
  // 1) piquerara hurbildu (erlauntzaren behealdea, erleak dabiltzan tokia)
  const px = cell.offsetLeft + cell.offsetWidth * (.42 + Math.random() * .16);
  const py = cell.offsetTop + cell.offsetHeight * (.7 + Math.random() * .08);
  velFlyTo(el, px, py, () => {
    // 2) une batez gelditu eta erle bat harrapatu
    el.classList.add('perch');
    velTimers.push(setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove('perch');
      el.classList.add('prey');
      const bee = cell.querySelector('.bees .bee');
      if (bee) bee.remove(); // erle bat gutxiago piqueran
      // 3) eszenatik atera, harrapakina eramanez (azkarrago, gorantz)
      const W = Math.max(layer.offsetWidth, 100);
      const exitX = el._x < W / 2 ? -60 : W + 60;
      const exitY = Math.max(-40, el._y - 80 - Math.random() * 100);
      el.style.opacity = '0';
      velFlyTo(el, exitX, exitY, () => {
        // 4) 5 segundora itzuli ertz batetik, harrapakinik gabe
        velTimers.push(setTimeout(() => {
          if (!el.isConnected) return;
          el.classList.remove('prey');
          const W2 = Math.max(layer.offsetWidth, 100), H2 = Math.max(layer.offsetHeight, 80);
          el.style.transition = 'none';
          el._x = Math.random() < .5 ? -40 : W2 + 40;
          el._y = 10 + Math.random() * (H2 * .4);
          el.style.left = el._x + 'px';
          el.style.top = el._y + 'px';
          void el.offsetWidth; // reflow: posizio berria transiziorik gabe aplikatu
          el.style.opacity = '1';
          velHop(el, layer);
        }, 5000));
      }, 170);
    }, 700 + Math.random() * 500));
  });
}

// ── Velutina modala / CRUD ────────────────────────────────────────────────────
function openVel() {
  if (!projectId) return;
  document.getElementById('vel-n').value = velCount() || 1;
  document.getElementById('vel-notes').value = '';
  renderVelHistory();
  openM('vel');
}

function renderVelHistory() {
  const el = document.getElementById('vel-history');
  if (!velutinas.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--bark-l);padding:4px 0">Oraindik ez dago deklaraziorik.</div>';
    return;
  }
  el.innerHTML = velutinas.map((v, i) => {
    const d = new Date(v.created_at);
    const when = `${d.toLocaleDateString('eu-ES')} · ${d.toLocaleTimeString('eu-ES', { hour: '2-digit', minute: '2-digit' })}`;
    const del = canEdit() ? `<button class="member-del" onclick="deleteVel('${v.id}')" title="Ezabatu">✕</button>` : '';
    return `<div class="vel-row ${i === 0 ? 'cur' : ''}">
      <span class="vel-row-n ${v.count === 0 ? 'zero' : ''}">${v.count}</span>
      <span class="vel-row-meta">${when} · ${esc(v.username)}${v.notes ? '<br>' + esc(v.notes) : ''}</span>
      ${del}
    </div>`;
  }).join('');
}

async function saveVel() {
  if (!canEdit() || saving || !projectId) return;
  const n = clampNum(document.getElementById('vel-n').value, 0, 99, 0);
  saving = true;
  try {
    const { error } = await sb.from('velutina_sightings').insert({
      project_id: projectId, count: n,
      notes: document.getElementById('vel-notes').value,
      username: me, created_by: userId
    });
    if (error) { toast(error.message, 'bad'); return; }
    await loadVelutinas();
    renderVelBtn(); renderVelutinas(); renderVelHistory();
    document.getElementById('vel-notes').value = '';
    toast(n ? `⚠️ ${n} velutina ikusita` : 'Velutinarik ez ✓', n ? 'warn' : 'ok');
  } finally { saving = false; }
}

async function deleteVel(id) {
  if (!confirm('Deklarazioa historiatik ezabatu?')) return;
  const { error } = await sb.from('velutina_sightings').delete().eq('id', id);
  if (error) { toast(error.message, 'bad'); return; }
  await loadVelutinas();
  renderVelBtn(); renderVelutinas(); renderVelHistory();
  toast('Deklarazioa ezabatuta');
}

// ── ZERUA: eguna/gaua eta eguraldia / Cielo: día-noche y clima ────────────────
// Ekialdea = maparen goialdea (mugikorrean eskuina); mendebaldea = behealdea.
const LASARTE = { lat: 43.2686, lon: -2.0217 };
let wxHours = null;              // orduz orduko eguraldia (gaur + bihar)
let wxSun = { rise: 7.5, set: 20.5 }; // konexiorik gabeko gutxi gorabeherakoa
let skyOverride = { hour: null, cond: null };
let skyInited = false, wxFetchedAt = 0;

function initSky() {
  if (skyInited) return;
  skyInited = true;
  try {
    const s = JSON.parse(localStorage.getItem('erlekide.sky') || 'null');
    if (s) skyOverride = { hour: s.hour ?? null, cond: s.cond || null };
  } catch { /* balio okerra: lehenetsiak */ }
  buildSkyDOM();
  fetchWeather();
  setInterval(() => {
    renderSky();
    if (Date.now() - wxFetchedAt > 30 * 60000) fetchWeather();
  }, 60000);
}

function buildSkyDOM() {
  const cl = document.getElementById('sky-clouds');
  let h = '';
  for (let i = 0; i < 6; i++) {
    const dur = 70 + Math.random() * 90;
    h += `<div class="cloud" style="top:${(3 + Math.random() * 80).toFixed(0)}%;--cs:${(.6 + Math.random() * .9).toFixed(2)};--cd:${dur.toFixed(0)}s;--cdl:${(-Math.random() * dur).toFixed(0)}s"></div>`;
  }
  cl.innerHTML = h;
  const rn = document.getElementById('sky-rain');
  let r = '';
  for (let i = 0; i < 44; i++)
    r += `<span class="drop" style="left:${(Math.random() * 100).toFixed(1)}%;animation-duration:${(.55 + Math.random() * .45).toFixed(2)}s;animation-delay:${(-Math.random()).toFixed(2)}s"></span>`;
  rn.innerHTML = r;
}

async function fetchWeather() {
  wxFetchedAt = Date.now();
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${LASARTE.lat}&longitude=${LASARTE.lon}`
      + '&hourly=weather_code,cloud_cover,precipitation,temperature_2m&daily=sunrise,sunset&timezone=auto&forecast_days=2';
    const d = await fetch(u).then(r => r.json());
    wxHours = d.hourly.time.map((t, i) => ({
      t, code: d.hourly.weather_code[i], cloud: d.hourly.cloud_cover[i],
      precip: d.hourly.precipitation[i], temp: d.hourly.temperature_2m[i]
    }));
    const hh = s => { const dt = new Date(s); return dt.getHours() + dt.getMinutes() / 60; };
    wxSun = { rise: hh(d.daily.sunrise[0]), set: hh(d.daily.sunset[0]) };
  } catch { /* konexiorik gabe: lehenetsiekin jarraitu */ }
  renderSky();
}

function wxAt(hourDec) {
  if (!wxHours) return null;
  const n = new Date();
  const key = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}T${String(Math.floor(hourDec)).padStart(2, '0')}:00`;
  return wxHours.find(x => x.t === key) || null;
}

function condOf(w) {
  if (!w) return 'clear';
  if (w.precip > 0.1 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 99)) return 'rain';
  if (w.cloud >= 60) return 'clouds';
  if (w.cloud >= 25) return 'partly';
  return 'clear';
}

function skyNow() {
  const n = new Date();
  const hour = skyOverride.hour != null ? +skyOverride.hour : n.getHours() + n.getMinutes() / 60;
  const w = wxAt(hour);
  const cond = skyOverride.cond || condOf(w);
  const cloud = skyOverride.cond
    ? { clear: 5, partly: 45, clouds: 85, rain: 95 }[skyOverride.cond]
    : (w ? w.cloud : 20);
  return { hour, cond, cloud, temp: w ? w.temp : null };
}

function skyBadge() {
  const { cond, temp } = skyNow();
  const ic = { clear: '☀️', partly: '⛅', clouds: '☁️', rain: '🌧️' }[cond];
  return `${ic}${temp != null ? ' ' + Math.round(temp) + '°C' : ''} Lasarte-Oria`;
}

function renderSky() {
  const sky = document.getElementById('sky');
  if (!sky) return;
  const c01 = v => Math.max(0, Math.min(1, v));
  const { hour: t, cond, cloud } = skyNow();
  const { rise, set } = wxSun;

  // Eguna: 1 egun betean, 0 gauean; ±36 minutuko trantsizioa egunsenti/ilunabarrean
  const dayF = c01((t - (rise - .6)) / 1.2) * c01(((set + .6) - t) / 1.2);
  const dark = 1 - dayF;
  // Distira epela: gaussiar bat egunsentian eta beste bat ilunabarrean
  const g = c => Math.exp(-((t - c) ** 2) / (2 * .7 * .7));
  const wRise = g(rise), wSet = g(set);
  const warm = Math.max(wRise, wSet);
  const duskSide = wSet > wRise; // true → mendebaldetik (behetik / ezkerretik)

  const mobile = window.innerWidth <= 700;
  // Ekialdea: goitik (mahaigain) / eskuinetik (mugikorra); mendebaldea alderantziz
  const dirEast = mobile ? '270deg' : '180deg';
  const dirWest = mobile ? '90deg' : '0deg';

  // 1) Gaua + eguraldi grisa (bi geruza uniforme pilatuta)
  const grey = (cond === 'rain' ? .22 : cond === 'clouds' ? .12 : 0) * dayF;
  const blue = (dark * .58).toFixed(3);
  document.getElementById('sky-night').style.background =
    `linear-gradient(rgba(70,82,104,${grey.toFixed(3)}),rgba(70,82,104,${grey.toFixed(3)})),`
    + `linear-gradient(rgba(9,13,42,${blue}),rgba(9,13,42,${blue}))`;

  // 2) Egunsenti/ilunabar distira dagokion ertzetik
  const gop = (warm * .38 * (1 - cloud / 140)).toFixed(3);
  document.getElementById('sky-glow').style.background =
    `linear-gradient(${duskSide ? dirWest : dirEast}, rgba(255,${duskSide ? 118 : 152},${duskSide ? 42 : 72},${gop}), rgba(255,140,60,0) 55%)`;

  // 3) Eguzkia ekialdetik (goitik/eskuinetik) mendebaldera mugitzen da
  const P = c01((t - rise) / Math.max(.1, set - rise));
  const sx = mobile ? (94 - P * 88) : 50;
  const sy = mobile ? 40 : (6 + P * 88);
  const sunOp = dayF * (1 - c01(cloud / 90)) * (cond === 'rain' ? 0 : 1);
  document.getElementById('sky-sun').style.background =
    `radial-gradient(circle at ${sx.toFixed(1)}% ${sy.toFixed(1)}%, rgba(255,244,190,${(sunOp * .34).toFixed(3)}), rgba(255,240,180,0) 42%)`;

  // 4) Hodeiak eta euria
  const clouds = document.getElementById('sky-clouds');
  clouds.style.opacity = c01((cloud - 15) / 60).toFixed(2);
  clouds.style.filter = `brightness(${(1 - dark * .8 - (cond === 'rain' ? .25 : 0)).toFixed(2)})`;
  document.getElementById('sky-rain').style.display = cond === 'rain' ? 'block' : 'none';
}

// Eskuzko proba-kontrolak (⚙ modala): berehala aplikatu eta gorde
function setSkyOverride() {
  const hv = document.getElementById('cfg-sky-hour').value;
  const wv = document.getElementById('cfg-sky-w').value;
  skyOverride = { hour: hv === '' ? null : +hv, cond: wv || null };
  localStorage.setItem('erlekide.sky', JSON.stringify(skyOverride));
  renderSky();
}

window.addEventListener('resize', () => {
  if (document.getElementById('agrid').querySelector('.gcont')) applyMobileRotation();
  renderSky();
});

// ── Konexio egoera / Online-offline ──────────────────────────────────────────
window.addEventListener('offline', () => toast('Konexiorik gabe — aldaketak ezin dira gorde', 'warn'));
window.addEventListener('online', () => toast('Konexioa berreskuratuta ✓'));

// ── PWA service worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('/sw.js').catch(() => { /* aukerazkoa */ });

boot();
