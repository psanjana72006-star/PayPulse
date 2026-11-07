/* =====================================================
   Shared helpers used by every page
   ===================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => localDate();
function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

/* Tiny DOM builder: h('div', {class:'x', onclick:fn}, child, child) - text is always escaped */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (['value', 'checked', 'disabled', 'selected'].includes(k)) el[k] = v;
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  kids.flat().forEach((c) => c != null && c !== false && el.append(c.nodeType ? c : document.createTextNode(c)));
  return el;
}

/* ---------- API ---------- */
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    localStorage.removeItem('token');
    if (!/index\.html$|\/$/.test(location.pathname)) location.href = 'index.html';
    throw new Error('Please log in again');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

/* ---------- Toasts + sound ---------- */
function toast(msg, type = 'info', ms = 4000, action = null) {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
  const el = h('div', { class: 'toast ' + type }, msg,
    action ? h('button', { class: 'small', style: 'margin-left:10px', onclick: () => { el.remove(); action.fn(); } }, action.label) : null);
  box.append(el);
  setTimeout(() => el.remove(), ms);
}
function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = 880; g.gain.value = 0.1;
    o.start();
    setTimeout(() => { o.stop(); c.close(); }, 350);
  } catch { /* sound is optional */ }
}

/* ---------- Reminders (runs on every page) ---------- */
function notify(title, body) {
  toast(`⏰ ${title}: ${body}`, 'warn', 9000);
  beep();
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch { /* ignore */ }
  }
}
async function checkReminders() {
  let r;
  try { r = await api('/reminders'); } catch { return; }
  const now = new Date(), t = today();
  const seen = JSON.parse(localStorage.getItem('seenReminders') || '{}');
  const mark = (k) => { if (seen[k]) return false; seen[k] = Date.now(); return true; };

  r.overdue.forEach((x) => mark(`o-${x.id}-${t}`) && notify('Overdue', `${x.title} (was due ${x.due_date})`));
  r.today.forEach((x) => {
    if (x.due_time) {
      const [hh, mm] = x.due_time.split(':').map(Number);
      const due = new Date(); due.setHours(hh, mm, 0, 0);
      const mins = Math.round((due - now) / 60000);
      if (mins <= (parseInt(localStorage.getItem('leadMins')) || 30) && mins >= -60 && mark(`s-${x.id}-${t}`)) notify(mins >= 0 ? `Due in ${mins} min` : 'Due now', x.title);
    } else if (mark(`d-${x.id}-${t}`)) notify('Due today', x.title);
  });
  for (const k in seen) if (Date.now() - seen[k] > 3 * 864e5) delete seen[k];
  localStorage.setItem('seenReminders', JSON.stringify(seen));

  const badge = $('#bellCount');
  if (badge) { const n = r.overdue.length + r.today.length; badge.textContent = n; badge.style.display = n ? 'inline-block' : 'none'; }
}

/* ---------- Page start-up + navigation bar ---------- */
const PAGES = [
  ['dashboard', '🏠', 'Dashboard'], ['tasks', '📋', 'Tasks'], ['board', '🗂', 'Board'], ['calendar', '📆', 'Calendar'],
  ['reminders', '⏰', 'Reminders'], ['focus', '⏱', 'Focus'], ['progress', '📈', 'Progress'],
  ['achievements', '🏆', 'Achievements'], ['ai', '🤖', 'AI Assistant'],
];
const PAGES_MORE = [['settings', '⚙️', 'Settings'], ['help', '❓', 'Help']];
const refreshPage = () => (typeof load === 'function' ? load() : location.reload());

function initPage(active) {
  if (!localStorage.getItem('token')) { location.href = 'index.html'; return false; }
  if (localStorage.getItem('dark') === '1') document.body.classList.add('dark');
  document.body.classList.add('with-sidebar');

  const link = ([id, icon, label]) => h('a', { href: id + '.html', class: id === active ? 'active' : '' }, h('span', { class: 'ico' }, icon), label);
  const sidebar = h('aside', { class: 'sidebar', id: 'sidebar' },
    h('nav', {}, PAGES.map(link)), h('hr'), h('nav', {}, PAGES_MORE.map(link)),
    h('p', { class: 'hint' }, 'Tip: press ', h('kbd', {}, 'N'), ' anywhere to add a task'));
  const bell = h('button', {
    class: 'ghost bell', title: 'Turn on deadline notifications',
    onclick: async () => {
      if (!('Notification' in window)) return toast('This browser has no notification support. In-app reminders still work.');
      const p = await Notification.requestPermission();
      toast(p === 'granted' ? '🔔 Desktop notifications are on' : 'Notifications are blocked. Allow them from the 🔒 icon in the address bar.', p === 'granted' ? 'success' : 'error');
    },
  }, '🔔', h('span', { id: 'bellCount', style: 'display:none' }, '0'));
  const header = h('header', { class: 'topbar' },
    h('button', { class: 'ghost menu', 'aria-label': 'Menu', onclick: () => sidebar.classList.toggle('open') }, '☰'),
    h('a', { class: 'brand', href: 'dashboard.html' }, '✅ TO-DO-List'),
    h('div', { class: 'right' },
      h('span', { class: 'who' }, '👤 ' + (localStorage.getItem('userName') || '')),
      bell,
      h('button', { class: 'ghost', title: 'Dark mode', onclick: () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('dark', document.body.classList.contains('dark') ? '1' : '0');
      } }, '🌙'),
      h('button', { class: 'ghost', onclick: () => { localStorage.removeItem('token'); location.href = 'index.html'; } }, 'Log out')));
  const fab = h('button', { class: 'fab', title: 'Add a task (press N)', 'aria-label': 'Add a task', onclick: () => openTaskModal(null, refreshPage) }, '＋');

  document.body.prepend(header);
  document.body.append(sidebar, fab);
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !$('.overlay')) { e.preventDefault(); openTaskModal(null, refreshPage); }
  });
  checkReminders();
  setInterval(checkReminders, 60000);
  return true;
}

/* ---------- Voice input (fixed: permission prompt + clear error messages) ---------- */
let activeRec = null;
function voiceError(code) {
  return ({
    'not-allowed': 'Microphone is blocked. Click the 🔒 icon in the address bar, set Microphone to Allow, then reload the page.',
    'service-not-allowed': 'Microphone is blocked. Click the 🔒 icon in the address bar, set Microphone to Allow, then reload the page.',
    'no-speech': 'I did not hear anything. Check that the right microphone is selected, then try again.',
    'audio-capture': 'No microphone was found. Plug one in or check Windows Settings → Privacy → Microphone.',
    'network': 'Chrome\'s speech service needs an internet connection. Check your network and try again.',
    'language-not-supported': 'This language is not supported for voice input.',
  })[code] || 'Voice input stopped (' + code + ').';
}
async function startVoice(input, btn, onDone) {
  if (activeRec) { activeRec.stop(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Voice input is not supported in this browser. Open the site in Google Chrome or Microsoft Edge.', 'error', 8000);
  if (!window.isSecureContext) return toast('Voice input only works on http://localhost:3000 (not on an IP address or a file).', 'error', 8000);

  // Ask for the microphone first so the browser shows its permission pop-up
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      return toast(e.name === 'NotFoundError' ? voiceError('audio-capture') : voiceError('not-allowed'), 'error', 9000);
    }
  }
  const rec = new SR();
  rec.lang = localStorage.getItem('voiceLang') || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  let heard = '';
  rec.onstart = () => { btn.classList.add('listening'); toast('🎤 Listening… speak now', 'info', 2500); };
  rec.onresult = (e) => {
    heard = [...e.results].map((r) => r[0].transcript).join(' ');
    input.value = heard;
    input.dispatchEvent(new Event('input'));
  };
  rec.onerror = (e) => { if (e.error !== 'aborted') toast(voiceError(e.error), 'error', 9000); };
  rec.onend = () => { activeRec = null; btn.classList.remove('listening'); if (heard && onDone) onDone(heard); };
  activeRec = rec;
  try { rec.start(); } catch (e) { activeRec = null; toast('Could not start the microphone: ' + e.message, 'error'); }
}

/* ---------- Smart quick-add parser (works for typed AND spoken text) ---------- */
function parseQuick(text) {
  let priority = 'medium', category = 'General', due_date = null, due_time = null, recurring = 'none';
  const now = new Date();
  const setDays = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); due_date = localDate(d); };
  const rep = (re, fn) => { text = text.replace(re, (...a) => { fn(...a); return ' '; }); };

  rep(/#(\w+)/, (m, c) => { category = c; });
  rep(/\bcategory\s+(\w+)/i, (m, c) => { category = c; });
  rep(/!(high|medium|low)\b|\b(high|medium|low)\s+priority\b/i, (m, a, b) => { priority = (a || b).toLowerCase(); });
  rep(/\b(every day|daily|every week|weekly|every month|monthly)\b/i, (m, r) => {
    r = r.toLowerCase();
    recurring = r.includes('day') || r === 'daily' ? 'daily' : r.includes('week') ? 'weekly' : 'monthly';
  });
  rep(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?(?=\W|$)/i, (m, hh, mm, ap) => {
    let hr = parseInt(hh) % 12; if (ap.toLowerCase() === 'p') hr += 12;
    due_time = `${pad(hr)}:${mm || '00'}`;
  });
  rep(/\bat\s+(\d{1,2}):(\d{2})\b/i, (m, hh, mm) => { due_time = `${pad(hh)}:${mm}`; });
  rep(/\bday after tomorrow\b/i, () => setDays(2));
  rep(/\bnext week\b/i, () => setDays(7));
  rep(/\bin (\d{1,2}) days?\b/i, (m, n) => setDays(parseInt(n)));
  rep(/\btomorrow\b/i, () => setDays(1));
  rep(/\b(today|tonight)\b/i, () => setDays(0));
  rep(/\b(?:next\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, (m, w) => {
    const idx = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(w.toLowerCase());
    let diff = (idx - now.getDay() + 7) % 7; if (diff === 0) diff = 7;
    setDays(diff);
  });
  if (due_time && !due_date) setDays(0);

  const title = text.replace(/\s+/g, ' ').replace(/\b(on|by|at|for|due|before|in)\s*$/i, '').trim();
  return { title: title.charAt(0).toUpperCase() + title.slice(1), priority, category, due_date, due_time, recurring };
}
const describeParsed = (t) => t.title
  ? `Task: "${t.title}" · ${t.priority} priority · #${t.category}` +
    (t.due_date ? ` · due ${t.due_date}${t.due_time ? ' ' + t.due_time : ''}` : '') +
    (t.recurring !== 'none' ? ` · repeats ${t.recurring}` : '')
  : '';

/* ---------- Task helpers ---------- */
const isOverdue = (t) => t.status !== 'done' && t.due_date && t.due_date < today();
function dueLabel(t) {
  if (!t.due_date) return 'No deadline';
  const base = t.due_date === today() ? 'Today' : t.due_date === addDays(today(), 1) ? 'Tomorrow' : t.due_date;
  return base + (t.due_time ? ' ' + t.due_time : '');
}
const progressBar = (p) => h('div', { class: 'bar' }, h('span', { style: `width:${p}%` }));
const getSubs = (t) => { try { return JSON.parse(t.subtasks || '[]'); } catch { return []; } };
const taskFields = (t) => ({
  title: t.title, notes: t.notes, priority: t.priority, category: t.category, due_date: t.due_date, due_time: t.due_time,
  status: t.status, recurring: t.recurring, progress: t.progress, subtasks: getSubs(t),
});

function taskRow(t, refresh, extra = []) {
  const subs = getSubs(t);
  const check = h('input', {
    type: 'checkbox', checked: t.status === 'done', title: 'Mark as done',
    onchange: async (e) => {
      await api('/tasks/' + t.id, 'PUT', { status: e.target.checked ? 'done' : 'todo' });
      toast(e.target.checked ? '🎉 Task completed' : 'Task reopened', 'success');
      refresh();
    },
  });
  const meta = h('div', { class: 'meta' },
    h('span', { class: 'badge ' + t.priority }, t.priority),
    h('span', {}, '#' + t.category),
    h('span', { class: isOverdue(t) ? 'late' : '' }, (isOverdue(t) ? '⚠ Overdue · ' : '📅 ') + dueLabel(t)),
    subs.length ? h('span', {}, `☑ ${subs.filter((s) => s.d).length}/${subs.length}`) : null,
    t.recurring !== 'none' ? h('span', {}, '🔁 ' + t.recurring) : null,
    t.focus_minutes ? h('span', {}, '⏱ ' + t.focus_minutes + ' min') : null);
  return h('div', { class: 'task-row ' + (t.status === 'done' ? 'done' : '') },
    check,
    h('div', { class: 'grow' }, h('div', { class: 'title' }, t.title), meta,
      t.status !== 'done' && t.progress > 0 ? h('div', { class: 'prog' }, progressBar(t.progress), h('small', {}, t.progress + '%')) : null),
    h('div', { class: 'actions' },
      ...extra,
      h('a', { class: 'btn ghost small', href: 'focus.html?task=' + t.id, title: 'Focus on this task' }, '⏱'),
      h('button', { class: 'ghost small', title: 'Edit', onclick: () => openTaskModal(t, refresh) }, '✏️'),
      h('button', { class: 'ghost small', title: 'Delete', onclick: async () => {
        await api('/tasks/' + t.id, 'DELETE');
        toast('Task deleted', 'success', 8000, { label: 'Undo', fn: async () => { await api('/tasks', 'POST', taskFields(t)); toast('Task restored', 'success'); refresh(); } });
        refresh();
      } }, '🗑')));
}

/* ---------- Add / edit task pop-up ---------- */
function openTaskModal(task, onSaved) {
  const t = task || {};
  const isNew = !t.id;
  const sel = (opts, val) => {
    const s = h('select', {}, opts.map((o) => h('option', { value: o[0] }, o[1])));
    s.value = val; return s;
  };
  const f = {
    title: h('input', { placeholder: 'What needs to be done?', value: t.title || '' }),
    notes: h('textarea', { rows: 2, placeholder: 'Notes (optional)', value: t.notes || '' }),
    priority: sel([['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], t.priority || 'medium'),
    category: h('input', { value: t.category || 'General', list: 'catList' }),
    due_date: h('input', { type: 'date', value: t.due_date || '' }),
    due_time: h('input', { type: 'time', value: t.due_time || '' }),
    recurring: sel([['none', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']], t.recurring || 'none'),
    status: sel([['todo', 'To Do'], ['doing', 'In Progress'], ['done', 'Done']], t.status || 'todo'),
    progress: h('input', { type: 'range', min: 0, max: 100, step: 5, value: t.progress || 0 }),
  };
  const catList = h('datalist', { id: 'catList' }, ['General', 'College', 'Study', 'Home', 'Health', 'Work', 'Personal'].map((c) => h('option', { value: c })));
  const pct = h('b', {}, (t.progress || 0) + '%');
  f.progress.addEventListener('input', () => { pct.textContent = f.progress.value + '%'; });

  // Subtasks (checklist) - progress follows the ticked boxes
  const subs = getSubs(t).map((x) => ({ ...x }));
  const subBox = h('div', { class: 'subs' });
  const syncProgress = () => {
    const real = subs.filter((s) => s.t.trim());
    if (!real.length) return;
    const p = Math.round((real.filter((s) => s.d).length / real.length) * 100);
    f.progress.value = p; pct.textContent = p + '%';
    if (p === 100) f.status.value = 'done';
    else if (p > 0 && f.status.value === 'todo') f.status.value = 'doing';
    else if (p < 100 && f.status.value === 'done') f.status.value = 'doing';
  };
  const drawSubs = () => subBox.replaceChildren(...subs.map((s, i) => h('div', { class: 'row sub' },
    h('input', { type: 'checkbox', checked: s.d, onchange: (e) => { s.d = e.target.checked; syncProgress(); } }),
    h('input', { value: s.t, placeholder: 'Subtask', oninput: (e) => { s.t = e.target.value; } }),
    h('button', { class: 'ghost small', title: 'Remove', onclick: () => { subs.splice(i, 1); drawSubs(); syncProgress(); } }, '✕'))));
  drawSubs();

  const label = (text, el) => h('label', {}, text, el);
  const close = () => overlay.remove();
  const save = async () => {
    const body = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
    body.subtasks = subs.filter((s) => s.t.trim());
    if (!body.title.trim()) return toast('Please enter a task title', 'error');
    try {
      if (isNew) await api('/tasks', 'POST', body); else await api('/tasks/' + t.id, 'PUT', body);
      close(); toast(isNew ? 'Task added' : 'Changes saved', 'success');
      onSaved && onSaved();
    } catch (e) { toast(e.message, 'error'); }
  };
  const overlay = h('div', { class: 'overlay', onclick: (e) => e.target === overlay && close() },
    h('div', { class: 'modal card' },
      h('h3', {}, isNew ? '＋ New task' : '✏️ Edit task'),
      label('Title', f.title), label('Notes', f.notes),
      h('div', { class: 'two' }, label('Priority', f.priority), label('Category', f.category)),
      h('div', { class: 'two' }, label('Due date', f.due_date), label('Due time (reminder 30 min before)', f.due_time)),
      h('div', { class: 'two' }, label('Repeat', f.recurring), label('Status', f.status)),
      label('Checklist (optional)', h('div', {}, subBox,
        h('button', { class: 'ghost small', onclick: () => { subs.push({ t: '', d: false }); drawSubs(); subBox.lastChild.children[1].focus(); } }, '＋ Add subtask'))),
      label('Progress', h('div', { class: 'row' }, f.progress, pct)),
      catList,
      h('div', { class: 'row end' },
        h('button', { class: 'ghost', onclick: close }, 'Cancel'),
        h('button', { onclick: save }, 'Save task'))));
  document.body.append(overlay);
  f.title.focus();
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && e.target === f.title) save();
  });
}

/* ---------- Small chart helpers ---------- */
function barChart(items, { height = 90, color } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return h('div', { class: 'chart', style: `height:${height + 40}px` },
    items.map((i) => h('div', { class: 'cbar' },
      h('small', {}, String(i.value)),
      h('div', { style: `height:${Math.max(2, Math.round((i.value / max) * height))}px;` + (color ? `background:${color}` : '') }),
      h('span', {}, i.label))));
}
function hbar(label, done, total) {
  const pctDone = total ? Math.round((done / total) * 100) : 0;
  return h('div', { class: 'hbar' }, h('div', { class: 'hl' }, h('span', {}, label), h('small', {}, `${done}/${total} done`)), progressBar(pctDone));
}
const shortDay = (iso) => iso.slice(8) + '/' + iso.slice(5, 7);
