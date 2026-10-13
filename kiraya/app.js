'use strict';
/* =========================================================
   Kiraya — rent ledger for landlords.
   Vanilla JS. localStorage namespace: kr_v1_
   ========================================================= */

/* ---------------- utils ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DUE_DAY = 5; // rent due on the 5th of each month

function fmtINR(n){ return '₹' + Math.round(Number(n)||0).toLocaleString('en-IN'); }
function fmtDate(iso){
  if(!iso) return '—';
  const [y,m,d] = iso.split('-').map(Number);
  if(!y||!m||!d) return '—';
  return String(d).padStart(2,'0') + '-' + MONTHS[m-1] + '-' + y;
}
function fmtMonth(key){
  const [y,m] = key.split('-').map(Number);
  return MONTHS[m-1] + '-' + y;
}
function todayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function curMonthKey(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function addMonthKey(key, n){
  let [y,m] = key.split('-').map(Number);
  m += n;
  while(m > 12){ m -= 12; y++; }
  while(m < 1){ m += 12; y--; }
  return y + '-' + String(m).padStart(2,'0');
}
function monthKeysBetween(a, b){
  const out = []; let k = a;
  while(k <= b){ out.push(k); k = addMonthKey(k, 1); }
  return out;
}
function daysBetween(aISO, bISO){
  const a = new Date(aISO+'T00:00:00'), b = new Date(bISO+'T00:00:00');
  return Math.round((b - a) / 86400000);
}
function uid(p){ return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
const debounce = (fn,ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

/* ---------------- inline SVG icons (16px, stroke 1.8) ---------------- */
const I = (paths, vb) => `<svg viewBox="${vb||'0 0 24 24'}" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  plus:   I('<path d="M12 5v14M5 12h14"/>'),
  edit:   I('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  trash:  I('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>'),
  x:      I('<path d="M18 6 6 18M6 6l12 12"/>'),
  print:  I('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
  home:   I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
  users:  I('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  book:   I('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  ledger: I('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'),
  cash:   I('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'),
  alert:  I('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  check:  I('<path d="M20 6 9 17l-5-5"/>'),
  receipt:I('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>'),
  gear:  I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>'),
};

/* ---------------- store ---------------- */
const NS = 'kr_v1_';
const Store = {
  data: null,
  load(){
    try {
      const raw = localStorage.getItem(NS + 'data');
      this.data = raw ? JSON.parse(raw) : null;
    } catch(e){ this.data = null; }
    if(!this.data || !Array.isArray(this.data.tenants)){ this.initEmpty(); }
    return this.data;
  },
  /* Fresh start: empty store with the correct shape. Normal launch NEVER seeds. */
  initEmpty(){
    this.data = { seq:1, properties:[], tenants:[], payments:[] };
    localStorage.removeItem(NS + 'seeded');
    this.save();
  },
  save(){ localStorage.setItem(NS + 'data', JSON.stringify(this.data)); },
  wipe(){ Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k)); },
  nextReceiptNo(dateISO){
    const yr = String(dateISO).slice(0,4);
    const n = String(this.data.seq++).padStart(4,'0');
    return 'KR-' + yr + '-' + n;
  },
  seed(){
    const P1 = uid('p'), P2 = uid('p');
    const T1 = uid('t'), T2 = uid('t'), T3 = uid('t');
    const data = {
      seq: 1,
      properties: [
        { id:P1, name:'Sharma Niwas', address:'C-42, Green Park Extension, New Delhi 110016', type:'2BHK' },
        { id:P2, name:'Lajpat Nagar Shop 5', address:'Shop 5, Central Market, Lajpat Nagar II, New Delhi 110024', type:'Shop' },
      ],
      tenants: [
        { id:T1, name:'Rajesh Kumar', phone:'9811023456', propertyId:P1, rent:18000, deposit:36000, moveIn:'2025-04-01' },
        { id:T2, name:'Anil Verma',   phone:'9899012345', propertyId:P1, rent:16500, deposit:33000, moveIn:'2026-01-15' },
        { id:T3, name:'Meena Iyer',   phone:'9810087654', propertyId:P2, rent:25000, deposit:50000, moveIn:'2024-08-01' },
      ],
      payments: [],
    };
    this.data = data;
    const cur = curMonthKey();
    const pay = (tenantId, month, amount, date, mode) => {
      data.payments.push({ id:uid('pay'), tenantId, month, amount, date, mode, receiptNo:this.nextReceiptNo(date) });
    };
    // Rajesh: every month Apr-2025..Sep-2026 paid in full on the 4th; Oct-2026 left due
    monthKeysBetween('2025-04','2026-09').forEach((k,i) => {
      pay(T1, k, 18000, k + '-04', i % 2 ? 'Cash' : 'UPI');
    });
    // Anil: Jan..Jul-2026 paid; Aug partial 10,000; Sep & Oct due
    monthKeysBetween('2026-01','2026-07').forEach((k,i) => {
      pay(T2, k, 16500, k + '-05', i % 2 ? 'UPI' : 'Cash');
    });
    pay(T2, '2026-08', 10000, '2026-08-20', 'UPI');
    // Meena: every month Aug-2024..Oct-2026 paid in full on the 3rd
    monthKeysBetween('2024-08', cur < '2026-10' ? cur : '2026-10').forEach((k) => {
      if(k <= cur) pay(T3, k, 25000, k + '-03', 'UPI');
    });
    localStorage.setItem(NS + 'seeded', '1');
    this.save();
  }
};
const propById = id => Store.data.properties.find(p => p.id === id);
const tenantById = id => Store.data.tenants.find(t => t.id === id);

/* ---------------- business logic ---------------- */
const Biz = {
  schedule(tenantId){
    const t = tenantById(tenantId);
    if(!t) return [];
    const keys = monthKeysBetween(t.moveIn.slice(0,7), curMonthKey());
    return keys.map(k => {
      const pays = Store.data.payments
        .filter(p => p.tenantId === tenantId && p.month === k)
        .sort((a,b) => a.date < b.date ? -1 : 1);
      const paid = pays.reduce((s,p) => s + p.amount, 0);
      const status = paid >= t.rent - 0.001 ? 'paid' : (paid > 0 ? 'partial' : 'due');
      return { key:k, label:fmtMonth(k), due:t.rent, paid, balance:Math.max(0, t.rent - paid),
               status, dueDate:k + '-' + String(DUE_DAY).padStart(2,'0'), pays };
    });
  },
  outstanding(tenantId){
    const rows = this.schedule(tenantId);
    return { total: rows.reduce((s,r) => s + r.balance, 0), rows };
  },
  overdueRows(tenantId){
    const today = todayISO();
    return this.schedule(tenantId)
      .filter(r => r.status !== 'paid' && r.dueDate < today)
      .map(r => ({ ...r, daysOverdue: daysBetween(r.dueDate, today) }));
  },
  totalPaid(tenantId){
    return Store.data.payments.filter(p => p.tenantId === tenantId).reduce((s,p) => s + p.amount, 0);
  },
  totalDueThrough(tenantId, throughKey){
    const t = tenantById(tenantId);
    if(!t) return 0;
    const n = monthKeysBetween(t.moveIn.slice(0,7), throughKey || curMonthKey()).length;
    return n * t.rent;
  },
  fleet(){
    const cur = curMonthKey();
    const tenants = Store.data.tenants;
    const rentRoll = tenants.reduce((s,t) => s + t.rent, 0);
    const collected = Store.data.payments
      .filter(p => p.month === cur).reduce((s,p) => s + p.amount, 0);
    let outstanding = 0, defaulters = 0;
    tenants.forEach(t => {
      outstanding += this.outstanding(t.id).total;
      if(this.overdueRows(t.id).length) defaulters++;
    });
    const recent = [...Store.data.payments].sort((a,b) => b.date < a.date ? -1 : 1).slice(0,6);
    return { rentRoll, collected, outstanding, defaulters, recent, tenantCount: tenants.length,
             propCount: Store.data.properties.length };
  },
  recordPayment({ tenantId, month, amount, date, mode }){
    const t = tenantById(tenantId);
    if(!t) throw new Error('Tenant not found');
    amount = Number(amount);
    if(!(amount > 0)) throw new Error('Amount must be greater than zero');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Payment date is required');
    const row = this.schedule(tenantId).find(r => r.key === month);
    if(!row) throw new Error('That rent month is not in this tenant\u2019s schedule');
    if(amount > row.balance + 0.001) throw new Error('Amount exceeds the balance due for ' + row.label + ' (' + fmtINR(row.balance) + ')');
    const pay = { id:uid('pay'), tenantId, month, amount, date, mode, receiptNo: Store.nextReceiptNo(date) };
    Store.data.payments.push(pay);
    Store.save();
    return pay;
  },
  addTenant(d){
    d.name = String(d.name||'').trim();
    d.phone = String(d.phone||'').trim();
    if(d.name.length < 2) throw new Error('Tenant name is required');
    if(!/^\d{10}$/.test(d.phone)) throw new Error('Enter a 10-digit mobile number');
    if(!propById(d.propertyId)) throw new Error('Choose a property');
    d.rent = Number(d.rent); d.deposit = Number(d.deposit) || 0;
    if(!(d.rent > 0)) throw new Error('Monthly rent must be greater than zero');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.moveIn)) throw new Error('Move-in date is required');
    const t = { id:uid('t'), name:d.name, phone:d.phone, propertyId:d.propertyId,
                rent:d.rent, deposit:d.deposit, moveIn:d.moveIn };
    Store.data.tenants.push(t); Store.save();
    return t;
  },
  updateTenant(id, d){
    const t = tenantById(id); if(!t) throw new Error('Tenant not found');
    Object.assign(t, d); Store.save(); return t;
  },
  deleteTenant(id){
    Store.data.tenants = Store.data.tenants.filter(t => t.id !== id);
    Store.data.payments = Store.data.payments.filter(p => p.tenantId !== id);
    Store.save();
  },
  addProperty(d){
    d.name = String(d.name||'').trim(); d.address = String(d.address||'').trim();
    if(d.name.length < 2) throw new Error('Property name is required');
    const p = { id:uid('p'), name:d.name, address:d.address, type:d.type || '2BHK' };
    Store.data.properties.push(p); Store.save(); return p;
  },
  deleteProperty(id){
    if(Store.data.tenants.some(t => t.propertyId === id)) throw new Error('Cannot delete: tenants are still linked to this property');
    Store.data.properties = Store.data.properties.filter(p => p.id !== id);
    Store.save();
  }
};

/* ---------------- toast ---------------- */
function toast(msg, isErr){
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------------- modal ---------------- */
function openModal(title, bodyHTML, opts){
  opts = opts || {};
  closeModal();
  const root = $('#modal-root');
  const ov = document.createElement('div');
  ov.className = 'moverlay';
  ov.innerHTML =
    '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="modal-h"><h3>' + esc(title) + '</h3>' +
      '<button class="iconbtn" data-close aria-label="Close">' + ICONS.x + '</button></div>' +
      '<div class="modal-b">' + bodyHTML + '</div>' +
      (opts.footerHTML ? '<div class="modal-f">' + opts.footerHTML + '</div>' : '') +
    '</div>';
  ov.addEventListener('mousedown', e => { if(e.target === ov) closeModal(); });
  ov.querySelector('[data-close]').addEventListener('click', closeModal);
  root.appendChild(ov);
  const first = ov.querySelector('input,select,textarea');
  if(first) setTimeout(() => first.focus(), 60);
  return ov;
}
function closeModal(){ $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

function fieldHTML(name, label, o){
  o = o || {};
  const type = o.type || 'text', value = o.value == null ? '' : o.value;
  let input;
  if(o.options){
    input = '<select name="' + name + '"' + (o.required?' required':'') + '>' +
      o.options.map(op => '<option value="' + esc(op.value) + '"' + (String(op.value)===String(value)?' selected':'') + '>' + esc(op.label) + '</option>').join('') +
      '</select>';
  } else {
    input = '<input type="' + type + '" name="' + name + '" value="' + esc(value) + '"' + (o.required?' required':'') + '>';
  }
  return '<div class="field" data-field="' + name + '"><label>' + esc(label) + '</label>' + input +
    (o.hint ? '<div class="hint">' + esc(o.hint) + '</div>' : '') +
    '<div class="err"></div></div>';
}
function formError(form, name, msg){
  const f = form.querySelector('[data-field="' + name + '"]');
  if(!f) return;
  f.classList.add('invalid');
  f.querySelector('.err').textContent = msg;
}
function clearFormErrors(form){ form.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid')); }
function formData(form){
  const d = {};
  form.querySelectorAll('[name]').forEach(el => { d[el.name] = el.value; });
  return d;
}

/* ---------------- app shell ---------------- */
const state = { view:'overview', ledgerTenant:null, bookFilter:'all' };
const NAV = [
  { id:'overview', label:'Overview' },
  { id:'properties', label:'Properties' },
  { id:'tenants', label:'Tenants' },
  { id:'rentbook', label:'Rent Book' },
  { id:'ledger', label:'Ledger' },
  { id:'settings', label:'Settings' },
];
function pill(status){
  const map = { paid:'Paid', partial:'Partial', due:'Due' };
  return '<span class="pill ' + status + '">' + map[status] + '</span>';
}
function renderNav(){
  $('#mainnav').innerHTML = NAV.map(n =>
    '<button class="navbtn' + (state.view===n.id?' active':'') + '" data-view="' + n.id + '">' + n.label + '</button>'
  ).join('');
  $('#mainnav').querySelectorAll('.navbtn').forEach(b =>
    b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));
}
function render(){
  renderNav();
  const app = $('#app');
  const v = Views[state.view] || Views.overview;
  app.innerHTML = v();
  if(v.mount) v.mount(app);
  window.scrollTo(0,0);
}

/* ---------------- view: overview ---------------- */
function vOverview(){
  const f = Biz.fleet();
  const cur = curMonthKey();
  const dueThisMonth = [];
  Store.data.tenants.forEach(t => {
    const row = Biz.schedule(t.id).find(r => r.key === cur);
    if(row && row.status !== 'paid') dueThisMonth.push({ t, row });
  });
  const defaulterRows = [];
  Store.data.tenants.forEach(t => {
    const od = Biz.overdueRows(t.id);
    if(od.length){
      const tot = od.reduce((s,r) => s + r.balance, 0);
      const maxDays = Math.max(...od.map(r => r.daysOverdue));
      defaulterRows.push({ t, months:od.length, tot, maxDays });
    }
  });
  defaulterRows.sort((a,b) => b.tot - a.tot);

  let h = '<div class="pagehead"><div><h1>Overview</h1><p>Rent roll, collections and dues across your properties for ' + fmtMonth(cur) + '.</p></div>' +
    '<div class="toolbar"><button class="btn btn-gold" data-act="pay">' + ICONS.cash + 'Record payment</button></div></div>';

  h += '<div class="grid4">' +
    statCard('Monthly rent roll', fmtINR(f.rentRoll), f.tenantCount + ' tenants · ' + f.propCount + ' properties', 'accent-gold') +
    statCard('Collected · ' + fmtMonth(cur), fmtINR(f.collected), 'across all tenants', 'accent-green') +
    statCard('Total outstanding', fmtINR(f.outstanding), f.outstanding > 0 ? 'unpaid across months' : 'nothing pending — all clear', 'accent-red') +
    statCard('Defaulters', String(f.defaulters), f.defaulters ? 'tenants past due date' : 'no overdue tenants', 'accent-slate') +
  '</div>';

  if(!f.tenantCount){
    // first-run: no data at all — intentional empty state with CTAs
    h += '<div class="empty" style="margin-top:20px"><h3>Welcome to Kiraya</h3><p>Add your first property, then a tenant — Kiraya builds their monthly rent schedule automatically.</p>' +
      '<button class="btn btn-primary" data-act="add-prop">' + ICONS.plus + 'Add property</button></div>';
    return h;
  }

  h += '<div class="grid2" style="margin-top:20px">';
  // due this month
  h += '<div><div class="section-title">Due in ' + fmtMonth(cur) + '</div>';
  if(!dueThisMonth.length){
    h += '<div class="empty"><h3>All collected</h3><p>Every tenant has paid this month\u2019s rent.</p></div>';
  } else {
    h += '<div class="panel">' + dueThisMonth.map(({t,row}) => {
      const p = propById(t.propertyId);
      return '<div class="listrow"><div class="grow"><div class="who">' + esc(t.name) + '</div>' +
        '<div class="sub">' + esc(p ? p.name : '') + ' · ' + fmtINR(t.rent) + '/mo</div></div>' +
        '<div style="text-align:right"><div class="amt">' + fmtINR(row.balance) + '</div>' +
        '<div style="margin:4px 0">' + pill(row.status) + '</div>' +
        '<button class="btn btn-sm btn-ghost" data-pay-tenant="' + t.id + '" data-pay-month="' + row.key + '">Record</button></div></div>';
    }).join('') + '</div>';
  }
  h += '</div>';

  // defaulters
  h += '<div><div class="section-title">Overdue &amp; defaulters</div>';
  if(!defaulterRows.length){
    h += '<div class="empty"><h3>No defaulters</h3><p>Nobody is past their due date right now.</p></div>';
  } else {
    h += '<div class="panel">' + defaulterRows.map(({t,months,tot,maxDays}) =>
      '<div class="listrow"><div class="grow"><div class="who">' + esc(t.name) + '</div>' +
        '<div class="sub">' + months + ' month' + (months>1?'s':'') + ' unpaid · <span class="dueflag">' + maxDays + ' days overdue</span></div></div>' +
        '<div class="amt">' + fmtINR(tot) + '</div></div>'
    ).join('') + '</div>';
  }
  h += '</div></div>';

  // recent payments
  h += '<div class="section-title">Recent payments</div>';
  if(!f.recent.length){
    h += '<div class="empty"><h3>No payments yet</h3><p>Record the first rent payment to see it here.</p></div>';
  } else {
    h += '<div class="tscroll"><table class="ledger"><thead><tr>' +
      '<th>Date</th><th>Receipt</th><th>Tenant</th><th>Period</th><th>Mode</th><th class="num">Amount</th><th></th>' +
      '</tr></thead><tbody>' +
      f.recent.map(p => {
        const t = tenantById(p.tenantId);
        return '<tr><td>' + fmtDate(p.date) + '</td><td class="num">' + esc(p.receiptNo) + '</td>' +
          '<td><span class="who">' + esc(t ? t.name : '—') + '</span></td><td>' + fmtMonth(p.month) + '</td>' +
          '<td>' + esc(p.mode) + '</td><td class="num">' + fmtINR(p.amount) + '</td>' +
          '<td><button class="rcpt-link" data-receipt="' + p.id + '">Receipt</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  return h;
}
function statCard(k, v, s, accent){
  return '<div class="stat ' + accent + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>';
}
function mountCommon(root){
  root = root || document;
  root.querySelectorAll('[data-act="pay"]').forEach(b => b.addEventListener('click', () => openPaymentModal()));
  root.querySelectorAll('[data-act="add-prop"]').forEach(b => b.addEventListener('click', () => openPropertyModal()));
  root.querySelectorAll('[data-act="add-tenant"]').forEach(b => b.addEventListener('click', () => openTenantModal()));
  root.querySelectorAll('[data-pay-tenant]').forEach(b => b.addEventListener('click', () =>
    openPaymentModal(b.dataset.payTenant, b.dataset.payMonth)));
  root.querySelectorAll('[data-receipt]').forEach(b => b.addEventListener('click', () =>
    openReceiptModal(b.dataset.receipt)));
}

/* ---------------- view: properties ---------------- */
function vProperties(){
  let h = '<div class="pagehead"><div><h1>Properties</h1><p>Your rental properties. A property can only be deleted once it has no tenants.</p></div>' +
    '<div class="toolbar"><button class="btn btn-primary" data-act="add-prop">' + ICONS.plus + 'Add property</button></div></div>';
  const props = Store.data.properties;
  if(!props.length){
    h += '<div class="empty"><h3>No properties yet</h3><p>Add your first property to start tracking rent.</p><button class="btn btn-primary" data-act="add-prop">' + ICONS.plus + 'Add property</button></div>';
  } else {
    h += '<div class="grid3">' + props.map(p => {
      const ts = Store.data.tenants.filter(t => t.propertyId === p.id);
      const roll = ts.reduce((s,t) => s + t.rent, 0);
      return '<div class="panel prop-card"><div class="t">' + esc(p.name) + '<span class="tag">' + esc(p.type) + '</span></div>' +
        '<div class="addr">' + esc(p.address || '—') + '</div>' +
        '<div class="prop-meta">' +
          '<span class="m"><b>' + ts.length + '</b> tenant' + (ts.length===1?'':'s') + '</span>' +
          '<span class="m">rent roll <b>' + fmtINR(roll) + '</b>/mo</span>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn btn-sm btn-ghost" data-edit-prop="' + p.id + '">' + ICONS.edit + 'Edit</button>' +
          '<button class="btn btn-sm btn-danger-ghost" data-del-prop="' + p.id + '">' + ICONS.trash + 'Delete</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }
  return h;
}
function openPropertyModal(p){
  const isNew = !p;
  p = p || { name:'', address:'', type:'2BHK' };
  const types = ['1BHK','2BHK','3BHK','Shop','Office','Plot'];
  const ov = openModal(isNew ? 'Add property' : 'Edit property',
    '<form id="prop-form" novalidate>' +
    fieldHTML('name','Property name / label',{ value:p.name, required:true, hint:'e.g. Sharma Niwas, Lajpat Nagar Shop 5' }) +
    fieldHTML('address','Address',{ value:p.address }) +
    fieldHTML('type','Type',{ value:p.type, options:types.map(t => ({value:t,label:t})) }) +
    '</form>',
    { footerHTML:'<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save property</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  const form = ov.querySelector('#prop-form');
  ov.querySelector('[data-save]').addEventListener('click', () => {
    clearFormErrors(form);
    const d = formData(form);
    try{
      if(isNew) Biz.addProperty(d);
      else { Object.assign(propById(p.id), { name:d.name.trim(), address:d.address.trim(), type:d.type }); Store.save(); }
      closeModal(); render(); toast(isNew ? 'Property added' : 'Property updated');
    }catch(e){ formError(form, 'name', e.message); }
  });
}

/* ---------------- view: tenants ---------------- */
function vTenants(){
  let h = '<div class="pagehead"><div><h1>Tenants</h1><p>Everyone renting from you, with live balances.</p></div>' +
    '<div class="toolbar"><button class="btn btn-primary" data-act="add-tenant">' + ICONS.plus + 'Add tenant</button></div></div>';
  const ts = Store.data.tenants;
  if(!ts.length){
    h += '<div class="empty"><h3>No tenants yet</h3><p>Add a tenant and Kiraya builds their monthly rent schedule automatically.</p><button class="btn btn-primary" data-act="add-tenant">' + ICONS.plus + 'Add tenant</button></div>';
  } else {
    h += '<div class="tscroll"><table class="ledger"><thead><tr>' +
      '<th>Tenant</th><th>Phone</th><th>Property</th><th class="num">Rent/mo</th><th class="num">Deposit</th><th>Move-in</th><th class="num">Outstanding</th><th></th>' +
      '</tr></thead><tbody>' +
      ts.map(t => {
        const p = propById(t.propertyId);
        const out = Biz.outstanding(t.id).total;
        return '<tr><td><span class="who">' + esc(t.name) + '</span></td>' +
          '<td class="num">+91 ' + esc(t.phone) + '</td>' +
          '<td>' + esc(p ? p.name : '—') + '</td>' +
          '<td class="num">' + fmtINR(t.rent) + '</td>' +
          '<td class="num">' + fmtINR(t.deposit) + '</td>' +
          '<td>' + fmtDate(t.moveIn) + '</td>' +
          '<td class="num" style="color:' + (out>0?'var(--red)':'var(--green)') + ';font-weight:700">' + fmtINR(out) + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-sm btn-ghost" data-edit-tenant="' + t.id + '">Edit</button> ' +
            '<button class="iconbtn danger" data-del-tenant="' + t.id + '" aria-label="Delete ' + esc(t.name) + '">' + ICONS.trash + '</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  return h;
}
function openTenantModal(t){
  const isNew = !t;
  if(isNew && !Store.data.properties.length){ toast('Add a property first', true); return; }
  t = t || { name:'', phone:'', propertyId:Store.data.properties[0] ? Store.data.properties[0].id : '', rent:'', deposit:'', moveIn:todayISO() };
  const ov = openModal(isNew ? 'Add tenant' : 'Edit tenant',
    '<form id="tenant-form" novalidate><div class="formgrid">' +
    fieldHTML('name','Full name',{ value:t.name, required:true }) +
    fieldHTML('phone','Mobile number',{ value:t.phone, required:true, hint:'10 digits, no +91' }) +
    '</div><div class="formgrid">' +
    fieldHTML('propertyId','Property',{ value:t.propertyId, options:Store.data.properties.map(p => ({value:p.id,label:p.name})) }) +
    fieldHTML('rent','Monthly rent (₹)',{ type:'number', value:t.rent, required:true }) +
    '</div><div class="formgrid">' +
    fieldHTML('moveIn','Move-in date',{ type:'date', value:t.moveIn, required:true, hint:'Rent schedule is generated from this month' }) +
    fieldHTML('deposit','Security deposit (₹)',{ type:'number', value:t.deposit }) +
    '</div></form>',
    { footerHTML:'<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save tenant</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  const form = ov.querySelector('#tenant-form');
  ov.querySelector('[data-save]').addEventListener('click', () => {
    clearFormErrors(form);
    const d = formData(form);
    try{
      if(isNew) Biz.addTenant(d);
      else {
        d.name = d.name.trim();
        if(d.name.length < 2) throw new Error('Tenant name is required');
        if(!/^\d{10}$/.test(d.phone.trim())) throw new Error('Enter a 10-digit mobile number');
        d.rent = Number(d.rent); if(!(d.rent > 0)) throw new Error('Monthly rent must be greater than zero');
        Biz.updateTenant(t.id, { name:d.name, phone:d.phone.trim(), propertyId:d.propertyId,
          rent:d.rent, deposit:Number(d.deposit)||0, moveIn:d.moveIn });
      }
      closeModal(); render(); toast(isNew ? 'Tenant added — rent schedule generated' : 'Tenant updated');
    }catch(e){
      const msg = e.message;
      if(/phone/i.test(msg)) formError(form,'phone',msg);
      else if(/rent/i.test(msg)) formError(form,'rent',msg);
      else if(/property/i.test(msg)) formError(form,'propertyId',msg);
      else if(/move-in/i.test(msg)) formError(form,'moveIn',msg);
      else formError(form,'name',msg);
    }
  });
}

/* ---------------- view: rent book ---------------- */
function vRentBook(){
  const tenants = Store.data.tenants;
  // stale filter (e.g. tenant was deleted) falls back to "all"
  if(state.bookFilter !== 'all' && !tenants.some(t => t.id === state.bookFilter)) state.bookFilter = 'all';
  const opts = [{value:'all',label:'All tenants'}].concat(tenants.map(t => ({value:t.id,label:t.name})));
  let h = '<div class="pagehead"><div><h1>Rent Book</h1><p>Month-by-month rent schedule per tenant. Record full or partial payments against any month.</p></div>' +
    '<div class="toolbar"><label class="sr" for="book-filter" style="font-size:13px;font-weight:700;color:var(--muted)">Tenant</label>' +
    '<select class="inline" id="book-filter">' + opts.map(o =>
      '<option value="' + o.value + '"' + (state.bookFilter===o.value?' selected':'') + '>' + esc(o.label) + '</option>').join('') +
    '</select><button class="btn btn-gold" data-act="pay">' + ICONS.cash + 'Record payment</button></div></div>';
  const list = state.bookFilter === 'all' ? tenants : tenants.filter(t => t.id === state.bookFilter);
  if(!list.length){
    h += '<div class="empty"><h3>No tenants</h3><p>Add a tenant to generate a rent schedule.</p><button class="btn btn-primary" data-act="add-tenant">' + ICONS.plus + 'Add tenant</button></div>';
    return h;
  }
  list.forEach(t => {
    const rows = Biz.schedule(t.id).slice().reverse();
    const out = Biz.outstanding(t.id).total;
    const p = propById(t.propertyId);
    h += '<div class="tenant-block"><h3>' + esc(t.name) +
      '<span class="tag">' + esc(p ? p.name : '') + '</span>' +
      '<span class="bal">outstanding ' + fmtINR(out) + '</span></h3>';
    h += '<div class="tscroll"><table class="ledger"><thead><tr>' +
      '<th>Month</th><th>Due date</th><th class="num">Rent</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th>Receipts</th><th></th>' +
      '</tr></thead><tbody>' +
      rows.map(r =>
        '<tr><td><b>' + r.label + '</b></td><td>' + fmtDate(r.dueDate) + '</td>' +
        '<td class="num">' + fmtINR(r.due) + '</td><td class="num">' + fmtINR(r.paid) + '</td>' +
        '<td class="num">' + fmtINR(r.balance) + '</td><td>' + pill(r.status) + '</td>' +
        '<td>' + (r.pays.length
            ? r.pays.map(pp => '<button class="rcpt-link" data-receipt="' + pp.id + '">' + esc(pp.receiptNo) + '</button>').join('<br>')
            : '<span class="sub">—</span>') + '</td>' +
        '<td style="white-space:nowrap">' + (r.status !== 'paid'
            ? '<button class="btn btn-sm btn-ghost" data-pay-tenant="' + t.id + '" data-pay-month="' + r.key + '">Record</button>'
            : '') + '</td></tr>'
      ).join('') + '</tbody></table></div></div>';
  });
  return h;
}

/* ---------------- view: ledger ---------------- */
function vLedger(){
  const tenants = Store.data.tenants;
  if(!tenants.length){
    return '<div class="pagehead"><div><h1>Ledger</h1></div></div>' +
      '<div class="empty"><h3>No tenants</h3><p>Add a tenant to open their ledger.</p><button class="btn btn-primary" data-act="add-tenant">' + ICONS.plus + 'Add tenant</button></div>';
  }
  if(!state.ledgerTenant || !tenantById(state.ledgerTenant)) state.ledgerTenant = tenants[0].id;
  const t = tenantById(state.ledgerTenant);
  const cur = curMonthKey();
  const totalDue = Biz.totalDueThrough(t.id, cur);
  const totalPaid = Biz.totalPaid(t.id);
  const out = Biz.outstanding(t.id).total;
  const pays = Store.data.payments.filter(p => p.tenantId === t.id).sort((a,b) => a.date < b.date ? -1 : 1);

  let h = '<div class="pagehead"><div><h1>Ledger</h1><p>Complete payment history and running balance per tenant.</p></div>' +
    '<div class="toolbar"><label for="ledger-sel" style="font-size:13px;font-weight:700;color:var(--muted)">Tenant</label>' +
    '<select class="inline" id="ledger-sel">' + tenants.map(x =>
      '<option value="' + x.id + '"' + (x.id===t.id?' selected':'') + '>' + esc(x.name) + '</option>').join('') +
    '</select></div></div>';

  const p = propById(t.propertyId);
  h += '<div class="sumbar">' +
    '<div class="cell"><div class="k">Tenant</div><div class="v" style="font-size:17px;font-family:var(--font-body)">' + esc(t.name) + '</div></div>' +
    '<div class="cell"><div class="k">Property</div><div class="v" style="font-size:17px;font-family:var(--font-body)">' + esc(p ? p.name : '—') + '</div></div>' +
    '<div class="cell"><div class="k">Due till ' + fmtMonth(cur) + '</div><div class="v">' + fmtINR(totalDue) + '</div></div>' +
    '<div class="cell"><div class="k">Paid</div><div class="v pos">' + fmtINR(totalPaid) + '</div></div>' +
    '<div class="cell"><div class="k">Outstanding</div><div class="v ' + (out>0?'neg':'pos') + '">' + fmtINR(out) + '</div></div>' +
  '</div>';

  if(!pays.length){
    h += '<div class="empty"><h3>No payments recorded</h3><p>Record the first payment against this tenant\u2019s rent schedule.</p><button class="btn btn-gold" data-pay-tenant="' + t.id + '">' + ICONS.cash + 'Record payment</button></div>';
  } else {
    let runPaid = 0;
    h += '<div class="tscroll"><table class="ledger"><thead><tr>' +
      '<th>Date</th><th>Receipt no.</th><th>Rent month</th><th>Mode</th><th class="num">Received</th><th class="num">Balance after</th><th></th>' +
      '</tr></thead><tbody>' +
      pays.map(pp => {
        runPaid += pp.amount;
        const bal = Math.max(0, totalDue - runPaid);
        return '<tr><td>' + fmtDate(pp.date) + '</td><td class="num">' + esc(pp.receiptNo) + '</td>' +
          '<td>' + fmtMonth(pp.month) + '</td><td>' + esc(pp.mode) + '</td>' +
          '<td class="num">' + fmtINR(pp.amount) + '</td>' +
          '<td class="num" style="font-weight:700;color:' + (bal>0?'var(--red)':'var(--green)') + '">' + fmtINR(bal) + '</td>' +
          '<td><button class="rcpt-link" data-receipt="' + pp.id + '">Receipt</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  return h;
}

/* ---------------- payment modal ---------------- */
function openPaymentModal(presetTenantId, presetMonth){
  const tenants = Store.data.tenants;
  if(!tenants.length){ toast('Add a tenant first', true); return; }
  const tid = presetTenantId || tenants[0].id;
  const t = tenantById(tid);
  const rows = Biz.schedule(tid).filter(r => r.status !== 'paid');
  const monthOpts = rows.map(r => ({ value:r.key, label:r.label + ' — balance ' + fmtINR(r.balance) }));
  const body =
    '<form id="pay-form" novalidate>' +
    fieldHTML('tenantId','Tenant',{ value:tid, options:tenants.map(x => ({value:x.id,label:x.name + ' · ' + fmtINR(x.rent) + '/mo'})) }) +
    '<div id="pay-month-wrap">' + fieldHTML('month','Rent month',{ value:presetMonth || (monthOpts[0] ? monthOpts[0].value : ''), options:monthOpts }) + '</div>' +
    '<div class="formgrid">' +
    fieldHTML('amount','Amount (₹)',{ type:'number', value:'', required:true, hint:'Full or partial payment' }) +
    fieldHTML('date','Payment date',{ type:'date', value:todayISO(), required:true }) +
    '</div>' +
    fieldHTML('mode','Mode',{ value:'UPI', options:[{value:'UPI',label:'UPI'},{value:'Cash',label:'Cash'},{value:'Bank Transfer',label:'Bank Transfer'}] }) +
    '</form>';
  const ov = openModal('Record payment', body,
    { footerHTML:'<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-gold" data-save>' + ICONS.cash + 'Save &amp; receipt</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  const form = ov.querySelector('#pay-form');
  const tenantSel = form.querySelector('[name="tenantId"]');
  const refreshMonths = () => {
    const rows2 = Biz.schedule(tenantSel.value).filter(r => r.status !== 'paid');
    const sel = form.querySelector('[name="month"]');
    sel.innerHTML = rows2.map(r => '<option value="' + r.key + '">' + esc(r.label + ' — balance ' + fmtINR(r.balance)) + '</option>').join('') ||
      '<option value="">All months paid</option>';
  };
  tenantSel.addEventListener('change', refreshMonths);
  if(presetTenantId && presetMonth){
    const row = rows.find(r => r.key === presetMonth);
    if(row) form.querySelector('[name="amount"]').value = Math.round(row.balance);
  }
  ov.querySelector('[data-save]').addEventListener('click', () => {
    clearFormErrors(form);
    const d = formData(form);
    try{
      const pay = Biz.recordPayment(d);
      closeModal(); render();
      toast('Payment recorded — ' + pay.receiptNo);
      openReceiptModal(pay.id);
    }catch(e){
      const msg = e.message;
      if(/amount/i.test(msg)) formError(form,'amount',msg);
      else if(/date/i.test(msg)) formError(form,'date',msg);
      else if(/month|schedule/i.test(msg)) formError(form,'month',msg);
      else formError(form,'tenantId',msg);
    }
  });
}

/* ---------------- receipt ---------------- */
function receiptHTML(p){
  const t = tenantById(p.tenantId) || {};
  const prop = propById(t.propertyId) || {};
  return '<div class="receipt">' +
    '<div class="receipt-head"><div><div class="rn">Kiraya</div><div class="rs">Rent Receipt</div></div>' +
    '<div class="receipt-no">Receipt<br><b>' + esc(p.receiptNo) + '</b></div></div>' +
    '<div class="receipt-body">' +
    rrow('Received from', esc(t.name || '—')) +
    rrow('Property', esc(prop.name || '—') + (prop.address ? '<br><span style="font-weight:400;color:var(--muted);font-size:12.5px">' + esc(prop.address) + '</span>' : '')) +
    rrow('Rent period', fmtMonth(p.month)) +
    rrow('Payment date', fmtDate(p.date)) +
    rrow('Mode', esc(p.mode)) +
    '<div class="rtotal"><span class="k">Amount received</span><span class="v">' + fmtINR(p.amount) + '</span></div>' +
    '<div class="rsign"><div class="sig">Tenant signature</div><div class="sig">Landlord signature</div></div>' +
    '</div></div>';
}
function rrow(k, v){ return '<div class="rrow"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
function openReceiptModal(paymentId){
  const p = Store.data.payments.find(x => x.id === paymentId);
  if(!p){ toast('Receipt not found', true); return; }
  const ov = openModal('Receipt ' + p.receiptNo, receiptHTML(p), { wide:true,
    footerHTML:'<button class="btn btn-ghost" data-close2>Close</button><button class="btn btn-primary" data-print>' + ICONS.print + 'Print</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  ov.querySelector('[data-print]').addEventListener('click', () => printReceipt(p));
}
function printReceipt(p){
  const t = tenantById(p.tenantId) || {};
  const prop = propById(t.propertyId) || {};
  $('#print-area').innerHTML =
    '<div class="preceipt">' +
    '<h1>Kiraya</h1><div class="sub">Rent Receipt</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:13px"><span>Receipt no. <b>' + esc(p.receiptNo) + '</b></span><span>Date: <b>' + fmtDate(p.date) + '</b></span></div>' +
    '<table>' +
    '<tr><td class="k">Received from</td><td>' + esc(t.name || '—') + '</td></tr>' +
    '<tr><td class="k">Property</td><td>' + esc(prop.name || '—') + (prop.address ? '<br>' + esc(prop.address) : '') + '</td></tr>' +
    '<tr><td class="k">Rent period</td><td>' + fmtMonth(p.month) + '</td></tr>' +
    '<tr><td class="k">Mode of payment</td><td>' + esc(p.mode) + '</td></tr>' +
    '<tr class="total"><td class="k">Amount received</td><td>' + fmtINR(p.amount) + '</td></tr>' +
    '</table>' +
    '<div class="sig"><div>Tenant signature</div><div>Landlord signature</div></div>' +
    '</div>';
  window.print();
}

/* ---------------- view: settings ---------------- */
function vSettings(){
  const d = Store.data;
  const counts = [
    ['Properties', d.properties.length], ['Tenants', d.tenants.length],
    ['Payments', d.payments.length],
  ];
  let h = '<div class="pagehead"><div><h1>Settings</h1><p>Data management. Everything is stored privately in this browser — nothing leaves your device.</p></div></div>';
  h += '<div class="panel" style="margin-bottom:18px"><div class="panel-h"><h2>Your data</h2></div><div class="panel-b">' +
    '<div class="prop-meta">' + counts.map(c => '<span class="m"><b>' + c[1] + '</b> ' + c[0].toLowerCase() + '</span>').join('') + '</div>' +
    '<p class="sub" style="margin:10px 0 0">Stored in this browser\u2019s localStorage under <b style="font-family:var(--font-num)">' + esc(NS + 'data') + '</b>. Clearing browser data will remove it.</p>' +
    '</div></div>';
  h += '<div class="panel" style="margin-bottom:18px"><div class="panel-h"><h2>Sample data</h2></div><div class="panel-b">' +
    '<p class="sub" style="margin:0 0 14px">Explore Kiraya with a demo portfolio — two properties, three tenants and a full payment history.</p>' +
    '<button class="btn btn-primary" data-act="load-sample">' + ICONS.plus + 'Load sample data</button>' +
    '</div></div>';
  h += '<div class="panel"><div class="panel-h"><h2 style="color:var(--red)">Danger zone</h2></div><div class="panel-b">' +
    '<p class="sub" style="margin:0 0 14px">Delete everything and start fresh. This cannot be undone.</p>' +
    '<button class="btn btn-danger-ghost" data-act="clear-data">' + ICONS.trash + 'Clear all data</button>' +
    '</div></div>';
  return h;
}

/* ---------------- views registry + global mounts ---------------- */
const Views = {
  overview:  Object.assign(vOverview,  { mount: mountCommon }),
  properties:Object.assign(vProperties,{ mount(root){
    root.querySelectorAll('[data-act="add-prop"]').forEach(b => b.addEventListener('click', () => openPropertyModal()));
    root.querySelectorAll('[data-edit-prop]').forEach(b => b.addEventListener('click', () => openPropertyModal(propById(b.dataset.editProp))));
    root.querySelectorAll('[data-del-prop]').forEach(b => b.addEventListener('click', () => {
      const p = propById(b.dataset.delProp);
      if(!p) return;
      if(!confirm('Delete property "' + p.name + '"?')) return;
      try{ Biz.deleteProperty(p.id); render(); toast('Property deleted'); }
      catch(e){ toast(e.message, true); }
    }));
  }}),
  tenants:   Object.assign(vTenants,   { mount(root){
    root.querySelectorAll('[data-act="add-tenant"]').forEach(b => b.addEventListener('click', () => openTenantModal()));
    root.querySelectorAll('[data-edit-tenant]').forEach(b => b.addEventListener('click', () => openTenantModal(tenantById(b.dataset.editTenant))));
    root.querySelectorAll('[data-del-tenant]').forEach(b => b.addEventListener('click', () => {
      const t = tenantById(b.dataset.delTenant);
      if(!t) return;
      if(!confirm('Delete tenant "' + t.name + '" and all their payment records?')) return;
      Biz.deleteTenant(t.id); render(); toast('Tenant deleted');
    }));
  }}),
  rentbook:  Object.assign(vRentBook,  { mount(root){
    mountCommon(root);
    const sel = root.querySelector('#book-filter');
    if(sel) sel.addEventListener('change', () => { state.bookFilter = sel.value; render(); });
  }}),
  ledger:    Object.assign(vLedger,    { mount(root){
    mountCommon(root);
    const sel = root.querySelector('#ledger-sel');
    if(sel) sel.addEventListener('change', () => { state.ledgerTenant = sel.value; render(); });
  }}),
  settings:  Object.assign(vSettings,  { mount(root){
    root.querySelectorAll('[data-act="load-sample"]').forEach(b => b.addEventListener('click', () => {
      const d = Store.data;
      const has = d.properties.length || d.tenants.length || d.payments.length;
      if(has && !confirm('Replace your current data with sample data?')) return;
      Store.seed(); state.ledgerTenant = null; state.bookFilter = 'all'; render(); toast('Sample data loaded');
    }));
    root.querySelectorAll('[data-act="clear-data"]').forEach(b => b.addEventListener('click', () => {
      if(!confirm('Delete ALL data and start fresh? This cannot be undone.')) return;
      Store.wipe(); Store.load(); state.ledgerTenant = null; state.bookFilter = 'all'; render(); toast('All data cleared — starting fresh');
    }));
  }}),
};
function mountOverviewExtra(){
  // wire overview-specific buttons that live outside mountCommon
}
Views.overview.mount = function(root){ mountCommon(root); };

/* ---------------- selftest ---------------- */
function runSelfTest(){
  const results = [];
  const t = (name, cond, detail) => results.push({ name, ok:!!cond, detail:detail || '' });
  const banner = $('#selftest-banner');
  try{
    Store.wipe();
    t('namespace wiped', Object.keys(localStorage).filter(k => k.startsWith(NS)).length === 0);
    Store.seed();
    t('seeded flag set', localStorage.getItem(NS + 'seeded') === '1');
    t('seeded 2 properties', Store.data.properties.length === 2, 'got ' + Store.data.properties.length);
    t('seeded 3 tenants', Store.data.tenants.length === 3, 'got ' + Store.data.tenants.length);
    t('seeded payments exist', Store.data.payments.length > 10, 'got ' + Store.data.payments.length);

    // add tenant -> schedule
    const prop = Store.data.properties[0];
    const nt = Biz.addTenant({ name:'Selftest Tenant', phone:'9876543210', propertyId:prop.id, rent:12000, deposit:24000, moveIn:'2026-09-01' });
    t('tenant added', !!nt && !!nt.id);
    const sched = Biz.schedule(nt.id);
    const cur = curMonthKey();
    t('schedule generated incl current month', sched.length >= 2 && sched.some(r => r.key === cur),
      'rows=' + sched.length);
    const sepRow = sched.find(r => r.key === '2026-09');
    t('past month marked due', sepRow && sepRow.status === 'due' && sepRow.balance === 12000,
      sepRow ? sepRow.status + '/' + sepRow.balance : 'missing');

    // record partial payment -> outstanding math
    const pay = Biz.recordPayment({ tenantId:nt.id, month:cur, amount:5000, date:todayISO(), mode:'UPI' });
    t('payment recorded with receipt', !!pay && /^KR-\d{4}-\d{4}$/.test(pay.receiptNo), pay && pay.receiptNo);
    const out = Biz.outstanding(nt.id);
    // Sep full due (12000) + Oct partial (12000-5000=7000) = 19000
    t('outstanding math correct', out.total === 19000, 'expected 19000, got ' + out.total);
    const row = Biz.schedule(nt.id).find(r => r.key === cur);
    t('partial status set', row && row.status === 'partial' && row.paid === 5000);

    // receipt data integrity
    const found = Store.data.payments.find(p => p.id === pay.id);
    t('receipt data stored', found && found.receiptNo === pay.receiptNo && found.mode === 'UPI' && found.amount === 5000);

    // persistence: re-read raw from localStorage
    const raw = localStorage.getItem(NS + 'data');
    const parsed = JSON.parse(raw);
    t('persists tenant + payment', parsed.tenants.some(x => x.id === nt.id) && parsed.payments.some(x => x.id === pay.id));
    t('receipt seq persisted', parsed.seq === Store.data.seq);

    // re-render proves UI works off store
    state.view = 'rentbook'; state.bookFilter = nt.id; render();
    const html = document.getElementById('app').innerHTML;
    t('re-render shows tenant + receipt', html.includes('Selftest Tenant') && html.includes(pay.receiptNo));
  }catch(e){
    results.push({ name:'exception: ' + (e && e.message), ok:false, detail:String(e && e.stack).split('\n').slice(0,2).join(' ') });
  }
  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok);
  const title = fail.length
    ? 'SELFTEST FAIL: ' + fail.map(f => f.name).join('; ')
    : 'SELFTEST PASS ' + pass + '/' + results.length;
  document.title = title;
  banner.hidden = false;
  banner.className = fail.length ? 'fail' : 'pass';
  banner.innerHTML = '<b>' + esc(title) + '</b><ul>' +
    results.map(r => '<li class="' + (r.ok?'ok':'bad') + '">' + (r.ok?'PASS':'FAIL') + ' — ' + esc(r.name) + (r.detail ? ' <span style="opacity:.75">(' + esc(r.detail) + ')</span>' : '') + '</li>').join('') +
    '</ul>';
  // leave app in a clean, empty state so normal mode starts fresh
  try{ Store.wipe(); state.view = 'overview'; state.bookFilter = 'all'; }catch(e){}
  return { pass, total:results.length, fail:fail.length };
}

/* ---------------- init ---------------- */
(function init(){
  const qs = new URLSearchParams(location.search);
  if(qs.get('selftest') === '1'){
    document.addEventListener('DOMContentLoaded', runSelfTest);
    return;
  }
  Store.load();
  document.addEventListener('DOMContentLoaded', render);
})();
