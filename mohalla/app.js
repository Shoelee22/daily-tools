/* Mohalla — neighbourhood board. Vanilla JS, localStorage persisted. */
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
  pin:'<path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  tag:'<path d="M20.6 13.4L11 3H4v7l9.6 10.4a2 2 0 002.8 0l4.2-4.2a2 2 0 000-2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
  box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  alert:'<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  phone:'<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.13.96.36 1.9.7 2.8a2 2 0 01-.45 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0122 16.9z"/>',
  user:'<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/>'
};
const icon = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
$$('.tab-ic').forEach(el => { el.innerHTML = icon(el.dataset.ic); });
$('.search-ic').innerHTML = icon('search');

/* ================= storage ================= */
const NS = 'mh_v1_';
const DB = {
  read(k, fb){ try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : fb; } catch(e){ return fb; } },
  write(k, v){ localStorage.setItem(NS + k, JSON.stringify(v)); },
  keys(){ const out = []; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.indexOf(NS) === 0) out.push(k); } return out; },
  wipe(){ DB.keys().forEach(k => localStorage.removeItem(k)); }
};

/* ================= dates & money ================= */
const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function todayISO(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function fmtDate(iso){ if (!iso) return '—'; const p = iso.split('-'); if (p.length < 3) return esc(iso); return p[2] + '-' + (MON3[+p[1]-1] || p[1]) + '-' + p[0]; }
function fmtINR(n){ return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function validPhone(p){ return /^\d{10}$/.test(String(p||'').replace(/\s/g,'')); }

/* ================= state ================= */
let state = { notices:[], listings:[], borrows:[], lostfound:[], tab:'notices', search:'', mineOnly:false, myName:'' };
function saveAll(){
  DB.write('notices', state.notices); DB.write('listings', state.listings);
  DB.write('borrows', state.borrows); DB.write('lostfound', state.lostfound);
  DB.write('ui', { tab: state.tab, mineOnly: state.mineOnly, myName: state.myName });
}
function loadAll(){
  state.notices = DB.read('notices', []); state.listings = DB.read('listings', []);
  state.borrows = DB.read('borrows', []); state.lostfound = DB.read('lostfound', []);
  const ui = DB.read('ui', {});
  state.tab = ui.tab || 'notices'; state.mineOnly = !!ui.mineOnly; state.myName = ui.myName || '';
}

/* ================= seed ================= */
function seed(){
  state.notices = [
    { id:'n1', title:'Diwali mela volunteers needed', body:'The RWA is organising a Diwali mela on 8 Nov at the central park. We need volunteers for stalls, lights and the kids\u2019 corner. Please reach out if you can spare a few hours.', date:'2026-10-10', author:'Sunita Iyer', pinned:true },
    { id:'n2', title:'Water tank cleaning \u2014 18 Oct', body:'Overhead tanks of Towers B and C will be cleaned on 18 Oct between 10 AM and 2 PM. Please store water accordingly.', date:'2026-10-11', author:'Ramesh Gupta', pinned:false },
    { id:'n3', title:'RWA meeting \u2014 Sunday 11 AM', body:'Monthly RWA meeting at the clubhouse on 18 Oct, 11 AM. Agenda: parking slots, garden upkeep, festival fund.', date:'2026-10-12', author:'Anjali Mehta', pinned:false }
  ];
  state.listings = [
    { id:'l1', item:'Samsung double-door refrigerator, 260L', price:12000, description:'4 years old, cooling perfect, single owner. Buyer arranges pickup from Tower A.', contactName:'Vikram Rao', contactPhone:'9811045210', status:'available', date:'2026-10-09' },
    { id:'l2', item:'Royal Enfield Classic 350 (2021)', price:95000, description:'28,000 km, serviced regularly, new tyres. Papers clear, Noida registration.', contactName:'Arjun Nair', contactPhone:'9822078145', status:'available', date:'2026-10-10' },
    { id:'l3', item:'Solid wood study table', price:2500, description:'Sheesham study table with two drawers, no scratches. Moving-out sale.', contactName:'Meera Krishnan', contactPhone:'9833021987', status:'available', date:'2026-10-11' },
    { id:'l4', item:'Kids\u2019 bicycle, 20-inch', price:4800, description:'Barely used. Suitable for 6\u20139 years.', contactName:'Kabir Malhotra', contactPhone:'9844065321', status:'sold', date:'2026-10-08' }
  ];
  state.borrows = [
    { id:'b1', item:'Bosch hammer drill', owner:'Ramesh Gupta', contact:'9811045210', status:'available', borrower:'', returnDate:'' },
    { id:'b2', item:'6-ft aluminium folding ladder', owner:'Farhan Sheikh', contact:'9855031764', status:'borrowed', borrower:'Lakshmi Venkat', returnDate:'2026-10-20' },
    { id:'b3', item:'K\u00e4rcher pressure washer', owner:'Lakshmi Venkat', contact:'9866089213', status:'available', borrower:'', returnDate:'' }
  ];
  state.lostfound = [
    { id:'f1', item:'Golden retriever \u201cSheru\u201d', status:'lost', location:'Near Park 2', date:'2026-10-11', detail:'Friendly, red collar. Reward for safe return.', contact:'Neha Kapoor \u00b7 9877041528', resolved:false },
    { id:'f2', item:'Set of house keys with blue tag', status:'found', location:'Near Gate B', date:'2026-10-12', detail:'Found on 12 Oct morning. Describe the keychain to claim.', contact:'Suresh Yadav \u00b7 9888096234', resolved:false },
    { id:'f3', item:'School blazer, Class 6 (DPS)', status:'lost', location:'Park swings area', date:'2026-10-09', detail:'Name tag \u201cAarav\u201d stitched inside.', contact:'Priya Deshmukh \u00b7 9899012756', resolved:true }
  ];
  saveAll();
}

/* ================= data ops ================= */
// notices
function addNotice(d){ const n = { id: uid(), title: d.title.trim(), body: d.body.trim(), date: d.date || todayISO(), author: d.author.trim(), pinned: !!d.pinned }; state.notices.push(n); saveAll(); return n; }
function updateNotice(id, d){ const n = state.notices.find(x => x.id === id); if (!n) return null; Object.assign(n, { title: d.title.trim(), body: d.body.trim(), date: d.date || n.date, author: d.author.trim(), pinned: !!d.pinned }); saveAll(); return n; }
function deleteNotice(id){ state.notices = state.notices.filter(x => x.id !== id); saveAll(); }
function togglePin(id){ const n = state.notices.find(x => x.id === id); if (n){ n.pinned = !n.pinned; saveAll(); } return n; }
// listings
function addListing(d){ const l = { id: uid(), item: d.item.trim(), price: +d.price, description: d.description.trim(), contactName: d.contactName.trim(), contactPhone: String(d.contactPhone).replace(/\s/g,''), status: 'available', date: todayISO() }; state.listings.push(l); saveAll(); return l; }
function updateListing(id, d){ const l = state.listings.find(x => x.id === id); if (!l) return null; Object.assign(l, { item: d.item.trim(), price: +d.price, description: d.description.trim(), contactName: d.contactName.trim(), contactPhone: String(d.contactPhone).replace(/\s/g,'') }); saveAll(); return l; }
function deleteListing(id){ state.listings = state.listings.filter(x => x.id !== id); saveAll(); }
function setListingStatus(id, s){ const l = state.listings.find(x => x.id === id); if (l){ l.status = s; saveAll(); } return l; }
// borrow
function addBorrow(d){ const b = { id: uid(), item: d.item.trim(), owner: d.owner.trim(), contact: String(d.contact).replace(/\s/g,''), status: 'available', borrower: '', returnDate: '' }; state.borrows.push(b); saveAll(); return b; }
function updateBorrow(id, d){ const b = state.borrows.find(x => x.id === id); if (!b) return null; Object.assign(b, { item: d.item.trim(), owner: d.owner.trim(), contact: String(d.contact).replace(/\s/g,'') }); saveAll(); return b; }
function deleteBorrow(id){ state.borrows = state.borrows.filter(x => x.id !== id); saveAll(); }
function lendBorrow(id, borrower, returnDate){ const b = state.borrows.find(x => x.id === id); if (b){ b.status = 'borrowed'; b.borrower = borrower.trim(); b.returnDate = returnDate; saveAll(); } return b; }
function returnBorrow(id){ const b = state.borrows.find(x => x.id === id); if (b){ b.status = 'available'; b.borrower = ''; b.returnDate = ''; saveAll(); } return b; }
// lost & found
function addLostFound(d){ const f = { id: uid(), item: d.item.trim(), status: d.status, location: d.location.trim(), date: d.date || todayISO(), detail: d.detail.trim(), contact: d.contact.trim(), resolved: false }; state.lostfound.push(f); saveAll(); return f; }
function updateLostFound(id, d){ const f = state.lostfound.find(x => x.id === id); if (!f) return null; Object.assign(f, { item: d.item.trim(), status: d.status, location: d.location.trim(), date: d.date || f.date, detail: d.detail.trim(), contact: d.contact.trim() }); saveAll(); return f; }
function deleteLostFound(id){ state.lostfound = state.lostfound.filter(x => x.id !== id); saveAll(); }
function setResolved(id, r){ const f = state.lostfound.find(x => x.id === id); if (f){ f.resolved = !!r; saveAll(); } return f; }

/* ================= toast / modal ================= */
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
    inputHTML.replace('<input', '<input id="f_' + esc(name) + '"').replace('<select', '<select id="f_' + esc(name) + '"').replace('<textarea', '<textarea id="f_' + esc(name) + '"') +
    (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') +
    '<div class="err" role="alert"></div></div>';
}
function setErr(name, msg){
  const f = document.querySelector('[data-fld="' + name + '"]');
  if (!f) return;
  f.classList.toggle('invalid', !!msg);
  f.querySelector('.err').textContent = msg || '';
}
function confirmDlg(title, msg){
  return new Promise(resolve => {
    openModal(title, '<p style="margin:0;color:var(--muted)">' + esc(msg) + '</p>', () => { resolve(true); return true; }, 'Delete');
  });
}

/* ================= filtering ================= */
function authorOf(item){
  return item.author || item.contactName || item.owner || '';
}
function applyFilters(list){
  let out = list;
  const q = state.search.trim().toLowerCase();
  if (q) out = out.filter(it => JSON.stringify(it).toLowerCase().includes(q));
  if (state.mineOnly && state.myName){
    const me = state.myName.trim().toLowerCase();
    out = out.filter(it => authorOf(it).toLowerCase().includes(me));
  }
  return out;
}
function actionsHTML(list){
  return '<div class="actions">' + list.map(a => '<button class="abtn' + (a.danger ? ' danger' : '') + '" data-act="' + a.act + '" data-id="' + a.id + '">' + icon(a.ic) + esc(a.label) + '</button>').join('') + '</div>';
}
function emptyHTML(ic, title, msg, actLabel, act){
  return '<div class="empty">' + icon(ic) + '<h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p>' +
    (act ? '<button class="btn btn-primary" data-act="' + act + '">' + icon('plus') + esc(actLabel) + '</button>' : '') + '</div>';
}
function tilt(i){ return i % 2 ? ' tilt-r' : ' tilt-l'; }

/* ================= views ================= */
function renderNotices(){
  const list = applyFilters(state.notices).sort((a, b) => (b.pinned - a.pinned) || (b.date < a.date ? -1 : 1));
  let html = pageHead('Notices', 'Announcements from the RWA and your neighbours.', 'Post notice', 'add-notice');
  if (!list.length) return html + emptyHTML('pin', 'Nothing on the board', state.search || state.mineOnly ? 'No notices match your filter.' : 'Be the first to pin a notice for the mohalla.', 'Post notice', 'add-notice');
  html += '<div class="board">';
  list.forEach((n, i) => {
    html += '<article class="note' + (n.pinned ? ' pinned' : '') + tilt(i) + '">' +
      (n.pinned ? '<span class="pinhead" aria-hidden="true"></span>' : '<span class="tape" aria-hidden="true"></span>') +
      '<div class="note-top"><h3>' + esc(n.title) + '</h3>' + (n.pinned ? '<span class="pill green">Pinned</span>' : '') + '</div>' +
      '<p class="body">' + esc(n.body) + '</p>' +
      '<div class="meta"><span>By <b>' + esc(n.author) + '</b></span><span>' + fmtDate(n.date) + '</span></div>' +
      actionsHTML([
        { act: 'notice-pin', id: n.id, ic: 'pin', label: n.pinned ? 'Unpin' : 'Pin' },
        { act: 'notice-edit', id: n.id, ic: 'edit', label: 'Edit' },
        { act: 'notice-del', id: n.id, ic: 'trash', label: 'Delete', danger: true }
      ]) + '</article>';
  });
  return html + '</div>';
}
function renderListings(){
  const list = applyFilters(state.listings).sort((a, b) => (a.status === 'sold') - (b.status === 'sold') || (b.date < a.date ? -1 : 1));
  let html = pageHead('Buy & Sell', 'Pre-loved things from people on your street. No middlemen.', 'List an item', 'add-listing');
  if (!list.length) return html + emptyHTML('tag', 'Nothing for sale', state.search || state.mineOnly ? 'No listings match your filter.' : 'Got something to sell or give away? List it here.', 'List an item', 'add-listing');
  const avail = list.filter(l => l.status === 'available'), sold = list.filter(l => l.status === 'sold');
  html += '<div class="board">';
  if (avail.length) html += '<div class="board-label">Available · ' + avail.length + '</div>';
  html += avail.map((l, i) => listingCard(l, i)).join('');
  if (sold.length) html += '<div class="board-label">Sold · ' + sold.length + '</div>' + sold.map((l, i) => listingCard(l, i)).join('');
  return html + '</div>';
}
function listingCard(l, i){
  return '<article class="note' + tilt(i) + '"><span class="tape" aria-hidden="true"></span>' +
    '<div class="note-top"><h3>' + esc(l.item) + '</h3>' +
    (l.status === 'sold' ? '<span class="pill grey">Sold</span>' : '<span class="pill ok">Available</span>') + '</div>' +
    '<div class="price num">' + fmtINR(l.price) + '</div>' +
    '<p class="body">' + esc(l.description) + '</p>' +
    '<div class="meta"><span>' + icon('user') + ' <b>' + esc(l.contactName) + '</b></span><span>' + icon('phone') + ' <b class="num">' + esc(l.contactPhone) + '</b></span><span>' + fmtDate(l.date) + '</span></div>' +
    actionsHTML(l.status === 'sold'
      ? [{ act: 'listing-relist', id: l.id, ic: 'undo', label: 'Relist' }, { act: 'listing-edit', id: l.id, ic: 'edit', label: 'Edit' }, { act: 'listing-del', id: l.id, ic: 'trash', label: 'Delete', danger: true }]
      : [{ act: 'listing-sold', id: l.id, ic: 'check', label: 'Mark sold' }, { act: 'listing-edit', id: l.id, ic: 'edit', label: 'Edit' }, { act: 'listing-del', id: l.id, ic: 'trash', label: 'Delete', danger: true }]) +
    '</article>';
}
function renderBorrow(){
  const list = applyFilters(state.borrows);
  let html = pageHead('Borrow', 'Ladders, drills and tools your neighbours are happy to lend.', 'Offer an item', 'add-borrow');
  if (!list.length) return html + emptyHTML('box', 'Nothing to borrow', state.search || state.mineOnly ? 'No items match your filter.' : 'Offer something you own — the mohalla will thank you.', 'Offer an item', 'add-borrow');
  const avail = list.filter(b => b.status === 'available'), out = list.filter(b => b.status === 'borrowed');
  html += '<div class="board">';
  if (avail.length) html += '<div class="board-label">Available to borrow · ' + avail.length + '</div>';
  html += avail.map((b, i) => borrowCard(b, i)).join('');
  if (out.length) html += '<div class="board-label">Currently borrowed · ' + out.length + '</div>' + out.map((b, i) => borrowCard(b, i)).join('');
  return html + '</div>';
}
function borrowCard(b, i){
  const borrowed = b.status === 'borrowed';
  return '<article class="note' + tilt(i) + '"><span class="tape" aria-hidden="true"></span>' +
    '<div class="note-top"><h3>' + esc(b.item) + '</h3>' +
    (borrowed ? '<span class="pill amber">Borrowed</span>' : '<span class="pill ok">Available</span>') + '</div>' +
    '<div class="meta"><span>Owner <b>' + esc(b.owner) + '</b></span><span>' + icon('phone') + ' <b class="num">' + esc(b.contact) + '</b></span></div>' +
    (borrowed ? '<p class="body">With <b>' + esc(b.borrower) + '</b>' + (b.returnDate ? ' · back by <b>' + fmtDate(b.returnDate) + '</b>' : '') + '</p>' : '') +
    actionsHTML(borrowed
      ? [{ act: 'borrow-return', id: b.id, ic: 'undo', label: 'Mark returned' }, { act: 'borrow-edit', id: b.id, ic: 'edit', label: 'Edit' }, { act: 'borrow-del', id: b.id, ic: 'trash', label: 'Delete', danger: true }]
      : [{ act: 'borrow-lend', id: b.id, ic: 'check', label: 'Mark borrowed' }, { act: 'borrow-edit', id: b.id, ic: 'edit', label: 'Edit' }, { act: 'borrow-del', id: b.id, ic: 'trash', label: 'Delete', danger: true }]) +
    '</article>';
}
function renderLostFound(){
  const list = applyFilters(state.lostfound).sort((a, b) => (a.resolved - b.resolved) || (b.date < a.date ? -1 : 1));
  let html = pageHead('Lost & Found', 'Lost something? Found something? The board reunites.', 'Post an item', 'add-lf');
  if (!list.length) return html + emptyHTML('alert', 'All reunited', state.search || state.mineOnly ? 'No posts match your filter.' : 'Nothing lost or found right now. Long may it continue.', 'Post an item', 'add-lf');
  const open = list.filter(f => !f.resolved), done = list.filter(f => f.resolved);
  html += '<div class="board">';
  if (open.length) html += '<div class="board-label">Open · ' + open.length + '</div>';
  html += open.map((f, i) => lfCard(f, i)).join('');
  if (done.length) html += '<div class="board-label">Resolved · ' + done.length + '</div>' + done.map((f, i) => lfCard(f, i)).join('');
  return html + '</div>';
}
function lfCard(f, i){
  return '<article class="note' + tilt(i) + (f.resolved ? '" style="opacity:.82' : '') + '"><span class="tape" aria-hidden="true"></span>' +
    '<div class="note-top"><h3>' + esc(f.item) + '</h3>' +
    (f.status === 'lost' ? '<span class="pill bad">Lost</span>' : '<span class="pill blue">Found</span>') +
    (f.resolved ? ' <span class="pill ok">Resolved</span>' : '') + '</div>' +
    '<p class="body">' + esc(f.detail) + '</p>' +
    '<div class="meta"><span>' + icon('pin') + ' <b>' + esc(f.location) + '</b></span><span>' + fmtDate(f.date) + '</span></div>' +
    '<div class="meta"><span>Contact <b>' + esc(f.contact) + '</b></span></div>' +
    actionsHTML(f.resolved
      ? [{ act: 'lf-reopen', id: f.id, ic: 'undo', label: 'Reopen' }, { act: 'lf-del', id: f.id, ic: 'trash', label: 'Delete', danger: true }]
      : [{ act: 'lf-resolve', id: f.id, ic: 'check', label: 'Mark resolved' }, { act: 'lf-edit', id: f.id, ic: 'edit', label: 'Edit' }, { act: 'lf-del', id: f.id, ic: 'trash', label: 'Delete', danger: true }]) +
    '</article>';
}
function pageHead(title, sub, btnLabel, btnAct){
  return '<div class="page-head"><div><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div>' +
    '<button class="btn btn-primary" data-act="' + btnAct + '">' + icon('plus') + esc(btnLabel) + '</button></div>';
}
function render(){
  $$('#tabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === state.tab ? 'true' : 'false'));
  $('[data-cnt="notices"]').textContent = state.notices.length;
  $('[data-cnt="listings"]').textContent = state.listings.filter(l => l.status === 'available').length;
  $('[data-cnt="borrow"]').textContent = state.borrows.filter(b => b.status === 'available').length;
  $('[data-cnt="lostfound"]').textContent = state.lostfound.filter(f => !f.resolved).length;
  const v = $('#view');
  const fn = { notices: renderNotices, listings: renderListings, borrow: renderBorrow, lostfound: renderLostFound }[state.tab] || renderNotices;
  v.innerHTML = fn();
  saveAll();
}

/* ================= forms ================= */
function noticeForm(existing){
  const n = existing || { date: todayISO(), author: state.myName };
  const body =
    fieldHTML('title', 'Title', '<input type="text" name="title" maxlength="80" value="' + esc(n.title || '') + '" placeholder="e.g. Water tank cleaning on 18 Oct" required>') +
    fieldHTML('body', 'Details', '<textarea name="body" maxlength="600" placeholder="What should neighbours know?">' + esc(n.body || '') + '</textarea>') +
    '<div class="frow">' +
    fieldHTML('date', 'Date', '<input type="date" name="date" value="' + esc(n.date || todayISO()) + '" required>') +
    fieldHTML('author', 'Your name', '<input type="text" name="author" maxlength="40" value="' + esc(n.author || '') + '" placeholder="e.g. Ramesh Gupta" required>') +
    '</div>' +
    '<label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:14.5px"><input type="checkbox" name="pinned" style="width:20px;height:20px;min-height:0"' + (n.pinned ? ' checked' : '') + '> Pin to the top of the board</label>';
  openModal(existing ? 'Edit notice' : 'Post a notice', body, (fd) => {
    let ok = true;
    const title = String(fd.get('title') || '').trim(), author = String(fd.get('author') || '').trim();
    const bodyT = String(fd.get('body') || '').trim(), date = String(fd.get('date') || '');
    setErr('title', title ? '' : 'Give the notice a title.'); if (!title) ok = false;
    setErr('body', bodyT ? '' : 'Add a few details.'); if (!bodyT) ok = false;
    setErr('author', author ? '' : 'Sign your name.'); if (!author) ok = false;
    setErr('date', /^\d{4}-\d{2}-\d{2}$/.test(date) ? '' : 'Pick a date.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) ok = false;
    if (!ok) return false;
    rememberMe(author);
    const d = { title, body: bodyT, date, author, pinned: fd.get('pinned') === 'on' };
    if (existing) updateNotice(existing.id, d); else addNotice(d);
    toast(existing ? 'Notice updated' : 'Notice posted'); render(); return true;
  }, existing ? 'Save' : 'Post notice');
}
function listingForm(existing){
  const l = existing || { contactName: state.myName };
  const body =
    fieldHTML('item', 'Item', '<input type="text" name="item" maxlength="80" value="' + esc(l.item || '') + '" placeholder="e.g. Solid wood study table" required>') +
    fieldHTML('price', 'Price (₹)', '<input type="number" name="price" min="0" step="50" value="' + esc(l.price == null ? '' : l.price) + '" placeholder="2500" required>') +
    fieldHTML('description', 'Description', '<textarea name="description" maxlength="400" placeholder="Condition, age, pickup details…">' + esc(l.description || '') + '</textarea>') +
    '<div class="frow">' +
    fieldHTML('contactName', 'Your name', '<input type="text" name="contactName" maxlength="40" value="' + esc(l.contactName || '') + '" required>') +
    fieldHTML('contactPhone', 'Phone (10 digits)', '<input type="tel" name="contactPhone" inputmode="numeric" maxlength="10" value="' + esc(l.contactPhone || '') + '" placeholder="9811045210" required>') +
    '</div>';
  openModal(existing ? 'Edit listing' : 'List an item for sale', body, (fd) => {
    let ok = true;
    const item = String(fd.get('item') || '').trim(), price = +fd.get('price');
    const cn = String(fd.get('contactName') || '').trim(), cp = String(fd.get('contactPhone') || '').replace(/\s/g, '');
    setErr('item', item ? '' : 'What are you selling?'); if (!item) ok = false;
    setErr('price', price >= 0 ? '' : 'Enter a price.'); if (!(price >= 0)) ok = false;
    setErr('contactName', cn ? '' : 'Your name, so buyers know who to ask for.'); if (!cn) ok = false;
    setErr('contactPhone', validPhone(cp) ? '' : 'Enter exactly 10 digits.'); if (!validPhone(cp)) ok = false;
    if (!ok) return false;
    rememberMe(cn);
    const d = { item, price, description: String(fd.get('description') || ''), contactName: cn, contactPhone: cp };
    if (existing) updateListing(existing.id, d); else addListing(d);
    toast(existing ? 'Listing updated' : 'Item listed'); render(); return true;
  }, existing ? 'Save' : 'List item');
}
function borrowForm(existing){
  const b = existing || { owner: state.myName };
  const body =
    fieldHTML('item', 'Item', '<input type="text" name="item" maxlength="80" value="' + esc(b.item || '') + '" placeholder="e.g. 6-ft aluminium ladder" required>') +
    '<div class="frow">' +
    fieldHTML('owner', 'Owner name', '<input type="text" name="owner" maxlength="40" value="' + esc(b.owner || '') + '" required>') +
    fieldHTML('contact', 'Phone (10 digits)', '<input type="tel" name="contact" inputmode="numeric" maxlength="10" value="' + esc(b.contact || '') + '" placeholder="9811045210" required>') +
    '</div>';
  openModal(existing ? 'Edit borrow item' : 'Offer an item to lend', body, (fd) => {
    let ok = true;
    const item = String(fd.get('item') || '').trim(), owner = String(fd.get('owner') || '').trim();
    const contact = String(fd.get('contact') || '').replace(/\s/g, '');
    setErr('item', item ? '' : 'What can neighbours borrow?'); if (!item) ok = false;
    setErr('owner', owner ? '' : 'Who owns it?'); if (!owner) ok = false;
    setErr('contact', validPhone(contact) ? '' : 'Enter exactly 10 digits.'); if (!validPhone(contact)) ok = false;
    if (!ok) return false;
    rememberMe(owner);
    const d = { item, owner, contact };
    if (existing) updateBorrow(existing.id, d); else addBorrow(d);
    toast(existing ? 'Item updated' : 'Item offered'); render(); return true;
  }, existing ? 'Save' : 'Offer item');
}
function lfForm(existing){
  const f = existing || { status: 'lost', date: todayISO() };
  const body =
    fieldHTML('item', 'Item', '<input type="text" name="item" maxlength="80" value="' + esc(f.item || '') + '" placeholder="e.g. House keys with blue tag" required>') +
    '<div class="frow">' +
    fieldHTML('status', 'Lost or found?', '<select name="status"><option value="lost"' + (f.status === 'lost' ? ' selected' : '') + '>Lost</option><option value="found"' + (f.status === 'found' ? ' selected' : '') + '>Found</option></select>') +
    fieldHTML('date', 'Date', '<input type="date" name="date" value="' + esc(f.date || todayISO()) + '" required>') +
    '</div>' +
    fieldHTML('location', 'Location', '<input type="text" name="location" maxlength="80" value="' + esc(f.location || '') + '" placeholder="e.g. Near Gate B" required>') +
    fieldHTML('detail', 'Details', '<textarea name="detail" maxlength="400" placeholder="Identifying marks, when, reward…">' + esc(f.detail || '') + '</textarea>') +
    fieldHTML('contact', 'Contact (name + phone)', '<input type="text" name="contact" maxlength="60" value="' + esc(f.contact || '') + '" placeholder="e.g. Neha Kapoor · 9877041528" required>');
  openModal(existing ? 'Edit post' : 'Post lost / found', body, (fd) => {
    let ok = true;
    const item = String(fd.get('item') || '').trim(), location = String(fd.get('location') || '').trim();
    const contact = String(fd.get('contact') || '').trim(), date = String(fd.get('date') || '');
    setErr('item', item ? '' : 'What was lost or found?'); if (!item) ok = false;
    setErr('location', location ? '' : 'Where?'); if (!location) ok = false;
    setErr('contact', contact ? '' : 'How can someone reach you?'); if (!contact) ok = false;
    setErr('date', /^\d{4}-\d{2}-\d{2}$/.test(date) ? '' : 'Pick a date.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) ok = false;
    if (!ok) return false;
    const d = { item, status: String(fd.get('status')), location, date, detail: String(fd.get('detail') || ''), contact };
    if (existing) updateLostFound(existing.id, d); else addLostFound(d);
    toast(existing ? 'Post updated' : 'Posted on the board'); render(); return true;
  }, existing ? 'Save' : 'Post');
}
function rememberMe(name){
  if (name && !state.myName){ state.myName = name; saveAll(); }
}

/* ================= events ================= */
let wired = false;
function wireEvents(){
  if (wired) return; wired = true;
  $$('#tabs .tab').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  $('#search').addEventListener('input', e => { state.search = e.target.value; render(); });
  $('#btn-mine').addEventListener('click', () => {
    if (!state.myName){
      openModal('My postings', fieldHTML('myname', 'Your name (as used when posting)', '<input type="text" name="myname" maxlength="40" placeholder="e.g. Ramesh Gupta">'),
        fd => { const v = String(fd.get('myname') || '').trim(); setErr('myname', v ? '' : 'Enter your name.'); if (!v) return false;
          state.myName = v; state.mineOnly = true; saveAll(); syncMineBtn(); toast('Showing your postings'); render(); return true; }, 'Show mine');
      return;
    }
    state.mineOnly = !state.mineOnly; saveAll(); syncMineBtn(); render();
  });
  $('#view').addEventListener('click', onViewClick);
}
function syncMineBtn(){
  const b = $('#btn-mine');
  b.setAttribute('aria-pressed', state.mineOnly ? 'true' : 'false');
  b.textContent = state.mineOnly && state.myName ? 'Mine: ' + state.myName : 'My postings';
}
function onViewClick(e){
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  const finders = {
    notice: () => state.notices.find(x => x.id === id),
    listing: () => state.listings.find(x => x.id === id),
    borrow: () => state.borrows.find(x => x.id === id),
    lf: () => state.lostfound.find(x => x.id === id)
  };
  if (act === 'add-notice') noticeForm(null);
  else if (act === 'add-listing') listingForm(null);
  else if (act === 'add-borrow') borrowForm(null);
  else if (act === 'add-lf') lfForm(null);
  else if (act === 'notice-pin'){ togglePin(id); render(); }
  else if (act === 'notice-edit'){ const n = finders.notice(); if (n) noticeForm(n); }
  else if (act === 'notice-del'){ const n = finders.notice(); if (n) confirmDlg('Delete notice', 'Delete "' + n.title + '"?').then(ok => { if (ok){ deleteNotice(id); toast('Notice deleted'); render(); } }); }
  else if (act === 'listing-sold'){ setListingStatus(id, 'sold'); toast('Marked sold'); render(); }
  else if (act === 'listing-relist'){ setListingStatus(id, 'available'); toast('Listed again'); render(); }
  else if (act === 'listing-edit'){ const l = finders.listing(); if (l) listingForm(l); }
  else if (act === 'listing-del'){ const l = finders.listing(); if (l) confirmDlg('Delete listing', 'Delete "' + l.item + '"?').then(ok => { if (ok){ deleteListing(id); toast('Listing deleted'); render(); } }); }
  else if (act === 'borrow-lend'){
    const b = finders.borrow(); if (!b) return;
    openModal('Lend "' + b.item + '"',
      fieldHTML('borrower', 'Borrower name', '<input type="text" name="borrower" maxlength="40" placeholder="e.g. Lakshmi Venkat" required>') +
      fieldHTML('returnDate', 'Return by', '<input type="date" name="returnDate" value="' + todayISO() + '" required>'),
      fd => { const br = String(fd.get('borrower') || '').trim(), rd = String(fd.get('returnDate') || '');
        setErr('borrower', br ? '' : 'Who is borrowing it?'); if (!br) return false;
        setErr('returnDate', /^\d{4}-\d{2}-\d{2}$/.test(rd) ? '' : 'Pick a return date.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(rd)) return false;
        lendBorrow(id, br, rd); toast('Marked borrowed'); render(); return true; }, 'Mark borrowed');
  }
  else if (act === 'borrow-return'){ returnBorrow(id); toast('Marked returned'); render(); }
  else if (act === 'borrow-edit'){ const b = finders.borrow(); if (b) borrowForm(b); }
  else if (act === 'borrow-del'){ const b = finders.borrow(); if (b) confirmDlg('Delete item', 'Remove "' + b.item + '" from the board?').then(ok => { if (ok){ deleteBorrow(id); toast('Item removed'); render(); } }); }
  else if (act === 'lf-resolve'){ setResolved(id, true); toast('Marked resolved'); render(); }
  else if (act === 'lf-reopen'){ setResolved(id, false); toast('Reopened'); render(); }
  else if (act === 'lf-edit'){ const f = finders.lf(); if (f) lfForm(f); }
  else if (act === 'lf-del'){ const f = finders.lf(); if (f) confirmDlg('Delete post', 'Delete "' + f.item + '"?').then(ok => { if (ok){ deleteLostFound(id); toast('Post deleted'); render(); } }); }
}

/* ================= boot ================= */
function boot(){
  if (!localStorage.getItem(NS + 'seeded')){ seed(); localStorage.setItem(NS + 'seeded', '1'); }
  loadAll();
  wireEvents();
  syncMineBtn();
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
    t('seed notices', state.notices.length === 3);
    t('seed listings', state.listings.length === 4);
    t('seed borrows', state.borrows.length === 3);
    t('seed lostfound', state.lostfound.length === 3);
    // post notice
    const n = addNotice({ title: 'Test notice', body: 'Test body text', date: todayISO(), author: 'Tester', pinned: false });
    t('post notice', !!n && state.notices.length === 4);
    // post listing -> mark sold
    const l = addListing({ item: 'Test chair', price: 1500, description: 'Sturdy', contactName: 'Tester', contactPhone: '9000011111' });
    t('post listing', !!l && l.status === 'available' && state.listings.length === 5);
    setListingStatus(l.id, 'sold');
    t('mark sold', state.listings.find(x => x.id === l.id).status === 'sold');
    // borrow flow
    const b = addBorrow({ item: 'Test drill', owner: 'Tester', contact: '9000022222' });
    lendBorrow(b.id, 'Neighbour', todayISO());
    const bb = state.borrows.find(x => x.id === b.id);
    t('mark borrowed', bb.status === 'borrowed' && bb.borrower === 'Neighbour');
    returnBorrow(b.id);
    t('mark returned', state.borrows.find(x => x.id === b.id).status === 'available');
    // post lost item -> mark resolved
    const f = addLostFound({ item: 'Test keys', status: 'lost', location: 'Park', date: todayISO(), detail: 'Brass keychain', contact: 'Tester 9000033333' });
    t('post lost item', !!f && f.resolved === false && state.lostfound.length === 4);
    setResolved(f.id, true);
    t('mark resolved', state.lostfound.find(x => x.id === f.id).resolved === true);
    // persistence: re-read raw
    const rawN = JSON.parse(localStorage.getItem(NS + 'notices') || '[]');
    const rawL = JSON.parse(localStorage.getItem(NS + 'listings') || '[]');
    t('localStorage persist', rawN.length === 4 && rawL.some(x => x.id === l.id && x.status === 'sold'));
    // re-render all tabs
    ['notices','listings','borrow','lostfound'].forEach(tb => { state.tab = tb; render(); });
    t('re-render ok', document.getElementById('view').children.length > 0);
  } catch (err) {
    if (!res.fail) res.fail = 'exception: ' + (err && err.message);
  }
  // restore pristine seeded state so normal mode is untouched
  try { DB.wipe(); seed(); localStorage.setItem(NS + 'seeded', '1'); loadAll(); state.tab = 'notices'; wireEvents(); syncMineBtn(); render(); } catch (e) {}
  banner(res.pass, res.total, res.fail);
  return res;
}

if (new URLSearchParams(location.search).get('selftest') === '1'){
  document.addEventListener('DOMContentLoaded', () => { loadAll(); wireEvents(); syncMineBtn(); runSelftest(); });
} else {
  document.addEventListener('DOMContentLoaded', boot);
}
})();
