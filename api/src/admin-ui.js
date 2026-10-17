// پنل مدیریت. هیچ داده‌ای با innerHTML وارد صفحه نمی‌شود (جلوگیری از XSS ذخیره‌شده از نام/آدرس مشتری).
// نکته: در متن JS زیر از backtick و ${ استفاده نشده تا داخل template string مشکلی پیش نیاید.
export const ADMIN_HTML = base => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#1E6B45"><title>مدیریت ناروَن</title><link rel="stylesheet" href="${base}/app.css"></head><body><div id="root"></div><script src="${base}/app.js"></script></body></html>`;

export const ADMIN_CSS = String.raw`
:root{--g9:#0F3A27;--g7:#1E6B45;--g5:#3E9B5F;--g1:#E4F1DE;--bg:#F5F9F2;--line:#D9E6D5;--red:#B3362F;--amber:#B87A0B}
*{box-sizing:border-box;margin:0}body{font-family:Vazirmatn,Tahoma,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:#15271D;line-height:1.7}
input,select,textarea,button{font:inherit;color:inherit}input,select,textarea{width:100%;padding:9px 11px;border:1px solid #C4D6BF;border-radius:9px;background:#fff;font-size:16px}
input[type=color]{padding:2px;height:42px}button{cursor:pointer;border:0;border-radius:9px;padding:8px 14px;background:var(--g7);color:#fff;font-weight:600}button.alt{background:var(--g1);color:var(--g7)}button.red{background:var(--red)}button:disabled{opacity:.5}
header{background:var(--g9);color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:sticky;top:0;z-index:5}header h1{font-size:1.1rem;margin-inline-end:auto}
nav{display:flex;gap:4px;flex-wrap:wrap}nav button{background:transparent;color:#cfe5d2}nav button.on{background:var(--g7);color:#fff}
main{max-width:1100px;margin:14px auto;padding:0 12px 60px}.box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
.login{max-width:340px;margin:12vh auto}.login h1{margin-bottom:12px;color:var(--g7)}label{display:block;font-size:.85rem;font-weight:600;margin:10px 0 3px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}.stats .box{margin:0}.stats b{display:block;font-size:1.3rem;color:var(--g7)}.stats span{font-size:.8rem;color:#55665B}
table{width:100%;border-collapse:collapse;font-size:.88rem}th,td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:start}th{color:#55665B;font-weight:600}tr.click{cursor:pointer}tr.click:hover{background:var(--g1)}.wrap{overflow-x:auto}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:10px}.row>*{flex:1 1 150px}.row>button{flex:0 0 auto}.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 12px}
.tag{display:inline-block;padding:1px 10px;border-radius:99px;font-size:.78rem;background:var(--g1);color:var(--g7)}.tag.r{background:#FBE2E0;color:var(--red)}.tag.y{background:#FFF1CC;color:#6b4500}
.err{color:var(--red);font-size:.85rem;min-height:1.2em}.muted{color:#55665B;font-size:.85rem}.ltr{direction:ltr;text-align:left;unicode-bidi:plaintext}
#toast{position:fixed;bottom:18px;inset-inline:0;margin:auto;width:max-content;max-width:90%;background:var(--g9);color:#fff;padding:9px 18px;border-radius:99px;opacity:0;transition:.3s;pointer-events:none}#toast.show{opacity:1}
dialog{border:0;border-radius:14px;padding:18px;max-width:640px;width:94%;max-height:90vh;overflow:auto}dialog::backdrop{background:rgba(0,0,0,.45)}
`;

export const ADMIN_JS = String.raw`
(function () {
  'use strict';
  var root = document.getElementById('root');
  var ST = { pending: ['در انتظار پرداخت', 'r'], awaiting_verify: ['نیازمند تأیید رسید', 'y'], paid: ['پرداخت‌شده', ''], processing: ['در حال آماده‌سازی', ''], shipped: ['ارسال شد', ''], delivered: ['تحویل شد', ''], cancelled: ['لغو شد', 'r'], failed: ['ناموفق', 'r'], cod: ['پرداخت در محل', ''] };
  var PAYM = { online: 'آنلاین', card: 'کارت‌به‌کارت', cod: 'در محل' };
  var ARTS = ['book', 'paper', 'pen', 'pencil', 'colors', 'marker', 'stapler', 'glue', 'case', 'bag'];
  var fa = function (n) { return Number(n || 0).toLocaleString('fa-IR'); };
  var date = function (t) { return new Date(t * 1000).toLocaleString('fa-IR'); };
  // سازندهٔ امن DOM: فقط textContent، هرگز innerHTML
  function h(tag, attrs) {
    var el = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === false || v == null) return; if (k === 'class') el.className = v; else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); }); else if (k === 'value') el.value = v; else el.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; (Array.isArray(c) ? c : [c]).forEach(function (x) { el.appendChild(x && x.nodeType ? x : document.createTextNode(String(x))); }); }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  var tt; function toast(m) { var t = document.getElementById('toast'); if (!t) { t = h('div', { id: 'toast' }); document.body.appendChild(t); } t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); }, 2500); }
  function api(path, method, body) {
    var o = { method: method || 'GET', credentials: 'same-origin', headers: {} };
    if (o.method !== 'GET') o.headers['X-Admin-Req'] = '1';
    if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch('/api/admin/' + path, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 401 && path !== 'login') { login(); throw new Error('نیاز به ورود'); } if (!r.ok) throw new Error(j.error || 'خطا'); return j; }); });
  }
  var flags = {};
  function login() {
    clear(root);
    var pw = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'رمز' }), er = h('div', { class: 'err' }), btn = h('button', { type: 'submit' }, 'ورود');
    root.appendChild(h('form', { class: 'box login', on: { submit: function (e) { e.preventDefault(); btn.disabled = true; er.textContent = ''; api('login', 'POST', { password: pw.value }).then(start).catch(function (x) { er.textContent = x.message; btn.disabled = false; pw.value = ''; }); } } },
      h('h1', {}, 'مدیریت ناروَن'), h('label', {}, 'رمز مدیر'), pw, er, btn));
    pw.focus();
  }
  var tabs = [['orders', 'سفارش‌ها'], ['products', 'محصولات'], ['coupons', 'کدهای تخفیف'], ['messages', 'پیام‌ها'], ['settings', 'تنظیمات']], cur = 'orders', body;
  function start() {
    api('me').then(function (m) { flags = m.flags; shell(); show(cur); }).catch(function () { });
  }
  function shell() {
    clear(root);
    var nav = h('nav', {}, tabs.map(function (t) { return h('button', { 'data-t': t[0], class: t[0] === cur ? 'on' : '', on: { click: function () { show(t[0]); } } }, t[1]); }));
    root.appendChild(h('header', {}, h('h1', {}, 'مدیریت ناروَن'), nav, h('button', { class: 'alt', on: { click: function () { api('logout', 'POST').then(login); } } }, 'خروج')));
    body = h('main'); root.appendChild(body);
  }
  function show(t) { cur = t; Array.prototype.forEach.call(document.querySelectorAll('nav button'), function (b) { b.className = b.getAttribute('data-t') === t ? 'on' : ''; }); clear(body); ({ orders: orders, products: products, coupons: coupons, messages: messages, settings: settings })[t](); }
  function tag(st) { var s = ST[st] || [st, '']; return h('span', { class: 'tag ' + s[1] }, s[0]); }

  function orders() {
    var stats = h('div', { class: 'stats' }), list = h('div', { class: 'box wrap' }), q = h('input', { placeholder: 'جست‌وجو: کد، نام یا موبایل' }), sel = h('select', {}, h('option', { value: '' }, 'همهٔ وضعیت‌ها'), Object.keys(ST).map(function (k) { return h('option', { value: k }, ST[k][0]); }));
    function load() { api('orders?status=' + encodeURIComponent(sel.value) + '&q=' + encodeURIComponent(q.value)).then(function (r) { clear(list); list.appendChild(h('table', {}, h('thead', {}, h('tr', {}, ['کد', 'مشتری', 'موبایل', 'مبلغ', 'پرداخت', 'وضعیت', 'زمان'].map(function (x) { return h('th', {}, x); }))), h('tbody', {}, r.orders.length ? r.orders.map(function (o) { return h('tr', { class: 'click', on: { click: function () { detail(o.code); } } }, h('td', { class: 'ltr' }, o.code), h('td', {}, o.name), h('td', { class: 'ltr' }, o.phone), h('td', {}, fa(o.total)), h('td', {}, PAYM[o.pay_method]), h('td', {}, tag(o.status)), h('td', {}, date(o.created_at))); }) : h('tr', {}, h('td', { colspan: 7, class: 'muted' }, 'سفارشی نیست'))))); }).catch(function (e) { toast(e.message); }); }
    api('stats').then(function (s) { [['سفارش ۲۴ ساعت اخیر', fa(s.today_orders)], ['فروش ۲۴ ساعت (تومان)', fa(s.today_sum)], ['نیازمند تأیید رسید', fa(s.to_verify)], ['کم‌موجودی (۵ یا کمتر)', fa(s.low_stock)], ['جمع فروش پرداخت‌شده', fa(s.paid_total)]].forEach(function (x) { stats.appendChild(h('div', { class: 'box' }, h('b', {}, x[1]), h('span', {}, x[0]))); }); });
    sel.addEventListener('change', load); q.addEventListener('input', function () { clearTimeout(q.t); q.t = setTimeout(load, 300); });
    body.appendChild(stats); body.appendChild(h('div', { class: 'row' }, q, sel, h('a', { href: '/api/admin/export/orders.csv' }, h('button', { class: 'alt', type: 'button' }, 'دریافت CSV')))); body.appendChild(list); load();
  }
  function modal(title, content) { var d = h('dialog', {}, h('div', { class: 'row' }, h('b', {}, title), h('button', { class: 'alt', on: { click: function () { d.close(); } } }, 'بستن')), content); d.addEventListener('close', function () { d.remove(); }); document.body.appendChild(d); d.showModal(); return d; }
  function detail(code) {
    api('orders/' + code).then(function (r) {
      var o = r.order, st = h('select', {}, Object.keys(ST).map(function (k) { return h('option', { value: k, selected: k === o.status }, ST[k][0]); })), tc = h('input', { value: o.tracking_code, class: 'ltr', placeholder: 'کد رهگیری پست', maxlength: 40 });
      var d = modal('سفارش ' + o.code, h('div', {},
        h('p', {}, tag(o.status), ' ', PAYM[o.pay_method], ' — ', date(o.created_at)),
        h('p', {}, h('b', {}, o.name), ' ', h('span', { class: 'ltr' }, o.phone)), h('p', {}, o.province + '، ' + o.city + '، ' + o.address + (o.unit ? '، ' + o.unit : '') + ' — کدپستی ', h('span', { class: 'ltr' }, o.zip)),
        h('table', {}, r.items.map(function (i) { return h('tr', {}, h('td', {}, i.name + ' × ' + fa(i.qty)), h('td', {}, fa(i.price * i.qty))); }),
          h('tr', {}, h('td', {}, 'تخفیف' + (o.coupon ? ' (' + o.coupon + ')' : '')), h('td', {}, fa(o.discount))), h('tr', {}, h('td', {}, 'ارسال'), h('td', {}, fa(o.ship_fee))), h('tr', {}, h('th', {}, 'جمع'), h('th', {}, fa(o.total)))),
        r.payments.length ? h('div', { class: 'box' }, h('b', {}, 'پرداخت‌ها'), r.payments.map(function (p) { return h('p', { class: 'muted' }, p.provider + ' — ' + p.status + (p.card_last4 ? ' — کارت ****' + p.card_last4 : '') + (p.receipt_ref ? ' — رسید: ' + p.receipt_ref : '') + (p.ref_id ? ' — مرجع: ' + p.ref_id : '')); })) : null,
        h('label', {}, 'وضعیت'), st, h('label', {}, 'کد رهگیری'), tc,
        h('p', { class: 'muted' }, 'با «پرداخت‌شده» پس از بررسی رسید، پرداخت کارت‌به‌کارت تأیید می‌شود. لغو سفارش، موجودی را به انبار برمی‌گرداند.'),
        h('div', { class: 'row' }, h('button', { on: { click: function () { var b = { tracking_code: tc.value }; if (st.value !== o.status) b.status = st.value; api('orders/' + o.code, 'PATCH', b).then(function () { toast('ذخیره شد'); d.close(); show('orders'); }).catch(function (e) { toast(e.message); }); } } }, 'ذخیره'))));
    }).catch(function (e) { toast(e.message); });
  }

  function products() {
    var box = h('div', { class: 'box wrap' }), cats = [];
    function load() { api('products').then(function (r) { cats = r.cats; clear(box); box.appendChild(h('table', {}, h('thead', {}, h('tr', {}, ['نام', 'قیمت', 'موجودی', 'وضعیت', ''].map(function (x) { return h('th', {}, x); }))), h('tbody', {}, r.products.map(function (p) { return h('tr', {}, h('td', {}, p.name), h('td', {}, fa(p.price)), h('td', {}, h('span', { class: 'tag ' + (p.stock <= 5 ? 'r' : '') }, fa(p.stock))), h('td', {}, p.active ? 'فعال' : h('span', { class: 'tag r' }, 'بایگانی')), h('td', {}, h('button', { class: 'alt', on: { click: function () { edit(p); } } }, 'ویرایش'))); })))); }).catch(function (e) { toast(e.message); }); }
    function edit(p) {
      p = p || { name: '', brand: 'نارون', cat_id: cats[0] ? cats[0].id : 1, price: 0, old_price: '', stock: 0, description: '', image: '', art: 'book', color: '#3E9B5F', bg: '#E4F1DE', rating: 0, reviews: 0, active: 1, slug: '' };
      var f = {};
      function fld(k, label, type, extra) { f[k] = h(type === 'textarea' ? 'textarea' : 'input', Object.assign({ value: p[k] == null ? '' : p[k], type: type === 'textarea' ? null : type || 'text' }, extra || {})); if (type === 'textarea') f[k].value = p[k] || ''; return h('div', {}, h('label', {}, label), f[k]); }
      f.cat_id = h('select', {}, cats.map(function (c) { return h('option', { value: c.id, selected: c.id === p.cat_id }, c.name); }));
      f.art = h('select', {}, ARTS.map(function (a) { return h('option', { value: a, selected: a === p.art }, a); }));
      f.active = h('select', {}, h('option', { value: 1, selected: !!p.active }, 'فعال (نمایش در فروشگاه)'), h('option', { value: 0, selected: !p.active }, 'بایگانی (مخفی)'));
      var er = h('div', { class: 'err' });
      var d = modal(p.id ? 'ویرایش محصول' : 'محصول جدید', h('div', {},
        h('div', { class: 'grid2' }, fld('name', 'نام', 'text', { maxlength: 120 }), fld('brand', 'برند', 'text', { maxlength: 60 }), h('div', {}, h('label', {}, 'دسته‌بندی'), f.cat_id),
          fld('price', 'قیمت (تومان)', 'number', { min: 0, inputmode: 'numeric' }), fld('old_price', 'قیمت قبل از تخفیف (اختیاری)', 'number', { min: 0 }), fld('stock', 'موجودی', 'number', { min: 0 }),
          fld('image', 'مسیر عکس (images/products/نام.jpg)', 'text', { class: 'ltr', maxlength: 300 }), fld('slug', 'شناسهٔ لاتین (slug)', 'text', { class: 'ltr', maxlength: 80 }), h('div', {}, h('label', {}, 'تصویر جایگزین'), f.art),
          fld('color', 'رنگ اصلی', 'color'), fld('bg', 'رنگ زمینه', 'color'), h('div', {}, h('label', {}, 'وضعیت'), f.active), fld('rating', 'امتیاز (۰ تا ۵)', 'number', { step: '0.1', min: 0, max: 5 }), fld('reviews', 'تعداد نظر', 'number', { min: 0 })),
        fld('description', 'توضیحات', 'textarea', { rows: 3, maxlength: 800 }), er,
        h('div', { class: 'row' }, h('button', { on: { click: function () { var b = {}; Object.keys(f).forEach(function (k) { b[k] = f[k].value; }); ['cat_id', 'price', 'stock', 'reviews', 'active'].forEach(function (k) { b[k] = Number(b[k]); }); b.rating = Number(b.rating); b.old_price = b.old_price === '' ? null : Number(b.old_price); if (!b.slug) delete b.slug; api(p.id ? 'products/' + p.id : 'products', p.id ? 'PUT' : 'POST', b).then(function () { toast('ذخیره شد'); d.close(); load(); }).catch(function (e) { er.textContent = e.message; }); } } }, 'ذخیره'))));
    }
    body.appendChild(h('div', { class: 'row' }, h('button', { on: { click: function () { edit(null); } } }, 'محصول جدید'), h('span', { class: 'muted' }, 'عکس‌ها را در پوشهٔ site/images/products پروژه بگذارید و مسیرشان را اینجا بنویسید.'))); body.appendChild(box); load();
  }

  function coupons() {
    var box = h('div', { class: 'box wrap' }), f = { code: h('input', { class: 'ltr', maxlength: 20, placeholder: 'WELCOME10' }), percent: h('input', { type: 'number', min: 1, max: 90 }), min_total: h('input', { type: 'number', min: 0, placeholder: '0' }), max_uses: h('input', { type: 'number', min: 1, placeholder: 'نامحدود' }), days: h('input', { type: 'number', min: 1, placeholder: 'بدون انقضا' }) };
    function load() { api('coupons').then(function (r) { clear(box); box.appendChild(h('table', {}, h('thead', {}, h('tr', {}, ['کد', 'درصد', 'حداقل خرید', 'استفاده', 'انقضا', 'وضعیت', ''].map(function (x) { return h('th', {}, x); }))), h('tbody', {}, r.coupons.map(function (c) { return h('tr', {}, h('td', { class: 'ltr' }, c.code), h('td', {}, fa(c.percent) + '٪'), h('td', {}, fa(c.min_total)), h('td', {}, fa(c.used) + (c.max_uses ? ' / ' + fa(c.max_uses) : '')), h('td', {}, c.expires_at ? date(c.expires_at) : '—'), h('td', {}, c.active ? 'فعال' : h('span', { class: 'tag r' }, 'غیرفعال')), h('td', {}, c.active ? h('button', { class: 'red', on: { click: function () { api('coupons/' + c.code, 'DELETE').then(load); } } }, 'غیرفعال') : null)); })))); }); }
    var er = h('div', { class: 'err' });
    body.appendChild(h('div', { class: 'box' }, h('b', {}, 'کد تخفیف جدید'), h('div', { class: 'row' }, h('div', {}, h('label', {}, 'کد'), f.code), h('div', {}, h('label', {}, 'درصد'), f.percent), h('div', {}, h('label', {}, 'حداقل خرید'), f.min_total), h('div', {}, h('label', {}, 'سقف تعداد استفاده'), f.max_uses), h('div', {}, h('label', {}, 'اعتبار (روز)'), f.days), h('button', { on: { click: function () { api('coupons', 'POST', { code: f.code.value, percent: f.percent.value, min_total: f.min_total.value, max_uses: f.max_uses.value, days: f.days.value }).then(function () { toast('ثبت شد'); load(); }).catch(function (e) { er.textContent = e.message; }); } } }, 'ثبت')), er));
    body.appendChild(box); load();
  }

  function messages() {
    var box = h('div', {});
    function load() { api('messages').then(function (r) { clear(box); if (!r.messages.length) box.appendChild(h('div', { class: 'box muted' }, 'پیامی نیست')); r.messages.forEach(function (m) { box.appendChild(h('div', { class: 'box' }, h('div', { class: 'row' }, h('b', {}, m.name || 'بی‌نام'), h('span', { class: 'ltr muted' }, m.contact), h('span', { class: 'muted' }, date(m.created_at)), m.is_read ? null : h('span', { class: 'tag y' }, 'جدید')), h('p', {}, m.body), h('div', { class: 'row' }, m.is_read ? null : h('button', { class: 'alt', on: { click: function () { api('messages/' + m.id + '/read', 'POST').then(load); } } }, 'خوانده شد'), h('button', { class: 'red', on: { click: function () { if (confirm('حذف شود؟')) api('messages/' + m.id, 'DELETE').then(load); } } }, 'حذف')))); }); }); }
    body.appendChild(box); load();
  }

  function settings() {
    api('settings').then(function (r) {
      var c = r.config, f = { freeShip: h('input', { type: 'number', min: 0, value: c.freeShip }) }, pay = {}, ship = {}, er = h('div', { class: 'err' });
      Object.keys(c.ship).forEach(function (k) { ship[k] = h('input', { type: 'number', min: 0, value: c.ship[k].fee }); });
      Object.keys(c.pay).forEach(function (k) { pay[k] = h('input', { type: 'checkbox', checked: c.pay[k] }); pay[k].checked = c.pay[k]; pay[k].style.width = 'auto'; });
      var names = { post: 'پست پیشتاز', courier: 'پیک موتوری', pickup: 'تحویل حضوری' }, pn = { online: 'پرداخت آنلاین', card: 'کارت‌به‌کارت', cod: 'پرداخت در محل' };
      body.appendChild(h('div', { class: 'box' }, h('b', {}, 'ارسال'), h('div', { class: 'grid2' }, h('div', {}, h('label', {}, 'ارسال رایگان پست از مبلغ (تومان)'), f.freeShip), Object.keys(ship).map(function (k) { return h('div', {}, h('label', {}, 'هزینهٔ ' + names[k]), ship[k]); })),
        h('b', {}, 'روش‌های پرداخت'), Object.keys(pay).map(function (k) { return h('label', {}, pay[k], ' ' + pn[k] + (k === 'online' && !flags.online ? ' (درگاه هنوز در سرور تنظیم نشده)' : '') + (k === 'card' && !flags.card ? ' (مشخصات حساب هنوز در سرور تنظیم نشده)' : '')); }), er,
        h('div', { class: 'row' }, h('button', { on: { click: function () { var b = { freeShip: Number(f.freeShip.value), ship: {}, pay: {} }; Object.keys(ship).forEach(function (k) { b.ship[k] = { fee: Number(ship[k].value) }; }); Object.keys(pay).forEach(function (k) { b.pay[k] = pay[k].checked; }); api('settings', 'PUT', b).then(function () { toast('ذخیره شد'); er.textContent = ''; }).catch(function (e) { er.textContent = e.message; }); } } }, 'ذخیره'))));
      body.appendChild(h('div', { class: 'box muted' }, 'حالت درگاه: ' + (flags.mode || '—') + ' | محیط: ' + (flags.env || '—') + (flags.mode === 'test' ? ' — درگاه آزمایشی فقط برای توسعه است' : '')));
      var au = h('div', { class: 'box wrap' }, h('b', {}, 'گزارش فعالیت مدیر')); body.appendChild(au);
      api('audit').then(function (a) { au.appendChild(h('table', {}, a.audit.map(function (x) { return h('tr', {}, h('td', {}, date(x.at)), h('td', {}, x.action), h('td', { class: 'ltr muted' }, x.detail)); }))); });
    }).catch(function (e) { toast(e.message); });
  }
  api('me').then(function () { start(); }).catch(function () { login(); });
})();
`;
