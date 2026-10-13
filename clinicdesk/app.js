'use strict';
/* ============================================================
   CLINICDESK — patient records for small clinics
   Vanilla JS. Data in localStorage under cd_v1_* keys.
   ============================================================ */
const NS = 'cd_v1_';
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad2 = n => String(n).padStart(2, '0');
const uid  = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const r2   = n => Math.round((Number(n) || 0) * 100) / 100;
const esc  = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr  = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = n => '₹' + inr.format(Number(n) || 0);

function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function addDays(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const p = iso.split('-').map(Number);
  if (p.length !== 3 || !MONTHS[p[1] - 1]) return esc(iso);
  return pad2(p[2]) + '-' + MONTHS[p[1] - 1] + '-' + p[0];
}
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ---------- storage ---------- */
const store = {
  get(k, f) { try { const r = localStorage.getItem(NS + k); return r == null ? f : JSON.parse(r); } catch (e) { return f; } },
  set(k, v) { localStorage.setItem(NS + k, JSON.stringify(v)); },
  keys() { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(NS) === 0) out.push(k); } return out; },
  wipe() { store.keys().forEach(k => localStorage.removeItem(k)); }
};

let S = null;
let view = 'dashboard';
let activePatient = null;       // patient id when in detail
let patientFilter = { q: '' };
let visitFilter = { q: '', month: 'all' };

function loadState() {
  S = {
    patients: store.get('patients', []),
    visits:   store.get('visits', []),
    clinic:   store.get('clinic', {})
  };
}
function save(k) { store.set(k, S[k]); }

/* ---------- seed data (first launch only, dates relative to today) ---------- */
function seed() {
  const T = todayStr();
  const P = [
    ['Ramesh Gupta',   54, 'Male',   '9811022334', 'H.No 42, Gali 3, Laxmi Nagar, Delhi'],
    ['Sunita Devi',    47, 'Female', '9958012345', 'RZ-18, Palam Colony, New Delhi'],
    ['Amit Sharma',    31, 'Male',   '9897011223', 'C-56, Sector 12, Noida'],
    ['Priya Nair',     28, 'Female', '9745018890', 'Flat 7B, Green Park, New Delhi'],
    ['Harpreet Singh', 63, 'Male',   '9815544332', 'B-11, Model Town, Delhi'],
    ['Kavita Rao',     36, 'Female', '9632098877', 'Plot 9, Mayur Vihar Phase 1, Delhi']
  ];
  const patients = P.map(p => ({ id: uid(), name: p[0], age: p[1], gender: p[2], phone: p[3], address: p[4], createdAt: addDays(T, -60) }));
  const byName = n => patients.find(p => p.name === n).id;
  const V = [
    // [patient, daysAgo, symptoms, diagnosis, rx[[med,dose,days]], fee, nextVisitOffset|null]
    ['Ramesh Gupta', 40, 'Increased thirst, frequent urination', 'Type-2 Diabetes Mellitus',
      [['Metformin 500mg', '1-0-1 after food', 30], ['Glycomet-GP 1mg', '1-0-0 before breakfast', 30]], 400, null],
    ['Ramesh Gupta', 5, 'Follow-up: fasting sugar 142 mg/dL', 'Type-2 Diabetes — under control',
      [['Metformin 500mg', '1-0-1 after food', 30]], 500, 25],
    ['Sunita Devi', 2, 'Headache, BP 150/95 mmHg', 'Stage-1 Hypertension',
      [['Amlodipine 5mg', '1-0-0 morning', 30], ['Telma 40mg', '0-0-1 night', 30]], 600, 0],
    ['Amit Sharma', 1, 'Fever 101°F, body ache, dry cough (3 days)', 'Viral fever',
      [['Paracetamol 650mg', '1-1-1 after food', 5], ['Azithral 500mg', '1-0-0', 3]], 300, -3],
    ['Priya Nair', 10, 'One-sided headache with nausea, photophobia', 'Migraine without aura',
      [['Flunarizine 10mg', '0-0-1 night', 15], ['Naproxen 500mg', 'SOS for pain', 10]], 450, 4],
    ['Harpreet Singh', 45, 'Knee pain, morning stiffness > 30 min', 'Osteoarthritis — bilateral knees',
      [['Glucosamine 750mg', '1-0-1', 30], ['Diclofenac gel', 'Apply twice daily', 15]], 500, null],
    ['Kavita Rao', 3, 'Burning sensation after meals, bloating', 'Gastritis',
      [['Pantoprazole 40mg', '1-0-0 before breakfast', 14], ['Digene syrup', '2 tsp after meals', 10]], 350, 0]
  ];
  const visits = V.map(v => ({
    id: uid(),
    patientId: byName(v[0]),
    date: addDays(T, v[1]),
    symptoms: v[2],
    diagnosis: v[3],
    rx: v[4].map(r => ({ med: r[0], dose: r[1], days: r[2] })),
    fee: v[5],
    nextVisit: v[6] == null ? null : addDays(T, v[1] + v[6]),
    followupDone: false
  }));
  S.patients = patients;
  S.visits = visits;
  S.clinic = {
    name: 'CityCare Clinic',
    doctor: 'Dr. Anjali Mehta, MBBS',
    address: 'G-7, Vikas Marg, Laxmi Nagar, Delhi 110092',
    phone: '011-4222 8899',
    timings: 'Mon–Sat · 10:00 AM – 2:00 PM, 6:00 PM – 9:00 PM'
  };
  ['patients', 'visits', 'clinic'].forEach(save);
  store.set('seeded', true);
}

/* ---------- patients ---------- */
const patient = id => S.patients.find(p => p.id === id);
const visitsOf = pid => S.visits.filter(v => v.patientId === pid).sort((a, b) => b.date.localeCompare(a.date));

function validatePatient(f) {
  const errs = [];
  if (!f.name || !f.name.trim()) errs.push('Patient name is required.');
  if (!(f.age >= 0 && f.age <= 120)) errs.push('Age must be between 0 and 120.');
  if (!['Male', 'Female', 'Other'].includes(f.gender)) errs.push('Select a gender.');
  if (!/^[6-9]\d{9}$/.test(String(f.phone || '').replace(/\s/g, ''))) errs.push('Phone must be a valid 10-digit Indian mobile number.');
  return errs;
}
function addPatient(f) {
  const errs = validatePatient(f);
  if (errs.length) return { ok: false, errs };
  const p = { id: uid(), name: f.name.trim(), age: Number(f.age), gender: f.gender,
    phone: String(f.phone).replace(/\s/g, ''), address: String(f.address || '').trim(), createdAt: todayStr() };
  S.patients.push(p); save('patients');
  return { ok: true, patient: p };
}
function updatePatient(id, f) {
  const p = patient(id); if (!p) return { ok: false, errs: ['Patient not found.'] };
  const errs = validatePatient(f);
  if (errs.length) return { ok: false, errs };
  p.name = f.name.trim(); p.age = Number(f.age); p.gender = f.gender;
  p.phone = String(f.phone).replace(/\s/g, ''); p.address = String(f.address || '').trim();
  save('patients');
  return { ok: true, patient: p };
}
function deletePatient(id) {
  S.patients = S.patients.filter(p => p.id !== id);
  S.visits = S.visits.filter(v => v.patientId !== id);
  ['patients', 'visits'].forEach(save);
}

/* ---------- visits ---------- */
function validateVisit(f) {
  const errs = [];
  if (!f.date) errs.push('Visit date is required.');
  if (!f.symptoms || !f.symptoms.trim()) errs.push('Symptoms are required.');
  if (!f.diagnosis || !f.diagnosis.trim()) errs.push('Diagnosis is required.');
  if (!(f.fee >= 0)) errs.push('Fee cannot be negative.');
  (f.rx || []).forEach((r, i) => {
    if ((r.med || '').trim() && !(r.days > 0)) errs.push('Row ' + (i + 1) + ': days must be positive.');
  });
  return errs;
}
function addVisit(pid, f) {
  if (!patient(pid)) return { ok: false, errs: ['Patient not found.'] };
  const errs = validateVisit(f);
  if (errs.length) return { ok: false, errs };
  const v = {
    id: uid(), patientId: pid, date: f.date,
    symptoms: f.symptoms.trim(), diagnosis: f.diagnosis.trim(),
    rx: (f.rx || []).filter(r => (r.med || '').trim()).map(r => ({ med: r.med.trim(), dose: String(r.dose || '').trim(), days: Number(r.days) })),
    fee: r2(f.fee), nextVisit: f.nextVisit || null, followupDone: false
  };
  S.visits.push(v); save('visits');
  return { ok: true, visit: v };
}
function deleteVisit(id) {
  S.visits = S.visits.filter(v => v.id !== id); save('visits');
}
function markFollowupDone(visitId) {
  const v = S.visits.find(x => x.id === visitId);
  if (v) { v.followupDone = true; save('visits'); }
}

/* ---------- follow-ups & dashboard ---------- */
function followups() {
  const T = todayStr();
  return S.visits
    .filter(v => v.nextVisit && !v.followupDone)
    .map(v => Object.assign({}, v, { patient: patient(v.patientId) }))
    .filter(v => v.patient)
    .sort((a, b) => a.nextVisit.localeCompare(b.nextVisit));
}
function fuBucket(v) {
  const T = todayStr();
  if (v.nextVisit < T) return 'overdue';
  if (v.nextVisit === T) return 'today';
  return 'upcoming';
}
function monthKey(iso) { return iso.slice(0, 7); }
function dashboardStats() {
  const mk = monthKey(todayStr());
  const monthVisits = S.visits.filter(v => monthKey(v.date) === mk);
  const fus = followups();
  return {
    totalPatients: S.patients.length,
    visitsThisMonth: monthVisits.length,
    revenueThisMonth: r2(monthVisits.reduce((a, v) => a + v.fee, 0)),
    followupsDue: fus.filter(v => fuBucket(v) !== 'upcoming').length,
    followupsOverdue: fus.filter(v => fuBucket(v) === 'overdue').length
  };
}

/* ============================================================
   RENDERING
   ============================================================ */
const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4L8 20l-5 1 1-5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M15 6l-6 6 6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 12l5 5L20 6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>'
};

function toast(msg, type) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 200ms'; setTimeout(() => el.remove(), 220); }, 2600);
}
function openModal(html, wide) {
  $('#modal-root').innerHTML =
    '<div class="modal-overlay" data-action="overlay-close"><div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
}
function closeModal() { $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function openConfirm(msg, label, fn) {
  window._confirmFn = fn;
  openModal(
    '<div class="modal-head"><h3>Please confirm</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">' + ICONS.x + '</button></div>' +
    '<p style="margin:0 0 20px;color:var(--ink-soft)">' + esc(msg) + '</p>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end">' +
    '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
    '<button class="btn btn-danger" data-action="confirm-yes">' + esc(label || 'Yes') + '</button></div>'
  );
}

/* ---------- shared bits ---------- */
function fuPill(v) {
  const b = fuBucket(v);
  if (b === 'overdue') return '<span class="pill red">Overdue · ' + fmtDate(v.nextVisit) + '</span>';
  if (b === 'today') return '<span class="pill amber">Due today</span>';
  return '<span class="pill teal">' + fmtDate(v.nextVisit) + '</span>';
}
function fuRow(v, showPatient) {
  const p = v.patient || patient(v.patientId);
  return '<div class="fu-row"><div><div class="fu-name">' + esc(showPatient && p ? p.name + ' — ' : '') + esc(v.diagnosis) + '</div>' +
    '<div class="fu-meta">' + (showPatient && p ? esc(p.phone) + ' · ' : '') + 'Visit ' + fmtDate(v.date) + ' · ' + fuPill(v) + '</div></div>' +
    '<div class="fu-actions">' +
    (showPatient && p ? '<button class="btn btn-ghost btn-sm" data-action="open-patient" data-id="' + p.id + '">Record</button>' : '') +
    '<button class="btn btn-primary btn-sm" data-action="fu-done" data-id="' + v.id + '">' + ICONS.check + ' Done</button></div></div>';
}
function visitCard(v, showPatient) {
  const p = showPatient ? patient(v.patientId) : null;
  const rx = v.rx.length
    ? '<div class="v-label">Prescription</div><table class="rx-table"><thead><tr><th>Medicine</th><th>Dosage</th><th>Days</th></tr></thead><tbody>' +
      v.rx.map(r => '<tr><td><b>' + esc(r.med) + '</b></td><td>' + esc(r.dose) + '</td><td class="num">' + r.days + '</td></tr>').join('') +
      '</tbody></table>' : '';
  return '<div class="visit"><div class="visit-head"><span class="visit-date">' + fmtDate(v.date) + '</span>' +
    '<span class="visit-fee num">' + money(v.fee) + '</span></div>' +
    (p ? '<p style="margin:4px 0 0"><b>' + esc(p.name) + '</b> <span style="color:var(--ink-soft)">· ' + esc(p.phone) + '</span></p>' : '') +
    '<p><b>Symptoms:</b> ' + esc(v.symptoms) + '</p>' +
    '<p><b>Diagnosis:</b> ' + esc(v.diagnosis) + '</p>' + rx +
    (v.nextVisit && !v.followupDone ? '<div style="margin-top:10px">' + fuPill(v) + ' <span style="font-size:13px;color:var(--ink-soft)">follow-up</span></div>' : '') +
    '</div>';
}

/* ---------- main render ---------- */
function render() {
  $$('.tab').forEach(t => {
    const on = t.dataset.view === view;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const el = $('#view');
  if (view === 'dashboard') el.innerHTML = viewDashboard();
  else if (view === 'patients') el.innerHTML = activePatient ? viewPatientDetail() : viewPatients();
  else if (view === 'visits') { el.innerHTML = viewVisits(); renderVisitList(); }
  else if (view === 'followups') el.innerHTML = viewFollowups();
  else if (view === 'settings') el.innerHTML = viewSettings();
  if (view === 'patients' && !activePatient) renderPatientGrid();
}

/* ----- DASHBOARD ----- */
function viewDashboard() {
  const st = dashboardStats();
  const fus = followups().filter(v => fuBucket(v) !== 'upcoming');
  const fuList = fus.length
    ? fus.map(v => fuRow(v, true)).join('')
    : '<div class="empty-note">' + ICONS.clock + '<br/>No follow-ups due. The day is clear.</div>';
  const recent = S.visits.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentList = recent.length
    ? '<div class="timeline">' + recent.map(v => visitCard(v, true)).join('') + '</div>'
    : '<div class="empty-note">No visits recorded yet.</div>';
  const stat = (label, val, note, cls) =>
    '<div class="stat' + (cls ? ' ' + cls : '') + '"><p class="s-label">' + label + '</p><p class="s-value num">' + val + '</p><p class="s-note">' + note + '</p></div>';
  /* ring cue: overdue share of due follow-ups (presentational only) */
  const fuCls = st.followupsOverdue ? 'bad' : (st.followupsDue ? 'warn' : '');
  const fuPct = st.followupsDue ? Math.round(st.followupsOverdue / st.followupsDue * 100) : 0;
  const fuRingStat = '<div class="stat has-ring' + (fuCls ? ' ' + fuCls : '') + '"><p class="s-label">Follow-ups due</p>' +
    '<div class="stat-main"><p class="s-value num">' + st.followupsDue + '</p>' +
    '<span class="ring" role="img" aria-label="' + st.followupsOverdue + ' of ' + st.followupsDue + ' overdue" style="--p:' + fuPct + '">' +
    '<span class="ring-num">' + fuPct + '%</span></span></div>' +
    '<p class="s-note">' + st.followupsOverdue + ' overdue</p></div>';
  return '<div class="view-head"><div><h2>Good ' + daypart() + ' — here is the clinic today</h2>' +
    '<p class="sub">' + fmtDate(todayStr()) + ' · ' + esc(S.clinic.name || 'Clinic') + '</p></div>' +
    '<button class="btn btn-primary" data-action="open-patient-modal">' + ICONS.plus + ' New Patient</button></div>' +
    '<div class="stat-grid">' +
    stat('Total patients', st.totalPatients, 'registered') +
    stat('Visits this month', st.visitsThisMonth, 'consultations') +
    stat('Revenue this month', money(st.revenueThisMonth), 'consultation fees') +
    fuRingStat +
    '</div>' +
    '<div class="two-col"><div class="card"><h3 class="panel-title">Follow-ups needing attention</h3>' +
    '<p class="panel-sub">Due today or overdue</p>' + fuList + '</div>' +
    '<div class="card"><h3 class="panel-title">Recent visits</h3><p class="panel-sub">Latest consultations</p>' + recentList + '</div></div>';
}
function daypart() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : (h < 17 ? 'afternoon' : 'evening');
}

/* ----- PATIENTS ----- */
function viewPatients() {
  return '<div class="view-head"><div><h2>Patients</h2><p class="sub">' + S.patients.length + ' registered</p></div>' +
    '<button class="btn btn-primary" data-action="open-patient-modal">' + ICONS.plus + ' New Patient</button></div>' +
    '<div class="search-wrap">' + ICONS.search +
    '<input id="patient-search" type="search" placeholder="Search by name or phone…" value="' + esc(patientFilter.q) + '" aria-label="Search patients" autocomplete="off"/></div>' +
    '<div class="patient-grid" id="patient-grid"></div>';
}
function renderPatientGrid() {
  const grid = $('#patient-grid'); if (!grid) return;
  const q = patientFilter.q.trim().toLowerCase();
  const list = S.patients.filter(p => !q || p.name.toLowerCase().indexOf(q) > -1 || p.phone.indexOf(q) > -1)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) { grid.innerHTML = '<div class="card" style="grid-column:1/-1"><div class="empty-note">No patients match. Add one to get started.</div></div>'; return; }
  grid.innerHTML = list.map(p => {
    const vs = visitsOf(p.id);
    const last = vs.length ? fmtDate(vs[0].date) : 'No visits yet';
    return '<button class="patient-card" data-action="open-patient" data-id="' + p.id + '">' +
      '<span class="avatar" aria-hidden="true">' + esc(initials(p.name)) + '</span>' +
      '<span style="flex:1;min-width:0"><span class="pc-name">' + esc(p.name) + '</span>' +
      '<span class="pc-meta" style="display:block">' + p.age + ' yrs · ' + esc(p.gender) + ' · ' + esc(p.phone) + '</span>' +
      '<span class="pc-foot"><span class="pill grey">' + vs.length + ' visit' + (vs.length === 1 ? '' : 's') + '</span>' +
      '<span class="pill teal">Last: ' + last + '</span></span></span></button>';
  }).join('');
}
function viewPatientDetail() {
  const p = patient(activePatient);
  if (!p) { activePatient = null; return viewPatients(); }
  const vs = visitsOf(p.id);
  const fu = followups().filter(v => v.patientId === p.id);
  const timeline = vs.length
    ? '<div class="timeline">' + vs.map(v =>
        '<div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:240px">' + visitCard(v, false) + '</div>' +
        '<button class="icon-btn danger" data-action="delete-visit" data-id="' + v.id + '" aria-label="Delete visit on ' + fmtDate(v.date) + '">' + ICONS.trash + '</button></div>'
      ).join('') + '</div>'
    : '<div class="empty-note">' + ICONS.cal + '<br/>No visits yet. Record the first consultation.</div>';
  return '<button class="back-link" data-action="back-patients">' + ICONS.back + ' All patients</button>' +
    '<div class="card" style="margin-bottom:20px"><div class="detail-head">' +
    '<span class="avatar" aria-hidden="true">' + esc(initials(p.name)) + '</span>' +
    '<div><h2>' + esc(p.name) + '</h2><p class="sub">' + p.age + ' years · ' + esc(p.gender) + '</p></div>' +
    '<div class="detail-actions"><button class="btn btn-primary" data-action="open-visit-modal" data-id="' + p.id + '">' + ICONS.plus + ' New Visit</button>' +
    '<button class="btn btn-ghost" data-action="edit-patient" data-id="' + p.id + '">Edit</button>' +
    '<button class="btn btn-ghost" data-action="delete-patient" data-id="' + p.id + '" style="color:var(--red)">Delete</button></div></div>' +
    '<div class="info-grid">' +
    '<div class="info-cell"><div class="i-label">Phone</div><div class="i-value num">' + esc(p.phone) + '</div></div>' +
    '<div class="info-cell"><div class="i-label">Address</div><div class="i-value">' + esc(p.address || '—') + '</div></div>' +
    '<div class="info-cell"><div class="i-label">Registered</div><div class="i-value">' + fmtDate(p.createdAt) + '</div></div>' +
    '<div class="info-cell"><div class="i-label">Total visits</div><div class="i-value num">' + vs.length + '</div></div>' +
    (fu.length ? '<div class="info-cell"><div class="i-label">Follow-up</div><div class="i-value">' + fuPill(fu[0]) + '</div></div>' : '') +
    '</div></div>' +
    '<div class="card"><h3 class="panel-title">Visit history</h3><p class="panel-sub">Newest first · prescriptions included</p>' + timeline + '</div>';
}
function patientFormHTML(p) {
  p = p || {};
  const g = v => '<option' + (p.gender === v ? ' selected' : '') + '>' + v + '</option>';
  return '<div class="modal-head"><h3>' + (p.id ? 'Edit Patient' : 'New Patient') + '</h3>' +
    '<button class="icon-btn" data-action="close-modal" aria-label="Close">' + ICONS.x + '</button></div>' +
    '<form id="patient-form" data-id="' + (p.id || '') + '">' +
    '<div class="field"><label for="pt-name">Full name</label><input id="pt-name" name="name" required maxlength="60" value="' + esc(p.name || '') + '" placeholder="e.g. Ramesh Gupta"/></div>' +
    '<div class="form-grid"><div class="field"><label for="pt-age">Age</label><input id="pt-age" name="age" type="number" min="0" max="120" required value="' + (p.age != null ? p.age : '') + '"/></div>' +
    '<div class="field"><label for="pt-gender">Gender</label><select id="pt-gender" name="gender">' + g('Male') + g('Female') + g('Other') + '</select></div></div>' +
    '<div class="field"><label for="pt-phone">Mobile number</label><input id="pt-phone" name="phone" inputmode="numeric" maxlength="10" required value="' + esc(p.phone || '') + '" placeholder="10-digit mobile"/><div class="hint">Indian mobile number starting with 6–9.</div></div>' +
    '<div class="field"><label for="pt-address">Address</label><textarea id="pt-address" name="address" rows="2" maxlength="160">' + esc(p.address || '') + '</textarea></div>' +
    '<div id="pt-errors" style="color:var(--red);font-weight:600;font-size:14px;margin-bottom:10px"></div>' +
    '<button class="btn btn-primary btn-block btn-huge" type="submit">' + (p.id ? 'Save Changes' : 'Register Patient') + '</button></form>';
}

/* ----- VISIT FORM ----- */
function visitFormHTML(pid) {
  const p = patient(pid);
  return '<div class="modal-head"><h3>New Visit — ' + esc(p ? p.name : '') + '</h3>' +
    '<button class="icon-btn" data-action="close-modal" aria-label="Close">' + ICONS.x + '</button></div>' +
    '<form id="visit-form" data-pid="' + esc(pid) + '">' +
    '<div class="form-grid"><div class="field"><label for="vs-date">Visit date</label><input id="vs-date" name="date" type="date" required value="' + todayStr() + '" max="' + todayStr() + '"/></div>' +
    '<div class="field"><label for="vs-fee">Fee charged (₹)</label><input id="vs-fee" name="fee" type="number" min="0" step="1" required value="300"/></div></div>' +
    '<div class="field"><label for="vs-sym">Symptoms</label><textarea id="vs-sym" name="symptoms" rows="2" required maxlength="400" placeholder="What the patient reported"></textarea></div>' +
    '<div class="field"><label for="vs-dia">Diagnosis</label><input id="vs-dia" name="diagnosis" required maxlength="120" placeholder="Clinical diagnosis"/></div>' +
    '<div class="field"><label>Prescription</label><div id="rx-rows"></div>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="rx-add">' + ICONS.plus + ' Add medicine</button></div>' +
    '<div class="field"><label for="vs-next">Follow-up on (optional)</label><input id="vs-next" name="nextVisit" type="date" min="' + todayStr() + '"/><div class="hint">Leave blank if no follow-up needed.</div></div>' +
    '<div id="vs-errors" style="color:var(--red);font-weight:600;font-size:14px;margin-bottom:10px"></div>' +
    '<button class="btn btn-primary btn-block btn-huge" type="submit">Save Visit</button></form>';
}
function rxRowHTML() {
  return '<div class="rx-row"><input class="rx-med" placeholder="Medicine" maxlength="60"/>' +
    '<input class="rx-dose" placeholder="Dosage e.g. 1-0-1" maxlength="30"/>' +
    '<input class="rx-days" type="number" min="1" placeholder="Days"/>' +
    '<button type="button" class="icon-btn danger" data-action="rx-remove" aria-label="Remove medicine row">' + ICONS.x + '</button></div>';
}

/* ----- VISITS ----- */
function viewVisits() {
  const months = {};
  S.visits.forEach(v => { const k = v.date.slice(0, 7); months[k] = (months[k] || 0) + 1; });
  const opts = Object.keys(months).sort().reverse().map(k => {
    const p = k.split('-');
    return '<option value="' + k + '"' + (visitFilter.month === k ? ' selected' : '') + '>' + MONTHS[Number(p[1]) - 1] + ' ' + p[0] + ' (' + months[k] + ')</option>';
  }).join('');
  return '<div class="view-head"><div><h2>All Visits</h2><p class="sub">' + S.visits.length + ' consultations on record</p></div></div>' +
    '<div class="card"><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">' +
    '<div class="search-wrap" style="flex:1;min-width:220px;margin:0">' + ICONS.search +
    '<input id="visit-search" type="search" placeholder="Search patient, diagnosis…" value="' + esc(visitFilter.q) + '" aria-label="Search visits" autocomplete="off"/></div>' +
    '<select id="visit-month" aria-label="Filter by month" style="border:1.5px solid var(--line);border-radius:12px;padding:12px;min-height:52px;font-weight:700">' +
    '<option value="all">All months</option>' + opts + '</select></div>' +
    '<div class="timeline" id="visit-list"></div></div>';
}
function renderVisitList() {
  const box = $('#visit-list'); if (!box) return;
  const q = visitFilter.q.trim().toLowerCase();
  const list = S.visits.filter(v => {
    if (visitFilter.month !== 'all' && v.date.slice(0, 7) !== visitFilter.month) return false;
    if (!q) return true;
    const p = patient(v.patientId);
    return v.diagnosis.toLowerCase().indexOf(q) > -1 || v.symptoms.toLowerCase().indexOf(q) > -1 ||
      (p && (p.name.toLowerCase().indexOf(q) > -1 || p.phone.indexOf(q) > -1));
  }).sort((a, b) => b.date.localeCompare(a.date));
  box.innerHTML = list.length ? list.map(v => visitCard(v, true)).join('')
    : '<div class="empty-note">No visits match these filters.</div>';
}

/* ----- FOLLOW-UPS ----- */
function viewFollowups() {
  const fus = followups();
  const grp = b => fus.filter(v => fuBucket(v) === b);
  const section = (title, sub, list) =>
    '<div class="card" style="margin-bottom:18px"><h3 class="panel-title">' + title + '</h3><p class="panel-sub">' + sub + '</p>' +
    (list.length ? list.map(v => fuRow(v, true)).join('') : '<div class="empty-note">Nothing here.</div>') + '</div>';
  return '<div class="view-head"><div><h2>Follow-ups</h2><p class="sub">Patients asked to return · mark done once they visit</p></div></div>' +
    section('Overdue', 'Follow-up date has passed — call these patients', grp('overdue')) +
    section('Due today', 'Expected back today, ' + fmtDate(todayStr()), grp('today')) +
    section('Upcoming', 'Scheduled ahead', grp('upcoming'));
}

/* ----- SETTINGS ----- */
function viewSettings() {
  const c = S.clinic;
  return '<div class="view-head"><div><h2>Settings</h2><p class="sub">Clinic profile and data</p></div></div>' +
    '<div class="two-col"><div class="card"><h3 class="panel-title">Clinic profile</h3><p class="panel-sub">Shown across the app</p>' +
    '<form id="clinic-form"><div class="field"><label for="cl-name">Clinic name</label><input id="cl-name" name="name" required maxlength="80" value="' + esc(c.name || '') + '"/></div>' +
    '<div class="field"><label for="cl-doctor">Doctor</label><input id="cl-doctor" name="doctor" maxlength="80" value="' + esc(c.doctor || '') + '"/></div>' +
    '<div class="field"><label for="cl-address">Address</label><textarea id="cl-address" name="address" rows="2" maxlength="160">' + esc(c.address || '') + '</textarea></div>' +
    '<div class="form-grid"><div class="field"><label for="cl-phone">Phone</label><input id="cl-phone" name="phone" maxlength="20" value="' + esc(c.phone || '') + '"/></div>' +
    '<div class="field"><label for="cl-timings">Timings</label><input id="cl-timings" name="timings" maxlength="80" value="' + esc(c.timings || '') + '"/></div></div>' +
    '<button class="btn btn-primary btn-block" type="submit">Save Profile</button></form></div>' +
    '<div class="card"><h3 class="panel-title">Data</h3><p class="panel-sub">Everything stays on this device (localStorage)</p>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +
    '<button class="btn btn-ghost btn-block" data-action="export-data">Download backup (JSON)</button>' +
    '<button class="btn btn-danger btn-block" data-action="reset-data">Reset all data</button>' +
    '<p style="font-size:13px;color:var(--ink-soft);margin:6px 0 0">Reset wipes patients, visits and settings, then restores the starter records.</p></div></div></div>';
}
function exportData() {
  const dump = {};
  store.keys().forEach(k => { dump[k] = store.get(k.slice(NS.length), null); });
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clinicdesk-backup-' + todayStr() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup downloaded.');
}

/* ---------- clock ---------- */
function startClock() {
  const el = $('#clock');
  const tick = () => {
    const d = new Date();
    el.textContent = fmtDate(todayStr()) + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  tick(); setInterval(tick, 30000);
}

/* ============================================================
   EVENTS
   ============================================================ */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;

  if (a === 'nav') { view = t.dataset.view; activePatient = null; render(); return; }
  if (a === 'overlay-close' && e.target === t) { closeModal(); return; }
  if (a === 'close-modal') { closeModal(); return; }
  if (a === 'confirm-yes') { const f = window._confirmFn; window._confirmFn = null; closeModal(); if (f) f(); return; }

  if (a === 'open-patient-modal') { openModal(patientFormHTML(null)); return; }
  if (a === 'edit-patient') { const p = patient(t.dataset.id); if (p) openModal(patientFormHTML(p)); return; }
  if (a === 'open-patient') { activePatient = t.dataset.id; view = 'patients'; render(); window.scrollTo(0, 0); return; }
  if (a === 'back-patients') { activePatient = null; render(); return; }
  if (a === 'delete-patient') {
    const p = patient(t.dataset.id);
    openConfirm('Delete ' + (p ? p.name : 'this patient') + ' and all their visit records? This cannot be undone.', 'Delete', () => {
      deletePatient(t.dataset.id); activePatient = null; render(); toast('Patient deleted.');
    });
    return;
  }
  if (a === 'open-visit-modal') { openModal(visitFormHTML(t.dataset.id), true); $('#rx-rows').innerHTML = rxRowHTML(); return; }
  if (a === 'rx-add') { $('#rx-rows').insertAdjacentHTML('beforeend', rxRowHTML()); return; }
  if (a === 'rx-remove') { const row = t.closest('.rx-row'); if (row) row.remove(); return; }
  if (a === 'delete-visit') {
    openConfirm('Delete this visit record? The prescription and fee entry will be removed.', 'Delete', () => {
      deleteVisit(t.dataset.id); render(); toast('Visit deleted.');
    });
    return;
  }
  if (a === 'fu-done') { markFollowupDone(t.dataset.id); render(); toast('Follow-up marked done.'); return; }

  if (a === 'export-data') { exportData(); return; }
  if (a === 'reset-data') {
    openConfirm('Reset everything? Patients, visits and settings will be wiped and the starter records restored.', 'Reset all', () => {
      store.wipe(); loadState(); seed(); view = 'dashboard'; activePatient = null; render(); toast('All data reset.');
    });
    return;
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'patient-search') { patientFilter.q = e.target.value; renderPatientGrid(); }
  if (e.target.id === 'visit-search') { visitFilter.q = e.target.value; renderVisitList(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'visit-month') { visitFilter.month = e.target.value; renderVisitList(); }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'patient-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const f = { name: String(fd.get('name') || ''), age: Number(fd.get('age')), gender: String(fd.get('gender')), phone: String(fd.get('phone') || ''), address: String(fd.get('address') || '') };
    const id = e.target.dataset.id;
    const r = id ? updatePatient(id, f) : addPatient(f);
    if (!r.ok) { $('#pt-errors').textContent = r.errs.join(' '); return; }
    closeModal(); render(); toast(id ? 'Patient updated.' : r.patient.name + ' registered.');
  }
  if (e.target.id === 'visit-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pid = e.target.dataset.pid;
    const rx = $$('#rx-rows .rx-row').map(row => ({
      med: $('.rx-med', row).value, dose: $('.rx-dose', row).value, days: Number($('.rx-days', row).value)
    }));
    const f = { date: String(fd.get('date') || ''), symptoms: String(fd.get('symptoms') || ''),
      diagnosis: String(fd.get('diagnosis') || ''), fee: Number(fd.get('fee')), rx,
      nextVisit: String(fd.get('nextVisit') || '') || null };
    const r = addVisit(pid, f);
    if (!r.ok) { $('#vs-errors').textContent = r.errs.join(' '); return; }
    closeModal(); activePatient = pid; view = 'patients'; render(); toast('Visit recorded.');
  }
  if (e.target.id === 'clinic-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    S.clinic = { name: String(fd.get('name') || '').trim(), doctor: String(fd.get('doctor') || '').trim(),
      address: String(fd.get('address') || '').trim(), phone: String(fd.get('phone') || '').trim(),
      timings: String(fd.get('timings') || '').trim() };
    save('clinic'); toast('Clinic profile saved.');
  }
});
// delete-patient lives in the detail header actions; wire via delegation already above.

/* ============================================================
   SELF-TEST (?selftest=1)
   ============================================================ */
function selftestBanner(ok, text) {
  const b = $('#selftest-banner');
  b.hidden = false;
  b.className = ok ? 'pass' : 'fail';
  b.textContent = text;
  document.title = text;
}
function runSelftest() {
  const results = [];
  const check = (name, cond, detail) => { results.push({ name, ok: !!cond, detail: detail || '' }); };
  let snapshot = {};
  try {
    store.keys().forEach(k => { snapshot[k] = localStorage.getItem(k); });

    // (a) wipe, (b) seed
    store.wipe(); loadState(); seed();

    // 1 — seed
    check('seed: 5+ patients', S.patients.length >= 5, 'got ' + S.patients.length);
    check('seed: visits exist', S.visits.length >= 5, 'got ' + S.visits.length);

    const before = dashboardStats();

    // 2 — add patient (CRUD) + validation
    const addR = addPatient({ name: 'Selftest Kumar', age: 40, gender: 'Male', phone: '9876543210', address: 'Test address' });
    check('addPatient ok', addR.ok && !!patient(addR.patient.id));
    const badPhone = addPatient({ name: 'Bad', age: 30, gender: 'Male', phone: '12345', address: '' });
    check('rejects invalid phone', !badPhone.ok);
    const badAge = addPatient({ name: 'Bad', age: 200, gender: 'Male', phone: '9876543211', address: '' });
    check('rejects invalid age', !badAge.ok);
    const editR = updatePatient(addR.patient.id, { name: 'Selftest Kumar', age: 41, gender: 'Male', phone: '9876543210', address: 'New address' });
    check('updatePatient ok', editR.ok && patient(addR.patient.id).age === 41);

    // 3 — add visit with prescription + fee + follow-up today
    const T = todayStr();
    const visR = addVisit(addR.patient.id, {
      date: T, symptoms: 'Test cough', diagnosis: 'Test diagnosis',
      rx: [{ med: 'TestMed 100mg', dose: '1-0-1', days: 7 }, { med: '', dose: '', days: 0 }],
      fee: 700, nextVisit: T
    });
    check('addVisit ok (blank rx row skipped)', visR.ok && visR.visit.rx.length === 1 && visR.visit.rx[0].med === 'TestMed 100mg',
      visR.ok ? '' : visR.errs.join(' '));

    // 4 — dashboard counts move correctly
    const after = dashboardStats();
    check('totalPatients +1', after.totalPatients === before.totalPatients + 1, before.totalPatients + '→' + after.totalPatients);
    check('visitsThisMonth +1', after.visitsThisMonth === before.visitsThisMonth + 1);
    check('revenueThisMonth +700', after.revenueThisMonth === before.revenueThisMonth + 700,
      before.revenueThisMonth + '→' + after.revenueThisMonth);
    check('follow-up due today listed', followups().some(v => v.id === visR.visit.id));
    check('followupsDue +1', after.followupsDue === before.followupsDue + 1);

    // 5 — mark follow-up done removes it
    markFollowupDone(visR.visit.id);
    check('fu-done clears due list', !followups().some(v => v.id === visR.visit.id) &&
      dashboardStats().followupsDue === before.followupsDue);

    // 6 — search finds the new patient
    patientFilter.q = 'selftest';
    const found = S.patients.filter(p => p.name.toLowerCase().indexOf('selftest') > -1);
    check('patient search works', found.length === 1 && found[0].id === addR.patient.id);
    patientFilter.q = '';

    // 7 — persistence round-trip
    const rawP = JSON.parse(localStorage.getItem(NS + 'patients'));
    const rawV = JSON.parse(localStorage.getItem(NS + 'visits'));
    check('localStorage round-trip', rawP.length === S.patients.length && rawV.length === S.visits.length &&
      rawV.some(v => v.id === visR.visit.id));

    // 8 — re-render every view (incl. patient detail) without throwing
    let renderOk = true, renderErr = '';
    try {
      view = 'dashboard'; render();
      view = 'patients'; activePatient = null; render();
      activePatient = addR.patient.id; render();
      view = 'visits'; activePatient = null; render();
      view = 'followups'; render();
      view = 'settings'; render();
      view = 'dashboard'; render();
    } catch (err) { renderOk = false; renderErr = String(err && err.message || err); }
    check('all views render', renderOk, renderErr);

    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    const msg = failed.length
      ? 'SELFTEST FAIL: ' + failed.map(f => f.name + (f.detail ? ' (' + f.detail + ')' : '')).join('; ')
      : 'SELFTEST PASS ' + passed + '/' + results.length;
    return { msg, ok: !failed.length, snapshot };
  } catch (err) {
    return { msg: 'SELFTEST FAIL: exception ' + String(err && err.message || err), ok: false, snapshot };
  } finally {
    store.wipe();
    const keys = Object.keys(snapshot);
    if (keys.length) keys.forEach(k => localStorage.setItem(k, snapshot[k]));
    loadState();
    if (!store.get('seeded', false)) seed();
    view = 'dashboard'; activePatient = null; render();
  }
}

/* ---------- boot ---------- */
function boot() {
  loadState();
  if (!store.get('seeded', false)) seed();
  render();
  startClock();
  if (new URLSearchParams(location.search).get('selftest') === '1') {
    const r = runSelftest();
    selftestBanner(r.ok, r.msg);
    const d = document.createElement('div');
    d.id = 'selftest-detail'; d.style.display = 'none'; d.textContent = r.msg;
    document.body.appendChild(d);
  }
}
boot();
