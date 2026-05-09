// ===== UTILS =====
function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m) {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return h + ':' + min;
}

function generateTimeSlots() {
  const { jamMulai, jamSelesai, durasiSlot } = state.settings;
  const start = timeToMinutes(jamMulai);
  const end   = timeToMinutes(jamSelesai);
  const dur   = Math.max(parseInt(durasiSlot) || 45, 5);
  const slots = [];
  for (let t = start; t < end; t += dur) slots.push(minutesToTime(t));
  return slots;
}

// ===== STATE =====
const DEFAULT_MAPEL = [
  { id: 'mat',   nama: 'Matematika',  warna: '#6c63ff', ikon: '📐' },
  { id: 'ipa',   nama: 'IPA',         warna: '#22c55e', ikon: '🔬' },
  { id: 'ips',   nama: 'IPS',         warna: '#f59e0b', ikon: '🌍' },
  { id: 'bind',  nama: 'B. Indonesia',warna: '#3b82f6', ikon: '📖' },
  { id: 'bing',  nama: 'B. Inggris',  warna: '#ec4899', ikon: '🗣️' },
  { id: 'pkn',   nama: 'PKN',         warna: '#ef4444', ikon: '🏛️' },
  { id: 'agama', nama: 'Agama',       warna: '#14b8a6', ikon: '🕌' },
  { id: 'pjok',  nama: 'PJOK',        warna: '#f97316', ikon: '⚽' },
  { id: 'seni',  nama: 'Seni Budaya', warna: '#a855f7', ikon: '🎨' },
  { id: 'tik',   nama: 'TIK',         warna: '#06b6d4', ikon: '💻' },
];

const COLORS = [
  '#6c63ff','#3b82f6','#22c55e','#f59e0b','#ef4444',
  '#ec4899','#14b8a6','#f97316','#a855f7','#06b6d4',
  '#84cc16','#e11d48','#0ea5e9','#d97706','#7c3aed'
];

let state = loadState();
let editingMapelId = null;
let editingTugasId = null;
let selectedColor = COLORS[0];
let activeDay = 'senin';
let activeFilter = 'semua';

function loadState() {
  try {
    const saved = localStorage.getItem('schoolplanner');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return {
    mapel: DEFAULT_MAPEL,
    jadwal: {},
    tugas: [],
    settings: { jamMulai: '06:15', jamSelesai: '15:15', durasiSlot: 45 },
    sheets: { scriptUrl: '', connected: false }
  };
}

function saveState() {
  localStorage.setItem('schoolplanner', JSON.stringify(state));
  if (window._fb) {
    clearTimeout(window._fbSaveTimer);
    window._fbSaveTimer = setTimeout(() => {
      window._fb.saveToCloud(state);
      setSyncStatus('synced');
    }, 800);
    setSyncStatus('saving');
  }
}

function setSyncStatus(status) {
  const msgs       = { saving: '☁️ Menyimpan...', synced: '☁️ Tersimpan di cloud', local: '💾 Tersimpan lokal' };
  const msgsMobile = { saving: '☁️ Menyimpan...', synced: '☁️ Cloud', local: '💾 Lokal' };
  const cls        = { saving: 'saving', synced: 'synced', local: 'local' };
  const desktopEl  = document.getElementById('authStatus');
  const mobileEl   = document.getElementById('authStatusMobile');
  if (desktopEl) { desktopEl.textContent = msgs[status] || msgs.local; desktopEl.className = 'auth-status ' + (cls[status] || 'local'); }
  if (mobileEl)  { mobileEl.textContent  = msgsMobile[status] || msgsMobile.local; mobileEl.className = 'auth-status ' + (cls[status] || 'local'); }
}

// ===== DRAFT AUTOSAVE =====
function saveDraft(key, data) {
  try { localStorage.setItem('draft_' + key, JSON.stringify(data)); } catch(e) {}
}
function loadDraft(key) {
  try { const d = localStorage.getItem('draft_' + key); return d ? JSON.parse(d) : null; } catch(e) { return null; }
}
function clearDraft(key) {
  localStorage.removeItem('draft_' + key);
}

function autosaveForm(key, fieldIds) {
  const data = {};
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value;
  });
  saveDraft(key, data);
}

function restoreDraft(key, fieldIds) {
  const data = loadDraft(key);
  if (!data) return;
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && data[id] !== undefined) el.value = data[id];
  });
}

function attachAutosave(key, fieldIds) {
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  () => autosaveForm(key, fieldIds));
    el.addEventListener('change', () => autosaveForm(key, fieldIds));
  });
}

// ===== TOAST =====
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast-base show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast-base'; }, 3000);
}

// ===== NAVIGATION =====
function initNav() {
  document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const page = btn.dataset.page;
      document.querySelectorAll(`[data-page="${page}"]`).forEach(b => b.classList.add('active'));
      const pageEl = document.getElementById('page-' + page);
      pageEl.classList.add('active');
      pageEl.classList.remove('anim-page');
      void pageEl.offsetWidth;
      pageEl.classList.add('anim-page');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ===== TODAY DATE =====
function initDate() {
  const days   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const now = new Date();
  document.getElementById('todayDate').textContent =
    days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
}

const COLORS = [
  '#6c63ff','#3b82f6','#22c55e','#f59e0b','#ef4444',
  '#ec4899','#14b8a6','#f97316','#a855f7','#06b6d4',
  '#84cc16','#e11d48','#0ea5e9','#d97706','#7c3aed'
];

let state = loadState();
let editingMapelId  = null;
let editingTugasId  = null;
let selectedColor   = COLORS[0];
let activeDay       = 'senin';
let activeFilter    = 'semua';

function loadState() {
  try {
    const saved = localStorage.getItem('schoolplanner');
    if (saved) {
      const parsed = JSON.parse(saved);
      // migrate: ensure all fields exist
      return {
        mapel:    parsed.mapel    || DEFAULT_MAPEL,
        jadwal:   parsed.jadwal   || {},
        tugas:    parsed.tugas    || [],
        settings: { jamMulai:'06:15', jamSelesai:'15:15', durasiSlot:45, ...(parsed.settings||{}) },
        sheets:   { scriptUrl:'', connected:false, ...(parsed.sheets||{}) },
        pomodoro: { work:25, shortBreak:5, longBreak:15, ...(parsed.pomodoro||{}) }
      };
    }
  } catch(e) {}
  return {
    mapel: DEFAULT_MAPEL,
    jadwal: {},
    tugas: [],
    settings: { jamMulai:'06:15', jamSelesai:'15:15', durasiSlot:45 },
    sheets: { scriptUrl:'', connected:false },
    pomodoro: { work:25, shortBreak:5, longBreak:15 }
  };
}

function saveState() {
  localStorage.setItem('schoolplanner', JSON.stringify(state));
  if (window._fb) {
    clearTimeout(window._fbSaveTimer);
    window._fbSaveTimer = setTimeout(() => {
      window._fb.saveToCloud(state);
      setSyncStatus('synced');
    }, 800);
    setSyncStatus('saving');
  }
}

function setSyncStatus(status) {
  const msgs       = { saving:'☁️ Menyimpan...', synced:'☁️ Tersimpan di cloud', local:'💾 Tersimpan lokal' };
  const msgsMobile = { saving:'☁️ Menyimpan...', synced:'☁️ Cloud',              local:'💾 Lokal' };
  const cls        = { saving:'saving', synced:'synced', local:'local' };
  const d = document.getElementById('authStatus');
  const m = document.getElementById('authStatusMobile');
  if (d) { d.textContent = msgs[status]||msgs.local;       d.className = 'auth-status '+(cls[status]||'local'); }
  if (m) { m.textContent = msgsMobile[status]||msgsMobile.local; m.className = 'auth-status '+(cls[status]||'local'); }
}

// ===== DRAFT AUTOSAVE =====
function saveDraft(key, data) {
  try { localStorage.setItem('draft_'+key, JSON.stringify(data)); } catch(e) {}
}
function loadDraft(key) {
  try { const d = localStorage.getItem('draft_'+key); return d ? JSON.parse(d) : null; } catch(e) { return null; }
}
function clearDraft(key) { localStorage.removeItem('draft_'+key); }

function autosaveForm(key, fieldIds) {
  const data = {};
  fieldIds.forEach(id => { const el = document.getElementById(id); if (el) data[id] = el.value; });
  saveDraft(key, data);
}

function attachAutosave(key, fieldIds) {
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  () => autosaveForm(key, fieldIds));
    el.addEventListener('change', () => autosaveForm(key, fieldIds));
  });
}

// ===== TOAST =====
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast-base show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast-base'; }, 3000);
}

// ===== NAVIGATION =====
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
      pageEl.classList.remove('anim-page');
      void pageEl.offsetWidth;
      pageEl.classList.add('anim-page');
      window.scrollTo({ top:0, behavior:'smooth' });
      if (page === 'overview') renderOverview();
      if (page === 'pomodoro') initPomodoroUI();
    });
  });
}

// ===== TODAY DATE =====
function initDate() {
  const days   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const now = new Date();
  const el = document.getElementById('todayDate');
  if (el) el.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
}

// ===== DEADLINE HELPERS =====
function getDeadlineStatus(deadline) {
  if (!deadline) return { label:'Tanpa deadline', cls:'deadline-ok' };
  // Parse as local date to avoid timezone shift
  const parts = deadline.split('-').map(Number);
  const d = new Date(parts[0], parts[1]-1, parts[2]);
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.ceil((d - now) / 86400000);
  if (diff < 0)  return { label:`Terlambat ${Math.abs(diff)} hari`, cls:'deadline-late' };
  if (diff === 0) return { label:'Hari ini!', cls:'deadline-soon' };
  if (diff <= 3)  return { label:`${diff} hari lagi`, cls:'deadline-soon' };
  return { label:`${diff} hari lagi`, cls:'deadline-ok' };
}

function formatDeadline(deadline) {
  if (!deadline) return '-';
  const parts = deadline.split('-').map(Number);
  const d = new Date(parts[0], parts[1]-1, parts[2]);
  return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

// ===== JADWAL PAGE =====
function renderJadwal() {
  const slots    = generateTimeSlots();
  const timeSlotEl = document.getElementById('timeSlots');
  const gridEl   = document.getElementById('scheduleGrid');
  if (!timeSlotEl || !gridEl) return;

  const slotH    = 60;
  const startMin = timeToMinutes(state.settings.jamMulai);

  timeSlotEl.innerHTML = '';
  slots.forEach(t => {
    const div = document.createElement('div');
    div.className = 'time-slot';
    div.textContent = t;
    timeSlotEl.appendChild(div);
  });

  gridEl.innerHTML = '';
  gridEl.style.minHeight = (slots.length * slotH) + 'px';

  slots.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'schedule-slot';
    div.dataset.slot = i;
    div.dataset.time = t;
    gridEl.appendChild(div);
  });

  const dayJadwal = state.jadwal[activeDay] || [];

  dayJadwal.forEach(item => {
    const mapel = state.mapel.find(m => m.id === item.mapelId);
    if (!mapel) return;

    const itemStart = timeToMinutes(item.jamMulai);
    const itemEnd   = timeToMinutes(item.jamSelesai);
    const dur       = Math.max(parseInt(state.settings.durasiSlot)||45, 5);
    const topOffset = ((itemStart - startMin) / dur) * slotH;
    const height    = Math.max(((itemEnd - itemStart) / dur) * slotH - 4, 32);

    const el = document.createElement('div');
    el.className = 'schedule-item';
    el.style.cssText = `top:${topOffset}px;height:${height}px;background:${mapel.warna}22;border-left-color:${mapel.warna};`;

    const nameEl  = document.createElement('div'); nameEl.className  = 'item-name';  nameEl.textContent = mapel.ikon + ' ' + mapel.nama;
    const timeEl  = document.createElement('div'); timeEl.className  = 'item-time';  timeEl.textContent = item.jamMulai + ' – ' + item.jamSelesai;
    el.appendChild(nameEl);
    el.appendChild(timeEl);

    if (item.guru) {
      const guruEl = document.createElement('div'); guruEl.className = 'item-guru'; guruEl.textContent = '👤 ' + item.guru;
      el.appendChild(guruEl);
    }
    if (item.ruangan) {
      const ruEl = document.createElement('div'); ruEl.className = 'item-guru'; ruEl.textContent = '🚪 ' + item.ruangan;
      el.appendChild(ruEl);
    }

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

  // Conflict detection
  detectConflicts(dayJadwal);
}

function detectConflicts(jadwal) {
  const sorted = [...jadwal].sort((a,b) => timeToMinutes(a.jamMulai) - timeToMinutes(b.jamMulai));
  let hasConflict = false;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (timeToMinutes(sorted[i].jamSelesai) > timeToMinutes(sorted[i+1].jamMulai)) {
      hasConflict = true; break;
    }
  }
  const warn = document.getElementById('conflictWarning');
  if (warn) warn.style.display = hasConflict ? 'flex' : 'none';
}

function hapusJadwal(id) {
  state.jadwal[activeDay] = (state.jadwal[activeDay] || []).filter(j => j.id !== id);
  saveState(); renderJadwal();
  showToast('Jadwal dihapus', 'success');
}

function initDayTabs() {
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeDay = tab.dataset.day;
      renderJadwal();
    });
  });
  // Highlight today's tab
  const dayMap = { 0:'minggu',1:'senin',2:'selasa',3:'rabu',4:'kamis',5:'jumat',6:'sabtu' };
  const todayKey = dayMap[new Date().getDay()];
  document.querySelectorAll('.day-tab').forEach(t => {
    if (t.dataset.day === todayKey) t.classList.add('today');
  });
}

// ===== JADWAL PAGE =====
function renderJadwal() {
  const slots     = generateTimeSlots();
  const timeSlotEl = document.getElementById('timeSlots');
  const gridEl    = document.getElementById('scheduleGrid');

  timeSlotEl.innerHTML = '';
  slots.forEach(t => {
    const div = document.createElement('div');
    div.className = 'time-slot';
    div.textContent = t;
    timeSlotEl.appendChild(div);
  });

  gridEl.innerHTML = '';
  gridEl.style.minHeight = (slots.length * 60) + 'px';

  slots.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'schedule-slot';
    div.dataset.slot = i;
    div.dataset.time = t;
    gridEl.appendChild(div);
  });

  const dayJadwal = state.jadwal[activeDay] || [];
  const startMin  = timeToMinutes(state.settings.jamMulai);
  const slotH     = 60;

  dayJadwal.forEach(item => {
    const mapel = state.mapel.find(m => m.id === item.mapelId);
    if (!mapel) return;

    const itemStart = timeToMinutes(item.jamMulai);
    const itemEnd   = timeToMinutes(item.jamSelesai);
    const topOffset = ((itemStart - startMin) / state.settings.durasiSlot) * slotH;
    const height    = ((itemEnd - itemStart) / state.settings.durasiSlot) * slotH - 4;

    const el = document.createElement('div');
    el.className = 'schedule-item';
    el.style.cssText = `top:${topOffset}px; height:${Math.max(height,32)}px; background:${mapel.warna}22; border-left-color:${mapel.warna}; animation: scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both; position:absolute;`;
    el.innerHTML = `
      <div class="item-name">${mapel.ikon} ${sanitize(mapel.nama)}</div>
      <div class="item-time">${item.jamMulai} – ${item.jamSelesai}</div>
      ${item.guru    ? `<div class="item-guru">👤 ${sanitize(item.guru)}</div>`    : ''}
      ${item.ruangan ? `<div class="item-guru">🚪 ${sanitize(item.ruangan)}</div>` : ''}
      <button class="item-delete" data-id="${item.id}" title="Hapus">✕</button>
    `;
    el.querySelector('.item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      hapusJadwal(item.id);
    });
    gridEl.appendChild(el);
  });

  if (dayJadwal.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-schedule';
    empty.innerHTML = `<div class="empty-icon">📭</div><p>Belum ada jadwal untuk hari ini</p>`;
    gridEl.appendChild(empty);
  }
}

function hapusJadwal(id) {
  state.jadwal[activeDay] = (state.jadwal[activeDay] || []).filter(j => j.id !== id);
  saveState();
  renderJadwal();
  showToast('Jadwal dihapus', 'success');
}

function initDayTabs() {
  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeDay = tab.dataset.day;
      renderJadwal();
    });
  });
}

// ===== MODAL MAPEL (Jadwal) =====
const JADWAL_FIELDS = ['mapelSelect','hariSelect','jamMulaiMapel','jamSelesaiMapel','namaGuru','ruangan'];

function openModalMapel(editId = null) {
  editingMapelId = editId;
  const modal = document.getElementById('modalMapel');
  const title = document.getElementById('modalMapelTitle');

  const sel = document.getElementById('mapelSelect');
  sel.innerHTML = state.mapel.map(m => `<option value="${m.id}">${m.ikon} ${sanitize(m.nama)}</option>`).join('');

  if (editId) {
    title.textContent = 'Edit Jadwal';
    const item = (state.jadwal[activeDay] || []).find(j => j.id === editId);
    if (item) {
      sel.value = item.mapelId;
      document.getElementById('hariSelect').value    = item.hari || activeDay;
      document.getElementById('jamMulaiMapel').value  = item.jamMulai;
      document.getElementById('jamSelesaiMapel').value = item.jamSelesai;
      document.getElementById('namaGuru').value       = item.guru || '';
      document.getElementById('ruangan').value        = item.ruangan || '';
    }
  } else {
    title.textContent = 'Tambah Mapel';
    const draft = loadDraft('jadwal');
    if (draft) {
      JADWAL_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && draft[id] !== undefined) el.value = draft[id];
      });
    } else {
      document.getElementById('hariSelect').value    = activeDay;
      document.getElementById('jamMulaiMapel').value  = state.settings.jamMulai;
      document.getElementById('jamSelesaiMapel').value = minutesToTime(timeToMinutes(state.settings.jamMulai) + state.settings.durasiSlot);
      document.getElementById('namaGuru').value       = '';
      document.getElementById('ruangan').value        = '';
    }
    attachAutosave('jadwal', JADWAL_FIELDS);
  }

  modal.classList.add('open');
}

function closeModalMapel() {
  document.getElementById('modalMapel').classList.remove('open');
  editingMapelId = null;
}

function saveModalMapel() {
  const mapelId   = document.getElementById('mapelSelect').value;
  const hari      = document.getElementById('hariSelect').value;
  const jamMulai  = document.getElementById('jamMulaiMapel').value;
  const jamSelesai = document.getElementById('jamSelesaiMapel').value;
  const guru      = document.getElementById('namaGuru').value.trim();
  const ruangan   = document.getElementById('ruangan').value.trim();

  if (!mapelId || !jamMulai || !jamSelesai) { showToast('Lengkapi data jadwal!', 'error'); return; }
  if (timeToMinutes(jamMulai) >= timeToMinutes(jamSelesai)) { showToast('Jam mulai harus sebelum jam selesai!', 'error'); return; }

  if (!state.jadwal[hari]) state.jadwal[hari] = [];

  if (editingMapelId) {
    const idx = state.jadwal[hari].findIndex(j => j.id === editingMapelId);
    if (idx !== -1) state.jadwal[hari][idx] = { ...state.jadwal[hari][idx], mapelId, jamMulai, jamSelesai, guru, ruangan };
  } else {
    state.jadwal[hari].push({ id: genId(), mapelId, hari, jamMulai, jamSelesai, guru, ruangan });
  }

  state.jadwal[hari].sort((a, b) => timeToMinutes(a.jamMulai) - timeToMinutes(b.jamMulai));
  saveState();
  activeDay = hari;
  document.querySelectorAll('.day-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.day === hari);
  });
  renderJadwal();
  closeModalMapel();
  clearDraft('jadwal');
  showToast('Jadwal disimpan!', 'success');
}

// ===== TUGAS PAGE =====
function getDeadlineStatus(deadline) {
  if (!deadline) return { label: 'Tanpa deadline', cls: 'deadline-ok' };
  const now = new Date(); now.setHours(0,0,0,0);
  const d   = new Date(deadline);
  const diff = Math.ceil((d - now) / 86400000);
  if (diff < 0)  return { label: `Terlambat ${Math.abs(diff)} hari`, cls: 'deadline-late' };
  if (diff === 0) return { label: 'Hari ini!', cls: 'deadline-soon' };
  if (diff <= 3)  return { label: `${diff} hari lagi`, cls: 'deadline-soon' };
  return { label: `${diff} hari lagi`, cls: 'deadline-ok' };
}

function renderTugas() {
  const list = document.getElementById('tugasList');
  let items  = [...state.tugas];

  if (activeFilter === 'belum')    items = items.filter(t => !t.selesai);
  else if (activeFilter === 'selesai')   items = items.filter(t => t.selesai);
  else if (activeFilter === 'terlambat') {
    const now = new Date(); now.setHours(0,0,0,0);
    items = items.filter(t => !t.selesai && t.deadline && new Date(t.deadline) < now);
  }

  items.sort((a, b) => {
    if (a.selesai !== b.selesai) return a.selesai ? 1 : -1;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-tugas"><div class="empty-icon">✅</div><p>Tidak ada tugas di sini</p></div>`;
    return;
  }

  const tipeBadge = { pr: 'badge-pr', tugas: 'badge-tugas', ulangan: 'badge-ulangan', proyek: 'badge-proyek' };
  const tipeLabel = { pr: 'PR', tugas: 'Tugas', ulangan: 'Ulangan', proyek: 'Proyek' };

  list.innerHTML = items.map(t => {
    const mapel      = state.mapel.find(m => m.id === t.mapelId);
    const ds         = getDeadlineStatus(t.deadline);
    const deadlineStr = t.deadline
      ? new Date(t.deadline).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
      : '-';
    return `
      <div class="tugas-item ${t.selesai ? 'selesai' : ''}" data-id="${t.id}">
        <div class="tugas-checkbox ${t.selesai ? 'checked' : ''}" data-id="${t.id}" title="Tandai selesai">
          ${t.selesai ? '✓' : ''}
        </div>
        <div class="tugas-content">
          <div class="tugas-judul">${sanitize(t.judul)}</div>
          <div class="tugas-meta">
            ${mapel ? `<span class="tugas-meta-item" style="color:${mapel.warna}">${mapel.ikon} ${sanitize(mapel.nama)}</span>` : ''}
            ${t.guru ? `<span class="tugas-meta-item">👤 ${sanitize(t.guru)}</span>` : ''}
            <span class="tugas-meta-item">📅 ${deadlineStr}</span>
            <span class="badge ${tipeBadge[t.tipe] || 'badge-tugas'}">${tipeLabel[t.tipe] || t.tipe}</span>
            <span class="deadline-badge ${ds.cls}">${ds.label}</span>
          </div>
          ${t.catatan ? `<div style="font-size:12px;color:var(--text3);margin-top:6px">📌 ${sanitize(t.catatan)}</div>` : ''}
        </div>
        <div class="tugas-actions">
          <button class="btn-icon edit-tugas" data-id="${t.id}" title="Edit">✏️</button>
          <button class="btn-icon danger del-tugas" data-id="${t.id}" title="Hapus">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.tugas-checkbox').forEach(cb => {
    cb.addEventListener('click', (e) => { e.stopPropagation(); toggleTugas(cb.dataset.id); });
  });
  list.querySelectorAll('.edit-tugas').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openModalTugas(btn.dataset.id); });
  });
  list.querySelectorAll('.del-tugas').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); hapusTugas(btn.dataset.id); });
  });
}

function toggleTugas(id) {
  const t = state.tugas.find(t => t.id === id);
  if (t) {
    t.selesai = !t.selesai;
    saveState();
    renderTugas();
    syncStatusToSheets(id, t.selesai);
  }
}

function hapusTugas(id) {
  if (!confirm('Hapus tugas ini?')) return;
  state.tugas = state.tugas.filter(t => t.id !== id);
  saveState(); renderTugas();
  showToast('Tugas dihapus', 'success');
}

function initFilterBar() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderTugas();
    });
  });
}

// ===== MODAL TUGAS =====
const TUGAS_FIELDS = ['judulTugas','mapelTugas','guruTugas','deadlineTugas','tipeTugas','catatanTugas'];

function openModalTugas(editId = null) {
  editingTugasId = editId;
  const modal = document.getElementById('modalTugas');
  document.getElementById('modalTugasTitle').textContent = editId ? 'Edit Tugas' : 'Tambah Tugas';

  const sel = document.getElementById('mapelTugas');
  sel.innerHTML = state.mapel.map(m => `<option value="${m.id}">${m.ikon} ${sanitize(m.nama)}</option>`).join('');

  if (editId) {
    const t = state.tugas.find(t => t.id === editId);
    if (t) {
      document.getElementById('judulTugas').value    = t.judul;
      sel.value = t.mapelId;
      document.getElementById('guruTugas').value     = t.guru || '';
      document.getElementById('deadlineTugas').value = t.deadline || '';
      document.getElementById('tipeTugas').value     = t.tipe || 'pr';
      document.getElementById('catatanTugas').value  = t.catatan || '';
    }
  } else {
    const draft = loadDraft('tugas');
    if (draft) {
      TUGAS_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && draft[id] !== undefined) el.value = draft[id];
      });
    } else {
      document.getElementById('judulTugas').value    = '';
      document.getElementById('guruTugas').value     = '';
      document.getElementById('deadlineTugas').value = '';
      document.getElementById('tipeTugas').value     = 'pr';
      document.getElementById('catatanTugas').value  = '';
    }
    attachAutosave('tugas', TUGAS_FIELDS);
  }

  modal.classList.add('open');
}

function closeModalTugas() {
  document.getElementById('modalTugas').classList.remove('open');
  editingTugasId = null;
}

function saveModalTugas() {
  const judul   = document.getElementById('judulTugas').value.trim();
  const mapelId = document.getElementById('mapelTugas').value;
  const guru    = document.getElementById('guruTugas').value.trim();
  const deadline = document.getElementById('deadlineTugas').value;
  const tipe    = document.getElementById('tipeTugas').value;
  const catatan = document.getElementById('catatanTugas').value.trim();

  if (!judul) { showToast('Judul tugas wajib diisi!', 'error'); return; }

  if (editingTugasId) {
    const idx = state.tugas.findIndex(t => t.id === editingTugasId);
    if (idx !== -1) state.tugas[idx] = { ...state.tugas[idx], judul, mapelId, guru, deadline, tipe, catatan };
  } else {
    state.tugas.push({ id: genId(), judul, mapelId, guru, deadline, tipe, catatan, selesai: false, createdAt: Date.now() });
  }

  saveState(); renderTugas(); closeModalTugas();
  clearDraft('tugas');
  showToast('Tugas disimpan!', 'success');
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
    title.textContent = 'Edit Jadwal';
    clearDraft('jadwal');
    // Search across all days
    let item = null;
    Object.values(state.jadwal).forEach(arr => { const f = arr.find(j => j.id === editId); if (f) item = f; });
    if (item) {
      sel.value = item.mapelId;
      document.getElementById('hariSelect').value = item.hari || activeDay;
      document.getElementById('jamMulaiMapel').value  = item.jamMulai;
      document.getElementById('jamSelesaiMapel').value = item.jamSelesai;
      document.getElementById('namaGuru').value  = item.guru    || '';
      document.getElementById('ruangan').value   = item.ruangan || '';
    }
  } else {
    title.textContent = 'Tambah Mapel';
    const draft = loadDraft('jadwal');
    if (draft) {
      JADWAL_FIELDS.forEach(id => { const el = document.getElementById(id); if (el && draft[id] !== undefined) el.value = draft[id]; });
    } else {
      document.getElementById('hariSelect').value      = activeDay;
      document.getElementById('jamMulaiMapel').value   = state.settings.jamMulai;
      document.getElementById('jamSelesaiMapel').value = minutesToTime(timeToMinutes(state.settings.jamMulai) + (parseInt(state.settings.durasiSlot)||45));
      document.getElementById('namaGuru').value  = '';
      document.getElementById('ruangan').value   = '';
    }
    attachAutosave('jadwal', JADWAL_FIELDS);
  }
  modal.classList.add('open');
  setTimeout(() => document.getElementById('mapelSelect')?.focus(), 100);
}

function closeModalMapel() {
  document.getElementById('modalMapel').classList.remove('open');
  editingMapelId = null;
}

function saveModalMapel() {
  const mapelId   = document.getElementById('mapelSelect').value;
  const hari      = document.getElementById('hariSelect').value;
  const jamMulai  = document.getElementById('jamMulaiMapel').value;
  const jamSelesai= document.getElementById('jamSelesaiMapel').value;
  const guru      = document.getElementById('namaGuru').value.trim();
  const ruangan   = document.getElementById('ruangan').value.trim();

  if (!mapelId || !jamMulai || !jamSelesai) { showToast('Lengkapi data jadwal!','error'); return; }
  if (timeToMinutes(jamMulai) >= timeToMinutes(jamSelesai)) { showToast('Jam mulai harus sebelum jam selesai!','error'); return; }

  if (!state.jadwal[hari]) state.jadwal[hari] = [];

  if (editingMapelId) {
    // Remove from old day first
    Object.keys(state.jadwal).forEach(d => {
      state.jadwal[d] = state.jadwal[d].filter(j => j.id !== editingMapelId);
    });
    state.jadwal[hari].push({ id:editingMapelId, mapelId, hari, jamMulai, jamSelesai, guru, ruangan });
  } else {
    state.jadwal[hari].push({ id:genId(), mapelId, hari, jamMulai, jamSelesai, guru, ruangan });
  }

  state.jadwal[hari].sort((a,b) => timeToMinutes(a.jamMulai) - timeToMinutes(b.jamMulai));
  saveState();
  activeDay = hari;
  document.querySelectorAll('.day-tab').forEach(t => t.classList.toggle('active', t.dataset.day === hari));
  renderJadwal();
  closeModalMapel();
  clearDraft('jadwal');
  showToast('Jadwal disimpan!','success');
}

// ===== TUGAS PAGE =====
function renderTugas() {
  const list = document.getElementById('tugasList');
  if (!list) return;
  let items = [...state.tugas];

  if (activeFilter === 'belum')    items = items.filter(t => !t.selesai);
  else if (activeFilter === 'selesai')  items = items.filter(t => t.selesai);
  else if (activeFilter === 'terlambat') {
    const now = new Date(); now.setHours(0,0,0,0);
    items = items.filter(t => !t.selesai && t.deadline && (() => {
      const p = t.deadline.split('-').map(Number);
      return new Date(p[0],p[1]-1,p[2]) < now;
    })());
  } else if (activeFilter === 'hari-ini') {
    const today = new Date(); today.setHours(0,0,0,0);
    items = items.filter(t => {
      if (!t.deadline) return false;
      const p = t.deadline.split('-').map(Number);
      return new Date(p[0],p[1]-1,p[2]).getTime() === today.getTime();
    });
  }

  items.sort((a,b) => {
    if (a.selesai !== b.selesai) return a.selesai ? 1 : -1;
    // Priority sort: tinggi > sedang > rendah
    const pOrder = { tinggi:0, sedang:1, rendah:2 };
    const pa = pOrder[a.prioritas||'sedang'] ?? 1;
    const pb = pOrder[b.prioritas||'sedang'] ?? 1;
    if (pa !== pb) return pa - pb;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-tugas"><div class="empty-icon">✅</div><p>Tidak ada tugas di sini</p></div>';
    return;
  }

  const tipeBadge  = { pr:'badge-pr', tugas:'badge-tugas', ulangan:'badge-ulangan', proyek:'badge-proyek' };
  const tipeLabel  = { pr:'PR', tugas:'Tugas', ulangan:'Ulangan', proyek:'Proyek' };
  const prioIcon   = { tinggi:'🔴', sedang:'🟡', rendah:'🟢' };

  list.innerHTML = '';
  items.forEach(t => {
    const mapel = state.mapel.find(m => m.id === t.mapelId);
    const ds    = getDeadlineStatus(t.deadline);
    const prio  = t.prioritas || 'sedang';

    const item = document.createElement('div');
    item.className = 'tugas-item' + (t.selesai ? ' selesai' : '');
    item.dataset.id = t.id;

    const cb = document.createElement('div');
    cb.className = 'tugas-checkbox' + (t.selesai ? ' checked' : '');
    cb.dataset.id = t.id;
    cb.title = 'Tandai selesai';
    cb.textContent = t.selesai ? '✓' : '';
    cb.addEventListener('click', e => { e.stopPropagation(); toggleTugas(t.id); });

    const content = document.createElement('div');
    content.className = 'tugas-content';

    const judulRow = document.createElement('div');
    judulRow.className = 'tugas-judul-row';
    const judulEl = document.createElement('span');
    judulEl.className = 'tugas-judul';
    judulEl.textContent = t.judul;
    const prioEl = document.createElement('span');
    prioEl.className = 'prio-icon';
    prioEl.title = 'Prioritas ' + prio;
    prioEl.textContent = prioIcon[prio] || '🟡';
    judulRow.appendChild(judulEl);
    judulRow.appendChild(prioEl);
    content.appendChild(judulRow);

    const meta = document.createElement('div');
    meta.className = 'tugas-meta';
    if (mapel) {
      const ms = document.createElement('span');
      ms.className = 'tugas-meta-item';
      ms.style.color = mapel.warna;
      ms.textContent = mapel.ikon + ' ' + mapel.nama;
      meta.appendChild(ms);
    }
    if (t.guru) {
      const gs = document.createElement('span'); gs.className = 'tugas-meta-item'; gs.textContent = '👤 ' + t.guru; meta.appendChild(gs);
    }
    const ds2 = document.createElement('span'); ds2.className = 'tugas-meta-item'; ds2.textContent = '📅 ' + formatDeadline(t.deadline); meta.appendChild(ds2);
    const badge = document.createElement('span'); badge.className = 'badge ' + (tipeBadge[t.tipe]||'badge-tugas'); badge.textContent = tipeLabel[t.tipe]||t.tipe; meta.appendChild(badge);
    const dlBadge = document.createElement('span'); dlBadge.className = 'deadline-badge ' + ds.cls; dlBadge.textContent = ds.label; meta.appendChild(dlBadge);
    content.appendChild(meta);

    if (t.catatan) {
      const cat = document.createElement('div');
      cat.className = 'tugas-catatan';
      cat.textContent = '📌 ' + t.catatan;
      content.appendChild(cat);
    }

    // Subtasks
    if (t.subtasks && t.subtasks.length > 0) {
      const done = t.subtasks.filter(s => s.done).length;
      const stBar = document.createElement('div');
      stBar.className = 'subtask-bar';
      stBar.innerHTML = `<div class="subtask-progress"><div class="subtask-fill" style="width:${Math.round(done/t.subtasks.length*100)}%"></div></div><span class="subtask-label">${done}/${t.subtasks.length} subtask</span>`;
      content.appendChild(stBar);
    }

    const actions = document.createElement('div');
    actions.className = 'tugas-actions';
    const editBtn = document.createElement('button'); editBtn.className = 'btn-icon edit-tugas'; editBtn.title = 'Edit'; editBtn.textContent = '✏️';
    editBtn.addEventListener('click', e => { e.stopPropagation(); openModalTugas(t.id); });
    const delBtn = document.createElement('button'); delBtn.className = 'btn-icon danger del-tugas'; delBtn.title = 'Hapus'; delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', e => { e.stopPropagation(); hapusTugas(t.id); });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(cb);
    item.appendChild(content);
    item.appendChild(actions);
    list.appendChild(item);
  });

  // Deadline alert banner
  renderDeadlineAlert();
}

function renderDeadlineAlert() {
  const banner = document.getElementById('deadlineAlert');
  if (!banner) return;
  const now = new Date(); now.setHours(0,0,0,0);
  const urgent = state.tugas.filter(t => {
    if (t.selesai || !t.deadline) return false;
    const p = t.deadline.split('-').map(Number);
    const d = new Date(p[0],p[1]-1,p[2]);
    return (d - now) / 86400000 <= 1;
  });
  if (urgent.length > 0) {
    banner.style.display = 'flex';
    banner.querySelector('.alert-text').textContent = `⚠️ ${urgent.length} tugas deadline hari ini atau besok!`;
  } else {
    banner.style.display = 'none';
  }
}

function toggleTugas(id) {
  const t = state.tugas.find(t => t.id === id);
  if (t) {
    t.selesai = !t.selesai;
    saveState(); renderTugas();
    syncStatusToSheets(id, t.selesai);
  }
}

function hapusTugas(id) {
  if (!confirm('Hapus tugas ini?')) return;
  state.tugas = state.tugas.filter(t => t.id !== id);
  saveState(); renderTugas();
  showToast('Tugas dihapus','success');
}

function initFilterBar() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderTugas();
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
      document.getElementById('judulTugas').value      = t.judul;
      sel.value = t.mapelId;
      document.getElementById('guruTugas').value       = t.guru     || '';
      document.getElementById('deadlineTugas').value   = t.deadline || '';
      document.getElementById('tipeTugas').value       = t.tipe     || 'pr';
      document.getElementById('prioritasTugas').value  = t.prioritas|| 'sedang';
      document.getElementById('catatanTugas').value    = t.catatan  || '';
      subtaskList = (t.subtasks || []).map(s => ({ ...s }));
    }
  } else {
    const draft = loadDraft('tugas');
    if (draft) {
      TUGAS_FIELDS.forEach(id => { const el = document.getElementById(id); if (el && draft[id] !== undefined) el.value = draft[id]; });
    } else {
      document.getElementById('judulTugas').value     = '';
      document.getElementById('guruTugas').value      = '';
      document.getElementById('deadlineTugas').value  = '';
      document.getElementById('tipeTugas').value      = 'pr';
      document.getElementById('prioritasTugas').value = 'sedang';
      document.getElementById('catatanTugas').value   = '';
    }
    attachAutosave('tugas', TUGAS_FIELDS);
  }

  renderSubtaskList();
  modal.classList.add('open');
  setTimeout(() => document.getElementById('judulTugas')?.focus(), 100);
}

function closeModalTugas() {
  document.getElementById('modalTugas').classList.remove('open');
  editingTugasId = null;
  subtaskList = [];
}

function saveModalTugas() {
  const judul    = document.getElementById('judulTugas').value.trim();
  const mapelId  = document.getElementById('mapelTugas').value;
  const guru     = document.getElementById('guruTugas').value.trim();
  const deadline = document.getElementById('deadlineTugas').value;
  const tipe     = document.getElementById('tipeTugas').value;
  const prioritas= document.getElementById('prioritasTugas').value;
  const catatan  = document.getElementById('catatanTugas').value.trim();

  if (!judul) { showToast('Judul tugas wajib diisi!','error'); return; }

  const subtasks = subtaskList.map(s => ({ id:s.id||genId(), text:s.text, done:s.done||false }));

  if (editingTugasId) {
    const idx = state.tugas.findIndex(t => t.id === editingTugasId);
    if (idx !== -1) state.tugas[idx] = { ...state.tugas[idx], judul, mapelId, guru, deadline, tipe, prioritas, catatan, subtasks };
  } else {
    state.tugas.push({ id:genId(), judul, mapelId, guru, deadline, tipe, prioritas, catatan, subtasks, selesai:false, createdAt:Date.now() });
  }

  saveState(); renderTugas(); closeModalTugas();
  clearDraft('tugas');
  showToast('Tugas disimpan!','success');
}

// Subtasks
function renderSubtaskList() {
  const container = document.getElementById('subtaskContainer');
  if (!container) return;
  container.innerHTML = '';
  subtaskList.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'subtask-row';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = s.done;
    cb.addEventListener('change', () => { subtaskList[i].done = cb.checked; });
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'subtask-input'; inp.value = s.text; inp.placeholder = 'Subtask...';
    inp.addEventListener('input', () => { subtaskList[i].text = inp.value; });
    const del = document.createElement('button'); del.className = 'subtask-del'; del.textContent = '✕';
    del.addEventListener('click', () => { subtaskList.splice(i,1); renderSubtaskList(); });
    row.appendChild(cb); row.appendChild(inp); row.appendChild(del);
    container.appendChild(row);
  });
}

function addSubtask() {
  subtaskList.push({ id:genId(), text:'', done:false });
  renderSubtaskList();
  // Focus last input
  const inputs = document.querySelectorAll('.subtask-input');
  if (inputs.length) inputs[inputs.length-1].focus();
}

// ===== SETTINGS =====
function renderSettings() {
  const { jamMulai, jamSelesai, durasiSlot } = state.settings;
  document.getElementById('jamMulai').value   = jamMulai;
  document.getElementById('jamSelesai').value = jamSelesai;
  document.getElementById('durasiSlot').value = durasiSlot;

  const list = document.getElementById('mapelList');
  list.innerHTML = state.mapel.map(m => `
    <div class="mapel-item" style="animation: slideUp 0.25s ease both">
      <div class="mapel-color" style="background:${m.warna}"></div>
      <span class="mapel-icon">${m.ikon}</span>
      <span class="mapel-name">${sanitize(m.nama)}</span>
      <button class="btn-icon danger del-mapel" data-id="${m.id}" title="Hapus">🗑️</button>
    </div>
  `).join('');

  list.querySelectorAll('.del-mapel').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Hapus mata pelajaran ini? Jadwal terkait juga akan terhapus.')) return;
      const id = btn.dataset.id;
      state.mapel = state.mapel.filter(m => m.id !== id);
      Object.keys(state.jadwal).forEach(day => {
        state.jadwal[day] = state.jadwal[day].filter(j => j.mapelId !== id);
      });
      saveState(); renderSettings(); renderJadwal();
      showToast('Mata pelajaran dihapus', 'success');
    });
  });
}

// ===== MODAL MAPEL BARU (Settings) =====
function initColorPicker() {
  const container = document.getElementById('colorOptions');
  container.innerHTML = COLORS.map(c => `
    <div class="color-option ${c === selectedColor ? 'selected' : ''}"
         style="background:${c}" data-color="${c}"></div>
  `).join('');
  container.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      selectedColor = opt.dataset.color;
      container.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const draft = loadDraft('mapelBaru') || {};
      draft.selectedColor = selectedColor;
      saveDraft('mapelBaru', draft);
    });
  });
}

const MAPEL_BARU_FIELDS = ['namaMapelBaru','ikonMapel'];

function openModalMapelBaru() {
  const draft = loadDraft('mapelBaru');
  if (draft) {
    document.getElementById('namaMapelBaru').value = draft.namaMapelBaru || '';
    document.getElementById('ikonMapel').value     = draft.ikonMapel || '';
    selectedColor = draft.selectedColor || COLORS[0];
  } else {
    selectedColor = COLORS[0];
    document.getElementById('namaMapelBaru').value = '';
    document.getElementById('ikonMapel').value     = '';
  }
  initColorPicker();
  attachAutosave('mapelBaru', MAPEL_BARU_FIELDS);
  document.getElementById('modalMapelBaru').classList.add('open');
}

function closeModalMapelBaru() {
  document.getElementById('modalMapelBaru').classList.remove('open');
}

function saveModalMapelBaru() {
  const nama = document.getElementById('namaMapelBaru').value.trim();
  const ikon = document.getElementById('ikonMapel').value.trim() || '📚';
  if (!nama) { showToast('Nama mapel wajib diisi!', 'error'); return; }
  state.mapel.push({ id: genId(), nama, warna: selectedColor, ikon });
  saveState(); renderSettings(); closeModalMapelBaru();
  clearDraft('mapelBaru');
  showToast('Mata pelajaran ditambahkan!', 'success');
}

// ===== GOOGLE APPS SCRIPT INTEGRATION =====
const APPS_SCRIPT_CODE = `/**
 * SchoolPlanner - Google Apps Script Backend
 * Deploy sebagai Web App: Execute as Me, Anyone can access
 */
const SPREADSHEET_ID = 'GANTI_DENGAN_SPREADSHEET_ID_KAMU';
const SHEET_TUGAS    = 'Tugas';
const SHEET_JADWAL   = 'Jadwal';

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  try {
    const action = e.parameter.action || 'getTugas';
    if (action === 'ping') return makeResponse({ ok: true, message: 'SchoolPlanner API aktif ✅' });
    if (action === 'getTugas') return makeResponse({ ok: true, data: getTugasData() });
    if (action === 'getAll') return makeResponse({ ok: true, tugas: getTugasData(), jadwal: getJadwalData() });
    return makeResponse({ ok: false, error: 'Action tidak dikenal' });
  } catch(err) { return makeResponse({ ok: false, error: err.toString() }); }
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'addTugas')    { addTugasRow(body.data);              return makeResponse({ ok: true }); }
    if (body.action === 'updateStatus') { updateTugasStatus(body.id, body.status); return makeResponse({ ok: true }); }
    if (body.action === 'deleteTugas') { deleteTugasRow(body.id);             return makeResponse({ ok: true }); }
    if (body.action === 'syncTugas')   { syncAllTugas(body.data);             return makeResponse({ ok: true }); }
    return makeResponse({ ok: false, error: 'Action tidak dikenal' });
  } catch(err) { return makeResponse({ ok: false, error: err.toString() }); }
}
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.getRange(1,1,1,headers.length).setBackground('#4a4a6a').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
const TUGAS_HEADERS = ['ID','Judul','Mata Pelajaran','Guru','Deadline','Tipe','Catatan','Status','Dibuat'];
function getTugasData() {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2,1,lastRow-1,TUGAS_HEADERS.length).getValues()
    .filter(r => r[0])
    .map(r => ({
      id: r[0].toString(), judul: r[1].toString(), mapelNama: r[2].toString(),
      guru: r[3].toString(),
      deadline: r[4] ? Utilities.formatDate(new Date(r[4]),'Asia/Jakarta','yyyy-MM-dd') : '',
      tipe: r[5].toString()||'pr', catatan: r[6].toString(),
      selesai: r[7].toString().toLowerCase()==='selesai',
      createdAt: r[8] ? new Date(r[8]).getTime() : Date.now()
    }));
}
function addTugasRow(data) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  sheet.appendRow([data.id,data.judul,data.mapelNama||'',data.guru||'',data.deadline||'',data.tipe||'pr',data.catatan||'',data.selesai?'Selesai':'Belum',new Date()]);
}
function updateTugasStatus(id, status) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return;
  const ids = sheet.getRange(2,1,lastRow-1,1).getValues();
  for (let i=0;i<ids.length;i++) { if (ids[i][0].toString()===id.toString()) { sheet.getRange(i+2,8).setValue(status?'Selesai':'Belum'); return; } }
}
function deleteTugasRow(id) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return;
  const ids = sheet.getRange(2,1,lastRow-1,1).getValues();
  for (let i=ids.length-1;i>=0;i--) { if (ids[i][0].toString()===id.toString()) { sheet.deleteRow(i+2); return; } }
}
function syncAllTugas(tugasList) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow-1);
  if (tugasList && tugasList.length > 0) {
    const rows = tugasList.map(t => [t.id,t.judul,t.mapelNama||'',t.guru||'',t.deadline||'',t.tipe||'pr',t.catatan||'',t.selesai?'Selesai':'Belum',t.createdAt?new Date(t.createdAt):new Date()]);
    sheet.getRange(2,1,rows.length,TUGAS_HEADERS.length).setValues(rows);
  }
}
const JADWAL_HEADERS = ['ID','Hari','Mata Pelajaran','Jam Mulai','Jam Selesai','Guru','Ruangan'];
function getJadwalData() {
  const sheet = getOrCreateSheet(SHEET_JADWAL, JADWAL_HEADERS);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return {};
  const result = {};
  sheet.getRange(2,1,lastRow-1,JADWAL_HEADERS.length).getValues().filter(r=>r[0]).forEach(r => {
    const hari = r[1].toString().toLowerCase();
    if (!result[hari]) result[hari] = [];
    result[hari].push({ id:r[0].toString(), hari, mapelNama:r[2].toString(), jamMulai:r[3].toString(), jamSelesai:r[4].toString(), guru:r[5].toString(), ruangan:r[6].toString() });
  });
  return result;
}`;

function initSheets() {
  const { scriptUrl, connected } = state.sheets;
  const urlEl = document.getElementById('scriptUrl');
  if (urlEl) urlEl.value = scriptUrl || '';
  updateConnectionUI(connected);
}

function updateConnectionUI(connected) {
  ['connectionBadge','connectionBadgeDesktop'].forEach(id => {
    const badge = document.getElementById(id);
    if (badge) badge.className = 'conn-badge' + (connected ? ' connected' : '');
  });
  ['connectionLabel','connectionLabelDesktop'].forEach(id => {
    const label = document.getElementById(id);
    if (label) label.textContent = connected ? 'Terhubung ✅' : 'Belum terhubung';
  });

  const pingBtn      = document.getElementById('btnPingScript');
  const disconnectBtn = document.getElementById('btnDisconnect');
  const syncCard     = document.getElementById('syncCard');

  if (pingBtn)       pingBtn.disabled = !connected;
  if (disconnectBtn) disconnectBtn.disabled = !connected;
  if (syncCard) {
    syncCard.style.opacity       = connected ? '1' : '0.4';
    syncCard.style.pointerEvents = connected ? 'all' : 'none';
    if (connected) syncCard.style.animation = 'slideUp 0.3s ease both';
  }

  clearInterval(window._autoRefreshTimer);
  if (connected) {
    let countdown = 30;
    const badge = document.getElementById('autoRefreshBadge');
    const tick = () => {
      if (badge) badge.textContent = `Auto-refresh: ${countdown}s`;
      countdown--;
      if (countdown < 0) { countdown = 30; pullFromSheets(true); }
    };
    tick();
    window._autoRefreshTimer = setInterval(tick, 1000);
  } else {
    const badge = document.getElementById('autoRefreshBadge');
    if (badge) badge.textContent = 'Auto-refresh: off';
  }
}

function showSheetsStatus(msg, type, elId = 'sheetsStatus') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.className = msg ? 'status-msg ' + type : 'status-msg';
}

async function connectScript() {
  const url = document.getElementById('scriptUrl').value.trim();
  if (!url) { showSheetsStatus('❌ Masukkan URL Web App terlebih dahulu', 'error'); return; }
  if (!url.includes('script.google.com/macros')) {
    showSheetsStatus('❌ URL tidak valid. Harus berupa URL Apps Script Web App', 'error'); return;
  }
  showSheetsStatus('🔄 Menghubungkan...', 'info');
  try {
    const res  = await fetch(url + '?action=ping');
    const json = await res.json();
    if (json.ok) {
      state.sheets = { ...state.sheets, scriptUrl: url, connected: true };
      saveState();
      updateConnectionUI(true);
      showSheetsStatus('✅ ' + json.message, 'success');
      showToast('Berhasil terhubung ke Apps Script!', 'success');
    } else {
      showSheetsStatus('❌ Script merespons tapi ada error: ' + json.error, 'error');
    }
  } catch(e) {
    showSheetsStatus('❌ Gagal terhubung. Pastikan URL benar dan script sudah di-deploy dengan akses "Anyone".', 'error');
  }
}

async function pingScript() {
  const url = state.sheets.scriptUrl;
  if (!url) return;
  showSheetsStatus('🏓 Mengirim ping...', 'info');
  try {
    const res  = await fetch(url + '?action=ping');
    const json = await res.json();
    showSheetsStatus(json.ok ? '✅ ' + json.message : '❌ ' + json.error, json.ok ? 'success' : 'error');
  } catch(e) {
    showSheetsStatus('❌ Tidak bisa menjangkau script. Cek koneksi internet.', 'error');
  }
}

function disconnectScript() {
  if (!confirm('Putuskan koneksi ke Apps Script?')) return;
  state.sheets = { scriptUrl: '', connected: false };
  saveState();
  updateConnectionUI(false);
  document.getElementById('scriptUrl').value = '';
  document.getElementById('sheetsPreview').style.display = 'none';
  const statusEl = document.getElementById('sheetsStatus');
  if (statusEl) statusEl.className = 'status-msg';
  showToast('Koneksi diputus', 'default');
}

async function pullFromSheets(silent = false) {
  const url = state.sheets.scriptUrl;
  if (!silent) showSheetsStatus('⬇️ Mengambil data dari spreadsheet...', 'info', 'syncStatus');
  try {
    const res  = await fetch(url + '?action=getTugas');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    const data = json.data || [];
    if (data.length === 0) {
      if (!silent) showSheetsStatus('⚠️ Tidak ada data di spreadsheet', 'error', 'syncStatus');
      return;
    }
    if (!silent) {
      renderSheetsPreview(data);
      showSheetsStatus(`✅ Berhasil mengambil ${data.length} tugas dari spreadsheet`, 'success', 'syncStatus');
    } else {
      let added = 0;
      data.forEach(item => {
        if (!item.judul) return;
        const exists = state.tugas.find(t => t.id === item.id);
        if (exists) {
          exists.selesai = item.selesai;
        } else {
          const mapel = state.mapel.find(m => m.nama.toLowerCase() === (item.mapelNama||'').toLowerCase());
          state.tugas.push({
            id: item.id || genId(), judul: item.judul,
            mapelId: mapel ? mapel.id : (state.mapel[0]?.id || ''),
            guru: item.guru||'', deadline: item.deadline||'',
            tipe: item.tipe||'pr', catatan: item.catatan||'',
            selesai: item.selesai||false, createdAt: item.createdAt||Date.now()
          });
          added++;
        }
      });
      if (added > 0) { saveState(); renderTugas(); }
    }
  } catch(e) {
    if (!silent) showSheetsStatus('❌ Gagal mengambil data: ' + e.message, 'error', 'syncStatus');
  }
}

async function pushToSheets() {
  const url = state.sheets.scriptUrl;
  if (!state.tugas.length) { showSheetsStatus('⚠️ Tidak ada tugas untuk di-push', 'error', 'syncStatus'); return; }
  if (!confirm(`Push ${state.tugas.length} tugas ke spreadsheet? Data lama di sheet akan diganti.`)) return;

  showSheetsStatus('⬆️ Mengirim data ke spreadsheet...', 'info', 'syncStatus');
  try {
    const payload = state.tugas.map(t => {
      const mapel = state.mapel.find(m => m.id === t.mapelId);
      return { ...t, mapelNama: mapel ? mapel.nama : '' };
    });
    const res  = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'syncTugas', data: payload }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    showSheetsStatus(`✅ ${state.tugas.length} tugas berhasil dikirim ke spreadsheet!`, 'success', 'syncStatus');
    showToast('Push ke Sheets berhasil!', 'success');
  } catch(e) {
    showSheetsStatus('❌ Gagal push: ' + e.message, 'error', 'syncStatus');
  }
}

async function syncStatusToSheets(id, selesai) {
  if (!state.sheets.connected || !state.sheets.scriptUrl) return;
  try {
    await fetch(state.sheets.scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateStatus', id, status: selesai })
    });
  } catch(e) { /* silent fail */ }
}

function renderSheetsPreview(data) {
  const preview = document.getElementById('sheetsPreview');
  const content = document.getElementById('sheetsPreviewContent');
  preview.style.display   = 'block';
  preview.style.animation = 'slideUp 0.3s ease both';

  const rows = data.slice(0, 10);
  content.innerHTML = `
    <div style="overflow-x:auto;margin-bottom:4px">
      <table class="sheets-table">
        <thead>
          <tr>${['Mapel','Judul','Deadline','Guru','Status'].map(h=>`<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(r=>`<tr>
            <td>${sanitize(r.mapelNama||'-')}</td>
            <td>${sanitize(r.judul||'-')}</td>
            <td>${sanitize(r.deadline||'-')}</td>
            <td>${sanitize(r.guru||'-')}</td>
            <td>${r.selesai?'✅ Selesai':'⏳ Belum'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${data.length > 10 ? `<p style="font-size:12px;color:var(--text3);margin-top:8px">...dan ${data.length - 10} tugas lainnya</p>` : ''}
  `;
  preview._data = data;
}

function importFromSheets() {
  const preview = document.getElementById('sheetsPreview');
  const data    = preview._data;
  if (!data) return;

  let imported = 0;
  data.forEach(item => {
    if (!item.judul) return;
    const exists = state.tugas.find(t => t.id === item.id || (t.judul === item.judul && t.guru === item.guru));
    if (exists) return;
    const mapel = state.mapel.find(m => m.nama.toLowerCase() === (item.mapelNama || '').toLowerCase());
    state.tugas.push({
      id: item.id || genId(), judul: item.judul,
      mapelId: mapel ? mapel.id : (state.mapel[0] ? state.mapel[0].id : ''),
      guru: item.guru||'', deadline: item.deadline||'',
      tipe: item.tipe||'pr', catatan: item.catatan||'',
      selesai: item.selesai||false, createdAt: item.createdAt||Date.now()
    });
    imported++;
  });

  saveState(); renderTugas();
  showToast(`${imported} tugas berhasil diimport!`, 'success');
  showSheetsStatus(`✅ ${imported} tugas diimport ke daftar tugas`, 'success', 'syncStatus');
}

function downloadTemplate() {
  const csv  = 'ID,Judul,Mata Pelajaran,Guru,Deadline,Tipe,Catatan,Status,Dibuat\n,Latihan Soal Bab 3,Matematika,Bu Sari,2026-05-15,pr,,Belum,\n,Buat Puisi,B. Indonesia,Pak Budi,2026-05-20,pr,,Belum,\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'template_tugas_schoolplanner.csv';
  a.click();
}

function copyScriptCode() {
  navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
    showToast('Kode Apps Script berhasil di-copy!', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = APPS_SCRIPT_CODE;
    document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Kode Apps Script berhasil di-copy!', 'success');
  });
}

// ===== INIT =====
function init() {
  initNav();
  initDate();
  initDayTabs();
  initFilterBar();
  renderJadwal();
  renderTugas();
  renderSettings();
  initSheets();

  // Tambah Mapel (Jadwal)
  ['btnTambahMapel','btnTambahMapelDesktop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openModalMapel());
  });
  document.getElementById('closeModalMapel').addEventListener('click', closeModalMapel);
  document.getElementById('cancelModalMapel').addEventListener('click', closeModalMapel);
  document.getElementById('saveModalMapel').addEventListener('click', saveModalMapel);
  document.getElementById('modalMapel').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModalMapel(); });

  // Tambah Tugas
  ['btnTambahTugas','btnTambahTugasDesktop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openModalTugas());
  });
  document.getElementById('closeModalTugas').addEventListener('click', closeModalTugas);
  document.getElementById('cancelModalTugas').addEventListener('click', closeModalTugas);
  document.getElementById('saveModalTugas').addEventListener('click', saveModalTugas);
  document.getElementById('modalTugas').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModalTugas(); });

  // Tambah Mapel Baru (Settings)
  document.getElementById('btnTambahMapelSettings').addEventListener('click', openModalMapelBaru);
  document.getElementById('closeModalMapelBaru').addEventListener('click', closeModalMapelBaru);
  document.getElementById('cancelModalMapelBaru').addEventListener('click', closeModalMapelBaru);
  document.getElementById('saveModalMapelBaru').addEventListener('click', saveModalMapelBaru);
  document.getElementById('modalMapelBaru').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModalMapelBaru(); });

  // Settings - Jam (autosave on change)
  ['jamMulai','jamSelesai','durasiSlot'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state.settings.jamMulai   = document.getElementById('jamMulai').value;
      state.settings.jamSelesai = document.getElementById('jamSelesai').value;
      state.settings.durasiSlot = parseInt(document.getElementById('durasiSlot').value) || 45;
      saveState(); renderJadwal();
      showToast('Pengaturan jam disimpan', 'success');
    });
  });

  document.getElementById('btnSaveJam').addEventListener('click', () => {
    state.settings.jamMulai   = document.getElementById('jamMulai').value;
    state.settings.jamSelesai = document.getElementById('jamSelesai').value;
    state.settings.durasiSlot = parseInt(document.getElementById('durasiSlot').value) || 45;
    saveState(); renderJadwal();
    showToast('Pengaturan jam disimpan!', 'success');
  });

  document.getElementById('btnResetData').addEventListener('click', () => {
    if (!confirm('Yakin ingin menghapus SEMUA data? Tindakan ini tidak bisa dibatalkan!')) return;
    localStorage.removeItem('schoolplanner');
    state = loadState();
    renderJadwal(); renderTugas(); renderSettings(); initSheets();
    showToast('Semua data telah direset', 'success');
  });

  // Sheets
  document.getElementById('btnConnectScript').addEventListener('click', connectScript);
  document.getElementById('btnPingScript').addEventListener('click', pingScript);
  document.getElementById('btnDisconnect').addEventListener('click', disconnectScript);
  document.getElementById('btnPullTugas').addEventListener('click', pullFromSheets);
  document.getElementById('btnPushTugas').addEventListener('click', pushToSheets);
  document.getElementById('btnImportSheets').addEventListener('click', importFromSheets);
  document.getElementById('btnDownloadTemplate').addEventListener('click', downloadTemplate);
  document.getElementById('btnCopyScript').addEventListener('click', copyScriptCode);

  const scriptUrlEl = document.getElementById('scriptUrl');
  if (scriptUrlEl) {
    scriptUrlEl.addEventListener('input', () => {
      state.sheets.scriptUrl = scriptUrlEl.value.trim();
      saveState();
    });
    scriptUrlEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectScript(); });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModalMapel(); closeModalTugas(); closeModalMapelBaru(); }
  });

  // Firebase auth handlers
  window._onCloudLogin = (cloudState) => {
    if (!cloudState) return;
    state = { ...loadState(), ...cloudState };
    localStorage.setItem('schoolplanner', JSON.stringify(state));
    renderJadwal(); renderTugas(); renderSettings(); initSheets();
    showToast('Data berhasil dimuat dari cloud ☁️', 'success');
    setSyncStatus('synced');
  };

  window._onCloudSync = (newState) => {
    if (!newState) return;
    if (JSON.stringify(state) === JSON.stringify(newState)) return;
    state = { ...state, ...newState };
    localStorage.setItem('schoolplanner', JSON.stringify(state));
    renderJadwal(); renderTugas(); renderSettings(); initSheets();
    setSyncStatus('synced');
  };

  document.getElementById('btnLogin')?.addEventListener('click', () => window._fb?.login());
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    window._fb?.logout(); setSyncStatus('local'); showToast('Logout berhasil', 'default');
  });
  document.getElementById('btnLoginMobile')?.addEventListener('click', () => window._fb?.login());
  document.getElementById('btnLogoutMobile')?.addEventListener('click', () => {
    window._fb?.logout(); setSyncStatus('local'); showToast('Logout berhasil', 'default');
  });
}

document.addEventListener('DOMContentLoaded', init);

// ===== SETTINGS =====
function renderSettings() {
  const { jamMulai, jamSelesai, durasiSlot } = state.settings;
  const jm = document.getElementById('jamMulai');
  const js = document.getElementById('jamSelesai');
  const ds = document.getElementById('durasiSlot');
  if (jm) jm.value = jamMulai;
  if (js) js.value = jamSelesai;
  if (ds) ds.value = durasiSlot;

  const list = document.getElementById('mapelList');
  if (!list) return;
  list.innerHTML = '';
  state.mapel.forEach(m => {
    const row = document.createElement('div');
    row.className = 'mapel-item';
    row.innerHTML = `<div class="mapel-color" style="background:${sanitize(m.warna)}"></div><span class="mapel-icon">${sanitize(m.ikon)}</span><span class="mapel-name">${sanitize(m.nama)}</span>`;
    const del = document.createElement('button');
    del.className = 'btn-icon danger del-mapel'; del.title = 'Hapus'; del.textContent = '🗑️';
    del.addEventListener('click', () => {
      if (!confirm('Hapus mata pelajaran ini? Jadwal terkait juga akan terhapus.')) return;
      state.mapel = state.mapel.filter(x => x.id !== m.id);
      Object.keys(state.jadwal).forEach(day => {
        state.jadwal[day] = (state.jadwal[day]||[]).filter(j => j.mapelId !== m.id);
      });
      // Reassign orphaned tugas to first available mapel
      const fallback = state.mapel[0]?.id || '';
      state.tugas.forEach(t => { if (t.mapelId === m.id) t.mapelId = fallback; });
      saveState(); renderSettings(); renderJadwal(); renderTugas();
      showToast('Mata pelajaran dihapus','success');
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

// ===== MODAL MAPEL BARU =====
function initColorPicker() {
  const container = document.getElementById('colorOptions');
  if (!container) return;
  container.innerHTML = COLORS.map(c =>
    `<div class="color-option ${c===selectedColor?'selected':''}" style="background:${c}" data-color="${c}"></div>`
  ).join('');
  container.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      selectedColor = opt.dataset.color;
      container.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

const MAPEL_BARU_FIELDS = ['namaMapelBaru','ikonMapel'];

function openModalMapelBaru() {
  const draft = loadDraft('mapelBaru');
  if (draft) {
    document.getElementById('namaMapelBaru').value = draft.namaMapelBaru || '';
    document.getElementById('ikonMapel').value     = draft.ikonMapel     || '';
    selectedColor = draft.selectedColor || COLORS[0];
  } else {
    selectedColor = COLORS[0];
    document.getElementById('namaMapelBaru').value = '';
    document.getElementById('ikonMapel').value     = '';
  }
  initColorPicker();
  attachAutosave('mapelBaru', MAPEL_BARU_FIELDS);
  document.getElementById('modalMapelBaru').classList.add('open');
  setTimeout(() => document.getElementById('namaMapelBaru')?.focus(), 100);
}

function closeModalMapelBaru() {
  document.getElementById('modalMapelBaru').classList.remove('open');
}

function saveModalMapelBaru() {
  const nama = document.getElementById('namaMapelBaru').value.trim();
  const ikon = document.getElementById('ikonMapel').value.trim() || '📚';
  if (!nama) { showToast('Nama mapel wajib diisi!','error'); return; }
  // Duplicate check
  if (state.mapel.some(m => m.nama.toLowerCase() === nama.toLowerCase())) {
    showToast('Mata pelajaran sudah ada!','error'); return;
  }
  state.mapel.push({ id:genId(), nama, warna:selectedColor, ikon });
  saveState(); renderSettings(); closeModalMapelBaru();
  clearDraft('mapelBaru');
  showToast('Mata pelajaran ditambahkan!','success');
}

// ===== OVERVIEW PAGE =====
function renderOverview() {
  const container = document.getElementById('overviewContent');
  if (!container) return;

  const days = ['senin','selasa','rabu','kamis','jumat'];
  const dayLabel = { senin:'Senin',selasa:'Selasa',rabu:'Rabu',kamis:'Kamis',jumat:'Jumat' };
  const now = new Date(); now.setHours(0,0,0,0);

  // Week schedule summary
  let scheduleHTML = '<div class="overview-week">';
  days.forEach(d => {
    const jadwal = state.jadwal[d] || [];
    scheduleHTML += `<div class="overview-day"><div class="overview-day-label">${dayLabel[d]}</div>`;
    if (jadwal.length === 0) {
      scheduleHTML += '<div class="overview-empty">—</div>';
    } else {
      jadwal.forEach(j => {
        const mapel = state.mapel.find(m => m.id === j.mapelId);
        if (!mapel) return;
        scheduleHTML += `<div class="overview-slot" style="background:${mapel.warna}22;border-left:3px solid ${mapel.warna}" title="${mapel.nama} ${j.jamMulai}-${j.jamSelesai}"><span>${mapel.ikon}</span><span class="overview-slot-name">${sanitize(mapel.nama)}</span><span class="overview-slot-time">${j.jamMulai}</span></div>`;
      });
    }
    scheduleHTML += '</div>';
  });
  scheduleHTML += '</div>';

  // Upcoming tasks (next 7 days)
  const upcoming = state.tugas
    .filter(t => !t.selesai && t.deadline)
    .map(t => {
      const p = t.deadline.split('-').map(Number);
      const d = new Date(p[0],p[1]-1,p[2]);
      return { ...t, _date: d, _diff: Math.ceil((d - now)/86400000) };
    })
    .filter(t => t._diff >= 0 && t._diff <= 7)
    .sort((a,b) => a._diff - b._diff);

  let upcomingHTML = '<div class="overview-section-title">📅 Tugas 7 Hari ke Depan</div>';
  if (upcoming.length === 0) {
    upcomingHTML += '<div class="overview-no-task">Tidak ada tugas mendatang 🎉</div>';
  } else {
    upcomingHTML += '<div class="overview-task-list">';
    upcoming.forEach(t => {
      const mapel = state.mapel.find(m => m.id === t.mapelId);
      const ds = getDeadlineStatus(t.deadline);
      upcomingHTML += `<div class="overview-task-item"><span class="overview-task-mapel" style="color:${mapel?.warna||'var(--text2)'}">${mapel?.ikon||'📝'}</span><span class="overview-task-judul">${sanitize(t.judul)}</span><span class="deadline-badge ${ds.cls}">${ds.label}</span></div>`;
    });
    upcomingHTML += '</div>';
  }

  // Stats
  const total   = state.tugas.length;
  const selesai = state.tugas.filter(t => t.selesai).length;
  const pct     = total > 0 ? Math.round(selesai/total*100) : 0;
  const statsHTML = `<div class="overview-stats"><div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Total Tugas</div></div><div class="stat-card"><div class="stat-num">${selesai}</div><div class="stat-label">Selesai</div></div><div class="stat-card"><div class="stat-num">${pct}%</div><div class="stat-label">Progress</div></div><div class="stat-card"><div class="stat-num">${upcoming.length}</div><div class="stat-label">Mendatang</div></div></div>`;

  container.innerHTML = statsHTML + '<div class="overview-section-title">🗓️ Jadwal Minggu Ini</div>' + scheduleHTML + upcomingHTML;
}

// ===== POMODORO TIMER =====
let pomState = { mode:'work', timeLeft:0, running:false, sessions:0 };
let pomInterval = null;

function initPomodoroUI() {
  const { work, shortBreak, longBreak } = state.pomodoro;
  document.getElementById('pomWork').value       = work;
  document.getElementById('pomShort').value      = shortBreak;
  document.getElementById('pomLong').value       = longBreak;
  if (!pomState.running) {
    pomState.timeLeft = work * 60;
    pomState.mode = 'work';
  }
  updatePomDisplay();
}

function updatePomDisplay() {
  const m = Math.floor(pomState.timeLeft / 60).toString().padStart(2,'0');
  const s = (pomState.timeLeft % 60).toString().padStart(2,'0');
  const el = document.getElementById('pomTimer');
  if (el) el.textContent = m + ':' + s;
  const label = document.getElementById('pomModeLabel');
  const modeNames = { work:'🍅 Fokus', shortBreak:'☕ Istirahat Pendek', longBreak:'🛌 Istirahat Panjang' };
  if (label) label.textContent = modeNames[pomState.mode] || '';
  const startBtn = document.getElementById('pomStart');
  if (startBtn) startBtn.textContent = pomState.running ? '⏸ Pause' : '▶ Mulai';
  const sessEl = document.getElementById('pomSessions');
  if (sessEl) sessEl.textContent = 'Sesi: ' + pomState.sessions;
}

function pomTick() {
  if (pomState.timeLeft > 0) {
    pomState.timeLeft--;
    updatePomDisplay();
  } else {
    clearInterval(pomInterval); pomInterval = null; pomState.running = false;
    // Advance mode
    if (pomState.mode === 'work') {
      pomState.sessions++;
      pomState.mode = (pomState.sessions % 4 === 0) ? 'longBreak' : 'shortBreak';
      pomState.timeLeft = (pomState.mode === 'longBreak' ? state.pomodoro.longBreak : state.pomodoro.shortBreak) * 60;
      showToast('Waktu istirahat! 🎉','success');
    } else {
      pomState.mode = 'work';
      pomState.timeLeft = state.pomodoro.work * 60;
      showToast('Waktunya fokus! 🍅','default');
    }
    updatePomDisplay();
    // Auto-start next
    startPomodoro();
  }
}

function startPomodoro() {
  if (pomState.running) {
    clearInterval(pomInterval); pomInterval = null; pomState.running = false;
  } else {
    pomState.running = true;
    pomInterval = setInterval(pomTick, 1000);
  }
  updatePomDisplay();
}

function resetPomodoro() {
  clearInterval(pomInterval); pomInterval = null;
  pomState = { mode:'work', timeLeft: state.pomodoro.work * 60, running:false, sessions:0 };
  updatePomDisplay();
}

function savePomSettings() {
  const w  = parseInt(document.getElementById('pomWork').value)  || 25;
  const sb = parseInt(document.getElementById('pomShort').value) || 5;
  const lb = parseInt(document.getElementById('pomLong').value)  || 15;
  state.pomodoro = { work:w, shortBreak:sb, longBreak:lb };
  saveState();
  if (!pomState.running) { pomState.timeLeft = w * 60; pomState.mode = 'work'; updatePomDisplay(); }
  showToast('Pengaturan Pomodoro disimpan!','success');
}

// ===== GOOGLE APPS SCRIPT INTEGRATION =====
const APPS_SCRIPT_CODE = `/**
 * SchoolPlanner - Google Apps Script Backend
 * Deploy sebagai Web App: Execute as Me, Anyone can access
 */
const SPREADSHEET_ID = 'GANTI_DENGAN_SPREADSHEET_ID_KAMU';
const SHEET_TUGAS  = 'Tugas';
const SHEET_JADWAL = 'Jadwal';

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
    if (body.action === 'addTugas')    { addTugasRow(body.data);              return makeResponse({ ok:true }); }
    if (body.action === 'updateStatus'){ updateTugasStatus(body.id,body.status); return makeResponse({ ok:true }); }
    if (body.action === 'deleteTugas') { deleteTugasRow(body.id);             return makeResponse({ ok:true }); }
    if (body.action === 'syncTugas')   { syncAllTugas(body.data);             return makeResponse({ ok:true }); }
    return makeResponse({ ok:false, error:'Action tidak dikenal' });
  } catch(err) { return makeResponse({ ok:false, error:err.toString() }); }
}
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.getRange(1,1,1,headers.length).setBackground('#4a4a6a').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
const TUGAS_HEADERS = ['ID','Judul','Mata Pelajaran','Guru','Deadline','Tipe','Catatan','Status','Dibuat'];
function getTugasData() {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2,1,lastRow-1,TUGAS_HEADERS.length).getValues()
    .filter(r => r[0])
    .map(r => ({
      id:r[0].toString(), judul:r[1].toString(), mapelNama:r[2].toString(),
      guru:r[3].toString(),
      deadline:r[4] ? Utilities.formatDate(new Date(r[4]),'Asia/Jakarta','yyyy-MM-dd') : '',
      tipe:r[5].toString()||'pr', catatan:r[6].toString(),
      selesai:r[7].toString().toLowerCase()==='selesai',
      createdAt:r[8] ? new Date(r[8]).getTime() : Date.now()
    }));
}
function addTugasRow(data) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  sheet.appendRow([data.id,data.judul,data.mapelNama||'',data.guru||'',data.deadline||'',data.tipe||'pr',data.catatan||'',data.selesai?'Selesai':'Belum',new Date()]);
}
function updateTugasStatus(id, status) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return;
  const ids = sheet.getRange(2,1,lastRow-1,1).getValues();
  for (let i=0;i<ids.length;i++) { if (ids[i][0].toString()===id.toString()) { sheet.getRange(i+2,8).setValue(status?'Selesai':'Belum'); return; } }
}
function deleteTugasRow(id) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return;
  const ids = sheet.getRange(2,1,lastRow-1,1).getValues();
  for (let i=ids.length-1;i>=0;i--) { if (ids[i][0].toString()===id.toString()) { sheet.deleteRow(i+2); return; } }
}
function syncAllTugas(tugasList) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow-1);
  if (tugasList && tugasList.length > 0) {
    const rows = tugasList.map(t => [t.id,t.judul,t.mapelNama||'',t.guru||'',t.deadline||'',t.tipe||'pr',t.catatan||'',t.selesai?'Selesai':'Belum',t.createdAt?new Date(t.createdAt):new Date()]);
    sheet.getRange(2,1,rows.length,TUGAS_HEADERS.length).setValues(rows);
  }
}
const JADWAL_HEADERS = ['ID','Hari','Mata Pelajaran','Jam Mulai','Jam Selesai','Guru','Ruangan'];
function getJadwalData() {
  const sheet = getOrCreateSheet(SHEET_JADWAL, JADWAL_HEADERS);
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return {};
  const result = {};
  sheet.getRange(2,1,lastRow-1,JADWAL_HEADERS.length).getValues().filter(r=>r[0]).forEach(r => {
    const hari = r[1].toString().toLowerCase();
    if (!result[hari]) result[hari] = [];
    result[hari].push({ id:r[0].toString(), hari, mapelNama:r[2].toString(), jamMulai:r[3].toString(), jamSelesai:r[4].toString(), guru:r[5].toString(), ruangan:r[6].toString() });
  });
  return result;
}`;

// ===== SHEETS UI =====
function initSheets() {
  const { scriptUrl, connected } = state.sheets;
  const el = document.getElementById('scriptUrl');
  if (el) el.value = scriptUrl || '';
  updateConnectionUI(connected);
}

function updateConnectionUI(connected) {
  ['connectionBadge','connectionBadgeDesktop'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.className = 'conn-badge' + (connected ? ' connected' : '');
  });
  ['connectionLabel','connectionLabelDesktop'].forEach(id => {
    const l = document.getElementById(id);
    if (l) l.textContent = connected ? 'Terhubung ✅' : 'Belum terhubung';
  });
  const pingBtn       = document.getElementById('btnPingScript');
  const disconnectBtn = document.getElementById('btnDisconnect');
  const syncCard      = document.getElementById('syncCard');
  if (pingBtn)       pingBtn.disabled       = !connected;
  if (disconnectBtn) disconnectBtn.disabled = !connected;
  if (syncCard) {
    syncCard.style.opacity       = connected ? '1' : '0.4';
    syncCard.style.pointerEvents = connected ? 'all' : 'none';
  }
  clearInterval(window._autoRefreshTimer);
  if (connected) {
    let countdown = 30;
    const badge = document.getElementById('autoRefreshBadge');
    const tick = () => {
      if (badge) badge.textContent = `Auto-refresh: ${countdown}s`;
      countdown--;
      if (countdown < 0) { countdown = 30; pullFromSheets(true); }
    };
    tick();
    window._autoRefreshTimer = setInterval(tick, 1000);
  } else {
    const badge = document.getElementById('autoRefreshBadge');
    if (badge) badge.textContent = 'Auto-refresh: off';
  }
}

function showSheetsStatus(msg, type, elId = 'sheetsStatus') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.className = msg ? 'status-msg ' + type : 'status-msg';
}

// Helper: extract Spreadsheet ID from URL or raw ID
function extractSpreadsheetId(input) {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

async function connectScript() {
  const url = document.getElementById('scriptUrl').value.trim();
  if (!url) { showSheetsStatus('❌ Masukkan URL Web App terlebih dahulu','error'); return; }
  if (!url.includes('script.google.com/macros')) {
    showSheetsStatus('❌ URL tidak valid. Harus berupa URL Apps Script Web App','error'); return;
  }
  const btn = document.getElementById('btnConnectScript');
  if (btn) { btn.disabled = true; btn.textContent = '🔄 Menghubungkan...'; }
  showSheetsStatus('🔄 Menghubungkan...','info');
  try {
    const res  = await fetch(url + '?action=ping');
    const json = await res.json();
    if (json.ok) {
      state.sheets = { ...state.sheets, scriptUrl:url, connected:true };
      saveState();
      updateConnectionUI(true);
      showSheetsStatus('✅ ' + json.message,'success');
      showToast('Berhasil terhubung ke Apps Script!','success');
    } else {
      showSheetsStatus('❌ Script merespons tapi ada error: ' + json.error,'error');
    }
  } catch(e) {
    showSheetsStatus('❌ Gagal terhubung. Pastikan URL benar dan script sudah di-deploy dengan akses "Anyone".','error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔌 Hubungkan'; }
  }
}

async function pingScript() {
  const url = state.sheets.scriptUrl;
  if (!url) return;
  showSheetsStatus('🏓 Mengirim ping...','info');
  try {
    const res  = await fetch(url + '?action=ping');
    const json = await res.json();
    showSheetsStatus(json.ok ? '✅ '+json.message : '❌ '+json.error, json.ok ? 'success' : 'error');
  } catch(e) {
    showSheetsStatus('❌ Tidak bisa menjangkau script. Cek koneksi internet.','error');
  }
}

function disconnectScript() {
  if (!confirm('Putuskan koneksi ke Apps Script?')) return;
  state.sheets = { scriptUrl:'', connected:false };
  saveState(); updateConnectionUI(false);
  const el = document.getElementById('scriptUrl');
  if (el) el.value = '';
  const preview = document.getElementById('sheetsPreview');
  if (preview) preview.style.display = 'none';
  const statusEl = document.getElementById('sheetsStatus');
  if (statusEl) statusEl.className = 'status-msg';
  showToast('Koneksi diputus','default');
}

async function pullFromSheets(silent = false) {
  const url = state.sheets.scriptUrl;
  if (!url) return;
  if (!silent) showSheetsStatus('⬇️ Mengambil data dari spreadsheet...','info','syncStatus');
  try {
    const res  = await fetch(url + '?action=getTugas');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    const data = json.data || [];
    if (data.length === 0) {
      if (!silent) showSheetsStatus('⚠️ Tidak ada data di spreadsheet','error','syncStatus');
      return;
    }
    if (!silent) {
      renderSheetsPreview(data);
      showSheetsStatus(`✅ Berhasil mengambil ${data.length} tugas dari spreadsheet`,'success','syncStatus');
    } else {
      let added = 0;
      data.forEach(item => {
        if (!item.judul) return;
        const exists = state.tugas.find(t => t.id === item.id);
        if (exists) { exists.selesai = item.selesai; }
        else {
          const mapel = state.mapel.find(m => m.nama.toLowerCase() === (item.mapelNama||'').toLowerCase());
          state.tugas.push({ id:item.id||genId(), judul:item.judul, mapelId:mapel?mapel.id:(state.mapel[0]?.id||''), guru:item.guru||'', deadline:item.deadline||'', tipe:item.tipe||'pr', catatan:item.catatan||'', prioritas:'sedang', subtasks:[], selesai:item.selesai||false, createdAt:item.createdAt||Date.now() });
          added++;
        }
      });
      if (added > 0) { saveState(); renderTugas(); }
    }
  } catch(e) {
    if (!silent) showSheetsStatus('❌ Gagal mengambil data: '+e.message,'error','syncStatus');
  }
}

async function pushToSheets() {
  const url = state.sheets.scriptUrl;
  if (!state.tugas.length) { showSheetsStatus('⚠️ Tidak ada tugas untuk di-push','error','syncStatus'); return; }
  if (!confirm(`Push ${state.tugas.length} tugas ke spreadsheet? Data lama di sheet akan diganti.`)) return;
  showSheetsStatus('⬆️ Mengirim data ke spreadsheet...','info','syncStatus');
  try {
    const payload = state.tugas.map(t => {
      const mapel = state.mapel.find(m => m.id === t.mapelId);
      return { ...t, mapelNama: mapel ? mapel.nama : '' };
    });
    const res  = await fetch(url, { method:'POST', body:JSON.stringify({ action:'syncTugas', data:payload }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    showSheetsStatus(`✅ ${state.tugas.length} tugas berhasil dikirim ke spreadsheet!`,'success','syncStatus');
    showToast('Push ke Sheets berhasil!','success');
  } catch(e) {
    showSheetsStatus('❌ Gagal push: '+e.message,'error','syncStatus');
  }
}

async function syncStatusToSheets(id, selesai) {
  if (!state.sheets.connected || !state.sheets.scriptUrl) return;
  try {
    await fetch(state.sheets.scriptUrl, { method:'POST', body:JSON.stringify({ action:'updateStatus', id, status:selesai }) });
  } catch(e) { /* silent */ }
}

function renderSheetsPreview(data) {
  const preview = document.getElementById('sheetsPreview');
  const content = document.getElementById('sheetsPreviewContent');
  if (!preview || !content) return;
  preview.style.display = 'block';
  preview._data = data;
  const rows = data.slice(0, 10);
  let html = '<div style="overflow-x:auto"><table class="sheets-table"><thead><tr>';
  ['Mapel','Judul','Deadline','Guru','Status'].forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach(r => {
    html += `<tr><td>${sanitize(r.mapelNama||'-')}</td><td>${sanitize(r.judul||'-')}</td><td>${sanitize(r.deadline||'-')}</td><td>${sanitize(r.guru||'-')}</td><td>${r.selesai?'✅ Selesai':'⏳ Belum'}</td></tr>`;
  });
  html += '</tbody></table></div>';
  if (data.length > 10) html += `<p style="font-size:12px;color:var(--text3);margin-top:8px">...dan ${data.length-10} tugas lainnya</p>`;
  content.innerHTML = html;
}

function importFromSheets() {
  const preview = document.getElementById('sheetsPreview');
  const data = preview?._data;
  if (!data) return;
  let imported = 0;
  data.forEach(item => {
    if (!item.judul) return;
    if (state.tugas.find(t => t.id === item.id)) return; // ID-based dedup only
    const mapel = state.mapel.find(m => m.nama.toLowerCase() === (item.mapelNama||'').toLowerCase());
    state.tugas.push({ id:item.id||genId(), judul:item.judul, mapelId:mapel?mapel.id:(state.mapel[0]?.id||''), guru:item.guru||'', deadline:item.deadline||'', tipe:item.tipe||'pr', catatan:item.catatan||'', prioritas:'sedang', subtasks:[], selesai:item.selesai||false, createdAt:item.createdAt||Date.now() });
    imported++;
  });
  saveState(); renderTugas();
  showToast(`${imported} tugas berhasil diimport!`,'success');
  showSheetsStatus(`✅ ${imported} tugas diimport ke daftar tugas`,'success','syncStatus');
}

function downloadTemplate() {
  const csv = 'ID,Judul,Mata Pelajaran,Guru,Deadline,Tipe,Catatan,Status,Dibuat\n,Latihan Soal Bab 3,Matematika,Bu Sari,2026-05-15,pr,,Belum,\n,Buat Puisi,B. Indonesia,Pak Budi,2026-05-20,pr,,Belum,\n';
  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'template_tugas_schoolplanner.csv';
  a.click();
}

function copyScriptCode() {
  navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
    showToast('Kode Apps Script berhasil di-copy!','success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = APPS_SCRIPT_CODE;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    showToast('Kode Apps Script berhasil di-copy!','success');
  });
}

// Auto-extract Spreadsheet ID from URL pasted into input
function handleSpreadsheetUrlInput(val) {
  const id = extractSpreadsheetId(val);
  const hint = document.getElementById('spreadsheetIdHint');
  if (hint) hint.textContent = id !== val.trim() ? `ID terdeteksi: ${id}` : '';
}
