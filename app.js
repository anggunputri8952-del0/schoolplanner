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
