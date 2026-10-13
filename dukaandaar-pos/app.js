'use strict';
/* ============================================================
   DUKAANDAAR POS — counter billing for kirana / pharmacy shops
   Vanilla JS. Data in localStorage under dp_v1_* keys.
   ============================================================ */
const NS = 'dp_v1_';
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

/* ---------- storage ---------- */
const store = {
  get(k, f) { try { const r = localStorage.getItem(NS + k); return r == null ? f : JSON.parse(r); } catch (e) { return f; } },
  set(k, v) { localStorage.setItem(NS + k, JSON.stringify(v)); },
  keys() { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(NS) === 0) out.push(k); } return out; },
  wipe() { store.keys().forEach(k => localStorage.removeItem(k)); }
};

let S = null;               // whole app state
let view = 'bill';          // active view
let billFilter = { q: '', cat: 'All' };
let prodFilter = { q: '' };

function loadState() {
  S = {
    products: store.get('products', []),
    sales:    store.get('sales', []),
    held:     store.get('held', []),
    cart:     store.get('cart', []),
    shop:     store.get('shop', {}),
    counters: store.get('counters', { bill: 1 })
  };
}
function save(k) { store.set(k, S[k]); }

/* ---------- seed data (first launch only) ---------- */
const CATS = ['Grocery', 'Dairy', 'Snacks', 'Pharmacy', 'Household'];
function seedProducts() {
  const rows = [
    ['Amul Taaza Toned Milk 500ml',        32,  0, 40,  8, 'Dairy'],
    ['Tata Salt 1kg',                      28,  5, 60, 10, 'Grocery'],
    ['Fortune Sunflower Oil 1L',           145,  5, 24,  6, 'Grocery'],
    ['Aashirvaad Shudh Chakki Atta 5kg',   248,  5, 18,  4, 'Grocery'],
    ['Sugar (Loose) 1kg',                  45,  5, 50, 10, 'Grocery'],
    ['Toor Dal Unpolished 1kg',            165,  5, 22,  5, 'Grocery'],
    ['Tata Tea Gold 250g',                 145,  5, 30,  6, 'Grocery'],
    ['Parle-G Gold Biscuits 200g',         25, 18, 80, 15, 'Snacks'],
    ['Maggi Noodles Family Pack (12)',    168, 18, 36,  8, 'Snacks'],
    ['Bournvita 500g Jar',                 245, 18, 16,  4, 'Snacks'],
    ['Paracetamol 650mg (15 tablets)',     42, 12, 14,  3, 'Pharmacy'],
    ['Cetirizine 10mg (10 tablets)',       35, 12,  2,  5, 'Pharmacy'],
    ['Dettol Original Soap 125g',          38, 18, 45,  8, 'Household'],
    ['Colgate MaxFresh Gel 150g',          98, 18, 28,  6, 'Household']
  ];
  return rows.map(r => ({ id: uid(), name: r[0], price: r[1], gst: r[2], stock: r[3], low: r[4], cat: r[5] }));
}
function seed() {
  S.products = seedProducts();
  S.sales = [];
  S.held = [];
  S.cart = [];
  S.shop = {
    name: 'Sharma Kirana & Medical Store',
    address: 'Shop 12, Main Market, Laxmi Nagar, Delhi 110092',
    phone: '98110 44556',
    gstin: '07ABCDE1234F1Z5'
  };
  S.counters = { bill: 1 };
  ['products','sales','held','cart','shop','counters'].forEach(save);
  store.set('seeded', true);
}

/* ---------- products ---------- */
const prod = id => S.products.find(p => p.id === id);

function validateProduct(f) {
  const errs = [];
  if (!f.name || !f.name.trim()) errs.push('Product name is required.');
  if (!(f.price > 0)) errs.push('Price must be greater than zero.');
  if (![0, 5, 12, 18].includes(Number(f.gst))) errs.push('GST must be 0, 5, 12 or 18.');
  if (!(f.stock >= 0)) errs.push('Stock cannot be negative.');
  if (!(f.low >= 0)) errs.push('Low-stock alert level cannot be negative.');
  return errs;
}
function addProduct(f) {
  const errs = validateProduct(f);
  if (errs.length) return { ok: false, errs };
  const p = { id: uid(), name: f.name.trim(), price: r2(f.price), gst: Number(f.gst), stock: Math.floor(f.stock), low: Math.floor(f.low), cat: f.cat || 'Grocery' };
  S.products.push(p); save('products');
  return { ok: true, product: p };
}
function updateProduct(id, f) {
  const p = prod(id); if (!p) return { ok: false, errs: ['Product not found.'] };
  const errs = validateProduct(f);
  if (errs.length) return { ok: false, errs };
  p.name = f.name.trim(); p.price = r2(f.price); p.gst = Number(f.gst);
  p.stock = Math.floor(f.stock); p.low = Math.floor(f.low); p.cat = f.cat || 'Grocery';
  save('products');
  return { ok: true, product: p };
}
function deleteProduct(id) {
  const i = S.products.findIndex(p => p.id === id);
  if (i < 0) return false;
  S.products.splice(i, 1); save('products');
  S.cart = S.cart.filter(l => l.pid !== id); save('cart');
  return true;
}
function lowStockList() {
  return S.products.filter(p => p.stock <= p.low).sort((a, b) => (a.stock - a.low) - (b.stock - b.low));
}

/* ---------- billing cart ---------- */
function cartLines() {
  return S.cart.map(l => { const p = prod(l.pid); return p ? { pid: l.pid, qty: l.qty, p } : null; }).filter(Boolean);
}
function lineCalc(p, qty) {
  const taxable = r2(p.price * qty);
  const gst = r2(taxable * p.gst / 100);
  return { taxable, gst, total: r2(taxable + gst) };
}
function cartTotals() {
  let subtotal = 0, gstTotal = 0;
  const lines = cartLines().map(l => {
    const c = lineCalc(l.p, l.qty);
    subtotal = r2(subtotal + c.taxable); gstTotal = r2(gstTotal + c.gst);
    return Object.assign({}, l, c);
  });
  const grand = r2(subtotal + gstTotal);
  const rounded = Math.round(grand);
  return { lines, subtotal, gstTotal, grand, rounded, roundOff: r2(rounded - grand) };
}
function addToCart(pid, qty) {
  qty = qty || 1;
  const p = prod(pid);
  if (!p) return { ok: false, msg: 'Product not found.' };
  if (p.stock <= 0) return { ok: false, msg: p.name + ' is out of stock.' };
  const line = S.cart.find(l => l.pid === pid);
  const cur = line ? line.qty : 0;
  if (cur + qty > p.stock) return { ok: false, msg: 'Only ' + p.stock + ' in stock.' };
  if (line) line.qty += qty; else S.cart.push({ pid, qty });
  save('cart');
  return { ok: true };
}
function setCartQty(pid, qty) {
  const p = prod(pid); if (!p) return false;
  qty = Math.max(0, Math.min(Math.floor(qty), p.stock));
  const line = S.cart.find(l => l.pid === pid);
  if (!line) return false;
  if (qty === 0) S.cart = S.cart.filter(l => l.pid !== pid);
  else line.qty = qty;
  save('cart');
  return true;
}
function removeCartLine(pid) { S.cart = S.cart.filter(l => l.pid !== pid); save('cart'); }
function clearCart() { S.cart = []; save('cart'); }

function completeSale(mode) {
  const t = cartTotals();
  if (!t.lines.length) return { ok: false, msg: 'Bill is empty. Add items first.' };
  for (const l of t.lines) {
    if (l.qty > l.p.stock) return { ok: false, msg: 'Not enough stock for ' + l.p.name + '.' };
  }
  const billNo = 'DP-' + String(S.counters.bill).padStart(4, '0');
  const sale = {
    id: uid(), billNo, date: todayStr(),
    time: new Date().toTimeString().slice(0, 5),
    mode: mode || 'Cash',
    items: t.lines.map(l => ({ pid: l.pid, name: l.p.name, price: l.p.price, gst: l.p.gst, qty: l.qty, taxable: l.taxable, gstAmt: l.gst })),
    subtotal: t.subtotal, gstTotal: t.gstTotal, roundOff: t.roundOff, grand: t.rounded
  };
  t.lines.forEach(l => { l.p.stock -= l.qty; });
  S.sales.unshift(sale);
  S.counters.bill += 1;
  S.cart = [];
  ['products','sales','counters','cart'].forEach(save);
  return { ok: true, sale };
}

/* ---------- hold / resume ---------- */
function holdBill() {
  if (!S.cart.length) return { ok: false, msg: 'Nothing to hold — bill is empty.' };
  S.held.unshift({ id: uid(), at: Date.now(), lines: S.cart.map(l => ({ pid: l.pid, qty: l.qty })) });
  S.cart = []; save('held'); save('cart');
  return { ok: true };
}
function resumeHeld(id) {
  const h = S.held.find(x => x.id === id); if (!h) return;
  h.lines.forEach(l => { const p = prod(l.pid); if (p) addToCart(l.pid, Math.min(l.qty, p.stock)); });
  S.held = S.held.filter(x => x.id !== id); save('held');
}
function discardHeld(id) { S.held = S.held.filter(x => x.id !== id); save('held'); }

/* ---------- reports ---------- */
function salesSince(days) {
  const from = addDays(todayStr(), -(days - 1));
  return S.sales.filter(s => s.date >= from);
}
function revenueOf(list) { return r2(list.reduce((a, s) => a + s.grand, 0)); }
function topItems(days) {
  const map = {};
  salesSince(days).forEach(s => s.items.forEach(it => {
    if (!map[it.pid]) map[it.pid] = { name: it.name, qty: 0, revenue: 0 };
    map[it.pid].qty += it.qty;
    map[it.pid].revenue = r2(map[it.pid].revenue + it.taxable + it.gstAmt);
  }));
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 8);
}

/* ============================================================
   RENDERING
   ============================================================ */
const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4L8 20l-5 1 1-5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/></svg>'
};

function stockPill(p) {
  if (p.stock <= 0) return '<span class="stock-pill out">Out</span>';
  if (p.stock <= p.low) return '<span class="stock-pill low">Low · ' + p.stock + '</span>';
  return '<span class="stock-pill ok">' + p.stock + ' in stock</span>';
}

/* ---------- toast ---------- */
function toast(msg, type) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 200ms'; setTimeout(() => el.remove(), 220); }, 2600);
}

/* ---------- shared empty state (on-brand: cart-empty panel + CTA) ---------- */
function emptyState(icon, title, sub, cta) {
  // cta: { label, action, view? } — optional
  let btn = '';
  if (cta) {
    btn = '<button class="btn btn-primary" data-action="' + cta.action + '"' +
      (cta.view ? ' data-view="' + cta.view + '"' : '') + '>' + ICONS.plus + ' ' + cta.label + '</button>';
  }
  return '<div class="cart-empty" style="grid-column:1/-1">' + icon +
    '<p><b>' + title + '</b><br/>' + sub + '</p>' + btn + '</div>';
}

/* ---------- modal ---------- */
function openModal(html, wide) {
  const root = $('#modal-root');
  root.innerHTML = '<div class="modal-overlay" data-action="overlay-close"><div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
}
function closeModal() { $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function openConfirm(msg, onYesLabel, fn) {
  window._confirmFn = fn;
  openModal(
    '<div class="modal-head"><h3>Please confirm</h3>' +
    '<button class="icon-btn" data-action="close-modal" aria-label="Close">' + ICONS.x + '</button></div>' +
    '<p style="margin:0 0 20px;color:var(--ink-soft)">' + esc(msg) + '</p>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end">' +
    '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
    '<button class="btn btn-danger" data-action="confirm-yes">' + esc(onYesLabel || 'Yes, do it') + '</button></div>'
  );
}

/* ---------- invoice ---------- */
function invoiceHTML(sale) {
  const sh = S.shop;
  const rows = sale.items.map((it, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + esc(it.name) + '</td>' +
    '<td class="r">' + it.qty + '</td><td class="r">' + money(it.price) + '</td>' +
    '<td class="r">' + it.gst + '%</td><td class="r">' + money(it.gstAmt) + '</td>' +
    '<td class="r"><b>' + money(r2(it.taxable + it.gstAmt)) + '</b></td></tr>'
  ).join('');
  return '<div class="invoice">' +
    '<div class="inv-head"><h2>' + esc(sh.name || 'Shop') + '</h2>' +
    '<p>' + esc(sh.address || '') + '</p>' +
    '<p>Phone: ' + esc(sh.phone || '—') + (sh.gstin ? ' &nbsp;·&nbsp; GSTIN: ' + esc(sh.gstin) : '') + '</p></div>' +
    '<div class="inv-meta"><span><b>Bill No:</b> ' + esc(sale.billNo) + '</span>' +
    '<span><b>Date:</b> ' + fmtDate(sale.date) + ' ' + esc(sale.time || '') + '</span>' +
    '<span><b>Paid by:</b> ' + esc(sale.mode) + '</span></div>' +
    '<table class="inv-table"><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">GST Amt</th><th class="r">Amount</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<div class="inv-totals">' +
    '<div class="t-row"><span class="k">Subtotal</span><span class="num">' + money(sale.subtotal) + '</span></div>' +
    '<div class="t-row"><span class="k">GST Total</span><span class="num">' + money(sale.gstTotal) + '</span></div>' +
    '<div class="t-row"><span class="k">Round off</span><span class="num">' + money(sale.roundOff) + '</span></div>' +
    '<div class="t-row grand"><span>Grand Total</span><span class="num">' + money(sale.grand) + '</span></div></div>' +
    '<div class="inv-foot">Thank you for shopping with us.<br/>This is a computer-generated invoice.</div>' +
    '</div>';
}
function openInvoice(sale) {
  $('#print-area').innerHTML = invoiceHTML(sale);
  openModal(
    '<div class="modal-head"><h3>Bill ' + esc(sale.billNo) + ' — ' + money(sale.grand) + '</h3>' +
    '<button class="icon-btn" data-action="close-modal" aria-label="Close">' + ICONS.x + '</button></div>' +
    invoiceHTML(sale) +
    '<div class="inv-actions"><button class="btn btn-primary btn-block" data-action="print-invoice">' + ICONS.print + ' Print Invoice</button>' +
    '<button class="btn btn-ghost btn-block" data-action="close-modal">Done</button></div>',
    true
  );
}

/* ---------- views ---------- */
function render() {
  $$('.tab').forEach(t => {
    const on = t.dataset.view === view;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const v = $('#view');
  if (view === 'bill') v.innerHTML = viewBill();
  else if (view === 'products') v.innerHTML = viewProducts();
  else if (view === 'reports') v.innerHTML = viewReports();
  else if (view === 'stock') v.innerHTML = viewStock();
  else if (view === 'settings') v.innerHTML = viewSettings();
  if (view === 'bill') renderTiles();
  if (view === 'products') renderProductRows();
}

/* ----- BILL ----- */
function viewBill() {
  const t = cartTotals();
  const chips = ['All'].concat(CATS).map(c =>
    '<button class="chip' + (billFilter.cat === c ? ' is-on' : '') + '" data-action="chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>'
  ).join('');
  const lines = t.lines.map(l =>
    '<div class="cart-line" data-pid="' + l.pid + '">' +
    '<div class="cl-top"><span class="cl-name">' + esc(l.p.name) + '</span><span class="cl-amt num">' + money(l.total) + '</span></div>' +
    '<div class="cl-gstline num">' + money(l.p.price) + ' × ' + l.qty + ' · GST ' + l.p.gst + '% = ' + money(l.gst) + '</div>' +
    '<div class="cl-controls"><div class="stepper" role="group" aria-label="Quantity for ' + esc(l.p.name) + '">' +
    '<button data-action="qty-dec" data-pid="' + l.pid + '" aria-label="Decrease quantity">−</button>' +
    '<span class="q num">' + l.qty + '</span>' +
    '<button data-action="qty-inc" data-pid="' + l.pid + '" aria-label="Increase quantity">+</button></div>' +
    '<button class="link-remove" data-action="line-remove" data-pid="' + l.pid + '">Remove</button></div></div>'
  ).join('');
  const held = S.held.map(h => {
    const n = h.lines.reduce((a, l) => a + l.qty, 0);
    return '<div class="held-item"><div class="hi-info">Held bill · ' + n + ' item' + (n === 1 ? '' : 's') +
      '<small>' + new Date(h.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + '</small></div>' +
      '<div class="hi-btns"><button class="btn btn-ghost btn-sm" data-action="resume-held" data-id="' + h.id + '">Resume</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="discard-held" data-id="' + h.id + '" aria-label="Discard held bill">' + ICONS.x + '</button></div></div>';
  }).join('');

  return '<div class="view-head"><div><h2>New Bill</h2><p class="sub">Tap a product to add it · steppers adjust quantity</p></div></div>' +
  '<div class="bill-layout"><div class="product-pane"><div class="pane-head">' +
  '<div class="search-wrap">' + ICONS.search + '<input id="bill-search" type="search" placeholder="Search products…" value="' + esc(billFilter.q) + '" aria-label="Search products" autocomplete="off"/></div>' +
  '<div class="chips">' + chips + '</div></div>' +
  '<div class="tile-grid" id="tile-grid"></div></div>' +
  '<aside class="billpad" aria-label="Current bill"><div class="billpad-head"><h3>Current Bill</h3>' +
  '<span class="billno">NEXT · DP-' + String(S.counters.bill).padStart(4, '0') + '</span></div>' +
  '<div class="billpad-body">' +
  (t.lines.length
    ? '<div class="cart-lines">' + lines + '</div>' +
      '<div class="totals">' +
      '<div class="t-row"><span class="k">Subtotal</span><span class="num">' + money(t.subtotal) + '</span></div>' +
      '<div class="t-row"><span class="k">GST Total</span><span class="num">' + money(t.gstTotal) + '</span></div>' +
      '<div class="t-row round"><span class="k">Round off</span><span class="num">' + money(t.roundOff) + '</span></div>' +
      '<div class="t-row grand"><span>Total</span><span class="num">' + money(t.rounded) + '</span></div></div>' +
      '<div class="pay-row"><select id="pay-mode" aria-label="Payment mode"><option>Cash</option><option>UPI</option><option>Card</option></select>' +
      '<button class="btn btn-ghost" data-action="clear-cart">Clear</button></div>' +
      '<div class="pad-actions"><button class="btn btn-primary btn-huge" data-action="complete-bill">Complete Bill · ' + money(t.rounded) + '</button>' +
      '<button class="btn btn-ghost" data-action="hold-bill">Hold Bill</button>' +
      '<button class="btn btn-ghost" data-action="clear-cart">Clear All</button></div>'
    : '<div class="cart-empty">' + ICONS.cart + '<p><b>Bill is empty.</b><br/>Tap any product on the left to add it here.</p></div>') +
  (held ? '<div class="held-list"><p class="kicker">Held bills</p>' + held + '</div>' : '') +
  '</div></aside></div>';
}
function renderTiles() {
  const grid = $('#tile-grid'); if (!grid) return;
  const q = billFilter.q.trim().toLowerCase();
  const list = S.products.filter(p =>
    (billFilter.cat === 'All' || p.cat === billFilter.cat) &&
    (!q || p.name.toLowerCase().indexOf(q) > -1)
  );
  if (!S.products.length) {
    grid.innerHTML = emptyState(ICONS.cart, 'No products yet', 'Add your first product to start billing.',
      { label: 'Add your first product', action: 'open-product-modal' });
    return;
  }
  if (!list.length) { grid.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--ink-soft)">No products match. Try another search.</div>'; return; }
  grid.innerHTML = list.map(p =>
    '<button class="tile' + (p.stock <= 0 ? ' is-out' : '') + '" data-action="tile-add" data-pid="' + p.id + '" ' + (p.stock <= 0 ? 'disabled' : '') + '>' +
    '<span class="t-name">' + esc(p.name) + '</span>' +
    '<span class="t-meta"><span><span class="t-price num">' + money(p.price) + '</span><br/><span class="t-gst">GST ' + p.gst + '%</span></span>' +
    stockPill(p) + '</span></button>'
  ).join('');
}

/* ----- PRODUCTS ----- */
function viewProducts() {
  return '<div class="view-head"><div><h2>Product Catalog</h2><p class="sub">' + S.products.length + ' products · prices include GST slab per item</p></div>' +
    '<button class="btn btn-primary" data-action="open-product-modal">' + ICONS.plus + ' Add Product</button></div>' +
    '<div class="card"><div class="search-wrap">' + ICONS.search +
    '<input id="prod-search" type="search" placeholder="Search catalog…" value="' + esc(prodFilter.q) + '" aria-label="Search catalog" autocomplete="off"/></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Category</th><th class="r">Price</th><th class="c">GST</th><th class="r">Stock</th><th class="r">Alert at</th><th></th></tr></thead>' +
    '<tbody id="product-rows"></tbody></table></div></div>';
}
function renderProductRows() {
  const tb = $('#product-rows'); if (!tb) return;
  const q = prodFilter.q.trim().toLowerCase();
  const list = S.products.filter(p => !q || p.name.toLowerCase().indexOf(q) > -1);
  if (!list.length) {
    tb.innerHTML = S.products.length
      ? '<tr><td colspan="7" style="text-align:center;color:var(--ink-soft)">No products found.</td></tr>'
      : '<tr><td colspan="7">' + emptyState(ICONS.plus, 'Catalog is empty', 'Add products here to sell them at the counter.',
          { label: 'Add your first product', action: 'open-product-modal' }) + '</td></tr>';
    return;
  }
  tb.innerHTML = list.map(p =>
    '<tr><td><b>' + esc(p.name) + '</b><br/>' + stockPill(p) + '</td><td>' + esc(p.cat || '—') + '</td>' +
    '<td class="r num"><b>' + money(p.price) + '</b></td><td class="c">' + p.gst + '%</td>' +
    '<td class="r num">' + p.stock + '</td><td class="r num">' + p.low + '</td>' +
    '<td><div class="row-actions"><button class="icon-btn" data-action="edit-product" data-id="' + p.id + '" aria-label="Edit ' + esc(p.name) + '">' + ICONS.edit + '</button>' +
    '<button class="icon-btn danger" data-action="delete-product" data-id="' + p.id + '" aria-label="Delete ' + esc(p.name) + '">' + ICONS.trash + '</button></div></td></tr>'
  ).join('');
}
function productFormHTML(p) {
  p = p || {};
  const gstOpts = [0, 5, 12, 18].map(g => '<option value="' + g + '"' + (Number(p.gst) === g ? ' selected' : '') + '>' + g + '%</option>').join('');
  const catOpts = CATS.map(c => '<option' + (p.cat === c ? ' selected' : '') + '>' + c + '</option>').join('');
  return '<div class="modal-head"><h3>' + (p.id ? 'Edit Product' : 'Add Product') + '</h3>' +
    '<button class="icon-btn" data-action="close-modal" aria-label="Close">' + ICONS.x + '</button></div>' +
    '<form id="product-form" data-id="' + (p.id || '') + '">' +
    '<div class="field"><label for="pf-name">Product name</label><input id="pf-name" name="name" required maxlength="80" value="' + esc(p.name || '') + '" placeholder="e.g. Aashirvaad Atta 5kg"/></div>' +
    '<div class="form-grid"><div class="field"><label for="pf-price">Price (₹)</label><input id="pf-price" name="price" type="number" min="0.01" step="0.01" required value="' + (p.price != null ? p.price : '') + '"/></div>' +
    '<div class="field"><label for="pf-gst">GST slab</label><select id="pf-gst" name="gst">' + gstOpts + '</select></div>' +
    '<div class="field"><label for="pf-stock">Stock quantity</label><input id="pf-stock" name="stock" type="number" min="0" step="1" required value="' + (p.stock != null ? p.stock : '') + '"/></div>' +
    '<div class="field"><label for="pf-low">Low-stock alert at</label><input id="pf-low" name="low" type="number" min="0" step="1" required value="' + (p.low != null ? p.low : '5') + '"/></div></div>' +
    '<div class="field"><label for="pf-cat">Category</label><select id="pf-cat" name="cat">' + catOpts + '</select></div>' +
    '<div id="pf-errors" style="color:var(--red);font-weight:600;font-size:14px;margin-bottom:10px"></div>' +
    '<button class="btn btn-primary btn-block btn-huge" type="submit">' + (p.id ? 'Save Changes' : 'Add Product') + '</button></form>';
}

/* ----- REPORTS ----- */
function viewReports() {
  const td = salesSince(1), wk = salesSince(7);
  const stat = (label, val, note) => '<div class="stat"><p class="s-label">' + label + '</p><p class="s-value num">' + val + '</p><p class="s-note">' + note + '</p></div>';
  const top = topItems(7).map((t, i) =>
    '<tr><td>' + (i + 1) + '</td><td><b>' + esc(t.name) + '</b></td><td class="r num">' + t.qty + '</td><td class="r num">' + money(t.revenue) + '</td></tr>'
  ).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--ink-soft)">No sales yet — your first bill will appear here.</td></tr>';
  const recent = S.sales.slice(0, 12).map(s =>
    '<tr><td><b>' + esc(s.billNo) + '</b><br/><small style="color:var(--ink-soft)">' + esc(s.mode) + '</small></td>' +
    '<td>' + fmtDate(s.date) + '<br/><small style="color:var(--ink-soft)">' + esc(s.time || '') + '</small></td>' +
    '<td class="r num">' + s.items.reduce((a, i) => a + i.qty, 0) + '</td>' +
    '<td class="r num"><b>' + money(s.grand) + '</b></td>' +
    '<td><div class="row-actions"><button class="icon-btn" data-action="view-invoice" data-id="' + s.id + '" aria-label="View bill ' + esc(s.billNo) + '">' + ICONS.eye + '</button></div></td></tr>'
  ).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--ink-soft)">No sales yet — your first bill will appear here.<br/>' +
    '<button class="btn btn-primary btn-sm" data-action="nav" data-view="bill" style="margin-top:10px">' + ICONS.plus + ' Create your first bill</button></td></tr>';
  return '<div class="view-head"><div><h2>Sales Reports</h2><p class="sub">Revenue, bills and best sellers</p></div></div>' +
    '<div class="stat-grid">' +
    stat('Revenue today', money(revenueOf(td)), td.length + ' bill' + (td.length === 1 ? '' : 's') + ' · ' + fmtDate(todayStr())) +
    stat('Revenue · last 7 days', money(revenueOf(wk)), wk.length + ' bill' + (wk.length === 1 ? '' : 's')) +
    stat('Bills today', td.length, 'completed at counter') +
    stat('Items in catalog', S.products.length, lowStockList().length + ' need restocking') +
    '</div>' +
    '<div class="two-col"><div class="card"><h3 class="panel-title">Top sellers · last 7 days</h3><p class="panel-sub">By quantity sold</p>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Revenue</th></tr></thead><tbody>' + top + '</tbody></table></div></div>' +
    '<div class="card"><h3 class="panel-title">Recent bills</h3><p class="panel-sub">Tap the eye to view or print</p>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bill</th><th>Date</th><th class="r">Items</th><th class="r">Total</th><th></th></tr></thead><tbody>' + recent + '</tbody></table></div></div></div>';
}

/* ----- STOCK ----- */
function viewStock() {
  if (!S.products.length) {
    return '<div class="view-head"><div><h2>Inventory</h2><p class="sub">Track stock levels here</p></div></div>' +
      emptyState(ICONS.alert, 'Nothing to track yet', 'Add products to monitor stock levels and low-stock alerts.',
        { label: 'Add your first product', action: 'open-product-modal' });
  }
  const low = lowStockList();
  const alerts = low.length
    ? '<div class="alert-grid">' + low.map(p =>
      '<div class="alert-card' + (p.stock <= 0 ? ' critical' : '') + '"><div><div class="a-name">' + esc(p.name) + '</div>' +
      '<div class="a-stock">Stock <b>' + p.stock + '</b> · alert at ' + p.low + ' · ' + money(p.price) + '</div></div>' +
      '<div class="restock"><input type="number" min="1" step="1" value="10" id="rs-' + p.id + '" aria-label="Quantity to add for ' + esc(p.name) + '"/>' +
      '<button class="btn btn-primary btn-sm" data-action="restock" data-id="' + p.id + '">Add</button></div></div>').join('') + '</div>'
    : '<div class="all-clear">All stocked up — nothing below alert levels.</div>';
  const rows = S.products.slice().sort((a, b) => a.stock - b.stock).map(p =>
    '<tr><td><b>' + esc(p.name) + '</b><br/>' + stockPill(p) + '</td><td class="r num">' + p.stock + '</td><td class="r num">' + p.low + '</td>' +
    '<td class="r num">' + money(r2(p.price * p.stock)) + '</td>' +
    '<td><div class="row-actions"><div class="restock"><input type="number" min="1" step="1" value="10" id="rs2-' + p.id + '" aria-label="Quantity to add"/>' +
    '<button class="btn btn-ghost btn-sm" data-action="restock" data-id="' + p.id + '">Add stock</button></div></div></td></tr>'
  ).join('');
  const stockValue = r2(S.products.reduce((a, p) => a + p.price * p.stock, 0));
  return '<div class="view-head"><div><h2>Inventory</h2><p class="sub">Stock value on hand: <b class="num">' + money(stockValue) + '</b></p></div></div>' +
    '<p class="kicker">Low-stock alerts · ' + low.length + '</p>' + alerts +
    '<div class="card" style="margin-top:18px"><h3 class="panel-title">Full inventory</h3><p class="panel-sub">Sorted by lowest stock first</p>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th class="r">Stock</th><th class="r">Alert at</th><th class="r">Value</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

/* ----- SETTINGS ----- */
function viewSettings() {
  const sh = S.shop;
  return '<div class="view-head"><div><h2>Settings</h2><p class="sub">Shop details print on every invoice</p></div></div>' +
    '<div class="two-col"><div class="card"><h3 class="panel-title">Shop details</h3><p class="panel-sub">Shown on the invoice header</p>' +
    '<form id="shop-form"><div class="field"><label for="sh-name">Shop name</label><input id="sh-name" name="name" required maxlength="80" value="' + esc(sh.name || '') + '"/></div>' +
    '<div class="field"><label for="sh-address">Address</label><textarea id="sh-address" name="address" rows="2" maxlength="160">' + esc(sh.address || '') + '</textarea></div>' +
    '<div class="form-grid"><div class="field"><label for="sh-phone">Phone</label><input id="sh-phone" name="phone" maxlength="20" value="' + esc(sh.phone || '') + '"/></div>' +
    '<div class="field"><label for="sh-gstin">GSTIN</label><input id="sh-gstin" name="gstin" maxlength="15" value="' + esc(sh.gstin || '') + '"/></div></div>' +
    '<button class="btn btn-primary btn-block" type="submit">Save Shop Details</button></form></div>' +
    '<div class="card"><h3 class="panel-title">Data</h3><p class="panel-sub">Everything stays on this device (localStorage)</p>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +
    '<button class="btn btn-ghost btn-block" data-action="export-data">Download backup (JSON)</button>' +
    '<button class="btn btn-ghost btn-block" data-action="sample-data">Load sample data</button>' +
    '<button class="btn btn-danger btn-block" data-action="clear-data">Clear all data</button>' +
    '<p class="hint" style="font-size:13px;color:var(--ink-soft);margin:6px 0 0">Clear all data wipes products, sales, held bills and shop details — you start fresh with an empty shop. Load sample data first if you want to explore with a demo catalog.</p></div></div></div>';
}
function exportData() {
  const dump = {};
  store.keys().forEach(k => { dump[k] = store.get(k.slice(NS.length), null); });
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dukaandaar-backup-' + todayStr() + '.json';
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

  if (a === 'nav') { view = t.dataset.view; render(); return; }
  if (a === 'overlay-close' && e.target === t) { closeModal(); return; }
  if (a === 'close-modal') { closeModal(); return; }
  if (a === 'confirm-yes') { const f = window._confirmFn; window._confirmFn = null; closeModal(); if (f) f(); return; }

  if (a === 'chip') { billFilter.cat = t.dataset.cat; render(); return; }
  if (a === 'tile-add') {
    const r = addToCart(t.dataset.pid);
    if (!r.ok) toast(r.msg, 'warn'); else { render(); toast('Added to bill.'); }
    return;
  }
  if (a === 'qty-inc') { const p = prod(t.dataset.pid); if (p) { const r = addToCart(p.id); if (!r.ok) toast(r.msg, 'warn'); render(); } return; }
  if (a === 'qty-dec') { setCartQty(t.dataset.pid, (S.cart.find(l => l.pid === t.dataset.pid) || { qty: 1 }).qty - 1); render(); return; }
  if (a === 'line-remove') { removeCartLine(t.dataset.pid); render(); return; }
  if (a === 'clear-cart') { clearCart(); render(); return; }
  if (a === 'hold-bill') { const r = holdBill(); toast(r.ok ? 'Bill held.' : r.msg, r.ok ? '' : 'warn'); render(); return; }
  if (a === 'resume-held') { resumeHeld(t.dataset.id); view = 'bill'; render(); toast('Held bill restored.'); return; }
  if (a === 'discard-held') { discardHeld(t.dataset.id); render(); return; }
  if (a === 'complete-bill') {
    const mode = ($('#pay-mode') || {}).value || 'Cash';
    const r = completeSale(mode);
    if (!r.ok) { toast(r.msg, 'warn'); return; }
    openInvoice(r.sale); render(); toast('Bill ' + r.sale.billNo + ' completed.');
    return;
  }
  if (a === 'print-invoice') { window.print(); return; }
  if (a === 'view-invoice') { const s = S.sales.find(x => x.id === t.dataset.id); if (s) openInvoice(s); return; }

  if (a === 'open-product-modal') { openModal(productFormHTML(null)); return; }
  if (a === 'edit-product') { const p = prod(t.dataset.id); if (p) openModal(productFormHTML(p)); return; }
  if (a === 'delete-product') {
    const p = prod(t.dataset.id);
    openConfirm('Delete "' + (p ? p.name : '') + '" from the catalog? It stays on past bills.', 'Delete', () => {
      deleteProduct(t.dataset.id); render(); toast('Product deleted.');
    });
    return;
  }
  if (a === 'restock') {
    const p = prod(t.dataset.id); if (!p) return;
    const inp = $('#rs-' + p.id) || $('#rs2-' + p.id);
    const n = Math.floor(Number(inp && inp.value) || 0);
    if (n <= 0) { toast('Enter a quantity to add.', 'warn'); return; }
    p.stock += n; save('products'); render(); toast('Added ' + n + ' to ' + p.name + '.');
    return;
  }
  if (a === 'export-data') { exportData(); return; }
  if (a === 'sample-data') {
    seed(); view = 'bill'; render(); toast('Sample data loaded.');
    return;
  }
  if (a === 'clear-data') {
    openConfirm('Clear all data? Products, sales, held bills and shop details will be wiped. You will start fresh with an empty shop.', 'Clear all data', () => {
      store.wipe(); loadState(); view = 'bill'; render(); toast('All data cleared. Starting fresh.');
    });
    return;
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'bill-search') { billFilter.q = e.target.value; renderTiles(); }
  if (e.target.id === 'prod-search') { prodFilter.q = e.target.value; renderProductRows(); }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'product-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const f = { name: String(fd.get('name') || ''), price: Number(fd.get('price')), gst: Number(fd.get('gst')), stock: Number(fd.get('stock')), low: Number(fd.get('low')), cat: String(fd.get('cat') || 'Grocery') };
    const id = e.target.dataset.id;
    const r = id ? updateProduct(id, f) : addProduct(f);
    if (!r.ok) { $('#pf-errors').textContent = r.errs.join(' '); return; }
    closeModal(); render(); toast(id ? 'Product updated.' : 'Product added.');
  }
  if (e.target.id === 'shop-form') {
    e.preventDefault();
    const fd = new FormData(e.target);
    S.shop = { name: String(fd.get('name') || '').trim(), address: String(fd.get('address') || '').trim(), phone: String(fd.get('phone') || '').trim(), gstin: String(fd.get('gstin') || '').trim().toUpperCase() };
    save('shop'); toast('Shop details saved.');
  }
});

/* ============================================================
   SELF-TEST (?selftest=1)
   Wipes the dp_v1_* namespace, seeds, scripts a full billing flow,
   re-reads from localStorage, re-renders, then restores any prior
   data so normal mode is never corrupted.
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
    // snapshot any existing normal-mode data
    store.keys().forEach(k => { snapshot[k] = localStorage.getItem(k); });

    // (a) wipe namespace, (b) seed
    store.wipe(); loadState(); seed();

    // 1 — seeded catalog
    check('seed: 12+ products', S.products.length >= 12, 'got ' + S.products.length);

    // 2 — add product (CRUD create)
    const addR = addProduct({ name: 'Selftest Biscuit 100g', price: 10, gst: 5, stock: 100, low: 10, cat: 'Snacks' });
    check('addProduct ok', addR.ok && !!prod(addR.product.id), addR.ok ? '' : addR.errs.join(' '));
    const badR = addProduct({ name: '', price: -5, gst: 7, stock: -1, low: 0 });
    check('addProduct rejects invalid', !badR.ok && badR.errs.length >= 2, badR.errs.join(' '));

    // 3 — build bill, verify GST math: 2× ₹10 @5% = ₹20 + ₹1 GST; 1× milk ₹32 @0%
    const milk = S.products.find(p => p.name.indexOf('Milk') > -1);
    check('seed milk found', !!milk);
    addToCart(addR.product.id, 2);
    addToCart(milk.id, 1);
    const t = cartTotals();
    check('cart subtotal = 52', t.subtotal === 52, 'got ' + t.subtotal);
    check('cart GST total = 1', t.gstTotal === 1, 'got ' + t.gstTotal);
    check('cart grand = 53', t.rounded === 53, 'got ' + t.rounded);
    const line = t.lines.find(l => l.pid === addR.product.id);
    check('per-line GST recorded', line && line.gst === 1, 'got ' + (line && line.gst));

    // 4 — hold / clear bill
    const heldN = S.held.length;
    holdBill();
    check('hold bill', S.held.length === heldN + 1 && S.cart.length === 0);
    resumeHeld(S.held[0].id);
    check('resume held bill', cartTotals().lines.length === 2);

    // 5 — complete bill: stock decrement + sale recorded
    const stockBefore = prod(addR.product.id).stock;
    const milkBefore = milk.stock;
    const salesBefore = S.sales.length;
    const done = completeSale('UPI');
    check('completeSale ok', done.ok, done.ok ? '' : done.msg);
    check('stock decremented', prod(addR.product.id).stock === stockBefore - 2 && milk.stock === milkBefore - 1,
      'biscuit ' + stockBefore + '→' + prod(addR.product.id).stock);
    check('sale recorded', S.sales.length === salesBefore + 1 && S.sales[0].grand === 53 && S.sales[0].mode === 'UPI');
    check('cart cleared after sale', S.cart.length === 0);

    // 6 — low-stock alert lists the seeded Cetirizine (stock 2 <= low 5)
    const low = lowStockList();
    check('low-stock alert fires', low.some(p => p.name.indexOf('Cetirizine') > -1), low.map(p => p.name).join(', '));

    // 7 — reports see the sale
    check('today revenue > 0', revenueOf(salesSince(1)) >= 53);
    check('top items include biscuit', topItems(7).some(x => x.name.indexOf('Selftest Biscuit') > -1));

    // 8 — persistence: re-read raw from localStorage, compare
    const rawProducts = JSON.parse(localStorage.getItem(NS + 'products'));
    const rawSales = JSON.parse(localStorage.getItem(NS + 'sales'));
    check('localStorage round-trip', Array.isArray(rawProducts) && rawProducts.length === S.products.length &&
      Array.isArray(rawSales) && rawSales.length === S.sales.length &&
      rawSales[0].billNo === S.sales[0].billNo);

    // 9 — re-render every view without throwing
    let renderOk = true, renderErr = '';
    try { ['bill', 'products', 'reports', 'stock', 'settings'].forEach(v => { view = v; render(); }); view = 'bill'; render(); }
    catch (err) { renderOk = false; renderErr = String(err && err.message || err); }
    check('all views render', renderOk, renderErr);
    check('invoice HTML builds', invoiceHTML(S.sales[0]).indexOf('DP-') > -1);

    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    const msg = failed.length
      ? 'SELFTEST FAIL: ' + failed.map(f => f.name + (f.detail ? ' (' + f.detail + ')' : '')).join('; ')
      : 'SELFTEST PASS ' + passed + '/' + results.length;
    return { msg, ok: !failed.length, snapshot };
  } catch (err) {
    return { msg: 'SELFTEST FAIL: exception ' + String(err && err.message || err), ok: false, snapshot };
  } finally {
    // end-of-test cleanup: leave the namespace EMPTY (wipe only, no re-seed),
    // restoring any prior normal-mode data first so real use is never corrupted
    store.wipe();
    const keys = Object.keys(snapshot);
    if (keys.length) keys.forEach(k => localStorage.setItem(k, snapshot[k]));
    loadState();
    view = 'bill'; render();
  }
}

/* ---------- boot ---------- */
function boot() {
  loadState();   // clean start: empty state when nothing stored (no auto-seed)
  render();
  startClock();
  if (new URLSearchParams(location.search).get('selftest') === '1') {
    const r = runSelftest();
    selftestBanner(r.ok, r.msg);
    // also expose machine-readable result
    const d = document.createElement('div');
    d.id = 'selftest-detail'; d.style.display = 'none'; d.textContent = r.msg;
    document.body.appendChild(d);
  }
}
boot();
