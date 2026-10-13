/* Beesi — community chit-fund ledger. Vanilla JS, localStorage persisted. */
(function(){
'use strict';

/* ================= utils ================= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ICONS = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  users:'<path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9"/><path d="M16 3.1a4 4 0 010 7.8"/>',
  wallet:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  alert:'<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  down:'<path d="M12 5v14M19 12l-7 7-7-7"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  cycle:'<path d="M21 12a9 9 0 11-2.6-6.4"/><path d="M21 3v6h-6"/>',
  box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  phone:'<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.13.96.36 1.9.7 2.8a2 2 0 01-.45 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0122 16.9z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>',
  sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'
};
const icon = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
$$('.tab-ic').forEach(el => { el.innerHTML = icon(el.dataset.ic); });

/* ================= storage ================= */
const NS = 'bs_v1_';
const DB = {
  read(k, fb){ try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : fb; } catch(e){ return fb; } },
  write(k, v){ localStorage.setItem(NS + k, JSON.stringify(v)); },
  keys(){ const out = []; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.indexOf(NS) === 0) out.push(k); } return out; },
  wipe(){ DB.keys().forEach(k => localStorage.removeItem(k)); }
};

/* ================= dates & money ================= */
const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function todayISO(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function currentYM(){ return todayISO().slice(0,7); }
function fmtDate(iso){ // YYYY-MM-DD -> DD-MMM-YYYY
  if (!iso) return '—';
  const p = iso.split('-'); if (p.length < 3) return esc(iso);
  return p[2] + '-' + (MON3[+p[1]-1] || p[1]) + '-' + p[0];
}
function ymLabel(ym){ const p = ym.split('-'); return (MON3[+p[1]-1] || p[1]) + ' ' + p[0]; }
function ymShort(ym){ const p = ym.split('-'); return (MON3[+p[1]-1] || p[1]) + ' ’' + p[0].slice(2); }
function monthsOf(g){
  const out = []; let [y, m] = g.startMonth.split('-').map(Number);
  for (let i = 0; i < g.rounds; i++){ out.push(y + '-' + String(m).padStart(2,'0')); m++; if (m > 12){ m = 1; y++; } }
  return out;
}
function nextYM(ym){ let [y,m] = ym.split('-').map(Number); m++; if (m>12){m=1;y++;} return y+'-'+String(m).padStart(2,'0'); }
function fmtINR(n){ return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function validPhone(p){ return /^\d{10}$/.test(String(p||'').replace(/\s/g,'')); }

/* ================= state & data ops ================= */
let state = { groups:[], members:[], collections:[], payouts:[], activeGroupId:null, activeMonth:null, tab:'dashboard' };

function saveAll(){
  DB.write('groups', state.groups);
  DB.write('members', state.members);
  DB.write('collections', state.collections);
  DB.write('payouts', state.payouts);
  DB.write('ui', { activeGroupId: state.activeGroupId, activeMonth: state.activeMonth });
}
function loadAll(){
  state.groups = DB.read('groups', []);
  state.members = DB.read('members', []);
  state.collections = DB.read('collections', []);
  state.payouts = DB.read('payouts', []);
  const ui = DB.read('ui', {});
  state.activeGroupId = ui.activeGroupId || (state.groups[0] ? state.groups[0].id : null);
  state.activeMonth = ui.activeMonth || currentYM();
}
const activeGroup = () => state.groups.find(g => g.id === state.activeGroupId) || null;
const groupMembers = gid => state.members.filter(m => m.groupId === gid);
const memberName = id => { const m = state.members.find(x => x.id === id); return m ? m.name : '—'; };

function ensureCollections(g){
  const ms = monthsOf(g), mems = groupMembers(g.id);
  let added = false;
  mems.forEach(m => ms.forEach(ym => {
    if (!state.collections.some(c => c.groupId === g.id && c.memberId === m.id && c.month === ym)){
      state.collections.push({ id: uid(), groupId: g.id, memberId: m.id, month: ym, paid: false, paidDate: null });
      added = true;
    }
  }));
  if (added) saveAll();
}
function getRecord(gid, mid, ym){ return state.collections.find(c => c.groupId === gid && c.memberId === mid && c.month === ym); }

/* ---- groups ---- */
function createGroup(d){
  const g = { id: uid(), name: d.name.trim(), monthly: +d.monthly, startMonth: d.startMonth, rounds: +d.rounds, createdAt: todayISO() };
  state.groups.push(g);
  ensureCollections(g);
  state.activeGroupId = g.id; state.activeMonth = g.startMonth;
  saveAll(); return g;
}
function updateGroup(id, d){
  const g = state.groups.find(x => x.id === id); if (!g) return null;
  g.name = d.name.trim(); g.monthly = +d.monthly; g.startMonth = d.startMonth; g.rounds = +d.rounds;
  ensureCollections(g); saveAll(); return g;
}
function deleteGroup(id){
  state.groups = state.groups.filter(g => g.id !== id);
  state.members = state.members.filter(m => m.groupId !== id);
  state.collections = state.collections.filter(c => c.groupId !== id);
  state.payouts = state.payouts.filter(p => p.groupId !== id);
  if (state.activeGroupId === id){ state.activeGroupId = state.groups[0] ? state.groups[0].id : null; state.activeMonth = currentYM(); }
  saveAll();
}

/* ---- members ---- */
function addMember(gid, d){
  const m = { id: uid(), groupId: gid, name: d.name.trim(), phone: String(d.phone).replace(/\s/g,'') };
  state.members.push(m);
  const g = state.groups.find(x => x.id === gid); if (g) ensureCollections(g);
  saveAll(); return m;
}
function updateMember(id, d){
  const m = state.members.find(x => x.id === id); if (!m) return null;
  m.name = d.name.trim(); m.phone = String(d.phone).replace(/\s/g,''); saveAll(); return m;
}
function deleteMember(id){
  const m = state.members.find(x => x.id === id);
  state.members = state.members.filter(x => x.id !== id);
  state.collections = state.collections.filter(c => c.memberId !== id);
  state.payouts = state.payouts.filter(p => p.memberId !== id);
  if (m){ const g = state.groups.find(x => x.id === m.groupId); if (g) ensureCollections(g); }
  saveAll();
}

/* ---- collections ---- */
function setPaid(recordId, paid){
  const r = state.collections.find(c => c.id === recordId); if (!r) return null;
  r.paid = !!paid;
  r.paidDate = paid ? todayISO() : null;
  saveAll(); return r;
}
function markMonthAll(gid, ym, paid){
  state.collections.forEach(c => { if (c.groupId === gid && c.month === ym){ c.paid = !!paid; c.paidDate = paid ? todayISO() : null; } });
  saveAll();
}
function monthSummary(g, ym){
  const mems = groupMembers(g.id);
  const recs = state.collections.filter(c => c.groupId === g.id && c.month === ym);
  const paidN = recs.filter(r => r.paid).length;
  const expected = mems.length * g.monthly;
  const collected = paidN * g.monthly;
  return { paidN, total: mems.length, expected, collected, pct: expected ? Math.round(collected / expected * 100) : 0 };
}

/* ---- payouts ---- */
function groupPayouts(gid){ return state.payouts.filter(p => p.groupId === gid).sort((a,b) => a.order - b.order); }
function addPayout(gid, d){
  const list = groupPayouts(gid);
  const p = { id: uid(), groupId: gid, memberId: d.memberId, month: d.month, amount: +d.amount || 0, order: list.length + 1, done: false, doneDate: null };
  state.payouts.push(p); saveAll(); return p;
}
function updatePayout(id, d){
  const p = state.payouts.find(x => x.id === id); if (!p) return null;
  if (d.month) p.month = d.month;
  if (d.amount != null) p.amount = +d.amount;
  saveAll(); return p;
}
function deletePayout(id){
  const p = state.payouts.find(x => x.id === id); if (!p) return;
  state.payouts = state.payouts.filter(x => x.id !== id);
  groupPayouts(p.groupId).forEach((x, i) => x.order = i + 1);
  saveAll();
}
function movePayout(id, dir){ // dir -1 up, +1 down
  const p = state.payouts.find(x => x.id === id); if (!p) return;
  const list = groupPayouts(p.groupId);
  const i = list.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const t = list[i].order; list[i].order = list[j].order; list[j].order = t;
  saveAll();
}
function setPayoutDone(id, amount){
  const p = state.payouts.find(x => x.id === id); if (!p) return null;
  p.done = true; p.doneDate = todayISO();
  if (amount != null) p.amount = +amount;
  saveAll(); return p;
}
function reopenPayout(id){
  const p = state.payouts.find(x => x.id === id); if (!p) return null;
  p.done = false; p.doneDate = null; saveAll(); return p;
}
function nextPayout(g){ return groupPayouts(g.id).find(p => !p.done) || null; }

/* ---- aggregates ---- */
function dueMonths(g){ const cm = currentYM(); return monthsOf(g).filter(ym => ym <= cm); }
function defaulterInfo(g){
  const dm = dueMonths(g), mems = groupMembers(g.id);
  return mems.map(m => {
    const unpaid = dm.filter(ym => { const r = getRecord(g.id, m.id, ym); return !r || !r.paid; });
    return { memberId: m.id, name: m.name, phone: m.phone, months: unpaid, owed: unpaid.length * g.monthly };
  }).filter(x => x.months.length > 0).sort((a,b) => b.owed - a.owed);
}
function groupStats(g){
  const mems = groupMembers(g.id), dm = dueMonths(g);
  let paidN = 0;
  dm.forEach(ym => { paidN += state.collections.filter(c => c.groupId === g.id && c.month === ym && c.paid).length; });
  const expected = dm.length * mems.length * g.monthly;
  const collected = paidN * g.monthly;
  const defs = defaulterInfo(g);
  return {
    members: mems.length,
    collected, expected,
    pct: expected ? Math.round(collected / expected * 100) : 0,
    totalRotation: g.monthly * mems.length * g.rounds,
    defaulterCount: defs.length, totalOwed: defs.reduce((s,d) => s + d.owed, 0),
    next: nextPayout(g)
  };
}

/* ================= seed ================= */
function seed(){
  const gid = 'g_sharma';
  const g = { id: gid, name: 'Sharma Parivar Beesi', monthly: 5000, startMonth: '2026-08', rounds: 10, createdAt: '2026-08-01' };
  const names = ['Rajesh Sharma','Priya Sharma','Amit Sharma','Sunita Sharma','Vikram Sharma','Neha Sharma','Ramesh Sharma','Kavita Sharma','Deepak Sharma','Pooja Sharma'];
  const phones = ['9811045210','9811056321','9822067432','9833078543','9844089654','9855090765','9866011876','9877022987','9888033098','9899044109'];
  const members = names.map((n, i) => ({ id: 'm' + (i+1), groupId: gid, name: n, phone: phones[i] }));
  const months = monthsOf(g); // Aug 2026 .. May 2027
  const collections = [];
  const paidDateFor = ym => { const d = [12, 9, 22, 5, 17, 28, 3, 15][Math.floor(Math.random()*8)]; return ym + '-' + String(d).padStart(2,'0'); };
  members.forEach((m, mi) => months.slice(0, 3).forEach((ym, yi) => {
    // Aug: members 7,9 unpaid (Ramesh, Deepak). Sep: member 5 unpaid (Vikram). Oct: only 2 paid so far.
    let paid = true;
    if (ym === '2026-08' && (mi === 6 || mi === 8)) paid = false;
    if (ym === '2026-09' && mi === 4) paid = false;
    if (ym === '2026-10' && mi > 1) paid = false;
    collections.push({ id: uid(), groupId: gid, memberId: m.id, month: ym, paid, paidDate: paid ? paidDateFor(ym) : null });
  }));
  const payouts = members.map((m, i) => ({
    id: 'p' + (i+1), groupId: gid, memberId: m.id, month: months[i], amount: 48000 + (i % 3) * 1000,
    order: i + 1, done: i < 2, doneDate: i === 0 ? '2026-08-31' : (i === 1 ? '2026-09-30' : null)
  }));
  state.groups = [g]; state.members = members; state.collections = collections; state.payouts = payouts;
  state.activeGroupId = gid; state.activeMonth = '2026-10';
  saveAll();
}

/* ================= toast / modal / confirm ================= */
function toast(msg){
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  $('#toast-root').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2400);
}
function openModal(title, bodyHTML, onSubmit, submitLabel){
  const root = $('#modal-root');
  root.innerHTML =
    '<div class="modal-ov" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    '<div class="modal"><div class="modal-h"><h2>' + esc(title) + '</h2>' +
    '<button class="iconbtn" data-close type="button" aria-label="Close">' + icon('x') + '</button></div>' +
    '<div class="modal-b"><form id="mform" novalidate>' + bodyHTML +
    '<div class="modal-f"><button type="button" class="btn btn-ghost" data-close>Cancel</button>' +
    '<button type="submit" class="btn btn-primary">' + esc(submitLabel || 'Save') + '</button></div></form></div></div></div>';
  const ov = root.firstElementChild;
  const close = () => { ov.classList.remove('show'); setTimeout(() => { root.innerHTML = ''; }, 200); };
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', function esc2(e){ if (e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc2); } });
  $('#mform').addEventListener('submit', e => { e.preventDefault(); if (onSubmit(new FormData(e.target), close)) close(); });
  requestAnimationFrame(() => ov.classList.add('show'));
  const first = ov.querySelector('input,select,textarea'); if (first) setTimeout(() => first.focus(), 220);
}
function fieldHTML(name, label, inputHTML, hint){
  return '<div class="fld" data-fld="' + esc(name) + '"><label for="f_' + esc(name) + '">' + esc(label) + '</label>' +
    inputHTML.replace('<input', '<input id="f_' + esc(name) + '"').replace('<select', '<select id="f_' + esc(name) + '"') +
    (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') +
    '<div class="err" role="alert"></div></div>';
}
function setErr(name, msg){
  const f = document.querySelector('[data-fld="' + name + '"]');
  if (!f) return;
  f.classList.toggle('invalid', !!msg);
  f.querySelector('.err').textContent = msg || '';
}
function confirmDlg(title, msg, okLabel){
  return new Promise(resolve => {
    openModal(title, '<p style="margin:0 0 6px;color:var(--muted)">' + esc(msg) + '</p>',
      () => { resolve(true); return true; }, okLabel || 'Delete');
  });
}

/* ================= render shell ================= */
function renderTabs(){
  $$('#tabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === state.tab ? 'true' : 'false'));
}
function renderGroupSelect(){
  const sel = $('#group-select');
  sel.innerHTML = state.groups.map(g => '<option value="' + g.id + '"' + (g.id === state.activeGroupId ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('') ||
    '<option value="">No groups yet</option>';
}
function renderGroupStrip(){
  const g = activeGroup();
  $('#groupstrip').innerHTML = g
    ? '<div class="gs-item"><span class="gs-label">Monthly</span><span class="gs-val num">' + fmtINR(g.monthly) + '</span></div>' +
      '<div class="gs-item"><span class="gs-label">Cycle</span><span class="gs-val">' + ymLabel(g.startMonth) + ' → ' + ymLabel(monthsOf(g)[g.rounds-1]) + '</span></div>' +
      '<div class="gs-item"><span class="gs-label">Rounds</span><span class="gs-val num">' + g.rounds + '</span></div>' +
      '<div class="gs-item"><span class="gs-label">Members</span><span class="gs-val num">' + groupMembers(g.id).length + '</span></div>'
    : '<div class="gs-item"><span class="gs-val">Create a group to begin</span></div>';
}

/* ================= views ================= */
function kpi(label, value, sub, dark){
  return '<div class="kpi' + (dark ? ' dark' : '') + '"><div class="kpi-label">' + esc(label) + '</div>' +
    '<div class="kpi-value">' + value + '</div>' + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
}

function renderDashboard(){
  const g = activeGroup();
  if (!g){ return noGroupHTML('dashboard'); }
  const s = groupStats(g);
  const dm = dueMonths(g);
  let html = '<div class="page-head"><div><h1>Dashboard</h1><p>' + esc(g.name) + ' · ' + fmtINR(g.monthly) + ' per month · ' + g.rounds + ' rounds</p></div>' +
    '<button class="btn btn-primary" data-act="add-member">' + icon('plus') + 'Add member</button></div>';
  html += '<div class="kpis">';
  html += kpi('Collected so far', '<span class="num">' + fmtINR(s.collected) + '</span>', '<span class="num">' + s.pct + '%</span> of ' + fmtINR(s.expected) + ' due', true);
  if (s.next){
    html += kpi('Next payout', esc(memberName(s.next.memberId)), ymLabel(s.next.month) + ' · <span class="num">' + fmtINR(s.next.amount) + '</span>');
  } else {
    html += kpi('Next payout', 'All done', 'Every round has been paid out');
  }
  html += kpi('Total in rotation', '<span class="num">' + fmtINR(s.totalRotation) + '</span>', g.rounds + ' rounds × ' + s.members + ' members');
  html += kpi('Defaulters', '<span class="num">' + s.defaulterCount + '</span>', s.defaulterCount ? '<span class="num">' + fmtINR(s.totalOwed) + '</span> overdue' : 'Everyone is paid up');
  html += '</div>';
  html += '<div class="two-col"><div class="section"><div class="card"><h2 style="margin-top:0">Collection by month</h2><div class="tbl-wrap" style="box-shadow:none;border:0"><table class="tbl" style="min-width:0"><thead><tr><th>Month</th><th class="num">Collected</th><th class="num">Expected</th><th style="width:34%">Progress</th></tr></thead><tbody>';
  dm.forEach(ym => {
    const ms = monthSummary(g, ym);
    html += '<tr><td><strong>' + ymLabel(ym) + '</strong>' + (ym === currentYM() ? ' <span class="pill gold">current</span>' : '') + '</td>' +
      '<td class="num">' + fmtINR(ms.collected) + '</td><td class="num">' + fmtINR(ms.expected) + '</td>' +
      '<td><div class="bar" role="img" aria-label="' + ms.pct + '% collected"><i style="width:' + ms.pct + '%"></i></div></td></tr>';
  });
  html += '</tbody></table></div></div></div>';
  html += '<div class="section"><div class="card"><h2 style="margin-top:0">Payout rotation</h2><ul class="tl">';
  groupPayouts(g.id).forEach(p => {
    html += '<li class="' + (p.done ? 'done' : '') + '"><span class="dot"></span><div><strong>' + esc(memberName(p.memberId)) + '</strong> <span class="tl-m">· ' + ymLabel(p.month) + ' · <span class="num">' + fmtINR(p.amount) + '</span></span>' +
      (p.done ? ' <span class="pill ok">paid ' + fmtDate(p.doneDate) + '</span>' : ' <span class="pill warn">upcoming</span>') + '</div></li>';
  });
  html += '</ul></div></div></div>';
  const defs = defaulterInfo(g).slice(0, 3);
  if (defs.length){
    html += '<div class="section"><div class="card"><h2 style="margin-top:0">Top defaulters</h2><div class="tbl-wrap" style="box-shadow:none;border:0"><table class="tbl" style="min-width:0"><thead><tr><th>Member</th><th>Unpaid months</th><th class="num">Owes</th></tr></thead><tbody>';
    defs.forEach(d => { html += '<tr><td><strong>' + esc(d.name) + '</strong></td><td><div class="chips">' + d.months.map(ym => '<span class="chip">' + ymShort(ym) + '</span>').join('') + '</div></td><td class="num"><strong>' + fmtINR(d.owed) + '</strong></td></tr>'; });
    html += '</tbody></table></div></div></div>';
  }
  return html;
}

function noGroupHTML(){
  return '<div class="empty">' + icon('box') + '<h3>No groups yet</h3><p>Create your first beesi group to start tracking collections and payouts.</p>' +
    '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
    '<button class="btn btn-primary" data-act="add-group">' + icon('plus') + 'Create group</button>' +
    '<button class="btn btn-ghost" data-act="load-sample">Explore with sample data</button></div></div>';
}

/* ---- collections ---- */
function renderCollections(){
  const g = activeGroup();
  if (!g) return noGroupHTML();
  ensureCollections(g);
  const ms = monthsOf(g);
  if (!ms.includes(state.activeMonth)) state.activeMonth = currentYM() <= ms[ms.length-1] ? currentYM() : ms[0];
  const ym = state.activeMonth;
  const sum = monthSummary(g, ym);
  const mems = groupMembers(g.id);
  let html = '<div class="page-head"><div><h1>Collections</h1><p>Tap a cell to mark paid or unpaid. Payment date is recorded automatically.</p></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-act="month-all" data-v="1">' + icon('check') + 'Mark all paid</button>' +
    '<button class="btn btn-ghost btn-sm" data-act="month-all" data-v="0">' + icon('x') + 'Clear month</button></div></div>';
  html += '<div class="monthbar" role="group" aria-label="Months">';
  ms.forEach(m => {
    const s2 = monthSummary(g, m);
    html += '<button class="monthpill' + (m <= currentYM() && s2.paidN < s2.total ? ' past-due' : '') + '" data-act="month" data-ym="' + m + '" aria-pressed="' + (m === ym) + '">' +
      ymShort(m) + ' <span class="num">' + s2.paidN + '/' + s2.total + '</span></button>';
  });
  html += '</div>';
  html += '<div class="sumstrip"><div class="sum-item"><div class="k">Month</div><div class="v">' + ymLabel(ym) + '</div></div>' +
    '<div class="sum-item"><div class="k">Collected</div><div class="v num">' + fmtINR(sum.collected) + '</div></div>' +
    '<div class="sum-item"><div class="k">Expected</div><div class="v num">' + fmtINR(sum.expected) + '</div></div>' +
    '<div class="sum-item" style="flex:1;min-width:200px"><div class="k">' + sum.pct + '% collected</div><div class="bar"><i style="width:' + sum.pct + '%"></i></div></div></div>';
  if (!mems.length) return html + '<div class="empty">' + icon('users') + '<h3>No members</h3><p>Add members to start collecting.</p><button class="btn btn-primary" data-act="add-member">' + icon('plus') + 'Add member</button></div>';
  html += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="sticky-col">Member</th><th class="num">Phone</th><th>Paid / Unpaid</th><th>Date</th></tr></thead><tbody>';
  mems.forEach(m => {
    const r = getRecord(g.id, m.id, ym);
    html += '<tr><td class="sticky-col">' + esc(m.name) + '</td><td class="num">' + esc(m.phone) + '</td><td>' +
      '<button class="cellbtn ' + (r && r.paid ? 'paid' : 'unpaid') + '" data-act="toggle" data-id="' + (r ? r.id : '') + '" aria-pressed="' + (r && r.paid) + '">' +
      (r && r.paid ? icon('check') + '<span>Paid</span>' : '<span style="font-size:18px">—</span><span>Unpaid</span>') + '</button></td>' +
      '<td class="num dt">' + (r && r.paidDate ? fmtDate(r.paidDate) : '—') + '</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

/* ---- payouts ---- */
function renderPayouts(){
  const g = activeGroup();
  if (!g) return noGroupHTML();
  const list = groupPayouts(g.id);
  const mems = groupMembers(g.id);
  const inRotation = new Set(list.map(p => p.memberId));
  let html = '<div class="page-head"><div><h1>Payout rotation</h1><p>Who receives the pot, in which month. Reorder with the arrows, mark done when the payout is handed over.</p></div>' +
    '<button class="btn btn-primary" data-act="add-payout">' + icon('plus') + 'Add payout</button></div>';
  if (!list.length) return html + '<div class="empty">' + icon('cycle') + '<h3>No payouts scheduled</h3><p>Set the rotation order — typically one member per month.</p><button class="btn btn-primary" data-act="add-payout">' + icon('plus') + 'Add payout</button></div>';
  list.forEach((p, i) => {
    html += '<div class="porow' + (p.done ? ' done' : '') + '">' +
      '<div class="po-order">' + p.order + '</div>' +
      '<div class="po-name">' + esc(memberName(p.memberId)) + '<small>' + (p.done ? 'Paid ' + fmtDate(p.doneDate) : 'Scheduled') + '</small></div>' +
      '<div class="po-ctl"><label class="sr" for="pm_' + p.id + '" style="position:absolute;left:-9999px">Payout month</label>' +
      '<select id="pm_' + p.id + '" data-payout-month="' + p.id + '" aria-label="Payout month for ' + esc(memberName(p.memberId)) + '">' +
      monthsOf(g).map(m => '<option value="' + m + '"' + (m === p.month ? ' selected' : '') + '>' + ymLabel(m) + '</option>').join('') + '</select></div>' +
      '<div class="po-ctl"><span class="num" style="font-weight:700">₹</span><input class="po-amt num" type="number" min="0" step="100" value="' + p.amount + '" data-payout-amt="' + p.id + '" aria-label="Payout amount"></div>' +
      '<div class="po-ctl">' +
      '<button class="donebtn' + (p.done ? ' on' : '') + '" data-act="payout-done" data-id="' + p.id + '" aria-pressed="' + p.done + '">' + icon(p.done ? 'check' : 'clock') + (p.done ? 'Paid' : 'Mark paid') + '</button>' +
      '<button class="iconbtn" data-act="payout-up" data-id="' + p.id + '" aria-label="Move up" ' + (i === 0 ? 'disabled' : '') + '>' + icon('up') + '</button>' +
      '<button class="iconbtn" data-act="payout-down" data-id="' + p.id + '" aria-label="Move down" ' + (i === list.length-1 ? 'disabled' : '') + '>' + icon('down') + '</button>' +
      '<button class="iconbtn danger" data-act="payout-del" data-id="' + p.id + '" aria-label="Remove payout">' + icon('trash') + '</button>' +
      '</div></div>';
  });
  const avail = mems.filter(m => !inRotation.has(m.id));
  if (avail.length) html += '<p style="color:var(--muted);font-size:14px">' + icon('alert') + ' Not yet in rotation: ' + avail.map(m => esc(m.name)).join(', ') + '</p>';
  return html;
}

/* ---- members ---- */
function renderMembers(){
  const g = activeGroup();
  if (!g) return noGroupHTML();
  const mems = groupMembers(g.id);
  const dm = dueMonths(g);
  let html = '<div class="page-head"><div><h1>Members</h1><p>' + mems.length + ' members in ' + esc(g.name) + '. Phone numbers must be 10 digits.</p></div>' +
    '<button class="btn btn-primary" data-act="add-member">' + icon('plus') + 'Add member</button></div>';
  if (!mems.length) return html + '<div class="empty">' + icon('users') + '<h3>No members yet</h3><p>Add the first member of this beesi.</p><button class="btn btn-primary" data-act="add-member">' + icon('plus') + 'Add member</button></div>';
  html += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Name</th><th>Phone</th><th class="num">Paid (due months)</th><th></th></tr></thead><tbody>';
  mems.forEach((m, i) => {
    const paidN = dm.filter(ym => { const r = getRecord(g.id, m.id, ym); return r && r.paid; }).length;
    html += '<tr><td class="num">' + (i+1) + '</td><td><strong>' + esc(m.name) + '</strong></td><td class="num">' + esc(m.phone) + '</td>' +
      '<td class="num">' + paidN + ' / ' + dm.length + '</td>' +
      '<td style="white-space:nowrap"><button class="iconbtn" data-act="member-edit" data-id="' + m.id + '" aria-label="Edit ' + esc(m.name) + '">' + icon('edit') + '</button> ' +
      '<button class="iconbtn danger" data-act="member-del" data-id="' + m.id + '" aria-label="Remove ' + esc(m.name) + '">' + icon('trash') + '</button></td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

/* ---- groups ---- */
function renderGroups(){
  let html = '<div class="page-head"><div><h1>Groups</h1><p>Each beesi group runs its own monthly cycle, members and payout rotation.</p></div>' +
    '<button class="btn btn-primary" data-act="add-group">' + icon('plus') + 'New group</button></div>';
  if (!state.groups.length) return html + noGroupHTML();
  html += '<div class="gcards">';
  state.groups.forEach(g => {
    const s = groupStats(g);
    html += '<div class="gcard"><h3>' + esc(g.name) + '</h3><div class="meta">' + fmtINR(g.monthly) + ' / month · ' + ymLabel(g.startMonth) + ' → ' + ymLabel(monthsOf(g)[g.rounds-1]) + ' · ' + g.rounds + ' rounds</div>' +
      '<div class="row"><span>Members</span><b class="num">' + s.members + '</b></div>' +
      '<div class="row"><span>Collected</span><b class="num">' + s.pct + '%</b></div>' +
      '<div class="row"><span>In rotation</span><b class="num">' + fmtINR(s.totalRotation) + '</b></div>' +
      '<div class="row"><span>Overdue</span><b class="num">' + fmtINR(s.totalOwed) + '</b></div>' +
      '<div class="actions"><button class="btn btn-gold btn-sm" data-act="group-open" data-id="' + g.id + '">Open</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="group-edit" data-id="' + g.id + '">Edit</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="group-del" data-id="' + g.id + '" style="color:var(--bad)">Delete</button></div></div>';
  });
  html += '</div>';
  return html;
}

/* ---- defaulters ---- */
function renderDefaulters(){
  const g = activeGroup();
  if (!g) return noGroupHTML();
  const defs = defaulterInfo(g);
  let html = '<div class="page-head"><div><h1>Defaulters</h1><p>Members with unpaid dues in months up to ' + ymLabel(currentYM()) + '. Amounts owed at ' + fmtINR(g.monthly) + ' per month.</p></div></div>';
  html += '<div class="sumstrip"><div class="sum-item"><div class="k">Defaulters</div><div class="v num">' + defs.length + '</div></div>' +
    '<div class="sum-item"><div class="k">Total overdue</div><div class="v num">' + fmtINR(defs.reduce((s,d) => s + d.owed, 0)) + '</div></div></div>';
  if (!defs.length) return html + '<div class="empty">' + icon('check') + '<h3>All clear</h3><p>Every member is paid up for all due months. Shabaash!</p></div>';
  html += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Member</th><th>Phone</th><th>Unpaid months</th><th class="num">Owes</th><th></th></tr></thead><tbody>';
  defs.forEach(d => {
    html += '<tr><td><strong>' + esc(d.name) + '</strong></td><td class="num">' + esc(d.phone) + '</td>' +
      '<td><div class="chips">' + d.months.map(ym => '<span class="chip">' + ymShort(ym) + '</span>').join('') + '</div></td>' +
      '<td class="num"><strong>' + fmtINR(d.owed) + '</strong></td>' +
      '<td><button class="btn btn-outline btn-sm" data-act="goto-collect" data-ym="' + d.months[0] + '">Collect ' + icon('arrow') + '</button></td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

/* ---- settings ---- */
function renderSettings(){
  let html = '<div class="page-head"><div><h1>Settings</h1><p>Manage your Beesi data. Everything is stored in this browser — nothing leaves your device.</p></div></div>';
  html += '<div class="section"><div class="card"><h2>Your data</h2>' +
    '<p style="color:var(--muted);margin:0 0 16px">Sample data loads a ready-made beesi group — 10 members, three months of collections and a payout rotation — so you can explore before entering your own.</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<button class="btn btn-outline" data-act="load-sample">' + icon('box') + 'Load sample data</button>' +
    '<button class="btn btn-danger" data-act="clear-all">' + icon('trash') + 'Clear all data</button></div>' +
    '<p style="color:var(--muted);font-size:13px;margin:14px 0 0">Clearing removes every group, member, collection and payout. This cannot be undone.</p>' +
    '</div></div>';
  return html;
}

function render(){
  renderTabs(); renderGroupSelect(); renderGroupStrip();
  const v = $('#view');
  const fn = { dashboard: renderDashboard, collections: renderCollections, payouts: renderPayouts, members: renderMembers, groups: renderGroups, defaulters: renderDefaulters, settings: renderSettings }[state.tab] || renderDashboard;
  v.innerHTML = fn();
  saveAll();
}

/* ================= forms ================= */
function groupForm(existing){
  const g = existing || {};
  const body =
    fieldHTML('name', 'Group name', '<input type="text" name="name" maxlength="60" value="' + esc(g.name || '') + '" placeholder="e.g. Sharma Parivar Beesi" required>') +
    fieldHTML('monthly', 'Monthly contribution (₹)', '<input type="number" name="monthly" min="100" step="100" value="' + esc(g.monthly || '') + '" placeholder="5000" required>', 'Whole rupees, minimum ₹100.') +
    fieldHTML('startMonth', 'Start month', '<input type="month" name="startMonth" value="' + esc(g.startMonth || currentYM()) + '" required>') +
    fieldHTML('rounds', 'Total rounds (months)', '<input type="number" name="rounds" min="1" max="36" value="' + esc(g.rounds || '10') + '" required>', 'Usually equals the number of members.');
  openModal(existing ? 'Edit group' : 'New beesi group', body, (fd, close) => {
    let ok = true;
    const name = String(fd.get('name') || '').trim();
    const monthly = +fd.get('monthly'), rounds = +fd.get('rounds'), startMonth = String(fd.get('startMonth') || '');
    setErr('name', name ? '' : 'Give the group a name.'); if (!name) ok = false;
    setErr('monthly', monthly >= 100 ? '' : 'Enter at least ₹100.'); if (!(monthly >= 100)) ok = false;
    setErr('startMonth', /^\d{4}-\d{2}$/.test(startMonth) ? '' : 'Pick a start month.'); if (!/^\d{4}-\d{2}$/.test(startMonth)) ok = false;
    setErr('rounds', rounds >= 1 && rounds <= 36 ? '' : 'Between 1 and 36.'); if (!(rounds >= 1 && rounds <= 36)) ok = false;
    if (!ok) return false;
    if (existing) updateGroup(existing.id, { name, monthly, startMonth, rounds });
    else createGroup({ name, monthly, startMonth, rounds });
    toast(existing ? 'Group updated' : 'Group created'); render(); return true;
  });
}
function memberForm(gid, existing){
  const m = existing || {};
  const body =
    fieldHTML('name', 'Full name', '<input type="text" name="name" maxlength="60" value="' + esc(m.name || '') + '" placeholder="e.g. Ramesh Sharma" required>') +
    fieldHTML('phone', 'Phone (10 digits)', '<input type="tel" name="phone" inputmode="numeric" maxlength="10" value="' + esc(m.phone || '') + '" placeholder="9811045210" required>');
  openModal(existing ? 'Edit member' : 'Add member', body, (fd) => {
    let ok = true;
    const name = String(fd.get('name') || '').trim();
    const phone = String(fd.get('phone') || '').replace(/\s/g, '');
    setErr('name', name ? '' : 'Enter the member’s name.'); if (!name) ok = false;
    setErr('phone', validPhone(phone) ? '' : 'Enter exactly 10 digits.'); if (!validPhone(phone)) ok = false;
    if (!ok) return false;
    if (existing) updateMember(existing.id, { name, phone });
    else addMember(gid, { name, phone });
    toast(existing ? 'Member updated' : 'Member added'); render(); return true;
  });
}
function payoutForm(gid){
  const g = state.groups.find(x => x.id === gid);
  const list = groupPayouts(gid);
  const taken = new Set(list.map(p => p.memberId));
  const avail = groupMembers(gid).filter(m => !taken.has(m.id));
  if (!avail.length){ toast('Every member is already in the rotation'); return; }
  const body =
    fieldHTML('memberId', 'Member', '<select name="memberId">' + avail.map(m => '<option value="' + m.id + '">' + esc(m.name) + '</option>').join('') + '</select>') +
    fieldHTML('month', 'Payout month', '<select name="month">' + monthsOf(g).map(m => '<option value="' + m + '"' + (m === monthsOf(g)[list.length] ? ' selected' : '') + '>' + ymLabel(m) + '</option>').join('') + '</select>') +
    fieldHTML('amount', 'Payout amount (₹)', '<input type="number" name="amount" min="0" step="100" value="' + g.monthly + '" required>', 'The pot handed over that month.');
  openModal('Schedule payout', body, (fd) => {
    const amount = +fd.get('amount');
    setErr('amount', amount >= 0 ? '' : 'Enter 0 or more.'); if (!(amount >= 0)) return false;
    addPayout(gid, { memberId: String(fd.get('memberId')), month: String(fd.get('month')), amount });
    toast('Payout scheduled'); render(); return true;
  });
}

/* ================= events ================= */
function wireEvents(){
  $('#btn-new-group').innerHTML = icon('plus') + '<span>New group</span>';
  $('#btn-new-group').addEventListener('click', () => groupForm(null));
  $('#group-select').addEventListener('change', e => {
    state.activeGroupId = e.target.value || null;
    const g = activeGroup();
    state.activeMonth = g ? (currentYM() >= g.startMonth ? currentYM() : g.startMonth) : currentYM();
    render();
  });
  $$('#tabs .tab').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  $('#view').addEventListener('click', onViewClick);
  $('#view').addEventListener('change', onViewChange);
}
function onViewClick(e){
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  const g = activeGroup();
  if (act === 'add-group') groupForm(null);
  else if (act === 'add-member' && g) memberForm(g.id, null);
  else if (act === 'add-payout' && g) payoutForm(g.id);
  else if (act === 'month' ){ state.activeMonth = el.dataset.ym; render(); }
  else if (act === 'month-all' && g){ markMonthAll(g.id, state.activeMonth, el.dataset.v === '1'); toast(el.dataset.v === '1' ? 'Month marked paid' : 'Month cleared'); render(); }
  else if (act === 'toggle'){ const cur = state.collections.find(c => c.id === id); const r = setPaid(id, !(cur && cur.paid)); if (r) toast(r.paid ? 'Marked paid · ' + fmtDate(r.paidDate) : 'Marked unpaid'); render(); }
  else if (act === 'payout-up'){ movePayout(id, -1); render(); }
  else if (act === 'payout-down'){ movePayout(id, 1); render(); }
  else if (act === 'payout-del'){ confirmDlg('Remove payout', 'Remove ' + memberName((state.payouts.find(p => p.id === id) || {}).memberId) + ' from the rotation?').then(ok => { if (ok){ deletePayout(id); toast('Payout removed'); render(); } }); }
  else if (act === 'payout-done'){
    const p = state.payouts.find(x => x.id === id); if (!p) return;
    if (p.done){ reopenPayout(id); toast('Payout reopened'); render(); }
    else {
      openModal('Mark payout done', fieldHTML('amount', 'Amount handed over (₹)', '<input type="number" name="amount" min="0" step="100" value="' + p.amount + '" required>'),
        fd => { const a = +fd.get('amount'); setErr('amount', a >= 0 ? '' : 'Enter 0 or more.'); if (!(a >= 0)) return false;
          setPayoutDone(id, a); toast('Payout recorded'); render(); return true; }, 'Mark paid');
    }
  }
  else if (act === 'member-edit'){ const m = state.members.find(x => x.id === id); if (m) memberForm(m.groupId, m); }
  else if (act === 'member-del'){ const m = state.members.find(x => x.id === id); if (m) confirmDlg('Remove member', 'Remove ' + m.name + '? Their collection and payout records go too.').then(ok => { if (ok){ deleteMember(id); toast('Member removed'); render(); } }); }
  else if (act === 'group-open'){ state.activeGroupId = id; state.tab = 'dashboard'; render(); }
  else if (act === 'group-edit'){ const gg = state.groups.find(x => x.id === id); if (gg) groupForm(gg); }
  else if (act === 'group-del'){ const gg = state.groups.find(x => x.id === id); if (gg) confirmDlg('Delete group', 'Delete "' + gg.name + '" and ALL its members, collections and payouts? This cannot be undone.').then(ok => { if (ok){ deleteGroup(id); toast('Group deleted'); render(); } }); }
  else if (act === 'goto-collect'){ state.activeMonth = el.dataset.ym; state.tab = 'collections'; render(); }
  else if (act === 'load-sample'){ seed(); localStorage.setItem(NS + 'seeded', '1'); loadAll(); state.tab = 'dashboard'; render(); toast('Sample data loaded'); }
  else if (act === 'clear-all'){
    confirmDlg('Clear all data', 'Delete everything — all groups, members, collections and payouts? This cannot be undone.', 'Clear all data')
      .then(ok => { if (ok){ DB.wipe(); localStorage.removeItem(NS + 'seeded'); loadAll(); state.tab = 'dashboard'; render(); toast('All data cleared — fresh start'); } });
  }
}
function onViewChange(e){
  const t = e.target;
  if (t.dataset.payoutMonth){ updatePayout(t.dataset.payoutMonth, { month: t.value }); toast('Payout month updated'); render(); }
  else if (t.dataset.payoutAmt){ const v = +t.value; if (v >= 0){ updatePayout(t.dataset.payoutAmt, { amount: v }); toast('Amount updated'); } render(); }
}

/* ================= boot ================= */
function boot(){
  // Normal launch never seeds: the app starts empty for real use.
  // Sample data is only loaded via Settings → "Load sample data" or the selftest.
  loadAll();
  wireEvents();
  render();
}

/* ================= selftest ================= */
function banner(pass, total, fail){
  const b = $('#selftest-banner');
  b.hidden = false;
  b.className = fail ? 'fail' : 'pass';
  const txt = fail ? 'SELFTEST FAIL: ' + fail : 'SELFTEST PASS ' + pass + '/' + total;
  b.textContent = txt;
  document.title = txt;
}
function runSelftest(){
  const res = { total: 0, pass: 0, fail: '' };
  const t = (name, cond) => { res.total++; if (cond) res.pass++; else if (!res.fail) res.fail = name; };
  try {
    DB.wipe();
    t('wipe clears namespace', DB.keys().length === 0);
    seed();
    const g = state.groups[0];
    t('seed group', state.groups.length === 1 && g.name === 'Sharma Parivar Beesi');
    t('seed members', state.members.filter(m => m.groupId === g.id).length === 10);
    t('seed collections 2 months mixed', state.collections.filter(c => c.groupId === g.id && (c.month === '2026-08' || c.month === '2026-09')).length === 20);
    // create group + member
    const cm = currentYM();
    const g2 = createGroup({ name: 'Test Beesi', monthly: 2000, startMonth: cm, rounds: 3 });
    t('create group', !!g2 && state.groups.length === 2);
    const m1 = addMember(g2.id, { name: 'Test Member', phone: '9000011111' });
    t('add member', !!m1 && groupMembers(g2.id).length === 1);
    // mark collection paid
    const rec = getRecord(g2.id, m1.id, cm);
    setPaid(rec.id, true);
    const ms = monthSummary(g2, cm);
    t('collection paid math', ms.collected === 2000 && ms.expected === 2000 && ms.pct === 100);
    // payout order
    const p1 = addPayout(g2.id, { memberId: m1.id, month: cm, amount: 9500 });
    t('payout created order 1', !!p1 && p1.order === 1);
    const m2 = addMember(g2.id, { name: 'Second Member', phone: '9000022222' });
    const p2 = addPayout(g2.id, { memberId: m2.id, month: nextYM(cm), amount: 9500 });
    movePayout(p2.id, -1);
    const ord = groupPayouts(g2.id);
    t('payout reorder', ord[0].id === p2.id && ord[1].id === p1.id);
    setPayoutDone(p2.id, 9400);
    const p2r = state.payouts.find(x => x.id === p2.id);
    t('payout done + amount', p2r.done === true && p2r.amount === 9400 && !!p2r.doneDate);
    t('next payout skips done', nextPayout(g2).id === p1.id);
    // defaulter math: g2 rounds start this month; m1 paid, m2 unpaid -> owes exactly monthly
    const defs = defaulterInfo(g2);
    const d2 = defs.find(d => d.memberId === m2.id);
    t('defaulter math', defs.length === 1 && d2 && d2.owed === 2000 && d2.months.length === 1);
    // persistence: re-read raw from localStorage
    const rawGroups = JSON.parse(localStorage.getItem(NS + 'groups') || '[]');
    const rawCols = JSON.parse(localStorage.getItem(NS + 'collections') || '[]');
    t('localStorage persist', rawGroups.length === 2 && rawCols.some(c => c.memberId === m1.id && c.paid === true));
    // re-render proves render path
    render();
    t('re-render ok', document.getElementById('view').children.length > 0 && document.getElementById('group-select').options.length === 2);
  } catch (err) {
    if (!res.fail) res.fail = 'exception: ' + (err && err.message);
  }
  // leave the app EMPTY after selftest: wipe everything, drop the seeded flag, no re-seed.
  // render() paints the empty app but saveAll() recreates empty keys, so wipe again after.
  try { DB.wipe(); localStorage.removeItem(NS + 'seeded'); loadAll(); render(); DB.wipe(); localStorage.removeItem(NS + 'seeded'); } catch (e) {}
  banner(res.pass, res.total, res.fail);
  return res;
}

if (new URLSearchParams(location.search).get('selftest') === '1'){
  document.addEventListener('DOMContentLoaded', () => { loadAll(); wireEvents(); runSelftest(); });
} else {
  document.addEventListener('DOMContentLoaded', boot);
}
})();
