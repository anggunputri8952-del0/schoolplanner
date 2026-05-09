// ===== UTILS =====
function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function timeToMinutes(t) { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minutesToTime(m) { return Math.floor(m/60).toString().padStart(2,'0') + ':' + (m%60).toString().padStart(2,'0'); }
function generateTimeSlots() {
  const { jamMulai, jamSelesai, durasiSlot } = state.settings;
  const start = timeToMinutes(jamMulai), end = timeToMinutes(jamSelesai), dur = Math.max(parseInt(durasiSlot)||45, 5);
  const slots = [];
  for (let t = start; t < end; t += dur) slots.push(minutesToTime(t));
  return slots;
}

// ===== STATE =====
const DEFAULT_MAPEL = [
  { id:'mat',   nama:'Matematika',  warna:'#6c63ff', ikon:'📐' },
  { id:'ipa',   nama:'IPA',         warna:'#22c55e', ikon:'🔬' },
  { id:'ips',   nama:'IPS',         warna:'#f59e0b', ikon:'🌍' },
  { id:'bind',  nama:'B. Indonesia',warna:'#3b82f6', ikon:'📖' },
  { id:'bing',  nama:'B. Inggris',  warna:'#ec4899', ikon:'🗣️' },
  { id:'pkn',   nama:'PKN',         warna:'#ef4444', ikon:'🏛️' },
  { id:'agama', nama:'Agama',       warna:'#14b8a6', ikon:'🕌' },
  { id:'pjok',  nama:'PJOK',        warna:'#f97316', ikon:'⚽' },
  { id:'seni',  nama:'Seni Budaya', warna:'#a855f7', ikon:'🎨' },
  { id:'tik',   nama:'TIK',         warna:'#06b6d4', ikon:'💻' },
];
const COLORS = ['#6c63ff','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316','#a855f7','#06b6d4','#84cc16','#e11d48','#0ea5e9','#d97706','#7c3aed'];

let state = loadState();
let editingMapelId = null, editingTugasId = null, selectedColor = COLORS[0], activeDay = 'senin', activeFilter = 'semua';

function loadState() {
  try {
    const saved = localStorage.getItem('schoolplanner');
    if (saved) {
      const p = JSON.parse(saved);
      return {
        mapel:    p.mapel    || DEFAULT_MAPEL,
        jadwal:   p.jadwal   || {},
        tugas:    p.tugas    || [],
        settings: { jamMulai:'06:15', jamSelesai:'15:15', durasiSlot:45, ...(p.settings||{}) },
        sheets:   { scriptUrl:'', connected:false, ...(p.sheets||{}) },
        pomodoro: { work:25, shortBreak:5, longBreak:15, ...(p.pomodoro||{}) }
      };
    }
  } catch(e) {}
  return { mapel:DEFAULT_MAPEL, jadwal:{}, tugas:[], settings:{jamMulai:'06:15',jamSelesai:'15:15',durasiSlot:45}, sheets:{scriptUrl:'',connected:false}, pomodoro:{work:25,shortBreak:5,longBreak:15} };
}

function saveState() {
  localStorage.setItem('schoolplanner', JSON.stringify(state));
  // Auto-push ke Sheets jika terhubung (debounce 1.5s)
  if (state.sheets.connected && state.sheets.scriptUrl) {
    clearTimeout(window._sheetsSaveTimer);
    window._sheetsSaveTimer = setTimeout(() => pushToSheets(true), 1500);
  }
}



// ===== DRAFT =====
function saveDraft(key, data) { try { localStorage.setItem('draft_'+key, JSON.stringify(data)); } catch(e) {} }
function loadDraft(key) { try { const d = localStorage.getItem('draft_'+key); return d ? JSON.parse(d) : null; } catch(e) { return null; } }
function clearDraft(key) { localStorage.removeItem('draft_'+key); }
function autosaveForm(key, ids) { const d={}; ids.forEach(id=>{const el=document.getElementById(id);if(el)d[id]=el.value;}); saveDraft(key,d); }
function attachAutosave(key, ids) { ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener('input',()=>autosaveForm(key,ids));el.addEventListener('change',()=>autosaveForm(key,ids));}); }

// ===== TOAST =====
function showToast(msg, type='default') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast-base show '+type;
  clearTimeout(t._timer); t._timer = setTimeout(()=>{t.className='toast-base';}, 3000);
}

// ===== NAV =====
function initNav() {
  document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const page = btn.dataset.page;
      document.querySelectorAll(`[data-page="${page}"]`).forEach(b => b.classList.add('active'));
      const pageEl = document.getElementById('page-'+page);
      if (!pageEl) return;
      pageEl.classList.add('active');
      pageEl.classList.remove('anim-page'); void pageEl.offsetWidth; pageEl.classList.add('anim-page');
      window.scrollTo({top:0,behavior:'smooth'});
      if (page === 'overview') renderOverview();
      if (page === 'pomodoro') initPomodoroUI();
    });
  });
}

function initDate() {
  const days=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'], months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const now = new Date();
  const el = document.getElementById('todayDate');
  if (el) el.textContent = days[now.getDay()]+', '+now.getDate()+' '+months[now.getMonth()]+' '+now.getFullYear();
}

// ===== DEADLINE HELPERS =====
function getDeadlineStatus(deadline) {
  if (!deadline) return { label:'Tanpa deadline', cls:'deadline-ok' };
  const p = deadline.split('-').map(Number);
  const d = new Date(p[0],p[1]-1,p[2]);
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.ceil((d-now)/86400000);
  if (diff < 0)  return { label:`Terlambat ${Math.abs(diff)} hari`, cls:'deadline-late' };
  if (diff === 0) return { label:'Hari ini!', cls:'deadline-soon' };
  if (diff <= 3)  return { label:`${diff} hari lagi`, cls:'deadline-soon' };
  return { label:`${diff} hari lagi`, cls:'deadline-ok' };
}
function formatDeadline(deadline) {
  if (!deadline) return '-';
  const p = deadline.split('-').map(Number);
  return new Date(p[0],p[1]-1,p[2]).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}

// ===== JADWAL =====
function renderJadwal() {
  const slots = generateTimeSlots();
  const timeSlotEl = document.getElementById('timeSlots');
  const gridEl = document.getElementById('scheduleGrid');
  if (!timeSlotEl || !gridEl) return;
  const slotH = 60, startMin = timeToMinutes(state.settings.jamMulai);

  timeSlotEl.innerHTML = '';
  slots.forEach(t => {
    const div = document.createElement('div');
    div.className = 'time-slot'; div.textContent = t;
    timeSlotEl.appendChild(div);
  });

  gridEl.innerHTML = '';
  gridEl.style.minHeight = (slots.length * slotH) + 'px';
  slots.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'schedule-slot'; div.dataset.slot = i; div.dataset.time = t;
    gridEl.appendChild(div);
  });

  const dayJadwal = state.jadwal[activeDay] || [];
  dayJadwal.forEach(item => {
    const mapel = state.mapel.find(m => m.id === item.mapelId);
    if (!mapel) return;
    const dur = Math.max(parseInt(state.settings.durasiSlot)||45, 5);
    const topOffset = ((timeToMinutes(item.jamMulai) - startMin) / dur) * slotH;
    const height = Math.max(((timeToMinutes(item.jamSelesai) - timeToMinutes(item.jamMulai)) / dur) * slotH - 4, 32);

    const el = document.createElement('div');
    el.className = 'schedule-item';
    el.style.cssText = `top:${topOffset}px;height:${height}px;background:${mapel.warna}22;border-left-color:${mapel.warna};`;

    const nameEl = document.createElement('div'); nameEl.className = 'item-name'; nameEl.textContent = mapel.ikon+' '+mapel.nama;
    const timeEl = document.createElement('div'); timeEl.className = 'item-time'; timeEl.textContent = item.jamMulai+' – '+item.jamSelesai;
    el.appendChild(nameEl); el.appendChild(timeEl);
    if (item.guru) { const g = document.createElement('div'); g.className='item-guru'; g.textContent='👤 '+item.guru; el.appendChild(g); }
    if (item.ruangan) { const r = document.createElement('div'); r.className='item-guru'; r.textContent='🚪 '+item.ruangan; el.appendChild(r); }

    const delBtn = document.createElement('button');
    delBtn.className = 'item-delete'; delBtn.title = 'Hapus'; delBtn.textContent = '✕';
    delBtn.addEventListener('click', e => { e.stopPropagation(); hapusJadwal(item.id); });
    el.appendChild(delBtn);
    el.addEventListener('click', () => openModalMapel(item.id));
    gridEl.appendChild(el);
  });

  if (dayJadwal.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-schedule';
    empty.innerHTML = '<div class="empty-icon">📭</div><p>Belum ada jadwal untuk hari ini</p>';
    gridEl.appendChild(empty);
  }
  detectConflicts(dayJadwal);
}

function detectConflicts(jadwal) {
  const sorted = [...jadwal].sort((a,b) => timeToMinutes(a.jamMulai)-timeToMinutes(b.jamMulai));
  let conflict = false;
  for (let i = 0; i < sorted.length-1; i++) {
    if (timeToMinutes(sorted[i].jamSelesai) > timeToMinutes(sorted[i+1].jamMulai)) { conflict = true; break; }
  }
  const warn = document.getElementById('conflictWarning');
  if (warn) warn.style.display = conflict ? 'flex' : 'none';
}

function hapusJadwal(id) {
  state.jadwal[activeDay] = (state.jadwal[activeDay]||[]).filter(j => j.id !== id);
  saveState(); renderJadwal(); showToast('Jadwal dihapus','success');
}

function initDayTabs() {
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active'); activeDay = tab.dataset.day; renderJadwal();
    });
  });
  const dayMap = {0:'minggu',1:'senin',2:'selasa',3:'rabu',4:'kamis',5:'jumat',6:'sabtu'};
  const todayKey = dayMap[new Date().getDay()];
  document.querySelectorAll('.day-tab').forEach(t => { if (t.dataset.day === todayKey) t.classList.add('today'); });
}

// ===== MODAL JADWAL =====
const JADWAL_FIELDS = ['mapelSelect','hariSelect','jamMulaiMapel','jamSelesaiMapel','namaGuru','ruangan'];

function openModalMapel(editId = null) {
  editingMapelId = editId;
  const modal = document.getElementById('modalMapel');
  const title = document.getElementById('modalMapelTitle');
  const sel = document.getElementById('mapelSelect');
  sel.innerHTML = state.mapel.map(m => `<option value="${sanitize(m.id)}">${sanitize(m.ikon)} ${sanitize(m.nama)}</option>`).join('');

  if (editId) {
    title.textContent = 'Edit Jadwal'; clearDraft('jadwal');
    let item = null;
    Object.values(state.jadwal).forEach(arr => { const f = arr.find(j => j.id === editId); if (f) item = f; });
    if (item) {
      sel.value = item.mapelId;
      document.getElementById('hariSelect').value = item.hari || activeDay;
      document.getElementById('jamMulaiMapel').value = item.jamMulai;
      document.getElementById('jamSelesaiMapel').value = item.jamSelesai;
      document.getElementById('namaGuru').value = item.guru || '';
      document.getElementById('ruangan').value = item.ruangan || '';
    }
  } else {
    title.textContent = 'Tambah Mapel';
    const draft = loadDraft('jadwal');
    if (draft) { JADWAL_FIELDS.forEach(id => { const el=document.getElementById(id); if(el&&draft[id]!==undefined)el.value=draft[id]; }); }
    else {
      document.getElementById('hariSelect').value = activeDay;
      document.getElementById('jamMulaiMapel').value = state.settings.jamMulai;
      document.getElementById('jamSelesaiMapel').value = minutesToTime(timeToMinutes(state.settings.jamMulai)+(parseInt(state.settings.durasiSlot)||45));
      document.getElementById('namaGuru').value = ''; document.getElementById('ruangan').value = '';
    }
    attachAutosave('jadwal', JADWAL_FIELDS);
  }
  modal.classList.add('open');
  setTimeout(() => document.getElementById('mapelSelect')?.focus(), 100);
}

function closeModalMapel() { document.getElementById('modalMapel').classList.remove('open'); editingMapelId = null; }

function saveModalMapel() {
  const mapelId = document.getElementById('mapelSelect').value;
  const hari = document.getElementById('hariSelect').value;
  const jamMulai = document.getElementById('jamMulaiMapel').value;
  const jamSelesai = document.getElementById('jamSelesaiMapel').value;
  const guru = document.getElementById('namaGuru').value.trim();
  const ruangan = document.getElementById('ruangan').value.trim();

  if (!mapelId || !jamMulai || !jamSelesai) { showToast('Lengkapi data jadwal!','error'); return; }
  if (timeToMinutes(jamMulai) >= timeToMinutes(jamSelesai)) { showToast('Jam mulai harus sebelum jam selesai!','error'); return; }

  if (!state.jadwal[hari]) state.jadwal[hari] = [];
  if (editingMapelId) {
    Object.keys(state.jadwal).forEach(d => { state.jadwal[d] = state.jadwal[d].filter(j => j.id !== editingMapelId); });
    state.jadwal[hari].push({ id:editingMapelId, mapelId, hari, jamMulai, jamSelesai, guru, ruangan });
  } else {
    state.jadwal[hari].push({ id:genId(), mapelId, hari, jamMulai, jamSelesai, guru, ruangan });
  }
  state.jadwal[hari].sort((a,b) => timeToMinutes(a.jamMulai)-timeToMinutes(b.jamMulai));
  saveState(); activeDay = hari;
  document.querySelectorAll('.day-tab').forEach(t => t.classList.toggle('active', t.dataset.day === hari));
  renderJadwal(); closeModalMapel(); clearDraft('jadwal');
  showToast('Jadwal disimpan!','success');
}

// ===== TUGAS =====
function renderTugas() {
  const list = document.getElementById('tugasList');
  if (!list) return;
  let items = [...state.tugas];

  if (activeFilter === 'belum') items = items.filter(t => !t.selesai);
  else if (activeFilter === 'selesai') items = items.filter(t => t.selesai);
  else if (activeFilter === 'hari-ini') {
    const today = new Date(); today.setHours(0,0,0,0);
    items = items.filter(t => { if(!t.deadline)return false; const p=t.deadline.split('-').map(Number); return new Date(p[0],p[1]-1,p[2]).getTime()===today.getTime(); });
  } else if (activeFilter === 'terlambat') {
    const now = new Date(); now.setHours(0,0,0,0);
    items = items.filter(t => { if(t.selesai||!t.deadline)return false; const p=t.deadline.split('-').map(Number); return new Date(p[0],p[1]-1,p[2])<now; });
  }

  const pOrder = { tinggi:0, sedang:1, rendah:2 };
  items.sort((a,b) => {
    if (a.selesai !== b.selesai) return a.selesai ? 1 : -1;
    const pa = pOrder[a.prioritas||'sedang']??1, pb = pOrder[b.prioritas||'sedang']??1;
    if (pa !== pb) return pa - pb;
    if (!a.deadline) return 1; if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  if (items.length === 0) { list.innerHTML = '<div class="empty-tugas"><div class="empty-icon">✅</div><p>Tidak ada tugas di sini</p></div>'; return; }

  const tipeBadge = { pr:'badge-pr', tugas:'badge-tugas', ulangan:'badge-ulangan', proyek:'badge-proyek' };
  const tipeLabel = { pr:'PR', tugas:'Tugas', ulangan:'Ulangan', proyek:'Proyek' };
  const prioIcon  = { tinggi:'🔴', sedang:'🟡', rendah:'🟢' };

  list.innerHTML = '';
  items.forEach(t => {
    const mapel = state.mapel.find(m => m.id === t.mapelId);
    const ds = getDeadlineStatus(t.deadline);
    const prio = t.prioritas || 'sedang';

    const item = document.createElement('div');
    item.className = 'tugas-item'+(t.selesai?' selesai':'');

    const cb = document.createElement('div');
    cb.className = 'tugas-checkbox'+(t.selesai?' checked':'');
    cb.textContent = t.selesai ? '✓' : ''; cb.title = 'Tandai selesai';
    cb.addEventListener('click', e => { e.stopPropagation(); toggleTugas(t.id); });

    const content = document.createElement('div'); content.className = 'tugas-content';

    const judulRow = document.createElement('div'); judulRow.className = 'tugas-judul-row';
    const judulEl = document.createElement('span'); judulEl.className = 'tugas-judul'; judulEl.textContent = t.judul;
    const prioEl = document.createElement('span'); prioEl.className = 'prio-icon'; prioEl.title = 'Prioritas '+prio; prioEl.textContent = prioIcon[prio]||'🟡';
    judulRow.appendChild(judulEl); judulRow.appendChild(prioEl); content.appendChild(judulRow);

    const meta = document.createElement('div'); meta.className = 'tugas-meta';
    if (mapel) { const ms=document.createElement('span'); ms.className='tugas-meta-item'; ms.style.color=mapel.warna; ms.textContent=mapel.ikon+' '+mapel.nama; meta.appendChild(ms); }
    if (t.guru) { const gs=document.createElement('span'); gs.className='tugas-meta-item'; gs.textContent='👤 '+t.guru; meta.appendChild(gs); }
    const ds2=document.createElement('span'); ds2.className='tugas-meta-item'; ds2.textContent='📅 '+formatDeadline(t.deadline); meta.appendChild(ds2);
    const badge=document.createElement('span'); badge.className='badge '+(tipeBadge[t.tipe]||'badge-tugas'); badge.textContent=tipeLabel[t.tipe]||t.tipe; meta.appendChild(badge);
    const dlBadge=document.createElement('span'); dlBadge.className='deadline-badge '+ds.cls; dlBadge.textContent=ds.label; meta.appendChild(dlBadge);
    content.appendChild(meta);

    if (t.catatan) { const cat=document.createElement('div'); cat.className='tugas-catatan'; cat.textContent='📌 '+t.catatan; content.appendChild(cat); }

    if (t.subtasks && t.subtasks.length > 0) {
      const done = t.subtasks.filter(s=>s.done).length;
      const stBar = document.createElement('div'); stBar.className = 'subtask-bar';
      stBar.innerHTML = `<div class="subtask-progress"><div class="subtask-fill" style="width:${Math.round(done/t.subtasks.length*100)}%"></div></div><span class="subtask-label">${done}/${t.subtasks.length} subtask</span>`;
      content.appendChild(stBar);
    }

    const actions = document.createElement('div'); actions.className = 'tugas-actions';
    const editBtn = document.createElement('button'); editBtn.className='btn-icon'; editBtn.title='Edit'; editBtn.textContent='✏️';
    editBtn.addEventListener('click', e => { e.stopPropagation(); openModalTugas(t.id); });
    const delBtn = document.createElement('button'); delBtn.className='btn-icon danger'; delBtn.title='Hapus'; delBtn.textContent='🗑️';
    delBtn.addEventListener('click', e => { e.stopPropagation(); hapusTugas(t.id); });
    actions.appendChild(editBtn); actions.appendChild(delBtn);

    item.appendChild(cb); item.appendChild(content); item.appendChild(actions);
    list.appendChild(item);
  });
  renderDeadlineAlert();
}

function renderDeadlineAlert() {
  const banner = document.getElementById('deadlineAlert');
  if (!banner) return;
  const now = new Date(); now.setHours(0,0,0,0);
  const urgent = state.tugas.filter(t => {
    if (t.selesai || !t.deadline) return false;
    const p = t.deadline.split('-').map(Number);
    return (new Date(p[0],p[1]-1,p[2]) - now) / 86400000 <= 1;
  });
  if (urgent.length > 0) {
    banner.style.display = 'flex';
    banner.querySelector('.alert-text').textContent = `⚠️ ${urgent.length} tugas deadline hari ini atau besok!`;
  } else { banner.style.display = 'none'; }
}

function toggleTugas(id) {
  const t = state.tugas.find(t => t.id === id);
  if (t) { t.selesai = !t.selesai; saveState(); renderTugas(); syncStatusToSheets(id, t.selesai); }
}

function hapusTugas(id) {
  if (!confirm('Hapus tugas ini?')) return;
  state.tugas = state.tugas.filter(t => t.id !== id);
  saveState(); renderTugas(); showToast('Tugas dihapus','success');
}

function initFilterBar() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); activeFilter = btn.dataset.filter; renderTugas();
    });
  });
}

// ===== MODAL TUGAS =====
const TUGAS_FIELDS = ['judulTugas','mapelTugas','guruTugas','deadlineTugas','tipeTugas','prioritasTugas','catatanTugas'];
let subtaskList = [];

function openModalTugas(editId = null) {
  editingTugasId = editId;
  const modal = document.getElementById('modalTugas');
  document.getElementById('modalTugasTitle').textContent = editId ? 'Edit Tugas' : 'Tambah Tugas';
  const sel = document.getElementById('mapelTugas');
  sel.innerHTML = state.mapel.map(m => `<option value="${sanitize(m.id)}">${sanitize(m.ikon)} ${sanitize(m.nama)}</option>`).join('');
  subtaskList = [];

  if (editId) {
    clearDraft('tugas');
    const t = state.tugas.find(t => t.id === editId);
    if (t) {
      document.getElementById('judulTugas').value = t.judul;
      sel.value = t.mapelId;
      document.getElementById('guruTugas').value = t.guru || '';
      document.getElementById('deadlineTugas').value = t.deadline || '';
      document.getElementById('tipeTugas').value = t.tipe || 'pr';
      document.getElementById('prioritasTugas').value = t.prioritas || 'sedang';
      document.getElementById('catatanTugas').value = t.catatan || '';
      subtaskList = (t.subtasks||[]).map(s => ({...s}));
    }
  } else {
    const draft = loadDraft('tugas');
    if (draft) { TUGAS_FIELDS.forEach(id => { const el=document.getElementById(id); if(el&&draft[id]!==undefined)el.value=draft[id]; }); }
    else {
      document.getElementById('judulTugas').value = '';
      document.getElementById('guruTugas').value = '';
      document.getElementById('deadlineTugas').value = '';
      document.getElementById('tipeTugas').value = 'pr';
      document.getElementById('prioritasTugas').value = 'sedang';
      document.getElementById('catatanTugas').value = '';
    }
    attachAutosave('tugas', TUGAS_FIELDS);
  }
  renderSubtaskList();
  modal.classList.add('open');
  setTimeout(() => document.getElementById('judulTugas')?.focus(), 100);
}

function closeModalTugas() { document.getElementById('modalTugas').classList.remove('open'); editingTugasId = null; subtaskList = []; }

function saveModalTugas() {
  const judul = document.getElementById('judulTugas').value.trim();
  const mapelId = document.getElementById('mapelTugas').value;
  const guru = document.getElementById('guruTugas').value.trim();
  const deadline = document.getElementById('deadlineTugas').value;
  const tipe = document.getElementById('tipeTugas').value;
  const prioritas = document.getElementById('prioritasTugas').value;
  const catatan = document.getElementById('catatanTugas').value.trim();
  if (!judul) { showToast('Judul tugas wajib diisi!','error'); return; }

  const subtasks = subtaskList.filter(s => s.text.trim()).map(s => ({ id:s.id||genId(), text:s.text.trim(), done:s.done||false }));

  if (editingTugasId) {
    const idx = state.tugas.findIndex(t => t.id === editingTugasId);
    if (idx !== -1) state.tugas[idx] = { ...state.tugas[idx], judul, mapelId, guru, deadline, tipe, prioritas, catatan, subtasks };
  } else {
    state.tugas.push({ id:genId(), judul, mapelId, guru, deadline, tipe, prioritas, catatan, subtasks, selesai:false, createdAt:Date.now() });
  }
  saveState(); renderTugas(); closeModalTugas(); clearDraft('tugas');
  showToast('Tugas disimpan!','success');
}

function renderSubtaskList() {
  const container = document.getElementById('subtaskContainer');
  if (!container) return;
  container.innerHTML = '';
  subtaskList.forEach((s, i) => {
    const row = document.createElement('div'); row.className = 'subtask-row';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=s.done;
    cb.addEventListener('change', () => { subtaskList[i].done = cb.checked; });
    const inp = document.createElement('input'); inp.type='text'; inp.className='subtask-input'; inp.value=s.text; inp.placeholder='Subtask...';
    inp.addEventListener('input', () => { subtaskList[i].text = inp.value; });
    const del = document.createElement('button'); del.className='subtask-del'; del.textContent='✕'; del.type='button';
    del.addEventListener('click', () => { subtaskList.splice(i,1); renderSubtaskList(); });
    row.appendChild(cb); row.appendChild(inp); row.appendChild(del);
    container.appendChild(row);
  });
}

function addSubtask() {
  subtaskList.push({ id:genId(), text:'', done:false });
  renderSubtaskList();
  const inputs = document.querySelectorAll('.subtask-input');
  if (inputs.length) inputs[inputs.length-1].focus();
}

// ===== SETTINGS =====
function renderSettings() {
  const { jamMulai, jamSelesai, durasiSlot } = state.settings;
  const jm=document.getElementById('jamMulai'), js=document.getElementById('jamSelesai'), ds=document.getElementById('durasiSlot');
  if (jm) jm.value=jamMulai; if (js) js.value=jamSelesai; if (ds) ds.value=durasiSlot;

  const list = document.getElementById('mapelList');
  if (!list) return;
  list.innerHTML = '';
  state.mapel.forEach(m => {
    const row = document.createElement('div'); row.className = 'mapel-item';
    row.innerHTML = `<div class="mapel-color" style="background:${sanitize(m.warna)}"></div><span class="mapel-icon">${sanitize(m.ikon)}</span><span class="mapel-name">${sanitize(m.nama)}</span>`;
    const del = document.createElement('button'); del.className='btn-icon danger'; del.title='Hapus'; del.textContent='🗑️';
    del.addEventListener('click', () => {
      if (!confirm('Hapus mata pelajaran ini? Jadwal terkait juga akan terhapus.')) return;
      state.mapel = state.mapel.filter(x => x.id !== m.id);
      Object.keys(state.jadwal).forEach(day => { state.jadwal[day]=(state.jadwal[day]||[]).filter(j=>j.mapelId!==m.id); });
      const fallback = state.mapel[0]?.id || '';
      state.tugas.forEach(t => { if (t.mapelId === m.id) t.mapelId = fallback; });
      saveState(); renderSettings(); renderJadwal(); renderTugas();
      showToast('Mata pelajaran dihapus','success');
    });
    row.appendChild(del); list.appendChild(row);
  });
}

// ===== MODAL MAPEL BARU =====
const MAPEL_BARU_FIELDS = ['namaMapelBaru','ikonMapel'];

function initColorPicker() {
  const container = document.getElementById('colorOptions');
  if (!container) return;
  container.innerHTML = COLORS.map(c => `<div class="color-option ${c===selectedColor?'selected':''}" style="background:${c}" data-color="${c}"></div>`).join('');
  container.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      selectedColor = opt.dataset.color;
      container.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

function openModalMapelBaru() {
  const draft = loadDraft('mapelBaru');
  if (draft) {
    document.getElementById('namaMapelBaru').value = draft.namaMapelBaru||'';
    document.getElementById('ikonMapel').value = draft.ikonMapel||'';
    selectedColor = draft.selectedColor || COLORS[0];
  } else {
    selectedColor = COLORS[0];
    document.getElementById('namaMapelBaru').value = '';
    document.getElementById('ikonMapel').value = '';
  }
  initColorPicker();
  attachAutosave('mapelBaru', MAPEL_BARU_FIELDS);
  document.getElementById('modalMapelBaru').classList.add('open');
  setTimeout(() => document.getElementById('namaMapelBaru')?.focus(), 100);
}

function closeModalMapelBaru() { document.getElementById('modalMapelBaru').classList.remove('open'); }

function saveModalMapelBaru() {
  const nama = document.getElementById('namaMapelBaru').value.trim();
  const ikon = document.getElementById('ikonMapel').value.trim() || '📚';
  if (!nama) { showToast('Nama mapel wajib diisi!','error'); return; }
  if (state.mapel.some(m => m.nama.toLowerCase() === nama.toLowerCase())) { showToast('Mata pelajaran sudah ada!','error'); return; }
  state.mapel.push({ id:genId(), nama, warna:selectedColor, ikon });
  saveState(); renderSettings(); closeModalMapelBaru(); clearDraft('mapelBaru');
  showToast('Mata pelajaran ditambahkan!','success');
}

// ===== OVERVIEW =====
function renderOverview() {
  const container = document.getElementById('overviewContent');
  if (!container) return;
  const days = ['senin','selasa','rabu','kamis','jumat'];
  const dayLabel = { senin:'Senin',selasa:'Selasa',rabu:'Rabu',kamis:'Kamis',jumat:'Jumat' };
  const now = new Date(); now.setHours(0,0,0,0);

  // Stats
  const total=state.tugas.length, selesai=state.tugas.filter(t=>t.selesai).length;
  const pct = total>0 ? Math.round(selesai/total*100) : 0;
  const upcoming = state.tugas.filter(t => {
    if (t.selesai||!t.deadline) return false;
    const p=t.deadline.split('-').map(Number);
    return (new Date(p[0],p[1]-1,p[2])-now)/86400000 <= 7;
  });

  let html = `<div class="overview-stats">
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Total Tugas</div></div>
    <div class="stat-card"><div class="stat-num">${selesai}</div><div class="stat-label">Selesai</div></div>
    <div class="stat-card"><div class="stat-num">${pct}%</div><div class="stat-label">Progress</div></div>
    <div class="stat-card"><div class="stat-num">${upcoming.length}</div><div class="stat-label">Mendatang</div></div>
  </div>`;

  // Week schedule
  html += '<div class="overview-section-title">🗓️ Jadwal Minggu Ini</div><div class="overview-week">';
  days.forEach(d => {
    const jadwal = state.jadwal[d] || [];
    html += `<div class="overview-day"><div class="overview-day-label">${dayLabel[d]}</div>`;
    if (jadwal.length === 0) { html += '<div class="overview-empty">—</div>'; }
    else {
      jadwal.forEach(j => {
        const mapel = state.mapel.find(m => m.id === j.mapelId);
        if (!mapel) return;
        html += `<div class="overview-slot" style="background:${mapel.warna}22;border-left:3px solid ${mapel.warna}" title="${sanitize(mapel.nama)} ${j.jamMulai}-${j.jamSelesai}"><span>${sanitize(mapel.ikon)}</span><span class="overview-slot-name">${sanitize(mapel.nama)}</span><span class="overview-slot-time">${j.jamMulai}</span></div>`;
      });
    }
    html += '</div>';
  });
  html += '</div>';

  // Upcoming tasks
  html += '<div class="overview-section-title">📅 Tugas 7 Hari ke Depan</div>';
  const upcomingSorted = upcoming.map(t => {
    const p=t.deadline.split('-').map(Number);
    return { ...t, _diff: Math.ceil((new Date(p[0],p[1]-1,p[2])-now)/86400000) };
  }).sort((a,b) => a._diff-b._diff);

  if (upcomingSorted.length === 0) {
    html += '<div class="overview-no-task">Tidak ada tugas mendatang 🎉</div>';
  } else {
    html += '<div class="overview-task-list">';
    upcomingSorted.forEach(t => {
      const mapel = state.mapel.find(m => m.id === t.mapelId);
      const ds = getDeadlineStatus(t.deadline);
      html += `<div class="overview-task-item"><span class="overview-task-mapel" style="color:${mapel?.warna||'var(--text2)'}">${sanitize(mapel?.ikon||'📝')}</span><span class="overview-task-judul">${sanitize(t.judul)}</span><span class="deadline-badge ${ds.cls}">${ds.label}</span></div>`;
    });
    html += '</div>';
  }
  container.innerHTML = html;
}

// ===== POMODORO =====
let pomState = { mode:'work', timeLeft:0, running:false, sessions:0 };
let pomInterval = null;

function initPomodoroUI() {
  const { work, shortBreak, longBreak } = state.pomodoro;
  document.getElementById('pomWork').value = work;
  document.getElementById('pomShort').value = shortBreak;
  document.getElementById('pomLong').value = longBreak;
  if (!pomState.running) { pomState.timeLeft = work*60; pomState.mode = 'work'; }
  updatePomDisplay();
}

function updatePomDisplay() {
  const m = Math.floor(pomState.timeLeft/60).toString().padStart(2,'0');
  const s = (pomState.timeLeft%60).toString().padStart(2,'0');
  const el = document.getElementById('pomTimer');
  if (el) el.textContent = m+':'+s;
  const modeNames = { work:'🍅 Fokus', shortBreak:'☕ Istirahat Pendek', longBreak:'🛌 Istirahat Panjang' };
  const label = document.getElementById('pomModeLabel');
  if (label) label.textContent = modeNames[pomState.mode]||'';
  const startBtn = document.getElementById('pomStart');
  if (startBtn) startBtn.textContent = pomState.running ? '⏸ Pause' : '▶ Mulai';
  const sessEl = document.getElementById('pomSessions');
  if (sessEl) sessEl.textContent = 'Sesi: '+pomState.sessions;
}

function pomTick() {
  if (pomState.timeLeft > 0) { pomState.timeLeft--; updatePomDisplay(); return; }
  clearInterval(pomInterval); pomInterval = null; pomState.running = false;
  if (pomState.mode === 'work') {
    pomState.sessions++;
    pomState.mode = (pomState.sessions % 4 === 0) ? 'longBreak' : 'shortBreak';
    pomState.timeLeft = (pomState.mode==='longBreak' ? state.pomodoro.longBreak : state.pomodoro.shortBreak) * 60;
    showToast('Waktu istirahat! 🎉','success');
  } else {
    pomState.mode = 'work'; pomState.timeLeft = state.pomodoro.work * 60;
    showToast('Waktunya fokus! 🍅','default');
  }
  updatePomDisplay(); startPomodoro();
}

function startPomodoro() {
  if (pomState.running) { clearInterval(pomInterval); pomInterval=null; pomState.running=false; }
  else { pomState.running=true; pomInterval=setInterval(pomTick,1000); }
  updatePomDisplay();
}

function resetPomodoro() {
  clearInterval(pomInterval); pomInterval=null;
  pomState = { mode:'work', timeLeft:state.pomodoro.work*60, running:false, sessions:0 };
  updatePomDisplay();
}

function savePomSettings() {
  const w=parseInt(document.getElementById('pomWork').value)||25;
  const sb=parseInt(document.getElementById('pomShort').value)||5;
  const lb=parseInt(document.getElementById('pomLong').value)||15;
  state.pomodoro = { work:w, shortBreak:sb, longBreak:lb };
  saveState();
  if (!pomState.running) { pomState.timeLeft=w*60; pomState.mode='work'; updatePomDisplay(); }
  showToast('Pengaturan Pomodoro disimpan!','success');
}

// ===== GOOGLE APPS SCRIPT CODE =====
const APPS_SCRIPT_CODE = `/**
 * SchoolPlanner - Google Apps Script Backend
 * Deploy: Execute as Me, Who has access: Anyone
 */
const SPREADSHEET_ID = 'GANTI_DENGAN_SPREADSHEET_ID_KAMU';
const SHEET_TUGAS = 'Tugas', SHEET_JADWAL = 'Jadwal';

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  try {
    const action = e.parameter.action || 'getTugas';
    if (action === 'ping')     return makeResponse({ ok:true, message:'SchoolPlanner API aktif ✅' });
    if (action === 'getTugas') return makeResponse({ ok:true, data:getTugasData() });
    if (action === 'getAll')   return makeResponse({ ok:true, tugas:getTugasData(), jadwal:getJadwalData() });
    return makeResponse({ ok:false, error:'Action tidak dikenal' });
  } catch(err) { return makeResponse({ ok:false, error:err.toString() }); }
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'addTugas')     { addTugasRow(body.data);                return makeResponse({ ok:true }); }
    if (body.action === 'updateStatus') { updateTugasStatus(body.id,body.status); return makeResponse({ ok:true }); }
    if (body.action === 'deleteTugas')  { deleteTugasRow(body.id);               return makeResponse({ ok:true }); }
    if (body.action === 'syncTugas')    { syncAllTugas(body.data);               return makeResponse({ ok:true }); }
    return makeResponse({ ok:false, error:'Action tidak dikenal' });
  } catch(err) { return makeResponse({ ok:false, error:err.toString() }); }
}
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#4a4a6a').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
const TUGAS_HEADERS = ['ID','Judul','Mata Pelajaran','Guru','Deadline','Tipe','Catatan','Status','Dibuat'];
function getTugasData() {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return [];
  return sheet.getRange(2,1,lastRow-1,TUGAS_HEADERS.length).getValues().filter(r=>r[0]).map(r=>({
    id:r[0].toString(), judul:r[1].toString(), mapelNama:r[2].toString(), guru:r[3].toString(),
    deadline:r[4]?Utilities.formatDate(new Date(r[4]),'Asia/Jakarta','yyyy-MM-dd'):'',
    tipe:r[5].toString()||'pr', catatan:r[6].toString(),
    selesai:r[7].toString().toLowerCase()==='selesai', createdAt:r[8]?new Date(r[8]).getTime():Date.now()
  }));
}
function addTugasRow(data) {
  getOrCreateSheet(SHEET_TUGAS,TUGAS_HEADERS).appendRow([data.id,data.judul,data.mapelNama||'',data.guru||'',data.deadline||'',data.tipe||'pr',data.catatan||'',data.selesai?'Selesai':'Belum',new Date()]);
}
function updateTugasStatus(id, status) {
  const sheet=getOrCreateSheet(SHEET_TUGAS,TUGAS_HEADERS), lastRow=sheet.getLastRow(); if(lastRow<2)return;
  const ids=sheet.getRange(2,1,lastRow-1,1).getValues();
  for(let i=0;i<ids.length;i++){if(ids[i][0].toString()===id.toString()){sheet.getRange(i+2,8).setValue(status?'Selesai':'Belum');return;}}
}
function deleteTugasRow(id) {
  const sheet=getOrCreateSheet(SHEET_TUGAS,TUGAS_HEADERS), lastRow=sheet.getLastRow(); if(lastRow<2)return;
  const ids=sheet.getRange(2,1,lastRow-1,1).getValues();
  for(let i=ids.length-1;i>=0;i--){if(ids[i][0].toString()===id.toString()){sheet.deleteRow(i+2);return;}}
}
function syncAllTugas(tugasList) {
  const sheet=getOrCreateSheet(SHEET_TUGAS,TUGAS_HEADERS), lastRow=sheet.getLastRow();
  if(lastRow>1)sheet.deleteRows(2,lastRow-1);
  if(tugasList&&tugasList.length>0){
    const rows=tugasList.map(t=>[t.id,t.judul,t.mapelNama||'',t.guru||'',t.deadline||'',t.tipe||'pr',t.catatan||'',t.selesai?'Selesai':'Belum',t.createdAt?new Date(t.createdAt):new Date()]);
    sheet.getRange(2,1,rows.length,TUGAS_HEADERS.length).setValues(rows);
  }
}
const JADWAL_HEADERS = ['ID','Hari','Mata Pelajaran','Jam Mulai','Jam Selesai','Guru','Ruangan'];
function getJadwalData() {
  const sheet=getOrCreateSheet(SHEET_JADWAL,JADWAL_HEADERS), lastRow=sheet.getLastRow(); if(lastRow<2)return{};
  const result={};
  sheet.getRange(2,1,lastRow-1,JADWAL_HEADERS.length).getValues().filter(r=>r[0]).forEach(r=>{
    const hari=r[1].toString().toLowerCase(); if(!result[hari])result[hari]=[];
    result[hari].push({id:r[0].toString(),hari,mapelNama:r[2].toString(),jamMulai:r[3].toString(),jamSelesai:r[4].toString(),guru:r[5].toString(),ruangan:r[6].toString()});
  });
  return result;
}`;

// ===== SHEETS UI =====
function initSheets() {
  const el = document.getElementById('scriptUrl');
  if (el) el.value = state.sheets.scriptUrl || '';
  updateConnectionUI(state.sheets.connected);
  // Auto-load preview jika sudah terhubung
  if (state.sheets.connected && state.sheets.scriptUrl) {
    pullFromSheets(true);
  }
}

function updateConnectionUI(connected) {
  ['connectionBadge','connectionBadgeDesktop'].forEach(id => {
    const b = document.getElementById(id); if (b) b.className = 'conn-badge'+(connected?' connected':'');
  });
  ['connectionLabel','connectionLabelDesktop'].forEach(id => {
    const l = document.getElementById(id); if (l) l.textContent = connected ? 'Terhubung ✅' : 'Belum terhubung';
  });
  const pingBtn=document.getElementById('btnPingScript'), discBtn=document.getElementById('btnDisconnect'), syncCard=document.getElementById('syncCard');
  if (pingBtn) pingBtn.disabled = !connected;
  if (discBtn) discBtn.disabled = !connected;
  if (syncCard) { syncCard.style.opacity=connected?'1':'0.4'; syncCard.style.pointerEvents=connected?'all':'none'; }
  clearInterval(window._autoRefreshTimer);
  if (connected) {
    let countdown = 30;
    const badge = document.getElementById('autoRefreshBadge');
    const tick = () => {
      if (badge) badge.textContent = `Auto-refresh: ${countdown}s`;
      countdown--;
      if (countdown < 0) { countdown = 30; pullFromSheets(true); }
    };
    tick(); window._autoRefreshTimer = setInterval(tick, 1000);
  } else {
    const badge = document.getElementById('autoRefreshBadge');
    if (badge) badge.textContent = 'Auto-refresh: off';
  }
}

function showSheetsStatus(msg, type, elId='sheetsStatus') {
  const el = document.getElementById(elId); if (!el) return;
  el.textContent = msg; el.className = msg ? 'status-msg '+type : 'status-msg';
}

async function connectScript() {
  const url = document.getElementById('scriptUrl').value.trim();
  if (!url) { showSheetsStatus('❌ Masukkan URL Web App terlebih dahulu','error'); return; }
  if (!url.includes('script.google.com/macros')) { showSheetsStatus('❌ URL tidak valid. Harus berupa URL Apps Script Web App','error'); return; }
  const btn = document.getElementById('btnConnectScript');
  if (btn) { btn.disabled=true; btn.textContent='🔄 Menghubungkan...'; }
  showSheetsStatus('🔄 Menghubungkan...','info');
  try {
    const res = await fetch(url+'?action=ping');
    const json = await res.json();
    if (json.ok) {
      state.sheets = { ...state.sheets, scriptUrl:url, connected:true };
      saveState(); updateConnectionUI(true);
      showSheetsStatus('✅ '+json.message,'success');
      showToast('Berhasil terhubung!','success');
      // Langsung load data dari spreadsheet
      await pullFromSheets(false);
    } else { showSheetsStatus('❌ Script error: '+json.error,'error'); }
  } catch(e) { showSheetsStatus('❌ Gagal terhubung. Pastikan URL benar dan script sudah di-deploy dengan akses "Anyone".','error'); }
  finally { if (btn) { btn.disabled=false; btn.textContent='🔌 Hubungkan'; } }
}

async function pingScript() {
  const url = state.sheets.scriptUrl; if (!url) return;
  showSheetsStatus('🏓 Mengirim ping...','info');
  try {
    const res=await fetch(url+'?action=ping'), json=await res.json();
    showSheetsStatus(json.ok?'✅ '+json.message:'❌ '+json.error, json.ok?'success':'error');
  } catch(e) { showSheetsStatus('❌ Tidak bisa menjangkau script.','error'); }
}

function disconnectScript() {
  if (!confirm('Putuskan koneksi ke Apps Script?')) return;
  state.sheets = { scriptUrl:'', connected:false }; saveState(); updateConnectionUI(false);
  const el=document.getElementById('scriptUrl'); if(el)el.value='';
  const preview=document.getElementById('sheetsPreview'); if(preview)preview.style.display='none';
  const statusEl=document.getElementById('sheetsStatus'); if(statusEl)statusEl.className='status-msg';
  showToast('Koneksi diputus','default');
}

async function pullFromSheets(silent=false) {
  const url = state.sheets.scriptUrl; if (!url) return;
  if (!silent) showSheetsStatus('⬇️ Mengambil data...','info','syncStatus');
  try {
    const res=await fetch(url+'?action=getTugas'), json=await res.json();
    if (!json.ok) throw new Error(json.error);
    const data = json.data||[];
    if (data.length===0) {
      if (!silent) showSheetsStatus('ℹ️ Spreadsheet kosong. Tugas yang kamu tambah akan otomatis tersimpan ke sini.','info','syncStatus');
      return;
    }
    // Merge: tambah yang belum ada, update status yang sudah ada
    let added=0;
    data.forEach(item => {
      if (!item.judul) return;
      const exists = state.tugas.find(t => t.id===item.id);
      if (exists) { exists.selesai=item.selesai; }
      else {
        const mapel=state.mapel.find(m=>m.nama.toLowerCase()===(item.mapelNama||'').toLowerCase());
        state.tugas.push({ id:item.id||genId(), judul:item.judul, mapelId:mapel?mapel.id:(state.mapel[0]?.id||''), guru:item.guru||'', deadline:item.deadline||'', tipe:item.tipe||'pr', catatan:item.catatan||'', prioritas:'sedang', subtasks:[], selesai:item.selesai||false, createdAt:item.createdAt||Date.now() });
        added++;
      }
    });
    if (added>0 || !silent) { saveState(); renderTugas(); }
    if (!silent) {
      renderSheetsPreview(data);
      showSheetsStatus(`✅ ${data.length} tugas dimuat (${added} baru ditambahkan)`,'success','syncStatus');
    }
  } catch(e) { if(!silent) showSheetsStatus('❌ Gagal: '+e.message,'error','syncStatus'); }
}

async function pushToSheets(silent=false) {
  const url=state.sheets.scriptUrl;
  if (!url || !state.sheets.connected) return;
  if (!state.tugas.length) { if(!silent) showSheetsStatus('⚠️ Tidak ada tugas untuk di-push','error','syncStatus'); return; }
  if (!silent) showSheetsStatus('⬆️ Mengirim data...','info','syncStatus');
  try {
    const payload=state.tugas.map(t=>{ const mapel=state.mapel.find(m=>m.id===t.mapelId); return {...t,mapelNama:mapel?mapel.nama:''}; });
    const res=await fetch(url,{method:'POST',body:JSON.stringify({action:'syncTugas',data:payload})});
    const json=await res.json(); if(!json.ok)throw new Error(json.error);
    if (!silent) {
      showSheetsStatus(`✅ ${state.tugas.length} tugas berhasil dikirim!`,'success','syncStatus');
      showToast('Push ke Sheets berhasil!','success');
    }
  } catch(e) { if(!silent) showSheetsStatus('❌ Gagal push: '+e.message,'error','syncStatus'); }
}

async function syncStatusToSheets(id, selesai) {
  if (!state.sheets.connected||!state.sheets.scriptUrl) return;
  try { await fetch(state.sheets.scriptUrl,{method:'POST',body:JSON.stringify({action:'updateStatus',id,status:selesai})}); } catch(e) {}
}

function renderSheetsPreview(data) {
  const preview=document.getElementById('sheetsPreview'), content=document.getElementById('sheetsPreviewContent');
  if (!preview||!content) return;
  preview.style.display='block'; preview._data=data;
  let html='<div style="overflow-x:auto"><table class="sheets-table"><thead><tr>';
  ['Mapel','Judul','Deadline','Guru','Status'].forEach(h=>{html+=`<th>${h}</th>`;});
  html+='</tr></thead><tbody>';
  data.slice(0,10).forEach(r=>{html+=`<tr><td>${sanitize(r.mapelNama||'-')}</td><td>${sanitize(r.judul||'-')}</td><td>${sanitize(r.deadline||'-')}</td><td>${sanitize(r.guru||'-')}</td><td>${r.selesai?'✅ Selesai':'⏳ Belum'}</td></tr>`;});
  html+='</tbody></table></div>';
  if (data.length>10) html+=`<p style="font-size:12px;color:var(--text3);margin-top:8px">...dan ${data.length-10} tugas lainnya</p>`;
  content.innerHTML=html;
}

function importFromSheets() {
  const preview=document.getElementById('sheetsPreview'), data=preview?._data; if(!data)return;
  let imported=0;
  data.forEach(item=>{
    if(!item.judul||state.tugas.find(t=>t.id===item.id))return;
    const mapel=state.mapel.find(m=>m.nama.toLowerCase()===(item.mapelNama||'').toLowerCase());
    state.tugas.push({id:item.id||genId(),judul:item.judul,mapelId:mapel?mapel.id:(state.mapel[0]?.id||''),guru:item.guru||'',deadline:item.deadline||'',tipe:item.tipe||'pr',catatan:item.catatan||'',prioritas:'sedang',subtasks:[],selesai:item.selesai||false,createdAt:item.createdAt||Date.now()});
    imported++;
  });
  saveState(); renderTugas();
  showToast(`${imported} tugas berhasil diimport!`,'success');
  showSheetsStatus(`✅ ${imported} tugas diimport`,'success','syncStatus');
}

function downloadTemplate() {
  const csv='ID,Judul,Mata Pelajaran,Guru,Deadline,Tipe,Catatan,Status,Dibuat\n,Latihan Soal Bab 3,Matematika,Bu Sari,2026-05-15,pr,,Belum,\n,Buat Puisi,B. Indonesia,Pak Budi,2026-05-20,pr,,Belum,\n';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='template_tugas_schoolplanner.csv'; a.click();
}

function copyScriptCode() {
  navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(()=>{showToast('Kode Apps Script berhasil di-copy!','success');}).catch(()=>{
    const ta=document.createElement('textarea'); ta.value=APPS_SCRIPT_CODE; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    showToast('Kode Apps Script berhasil di-copy!','success');
  });
}

// ===== INIT =====
function init() {
  initNav(); initDate(); initDayTabs(); initFilterBar();
  renderJadwal(); renderTugas(); renderSettings(); initSheets();

  // Jadwal
  ['btnTambahMapel','btnTambahMapelDesktop'].forEach(id => document.getElementById(id)?.addEventListener('click', ()=>openModalMapel()));
  document.getElementById('closeModalMapel')?.addEventListener('click', closeModalMapel);
  document.getElementById('cancelModalMapel')?.addEventListener('click', closeModalMapel);
  document.getElementById('saveModalMapel')?.addEventListener('click', saveModalMapel);
  document.getElementById('modalMapel')?.addEventListener('click', e=>{if(e.target===e.currentTarget)closeModalMapel();});

  // Tugas
  ['btnTambahTugas','btnTambahTugasDesktop'].forEach(id => document.getElementById(id)?.addEventListener('click', ()=>openModalTugas()));
  document.getElementById('closeModalTugas')?.addEventListener('click', closeModalTugas);
  document.getElementById('cancelModalTugas')?.addEventListener('click', closeModalTugas);
  document.getElementById('saveModalTugas')?.addEventListener('click', saveModalTugas);
  document.getElementById('modalTugas')?.addEventListener('click', e=>{if(e.target===e.currentTarget)closeModalTugas();});
  document.getElementById('btnAddSubtask')?.addEventListener('click', addSubtask);

  // Mapel baru
  document.getElementById('btnTambahMapelSettings')?.addEventListener('click', openModalMapelBaru);
  document.getElementById('closeModalMapelBaru')?.addEventListener('click', closeModalMapelBaru);
  document.getElementById('cancelModalMapelBaru')?.addEventListener('click', closeModalMapelBaru);
  document.getElementById('saveModalMapelBaru')?.addEventListener('click', saveModalMapelBaru);
  document.getElementById('modalMapelBaru')?.addEventListener('click', e=>{if(e.target===e.currentTarget)closeModalMapelBaru();});

  // Settings jam
  document.getElementById('btnSaveJam')?.addEventListener('click', () => {
    const jm=document.getElementById('jamMulai').value, js=document.getElementById('jamSelesai').value;
    const ds=parseInt(document.getElementById('durasiSlot').value)||45;
    if (timeToMinutes(jm)>=timeToMinutes(js)) { showToast('Jam mulai harus sebelum jam selesai!','error'); return; }
    if (ds<5||ds>240) { showToast('Durasi slot harus antara 5-240 menit!','error'); return; }
    state.settings = { ...state.settings, jamMulai:jm, jamSelesai:js, durasiSlot:ds };
    saveState(); renderJadwal(); showToast('Pengaturan jam disimpan!','success');
  });

  // Reset
  document.getElementById('btnResetData')?.addEventListener('click', () => {
    if (!confirm('Yakin ingin menghapus SEMUA data? Tindakan ini tidak bisa dibatalkan!')) return;
    localStorage.removeItem('schoolplanner'); state=loadState();
    renderJadwal(); renderTugas(); renderSettings(); initSheets();
    showToast('Semua data telah direset','success');
  });

  // Sheets
  document.getElementById('btnConnectScript')?.addEventListener('click', connectScript);
  document.getElementById('btnPingScript')?.addEventListener('click', pingScript);
  document.getElementById('btnDisconnect')?.addEventListener('click', disconnectScript);
  document.getElementById('btnPullTugas')?.addEventListener('click', ()=>pullFromSheets(false));
  document.getElementById('btnPushTugas')?.addEventListener('click', ()=>pushToSheets(false));
  document.getElementById('btnDownloadTemplate')?.addEventListener('click', downloadTemplate);
  document.getElementById('btnCopyScript')?.addEventListener('click', copyScriptCode);

  const scriptUrlEl = document.getElementById('scriptUrl');
  if (scriptUrlEl) {
    scriptUrlEl.addEventListener('input', ()=>{ state.sheets.scriptUrl=scriptUrlEl.value.trim(); saveState(); });
    scriptUrlEl.addEventListener('keydown', e=>{ if(e.key==='Enter')connectScript(); });
    // Auto-connect saat paste URL
    scriptUrlEl.addEventListener('paste', ()=>{
      setTimeout(()=>{
        const val = scriptUrlEl.value.trim();
        if (val.includes('script.google.com/macros')) connectScript();
      }, 100);
    });
  }

  // Pomodoro
  document.getElementById('pomStart')?.addEventListener('click', startPomodoro);
  document.getElementById('pomReset')?.addEventListener('click', resetPomodoro);
  document.getElementById('pomSave')?.addEventListener('click', savePomSettings);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') { closeModalMapel(); closeModalTugas(); closeModalMapelBaru(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
