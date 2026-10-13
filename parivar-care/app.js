/* Parivar Care v1 — vanilla JS. Data in localStorage under pc_v1_* keys. */
(function(){
'use strict';
var PREFIX = 'pc_v1_';
var SLOT_ORDER = ['morning','afternoon','night'];
var SLOT_LABEL = {morning:'Morning', afternoon:'Afternoon', night:'Night'};
var SLOT_CLOCK = {morning:'8:00 AM', afternoon:'1:00 PM', night:'8:00 PM'};
var SLOT_HOUR  = {morning:8, afternoon:13, night:20};
var BLOOD_GROUPS = ['O+','O-','A+','A-','B+','B-','AB+','AB-'];
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ---------- tiny helpers ---------- */
function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function pad(n){ return String(n).padStart(2,'0'); }
function ymd(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function todayStr(){ return ymd(new Date()); }
function addDaysStr(s,n){ var p=s.split('-').map(Number); var d=new Date(p[0],p[1]-1,p[2]);
  d.setDate(d.getDate()+n); return ymd(d); }
function fmtD(s){ if(!s) return '—'; var p=s.split('-').map(Number);
  return p[2]+'-'+MONTHS[p[1]-1]+'-'+p[0]; }
function fmtTimeHM(hm){ var p=hm.split(':'); var h=+p[0], m=p[1];
  var ap=h>=12?'PM':'AM'; h=h%12; if(h===0)h=12; return h+':'+m+' '+ap; }
function diffDays(a,b){ var pa=a.split('-').map(Number), pb=b.split('-').map(Number);
  return Math.round((new Date(pb[0],pb[1]-1,pb[2])-new Date(pa[0],pa[1]-1,pa[2]))/86400000); }

/* ---------- icons (inline SVG, no emoji) ---------- */
var PATHS = {
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5h4v5"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.6c2.9.1 4.6 1.8 5 4.9"/>',
  pill:'<rect x="3.5" y="9" width="17" height="7" rx="3.5" transform="rotate(-35 12 12.5)"/><path d="M9.5 15.5l5-5"/>',
  calendar:'<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/><path d="M9 15.5l2 2 4-4.5"/>',
  siren:'<path d="M12 3.5a7 7 0 0 1 7 7v2l2 2.5H3l2-2.5v-2a7 7 0 0 1 7-7z"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M12 3.5V2"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/>',
  trash:'<path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6.5 7l1 13h9l1-13"/>',
  check:'<path d="M4.5 12.5l5 5 10-11"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  alert:'<path d="M12 3.5L22 20H2L12 3.5z"/><path d="M12 9.5v5M12 17.5v.01"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  heart:'<path d="M12 20s-7.5-4.6-9.5-9.3C1 7 3 4 6.5 4c2 0 3.7 1.2 4.5 2.7L12 8l1-1.3C13.8 5.2 15.5 4 17.5 4 21 4 23 7 21.5 10.7 19.5 15.4 12 20 12 20z"/>',
  drop:'<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>'
};
function icon(n){ return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+PATHS[n]+'</svg>'; }

/* ---------- storage ---------- */
function lsGet(k,fb){ try{ var v=localStorage.getItem(PREFIX+k); return v==null?fb:JSON.parse(v); }
  catch(e){ return fb; } }
function lsSet(k,v){ localStorage.setItem(PREFIX+k, JSON.stringify(v)); }
function wipeNamespace(){ Object.keys(localStorage).filter(function(k){return k.indexOf(PREFIX)===0;})
  .forEach(function(k){ localStorage.removeItem(k); }); }

var DB = {elders:[], checkins:[], medicines:[], doses:[]};
function loadAll(){ DB.elders=lsGet('elders',[]); DB.checkins=lsGet('checkins',[]);
  DB.medicines=lsGet('medicines',[]); DB.doses=lsGet('doses',[]); }
function persist(){ lsSet('elders',DB.elders); lsSet('checkins',DB.checkins);
  lsSet('medicines',DB.medicines); lsSet('doses',DB.doses); }

/* ---------- seed (first launch only) ---------- */
function seed(){
  wipeNamespace();
  var t = todayStr();
  var e1 = {id:uid(), name:'Shanti Devi', age:78, relation:'Mother', phone:'9820012345',
    address:'B-42, Shanti Nagar, Lucknow, Uttar Pradesh 226001', bloodGroup:'O+',
    medicalNotes:'Blood pressure — on daily medication. Knee arthritis, uses a walking stick. Allergic to penicillin.',
    emergName:'Vikram Yadav (son)', emergPhone:'9811045678', createdAt:t};
  var e2 = {id:uid(), name:'Ramesh Gupta', age:82, relation:'Father', phone:'9830045678',
    address:'B-42, Shanti Nagar, Lucknow, Uttar Pradesh 226001', bloodGroup:'B+',
    medicalNotes:'Type 2 diabetes — insulin at night. Early-stage cataract in left eye. Low-salt diet.',
    emergName:'Vikram Yadav (son)', emergPhone:'9811045678', createdAt:t};
  DB.elders=[e1,e2];
  DB.medicines=[
    {id:uid(), elderId:e1.id, name:'Amlodipine', dosage:'5 mg — 1 tablet', slots:['morning']},
    {id:uid(), elderId:e1.id, name:'Calcium + Vitamin D3', dosage:'500 mg — 1 tablet', slots:['morning','night']},
    {id:uid(), elderId:e2.id, name:'Metformin', dosage:'500 mg — 1 tablet', slots:['morning','night']},
    {id:uid(), elderId:e2.id, name:'Insulin Glargine', dosage:'10 units — injection', slots:['night']}
  ];
  /* 6 days of history each; today left unlogged so first use feels real */
  DB.checkins=[];
  var hist1=['ok','ok','ok','ok','ok','ok'];            /* D-6 .. D-1 */
  var hist2=['ok','ok','ok','missed','ok','missed'];    /* a missed day 3 days ago + missed yesterday */
  hist1.forEach(function(s,i){ DB.checkins.push({id:uid(),elderId:e1.id,date:addDaysStr(t,-(6-i)),status:s}); });
  hist2.forEach(function(s,i){ DB.checkins.push({id:uid(),elderId:e2.id,date:addDaysStr(t,-(6-i)),status:s}); });
  DB.doses=[];
  localStorage.setItem(PREFIX+'seeded','1');
  persist();
}

/* ---------- validation ---------- */
function validPhone(p){ return /^[6-9]\d{9}$/.test(String(p||'').trim()); }
function elderErrors(o){
  var e={};
  if(!o.name || !o.name.trim()) e.name='Please enter a name.';
  var age=Number(o.age);
  if(!o.age || !(age>=1 && age<=120)) e.age='Enter an age between 1 and 120.';
  if(!o.relation || !o.relation.trim()) e.relation='Relation is required (e.g. Mother, Uncle).';
  if(!validPhone(o.phone)) e.phone='Enter a valid 10-digit mobile number.';
  if(!o.emergName || !o.emergName.trim()) e.emergName='Emergency contact name is required.';
  if(!validPhone(o.emergPhone)) e.emergPhone='Enter a valid 10-digit number for the emergency contact.';
  return e;
}
function medicineErrors(o){
  var e={};
  if(!o.name || !o.name.trim()) e.name='Medicine name is required.';
  if(!o.dosage || !o.dosage.trim()) e.dosage='Dosage is required (e.g. “1 tablet”, “5 mg”).';
  if(!o.slots || !o.slots.length) e.slots='Pick at least one time of day.';
  return e;
}

/* ---------- domain: elders ---------- */
function addElder(o){ var errs=elderErrors(o); if(Object.keys(errs).length) return {ok:false,errors:errs};
  o.id=uid(); o.createdAt=todayStr(); DB.elders.push(o); persist(); return {ok:true,elder:o}; }
function updateElder(id,o){ var errs=elderErrors(o); if(Object.keys(errs).length) return {ok:false,errors:errs};
  var e=getElder(id); if(!e) return {ok:false,errors:{name:'Elder not found.'}};
  Object.keys(o).forEach(function(k){ if(k!=='id') e[k]=o[k]; }); persist(); return {ok:true,elder:e}; }
function deleteElder(id){ DB.elders=DB.elders.filter(function(e){return e.id!==id;});
  DB.checkins=DB.checkins.filter(function(c){return c.elderId!==id;});
  var mids=DB.medicines.filter(function(m){return m.elderId===id;}).map(function(m){return m.id;});
  DB.medicines=DB.medicines.filter(function(m){return m.elderId!==id;});
  DB.doses=DB.doses.filter(function(d){return d.elderId!==id && mids.indexOf(d.medId)<0;});
  persist(); }
function getElder(id){ return DB.elders.filter(function(e){return e.id===id;})[0]; }

/* ---------- domain: check-ins ---------- */
function logCheckin(elderId,date,status){
  if(['ok','missed'].indexOf(status)<0) return {ok:false};
  var ex=DB.checkins.filter(function(c){return c.elderId===elderId&&c.date===date;})[0];
  if(ex) ex.status=status; else DB.checkins.push({id:uid(),elderId:elderId,date:date,status:status});
  persist(); return {ok:true};
}
function checkinOn(elderId,date){
  return DB.checkins.filter(function(c){return c.elderId===elderId&&c.date===date;})[0]||null; }
function getStreak(elderId){
  var d=todayStr(), streak=0, c;
  if(!checkinOn(elderId,d)) d=addDaysStr(d,-1);   /* today not logged yet: count from yesterday */
  while((c=checkinOn(elderId,d)) && c.status==='ok'){ streak++; d=addDaysStr(d,-1); }
  return streak;
}
function missedYesterday(){
  var y=addDaysStr(todayStr(),-1);
  return DB.elders.filter(function(e){ var c=checkinOn(e.id,y); return !c||c.status==='missed'; })
    .map(function(e){ var c=checkinOn(e.id,y);
      return {elder:e, reason:c?'Marked missed':'No check-in logged'}; });
}

/* ---------- domain: medicines & doses ---------- */
function activeMeds(elderId){ return DB.medicines.filter(function(m){return m.elderId===elderId;}); }
function getMed(id){ return DB.medicines.filter(function(m){return m.id===id;})[0]; }
function addMedicine(elderId,o){ var errs=medicineErrors(o); if(Object.keys(errs).length) return {ok:false,errors:errs};
  o.id=uid(); o.elderId=elderId; DB.medicines.push(o); persist(); return {ok:true,med:o}; }
function updateMedicine(id,o){ var errs=medicineErrors(o); if(Object.keys(errs).length) return {ok:false,errors:errs};
  var m=getMed(id); if(!m) return {ok:false,errors:{name:'Medicine not found.'}};
  m.name=o.name; m.dosage=o.dosage; m.slots=o.slots.slice().sort(function(a,b){return SLOT_ORDER.indexOf(a)-SLOT_ORDER.indexOf(b);});
  persist(); return {ok:true,med:m}; }
function deleteMedicine(id){ DB.medicines=DB.medicines.filter(function(m){return m.id!==id;});
  DB.doses=DB.doses.filter(function(d){return d.medId!==id;}); persist(); }
function doseTaken(elderId,medId,date,slot){
  return DB.doses.some(function(d){return d.elderId===elderId&&d.medId===medId&&d.date===date&&d.slot===slot;}); }
function markDose(elderId,medId,date,slot){
  if(doseTaken(elderId,medId,date,slot)) return false;
  DB.doses.push({id:uid(),elderId:elderId,medId:medId,date:date,slot:slot,takenAt:new Date().toISOString()});
  persist(); return true;
}
function unmarkDose(elderId,medId,date,slot){
  var n=DB.doses.length;
  DB.doses=DB.doses.filter(function(d){return !(d.elderId===elderId&&d.medId===medId&&d.date===date&&d.slot===slot);});
  if(DB.doses.length!==n){ persist(); return true; } return false;
}
function slotPassed(slot,dateStr){
  if(dateStr<todayStr()) return true;
  if(dateStr>todayStr()) return false;
  return new Date().getHours()>=SLOT_HOUR[slot];
}
function todayDue(elderId){
  var t=todayStr();
  var out=[];
  activeMeds(elderId).forEach(function(med){
    med.slots.forEach(function(slot){
      var taken=doseTaken(elderId,med.id,t,slot);
      out.push({med:med,slot:slot,taken:taken,overdue:!taken&&slotPassed(slot,t)});
    });
  });
  return out;
}
function missedDoses(elderId,days){
  days=days||7; var out=[]; var t=todayStr();
  for(var i=1;i<=days;i++){ var d=addDaysStr(t,-i);
    activeMeds(elderId).forEach(function(med){ med.slots.forEach(function(slot){
      if(!doseTaken(elderId,med.id,d,slot)) out.push({date:d,med:med,slot:slot});
    });});
  }
  return out;
}

/* ================= RENDER ================= */
var state={view:'dashboard'};

function pastelFor(i){ return ['tint-blush','tint-sage','tint-butter','tint-lilac'][i%4]; }
function initialOf(name){ return (name||'?').trim().charAt(0).toUpperCase(); }

function switchView(v){
  state.view=v;
  $$('.view').forEach(function(s){ s.hidden = s.id!=='view-'+v; });
  $$('.tab').forEach(function(b){
    if(b.dataset.view===v) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  render();
  window.scrollTo(0,0);
}

function render(){
  loadAll();
  var fn={dashboard:renderDashboard,elders:renderElders,medicines:renderMedicines,
          checkins:renderCheckins,sos:renderSOS}[state.view];
  var el=$('#view-'+state.view);
  el.innerHTML=fn();
  el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise');
  bindView();
}

function checkinBadge(e){
  var t=todayStr(), c=checkinOn(e.id,t);
  if(c&&c.status==='ok')   return '<span class="badge ok">'+icon('check')+'Checked in today</span>';
  if(c&&c.status==='missed')return '<span class="badge missed">'+icon('x')+'Missed today</span>';
  return '<span class="badge pending">'+icon('clock')+'Not logged yet</span>';
}

function doseSummary(e){
  var due=todayDue(e.id);
  var taken=due.filter(function(d){return d.taken;}).length;
  var pct=due.length?Math.round(taken/due.length*100):100;
  return {taken:taken,total:due.length,pct:pct,
    html:'<div class="stat"><span class="num">'+taken+'/'+due.length+'</span> <span class="lbl">doses taken today</span></div>'+
         '<div class="progress'+(pct<60?' low':'')+'" role="img" aria-label="'+taken+' of '+due.length+' doses taken"><i style="width:'+pct+'%"></i></div>'};
}

/* ----- dashboard ----- */
function renderDashboard(){
  var t=todayStr(), h='';
  h+='<div class="page-head"><div><h1>Today&rsquo;s care</h1>'+
     '<div class="date-line">'+fmtD(t)+' · '+DB.elders.length+' elder'+(DB.elders.length===1?'':'s')+' in your care</div></div></div>';
  var missed=missedYesterday();
  if(missed.length && DB.elders.length){
    h+='<div class="alert-strip" role="alert">'+icon('alert')+'<div><strong>Missed yesterday ('+fmtD(addDaysStr(t,-1))+')</strong>'+
       '<ul>'+missed.map(function(m){return '<li><strong>'+esc(m.elder.name)+'</strong> — '+esc(m.reason)+'</li>';}).join('')+'</ul></div></div>';
  }
  if(!DB.elders.length){
    h+='<div class="empty">'+icon('users')+'<h3>No elders added yet</h3>'+
       '<p>Add the elders you look after to start daily check-ins and medicine reminders.</p>'+
       '<button class="btn primary" data-act="add-elder">'+icon('plus')+'Add your first elder</button></div>';
    return h;
  }
  h+='<div class="elder-grid">';
  DB.elders.forEach(function(e,i){
    var ds=doseSummary(e), c=checkinOn(e.id,t);
    h+='<article class="card elder-card '+pastelFor(i)+'" data-elder="'+e.id+'">'+
      '<div class="elder-top"><span class="avatar" aria-hidden="true">'+esc(initialOf(e.name))+'</span>'+
      '<div><h2 class="elder-name">'+esc(e.name)+'</h2>'+
      '<div class="elder-meta">'+esc(e.relation)+' · '+e.age+' yrs · <span class="badge blood" style="font-size:.85rem;padding:.2rem .6rem">'+esc(e.bloodGroup)+'</span></div></div></div>'+
      '<div style="margin-bottom:.6rem">'+checkinBadge(e)+
      ' <span class="badge info">'+icon('heart')+getStreak(e.id)+'-day streak</span></div>'+
      ds.html;
    if(!c){
      h+='<div class="checkin-pair" role="group" aria-label="Log today&rsquo;s check-in for '+esc(e.name)+'">'+
        '<button class="checkin-btn ok" data-act="checkin" data-elder="'+e.id+'" data-status="ok">'+icon('check')+'Checked in</button>'+
        '<button class="checkin-btn missed" data-act="checkin" data-elder="'+e.id+'" data-status="missed">'+icon('x')+'Missed</button></div>';
    }else{
      h+='<div class="checkin-pair" role="group" aria-label="Change today&rsquo;s check-in for '+esc(e.name)+'">'+
        '<button class="checkin-btn ok'+(c.status==='ok'?' done':'')+'" data-act="checkin" data-elder="'+e.id+'" data-status="ok">'+icon('check')+'Checked in</button>'+
        '<button class="checkin-btn missed'+(c.status==='missed'?' done':'')+'" data-act="checkin" data-elder="'+e.id+'" data-status="missed">'+icon('x')+'Missed</button></div>';
    }
    h+='<div class="card-actions"><button class="btn ghost small" data-act="goto" data-view="sos">'+icon('siren')+'SOS card</button></div>';
    h+='</article>';
  });
  h+='</div>';
  return h;
}

/* ----- elders ----- */
function renderElders(){
  var h='<div class="page-head"><div><h1>Elders</h1><div class="sub">Everyone you look after, with their care details.</div></div>'+
    '<button class="btn primary" data-act="add-elder">'+icon('plus')+'Add elder</button></div>';
  if(!DB.elders.length){
    h+='<div class="empty">'+icon('users')+'<h3>No elders yet</h3><p>Add an elder to begin.</p>'+
       '<button class="btn primary" data-act="add-elder">'+icon('plus')+'Add elder</button></div>';
    return h;
  }
  DB.elders.forEach(function(e,i){
    h+='<article class="card '+pastelFor(i)+'">'+
      '<div class="elder-top"><span class="avatar" aria-hidden="true">'+esc(initialOf(e.name))+'</span>'+
      '<div style="flex:1"><h2 class="elder-name">'+esc(e.name)+'</h2>'+
      '<div class="elder-meta">'+esc(e.relation)+' · '+e.age+' years old · '+esc(e.phone)+'</div></div>'+
      '<span class="badge blood">'+icon('drop')+esc(e.bloodGroup)+'</span></div>'+
      '<dl class="detail-list">'+
      '<div><dt>Address</dt><dd>'+esc(e.address||'—')+'</dd></div>'+
      '<div><dt>Medical notes</dt><dd>'+esc(e.medicalNotes||'—')+'</dd></div>'+
      '<div><dt>Emergency contact</dt><dd>'+esc(e.emergName)+' · <a href="tel:+91'+esc(e.emergPhone)+'">'+esc(e.emergPhone)+'</a></dd></div>'+
      '</dl>'+
      '<div class="card-actions"><button class="btn ghost small" data-act="edit-elder" data-elder="'+e.id+'">'+icon('edit')+'Edit</button>'+
      '<button class="btn danger-ghost small" data-act="del-elder" data-elder="'+e.id+'">'+icon('trash')+'Remove</button></div>'+
      '</article>';
  });
  return h;
}

/* ----- medicines ----- */
function renderMedicines(){
  var h='<div class="page-head"><div><h1>Medicines</h1><div class="sub">Today&rsquo;s doses, missed doses, and schedules.</div></div></div>';
  if(!DB.elders.length){
    h+='<div class="empty">'+icon('pill')+'<h3>No elders yet</h3><p>Add an elder first, then their medicines.</p></div>';
    return h;
  }
  DB.elders.forEach(function(e,i){
    var meds=activeMeds(e.id), due=todayDue(e.id), missed=missedDoses(e.id,7);
    h+='<article class="card '+pastelFor(i)+'"><div class="med-head"><h3>'+esc(e.name)+'&rsquo;s medicines</h3>'+
       '<button class="btn primary small" data-act="add-med" data-elder="'+e.id+'">'+icon('plus')+'Add medicine</button></div>';
    if(!meds.length){
      h+='<div class="empty" style="padding:1.4rem"><p style="margin:0">No medicines scheduled yet.</p></div>';
    }else{
      h+='<h4 style="font-family:var(--font-body);font-size:1.05rem;margin:.4rem 0 .7rem">Today&rsquo;s doses — '+fmtD(todayStr())+'</h4>';
      due.forEach(function(d){
        var cls=d.taken?'taken':(d.overdue?'overdue':'');
        h+='<div class="dose-row '+cls+'"><span class="slot-chip">'+SLOT_LABEL[d.slot]+'</span>'+
           '<div class="dose-main"><div class="med-name">'+esc(d.med.name)+'</div><div class="med-dos">'+esc(d.med.dosage)+' · '+SLOT_CLOCK[d.slot]+'</div></div>';
        if(d.taken){
          h+='<span class="taken-note">'+icon('check')+'Taken</span>'+
             '<button class="btn ghost small" data-act="untake" data-elder="'+e.id+'" data-med="'+d.med.id+'" data-slot="'+d.slot+'">Undo</button>';
        }else{
          h+=(d.overdue?'<span class="overdue-note">Overdue</span>':'<span class="dose-time">Due '+SLOT_CLOCK[d.slot]+'</span>')+
             '<button class="btn primary small" data-act="take" data-elder="'+e.id+'" data-med="'+d.med.id+'" data-slot="'+d.slot+'">'+icon('check')+'Mark taken</button>';
        }
        h+='</div>';
      });
      if(missed.length){
        h+='<h4 style="font-family:var(--font-body);font-size:1.05rem;margin:1rem 0 .7rem;color:var(--danger)">Missed doses — last 7 days ('+missed.length+')</h4>';
        missed.slice(0,12).forEach(function(m){
          h+='<div class="dose-row overdue"><span class="slot-chip">'+SLOT_LABEL[m.slot]+'</span>'+
             '<div class="dose-main"><div class="med-name">'+esc(m.med.name)+'</div><div class="med-dos">'+fmtD(m.date)+'</div></div>'+
             '<span class="overdue-note">Not taken</span></div>';
        });
        if(missed.length>12) h+='<p class="dose-time">…and '+(missed.length-12)+' more.</p>';
      }
      h+='<div class="med-block"><h4 style="font-family:var(--font-body);font-size:1.05rem;margin:0 0 .7rem">Schedule</h4>';
      meds.forEach(function(m){
        h+='<div class="dose-row"><div class="dose-main"><div class="med-name">'+esc(m.name)+'</div>'+
           '<div class="med-dos">'+esc(m.dosage)+' · '+m.slots.map(function(s){return SLOT_LABEL[s];}).join(', ')+'</div></div>'+
           '<div class="row-actions"><button class="icon-btn" data-act="edit-med" data-med="'+m.id+'" aria-label="Edit '+esc(m.name)+'">'+icon('edit')+'</button>'+
           '<button class="icon-btn danger" data-act="del-med" data-med="'+m.id+'" aria-label="Delete '+esc(m.name)+'">'+icon('trash')+'</button></div></div>';
      });
      h+='</div>';
    }
    h+='</article>';
  });
  return h;
}

/* ----- check-ins ----- */
function renderCheckins(){
  var h='<div class="page-head"><div><h1>Check-ins</h1><div class="sub">One check-in per elder per day. Streaks count consecutive “checked in” days.</div></div></div>';
  if(!DB.elders.length){
    h+='<div class="empty">'+icon('calendar')+'<h3>No elders yet</h3></div>';
    return h;
  }
  var t=todayStr();
  DB.elders.forEach(function(e,i){
    h+='<article class="card '+pastelFor(i)+'"><div class="med-head"><h3>'+esc(e.name)+'</h3>'+
       '<span class="badge info">'+icon('heart')+getStreak(e.id)+'-day streak</span></div>'+
       '<div class="day-strip" role="list" aria-label="Last 14 days for '+esc(e.name)+'">';
    for(var k=13;k>=0;k--){
      var d=addDaysStr(t,-k), c=checkinOn(e.id,d);
      var cls=c?(c.status==='ok'?'ok':'missed'):'';
      if(d===t) cls+=' today';
      h+='<div class="day-cell '+cls+'" role="listitem" title="'+fmtD(d)+(c?': '+c.status:'')+'">'+
         '<span class="d">'+d.slice(8)+'</span>'+MONTHS[+d.slice(5,7)-1]+
         '<div>'+(c?(c.status==='ok'?'✓':'✗'):'·')+'</div></div>';
    }
    h+='</div><div class="checkin-pair" style="max-width:520px" role="group" aria-label="Log today for '+esc(e.name)+'">'+
       '<button class="checkin-btn ok" data-act="checkin" data-elder="'+e.id+'" data-status="ok">'+icon('check')+'Checked in today</button>'+
       '<button class="checkin-btn missed" data-act="checkin" data-elder="'+e.id+'" data-status="missed">'+icon('x')+'Missed today</button></div>'+
       '</article>';
  });
  return h;
}

/* ----- SOS ----- */
function renderSOS(){
  var h='<div class="page-head"><div><h1>SOS — emergency cards</h1>'+
    '<div class="sub">Big buttons for urgent moments. Keep this page bookmarked.</div></div></div>';
  if(!DB.elders.length){
    h+='<div class="empty">'+icon('siren')+'<h3>No elders yet</h3></div>';
    return h;
  }
  DB.elders.forEach(function(e){
    h+='<article class="card sos-card"><div class="elder-top">'+
       '<span class="avatar" aria-hidden="true">'+esc(initialOf(e.name))+'</span>'+
       '<div style="flex:1"><h2 class="elder-name">'+esc(e.name)+'</h2>'+
       '<div class="elder-meta">'+esc(e.relation)+' · '+e.age+' yrs</div></div>'+
       '<span class="badge blood">'+icon('drop')+esc(e.bloodGroup)+'</span></div>'+
       '<div class="sos-grid">'+
       '<a class="sos-btn call" href="tel:+91'+esc(e.phone)+'">'+icon('phone')+'Call '+esc(e.name.split(' ')[0])+'<br><small style="font-size:.85rem;font-weight:600">+91 '+esc(e.phone)+'</small></a>'+
       '<a class="sos-btn emergency" href="tel:+91'+esc(e.emergPhone)+'">'+icon('siren')+'Call emergency contact<br><small style="font-size:.85rem;font-weight:600">'+esc(e.emergName)+' · +91 '+esc(e.emergPhone)+'</small></a>'+
       '</div>'+
       '<div class="sos-info"><dl class="detail-list">'+
       '<div><dt>Blood group</dt><dd><strong>'+esc(e.bloodGroup)+'</strong></dd></div>'+
       '<div><dt>Address</dt><dd>'+esc(e.address||'—')+'</dd></div>'+
       '<div><dt>Medical notes (tell the doctor)</dt><dd>'+esc(e.medicalNotes||'—')+'</dd></div>'+
       '</dl></div></article>';
  });
  return h;
}

/* ================= MODAL & FORMS ================= */
function openModal(title, bodyHTML){
  closeModal();
  var root=$('#modal-root');
  root.innerHTML='<div class="modal-overlay" id="m-ov"><div class="modal" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
    '<h2>'+esc(title)+'</h2><div id="m-body">'+bodyHTML+'</div></div></div>';
  var ov=$('#m-ov');
  requestAnimationFrame(function(){ ov.classList.add('show'); });
  ov.addEventListener('click',function(ev){ if(ev.target===ov) closeModal(); });
  document.addEventListener('keydown',escClose);
  var f=$('#m-body input, #m-body select, #m-body textarea'); if(f) f.focus();
}
function escClose(ev){ if(ev.key==='Escape') closeModal(); }
function closeModal(){ $('#modal-root').innerHTML=''; document.removeEventListener('keydown',escClose); }
function fieldErr(id,msg){ var el=$('#err-'+id); if(el) el.textContent=msg||''; }
function showErrors(errs){ Object.keys(errs).forEach(function(k){ fieldErr(k,errs[k]); }); }

function elderFormHTML(e){
  e=e||{};
  function f(id,label,inner,hint){
    return '<div class="field"><label for="f-'+id+'">'+label+'</label>'+inner+
      '<div class="err" id="err-'+id+'"></div>'+(hint?'<div class="hint">'+hint+'</div>':'')+'</div>';
  }
  var bg=BLOOD_GROUPS.map(function(b){return '<option value="'+b+'"'+(e.bloodGroup===b?' selected':'')+'>'+b+'</option>';}).join('');
  return '<form id="elder-form" novalidate>'+
    f('name','Full name *','<input id="f-name" name="name" value="'+esc(e.name||'')+'" autocomplete="off">')+
    f('age','Age *','<input id="f-age" name="age" type="number" min="1" max="120" value="'+esc(e.age||'')+'">')+
    f('relation','Relation *','<input id="f-relation" name="relation" value="'+esc(e.relation||'')+'" placeholder="Mother, Father, Uncle…">')+
    f('phone','Mobile number *','<input id="f-phone" name="phone" inputmode="numeric" maxlength="10" value="'+esc(e.phone||'')+'">','10-digit Indian mobile number')+
    f('emergName','Emergency contact name *','<input id="f-emergName" name="emergName" value="'+esc(e.emergName||'')+'" placeholder="e.g. Vikram Yadav (son)">')+
    f('emergPhone','Emergency contact number *','<input id="f-emergPhone" name="emergPhone" inputmode="numeric" maxlength="10" value="'+esc(e.emergPhone||'')+'">')+
    f('bloodGroup','Blood group','<select id="f-bloodGroup" name="bloodGroup"><option value="">—</option>'+bg+'</select>')+
    f('address','Address','<textarea id="f-address" name="address">'+esc(e.address||'')+'</textarea>')+
    f('medicalNotes','Medical notes','<textarea id="f-medicalNotes" name="medicalNotes" placeholder="Conditions, allergies, diet…">'+esc(e.medicalNotes||'')+'</textarea>','Shown on the SOS card for emergencies')+
    '<div class="modal-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancel</button>'+
    '<button type="submit" class="btn primary">'+(e.id?'Save changes':'Add elder')+'</button></div></form>';
}
function openElderForm(e){
  openModal(e&&e.id?'Edit elder':'Add elder', elderFormHTML(e));
  $('#elder-form').addEventListener('submit',function(ev){
    ev.preventDefault();
    var fd=new FormData(ev.target);
    var o={name:fd.get('name'),age:fd.get('age'),relation:fd.get('relation'),phone:fd.get('phone'),
           emergName:fd.get('emergName'),emergPhone:fd.get('emergPhone'),bloodGroup:fd.get('bloodGroup'),
           address:fd.get('address'),medicalNotes:fd.get('medicalNotes')};
    var r=(e&&e.id)?updateElder(e.id,o):addElder(o);
    if(!r.ok){ showErrors(r.errors); return; }
    closeModal(); render();
  });
}

function medFormHTML(m){
  m=m||{slots:['morning']};
  var boxes=SLOT_ORDER.map(function(s){
    var on=(m.slots||[]).indexOf(s)>=0?' checked':'';
    return '<label class="check-pill"><input type="checkbox" name="slots" value="'+s+'"'+on+'>'+SLOT_LABEL[s]+'</label>';
  }).join('');
  return '<form id="med-form" novalidate>'+
    '<div class="field"><label for="f-mname">Medicine name *</label>'+
    '<input id="f-mname" name="name" value="'+esc(m.name||'')+'" autocomplete="off"><div class="err" id="err-name"></div></div>'+
    '<div class="field"><label for="f-mdos">Dosage *</label>'+
    '<input id="f-mdos" name="dosage" value="'+esc(m.dosage||'')+'" placeholder="e.g. 1 tablet, 5 mg"><div class="err" id="err-dosage"></div></div>'+
    '<div class="field"><label>Times per day *</label><div class="checks">'+boxes+'</div><div class="err" id="err-slots"></div></div>'+
    '<div class="modal-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancel</button>'+
    '<button type="submit" class="btn primary">'+(m.id?'Save changes':'Add medicine')+'</button></div></form>';
}
function openMedForm(elderId,m){
  var e=getElder(elderId);
  openModal((m&&m.id?'Edit medicine':'Add medicine')+' — '+e.name, medFormHTML(m));
  $('#med-form').addEventListener('submit',function(ev){
    ev.preventDefault();
    var fd=new FormData(ev.target);
    var slots=fd.getAll('slots');
    var o={name:fd.get('name'),dosage:fd.get('dosage'),slots:slots};
    var r=(m&&m.id)?updateMedicine(m.id,o):addMedicine(elderId,o);
    if(!r.ok){ showErrors(r.errors); return; }
    closeModal(); render();
  });
}

/* ================= EVENTS ================= */
function bindView(){
  $$('#app [data-act]').forEach(function(b){
    b.addEventListener('click',function(ev){
      var act=b.dataset.act, id=b.dataset.elder, med=b.dataset.med;
      if(act==='add-elder') openElderForm(null);
      else if(act==='edit-elder') openElderForm(getElder(id));
      else if(act==='del-elder'){
        var e=getElder(id);
        if(confirm('Remove '+e.name+' and all their check-ins, medicines and dose records?')){ deleteElder(id); render(); }
      }
      else if(act==='add-med') openMedForm(id,null);
      else if(act==='edit-med') openMedForm(getMed(med).elderId,getMed(med));
      else if(act==='del-med'){
        var m=getMed(med);
        if(confirm('Delete “'+m.name+'” and its dose history?')){ deleteMedicine(med); render(); }
      }
      else if(act==='checkin'){ logCheckin(id,todayStr(),b.dataset.status); render(); }
      else if(act==='take'){ markDose(id,med,todayStr(),b.dataset.slot); render(); }
      else if(act==='untake'){ unmarkDose(id,med,todayStr(),b.dataset.slot); render(); }
      else if(act==='goto') switchView(b.dataset.view);
      else if(act==='close-modal') closeModal();
    });
  });
}
$$('.tab').forEach(function(b){ b.addEventListener('click',function(){ switchView(b.dataset.view); }); });

/* ================= SELFTEST ================= */
function runSelftest(){
  var results=[];
  function t(name,cond){ results.push({name:name,ok:!!cond}); }
  try{
    /* (a) wipe */
    wipeNamespace();
    t('namespace wiped', Object.keys(localStorage).filter(function(k){return k.indexOf(PREFIX)===0;}).length===0);
    /* (b) seed */
    seed(); loadAll();
    var e1=DB.elders[0], e2=DB.elders[1];
    t('seeded 2 elders', DB.elders.length===2);
    t('seeded 4 medicines', DB.medicines.length===4);
    t('seeded 12 check-ins (6 days × 2)', DB.checkins.length===12);
    t('seeded flag set', localStorage.getItem(PREFIX+'seeded')==='1');
    /* (c) streak math on seed */
    t('streak e1 before today = 6', getStreak(e1.id)===6);
    t('streak e2 before today = 0 (missed yesterday)', getStreak(e2.id)===0);
    var my=missedYesterday();
    t('missed-yesterday flags e2', my.length===1 && my[0].elder.id===e2.id);
    /* add elder */
    var r=addElder({name:'Test Dadi',age:70,relation:'Grandmother',phone:'9999999999',
      emergName:'Test Beta',emergPhone:'8888888888',bloodGroup:'A+',address:'Test address',medicalNotes:'Test notes'});
    t('add elder ok', r.ok===true && DB.elders.length===3);
    var ne=r.elder;
    var bad=addElder({name:'Bad',age:70,relation:'X',phone:'123',emergName:'Y',emergPhone:'8888888888'});
    t('invalid phone rejected', bad.ok===false && bad.errors.phone);
    /* log check-in */
    logCheckin(ne.id,todayStr(),'ok');
    t('today check-in recorded', checkinOn(ne.id,todayStr()).status==='ok');
    t('streak new elder = 1', getStreak(ne.id)===1);
    logCheckin(e1.id,todayStr(),'ok');
    t('streak e1 after today = 7', getStreak(e1.id)===7);
    logCheckin(e1.id,todayStr(),'missed'); /* upsert same day */
    t('same-day check-in upserts (still 1 record)', DB.checkins.filter(function(c){return c.elderId===e1.id&&c.date===todayStr();}).length===1);
    logCheckin(e1.id,todayStr(),'ok');
    /* add medicine + dose flow */
    var mr=addMedicine(ne.id,{name:'TestMed',dosage:'1 tablet',slots:['morning','night']});
    t('add medicine ok', mr.ok===true && activeMeds(ne.id).length===1);
    var med=mr.med;
    var dueBefore=todayDue(ne.id);
    t('due list has 2 slots before marking', dueBefore.length===2 && dueBefore.every(function(d){return !d.taken;}));
    t('mark dose taken', markDose(ne.id,med.id,todayStr(),'morning')===true);
    t('duplicate mark blocked', markDose(ne.id,med.id,todayStr(),'morning')===false);
    var dueAfter=todayDue(ne.id);
    t('due list shrinks to 1 pending', dueAfter.length===2 && dueAfter.filter(function(d){return !d.taken;}).length===1);
    t('morning slot no longer due', dueAfter.filter(function(d){return d.slot==='morning';})[0].taken===true);
    t('missed doses math on e2 >= 2', missedDoses(e2.id,7).length>=2);
    t('undo dose works', unmarkDose(ne.id,med.id,todayStr(),'morning')===true && !doseTaken(ne.id,med.id,todayStr(),'morning'));
    markDose(ne.id,med.id,todayStr(),'morning'); /* restore */
    /* (d) persistence: fresh re-read + re-render */
    var snapE=DB.elders.length, snapM=DB.medicines.length, snapC=DB.checkins.length, snapD=DB.doses.length;
    loadAll();
    t('re-read elders from localStorage', DB.elders.length===snapE);
    t('re-read medicines from localStorage', DB.medicines.length===snapM);
    t('re-read check-ins from localStorage', DB.checkins.length===snapC);
    t('re-read doses from localStorage', DB.doses.length===snapD);
    switchView('dashboard');
    t('dashboard renders 3 elder cards', $$('#view-dashboard .elder-card').length===3);
    switchView('medicines');
    t('medicines view renders dose rows', $$('#view-medicines .dose-row').length>0);
    switchView('sos');
    t('sos view renders call buttons', $$('#view-sos .sos-btn').length===DB.elders.length*2);
    switchView('dashboard');
  }catch(err){
    results.push({name:'EXCEPTION: '+(err&&err.message),ok:false});
  }
  var pass=results.filter(function(r){return r.ok;}).length, n=results.length;
  var okAll=pass===n;
  document.title=(okAll?'SELFTEST PASS ':'SELFTEST FAIL: ')+pass+'/'+n+' — Parivar Care';
  var banner=$('#selftest-banner');
  banner.hidden=false;
  banner.className='selftest-banner '+(okAll?'pass':'fail');
  var fails=results.filter(function(r){return !r.ok;}).map(function(r){return r.name;});
  banner.innerHTML=(okAll?'SELFTEST PASS '+pass+'/'+n:'SELFTEST FAIL: '+fails.join('; '));
  console.log('[selftest] '+(okAll?'PASS':'FAIL')+' '+pass+'/'+n, fails);
  if(!okAll) console.log('[selftest] all results:',results);
}

/* ================= INIT ================= */
function init(){
  var qs=new URLSearchParams(location.search);
  if(qs.get('selftest')==='1'){ runSelftest(); return; }
  if(!localStorage.getItem(PREFIX+'seeded')) seed();
  loadAll();
  switchView('dashboard');
}
init();
})();
