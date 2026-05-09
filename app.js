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
