/* SevaDesk — field-service manager. Vanilla JS, localStorage persistence. */
(function(){
'use strict';

/* ---------------- utils ---------------- */
var NS = 'sd_v1_';
var K = { jobs: NS+'jobs', techs: NS+'techs', amc: NS+'amc', seeded: NS+'seeded' };
var STATUSES = ['new','assigned','in-progress','done'];
var STATUS_META = {
  'new':         { label:'New',         color:'#4338ca' },
  'assigned':    { label:'Assigned',    color:'#d97706' },
  'in-progress': { label:'In Progress', color:'#0d9488' },
  'done':        { label:'Done',        color:'#16a34a' }
};
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtDate(iso){
  if(!iso) return '—';
  var d = new Date(iso);
  if(isNaN(d)) return '—';
  return pad2(d.getDate())+'-'+MONTHS[d.getMonth()]+'-'+d.getFullYear();
}
function fmtINR(n){
  n = Math.round(Number(n)||0);
  return '₹'+n.toLocaleString('en-IN');
}
function fmtPhone(p){
  p = String(p||'').replace(/\D/g,'');
  if(p.length===10) return '+91 '+p.slice(0,5)+' '+p.slice(5);
  return esc(p);
}
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function uid(p){ return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function read(key, fb){ try{ var v=localStorage.getItem(key); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
function write(key, v){ localStorage.setItem(key, JSON.stringify(v)); }
function daysFromNow(n){ var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.toISOString(); }
function isSelftest(){ try{ return new URLSearchParams(location.search).get('selftest')==='1'; }catch(e){ return false; } }

/* ---------------- store ---------------- */
var Store = {
  jobs: [], techs: [], amc: [],
  load: function(){
    this.jobs = read(K.jobs, []);
    this.techs = read(K.techs, []);
    this.amc = read(K.amc, []);
  },
  saveJobs: function(){ write(K.jobs, this.jobs); },
  saveTechs: function(){ write(K.techs, this.techs); },
  saveAmc: function(){ write(K.amc, this.amc); },

  addJob: function(d){
    var j = {
      id: uid('job'), customer: d.customer.trim(), phone: String(d.phone).replace(/\D/g,''),
      appliance: d.appliance.trim(), issue: d.issue.trim(),
      status: 'new', techId: d.techId||null, charge: Math.max(0, Math.round(Number(d.charge)||0)),
      createdAt: new Date().toISOString(), completedAt: null
    };
    this.jobs.unshift(j); this.saveJobs(); return j;
  },
  updateJob: function(id, patch){
    var j = this.jobs.find(function(x){return x.id===id;});
    if(!j) return null;
    var wasDone = j.status==='done';
    Object.keys(patch).forEach(function(k){ j[k]=patch[k]; });
    if(j.status==='done' && !wasDone) j.completedAt = new Date().toISOString();
    if(j.status!=='done') j.completedAt = null;
    this.saveJobs(); return j;
  },
  deleteJob: function(id){ this.jobs = this.jobs.filter(function(x){return x.id!==id;}); this.saveJobs(); },

  addTech: function(d){
    var t = {
      id: uid('tech'), name: d.name.trim(), phone: String(d.phone).replace(/\D/g,''),
      skills: String(d.skills||'').split(',').map(function(s){return s.trim();}).filter(Boolean)
    };
    this.techs.push(t); this.saveTechs(); return t;
  },
  updateTech: function(id, patch){
    var t = this.techs.find(function(x){return x.id===id;});
    if(!t) return null;
    Object.keys(patch).forEach(function(k){ t[k]=patch[k]; });
    this.saveTechs(); return t;
  },
  deleteTech: function(id){
    // unassign jobs held by this technician
    this.jobs.forEach(function(j){ if(j.techId===id){ j.techId=null; if(j.status!=='new') j.status='new'; } });
    this.saveJobs();
    this.techs = this.techs.filter(function(x){return x.id!==id;});
    this.saveTechs();
  },
  techName: function(id){
    var t = this.techs.find(function(x){return x.id===id;});
    return t ? t.name : 'Unassigned';
  },
  activeJobs: function(techId){
    return this.jobs.filter(function(j){ return j.techId===techId && j.status!=='done'; }).length;
  },

  addAmc: function(d){
    var r = {
      id: uid('amc'), customer: d.customer.trim(), phone: String(d.phone).replace(/\D/g,''),
      appliance: d.appliance.trim(), nextService: d.nextService, notes: (d.notes||'').trim()
    };
    this.amc.push(r); this.saveAmc(); return r;
  },
  updateAmc: function(id, patch){
    var r = this.amc.find(function(x){return x.id===id;});
    if(!r) return null;
    Object.keys(patch).forEach(function(k){ r[k]=patch[k]; });
    this.saveAmc(); return r;
  },
  deleteAmc: function(id){ this.amc = this.amc.filter(function(x){return x.id!==id;}); this.saveAmc(); },
  markServiced: function(id){
    var r = this.amc.find(function(x){return x.id===id;});
    if(!r) return null;
    var d = new Date(r.nextService); if(isNaN(d)) d = new Date();
    d.setFullYear(d.getFullYear()+1);
    r.nextService = d.toISOString(); this.saveAmc(); return r;
  }
};

function revenueThisMonth(){
  var now = new Date(), m = now.getMonth(), y = now.getFullYear();
  return Store.jobs.reduce(function(sum,j){
    if(j.status!=='done' || !j.completedAt) return sum;
    var d = new Date(j.completedAt);
    return (d.getMonth()===m && d.getFullYear()===y) ? sum + (Number(j.charge)||0) : sum;
  }, 0);
}
function amcBucket(r){
  var today = new Date(); today.setHours(0,0,0,0);
  var due = new Date(r.nextService); due.setHours(0,0,0,0);
  var diff = Math.round((due-today)/86400000);
  if(diff < 0) return 'overdue';
  if(diff <= 7) return 'dueweek';
  return 'upcoming';
}

/* ---------------- seed ---------------- */
function seedIfNeeded(){
  if(localStorage.getItem(K.seeded)) return;
  var t1 = { id:'tech_seed1', name:'Ramesh Gupta',  phone:'9820012345', skills:['AC Repair','Refrigerator'] };
  var t2 = { id:'tech_seed2', name:'Suresh Yadav',  phone:'9811187654', skills:['Washing Machine','Geyser','Cooler'] };
  var t3 = { id:'tech_seed3', name:'Priya Sharma',  phone:'9833345678', skills:['AC Service','Microwave','Cooler'] };
  Store.techs = [t1,t2,t3];

  function mkJob(o){ return Object.assign({ id:uid('job'), status:'new', techId:null, completedAt:null, createdAt:daysFromNow(-2) }, o); }
  var nowISO = new Date().toISOString();
  Store.jobs = [
    mkJob({ customer:'Amit Verma',   phone:'9810012345', appliance:'Split AC 1.5 Ton',  issue:'Not cooling properly since yesterday evening.', charge:450,  status:'new', createdAt:daysFromNow(-1) }),
    mkJob({ customer:'Neha Singh',   phone:'9898011122', appliance:'Washing Machine 7kg', issue:'Loud noise during spin cycle, machine vibrates.', charge:350, status:'new', createdAt:daysFromNow(0) }),
    mkJob({ customer:'Rajesh Kumar', phone:'9812233445', appliance:'Window AC 1 Ton',   issue:'Water dripping from indoor unit onto the wall.',  charge:400, status:'assigned', techId:'tech_seed1' }),
    mkJob({ customer:'Sunita Devi',  phone:'9877744112', appliance:'Refrigerator 260L', issue:'Freezer section not freezing, food spoiling.',      charge:550, status:'assigned', techId:'tech_seed2' }),
    mkJob({ customer:'Vikash Tiwari',phone:'9833127788', appliance:'Geyser 15L',        issue:'No hot water; MCB trips when switched on.',         charge:600, status:'in-progress', techId:'tech_seed2' }),
    mkJob({ customer:'Pooja Gupta',  phone:'9811445566', appliance:'Split AC 2 Ton',    issue:'Gas refill plus full general service.',             charge:1200,status:'in-progress', techId:'tech_seed1' }),
    mkJob({ customer:'Anil Mishra',  phone:'9822556677', appliance:'Cooler 45L',        issue:'Water pump not working, no cooling.',               charge:300, status:'done', techId:'tech_seed2', completedAt:nowISO }),
    mkJob({ customer:'Kavita Rao',   phone:'9819988776', appliance:'Microwave 28L',    issue:'Turntable not rotating, uneven heating.',           charge:380, status:'done', techId:'tech_seed3', completedAt:nowISO })
  ];

  Store.amc = [
    { id:uid('amc'), customer:'Mohan Lal',    phone:'9816677889', appliance:'Split AC × 2 (1.5T, 1T)', nextService:daysFromNow(-3),  notes:'Prefers Sunday visits' },
    { id:uid('amc'), customer:'Deepak Sharma',phone:'9823456789', appliance:'Window AC 1.5 Ton',       nextService:daysFromNow(2),   notes:'General service + filter clean' },
    { id:uid('amc'), customer:'Ritu Verma',   phone:'9834567890', appliance:'Refrigerator 300L',       nextService:daysFromNow(12),  notes:'Coil cleaning' },
    { id:uid('amc'), customer:'Sanjay Patel', phone:'9812345670', appliance:'Split AC 1 Ton',          nextService:daysFromNow(40),  notes:'Full deep service' }
  ];

  Store.saveTechs(); Store.saveJobs(); Store.saveAmc();
  localStorage.setItem(K.seeded,'1');
}

/* ---------------- toast ---------------- */
function toast(msg){
  var root = document.getElementById('toast-root');
  var el = document.createElement('div');
  el.className='toast'; el.textContent = msg;
  root.appendChild(el);
  setTimeout(function(){ el.remove(); }, 2600);
}

/* ---------------- modal ---------------- */
function openModal(title, bodyHTML, opts){
  opts = opts||{};
  var root = document.getElementById('modal-root');
  root.innerHTML =
    '<div class="modal-backdrop" id="modal-backdrop">'+
      '<div class="modal" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
        '<div class="modal-head"><h2>'+esc(title)+'</h2>'+
        '<button class="tool-btn" id="modal-close" type="button" aria-label="Close dialog">'+
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
        '<form class="modal-body" id="modal-form" novalidate>'+bodyHTML+
        '<div class="modal-foot"><button class="btn" type="button" id="modal-cancel">Cancel</button>'+
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
  return close;
}
function fieldErr(form, name, msg){
  var input = form.querySelector('[name="'+name+'"]');
  var f = input.closest('.field');
  var e = f.querySelector('.error');
  if(e) e.remove();
  if(msg){
    var d = document.createElement('div');
    d.className='error'; d.textContent=msg;
    f.appendChild(d);
    input.setAttribute('aria-invalid','true');
    return false;
  }
  input.removeAttribute('aria-invalid');
  return true;
}
function validPhone(v){ return /^\d{10}$/.test(String(v).replace(/\D/g,'')); }

/* ---------------- icons ---------------- */
var IC = {
  edit:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  phone:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg>'
};

/* ---------------- views ---------------- */
var viewTitles = {
  dashboard:['Dashboard','Today\u2019s shop floor at a glance'],
  board:['Job Board','Drag cards between stages, or use the arrows'],
  techs:['Technicians','Your field team and their workload'],
  amc:['AMC Reminders','Never miss a scheduled service visit']
};
var currentView = 'dashboard';
var amcFilter = 'all';

function setView(v){
  currentView = v;
  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.toggle('is-active', b.dataset.view===v); });
  document.querySelectorAll('.view').forEach(function(s){ s.classList.toggle('is-active', s.id==='view-'+v); });
  document.getElementById('view-title').textContent = viewTitles[v][0];
  document.getElementById('view-sub').textContent = viewTitles[v][1];
  renderTopbarActions();
  render();
}

function renderTopbarActions(){
  var el = document.getElementById('topbar-actions');
  var html = '';
  if(currentView==='board'||currentView==='dashboard')
    html += '<button class="btn accent" id="act-new-job" type="button">+ New Job Card</button>';
  if(currentView==='techs')
    html += '<button class="btn accent" id="act-new-tech" type="button">+ Add Technician</button>';
  if(currentView==='amc')
    html += '<button class="btn accent" id="act-new-amc" type="button">+ New Reminder</button>';
  el.innerHTML = html;
  var nj=document.getElementById('act-new-job'); if(nj) nj.onclick=openJobModal;
  var nt=document.getElementById('act-new-tech'); if(nt) nt.onclick=openTechModal;
  var na=document.getElementById('act-new-amc'); if(na) na.onclick=openAmcModal;
}

function render(){
  updateAmcBadge();
  if(currentView==='dashboard') renderDashboard();
  else if(currentView==='board') renderBoard();
  else if(currentView==='techs') renderTechs();
  else if(currentView==='amc') renderAmc();
}
function updateAmcBadge(){
  var n = Store.amc.filter(function(r){ var b=amcBucket(r); return b==='overdue'||b==='dueweek'; }).length;
  var badge = document.getElementById('amc-badge');
  badge.hidden = n===0;
  badge.textContent = n;
}

/* ----- dashboard ----- */
function renderDashboard(){
  var el = document.getElementById('view-dashboard');
  var counts = {};
  STATUSES.forEach(function(s){ counts[s]=0; });
  Store.jobs.forEach(function(j){ counts[j.status]=(counts[j.status]||0)+1; });
  var rev = revenueThisMonth();
  var maxLoad = Math.max(1, Math.max.apply(null, Store.techs.map(function(t){return Store.activeJobs(t.id);}).concat([0])));

  var cards = STATUSES.map(function(s){
    return '<div class="stat-card" style="--st:'+STATUS_META[s].color+'">'+
      '<div class="stat-label">'+STATUS_META[s].label+' Jobs</div>'+
      '<div class="stat-num">'+counts[s]+'</div></div>';
  }).join('');

  var workload = Store.techs.map(function(t){
    var n = Store.activeJobs(t.id);
    var pct = Math.round(n/maxLoad*100);
    return '<div class="workload-row">'+
      '<div class="workload-name">'+esc(t.name)+'</div>'+
      '<div class="workload-skills">'+esc(t.skills.join(', ')||'—')+'</div>'+
      '<div class="workload-bar" role="img" aria-label="'+esc(t.name)+' has '+n+' active jobs"><div class="workload-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="workload-count">'+n+' active</div></div>';
  }).join('') || '<div class="empty-state"><p>No technicians yet.</p></div>';

  var recent = Store.jobs.slice(0,5).map(function(j){
    return '<li><span><strong>'+esc(j.customer)+'</strong> · '+esc(j.appliance)+'</span>'+
      '<span class="pill '+j.status+'">'+STATUS_META[j.status].label+'</span></li>';
  }).join('') || '<li>No jobs yet.</li>';

  el.innerHTML =
    '<div class="stat-grid">'+cards+'</div>'+
    '<div class="revenue-card"><div><div class="stat-label">Revenue collected this month</div>'+
    '<div class="revenue-note">Completed jobs, updated live as jobs move to Done</div></div>'+
    '<div class="revenue-num">'+fmtINR(rev)+'</div></div>'+
    '<div class="panel"><h2>Technician workload</h2>'+workload+'</div>'+
    '<div class="panel"><h2>Latest job cards</h2><ul class="recent-list">'+recent+'</ul></div>';
}

/* ----- kanban board ----- */
function jobCardHTML(j){
  var meta = STATUS_META[j.status];
  var idx = STATUSES.indexOf(j.status);
  return '<article class="job-card" draggable="true" data-id="'+j.id+'" style="--st:'+meta.color+'" aria-label="Job for '+esc(j.customer)+'">'+
    '<div class="job-top"><span class="pill '+j.status+'">'+meta.label+'</span>'+
    '<span class="job-charge">'+fmtINR(j.charge)+'</span></div>'+
    '<div class="job-cust">'+esc(j.customer)+'</div>'+
    '<div class="job-appliance">'+esc(j.appliance)+'</div>'+
    '<p class="job-issue">'+esc(j.issue)+'</p>'+
    '<div class="job-meta"><span class="job-tech" title="'+esc(Store.techName(j.techId))+'">'+esc(Store.techName(j.techId))+'</span>'+
    '<span class="job-tech">'+fmtPhone(j.phone)+'</span></div>'+
    '<div class="job-actions"><div class="job-move">'+
      '<button class="move-btn" data-move="-1" type="button" aria-label="Move to previous stage" '+(idx===0?'disabled':'')+'>&#8249;</button>'+
      '<button class="move-btn" data-move="1" type="button" aria-label="Move to next stage" '+(idx===STATUSES.length-1?'disabled':'')+'>&#8250;</button>'+
    '</div><div class="job-tools">'+
      '<button class="tool-btn" data-edit type="button" aria-label="Edit job">'+IC.edit+'</button>'+
      '<button class="tool-btn danger" data-del type="button" aria-label="Delete job">'+IC.trash+'</button>'+
    '</div></div></article>';
}

function renderBoard(){
  var el = document.getElementById('view-board');
  el.innerHTML = '<div class="board" id="board">'+STATUSES.map(function(s){
    var jobs = Store.jobs.filter(function(j){return j.status===s;});
    var cards = jobs.map(jobCardHTML).join('') || '<div class="col-empty">No jobs here yet</div>';
    return '<div class="col" data-status="'+s+'"><div class="col-head">'+
      '<span class="col-title">'+STATUS_META[s].label+'</span>'+
      '<span class="col-count">'+jobs.length+'</span></div>'+
      '<div class="col-cards">'+cards+'</div></div>';
  }).join('')+'</div>';

  // card buttons
  el.querySelectorAll('.job-card').forEach(function(card){
    var id = card.dataset.id;
    card.querySelector('[data-edit]').onclick = function(){ openJobModal(id); };
    card.querySelector('[data-del]').onclick = function(){
      var j = Store.jobs.find(function(x){return x.id===id;});
      if(confirm('Delete job card for '+(j?j.customer:'this customer')+'?')){ Store.deleteJob(id); render(); toast('Job card deleted'); }
    };
    card.querySelectorAll('.move-btn').forEach(function(b){
      b.onclick = function(){
        var j = Store.jobs.find(function(x){return x.id===id;});
        var ni = STATUSES.indexOf(j.status)+Number(b.dataset.move);
        if(ni<0||ni>=STATUSES.length) return;
        Store.updateJob(id,{status:STATUSES[ni]});
        render(); toast('Moved to '+STATUS_META[STATUSES[ni]].label);
      };
    });
    // drag
    card.addEventListener('dragstart', function(e){
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed='move';
      setTimeout(function(){ card.classList.add('dragging'); },0);
    });
    card.addEventListener('dragend', function(){ card.classList.remove('dragging'); });
  });

  // columns as drop targets
  el.querySelectorAll('.col').forEach(function(col){
    col.addEventListener('dragover', function(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; col.classList.add('drag-over'); });
    col.addEventListener('dragleave', function(){ col.classList.remove('drag-over'); });
    col.addEventListener('drop', function(e){
      e.preventDefault(); col.classList.remove('drag-over');
      var id = e.dataTransfer.getData('text/plain');
      var j = Store.jobs.find(function(x){return x.id===id;});
      if(j && j.status!==col.dataset.status){
        Store.updateJob(id,{status:col.dataset.status});
        render(); toast('Moved to '+STATUS_META[col.dataset.status].label);
      }
    });
  });
}

/* ----- technicians ----- */
function renderTechs(){
  var el = document.getElementById('view-techs');
  var cards = Store.techs.map(function(t){
    var n = Store.activeJobs(t.id);
    return '<div class="tech-card">'+
      '<div class="tech-name">'+esc(t.name)+'</div>'+
      '<div class="tech-phone">'+IC.phone.replace('<svg','<svg style="vertical-align:-2px;margin-right:5px"')+' '+fmtPhone(t.phone)+'</div>'+
      '<div class="skill-tags">'+(t.skills.map(function(s){return '<span class="skill-tag">'+esc(s)+'</span>';}).join('')||'<span class="skill-tag">No skills listed</span>')+'</div>'+
      '<div class="tech-load"><span class="load-num">'+n+'</span><span>active job'+(n===1?'':'s')+'</span></div>'+
      '<div class="job-tools">'+
        '<button class="tool-btn" data-edit type="button" aria-label="Edit '+esc(t.name)+'">'+IC.edit+'</button>'+
        '<button class="tool-btn danger" data-del type="button" aria-label="Remove '+esc(t.name)+'">'+IC.trash+'</button>'+
      '</div></div>';
  }).join('');
  el.innerHTML = '<div class="tech-grid">'+(cards||'')+'</div>'+
    (Store.techs.length?'':'<div class="empty-state"><h3>No technicians yet</h3><p>Add your first technician to start assigning jobs.</p></div>');
  el.querySelectorAll('.tech-card').forEach(function(card, i){
    var t = Store.techs[i];
    card.querySelector('[data-edit]').onclick = function(){ openTechModal(t.id); };
    card.querySelector('[data-del]').onclick = function(){
      if(confirm('Remove '+t.name+'? Their jobs return to New / Unassigned.')){ Store.deleteTech(t.id); render(); toast('Technician removed'); }
    };
  });
}

/* ----- AMC ----- */
function renderAmc(){
  var el = document.getElementById('view-amc');
  var counts = { all:Store.amc.length, overdue:0, dueweek:0, upcoming:0 };
  Store.amc.forEach(function(r){ counts[amcBucket(r)]++; });
  function chip(k,label){ return '<button class="filter-chip'+(amcFilter===k?' is-active':'')+'" data-f="'+k+'" type="button">'+label+' ('+counts[k]+')</button>'; }
  var list = Store.amc
    .filter(function(r){ return amcFilter==='all' || amcBucket(r)===amcFilter; })
    .sort(function(a,b){ return new Date(a.nextService)-new Date(b.nextService); });

  var rows = list.map(function(r){
    var b = amcBucket(r);
    var pill = b==='overdue' ? '<span class="pill overdue">Overdue</span>'
             : b==='dueweek' ? '<span class="pill dueweek">Due this week</span>'
             : '<span class="pill upcoming">Upcoming</span>';
    return '<div class="amc-row" data-id="'+r.id+'">'+
      '<div class="amc-main"><div class="amc-cust">'+esc(r.customer)+'</div>'+
      '<div class="amc-detail">'+esc(r.appliance)+' · '+fmtPhone(r.phone)+(r.notes?' · '+esc(r.notes):'')+'</div></div>'+
      '<div class="amc-due"><div class="amc-date">'+fmtDate(r.nextService)+'</div>'+pill+'</div>'+
      '<div class="amc-actions">'+
        '<button class="btn small" data-serviced type="button" title="Mark serviced and push due date by one year">Mark serviced</button>'+
        '<button class="tool-btn" data-edit type="button" aria-label="Edit reminder">'+IC.edit+'</button>'+
        '<button class="tool-btn danger" data-del type="button" aria-label="Delete reminder">'+IC.trash+'</button>'+
      '</div></div>';
  }).join('');

  el.innerHTML =
    '<div class="amc-filters">'+chip('all','All')+chip('overdue','Overdue')+chip('dueweek','Due this week')+chip('upcoming','Upcoming')+'</div>'+
    (rows || '<div class="empty-state"><h3>No reminders here</h3><p>Add a customer\u2019s next-service date to get reminded.</p></div>');

  el.querySelectorAll('.filter-chip').forEach(function(c){ c.onclick=function(){ amcFilter=c.dataset.f; renderAmc(); }; });
  el.querySelectorAll('.amc-row').forEach(function(row){
    var id = row.dataset.id;
    row.querySelector('[data-serviced]').onclick=function(){ Store.markServiced(id); render(); toast('Serviced — next visit pushed by a year'); };
    row.querySelector('[data-edit]').onclick=function(){ openAmcModal(id); };
    row.querySelector('[data-del]').onclick=function(){
      var r=Store.amc.find(function(x){return x.id===id;});
      if(confirm('Delete reminder for '+(r?r.customer:'this customer')+'?')){ Store.deleteAmc(id); render(); toast('Reminder deleted'); }
    };
  });
}

/* ---------------- forms ---------------- */
function openJobModal(id){
  var j = id ? Store.jobs.find(function(x){return x.id===id;}) : null;
  var techOpts = '<option value="">Unassigned</option>'+Store.techs.map(function(t){
    return '<option value="'+t.id+'"'+(j&&j.techId===t.id?' selected':'')+'>'+esc(t.name)+'</option>';
  }).join('');
  var statusOpts = STATUSES.map(function(s){
    return '<option value="'+s+'"'+(j&&j.status===s?' selected':'')+'>'+STATUS_META[s].label+'</option>';
  }).join('');
  openModal(j?'Edit job card':'New job card',
    '<div class="form-row">'+
    '<div class="field"><label for="f-cust">Customer name</label><input id="f-cust" name="customer" value="'+esc(j?j.customer:'')+'" required maxlength="60" autocomplete="off"></div>'+
    '<div class="field"><label for="f-phone">Phone (10 digits)</label><input id="f-phone" name="phone" inputmode="numeric" maxlength="10" value="'+esc(j?j.phone:'')+'" required autocomplete="off"></div></div>'+
    '<div class="form-row">'+
    '<div class="field"><label for="f-app">Appliance</label><input id="f-app" name="appliance" placeholder="e.g. Split AC 1.5 Ton" value="'+esc(j?j.appliance:'')+'" required maxlength="60" autocomplete="off"></div>'+
    '<div class="field"><label for="f-charge">Charge (₹)</label><input id="f-charge" name="charge" type="number" min="0" step="1" value="'+(j?j.charge:'')+'" required></div></div>'+
    '<div class="field"><label for="f-issue">Issue description</label><textarea id="f-issue" name="issue" required maxlength="300">'+esc(j?j.issue:'')+'</textarea></div>'+
    '<div class="form-row">'+
    '<div class="field"><label for="f-tech">Assigned technician</label><select id="f-tech" name="techId">'+techOpts+'</select></div>'+
    '<div class="field"><label for="f-status">Status</label><select id="f-status" name="status">'+statusOpts+'</select></div></div>',
    { submitLabel: j?'Save changes':'Create job card', onSubmit: function(form){
      var ok = true;
      ok = fieldErr(form,'customer', form.customer.value.trim()?'':'Customer name is required') && ok;
      ok = fieldErr(form,'phone', validPhone(form.phone.value)?'':'Enter a valid 10-digit mobile number') && ok;
      ok = fieldErr(form,'appliance', form.appliance.value.trim()?'':'Appliance is required') && ok;
      ok = fieldErr(form,'charge', Number(form.charge.value)>=0&&form.charge.value!==''?'':'Enter a valid charge amount') && ok;
      ok = fieldErr(form,'issue', form.issue.value.trim()?'':'Describe the issue') && ok;
      if(!ok) return false;
      var data = {
        customer: form.customer.value, phone: form.phone.value,
        appliance: form.appliance.value, issue: form.issue.value,
        charge: form.charge.value, techId: form.techId.value||null, status: form.status.value
      };
      if(j) Store.updateJob(id, data); else Store.addJob(data);
      render(); toast(j?'Job card updated':'Job card created');
    }});
}

function openTechModal(id){
  var t = id ? Store.techs.find(function(x){return x.id===id;}) : null;
  openModal(t?'Edit technician':'Add technician',
    '<div class="form-row">'+
    '<div class="field"><label for="t-name">Name</label><input id="t-name" name="name" value="'+esc(t?t.name:'')+'" required maxlength="60" autocomplete="off"></div>'+
    '<div class="field"><label for="t-phone">Phone (10 digits)</label><input id="t-phone" name="phone" inputmode="numeric" maxlength="10" value="'+esc(t?t.phone:'')+'" required autocomplete="off"></div></div>'+
    '<div class="field"><label for="t-skills">Skills (comma separated)</label><input id="t-skills" name="skills" placeholder="e.g. AC Repair, Refrigerator" value="'+esc(t?t.skills.join(', '):'')+'" maxlength="120" autocomplete="off"><div class="hint">Shown on the technician card; helps you pick the right person.</div></div>',
    { submitLabel: t?'Save changes':'Add technician', onSubmit: function(form){
      var ok = true;
      ok = fieldErr(form,'name', form.name.value.trim()?'':'Name is required') && ok;
      ok = fieldErr(form,'phone', validPhone(form.phone.value)?'':'Enter a valid 10-digit mobile number') && ok;
      if(!ok) return false;
      var skills = form.skills.value.split(',').map(function(s){return s.trim();}).filter(Boolean);
      if(t) Store.updateTech(id,{name:form.name.value.trim(), phone:form.phone.value.replace(/\D/g,''), skills:skills});
      else Store.addTech({name:form.name.value, phone:form.phone.value, skills:form.skills.value});
      render(); toast(t?'Technician updated':'Technician added');
    }});
}

function openAmcModal(id){
  var r = id ? Store.amc.find(function(x){return x.id===id;}) : null;
  var def = r ? r.nextService.slice(0,10) : daysFromNow(30).slice(0,10);
  openModal(r?'Edit reminder':'New AMC reminder',
    '<div class="form-row">'+
    '<div class="field"><label for="a-cust">Customer name</label><input id="a-cust" name="customer" value="'+esc(r?r.customer:'')+'" required maxlength="60" autocomplete="off"></div>'+
    '<div class="field"><label for="a-phone">Phone (10 digits)</label><input id="a-phone" name="phone" inputmode="numeric" maxlength="10" value="'+esc(r?r.phone:'')+'" required autocomplete="off"></div></div>'+
    '<div class="form-row">'+
    '<div class="field"><label for="a-app">Appliance</label><input id="a-app" name="appliance" value="'+esc(r?r.appliance:'')+'" required maxlength="60" autocomplete="off"></div>'+
    '<div class="field"><label for="a-due">Next service due</label><input id="a-due" name="nextService" type="date" value="'+def+'" required></div></div>'+
    '<div class="field"><label for="a-notes">Notes (optional)</label><input id="a-notes" name="notes" value="'+esc(r?r.notes:'')+'" maxlength="120" autocomplete="off"></div>',
    { submitLabel: r?'Save changes':'Add reminder', onSubmit: function(form){
      var ok = true;
      ok = fieldErr(form,'customer', form.customer.value.trim()?'':'Customer name is required') && ok;
      ok = fieldErr(form,'phone', validPhone(form.phone.value)?'':'Enter a valid 10-digit mobile number') && ok;
      ok = fieldErr(form,'appliance', form.appliance.value.trim()?'':'Appliance is required') && ok;
      ok = fieldErr(form,'nextService', form.nextService.value?'':'Pick a due date') && ok;
      if(!ok) return false;
      var data = { customer:form.customer.value, phone:form.phone.value, appliance:form.appliance.value,
                   nextService:new Date(form.nextService.value+'T12:00:00').toISOString(), notes:form.notes.value };
      if(r) Store.updateAmc(id,data); else Store.addAmc(data);
      render(); toast(r?'Reminder updated':'Reminder added');
    }});
}

/* ---------------- selftest ---------------- */
function runSelftest(){
  var checks = [];
  var failReason = '';
  function check(name, ok){ checks.push([name, !!ok]); if(!ok && !failReason) failReason = name; }

  // backup existing namespace data so normal mode is untouched
  var backup = {};
  var startView = currentView;
  for(var i=0;i<localStorage.length;i++){
    var k = localStorage.key(i);
    if(k && k.indexOf(NS)===0) backup[k]=localStorage.getItem(k);
  }
  function wipeNS(){
    var ks=[];
    for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&k.indexOf(NS)===0) ks.push(k); }
    ks.forEach(function(k){ localStorage.removeItem(k); });
  }

  try{
    wipeNS();
    seedIfNeeded();
    check('seed flag set', localStorage.getItem(K.seeded)==='1');
    check('3 technicians seeded', Store.techs.length===3);
    check('8 jobs seeded', Store.jobs.length===8);
    check('4 AMC reminders seeded', Store.amc.length===4);

    // create job
    var j = Store.addJob({ customer:'Selftest Kumar', phone:'9000011111', appliance:'Split AC 1T', issue:'Selftest flow', charge:450, techId:null });
    check('job created', !!j && Store.jobs.length===9 && j.status==='new');
    check('phone validated digits', /^\d{10}$/.test(j.phone));

    // assign technician
    var tech = Store.techs[0];
    Store.updateJob(j.id, { techId: tech.id, status:'assigned' });
    var j2 = Store.jobs.find(function(x){return x.id===j.id;});
    check('technician assigned', j2.techId===tech.id && j2.status==='assigned');
    check('active job counted', Store.activeJobs(tech.id)>=1);

    // move through pipeline to done
    Store.updateJob(j.id, { status:'in-progress' });
    Store.updateJob(j.id, { status:'done' });
    var j3 = Store.jobs.find(function(x){return x.id===j.id;});
    check('reached done', j3.status==='done' && !!j3.completedAt);

    // revenue counted
    var rev = revenueThisMonth();
    check('revenue counted this month (>=450)', rev>=450);

    // AMC bucketing
    var buckets = Store.amc.map(amcBucket);
    check('overdue reminder flagged', buckets.indexOf('overdue')!==-1);
    check('due-this-week reminder flagged', buckets.indexOf('dueweek')!==-1);

    // persistence: fresh re-read from localStorage, re-render
    Store.load();
    render();
    var fresh = read(K.jobs, []);
    var fj = fresh.find(function(x){return x.id===j.id;});
    check('job persisted to localStorage', !!fj && fj.status==='done');
    var ftechs = read(K.techs, []);
    check('technicians persisted', ftechs.length===3);
    setView('board'); // render the kanban from the freshly loaded storage
    var colCount = document.querySelectorAll('#view-board .col[data-status="done"] .job-card').length;
    check('board re-rendered from storage', colCount>=1);
    setView(startView);
  }catch(e){
    check('no exception thrown ('+(e&&e.message||e)+')', false);
  }finally{
    // restore normal-mode data exactly
    wipeNS();
    Object.keys(backup).forEach(function(k){ localStorage.setItem(k, backup[k]); });
    Store.load();
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
  banner.textContent = title + (ok ? '' : ' — normal data restored, app intact');
  return ok;
}

/* ---------------- boot ---------------- */
function boot(){
  Store.load();
  seedIfNeeded();
  Store.load(); // pick up seeded data
  document.querySelectorAll('.nav-btn').forEach(function(b){
    b.addEventListener('click', function(){ setView(b.dataset.view); });
  });
  setView('dashboard');
  if(isSelftest()) runSelftest();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
