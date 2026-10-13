'use strict';
/* =========================================================
   MotoLog — vehicle companion (fuel, service, documents).
   Vanilla JS. localStorage namespace: ml_v1_
   ========================================================= */

/* ---------------- utils ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtINR(n){ return '₹' + Math.round(Number(n)||0).toLocaleString('en-IN'); }
function fmtNum(n, d){ return Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:d||0, maximumFractionDigits:d||0 }); }
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
function daysBetween(aISO, bISO){
  const a = new Date(aISO+'T00:00:00'), b = new Date(bISO+'T00:00:00');
  return Math.round((b - a) / 86400000);
}
function uid(p){ return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

/* ---------------- inline SVG icons (16px, stroke 1.8) ---------------- */
const I = paths => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  plus:  I('<path d="M12 5v14M5 12h14"/>'),
  edit:  I('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  trash: I('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>'),
  x:     I('<path d="M18 6 6 18M6 6l12 12"/>'),
  fuel:  I('<path d="M5 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M3 21h14M15 9h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9.8a2 2 0 0 0-.6-1.4L20 7"/><path d="M7 8h6v4H7z"/>'),
  wrench:I('<path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7z"/>'),
  doc:   I('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>'),
  alert: I('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};

/* ---------------- store ---------------- */
const NS = 'ml_v1_';
const DOC_KINDS = ['RC','Insurance','PUC'];
const Store = {
  data: null,
  load(){
    try {
      const raw = localStorage.getItem(NS + 'data');
      this.data = raw ? JSON.parse(raw) : null;
    } catch(e){ this.data = null; }
    if(!this.data || !Array.isArray(this.data.vehicles)){ this.seed(); }
    return this.data;
  },
  save(){ localStorage.setItem(NS + 'data', JSON.stringify(this.data)); },
  wipe(){ Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k)); },
  seed(){
    const V1 = uid('v'), V2 = uid('v');
    const data = {
      vehicles: [
        { id:V1, nickname:'Daily Runner', type:'bike', reg:'DL 8C AB 1234', make:'Honda', model:'SP 125', purchaseDate:'2023-05-20' },
        { id:V2, nickname:'Family Swift', type:'car', reg:'HR 26 DK 5678', make:'Maruti Suzuki', model:'Swift VXi', purchaseDate:'2022-11-02' },
      ],
      documents: [
        { id:uid('d'), vehicleId:V1, kind:'RC', expiry:'2038-05-19' },
        { id:uid('d'), vehicleId:V1, kind:'Insurance', expiry:'2026-10-28' }, // due in 15 days
        { id:uid('d'), vehicleId:V1, kind:'PUC', expiry:'2026-09-10' },       // expired 33 days ago
        { id:uid('d'), vehicleId:V2, kind:'RC', expiry:'2037-11-01' },
        { id:uid('d'), vehicleId:V2, kind:'Insurance', expiry:'2027-01-15' },
        { id:uid('d'), vehicleId:V2, kind:'PUC', expiry:'2026-11-20' },       // due in 38 days -> ok
      ],
      fuel: [],
      services: [],
    };
    const fill = (vehicleId, date, odo, litres, amount) =>
      data.fuel.push({ id:uid('f'), vehicleId, date, odo, litres, amount });
    // Bike fills (Sep-Oct 2026), ~55 km/l
    fill(V1,'2026-09-02', 21480, 5.2, 548);
    fill(V1,'2026-09-11', 21766, 5.1, 537);
    fill(V1,'2026-09-20', 22047, 5.0, 527);
    fill(V1,'2026-09-29', 22331, 5.3, 559);
    fill(V1,'2026-10-07', 22618, 5.2, 548);
    fill(V1,'2026-10-12', 22896, 5.1, 538);
    // Car fills, ~17 km/l
    fill(V2,'2026-09-05', 41200, 28.5, 2850);
    fill(V2,'2026-09-18', 41685, 28.0, 2805);
    fill(V2,'2026-10-01', 42162, 27.8, 2786);
    fill(V2,'2026-10-11', 42640, 28.2, 2828);
    data.services = [
      { id:uid('s'), vehicleId:V1, date:'2026-09-15', type:'General service', odo:21950, cost:1850,
        notes:'Engine oil, air filter, chain lube. Next service due ~24,500 km.' },
      { id:uid('s'), vehicleId:V2, date:'2026-08-22', type:'Annual service', odo:40800, cost:6200,
        notes:'Oil + filters, brake pads front, wheel alignment.' },
    ];
    this.data = data;
    localStorage.setItem(NS + 'seeded', '1');
    this.save();
  }
};
const vehicleById = id => Store.data.vehicles.find(v => v.id === id);

/* ---------------- business logic ---------------- */
const Biz = {
  /* --- documents --- */
  docStatus(expiry){
    const days = daysBetween(todayISO(), expiry);
    if(days < 0) return { cls:'bad',  label:'Expired', sub: Math.abs(days) + 'd ago', days };
    if(days <= 30) return { cls:'warn', label:'Due soon', sub: 'in ' + days + 'd', days };
    return { cls:'ok', label:'Valid', sub: days + 'd left', days };
  },
  vehicleDocs(vehicleId){
    return Store.data.documents
      .filter(d => d.vehicleId === vehicleId)
      .map(d => ({ ...d, st: this.docStatus(d.expiry) }))
      .sort((a,b) => a.st.days - b.st.days);
  },
  worstDoc(vehicleId){
    const docs = this.vehicleDocs(vehicleId);
    if(!docs.length) return { cls:'warn', label:'No docs', sub:'add RC / insurance / PUC' };
    const rank = { bad:0, warn:1, ok:2 };
    return docs.slice().sort((a,b) => rank[a.st.cls] - rank[b.st.cls])[0].st;
  },

  /* --- fuel --- */
  fillsAsc(vehicleId){
    return Store.data.fuel
      .filter(f => f.vehicleId === vehicleId)
      .sort((a,b) => a.odo - b.odo);
  },
  maxOdo(vehicleId){
    const fills = this.fillsAsc(vehicleId);
    const svcs = Store.data.services.filter(s => s.vehicleId === vehicleId);
    let m = 0;
    fills.forEach(f => { if(f.odo > m) m = f.odo; });
    svcs.forEach(s => { if(s.odo > m) m = s.odo; });
    return m;
  },
  fuelStats(vehicleId){
    const fills = this.fillsAsc(vehicleId);
    const rows = [];
    let dist = 0, litres = 0;
    fills.forEach((f, i) => {
      let kml = null;
      if(i > 0){
        const d = f.odo - fills[i-1].odo;
        kml = f.litres > 0 ? d / f.litres : null;
        dist += d; litres += f.litres;
      }
      rows.push({ ...f, kml });
    });
    const avg = litres > 0 ? dist / litres : null;
    const spend = fills.reduce((s,f) => s + f.amount, 0);
    const lifetimeKm = fills.length > 1 ? fills[fills.length-1].odo - fills[0].odo : 0;
    return { rowsAsc:rows, rowsDesc:rows.slice().reverse(), avg, spend, lifetimeKm, count:fills.length };
  },
  addFill(d){
    const v = vehicleById(d.vehicleId);
    if(!v) throw new Error('Vehicle not found');
    d.odo = Number(d.odo); d.litres = Number(d.litres); d.amount = Number(d.amount);
    if(!(d.odo > 0)) throw new Error('Odometer reading must be greater than zero');
    if(!(d.litres > 0)) throw new Error('Litres must be greater than zero');
    if(!(d.amount > 0)) throw new Error('Amount must be greater than zero');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error('Date is required');
    const max = this.maxOdo(d.vehicleId);
    if(d.odo <= max) throw new Error('Odometer must be greater than the last reading (' + fmtNum(max) + ' km)');
    const f = { id:uid('f'), vehicleId:d.vehicleId, date:d.date, odo:d.odo, litres:d.litres, amount:d.amount };
    Store.data.fuel.push(f); Store.save();
    return f;
  },
  deleteFill(id){
    Store.data.fuel = Store.data.fuel.filter(f => f.id !== id);
    Store.save();
  },

  /* --- service --- */
  serviceStats(vehicleId){
    const rows = Store.data.services
      .filter(s => s.vehicleId === vehicleId)
      .sort((a,b) => b.date < a.date ? -1 : 1);
    return { rows, spend: rows.reduce((s,r) => s + r.cost, 0), count: rows.length };
  },
  addService(d){
    const v = vehicleById(d.vehicleId);
    if(!v) throw new Error('Vehicle not found');
    d.odo = Number(d.odo); d.cost = Number(d.cost);
    if(!(d.cost >= 0)) throw new Error('Cost cannot be negative');
    if(!(d.odo > 0)) throw new Error('Odometer reading must be greater than zero');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error('Date is required');
    if(!String(d.type||'').trim()) throw new Error('Service type is required');
    const s = { id:uid('s'), vehicleId:d.vehicleId, date:d.date, type:String(d.type).trim(),
                odo:d.odo, cost:d.cost, notes:String(d.notes||'').trim() };
    Store.data.services.push(s); Store.save();
    return s;
  },
  deleteService(id){
    Store.data.services = Store.data.services.filter(s => s.id !== id);
    Store.save();
  },

  /* --- documents CRUD --- */
  addDoc(d){
    const v = vehicleById(d.vehicleId);
    if(!v) throw new Error('Vehicle not found');
    if(!DOC_KINDS.includes(d.kind)) throw new Error('Choose a document type');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.expiry)) throw new Error('Expiry date is required');
    if(Store.data.documents.some(x => x.vehicleId === d.vehicleId && x.kind === d.kind))
      throw new Error(d.kind + ' already exists for this vehicle — edit it instead');
    const doc = { id:uid('d'), vehicleId:d.vehicleId, kind:d.kind, expiry:d.expiry };
    Store.data.documents.push(doc); Store.save();
    return doc;
  },
  updateDoc(id, d){
    const doc = Store.data.documents.find(x => x.id === id);
    if(!doc) throw new Error('Document not found');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.expiry)) throw new Error('Expiry date is required');
    doc.expiry = d.expiry; Store.save(); return doc;
  },
  deleteDoc(id){
    Store.data.documents = Store.data.documents.filter(x => x.id !== id);
    Store.save();
  },

  /* --- vehicles CRUD --- */
  addVehicle(d){
    d.nickname = String(d.nickname||'').trim();
    d.reg = String(d.reg||'').trim().toUpperCase();
    if(d.nickname.length < 2) throw new Error('Nickname is required');
    if(!/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{1,4}$/.test(d.reg))
      throw new Error('Registration must look like DL 8C AB 1234');
    if(!['bike','car'].includes(d.type)) throw new Error('Choose bike or car');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.purchaseDate)) throw new Error('Purchase date is required');
    const v = { id:uid('v'), nickname:d.nickname, type:d.type, reg:d.reg,
                make:String(d.make||'').trim(), model:String(d.model||'').trim(), purchaseDate:d.purchaseDate };
    Store.data.vehicles.push(v); Store.save();
    return v;
  },
  updateVehicle(id, d){
    const v = vehicleById(id); if(!v) throw new Error('Vehicle not found');
    Object.assign(v, d); Store.save(); return v;
  },
  deleteVehicle(id){
    Store.data.vehicles = Store.data.vehicles.filter(v => v.id !== id);
    Store.data.documents = Store.data.documents.filter(x => x.vehicleId !== id);
    Store.data.fuel = Store.data.fuel.filter(x => x.vehicleId !== id);
    Store.data.services = Store.data.services.filter(x => x.vehicleId !== id);
    Store.save();
  },

  /* --- dashboard --- */
  card(vehicleId){
    const v = vehicleById(vehicleId);
    const fs = this.fuelStats(vehicleId);
    const ss = this.serviceStats(vehicleId);
    const worst = this.worstDoc(vehicleId);
    return { v, avg:fs.avg, lifetimeKm:fs.lifetimeKm, fuelSpend:fs.spend,
             serviceSpend:ss.spend, totalSpend:fs.spend + ss.spend, worst,
             docs:this.vehicleDocs(vehicleId) };
  },
  fleet(){
    let fuelSpend = 0, serviceSpend = 0, alerts = 0;
    Store.data.vehicles.forEach(v => {
      fuelSpend += this.fuelStats(v.id).spend;
      serviceSpend += this.serviceStats(v.id).spend;
      this.vehicleDocs(v.id).forEach(d => { if(d.st.cls !== 'ok') alerts++; });
    });
    return { fuelSpend, serviceSpend, total:fuelSpend + serviceSpend, alerts,
             count: Store.data.vehicles.length };
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
    input = '<input type="' + type + '" name="' + name + '" value="' + esc(value) + '"' + (o.required?' required':'') + (o.step ? ' step="' + o.step + '"' : '') + '>';
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
const state = { view:'dashboard', vehicleTab:'all' };
const NAV = [
  { id:'dashboard', label:'Dashboard' },
  { id:'vehicles',  label:'Vehicles' },
  { id:'documents', label:'Documents' },
  { id:'fuel',      label:'Fuel Log' },
  { id:'service',   label:'Service' },
];
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
  const v = Views[state.view] || Views.dashboard;
  app.innerHTML = v();
  if(v.mount) v.mount(app);
  window.scrollTo(0,0);
}

/* ---------------- gauge (SVG arc) ---------------- */
function gaugeSVG(value, max){
  const w = 150, h = 92, cx = 75, cy = 80, r = 58;
  const frac = value == null ? 0 : Math.min(1, Math.max(0, value / max));
  const pt = a => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [sx, sy] = pt(Math.PI), [ex, ey] = pt(0);
  const [vx, vy] = pt(Math.PI * (1 - frac));
  const arc = (x1,y1,x2,y2) => 'M ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A ' + r + ' ' + r + ' 0 0 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
  let ticks = '';
  for(let i = 0; i <= 4; i++){
    const a = Math.PI * (1 - i/4);
    const [x1,y1] = pt(a), [x2,y2] = [cx + (r-8)*Math.cos(a), cy - (r-8)*Math.sin(a)];
    ticks += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#3a414b" stroke-width="2"/>';
  }
  const col = value == null ? '#3a414b' : (frac < 0.35 ? '#e8a13a' : '#35b26f');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="150" height="92" role="img" aria-label="Mileage gauge">' +
    '<path d="' + arc(sx,sy,ex,ey) + '" fill="none" stroke="#2c313a" stroke-width="10" stroke-linecap="round"/>' +
    (frac > 0.005 ? '<path d="' + arc(sx,sy,vx,vy) + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round"/>' : '') +
    ticks +
    '<text x="' + (cx - r) + '" y="' + (cy + 2) + '" text-anchor="middle" fill="#8b939e" font-size="9">0</text>' +
    '<text x="' + (cx + r) + '" y="' + (cy + 2) + '" text-anchor="middle" fill="#8b939e" font-size="9">' + max + '</text>' +
  '</svg>';
}
function docChip(d){
  return '<span class="doc ' + d.st.cls + '"><span class="dot"></span>' + esc(d.kind) +
    '<span class="d">' + esc(d.st.label) + ' · ' + esc(d.st.sub) + '</span></span>';
}

/* ---------------- view: dashboard ---------------- */
function vDashboard(){
  const f = Biz.fleet();
  const vs = Store.data.vehicles;
  let h = '<div class="pagehead"><div><h1>Dashboard</h1><p>Fleet health at a glance — documents, mileage and spend per vehicle.</p></div>' +
    '<div class="toolbar"><button class="btn btn-primary" data-act="add-vehicle">' + ICONS.plus + 'Add vehicle</button></div></div>';
  h += '<div class="strip">' +
    meterCard('Vehicles', String(f.count), '') +
    meterCard('Document alerts', String(f.alerts), f.alerts ? 'expired / due soon' : 'all valid') +
    meterCard('Fuel spend', fmtINR(f.fuelSpend), 'lifetime') +
    meterCard('Total spend', fmtINR(f.total), 'fuel + service') +
  '</div>';
  if(!vs.length){
    h += '<div class="empty"><h3>No vehicles</h3><p>Add your first vehicle to start logging fuel and tracking documents.</p></div>';
    return h;
  }
  h += '<div class="grid2">' + vs.map(v => {
    const c = Biz.card(v.id);
    const maxG = v.type === 'bike' ? 60 : 30;
    return '<div class="vcard">' +
      '<div class="vcard-top"><div><div class="nm">' + esc(v.nickname) + '</div>' +
        '<div class="reg">' + esc(v.reg) + '</div>' +
        '<div class="mk">' + esc([v.make, v.model].filter(Boolean).join(' ')) + ' · ' + (v.type === 'bike' ? 'Bike' : 'Car') + '</div></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="iconbtn" data-edit-vehicle="' + v.id + '" aria-label="Edit ' + esc(v.nickname) + '">' + ICONS.edit + '</button>' +
          '<button class="iconbtn danger" data-del-vehicle="' + v.id + '" aria-label="Delete ' + esc(v.nickname) + '">' + ICONS.trash + '</button>' +
        '</div></div>' +
      '<div class="vcard-mid">' +
        '<div class="gauge-wrap">' + gaugeSVG(c.avg, maxG) +
          '<div class="gauge-val">' + (c.avg == null ? '—' : c.avg.toFixed(1)) + '</div>' +
          '<div class="gauge-unit">km / litre</div></div>' +
        '<div class="statlist">' +
          stat('Lifetime km', fmtNum(c.lifetimeKm), 'km') +
          stat('Fuel spend', fmtINR(c.fuelSpend), '') +
          stat('Service spend', fmtINR(c.serviceSpend), '') +
          stat('Total spend', fmtINR(c.totalSpend), '') +
        '</div></div>' +
      '<div class="vcard-docs">' + (c.docs.length ? c.docs.map(docChip).join('') : '<span class="sub">No documents added</span>') + '</div>' +
      '<div class="vcard-foot">' +
        '<button class="btn btn-sm btn-ghost" data-nav-fuel="' + v.id + '">' + ICONS.fuel + 'Log fuel</button>' +
        '<button class="btn btn-sm btn-ghost" data-nav-service="' + v.id + '">' + ICONS.wrench + 'Add service</button>' +
        '<button class="btn btn-sm btn-ghost" data-nav-docs="' + v.id + '">' + ICONS.doc + 'Documents</button>' +
      '</div></div>';
  }).join('') + '</div>';
  return h;
}
function meterCard(k, v, s){
  return '<div class="meter"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + (s ? ' <small>' + esc(s) + '</small>' : '') + '</div></div>';
}
function stat(k, v, unit){
  return '<div class="s"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + (unit ? ' <small>' + esc(unit) + '</small>' : '') + '</div></div>';
}
function mountDashboard(root){
  root.querySelectorAll('[data-act="add-vehicle"]').forEach(b => b.addEventListener('click', () => openVehicleModal()));
  root.querySelectorAll('[data-edit-vehicle]').forEach(b => b.addEventListener('click', () => openVehicleModal(vehicleById(b.dataset.editVehicle))));
  root.querySelectorAll('[data-del-vehicle]').forEach(b => b.addEventListener('click', () => {
    const v = vehicleById(b.dataset.delVehicle);
    if(!v) return;
    if(!confirm('Delete "' + v.nickname + '" and all its fuel, service and document records?')) return;
    Biz.deleteVehicle(v.id); render(); toast('Vehicle deleted');
  }));
  root.querySelectorAll('[data-nav-fuel]').forEach(b => b.addEventListener('click', () => { state.view = 'fuel'; state.vehicleTab = b.dataset.navFuel; render(); }));
  root.querySelectorAll('[data-nav-service]').forEach(b => b.addEventListener('click', () => { state.view = 'service'; state.vehicleTab = b.dataset.navService; render(); }));
  root.querySelectorAll('[data-nav-docs]').forEach(b => b.addEventListener('click', () => { state.view = 'documents'; state.vehicleTab = b.dataset.navDocs; render(); }));
}

/* ---------------- view: vehicles ---------------- */
function vVehicles(){
  const vs = Store.data.vehicles;
  let h = '<div class="pagehead"><div><h1>Vehicles</h1><p>Your garage. Deleting a vehicle removes its fuel, service and document records too.</p></div>' +
    '<div class="toolbar"><button class="btn btn-primary" data-act="add-vehicle">' + ICONS.plus + 'Add vehicle</button></div></div>';
  if(!vs.length){
    h += '<div class="empty"><h3>No vehicles</h3><p>Add your first vehicle to start logging.</p></div>';
    return h;
  }
  h += '<div class="panel">' + vs.map(v => {
    const fs = Biz.fuelStats(v.id), ss = Biz.serviceStats(v.id);
    return '<div class="vrow"><div><div class="who" style="font-family:var(--font-cond);font-size:17px;letter-spacing:.05em;text-transform:uppercase">' + esc(v.nickname) + '</div>' +
      '<div class="sub">' + esc(v.reg) + ' · ' + esc([v.make, v.model].filter(Boolean).join(' ')) + ' · bought ' + fmtDate(v.purchaseDate) +
      ' · ' + fs.count + ' fills · ' + ss.count + ' services</div></div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="iconbtn" data-edit-vehicle="' + v.id + '" aria-label="Edit">' + ICONS.edit + '</button>' +
        '<button class="iconbtn danger" data-del-vehicle="' + v.id + '" aria-label="Delete">' + ICONS.trash + '</button>' +
      '</div></div>';
  }).join('') + '</div>';
  return h;
}
function openVehicleModal(v){
  const isNew = !v;
  v = v || { nickname:'', type:'bike', reg:'', make:'', model:'', purchaseDate:todayISO() };
  const ov = openModal(isNew ? 'Add vehicle' : 'Edit vehicle',
    '<form id="veh-form" novalidate><div class="formgrid">' +
    fieldHTML('nickname','Nickname',{ value:v.nickname, required:true, hint:'e.g. Daily Runner' }) +
    fieldHTML('type','Type',{ value:v.type, options:[{value:'bike',label:'Bike'},{value:'car',label:'Car'}] }) +
    '</div>' +
    fieldHTML('reg','Registration number',{ value:v.reg, required:true, hint:'Indian format, e.g. DL 8C AB 1234' }) +
    '<div class="formgrid">' +
    fieldHTML('make','Make',{ value:v.make, hint:'e.g. Honda' }) +
    fieldHTML('model','Model',{ value:v.model, hint:'e.g. SP 125' }) +
    '</div>' +
    fieldHTML('purchaseDate','Purchase date',{ type:'date', value:v.purchaseDate, required:true }) +
    '</form>',
    { footerHTML:'<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save vehicle</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  const form = ov.querySelector('#veh-form');
  ov.querySelector('[data-save]').addEventListener('click', () => {
    clearFormErrors(form);
    const d = formData(form);
    try{
      if(isNew) Biz.addVehicle(d);
      else {
        d.nickname = d.nickname.trim(); d.reg = d.reg.trim().toUpperCase();
        if(d.nickname.length < 2) throw new Error('Nickname is required');
        if(!/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{1,4}$/.test(d.reg)) throw new Error('Registration must look like DL 8C AB 1234');
        Biz.updateVehicle(v.id, { nickname:d.nickname, type:d.type, reg:d.reg,
          make:d.make.trim(), model:d.model.trim(), purchaseDate:d.purchaseDate });
      }
      closeModal(); render(); toast(isNew ? 'Vehicle added' : 'Vehicle updated');
    }catch(e){
      const msg = e.message;
      if(/registration/i.test(msg)) formError(form,'reg',msg);
      else if(/nickname/i.test(msg)) formError(form,'nickname',msg);
      else if(/purchase/i.test(msg)) formError(form,'purchaseDate',msg);
      else formError(form,'type',msg);
    }
  });
}

/* ---------------- view: documents ---------------- */
function vDocuments(){
  const vs = Store.data.vehicles;
  let h = '<div class="pagehead"><div><h1>Documents</h1><p>RC, insurance and PUC expiry tracking. Red means expired, amber means due within 30 days.</p></div>' +
    '<div class="toolbar"><button class="btn btn-primary" data-act="add-doc">' + ICONS.plus + 'Add document</button></div></div>';
  if(!vs.length){
    h += '<div class="empty"><h3>No vehicles</h3><p>Add a vehicle before tracking documents.</p></div>';
    return h;
  }
  const list = state.vehicleTab === 'all' ? vs : vs.filter(v => v.id === state.vehicleTab);
  h += '<div class="toolbar" style="margin-bottom:14px"><label for="doc-filter" style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Vehicle</label>' +
    '<select class="inline" id="doc-filter"><option value="all">All vehicles</option>' +
    vs.map(v => '<option value="' + v.id + '"' + (state.vehicleTab===v.id?' selected':'') + '>' + esc(v.nickname) + '</option>').join('') +
    '</select></div>';
  list.forEach(v => {
    const docs = Biz.vehicleDocs(v.id);
    h += '<div class="panel" style="margin-bottom:18px"><div class="panel-h"><h2>' + esc(v.nickname) + ' <span style="color:var(--muted);font-family:var(--font-num);font-size:12px">' + esc(v.reg) + '</span></h2></div>';
    if(!docs.length){
      h += '<div class="panel-b"><div class="empty"><h3>No documents</h3><p>Add the RC, insurance and PUC with their expiry dates.</p></div></div>';
    } else {
      h += '<div class="tscroll" style="border:0;border-radius:0"><table class="dtable"><thead><tr>' +
        '<th>Document</th><th>Expiry date</th><th>Status</th><th></th></tr></thead><tbody>' +
        docs.map(d =>
          '<tr><td><b>' + esc(d.kind) + '</b></td><td>' + fmtDate(d.expiry) + '</td>' +
          '<td>' + docChip(d) + '</td>' +
          '<td style="white-space:nowrap;text-align:right">' +
            '<button class="iconbtn" data-edit-doc="' + d.id + '" aria-label="Edit expiry">' + ICONS.edit + '</button> ' +
            '<button class="iconbtn danger" data-del-doc="' + d.id + '" aria-label="Delete">' + ICONS.trash + '</button>' +
          '</td></tr>').join('') + '</tbody></table></div>';
    }
    h += '</div>';
  });
  return h;
}
function openDocModal(d){
  const isNew = !d;
  const vs = Store.data.vehicles;
  if(!vs.length){ toast('Add a vehicle first', true); return; }
  d = d || { vehicleId:vs[0].id, kind:'PUC', expiry:'' };
  const ov = openModal(isNew ? 'Add document' : 'Edit document expiry',
    '<form id="doc-form" novalidate>' +
    (isNew
      ? fieldHTML('vehicleId','Vehicle',{ value:d.vehicleId, options:vs.map(v => ({value:v.id,label:v.nickname + ' · ' + v.reg})) }) +
        fieldHTML('kind','Document',{ value:d.kind, options:DOC_KINDS.map(k => ({value:k,label:k})) })
      : '<div class="field"><label>Document</label><div style="font-weight:700">' + esc(d.kind) + '</div></div>') +
    fieldHTML('expiry','Expiry date',{ type:'date', value:d.expiry, required:true }) +
    '</form>',
    { footerHTML:'<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save document</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  const form = ov.querySelector('#doc-form');
  ov.querySelector('[data-save]').addEventListener('click', () => {
    clearFormErrors(form);
    const fd = formData(form);
    try{
      if(isNew) Biz.addDoc(fd);
      else Biz.updateDoc(d.id, fd);
      closeModal(); render(); toast(isNew ? 'Document added' : 'Expiry updated');
    }catch(e){ formError(form, /expiry/i.test(e.message) ? 'expiry' : (isNew ? 'kind' : 'expiry'), e.message); }
  });
}

/* ---------------- view: fuel log ---------------- */
function vFuel(){
  const vs = Store.data.vehicles;
  let h = '<div class="pagehead"><div><h1>Fuel Log</h1><p>Every fill-up. Mileage is computed fill-to-fill; the running average covers total distance over total fuel.</p></div>' +
    '<div class="toolbar"><button class="btn btn-primary" data-act="add-fill">' + ICONS.plus + 'Log fill</button></div></div>';
  if(!vs.length){
    h += '<div class="empty"><h3>No vehicles</h3><p>Add a vehicle before logging fuel.</p></div>';
    return h;
  }
  h += '<div class="toolbar" style="margin-bottom:14px"><label for="fuel-filter" style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Vehicle</label>' +
    '<select class="inline" id="fuel-filter"><option value="all">All vehicles</option>' +
    vs.map(v => '<option value="' + v.id + '"' + (state.vehicleTab===v.id?' selected':'') + '>' + esc(v.nickname) + '</option>').join('') +
    '</select></div>';
  const list = state.vehicleTab === 'all' ? vs : vs.filter(v => v.id === state.vehicleTab);
  list.forEach(v => {
    const fs = Biz.fuelStats(v.id);
    h += '<div class="panel" style="margin-bottom:18px"><div class="panel-h"><h2>' + esc(v.nickname) +
      ' <span style="color:var(--muted);font-family:var(--font-num);font-size:12px">' + esc(v.reg) + '</span></h2>' +
      '<button class="btn btn-sm btn-ghost" data-fill-for="' + v.id + '">' + ICONS.plus + 'Log fill</button></div>';
    if(!fs.count){
      h += '<div class="panel-b"><div class="empty"><h3>No fills logged</h3><p>Log two fills to start seeing km/l.</p></div></div>';
    } else {
      h += '<div class="panel-b" style="padding-bottom:0"><div class="fuelavg">' +
        '<div class="cell"><div class="k">Running average</div><div class="v">' + (fs.avg == null ? '—' : fs.avg.toFixed(1)) + ' <span style="font-size:13px;color:var(--muted)">km/l</span></div></div>' +
        '<div class="cell"><div class="k">Fills</div><div class="v">' + fs.count + '</div></div>' +
        '<div class="cell"><div class="k">Fuel spend</div><div class="v">' + fmtINR(fs.spend) + '</div></div>' +
      '</div></div>';
      h += '<div class="tscroll" style="border:0;border-radius:0"><table class="dtable"><thead><tr>' +
        '<th>Date</th><th class="num">Odometer</th><th class="num">Litres</th><th class="num">Amount</th><th class="num">Mileage</th><th></th>' +
        '</tr></thead><tbody>' +
        fs.rowsDesc.map(f =>
          '<tr><td>' + fmtDate(f.date) + '</td>' +
          '<td class="num">' + fmtNum(f.odo) + ' km</td>' +
          '<td class="num">' + fmtNum(f.litres, 2) + ' L</td>' +
          '<td class="num">' + fmtINR(f.amount) + '</td>' +
          '<td class="num"><span class="kml">' + (f.kml == null ? '<span class="sub">—</span>' : f.kml.toFixed(1) + ' km/l') + '</span></td>' +
          '<td style="text-align:right"><button class="iconbtn danger" data-del-fill="' + f.id + '" aria-label="Delete fill">' + ICONS.trash + '</button></td></tr>'
        ).join('') + '</tbody></table></div>';
    }
    h += '</div>';
  });
  return h;
}
function openFillModal(presetVehicleId){
  const vs = Store.data.vehicles;
  if(!vs.length){ toast('Add a vehicle first', true); return; }
  const vid = presetVehicleId && vehicleById(presetVehicleId) ? presetVehicleId : vs[0].id;
  const max = Biz.maxOdo(vid);
  const ov = openModal('Log fuel fill',
    '<form id="fill-form" novalidate>' +
    fieldHTML('vehicleId','Vehicle',{ value:vid, options:vs.map(v => ({value:v.id,label:v.nickname + ' · ' + v.reg})) }) +
    '<div class="formgrid">' +
    fieldHTML('date','Date',{ type:'date', value:todayISO(), required:true }) +
    fieldHTML('odo','Odometer (km)',{ type:'number', value:'', required:true, hint:max > 0 ? 'Last reading: ' + fmtNum(max) + ' km — must be higher' : 'First reading for this vehicle' }) +
    '</div><div class="formgrid">' +
    fieldHTML('litres','Litres',{ type:'number', value:'', required:true, step:'0.01' }) +
    fieldHTML('amount','Amount (₹)',{ type:'number', value:'', required:true, step:'0.01' }) +
    '</div></form>',
    { footerHTML:'<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save fill</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  const form = ov.querySelector('#fill-form');
  ov.querySelector('[data-save]').addEventListener('click', () => {
    clearFormErrors(form);
    const d = formData(form);
    try{
      Biz.addFill(d);
      closeModal(); render(); toast('Fill logged');
    }catch(e){
      const msg = e.message;
      if(/odometer/i.test(msg)) formError(form,'odo',msg);
      else if(/litres/i.test(msg)) formError(form,'litres',msg);
      else if(/amount/i.test(msg)) formError(form,'amount',msg);
      else if(/date/i.test(msg)) formError(form,'date',msg);
      else formError(form,'vehicleId',msg);
    }
  });
}

/* ---------------- view: service ---------------- */
function vService(){
  const vs = Store.data.vehicles;
  let h = '<div class="pagehead"><div><h1>Service History</h1><p>Repairs, services and their cost. Total spend feeds the dashboard.</p></div>' +
    '<div class="toolbar"><button class="btn btn-primary" data-act="add-service">' + ICONS.plus + 'Add service</button></div></div>';
  if(!vs.length){
    h += '<div class="empty"><h3>No vehicles</h3><p>Add a vehicle before logging service.</p></div>';
    return h;
  }
  h += '<div class="toolbar" style="margin-bottom:14px"><label for="svc-filter" style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Vehicle</label>' +
    '<select class="inline" id="svc-filter"><option value="all">All vehicles</option>' +
    vs.map(v => '<option value="' + v.id + '"' + (state.vehicleTab===v.id?' selected':'') + '>' + esc(v.nickname) + '</option>').join('') +
    '</select></div>';
  const list = state.vehicleTab === 'all' ? vs : vs.filter(v => v.id === state.vehicleTab);
  list.forEach(v => {
    const ss = Biz.serviceStats(v.id);
    h += '<div class="panel" style="margin-bottom:18px"><div class="panel-h"><h2>' + esc(v.nickname) +
      ' <span style="color:var(--muted);font-family:var(--font-num);font-size:12px">' + esc(v.reg) + '</span></h2>' +
      '<div style="display:flex;gap:10px;align-items:center"><span class="sub">total <b class="kml">' + fmtINR(ss.spend) + '</b></span>' +
      '<button class="btn btn-sm btn-ghost" data-svc-for="' + v.id + '">' + ICONS.plus + 'Add service</button></div></div>';
    if(!ss.rows.length){
      h += '<div class="panel-b"><div class="empty"><h3>No service records</h3><p>Log services and repairs to track spend.</p></div></div>';
    } else {
      h += '<div class="tscroll" style="border:0;border-radius:0"><table class="dtable"><thead><tr>' +
        '<th>Date</th><th>Type</th><th class="num">Odometer</th><th class="num">Cost</th><th>Notes</th><th></th>' +
        '</tr></thead><tbody>' +
        ss.rows.map(s =>
          '<tr><td>' + fmtDate(s.date) + '</td><td><b>' + esc(s.type) + '</b></td>' +
          '<td class="num">' + fmtNum(s.odo) + ' km</td><td class="num">' + fmtINR(s.cost) + '</td>' +
          '<td class="sub">' + (s.notes ? esc(s.notes) : '—') + '</td>' +
          '<td style="text-align:right"><button class="iconbtn danger" data-del-svc="' + s.id + '" aria-label="Delete service">' + ICONS.trash + '</button></td></tr>'
        ).join('') + '</tbody></table></div>';
    }
    h += '</div>';
  });
  return h;
}
function openServiceModal(presetVehicleId){
  const vs = Store.data.vehicles;
  if(!vs.length){ toast('Add a vehicle first', true); return; }
  const vid = presetVehicleId && vehicleById(presetVehicleId) ? presetVehicleId : vs[0].id;
  const ov = openModal('Add service record',
    '<form id="svc-form" novalidate>' +
    fieldHTML('vehicleId','Vehicle',{ value:vid, options:vs.map(v => ({value:v.id,label:v.nickname + ' · ' + v.reg})) }) +
    '<div class="formgrid">' +
    fieldHTML('date','Date',{ type:'date', value:todayISO(), required:true }) +
    fieldHTML('type','Service type',{ value:'', required:true, hint:'e.g. General service, Brake pads, Oil change' }) +
    '</div><div class="formgrid">' +
    fieldHTML('odo','Odometer (km)',{ type:'number', value:'', required:true }) +
    fieldHTML('cost','Cost (₹)',{ type:'number', value:'', required:true, step:'0.01' }) +
    '</div>' +
    fieldHTML('notes','Notes',{ value:'', hint:'Optional — parts changed, next service due, etc.' }) +
    '</form>',
    { footerHTML:'<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-primary" data-save>Save service</button>' });
  ov.querySelector('[data-close2]').addEventListener('click', closeModal);
  const form = ov.querySelector('#svc-form');
  ov.querySelector('[data-save]').addEventListener('click', () => {
    clearFormErrors(form);
    const d = formData(form);
    try{
      Biz.addService(d);
      closeModal(); render(); toast('Service recorded');
    }catch(e){
      const msg = e.message;
      if(/cost/i.test(msg)) formError(form,'cost',msg);
      else if(/odometer/i.test(msg)) formError(form,'odo',msg);
      else if(/type/i.test(msg)) formError(form,'type',msg);
      else if(/date/i.test(msg)) formError(form,'date',msg);
      else formError(form,'vehicleId',msg);
    }
  });
}

/* ---------------- views registry ---------------- */
const Views = {
  dashboard: Object.assign(vDashboard, { mount: mountDashboard }),
  vehicles:  Object.assign(vVehicles,  { mount(root){
    root.querySelectorAll('[data-act="add-vehicle"]').forEach(b => b.addEventListener('click', () => openVehicleModal()));
    root.querySelectorAll('[data-edit-vehicle]').forEach(b => b.addEventListener('click', () => openVehicleModal(vehicleById(b.dataset.editVehicle))));
    root.querySelectorAll('[data-del-vehicle]').forEach(b => b.addEventListener('click', () => {
      const v = vehicleById(b.dataset.delVehicle);
      if(!v) return;
      if(!confirm('Delete "' + v.nickname + '" and all its records?')) return;
      Biz.deleteVehicle(v.id); render(); toast('Vehicle deleted');
    }));
  }}),
  documents: Object.assign(vDocuments, { mount(root){
    root.querySelectorAll('[data-act="add-doc"]').forEach(b => b.addEventListener('click', () => openDocModal()));
    const sel = root.querySelector('#doc-filter');
    if(sel) sel.addEventListener('change', () => { state.vehicleTab = sel.value; render(); });
    root.querySelectorAll('[data-edit-doc]').forEach(b => b.addEventListener('click', () => {
      const d = Store.data.documents.find(x => x.id === b.dataset.editDoc);
      if(d) openDocModal(d);
    }));
    root.querySelectorAll('[data-del-doc]').forEach(b => b.addEventListener('click', () => {
      if(!confirm('Delete this document record?')) return;
      Biz.deleteDoc(b.dataset.delDoc); render(); toast('Document deleted');
    }));
  }}),
  fuel: Object.assign(vFuel, { mount(root){
    root.querySelectorAll('[data-act="add-fill"]').forEach(b => b.addEventListener('click', () => openFillModal(state.vehicleTab !== 'all' ? state.vehicleTab : null)));
    root.querySelectorAll('[data-fill-for]').forEach(b => b.addEventListener('click', () => openFillModal(b.dataset.fillFor)));
    const sel = root.querySelector('#fuel-filter');
    if(sel) sel.addEventListener('change', () => { state.vehicleTab = sel.value; render(); });
    root.querySelectorAll('[data-del-fill]').forEach(b => b.addEventListener('click', () => {
      if(!confirm('Delete this fuel fill? Mileage will be recomputed.')) return;
      Biz.deleteFill(b.dataset.delFill); render(); toast('Fill deleted');
    }));
  }}),
  service: Object.assign(vService, { mount(root){
    root.querySelectorAll('[data-act="add-service"]').forEach(b => b.addEventListener('click', () => openServiceModal(state.vehicleTab !== 'all' ? state.vehicleTab : null)));
    root.querySelectorAll('[data-svc-for]').forEach(b => b.addEventListener('click', () => openServiceModal(b.dataset.svcFor)));
    const sel = root.querySelector('#svc-filter');
    if(sel) sel.addEventListener('change', () => { state.vehicleTab = sel.value; render(); });
    root.querySelectorAll('[data-del-svc]').forEach(b => b.addEventListener('click', () => {
      if(!confirm('Delete this service record?')) return;
      Biz.deleteService(b.dataset.delSvc); render(); toast('Service record deleted');
    }));
  }}),
};

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
    t('seeded 2 vehicles', Store.data.vehicles.length === 2, 'got ' + Store.data.vehicles.length);
    t('seeded 6 documents', Store.data.documents.length === 6, 'got ' + Store.data.documents.length);
    t('seeded fuel fills', Store.data.fuel.length >= 10, 'got ' + Store.data.fuel.length);
    t('seeded services', Store.data.services.length === 2, 'got ' + Store.data.services.length);

    // document alerts: bike PUC expired, insurance due soon
    const bike = Store.data.vehicles.find(v => v.type === 'bike');
    const puc = Biz.vehicleDocs(bike.id).find(d => d.kind === 'PUC');
    const ins = Biz.vehicleDocs(bike.id).find(d => d.kind === 'Insurance');
    t('PUC flagged expired', puc && puc.st.cls === 'bad', puc && puc.st.label);
    t('insurance flagged due-soon', ins && ins.st.cls === 'warn', ins && ins.st.label);

    // add vehicle
    const nv = Biz.addVehicle({ nickname:'Selftest Scooty', type:'bike', reg:'UP 16 CT 4321',
      make:'TVS', model:'Jupiter', purchaseDate:'2024-03-10' });
    t('vehicle added', !!nv && !!nv.id);

    // near-expiry document
    const soon = new Date(); soon.setDate(soon.getDate() + 10);
    const sy = soon.getFullYear(), sm = String(soon.getMonth()+1).padStart(2,'0'), sd = String(soon.getDate()).padStart(2,'0');
    const nd = Biz.addDoc({ vehicleId:nv.id, kind:'Insurance', expiry: sy + '-' + sm + '-' + sd });
    const nst = Biz.docStatus(nd.expiry);
    t('near-expiry doc flagged warn', nst.cls === 'warn' && nst.days <= 30, nst.label + ' ' + nst.sub);

    // two fuel fills -> km/l
    Biz.addFill({ vehicleId:nv.id, date:'2026-10-10', odo:15000, litres:4.0, amount:420 });
    const f2 = Biz.addFill({ vehicleId:nv.id, date:'2026-10-12', odo:15180, litres:4.0, amount:422 });
    t('second fill logged', !!f2 && !!f2.id);
    const fs = Biz.fuelStats(nv.id);
    const last = fs.rowsAsc[fs.rowsAsc.length - 1];
    const expected = 180 / 4.0; // 45.0 km/l
    t('km/l computed', last.kml != null && Math.abs(last.kml - expected) < 0.001,
      'expected 45.0, got ' + (last.kml == null ? 'null' : last.kml.toFixed(3)));
    t('running average computed', fs.avg != null && Math.abs(fs.avg - expected) < 0.001,
      'got ' + (fs.avg == null ? 'null' : fs.avg.toFixed(3)));

    // odometer validation
    let rejected = false;
    try{ Biz.addFill({ vehicleId:nv.id, date:'2026-10-13', odo:15100, litres:3, amount:300 }); }
    catch(e){ rejected = /odometer/i.test(e.message); }
    t('decreasing odometer rejected', rejected);

    // persistence + re-render
    const raw = localStorage.getItem(NS + 'data');
    const parsed = JSON.parse(raw);
    t('persists vehicle + fills', parsed.vehicles.some(x => x.id === nv.id) && parsed.fuel.filter(x => x.vehicleId === nv.id).length === 2);
    state.view = 'dashboard'; render();
    const html = document.getElementById('app').innerHTML;
    t('re-render shows vehicle + gauge', html.includes('Selftest Scooty') && html.includes('45.0'));
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
  // leave app in a clean, freshly-seeded state so normal mode is uncorrupted
  try{ Store.wipe(); Store.seed(); state.view = 'dashboard'; state.vehicleTab = 'all'; }catch(e){}
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
