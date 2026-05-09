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
  if (window._fb) {
    clearTimeout(window._fbSaveTimer);
    window._fbSaveTimer = setTimeout(() => { window._fb.saveToCloud(state); setSyncStatus('synced'); }, 800);
    setSyncStatus('saving');
  }
}

function setSyncStatus(status) {
  const msgs = { saving:'☁️ Menyimpan...', synced:'☁️ Tersimpan di cloud', local:'💾 Tersimpan lokal' };
  const msgM = { saving:'☁️ Menyimpan...', synced:'☁️ Cloud', local:'💾 Lokal' };
  const cls  = { saving:'saving', synced:'synced', local:'local' };
  const d = document.getElementById('authStatus'), m = document.getElementById('authStatusMobile');
  if (d) { d.textContent = msgs[status]||msgs.local; d.className = 'auth-status '+(cls[status]||'local'); }
  if (m) { m.textContent = msgM[status]||msgM.local; m.className = 'auth-status '+(cls[status]||'local'); }
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
