/* GharSeva — home-services marketplace (customer side). Vanilla JS, localStorage. */
(function(){
'use strict';

/* ---------------- utils ---------------- */
var NS = 'gs_v1_';
var K = { pros: NS+'pros', bookings: NS+'bookings', seeded: NS+'seeded' };
var TRADES = ['Electrician','Plumber','Carpenter'];
var TRADE_ICONS = {
  Electrician:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>',
  Plumber:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7z"/></svg>',
  Carpenter:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.5 8.5a2.1 2.1 0 1 1-3-3L12 9"/><path d="M17.6 15 22 10.6a2 2 0 0 0 0-2.8l-5.4-5.4a2 2 0 0 0-2.8 0L9.4 6.8"/></svg>'
};
var SERVICES = {
  Electrician:['Fan installation / repair','Switch & socket repair','Light fixture installation','Wiring fault diagnosis','Inverter installation'],
  Plumber:['Tap & faucet repair','Pipe leakage fix','Bathroom fitting installation','Drain blockage removal','Water tank cleaning'],
  Carpenter:['Furniture assembly','Door repair & alignment','Modular kitchen repair','Wood polishing','Custom shelf installation']
};
var SLOTS = ['9 AM – 11 AM','11 AM – 1 PM','1 PM – 3 PM','3 PM – 5 PM','5 PM – 7 PM'];
var BOOKING_FLOW = ['requested','confirmed','in-progress','completed'];
var BOOKING_LABEL = { 'requested':'Requested','confirmed':'Confirmed','in-progress':'In Progress','completed':'Completed','cancelled':'Cancelled' };
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtDate(iso){
  if(!iso) return '—';
  var d = new Date(iso.length<=10 ? iso+'T12:00:00' : iso);
  if(isNaN(d)) return '—';
  return pad2(d.getDate())+'-'+MONTHS[d.getMonth()]+'-'+d.getFullYear();
}
function fmtINR(n){ return '₹'+Math.round(Number(n)||0).toLocaleString('en-IN'); }
function fmtPhone(p){
  p = String(p||'').replace(/\D/g,'');
  return p.length===10 ? '+91 '+p.slice(0,5)+' '+p.slice(5) : esc(p);
}
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function uid(p){ return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function read(key, fb){ try{ var v=localStorage.getItem(key); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
function write(key, v){ localStorage.setItem(key, JSON.stringify(v)); }
function isSelftest(){ try{ return new URLSearchParams(location.search).get('selftest')==='1'; }catch(e){ return false; } }
function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function datePlus(n){ var d=new Date(); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }

/* ---------------- store ---------------- */
var Store = {
  pros: [], bookings: [],
  load: function(){
    this.pros = read(K.pros, []);
    this.bookings = read(K.bookings, []);
  },
  savePros: function(){ write(K.pros, this.pros); },
  saveBookings: function(){ write(K.bookings, this.bookings); },

  addPro: function(d){
    var p = {
      id: uid('pro'), name: d.name.trim(), trade: d.trade, area: d.area.trim(),
      rate: Math.max(0, Math.round(Number(d.rate)||0)), phone: String(d.phone).replace(/\D/g,''),
      ratingSum: 0, ratingCount: 0, jobsDone: 0
    };
    this.pros.push(p); this.savePros(); return p;
  },
  proById: function(id){ return this.pros.find(function(p){return p.id===id;}); },
  avgRating: function(p){ return p.ratingCount ? p.ratingSum/p.ratingCount : 0; },

  addBooking: function(d){
    var b = {
      id: uid('bk'), proId: d.proId, service: d.service, date: d.date, slot: d.slot,
      address: d.address.trim(), customer: d.customer.trim(), phone: String(d.phone).replace(/\D/g,''),
      status: 'requested', rating: null, review: null, createdAt: new Date().toISOString()
    };
    this.bookings.unshift(b); this.saveBookings(); return b;
  },
  setStatus: function(id, status){
    var b = this.bookings.find(function(x){return x.id===id;});
    if(!b) return null;
    b.status = status;
    if(status==='completed'){
      var p = this.proById(b.proId);
      if(p){ p.jobsDone += 1; this.savePros(); }
    }
    this.saveBookings(); return b;
  },
  rateBooking: function(id, rating, review){
    var b = this.bookings.find(function(x){return x.id===id;});
    if(!b || b.status!=='completed' || b.rating!=null) return null;
    b.rating = rating; b.review = (review||'').trim();
    var p = this.proById(b.proId);
    if(p){ p.ratingSum += rating; p.ratingCount += 1; this.savePros(); }
    this.saveBookings(); return b;
  }
};

/* ---------------- seed ---------------- */
/* Explicit-only sample data: called from Settings ("Load sample data") and the
   selftest (?selftest=1). Never auto-run on normal boot. */
function seedSample(){
  function mk(name, trade, area, rate, phone, rating, count, jobs){
    return { id: uid('pro'), name:name, trade:trade, area:area, rate:rate, phone:phone,
             ratingSum: Math.round(rating*count*10)/10, ratingCount: count, jobsDone: jobs };
  }
  Store.pros = [
    mk('Arjun Mehta',   'Electrician','Laxmi Nagar, Delhi', 249, '9810123456', 4.7, 132, 132),
    mk('Vikram Singh',  'Electrician','Mayur Vihar, Delhi', 299, '9898012345', 4.9, 210, 210),
    mk('Rahul Jain',    'Electrician','Preet Vihar, Delhi', 199, '9811122233', 4.5, 87,  87),
    mk('Sanjay Kumar',  'Plumber',    'Laxmi Nagar, Delhi', 249, '9820023456', 4.8, 175, 175),
    mk('Mohd. Aslam',   'Plumber',    'Mayur Vihar, Delhi', 229, '9811188765', 4.6, 143, 143),
    mk('Deepak Yadav',  'Plumber',    'Gandhi Nagar, Delhi',179, '9833344556', 4.4, 64,  64),
    mk('Anil Saini',    'Carpenter',  'Laxmi Nagar, Delhi', 349, '9812233445', 4.9, 188, 188),
    mk('Karan Bisht',   'Carpenter',  'Preet Vihar, Delhi', 299, '9899123456', 4.7, 121, 121),
    mk('Naresh Pal',    'Carpenter',  'Mayur Vihar, Delhi', 279, '9822556677', 4.5, 96,  96)
  ];
  function seedBooking(proName, service, daysAgo, slot, address, customer, phone, rating, review){
    var p = Store.pros.find(function(x){return x.name===proName;});
    var b = {
      id: uid('bk'), proId: p.id, service: service, date: datePlus(daysAgo), slot: slot,
      address: address, customer: customer, phone: phone,
      status: 'completed', rating: rating, review: review, createdAt: new Date(Date.now()+daysAgo*86400000).toISOString()
    };
    p.ratingSum = Math.round((p.ratingSum + rating)*10)/10;
    p.ratingCount += 1;
    p.jobsDone += 1;
    return b;
  }
  Store.bookings = [
    seedBooking('Vikram Singh','Ceiling fan installation', -6, '10 AM – 12 PM',
      'B-42, Shashi Garden, Mayur Vihar Phase 1, Delhi 110091', 'Rohit Sharma', '9810098100',
      5, 'Punctual and very professional. Fan installed neatly, no mess left behind.'),
    seedBooking('Sanjay Kumar','Bathroom tap replacement', -3, '3 PM – 5 PM',
      '14/7, Laxmi Nagar, Vikas Marg, Delhi 110092', 'Meera Iyer', '9898098980',
      4, 'Good work, arrived a little late but fixed everything properly.')
  ];

  Store.savePros(); Store.saveBookings();
  localStorage.setItem(K.seeded,'1');
}

/* ---------------- data management ---------------- */
/* Wipes every key in this app's namespace (pros, bookings AND the seeded flag,
   which carries the same NS prefix). Returns the number of keys removed. */
function wipeNamespace(){
  var ks=[];
  for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&k.indexOf(NS)===0) ks.push(k); }
  ks.forEach(function(k){ localStorage.removeItem(k); });
  return ks.length;
}
function loadSampleData(){
  var hasData = Store.pros.length||Store.bookings.length;
  if(hasData && !confirm('You already have data in GharSeva. Replace it with sample data?')) return;
  seedSample();
  render();
  toast('Sample data loaded');
}
function clearAllData(){
  if(!confirm('Delete ALL data — every pro and booking — and start fresh? This cannot be undone.')) return;
  wipeNamespace();
  Store.load();
  setView('directory');
  toast('All data cleared — fresh start');
}

/* ---------------- toast ---------------- */
function toast(msg){
  var root = document.getElementById('toast-root');
  var el = document.createElement('div');
  el.className='toast'; el.textContent = msg;
  root.appendChild(el);
  setTimeout(function(){ el.remove(); }, 2800);
}

/* ---------------- modal ---------------- */
function openModal(title, bodyHTML, opts){
  opts = opts||{};
  var root = document.getElementById('modal-root');
  root.innerHTML =
    '<div class="modal-backdrop" id="modal-backdrop">'+
      '<div class="modal" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
        '<div class="modal-head"><h2>'+esc(title)+'</h2>'+
        '<button class="icon-btn" id="modal-close" type="button" aria-label="Close dialog">'+
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
        '<form class="modal-body" id="modal-form" novalidate>'+bodyHTML+
        '<div class="modal-foot"><button class="btn ghost" type="button" id="modal-cancel">Cancel</button>'+
        '<button class="btn primary" type="submit">'+esc(opts.submitLabel||'Save')+'</button></div></form>'+
      '</div>'+
    '</div>';
  function close(){ root.innerHTML=''; document.removeEventListener('keydown', onKey); }
  function onKey(e){ if(e.key==='Escape') close(); }
  document.addEventListener('keydown', onKey);
  document.getElementById('modal-close').onclick = close;
  document.getElementById('modal-cancel').onclick = close;
  document.getElementById('modal-backdrop').addEventListener('mousedown', function(e){ if(e.target.id==='modal-backdrop') close(); });
  document.getElementById('modal-form').addEventListener('submit', function(e){
    e.preventDefault();
    if(opts.onSubmit && opts.onSubmit(e.target)===false) return;
    close();
  });
  var first = root.querySelector('input,select,textarea');
  if(first) first.focus();
}
function fieldErr(form, name, msg){
  var input = form.querySelector('[name="'+name+'"]');
  var f = input.closest('.field');
  var e = f.querySelector('.error');
  if(e) e.remove();
  if(msg){
    var d = document.createElement('div');
    d.className='error'; d.textContent=msg; f.appendChild(d);
    return false;
  }
  return true;
}
function validPhone(v){ return /^\d{10}$/.test(String(v).replace(/\D/g,'')); }

/* ---------------- stars ---------------- */
function starSVG(fill){
  return '<svg viewBox="0 0 24 24" fill="'+(fill?'#e8960c':'none')+'" stroke="#e8960c" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>';
}
function starsHTML(avg){
  var out='';
  for(var i=1;i<=5;i++) out += starSVG(i <= Math.round(avg));
  return '<span class="stars" role="img" aria-label="Rated '+avg.toFixed(1)+' out of 5">'+out+'</span>';
}

/* ---------------- views ---------------- */
var currentView = 'directory';
var currentTrade = 'Electrician';
var draft = null;      // booking draft
var wizStep = 2;

function setView(v){
  currentView = v;
  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.toggle('is-active', b.dataset.view===v); });
  document.querySelectorAll('.view').forEach(function(s){ s.classList.toggle('is-active', s.id==='view-'+v); });
  render();
}
function render(){
  updateBookingBadge();
  if(currentView==='directory') renderDirectory();
  else if(currentView==='book') renderWizard();
  else if(currentView==='bookings') renderBookings();
  else if(currentView==='settings') renderSettings();
}
function updateBookingBadge(){
  var n = Store.bookings.filter(function(b){ return b.status!=='completed' && b.status!=='cancelled'; }).length;
  var badge = document.getElementById('booking-badge');
  badge.hidden = n===0;
  badge.textContent = n;
}

/* ----- directory ----- */
function renderDirectory(){
  var el = document.getElementById('view-directory');
  var tabs = TRADES.map(function(t){
    return '<button class="trade-tab'+(currentTrade===t?' is-active':'')+'" data-trade="'+t+'" type="button">'+TRADE_ICONS[t]+t+'</button>';
  }).join('');

  var pros = Store.pros.filter(function(p){return p.trade===currentTrade;});
  var cards = pros.map(function(p){
    var avg = Store.avgRating(p);
    var initials = p.name.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
    return '<div class="pro-card" data-id="'+p.id+'">'+
      '<div class="pro-top"><div class="pro-avatar" aria-hidden="true">'+esc(initials)+'</div>'+
      '<div><div class="pro-name">'+esc(p.name)+'</div><div class="pro-trade">'+esc(p.trade)+'</div></div></div>'+
      '<div class="rating-row">'+starsHTML(avg)+'<span class="rating-num">'+avg.toFixed(1)+'</span>'+
      '<span class="rating-count">('+p.ratingCount+' reviews)</span></div>'+
      '<div class="pro-stats">'+
        '<div class="pro-stat"><div class="v">'+fmtINR(p.rate)+'</div><div class="l">Per visit</div></div>'+
        '<div class="pro-stat"><div class="v">'+p.jobsDone+'</div><div class="l">Jobs done</div></div>'+
      '</div>'+
      '<div class="pro-area"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>'+esc(p.area)+'</div>'+
      '<div class="pro-foot"><span class="pro-rate">'+fmtINR(p.rate)+' <small>/ visit</small></span>'+
      '<button class="btn primary" data-book type="button">Book now</button></div>'+
    '</div>';
  }).join('');

  el.innerHTML =
    '<div class="hero"><h1>Home fixes, <span class="accent">sorted.</span></h1>'+
    '<p>Verified electricians, plumbers and carpenters near you. Pick a pro, choose a time slot, and track the job till it\u2019s done.</p>'+
    '<div class="hero-row">'+
      '<span class="hero-chip"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Background-verified pros</span>'+
      '<span class="hero-chip"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Upfront per-visit rates</span>'+
      '<span class="hero-chip"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Pay after the job</span>'+
    '</div></div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">'+
      '<div class="trade-tabs" style="margin-bottom:0">'+tabs+'</div>'+
      '<button class="btn navy" id="add-pro-btn" type="button">+ List your service</button>'+
    '</div>'+
    '<div class="pro-grid">'+(cards || '<div class="empty-state"><h3>'+(Store.pros.length?'No pros in this trade yet':'No pros listed yet')+'</h3>'+
    '<p>'+(Store.pros.length?'List your service to be the first.':'Add your first pro to start taking bookings.')+'</p>'+
    '<button class="btn primary" id="dir-add-first" type="button">'+(Store.pros.length?'List your service':'Add your first pro')+'</button></div>')+'</div>';

  el.querySelectorAll('.trade-tab').forEach(function(t){
    t.onclick = function(){ currentTrade = t.dataset.trade; renderDirectory(); };
  });
  document.getElementById('add-pro-btn').onclick = openProModal;
  var dirFirst = document.getElementById('dir-add-first');
  if(dirFirst) dirFirst.onclick = openProModal;
  el.querySelectorAll('.pro-card').forEach(function(card){
    card.querySelector('[data-book]').onclick = function(){ startBooking(card.dataset.id); };
  });
}

function openProModal(){
  openModal('List your service',
    '<div class="form-row">'+
    '<div class="field"><label for="p-name">Full name</label><input id="p-name" name="name" required maxlength="60" autocomplete="off"></div>'+
    '<div class="field"><label for="p-trade">Trade</label><select id="p-trade" name="trade">'+TRADES.map(function(t){return '<option>'+t+'</option>';}).join('')+'</select></div></div>'+
    '<div class="form-row">'+
    '<div class="field"><label for="p-area">Service area</label><input id="p-area" name="area" placeholder="e.g. Rohini, Delhi" required maxlength="80" autocomplete="off"></div>'+
    '<div class="field"><label for="p-rate">Per-visit rate (₹)</label><input id="p-rate" name="rate" type="number" min="1" step="1" required></div></div>'+
    '<div class="field"><label for="p-phone">Phone (10 digits)</label><input id="p-phone" name="phone" inputmode="numeric" maxlength="10" required autocomplete="off"></div>',
    { submitLabel:'Add pro', onSubmit: function(form){
      var ok = true;
      ok = fieldErr(form,'name', form.name.value.trim()?'':'Name is required') && ok;
      ok = fieldErr(form,'area', form.area.value.trim()?'':'Service area is required') && ok;
      ok = fieldErr(form,'rate', Number(form.rate.value)>0?'':'Enter a valid rate') && ok;
      ok = fieldErr(form,'phone', validPhone(form.phone.value)?'':'Enter a valid 10-digit mobile number') && ok;
      if(!ok) return false;
      var p = Store.addPro({ name:form.name.value, trade:form.trade.value, area:form.area.value, rate:form.rate.value, phone:form.phone.value });
      currentTrade = p.trade;
      render(); toast(p.name+' is now listed');
    }});
}

/* ----- booking wizard ----- */
function startBooking(proId){
  draft = { proId: proId, service:'', date: datePlus(1), slot:'', address:'', customer:'', phone:'' };
  wizStep = 2;
  setView('book');
}
function stepperHTML(){
  var labels = ['Choose pro','Details','Confirm'];
  var html = '<div class="stepper" aria-label="Booking steps">';
  labels.forEach(function(label, i){
    var n = i+1;
    var cls = n<wizStep ? 'is-done' : (n===wizStep ? 'is-active' : '');
    var dot = n<wizStep
      ? '<span class="step-dot"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>'
      : '<span class="step-dot">'+n+'</span>';
    html += '<div class="step '+cls+'">'+dot+'<span class="step-label">'+label+'</span></div>';
    if(n<3) html += '<div class="step-line'+(n<wizStep?' done':'')+'"></div>';
  });
  return html+'</div>';
}
function renderWizard(){
  var el = document.getElementById('view-book');
  if(!draft){ el.innerHTML='<div class="empty-state"><h3>No booking in progress</h3><p>Pick a pro from the directory to start.</p></div>'; return; }
  var p = Store.proById(draft.proId);
  if(!p){ draft=null; render(); return; }

  var initials = p.name.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
  var body = stepperHTML()+
    '<div class="wizard">'+
    '<div class="pro-pick"><div class="pro-avatar" aria-hidden="true">'+esc(initials)+'</div>'+
    '<div class="pro-pick-info"><div class="pro-pick-name">'+esc(p.name)+'</div>'+
    '<div class="pro-pick-meta">'+esc(p.trade)+' · Rated '+Store.avgRating(p).toFixed(1)+'/5 ('+p.ratingCount+' reviews) · '+fmtINR(p.rate)+'/visit</div></div>'+
    '<button class="change-link" id="change-pro" type="button">Change</button></div>';

  if(wizStep===2){
    var svcOpts = '<option value="">Select a service…</option>'+SERVICES[p.trade].map(function(s){
      return '<option'+(draft.service===s?' selected':'')+'>'+esc(s)+'</option>';
    }).join('');
    var slots = SLOTS.map(function(s){
      return '<button class="slot'+(draft.slot===s?' is-active':'')+'" data-slot="'+esc(s)+'" type="button">'+esc(s)+'</button>';
    }).join('');
    body += '<h2>Booking details</h2><p class="wiz-sub">When should '+esc(p.name.split(' ')[0])+' visit?</p>'+
      '<div class="field"><label for="w-service">Service needed</label><select id="w-service">'+svcOpts+'</select><div class="error" id="e-service" hidden></div></div>'+
      '<div class="form-row">'+
      '<div class="field"><label for="w-date">Preferred date</label><input id="w-date" type="date" min="'+todayISO()+'" value="'+esc(draft.date)+'"><div class="error" id="e-date" hidden></div></div>'+
      '<div class="field"><label>Time slot</label><div class="slot-grid">'+slots+'</div><div class="error" id="e-slot" hidden></div></div></div>'+
      '<div class="field"><label for="w-address">Full address</label><textarea id="w-address" placeholder="House / flat no., street, landmark, city, PIN">'+esc(draft.address)+'</textarea><div class="error" id="e-address" hidden></div></div>'+
      '<div class="form-row">'+
      '<div class="field"><label for="w-cust">Your name</label><input id="w-cust" value="'+esc(draft.customer)+'" maxlength="60" autocomplete="off"><div class="error" id="e-cust" hidden></div></div>'+
      '<div class="field"><label for="w-phone">Your phone (10 digits)</label><input id="w-phone" inputmode="numeric" maxlength="10" value="'+esc(draft.phone)+'" autocomplete="off"><div class="error" id="e-phone" hidden></div></div></div>'+
      '<div class="wiz-nav"><button class="btn ghost" id="w-back" type="button">Back</button>'+
      '<button class="btn primary" id="w-next" type="button">Review booking</button></div>';
  } else {
    body += '<h2>Confirm your booking</h2><p class="wiz-sub">Check the details before we send this to '+esc(p.name.split(' ')[0])+'.</p>'+
      '<div class="review-box">'+
      '<div class="review-row"><span class="k">Pro</span><span class="v">'+esc(p.name)+' ('+esc(p.trade)+')</span></div>'+
      '<div class="review-row"><span class="k">Service</span><span class="v">'+esc(draft.service)+'</span></div>'+
      '<div class="review-row"><span class="k">Date</span><span class="v">'+fmtDate(draft.date)+'</span></div>'+
      '<div class="review-row"><span class="k">Time slot</span><span class="v">'+esc(draft.slot)+'</span></div>'+
      '<div class="review-row"><span class="k">Address</span><span class="v">'+esc(draft.address)+'</span></div>'+
      '<div class="review-row"><span class="k">Contact</span><span class="v">'+esc(draft.customer)+' · '+fmtPhone(draft.phone)+'</span></div>'+
      '<div class="review-total"><span class="k" style="font-weight:700;color:var(--muted)">Pay after the job</span><span class="t">'+fmtINR(p.rate)+'</span></div></div>'+
      '<div class="wiz-nav"><button class="btn ghost" id="w-back" type="button">Back</button>'+
      '<button class="btn primary" id="w-confirm" type="button">Confirm booking</button></div>';
  }
  el.innerHTML = body+'</div>';

  document.getElementById('change-pro').onclick = function(){ draft=null; setView('directory'); };
  document.getElementById('w-back').onclick = function(){
    if(wizStep===2){ draft=null; setView('directory'); }
    else { wizStep=2; renderWizard(); }
  };
  if(wizStep===2){
    el.querySelectorAll('.slot').forEach(function(s){
      s.onclick = function(){
        el.querySelectorAll('.slot').forEach(function(x){x.classList.remove('is-active');});
        s.classList.add('is-active'); draft.slot = s.dataset.slot;
      };
    });
    document.getElementById('w-next').onclick = function(){
      draft.service = document.getElementById('w-service').value;
      draft.date = document.getElementById('w-date').value;
      draft.address = document.getElementById('w-address').value.trim();
      draft.customer = document.getElementById('w-cust').value.trim();
      draft.phone = document.getElementById('w-phone').value.replace(/\D/g,'');
      function setErr(id,msg){ var e=document.getElementById(id); e.hidden=!msg; e.textContent=msg||''; return !msg; }
      var ok = true;
      ok = setErr('e-service', draft.service?'':'Please choose a service') && ok;
      ok = setErr('e-date', draft.date && draft.date>=todayISO()?'':'Pick today or a future date') && ok;
      ok = setErr('e-slot', draft.slot?'':'Please pick a time slot') && ok;
      ok = setErr('e-address', draft.address.length>=8?'':'Enter your full address') && ok;
      ok = setErr('e-cust', draft.customer?'':'Your name is required') && ok;
      ok = setErr('e-phone', validPhone(draft.phone)?'':'Enter a valid 10-digit mobile number') && ok;
      if(!ok) return;
      wizStep = 3; renderWizard();
    };
  } else {
    document.getElementById('w-confirm').onclick = function(){
      var b = Store.addBooking(draft);
      draft = null;
      toast('Booking sent to '+p.name+' — request received');
      setView('bookings');
      void b;
    };
  }
}

/* ----- bookings ----- */
function renderBookings(){
  var el = document.getElementById('view-bookings');
  var cards = Store.bookings.map(function(b){
    var p = Store.proById(b.proId);
    var proName = p ? p.name : 'Pro unavailable';
    var rate = p ? p.rate : 0;
    var actions = '';
    if(b.status==='requested'){
      actions = '<button class="btn small navy" data-act="confirm" type="button">Confirm</button>'+
                '<button class="btn small danger" data-act="cancel" type="button">Cancel</button>';
    } else if(b.status==='confirmed'){
      actions = '<button class="btn small navy" data-act="start" type="button">Start work</button>'+
                '<button class="btn small danger" data-act="cancel" type="button">Cancel</button>';
    } else if(b.status==='in-progress'){
      actions = '<button class="btn small primary" data-act="complete" type="button">Mark completed</button>';
    } else if(b.status==='completed' && b.rating==null){
      actions = '<button class="btn small primary" data-act="rate" type="button">Rate this job</button>';
    }
    var reviewBlock = '';
    if(b.status==='completed' && b.rating!=null){
      reviewBlock = '<div class="review-given">'+starsHTML(b.rating)+'<div><strong>You rated '+b.rating+'/5</strong>'+(b.review?' — “'+esc(b.review)+'”':'')+'</div></div>';
    }
    return '<div class="booking-card" data-id="'+b.id+'">'+
      '<div class="booking-main">'+
        '<div class="booking-service">'+esc(b.service)+'</div>'+
        '<div class="booking-pro">by <strong>'+esc(proName)+'</strong> · '+fmtINR(rate)+'/visit</div>'+
        '<div class="booking-detail"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>'+fmtDate(b.date)+' · '+esc(b.slot)+'</div>'+
        '<div class="booking-detail"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>'+esc(b.address)+'</div>'+
        '<div><span class="status-pill '+b.status+'">'+BOOKING_LABEL[b.status]+'</span></div>'+
        reviewBlock+
      '</div>'+
      '<div class="booking-side"><div class="booking-id">#'+esc(b.id.slice(-6).toUpperCase())+'</div>'+
      '<div class="booking-actions">'+actions+'</div></div>'+
    '</div>';
  }).join('');

  el.innerHTML = '<h2 style="font-size:24px;margin-bottom:4px">My bookings</h2>'+
    '<p style="color:var(--muted);font-size:14px;margin:0 0 20px">Track every job from request to completion.</p>'+
    (cards || '<div class="empty-state"><h3>No bookings yet</h3><p>Find a pro and book your first home service.</p><button class="btn primary" id="go-dir" type="button" style="margin-top:14px">Find a pro</button></div>');

  var gd = document.getElementById('go-dir');
  if(gd) gd.onclick = function(){ setView('directory'); };

  el.querySelectorAll('.booking-card').forEach(function(card){
    var id = card.dataset.id;
    card.querySelectorAll('[data-act]').forEach(function(btn){
      btn.onclick = function(){
        var act = btn.dataset.act;
        var b = Store.bookings.find(function(x){return x.id===id;});
        if(act==='confirm'){ Store.setStatus(id,'confirmed'); toast('Pro confirmed your booking'); }
        else if(act==='start'){ Store.setStatus(id,'in-progress'); toast('Work started'); }
        else if(act==='complete'){ Store.setStatus(id,'completed'); toast('Job completed — please rate it'); }
        else if(act==='cancel'){
          if(confirm('Cancel this booking?')){ Store.setStatus(id,'cancelled'); toast('Booking cancelled'); }
          else return;
        }
        else if(act==='rate'){ openRatingModal(id); return; }
        render();
      };
    });
  });
}

function openRatingModal(id){
  var b = Store.bookings.find(function(x){return x.id===id;});
  if(!b) return;
  var p = Store.proById(b.proId);
  var selected = 0;
  openModal('Rate your experience',
    '<p style="color:var(--muted);font-size:14px;margin:0 0 6px">How was <strong style="color:var(--navy-ink)">'+esc(p?p.name:'the pro')+'</strong> for “'+esc(b.service)+'”?</p>'+
    '<div class="field"><label>Your rating</label><div class="rate-input" id="rate-input" role="radiogroup" aria-label="Star rating">'+
      [1,2,3,4,5].map(function(n){return '<button class="rate-star" data-n="'+n+'" type="button" role="radio" aria-checked="false" aria-label="'+n+' star'+(n>1?'s':'')+'">'+starSVG(false)+'</button>';}).join('')+
    '</div><div class="error" id="rate-err" hidden></div></div>'+
    '<div class="field"><label for="r-review">Review (optional)</label><textarea id="r-review" name="review" maxlength="300" placeholder="What did they do well?"></textarea></div>',
    { submitLabel:'Submit rating', onSubmit: function(form){
      if(selected===0){
        var e=document.getElementById('rate-err'); e.hidden=false; e.textContent='Please tap a star rating';
        return false;
      }
      var res = Store.rateBooking(id, selected, form.review.value);
      if(!res){ toast('This booking was already rated'); return; }
      render(); toast('Thanks — your rating updates the pro\u2019s profile');
    }});
  function paint(){
    document.querySelectorAll('#rate-input .rate-star').forEach(function(s){
      var n = Number(s.dataset.n);
      s.innerHTML = starSVG(n<=selected);
      s.setAttribute('aria-checked', n===selected?'true':'false');
    });
  }
  document.querySelectorAll('#rate-input .rate-star').forEach(function(s){
    s.onclick = function(){ selected = Number(s.dataset.n); paint(); };
  });
}

/* ----- settings ----- */
function renderSettings(){
  var el = document.getElementById('view-settings');
  var n = Store.pros.length+Store.bookings.length;
  el.innerHTML =
    '<div class="wizard" style="max-width:640px">'+
    '<h2>Settings</h2><p class="wiz-sub">Sample data and data management.</p>'+
    '<h2 style="font-size:18px">Sample data</h2>'+
    '<p class="wiz-sub">Load a demo directory — verified pros and past bookings — to explore GharSeva. '+
    (n ? 'You already have '+n+' record'+(n===1?'':'s')+'; loading will replace them after a confirmation.' : 'Your data is currently empty.')+'</p>'+
    '<button class="btn navy" id="set-sample" type="button">Load sample data</button>'+
    '<h2 style="font-size:18px;margin-top:28px">Start fresh</h2>'+
    '<p class="wiz-sub">Delete every pro and booking stored in this browser. This cannot be undone.</p>'+
    '<button class="btn danger" id="set-clear" type="button">Clear all data</button>'+
    '</div>';
  document.getElementById('set-sample').onclick = loadSampleData;
  document.getElementById('set-clear').onclick = clearAllData;
}

/* ---------------- selftest ---------------- */
function runSelftest(){
  var checks = [];
  var failReason = '';
  function check(name, ok){ checks.push([name, !!ok]); if(!ok && !failReason) failReason = name; }

  // the selftest owns the whole namespace: wipe → seed → assert → wipe.
  // normal-mode data is NOT preserved under ?selftest=1; the app is left EMPTY.
  var startView = currentView;

  try{
    wipeNamespace();
    seedSample();
    check('seed flag set', localStorage.getItem(K.seeded)==='1');
    check('9 pros seeded', Store.pros.length===9);
    check('3 trades covered', TRADES.every(function(t){return Store.pros.some(function(p){return p.trade===t;});}));
    check('2 past bookings seeded', Store.bookings.length===2);
    check('seeded bookings completed+rated', Store.bookings.every(function(b){return b.status==='completed'&&b.rating!=null;}));

    // add pro
    var np = Store.addPro({ name:'Selftest Electrician', trade:'Electrician', area:'Test Nagar, Delhi', rate:250, phone:'9000022222' });
    check('pro added', !!np && Store.pros.length===10);
    check('new pro starts unrated', Store.avgRating(np)===0 && np.ratingCount===0);

    // book job
    var bk = Store.addBooking({ proId: np.id, service:'Fan installation / repair', date: datePlus(1),
      slot: SLOTS[0], address:'Selftest address, Delhi 110001', customer:'Selftest User', phone:'9000033333' });
    check('booking created (requested)', !!bk && bk.status==='requested');

    // walk the pipeline to completed
    Store.setStatus(bk.id,'confirmed');
    Store.setStatus(bk.id,'in-progress');
    Store.setStatus(bk.id,'completed');
    var b2 = Store.bookings.find(function(x){return x.id===bk.id;});
    check('booking completed', b2.status==='completed');
    var p2 = Store.proById(np.id);
    check('jobsDone incremented', p2.jobsDone===1);

    // rate it
    Store.rateBooking(bk.id, 5, 'Excellent selftest service');
    var p3 = Store.proById(np.id);
    check('rating stored on booking', Store.bookings.find(function(x){return x.id===bk.id;}).rating===5);
    check('average rating updated (5.0)', Math.abs(Store.avgRating(p3)-5)<1e-9 && p3.ratingCount===1);

    // persistence: fresh re-read from localStorage, re-render
    Store.load();
    render();
    var fresh = read(K.bookings, []);
    var fb = fresh.find(function(x){return x.id===bk.id;});
    check('booking persisted to localStorage', !!fb && fb.status==='completed' && fb.rating===5);
    var fpros = read(K.pros, []);
    var fp = fpros.find(function(x){return x.id===np.id;});
    check('pro rating persisted', !!fp && fp.ratingCount===1 && Math.abs(fp.ratingSum-5)<1e-9);
    setView('bookings'); // render bookings from the freshly loaded storage
    check('bookings view rendered', document.querySelectorAll('#view-bookings .booking-card').length>=1);
    setView(startView);
  }catch(e){
    check('no exception thrown ('+(e&&e.message||e)+')', false);
  }finally{
    // leave the app EMPTY: wipe everything (seeded flag included), no re-seed
    wipeNamespace();
    Store.load();
    check('namespace fully wiped incl. seeded flag',
      !localStorage.getItem(K.seeded) && !localStorage.getItem(K.pros) && !localStorage.getItem(K.bookings));
    setView(startView);
  }

  var passed = checks.filter(function(c){return c[1];}).length;
  var total = checks.length;
  var ok = passed===total;
  var title = ok ? ('SELFTEST PASS '+passed+'/'+total) : ('SELFTEST FAIL: '+failReason);
  document.title = title;
  var banner = document.getElementById('selftest-banner');
  banner.hidden = false;
  banner.className = ok ? 'pass' : 'fail';
  banner.textContent = title + (ok ? '' : ' — app left empty, intact');
  return ok;
}

/* ---------------- boot ---------------- */
function boot(){
  Store.load(); // no auto-seed: the app starts clean; sample data is opt-in via Settings
  document.querySelectorAll('.nav-btn').forEach(function(b){
    b.addEventListener('click', function(){ setView(b.dataset.view); });
  });
  setView('directory');
  if(isSelftest()) runSelftest();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
