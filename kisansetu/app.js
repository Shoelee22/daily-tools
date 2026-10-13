/* KisanSetu v1 — vanilla JS. Data in localStorage under ks_v1_* keys. */
(function(){
'use strict';
var PREFIX='ks_v1_';
var CATS=['seeds','fertilizer','labour','irrigation','other'];
var CAT_LABEL={seeds:'Seeds',fertilizer:'Fertilizer',labour:'Labour',irrigation:'Irrigation',other:'Other'};
var SCHEME_STATUS=['To apply','Applied','Received','Expired'];
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function $(s,r){return (r||document).querySelector(s);}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function pad(n){return String(n).padStart(2,'0');}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function todayStr(){return ymd(new Date());}
function addDaysStr(s,n){var p=s.split('-').map(Number);var d=new Date(p[0],p[1]-1,p[2]);
  d.setDate(d.getDate()+n);return ymd(d);}
function fmtD(s){if(!s)return '—';var p=s.split('-').map(Number);return p[2]+'-'+MONTHS[p[1]-1]+'-'+p[0];}
function inr(n){return '₹'+Number(n).toLocaleString('en-IN');}
function diffDays(from,to){var a=from.split('-').map(Number),b=to.split('-').map(Number);
  return Math.round((new Date(b[0],b[1]-1,b[2])-new Date(a[0],a[1]-1,a[2]))/86400000);}
function monthKey(s){return s.slice(0,7);}
function monthLabel(k){var p=k.split('-');return MONTHS[+p[1]-1]+' '+p[0];}

var PATHS={
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/>',
  trash:'<path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6.5 7l1 13h9l1-13"/>',
  check:'<path d="M4.5 12.5l5 5 10-11"/>',
  alert:'<path d="M12 3.5L22 20H2L12 3.5z"/><path d="M12 9.5v5M12 17.5v.01"/>',
  calendar:'<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>',
  wallet:'<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2"/>',
  sprout:'<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 8-7 0 5-3.5 8-8 7z"/><path d="M12 13c0-4-3-7-8-7 0 5 3.5 8 8 7z"/>',
  doc:'<path d="M6 3.5h8L19 8.5V20.5H6z"/><path d="M14 3.5V8.5h5"/>',
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  down:'<path d="M12 5v14M5 12l7 7 7-7"/>',
  flat:'<path d="M5 12h14"/>'
};
function icon(n){return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+PATHS[n]+'</svg>';}

/* ---------- storage ---------- */
function lsGet(k,fb){try{var v=localStorage.getItem(PREFIX+k);return v==null?fb:JSON.parse(v);}catch(e){return fb;}}
function lsSet(k,v){localStorage.setItem(PREFIX+k,JSON.stringify(v));}
function wipeNamespace(){Object.keys(localStorage).filter(function(k){return k.indexOf(PREFIX)===0;})
  .forEach(function(k){localStorage.removeItem(k);});}

var DB={prices:[],expenses:[],schemes:[]};
function loadAll(){DB.prices=lsGet('prices',[]);DB.expenses=lsGet('expenses',[]);DB.schemes=lsGet('schemes',[]);}
function persist(){lsSet('prices',DB.prices);lsSet('expenses',DB.expenses);lsSet('schemes',DB.schemes);}

/* ---------- seed ---------- */
function seed(){
  wipeNamespace();
  var t=todayStr();
  function P(crop,mandi,price,date){return {id:uid(),crop:crop,mandi:mandi,price:price,date:date};}
  DB.prices=[
    P('Wheat','Nashik Mandi',2425,t), P('Wheat','Indore Mandi',2385,t),
    P('Wheat','Nashik Mandi',2310,addDaysStr(t,-7)), P('Wheat','Nashik Mandi',2275,addDaysStr(t,-14)),
    P('Paddy','Nashik Mandi',2183,t), P('Paddy','Indore Mandi',2140,t),
    P('Paddy','Nashik Mandi',2090,addDaysStr(t,-7)),
    P('Soybean','Indore Mandi',4892,t), P('Soybean','Nashik Mandi',4810,t),
    P('Soybean','Indore Mandi',4720,addDaysStr(t,-7)),
    P('Cotton','Nashik Mandi',7121,t), P('Cotton','Indore Mandi',7020,t),
    P('Cotton','Nashik Mandi',6950,addDaysStr(t,-14)),
    P('Maize','Nashik Mandi',2225,t), P('Maize','Indore Mandi',2180,t),
    P('Onion','Nashik Mandi',1650,t), P('Onion','Indore Mandi',1580,t),
    P('Onion','Nashik Mandi',1420,addDaysStr(t,-7))
  ];
  function E(date,cat,amount,note){return {id:uid(),date:date,category:cat,amount:amount,note:note};}
  DB.expenses=[
    E(addDaysStr(t,-11),'seeds',4500,'Wheat seed — 2 quintal'),
    E(addDaysStr(t,-8),'fertilizer',12800,'DAP + urea for rabi sowing'),
    E(addDaysStr(t,-6),'labour',3200,'Sowing labour — 4 workers'),
    E(addDaysStr(t,-4),'irrigation',2150,'Diesel for pump set'),
    E(addDaysStr(t,-2),'other',1100,'Transport to mandi'),
    E(addDaysStr(t,-28),'seeds',6200,'Soybean seed'),
    E(addDaysStr(t,-15),'labour',2800,'Harvest labour'),
    E(addDaysStr(t,-31),'fertilizer',8400,'Potash + micronutrients')
  ];
  function S(name,deadline,benefit,status,note){
    return {id:uid(),name:name,deadline:deadline,benefit:benefit,status:status,note:note};}
  DB.schemes=[
    S('PM-KISAN Samman Nidhi',addDaysStr(t,48),'₹6,000 per year in 3 instalments — eKYC mandatory for the next instalment.','To apply','Illustrative date — verify on pmkisan.gov.in. Edit as needed.'),
    S('PMFBY — Rabi crop insurance enrolment',addDaysStr(t,58),'Crop-loss cover; farmer premium only 1.5% for rabi crops. Enrol via bank or CSC.','To apply','Illustrative window — confirm with your bank / CSC. Edit as needed.'),
    S('Soil Health Card — sample collection drive',addDaysStr(t,-13),'Free soil testing with fertilizer guidance for your fields.','Expired','Illustrative date — the next drive will be announced locally.'),
    S('KCC — Kisan Credit Card','', 'Crop loans up to ₹3 lakh at 4% effective interest on timely repayment. Apply at your bank anytime.','To apply','No fixed deadline — apply anytime.')
  ];
  localStorage.setItem(PREFIX+'seeded','1');
  persist();
}

/* ---------- validation ---------- */
function priceErrors(o){var e={};
  if(!o.crop||!o.crop.trim())e.crop='Crop name is required.';
  if(!o.mandi||!o.mandi.trim())e.mandi='Mandi name is required.';
  var p=Number(o.price);
  if(o.price===''||o.price==null||!(p>0))e.price='Enter a price above ₹0.';
  if(!o.date)e.date='Date is required.';
  return e;}
function expenseErrors(o){var e={};
  if(!o.date)e.date='Date is required.';
  if(CATS.indexOf(o.category)<0)e.category='Pick a category.';
  var a=Number(o.amount);
  if(o.amount===''||o.amount==null||!(a>0))e.amount='Enter an amount above ₹0.';
  return e;}
function schemeErrors(o){var e={};
  if(!o.name||!o.name.trim())e.name='Scheme name is required.';
  if(o.deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(o.deadline))e.deadline='Use a valid date or leave blank.';
  return e;}

/* ---------- domain: prices ---------- */
function addPrice(o){var e=priceErrors(o);if(Object.keys(e).length)return{ok:false,errors:e};
  o.id=uid();o.price=Number(o.price);DB.prices.push(o);persist();return{ok:true,price:o};}
function updatePrice(id,o){var e=priceErrors(o);if(Object.keys(e).length)return{ok:false,errors:e};
  var p=getPrice(id);if(!p)return{ok:false,errors:{crop:'Not found.'}};
  p.crop=o.crop;p.mandi=o.mandi;p.price=Number(o.price);p.date=o.date;persist();return{ok:true,price:p};}
function deletePrice(id){DB.prices=DB.prices.filter(function(p){return p.id!==id;});persist();}
function getPrice(id){return DB.prices.filter(function(p){return p.id===id;})[0];}
function crops(){var s={},out=[];DB.prices.forEach(function(p){if(!s[p.crop]){s[p.crop]=1;out.push(p.crop);}});
  return out.sort();}
function latestPrice(crop){
  var list=DB.prices.filter(function(p){return p.crop===crop;});
  if(!list.length)return null;
  return list.slice().sort(function(a,b){
    if(a.date!==b.date)return a.date<b.date?1:-1;
    if(a.price!==b.price)return a.price<b.price?1:-1;
    return a.id<b.id?1:-1;})[0];}
function priceHistory(crop){
  return DB.prices.filter(function(p){return p.crop===crop;})
    .sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0;});}
function priceTrend(crop){ /* vs previous distinct-date entry */
  var h=priceHistory(crop);var l=latestPrice(crop);
  if(!l||h.length<2)return{dir:'flat',diff:0};
  var prev=h.filter(function(p){return p.date<l.date;})[0]||h[1];
  var diff=l.price-prev.price;
  return{dir:diff>0?'up':diff<0?'down':'flat',diff:diff};}

/* ---------- domain: expenses ---------- */
function addExpense(o){var e=expenseErrors(o);if(Object.keys(e).length)return{ok:false,errors:e};
  o.id=uid();o.amount=Number(o.amount);DB.expenses.push(o);persist();return{ok:true,expense:o};}
function updateExpense(id,o){var e=expenseErrors(o);if(Object.keys(e).length)return{ok:false,errors:e};
  var x=getExpense(id);if(!x)return{ok:false,errors:{date:'Not found.'}};
  x.date=o.date;x.category=o.category;x.amount=Number(o.amount);x.note=o.note;persist();return{ok:true,expense:x};}
function deleteExpense(id){DB.expenses=DB.expenses.filter(function(x){return x.id!==id;});persist();}
function getExpense(id){return DB.expenses.filter(function(x){return x.id===id;})[0];}
function monthTotal(mk){return DB.expenses.filter(function(x){return monthKey(x.date)===mk;})
  .reduce(function(s,x){return s+x.amount;},0);}
function totalsByCategory(list){var t={};CATS.forEach(function(c){t[c]=0;});
  (list||DB.expenses).forEach(function(x){t[x.category]=(t[x.category]||0)+x.amount;});return t;}
function expenseMonths(){var s={};DB.expenses.forEach(function(x){s[monthKey(x.date)]=1;});
  var mk=monthKey(todayStr());s[mk]=1;return Object.keys(s).sort().reverse();}

/* ---------- domain: schemes ---------- */
function addScheme(o){var e=schemeErrors(o);if(Object.keys(e).length)return{ok:false,errors:e};
  o.id=uid();DB.schemes.push(o);persist();return{ok:true,scheme:o};}
function updateScheme(id,o){var e=schemeErrors(o);if(Object.keys(e).length)return{ok:false,errors:e};
  var s=getScheme(id);if(!s)return{ok:false,errors:{name:'Not found.'}};
  s.name=o.name;s.deadline=o.deadline||'';s.benefit=o.benefit;s.status=o.status;s.note=o.note;
  persist();return{ok:true,scheme:s};}
function deleteScheme(id){DB.schemes=DB.schemes.filter(function(s){return s.id!==id;});persist();}
function getScheme(id){return DB.schemes.filter(function(s){return s.id===id;})[0];}
function schemeGroups(){
  var t=todayStr(),up=[],past=[],open=[];
  DB.schemes.forEach(function(s){
    if(!s.deadline){open.push(s);return;}
    var d=diffDays(t,s.deadline);
    if(d<0)past.push(s);else up.push({s:s,days:d});
  });
  up.sort(function(a,b){return a.days-b.days;});
  past.sort(function(a,b){return a.deadline<b.deadline?1:-1;});
  return{upcoming:up.filter(function(x){return x.days<=60;}).map(function(x){return x.s;}),
         later:up.filter(function(x){return x.days>60;}).map(function(x){return x.s;}),
         past:past,open:open};}
function nearestDeadline(){var g=schemeGroups();
  return g.upcoming.length?{s:g.upcoming[0],days:diffDays(todayStr(),g.upcoming[0].deadline)}:null;}

/* ================= RENDER ================= */
var state={view:'dashboard',priceCrop:'all',expMonth:null};

function switchView(v){
  state.view=v;
  $$('.view').forEach(function(s){s.hidden=s.id!=='view-'+v;});
  $$('.tab').forEach(function(b){
    if(b.dataset.view===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  render();window.scrollTo(0,0);
}
function render(){
  loadAll();
  var fn={dashboard:renderDashboard,prices:renderPrices,expenses:renderExpenses,schemes:renderSchemes}[state.view];
  var el=$('#view-'+state.view);
  el.innerHTML=fn();
  el.classList.remove('rise');void el.offsetWidth;el.classList.add('rise');
  bindView();
}

function trendHTML(crop){
  var tr=priceTrend(crop);
  if(tr.dir==='flat')return '<span class="trend flat">'+icon('flat')+'steady</span>';
  var cls=tr.dir==='up'?'up':'down';
  var arrow=tr.dir==='up'?icon('up'):icon('down');
  return '<span class="trend '+cls+'">'+arrow+'<span class="num">'+inr(Math.abs(tr.diff))+'</span></span>';
}
function boardHTML(crop){
  var l=latestPrice(crop);
  if(!l)return '';
  return '<div class="board" data-crop="'+esc(crop)+'"><div class="crop">'+esc(crop)+'</div>'+
    '<div class="price num">'+inr(l.price)+'</div><div class="unit">per quintal</div>'+
    '<div class="meta"><span class="mandi">'+esc(l.mandi)+'<br>'+fmtD(l.date)+'</span>'+trendHTML(crop)+'</div></div>';
}

/* ----- dashboard ----- */
function renderDashboard(){
  var t=todayStr(),h='';
  h+='<div class="page-head"><div><h1>Namaste, kisan</h1>'+
     '<div class="sub">'+fmtD(t)+' · today at a glance</div></div></div>';
  var mk=monthKey(t),mt=monthTotal(mk),cats=totalsByCategory(DB.expenses.filter(function(x){return monthKey(x.date)===mk;}));
  var topCat=CATS.slice().sort(function(a,b){return cats[b]-cats[a];})[0];
  var nd=nearestDeadline();
  h+='<div class="tiles">'+
    '<div class="tile"><div class="k">Kharcha · '+monthLabel(mk)+'</div><div class="v num">'+inr(mt)+'</div>'+
    '<div class="s">Biggest: '+CAT_LABEL[topCat]+' ('+inr(cats[topCat])+')</div></div>'+
    '<div class="tile wheat"><div class="k">Crops tracked</div><div class="v num">'+crops().length+'</div>'+
    '<div class="s">'+DB.prices.length+' price entries across mandis</div></div>'+
    '<div class="tile soil"><div class="k">Nearest yojana deadline</div>'+
    (nd?'<div class="v" style="font-size:1.35rem">'+esc(nd.s.name)+'</div><div class="s">'+fmtD(nd.s.deadline)+' · '+nd.days+' days left</div>'
       :'<div class="v" style="font-size:1.35rem">None due</div><div class="s">No deadlines in the next 60 days</div>')+'</div></div>';
  h+='<h2 class="section-title">Mandi bhav — latest per crop</h2>';
  var cs=crops();
  if(!cs.length){h+='<div class="empty">'+icon('sprout')+'<h3>No prices yet</h3><p>Add mandi prices to track them here.</p>'+
    '<button class="btn primary" data-act="add-price">'+icon('plus')+'Add price</button></div>';}
  else{h+='<div class="boards">'+cs.map(boardHTML).join('')+'</div>';}
  if(nd){
    var g=schemeGroups();
    h+='<h2 class="section-title">Yojana deadlines — next 60 days</h2><div class="scheme-grid">'+
      g.upcoming.slice(0,3).map(schemeCard).join('')+'</div>';
  }
  return h;
}

/* ----- prices ----- */
function renderPrices(){
  var h='<div class="page-head"><div><h1>Mandi bhav</h1>'+
    '<div class="sub">Prices you enter, per quintal. The newest entry per crop is marked Latest.</div></div>'+
    '<button class="btn primary" data-act="add-price">'+icon('plus')+'Add price</button></div>';
  var cs=crops();
  if(!cs.length){
    return h+'<div class="empty">'+icon('sprout')+'<h3>No prices yet</h3><p>Add your first mandi price.</p>'+
      '<button class="btn primary" data-act="add-price">'+icon('plus')+'Add price</button></div>';
  }
  h+='<div class="chips" role="group" aria-label="Filter by crop">'+
     '<button class="chip" data-act="crop-filter" data-crop="all" aria-pressed="'+(state.priceCrop==='all')+'">All crops</button>'+
     cs.map(function(c){return '<button class="chip" data-act="crop-filter" data-crop="'+esc(c)+'" aria-pressed="'+(state.priceCrop===c)+'">'+esc(c)+'</button>';}).join('')+'</div>';
  var list=DB.prices.slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a.crop<b.crop?-1:1);});
  if(state.priceCrop!=='all')list=list.filter(function(p){return p.crop===state.priceCrop;});
  var latestIds={};cs.forEach(function(c){var l=latestPrice(c);if(l)latestIds[l.id]=1;});
  h+='<div class="table-wrap"><table class="ledger"><thead><tr>'+
     '<th>Crop</th><th>Mandi</th><th class="r">Price / quintal</th><th>Date</th><th><span style="position:absolute;left:-9999px">Actions</span></th></tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="5" style="text-align:center;color:var(--ink-soft)">No entries for this crop yet.</td></tr>';
  list.forEach(function(p){
    var isL=latestIds[p.id];
    h+='<tr class="'+(isL?'latest-row':'')+'"><td><strong>'+esc(p.crop)+'</strong>'+(isL?'<span class="pill">Latest</span>':'')+'</td>'+
       '<td>'+esc(p.mandi)+'</td><td class="r num"><strong>'+inr(p.price)+'</strong></td><td class="num">'+fmtD(p.date)+'</td>'+
       '<td style="white-space:nowrap"><button class="icon-btn" data-act="edit-price" data-id="'+p.id+'" aria-label="Edit price">'+icon('edit')+'</button> '+
       '<button class="icon-btn danger" data-act="del-price" data-id="'+p.id+'" aria-label="Delete price">'+icon('trash')+'</button></td></tr>';
  });
  h+='</tbody></table></div>';
  if(state.priceCrop!=='all'){
    var hist=priceHistory(state.priceCrop);
    h+='<h2 class="section-title">'+esc(state.priceCrop)+' — price history</h2><div class="table-wrap"><table class="ledger"><thead><tr>'+
      '<th>Date</th><th>Mandi</th><th class="r">Price / quintal</th><th class="r">Change</th></tr></thead><tbody>';
    hist.forEach(function(p,i){
      var ch=i<hist.length-1?(p.price-hist[i+1].price):null;
      h+='<tr><td class="num">'+fmtD(p.date)+'</td><td>'+esc(p.mandi)+'</td><td class="r num"><strong>'+inr(p.price)+'</strong></td>'+
         '<td class="r num">'+(ch==null?'—':(ch>0?'+':'')+inr(ch).replace('₹','₹'))+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  return h;
}

/* ----- expenses ----- */
function renderExpenses(){
  if(!state.expMonth)state.expMonth=monthKey(todayStr());
  var h='<div class="page-head"><div><h1>Kharcha — farm expenses</h1>'+
    '<div class="sub">Every rupee out, by category and month.</div></div>'+
    '<button class="btn primary" data-act="add-expense">'+icon('plus')+'Add expense</button></div>';
  var months=expenseMonths();
  h+='<div class="field" style="max-width:320px"><label for="month-sel">Month</label><select id="month-sel">'+
     months.map(function(m){return '<option value="'+m+'"'+(m===state.expMonth?' selected':'')+'>'+monthLabel(m)+'</option>';}).join('')+'</select></div>';
  var list=DB.expenses.filter(function(x){return monthKey(x.date)===state.expMonth;})
    .sort(function(a,b){return a.date<b.date?1:-1;});
  var cats=totalsByCategory(list),total=list.reduce(function(s,x){return s+x.amount;},0);
  var max=Math.max.apply(null,CATS.map(function(c){return cats[c];}).concat([1]));
  h+='<h2 class="section-title">'+monthLabel(state.expMonth)+' — total <span class="num">'+inr(total)+'</span></h2><div class="bars">';
  CATS.forEach(function(c){
    var pct=Math.round(cats[c]/max*100);
    h+='<div class="bar-row"><span class="cat">'+CAT_LABEL[c]+'</span>'+
       '<div class="bar-track" role="img" aria-label="'+CAT_LABEL[c]+': '+inr(cats[c])+'"><div class="bar-fill" style="width:'+pct+'%"></div></div>'+
       '<span class="amt num">'+inr(cats[c])+'</span></div>';
  });
  h+='</div><h2 class="section-title">Entries</h2>';
  if(!list.length){
    h+='<div class="empty">'+icon('wallet')+'<h3>No expenses this month</h3><p>Add one to start tracking.</p></div>';
    return h;
  }
  h+='<div class="table-wrap"><table class="ledger"><thead><tr><th>Date</th><th>Category</th><th>Note</th><th class="r">Amount</th><th></th></tr></thead><tbody>';
  list.forEach(function(x){
    h+='<tr><td class="num">'+fmtD(x.date)+'</td><td><span class="status-badge">'+CAT_LABEL[x.category]+'</span></td>'+
       '<td>'+esc(x.note||'—')+'</td><td class="r num"><strong>'+inr(x.amount)+'</strong></td>'+
       '<td style="white-space:nowrap"><button class="icon-btn" data-act="edit-expense" data-id="'+x.id+'" aria-label="Edit expense">'+icon('edit')+'</button> '+
       '<button class="icon-btn danger" data-act="del-expense" data-id="'+x.id+'" aria-label="Delete expense">'+icon('trash')+'</button></td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}

/* ----- schemes ----- */
function daysBadge(days){
  if(days<0)return '<span class="days-badge over">'+icon('calendar')+'Passed</span>';
  var cls=days<=15?'soon':days<=45?'mid':'later';
  return '<span class="days-badge '+cls+'">'+icon('calendar')+days+' days left</span>';
}
function schemeCard(s){
  var t=todayStr(),urgent=s.deadline&&diffDays(t,s.deadline)>=0&&diffDays(t,s.deadline)<=15;
  var past=s.deadline&&diffDays(t,s.deadline)<0;
  var stCls=s.status==='Applied'?'applied':'';
  return '<div class="scheme'+(urgent?' urgent':'')+(past?' past':'')+'" data-scheme="'+s.id+'">'+
    '<h3>'+esc(s.name)+'</h3>'+
    '<div class="deadline">'+(s.deadline?fmtD(s.deadline):'No fixed deadline')+'</div>'+
    '<div style="margin:.4rem 0">'+(s.deadline?daysBadge(diffDays(t,s.deadline)):'<span class="days-badge later">Apply anytime</span>')+
    ' <span class="status-badge '+stCls+'">'+esc(s.status)+'</span></div>'+
    '<p class="benefit">'+esc(s.benefit||'—')+'</p>'+
    (s.note?'<p class="note">'+esc(s.note)+'</p>':'')+
    '<div class="scheme-actions"><button class="icon-btn" data-act="edit-scheme" data-id="'+s.id+'" aria-label="Edit scheme">'+icon('edit')+'</button>'+
    '<button class="icon-btn danger" data-act="del-scheme" data-id="'+s.id+'" aria-label="Delete scheme">'+icon('trash')+'</button></div></div>';
}
function renderSchemes(){
  var g=schemeGroups();
  var h='<div class="page-head"><div><h1>Yojana — scheme deadlines</h1>'+
    '<div class="sub">Government schemes, their deadlines and benefits. Dates are illustrative — tap edit to set the real ones.</div></div>'+
    '<button class="btn primary" data-act="add-scheme">'+icon('plus')+'Add scheme</button></div>';
  if(!DB.schemes.length){
    return h+'<div class="empty">'+icon('doc')+'<h3>No schemes tracked</h3><p>Add a yojana to watch its deadline.</p>'+
      '<button class="btn primary" data-act="add-scheme">'+icon('plus')+'Add scheme</button></div>';
  }
  if(g.upcoming.length){h+='<h2 class="section-title">Coming up — next 60 days</h2><div class="scheme-grid">'+g.upcoming.map(schemeCard).join('')+'</div>';}
  if(g.later.length){h+='<h2 class="section-title">Later</h2><div class="scheme-grid">'+g.later.map(schemeCard).join('')+'</div>';}
  if(g.open.length){h+='<h2 class="section-title">No fixed deadline</h2><div class="scheme-grid">'+g.open.map(schemeCard).join('')+'</div>';}
  if(g.past.length){h+='<h2 class="section-title">Past</h2><div class="scheme-grid">'+g.past.map(schemeCard).join('')+'</div>';}
  return h;
}

/* ================= MODAL & FORMS ================= */
function openModal(title,bodyHTML){
  closeModal();
  $('#modal-root').innerHTML='<div class="modal-overlay" id="m-ov"><div class="modal" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
    '<h2>'+esc(title)+'</h2><div id="m-body">'+bodyHTML+'</div></div></div>';
  var ov=$('#m-ov');
  requestAnimationFrame(function(){ov.classList.add('show');});
  ov.addEventListener('click',function(ev){if(ev.target===ov)closeModal();});
  document.addEventListener('keydown',escClose);
  var f=$('#m-body input,#m-body select,#m-body textarea');if(f)f.focus();
}
function escClose(ev){if(ev.key==='Escape')closeModal();}
function closeModal(){$('#modal-root').innerHTML='';document.removeEventListener('keydown',escClose);}
function fieldErr(id,msg){var el=$('#err-'+id);if(el)el.textContent=msg||'';}
function showErrors(errs){Object.keys(errs).forEach(function(k){fieldErr(k,errs[k]);});}
function actionsRow(submitLabel){
  return '<div class="modal-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancel</button>'+
    '<button type="submit" class="btn primary">'+submitLabel+'</button></div>';
}

function priceFormHTML(p){
  p=p||{date:todayStr()};
  var crops=crops();
  var datalist=crops.length?'<datalist id="crop-list">'+crops.map(function(c){return '<option value="'+esc(c)+'">';}).join('')+'</datalist>':'';
  return '<form id="price-form" novalidate>'+
    '<div class="field"><label for="f-crop">Crop *</label><input id="f-crop" name="crop" list="crop-list" value="'+esc(p.crop||'')+'" autocomplete="off">'+datalist+'<div class="err" id="err-crop"></div></div>'+
    '<div class="field"><label for="f-mandi">Mandi *</label><input id="f-mandi" name="mandi" value="'+esc(p.mandi||'')+'" placeholder="e.g. Nashik Mandi" autocomplete="off"><div class="err" id="err-mandi"></div></div>'+
    '<div class="field"><label for="f-price">Price (₹ per quintal) *</label><input id="f-price" name="price" type="number" min="1" step="1" value="'+esc(p.price||'')+'"><div class="err" id="err-price"></div></div>'+
    '<div class="field"><label for="f-date">Date *</label><input id="f-date" name="date" type="date" value="'+esc(p.date||todayStr())+'"><div class="err" id="err-date"></div></div>'+
    actionsRow(p.id?'Save changes':'Add price')+'</form>';
}
function openPriceForm(p){
  openModal(p&&p.id?'Edit price':'Add mandi price',priceFormHTML(p));
  $('#price-form').addEventListener('submit',function(ev){
    ev.preventDefault();
    var fd=new FormData(ev.target);
    var o={crop:fd.get('crop'),mandi:fd.get('mandi'),price:fd.get('price'),date:fd.get('date')};
    var r=(p&&p.id)?updatePrice(p.id,o):addPrice(o);
    if(!r.ok){showErrors(r.errors);return;}
    closeModal();render();
  });
}

function expenseFormHTML(x){
  x=x||{date:todayStr(),category:'seeds'};
  var opts=CATS.map(function(c){return '<option value="'+c+'"'+(x.category===c?' selected':'')+'>'+CAT_LABEL[c]+'</option>';}).join('');
  return '<form id="exp-form" novalidate>'+
    '<div class="field"><label for="f-date">Date *</label><input id="f-date" name="date" type="date" value="'+esc(x.date||todayStr())+'"><div class="err" id="err-date"></div></div>'+
    '<div class="field"><label for="f-cat">Category *</label><select id="f-cat" name="category">'+opts+'</select><div class="err" id="err-category"></div></div>'+
    '<div class="field"><label for="f-amt">Amount (₹) *</label><input id="f-amt" name="amount" type="number" min="1" step="1" value="'+esc(x.amount||'')+'"><div class="err" id="err-amount"></div></div>'+
    '<div class="field"><label for="f-note">Note</label><input id="f-note" name="note" value="'+esc(x.note||'')+'" placeholder="e.g. DAP + urea"><div class="hint">Optional — what was this for?</div></div>'+
    actionsRow(x.id?'Save changes':'Add expense')+'</form>';
}
function openExpenseForm(x){
  openModal(x&&x.id?'Edit expense':'Add expense',expenseFormHTML(x));
  $('#exp-form').addEventListener('submit',function(ev){
    ev.preventDefault();
    var fd=new FormData(ev.target);
    var o={date:fd.get('date'),category:fd.get('category'),amount:fd.get('amount'),note:fd.get('note')};
    var r=(x&&x.id)?updateExpense(x.id,o):addExpense(o);
    if(!r.ok){showErrors(r.errors);return;}
    closeModal();render();
  });
}

function schemeFormHTML(s){
  s=s||{status:'To apply'};
  var opts=SCHEME_STATUS.map(function(st){return '<option'+(s.status===st?' selected':'')+'>'+st+'</option>';}).join('');
  return '<form id="sch-form" novalidate>'+
    '<div class="field"><label for="f-name">Scheme name *</label><input id="f-name" name="name" value="'+esc(s.name||'')+'" autocomplete="off"><div class="err" id="err-name"></div></div>'+
    '<div class="field"><label for="f-deadline">Deadline</label><input id="f-deadline" name="deadline" type="date" value="'+esc(s.deadline||'')+'"><div class="err" id="err-deadline"></div>'+
    '<div class="hint">Leave blank if there is no fixed deadline.</div></div>'+
    '<div class="field"><label for="f-benefit">Benefit summary</label><textarea id="f-benefit" name="benefit">'+esc(s.benefit||'')+'</textarea></div>'+
    '<div class="field"><label for="f-status">Status</label><select id="f-status" name="status">'+opts+'</select></div>'+
    '<div class="field"><label for="f-note">Note</label><input id="f-note" name="note" value="'+esc(s.note||'')+'" placeholder="e.g. verify on official site"></div>'+
    actionsRow(s.id?'Save changes':'Add scheme')+'</form>';
}
function openSchemeForm(s){
  openModal(s&&s.id?'Edit scheme':'Add yojana',schemeFormHTML(s));
  $('#sch-form').addEventListener('submit',function(ev){
    ev.preventDefault();
    var fd=new FormData(ev.target);
    var o={name:fd.get('name'),deadline:fd.get('deadline')||'',benefit:fd.get('benefit'),status:fd.get('status'),note:fd.get('note')};
    var r=(s&&s.id)?updateScheme(s.id,o):addScheme(o);
    if(!r.ok){showErrors(r.errors);return;}
    closeModal();render();
  });
}

/* ================= EVENTS ================= */
function bindView(){
  var ms=$('#month-sel');
  if(ms)ms.addEventListener('change',function(){state.expMonth=ms.value;render();});
  $$('#app [data-act]').forEach(function(b){
    b.addEventListener('click',function(){
      var act=b.dataset.act,id=b.dataset.id;
      if(act==='add-price')openPriceForm(null);
      else if(act==='edit-price')openPriceForm(getPrice(id));
      else if(act==='del-price'){var p=getPrice(id);
        if(confirm('Delete '+p.crop+' @ '+p.mandi+' ('+fmtD(p.date)+')?')){deletePrice(id);render();}}
      else if(act==='crop-filter'){state.priceCrop=b.dataset.crop;render();}
      else if(act==='add-expense')openExpenseForm(null);
      else if(act==='edit-expense')openExpenseForm(getExpense(id));
      else if(act==='del-expense'){if(confirm('Delete this expense entry?')){deleteExpense(id);render();}}
      else if(act==='add-scheme')openSchemeForm(null);
      else if(act==='edit-scheme')openSchemeForm(getScheme(id));
      else if(act==='del-scheme'){var s=getScheme(id);
        if(confirm('Remove “'+s.name+'” from tracking?')){deleteScheme(id);render();}}
      else if(act==='close-modal')closeModal();
    });
  });
}
$$('.tab').forEach(function(b){b.addEventListener('click',function(){switchView(b.dataset.view);});});

/* ================= SELFTEST ================= */
function runSelftest(){
  var results=[];
  function t(name,cond){results.push({name:name,ok:!!cond});}
  try{
    wipeNamespace();
    t('namespace wiped',Object.keys(localStorage).filter(function(k){return k.indexOf(PREFIX)===0;}).length===0);
    seed();loadAll();
    t('seeded 18 prices',DB.prices.length===18);
    t('seeded 8 expenses',DB.expenses.length===8);
    t('seeded 4 schemes',DB.schemes.length===4);
    t('seeded flag set',localStorage.getItem(PREFIX+'seeded')==='1');
    /* latest-price math */
    var wl=latestPrice('Wheat');
    t('latest Wheat = 2425 @ Nashik Mandi',wl&&wl.price===2425&&wl.mandi==='Nashik Mandi');
    t('Wheat history has 4 entries, newest first',
      priceHistory('Wheat').length===4&&priceHistory('Wheat')[0].date===todayStr());
    var tr=priceTrend('Wheat');
    t('Wheat trend +115 vs previous',tr.dir==='up'&&tr.diff===115);
    /* add crop price */
    var pr=addPrice({crop:'Bajra',mandi:'Test Mandi',price:2200,date:todayStr()});
    t('add price ok',pr.ok===true&&DB.prices.length===19);
    t('latest Bajra = 2200',latestPrice('Bajra').price===2200);
    var badP=addPrice({crop:'X',mandi:'Y',price:-5,date:todayStr()});
    t('negative price rejected',badP.ok===false&&badP.errors.price);
    var badP2=addPrice({crop:'',mandi:'Y',price:100,date:todayStr()});
    t('empty crop rejected',badP2.ok===false&&badP2.errors.crop);
    /* expenses */
    var mk=monthKey(todayStr());
    var before=monthTotal(mk),beforeSeeds=totalsByCategory()[ 'seeds'];
    var er=addExpense({date:todayStr(),category:'seeds',amount:1500,note:'selftest'});
    t('add expense ok',er.ok===true&&DB.expenses.length===9);
    t('month total increased by 1500',monthTotal(mk)===before+1500);
    t('seeds category total increased by 1500',totalsByCategory().seeds===beforeSeeds+1500);
    var badE=addExpense({date:todayStr(),category:'bogus',amount:100,note:''});
    t('bad category rejected',badE.ok===false&&badE.errors.category);
    /* schemes */
    t('nearest deadline is PM-KISAN (48 days)',(function(){var n=nearestDeadline();return n&&n.s.name.indexOf('PM-KISAN')===0&&n.days===48;})());
    var sr=addScheme({name:'Test Yojana',deadline:addDaysStr(todayStr(),30),benefit:'Test benefit',status:'To apply',note:''});
    t('add scheme ok',sr.ok===true&&DB.schemes.length===5);
    var g=schemeGroups();
    t('test scheme in upcoming',g.upcoming.some(function(s){return s.id===sr.scheme.id;}));
    t('past list has Soil Health Card',g.past.some(function(s){return s.name.indexOf('Soil Health Card')===0;}));
    t('open list has KCC',g.open.some(function(s){return s.name.indexOf('KCC')===0;}));
    /* persistence + render */
    var sP=DB.prices.length,sE=DB.expenses.length,sS=DB.schemes.length;
    loadAll();
    t('re-read prices from localStorage',DB.prices.length===sP);
    t('re-read expenses from localStorage',DB.expenses.length===sE);
    t('re-read schemes from localStorage',DB.schemes.length===sS);
    switchView('dashboard');
    t('dashboard renders 7 mandi boards',$$('#view-dashboard .board').length===7);
    t('dashboard renders 3 tiles',$$('#view-dashboard .tile').length===3);
    switchView('prices');
    t('prices table has 19 rows',$$('#view-prices .ledger tbody tr').length===19);
    switchView('expenses');
    t('expenses table renders rows',$$('#view-expenses .ledger tbody tr').length>0);
    switchView('schemes');
    t('schemes view renders cards',$$('#view-schemes .scheme').length===5);
    switchView('dashboard');
  }catch(err){results.push({name:'EXCEPTION: '+(err&&err.message),ok:false});}
  var pass=results.filter(function(r){return r.ok;}).length,n=results.length;
  var okAll=pass===n;
  document.title=(okAll?'SELFTEST PASS ':'SELFTEST FAIL: ')+pass+'/'+n+' — KisanSetu';
  var banner=$('#selftest-banner');
  banner.hidden=false;
  banner.className='selftest-banner '+(okAll?'pass':'fail');
  var fails=results.filter(function(r){return !r.ok;}).map(function(r){return r.name;});
  banner.textContent=okAll?('SELFTEST PASS '+pass+'/'+n):('SELFTEST FAIL: '+fails.join('; '));
  console.log('[selftest] '+(okAll?'PASS':'FAIL')+' '+pass+'/'+n,fails);
}
function init(){
  var qs=new URLSearchParams(location.search);
  if(qs.get('selftest')==='1'){runSelftest();return;}
  if(!localStorage.getItem(PREFIX+'seeded'))seed();
  loadAll();
  switchView('dashboard');
}
init();
})();
