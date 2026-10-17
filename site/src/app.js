// منطق مرورگر: مسیریابی، سبد خرید، ثبت سفارش و پیگیری. قیمت و موجودی نهایی همیشه سمت سرور محاسبه می‌شود.
import { setBase, u, e, num, fa, T, card, pic, homeView, shopView, productView, pageView, prodOf } from './render.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const seed = JSON.parse($('#seed').textContent);
const site = { ...seed.site, origin: location.origin }, API = seed.api || '', BASE = seed.base || '';
setBase(BASE);
let data = { cats: seed.cats, products: seed.products }, cfg = site.config;
const app = $('#app'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- ذخیره‌سازی امن (JSON با اعتبارسنجی) ----------
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* حالت خصوصی */ } };
const sanitizeCart = c => { const o = {}; if (c && typeof c === 'object') for (const [k, q] of Object.entries(c)) { const id = +k, n = Math.floor(+q); if (prodOf(data, id) && n > 0) o[id] = Math.min(n, 99); } return o; };
let cart = sanitizeCart(load('nr_cart', {})), coupon = null, shipSel = 'post';
let F = { q: '', sort: 'pop' };

// ---------- ابزارها ----------
const en = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
async function api(path, body, method) {
  if (!API) throw Object.assign(new Error('سرور فروشگاه هنوز متصل نشده است.'), { status: 0 });
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(API + path, { method: method || (body ? 'POST' : 'GET'), headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'خطا در ارتباط با سرور'), { status: r.status, data: j });
    return j;
  } catch (err) { if (err.name === 'AbortError') throw new Error('پاسخی از سرور نرسید؛ دوباره تلاش کنید.'); if (err instanceof TypeError) throw new Error('ارتباط با سرور برقرار نشد.'); throw err; } finally { clearTimeout(tm); }
}
const commit = () => { save('nr_cart', cart); const n = fa(Object.values(cart).reduce((a, b) => a + b, 0)); $$('.bd').forEach(b => { b.textContent = n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }); };
const when = d => new Date(Date.now() + d * 864e5).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
const eta = m => { const [a, b] = cfg.ship[m].days; return a === 0 && b === 0 ? 'آماده در ۲۴ ساعت' : a === 0 ? 'تحویل: امروز یا فردا' : `تحویل: ${when(a)} تا ${when(b)}`; };
function totals(m) {
  const sub = Object.entries(cart).reduce((s, [id, q]) => s + (prodOf(data, id)?.price || 0) * q, 0);
  const disc = coupon ? Math.round(sub * coupon.percent / 100) : 0, base = sub - disc;
  const ship = m && sub ? (m === 'post' && base >= cfg.freeShip ? 0 : cfg.ship[m].fee) : 0;
  return { sub, disc, base, ship, total: base + ship };
}
function add(id, n = 1, from) {
  const p = prodOf(data, id); if (!p) return false;
  const q = (cart[id] || 0) + n; if (q > p.stock) { toast('موجودی کافی نیست'); return false; }
  cart[id] = q; commit(); toast('به سبد خرید اضافه شد'); if (from) fly(from); return true;
}
function fly(from) { // برگ نارون از دکمه تا سبد پرواز می‌کند
  if (reduce || !from.animate) return;
  const to = ($('.cartbtn').offsetParent ? $('.cartbtn') : $('.tabs [data-t=cart]')).getBoundingClientRect(), a = from.getBoundingClientRect();
  const el = document.createElement('i'); el.className = 'flyleaf'; document.body.appendChild(el);
  el.animate([{ transform: `translate(${a.left + a.width / 2}px,${a.top}px) scale(1) rotate(0)`, opacity: 1 }, { transform: `translate(${to.left + to.width / 2}px,${to.top}px) scale(.3) rotate(220deg)`, opacity: .2 }], { duration: 650, easing: 'cubic-bezier(.5,-.2,.6,1)' }).onfinish = () => el.remove();
}

// ---------- مسیریابی ----------
const parse = () => { const p = location.pathname.slice(BASE.length).replace(/^\/|\/$/g, '').split('/'); return { name: p[0] || '', arg: p[1], qs: new URLSearchParams(location.search) }; };
function meta(v) {
  document.title = v.title;
  const set = (sel, attr, val) => { const el = $(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name=description]', 'content', v.desc); set('meta[property="og:title"]', 'content', v.title); set('link[rel=canonical]', 'href', location.origin + location.pathname);
}
function show(v, { first } = {}) {
  if (!first) { app.innerHTML = v.html; app.dataset.route = location.pathname.slice(BASE.length) || '/'; if (v.title) meta(v); window.scrollTo(0, 0); if (!reduce) { app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); } app.focus({ preventScroll: true }); }
  observe();
}
function route(first) {
  const { name, arg, qs } = parse();
  const isStatic = first && app.dataset.route === (location.pathname.slice(BASE.length) || '/') && ['', 'shop', 'category', 'product', 'page'].includes(name);
  const done = v => { show(v, { first: isStatic }); };
  $$('[data-t]').forEach(a => a.classList.toggle('on', a.dataset.t === name || (name === 'product' && a.dataset.t === 'shop') || (name === 'category' && a.dataset.t === 'shop') || (name === 'order' && a.dataset.t === 'orders')));
  switch (name) {
    case '': return done(homeView(data, site));
    case 'shop': { if (qs.has('q')) F.q = qs.get('q').slice(0, 60); else F.q = ''; done(shopView(data, site, {})); return bindList(); }
    case 'category': { const v = shopView(data, site, { cat: arg }); if (!data.cats.some(c => c.slug === arg)) return notFound(); F.q = ''; done(v); return bindList(); }
    case 'product': { const v = productView(data, site, arg, cfg); return v ? done(v) : notFound(); }
    case 'page': { const v = pageView(data, site, arg, cfg); return v ? done(v) : notFound(); }
    case 'cart': return cartView();
    case 'checkout': return checkout();
    case 'orders': return ordersView();
    case 'order': return orderView(qs.get('code') || '');
    default: return notFound();
  }
}
function notFound() { show({ title: `صفحه پیدا نشد | ${site.name}`, desc: '', html: `<div class="empty"><h1>صفحه پیدا نشد</h1><a class="btn" href="${u('/')}" data-link>بازگشت به خانه</a></div>` }); }
function go(href) { const url = new URL(href, location.origin); if (url.pathname + url.search === location.pathname + location.search) return route(); history.pushState({}, '', url.pathname + url.search); route(); }

// ---------- فروشگاه (فیلتر سمت کاربر) ----------
function bindList() {
  const l = $('#list'); if (!l) return; const q = $('#q'), s = $('#sort'); q.value = F.q; s.value = F.sort; paint();
}
function paint() {
  const l = $('#list'); if (!l) return; const cat = +l.dataset.cat, q = F.q.trim();
  const sorts = { pop: (a, b) => b.reviews - a.reviews, lo: (a, b) => a.price - b.price, hi: (a, b) => b.price - a.price, rate: (a, b) => b.rating - a.rating };
  const r = data.products.filter(p => (!cat || p.cat === cat) && (!q || p.name.includes(q) || p.desc.includes(q))).sort(sorts[F.sort]);
  l.innerHTML = r.length ? r.map(card).join('') : '<div class="empty wide">محصولی پیدا نشد. عبارت دیگری بنویسید یا فیلترها را بردارید.</div>';
  const c = $('#cnt'); if (c) c.textContent = fa(r.length) + ' کالا'; observe();
}

// ---------- سبد ----------
function cartView() {
  const ids = Object.keys(cart);
  const head = { title: `سبد خرید | ${site.name}`, desc: 'سبد خرید' };
  if (!ids.length) return show({ ...head, html: `<div class="empty"><h1>سبد خرید خالی است</h1><p>محصولی انتخاب کنید تا اینجا بماند.</p><a class="btn" href="${u('/shop/')}" data-link>رفتن به فروشگاه</a></div>` });
  const t = totals(), left = Math.max(0, cfg.freeShip - t.base);
  show({ ...head, html: `${steps(1)}<div class="lay"><div class="box">${ids.map(id => { const p = prodOf(data, id); return `<div class="row">${pic(p, 'ic')}<div class="nm"><a href="${u('/product/' + num(id) + '/')}" data-link><b>${e(p.name)}</b></a><div class="meta">${T(p.price)}</div></div>
<div class="ctl"><div class="qty"><button type="button" data-dec="${num(id)}" aria-label="کمتر">−</button><span>${fa(cart[id])}</span><button type="button" data-inc="${num(id)}" aria-label="بیشتر">+</button></div><b>${T(p.price * cart[id])}</b><button class="chip" type="button" data-del="${num(id)}" aria-label="حذف ${e(p.name)}">حذف</button></div></div>`; }).join('')}</div>
<div class="box sum"><div class="meta">${left ? `${T(left)} دیگر تا ارسال رایگان پست` : 'ارسال پست برای سفارش شما رایگان است'}</div><div class="bar2"><i style="width:${Math.min(100, t.base / cfg.freeShip * 100)}%"></i></div>
<label for="cp">کد تخفیف</label><div class="inl"><input id="cp" dir="ltr" maxlength="20" autocomplete="off" value="${e(coupon?.code || '')}"><button class="btn sm" type="button" id="applycp">اعمال</button></div><div class="err" id="cperr">${coupon ? `<span class="ok">${fa(coupon.percent)}٪ تخفیف اعمال شد</span>` : ''}</div>
<div><span>جمع کالاها</span><span>${T(t.sub)}</span></div>${t.disc ? `<div class="ok"><span>تخفیف</span><span>−${T(t.disc)}</span></div>` : ''}<div class="tot"><span>جمع</span><span>${T(t.base)}</span></div>
<a class="btn big" href="${u('/checkout/')}" data-link>ادامه و ثبت سفارش</a></div></div>` });
}
const steps = n => `<div class="steps"><span class="${n >= 1 ? 'on' : ''}">سبد خرید</span><span class="${n >= 2 ? 'on' : ''}">ارسال و پرداخت</span><span class="${n >= 3 ? 'on' : ''}">پایان</span></div>`;

// ---------- پرداخت و ثبت سفارش ----------
const PROV = 'تهران,البرز,اصفهان,خراسان رضوی,فارس,آذربایجان شرقی,آذربایجان غربی,خوزستان,مازندران,گیلان,کرمان,قم,یزد,هرمزگان,کرمانشاه,همدان,مرکزی,زنجان,قزوین,لرستان,اردبیل,گلستان,سیستان و بلوچستان,کردستان,بوشهر,سمنان,ایلام,چهارمحال و بختیاری,خراسان شمالی,خراسان جنوبی,کهگیلویه و بویراحمد'.split(',');
function sumHTML() {
  const t = totals(shipSel);
  return Object.keys(cart).map(id => `<div><span>${e(prodOf(data, id).name)} × ${fa(cart[id])}</span><span>${T(prodOf(data, id).price * cart[id])}</span></div>`).join('') + `${t.disc ? `<div class="ok"><span>تخفیف</span><span>−${T(t.disc)}</span></div>` : ''}<div><span>${e(cfg.ship[shipSel].name)}</span><span>${t.ship ? T(t.ship) : 'رایگان'}</span></div><div class="tot"><span>مبلغ قابل پرداخت</span><span>${T(t.total)}</span></div>`;
}
function shipOpts(prov) {
  if (shipSel === 'courier' && prov !== 'تهران') shipSel = 'post';
  return Object.entries(cfg.ship).map(([k, s]) => { const off = s.only && prov !== s.only, t = totals(k); return `<label class="opt ${off ? 'dis' : ''}"><input type="radio" name="ship" value="${e(k)}" ${shipSel === k ? 'checked' : ''} ${off ? 'disabled' : ''}><span>${e(s.name)}<small>${off ? 'فقط برای ' + e(s.only) : e(s.note) + ' — ' + e(eta(k))}</small></span><b>${t.ship ? T(t.ship) : 'رایگان'}</b></label>`; }).join('');
}
function checkout() {
  if (!Object.keys(cart).length) return go(u('/cart/'));
  const usr = load('nr_user', {}), pr = usr.prov && PROV.includes(usr.prov) ? usr.prov : 'تهران', pay = cfg.pay;
  const opt = (v, t, s, on) => pay[v] ? `<label class="opt"><input type="radio" name="pay" value="${v}" ${on ? 'checked' : ''}><span>${t}<small>${s}</small></span></label>` : '';
  const first = pay.online ? 'online' : pay.card ? 'card' : 'cod';
  show({ title: `ثبت سفارش | ${site.name}`, desc: 'ثبت سفارش', html: `${steps(2)}<div class="lay"><form id="co" novalidate><div class="box"><h2>اطلاعات گیرنده</h2><div class="two">
<div><label for="f1">نام و نام خانوادگی</label><input id="f1" name="name" maxlength="80" autocomplete="name" value="${e(usr.name || '')}"><div class="err"></div></div>
<div><label for="f2">شمارهٔ موبایل</label><input id="f2" name="phone" dir="ltr" inputmode="numeric" maxlength="11" placeholder="09123456789" autocomplete="tel" value="${e(usr.phone || '')}"><div class="err"></div></div>
<div><label for="f3">استان</label><select id="f3" name="prov">${PROV.map(x => `<option ${x === pr ? 'selected' : ''}>${e(x)}</option>`).join('')}</select><div class="err"></div></div>
<div><label for="f4">شهر</label><input id="f4" name="city" maxlength="60" autocomplete="address-level2" value="${e(usr.city || '')}"><div class="err"></div></div>
<div><label for="f5">کد پستی (۱۰ رقم)</label><input id="f5" name="zip" dir="ltr" inputmode="numeric" maxlength="10" autocomplete="postal-code" value="${e(usr.zip || '')}"><div class="err"></div></div>
<div><label for="f6">پلاک / واحد (اختیاری)</label><input id="f6" name="unit" maxlength="40" value="${e(usr.unit || '')}"><div class="err"></div></div></div>
<label for="f7">نشانی کامل (خیابان، کوچه)</label><textarea id="f7" name="addr" rows="3" maxlength="300" autocomplete="street-address">${e(usr.addr || '')}</textarea><div class="err"></div></div>
<div class="box"><h2>روش ارسال</h2><div id="so">${shipOpts(pr)}</div></div>
<div class="box"><h2>روش پرداخت</h2>${opt('online', 'پرداخت آنلاین', 'با کارت بانکی از درگاه امن', first === 'online')}${opt('card', 'کارت‌به‌کارت / شبا', 'پس از ثبت، مشخصات حساب نمایش داده می‌شود', first === 'card')}${opt('cod', 'پرداخت در محل', 'هنگام تحویل کالا', first === 'cod')}</div>
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<label class="opt"><input type="checkbox" name="terms"><span>قوانین خرید و <a href="${u('/page/returns/')}" data-link>شرایط بازگشت کالا</a> را می‌پذیرم.</span></label><div class="err"></div><div class="err" id="coerr"></div>
<button class="btn big go" type="submit">ثبت سفارش و ادامه</button></form>
<div class="box sum stick"><h2>خلاصهٔ سفارش</h2><div id="sm">${sumHTML()}</div></div></div>` });
}
async function place(form) {
  const d = Object.fromEntries(new FormData(form)), errs = $$('#co .err');
  d.phone = en(d.phone || '').trim(); d.zip = en(d.zip || '').trim(); let bad = 0;
  const R = [['name', v => v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5 || 'نام و نام خانوادگی را کامل بنویسید'], ['phone', v => /^09\d{9}$/.test(v) || 'شماره باید مثل 09123456789 باشد'], ['prov', v => PROV.includes(v) || 'استان را انتخاب کنید'], ['city', v => v.trim().length >= 2 || 'شهر را وارد کنید'], ['zip', v => /^\d{10}$/.test(v) || 'کد پستی باید ۱۰ رقم باشد'], ['unit', () => true], ['addr', v => v.trim().length >= 10 || 'نشانی را کامل‌تر بنویسید']];
  R.forEach(([k, f], i) => { const r = f(d[k] || ''); errs[i].textContent = r === true ? '' : r; if (r !== true) bad++; });
  errs[7].textContent = d.terms ? '' : 'برای ادامه، پذیرش قوانین لازم است'; if (!d.terms) bad++;
  if (bad) { const f = $('#co .err:not(:empty)'); f && f.previousElementSibling?.focus?.(); return toast('خطاهای فرم را اصلاح کنید'); }
  const btn = form.querySelector('.go'); btn.disabled = true; btn.textContent = 'در حال ثبت...'; $('#coerr').textContent = '';
  save('nr_user', { name: d.name, phone: d.phone, prov: d.prov, city: d.city, zip: d.zip, unit: d.unit, addr: d.addr });
  try {
    const r = await api('/api/orders', { name: d.name, phone: d.phone, prov: d.prov, city: d.city, zip: d.zip, unit: d.unit, addr: d.addr, ship: d.ship, pay: d.pay, coupon: coupon?.code || '', terms: true, website: d.website || '', items: Object.entries(cart).map(([id, q]) => ({ id: +id, q })) });
    const list = load('nr_orders', []).filter(o => o.code !== r.code); list.unshift({ code: r.code, phone: d.phone, t: Date.now() }); save('nr_orders', list.slice(0, 20));
    cart = {}; coupon = null; commit();
    if (r.next?.type === 'online') { let ok = false; try { const x = new URL(r.next.url); ok = x.protocol === 'https:' || x.origin === new URL(API).origin; } catch { } if (!ok) throw new Error('آدرس درگاه نامعتبر است.'); location.assign(r.next.url); return; }
    go(u('/order/?code=' + encodeURIComponent(r.code)));
  } catch (err) { btn.disabled = false; btn.textContent = 'ثبت سفارش و ادامه'; $('#coerr').textContent = err.message; if (err.status === 409) refresh(); }
}

// ---------- سفارش‌ها ----------
const ST = { pending: ['در انتظار پرداخت', 'r'], awaiting_verify: ['در انتظار تأیید پرداخت', 'y'], paid: ['پرداخت شد', 'g'], processing: ['در حال آماده‌سازی', 'g'], shipped: ['ارسال شد', 'g'], delivered: ['تحویل شد', 'g'], cancelled: ['لغو شد', 'r'], failed: ['پرداخت ناموفق', 'r'], cod: ['ثبت شد (پرداخت در محل)', 'g'] };
const sp = s => String(s || '').replace(/(.{4})/g, '$1 ').trim();
function ordersView() {
  const list = load('nr_orders', []).filter(o => o && /^NR-[A-Z0-9]{8}$/.test(o.code));
  show({ title: `پیگیری سفارش | ${site.name}`, desc: 'پیگیری سفارش', html: `<h1 class="h1">پیگیری سفارش</h1><form id="tr" class="box narrow" novalidate><label for="t1">کد سفارش</label><input id="t1" name="code" dir="ltr" maxlength="11" placeholder="NR-XXXXXXXX" autocomplete="off"><label for="t2">شمارهٔ موبایل ثبت‌شده</label><input id="t2" name="phone" dir="ltr" inputmode="numeric" maxlength="11" placeholder="09123456789"><div class="err" id="te"></div><button class="btn" type="submit">پیگیری</button></form>
${list.length ? `<h2 class="sh">سفارش‌های این دستگاه</h2>${list.map(o => `<a class="box orow" href="${u('/order/?code=' + encodeURIComponent(o.code))}" data-link><b dir="ltr">${e(o.code)}</b><span class="meta">${new Date(o.t).toLocaleDateString('fa-IR')}</span></a>`).join('')}` : ''}` });
}
async function orderView(code) {
  code = code.toUpperCase(); const mine = load('nr_orders', []).find(o => o.code === code), tmp = sessionStorage.getItem('nr_phone');
  const head = { title: `وضعیت سفارش | ${site.name}`, desc: 'وضعیت سفارش' };
  if (!/^NR-[A-Z0-9]{8}$/.test(code)) return go(u('/orders/'));
  const phone = mine?.phone || tmp;
  if (!phone) return show({ ...head, html: `<h1 class="h1">وضعیت سفارش <span dir="ltr">${e(code)}</span></h1><form id="tr" class="box narrow" novalidate><input type="hidden" name="code" value="${e(code)}"><label for="t2">برای امنیت، شمارهٔ موبایل ثبت‌شده را وارد کنید</label><input id="t2" name="phone" dir="ltr" inputmode="numeric" maxlength="11" placeholder="09123456789"><div class="err" id="te"></div><button class="btn" type="submit">نمایش وضعیت</button></form>` });
  show({ ...head, html: `<div class="empty"><div class="spin"></div><p>در حال دریافت وضعیت...</p></div>` });
  try {
    const o = await api('/api/orders/track', { code, phone }), st = ST[o.status] || [o.status, 'g'], ok = new URLSearchParams(location.search).get('paid');
    const pay = o.pay ? `<div class="box payi"><h2>مشخصات پرداخت کارت‌به‌کارت / شبا</h2><p>مبلغ <b>${T(o.total)}</b> را به حساب زیر واریز کنید و در بخش توضیحات، کد سفارش را بنویسید.</p>
<dl><dt>نام صاحب حساب</dt><dd>${e(o.pay.owner)}</dd>${o.pay.card ? `<dt>شمارهٔ کارت</dt><dd dir="ltr" class="copy" data-copy="${e(o.pay.card)}">${e(sp(o.pay.card))}</dd>` : ''}${o.pay.iban ? `<dt>شمارهٔ شبا</dt><dd dir="ltr" class="copy" data-copy="${e(o.pay.iban)}">${e(o.pay.iban)}</dd>` : ''}</dl><p class="meta">با لمس شماره، کپی می‌شود.</p>
<form id="rc" class="two" novalidate data-code="${e(o.code)}" data-phone="${e(phone)}"><div><label for="r1">۴ رقم آخر کارت پرداخت‌کننده</label><input id="r1" name="last4" dir="ltr" inputmode="numeric" maxlength="4"></div><div><label for="r2">شمارهٔ پیگیری / مرجع تراکنش</label><input id="r2" name="ref" dir="ltr" maxlength="30"></div><div class="err" id="re"></div><button class="btn" type="submit">ثبت رسید پرداخت</button></form></div>` : '';
    const online = o.status === 'pending' && o.pay_method === 'online' ? `<button class="btn go" type="button" id="repay" data-code="${e(o.code)}" data-phone="${e(phone)}">پرداخت آنلاین</button>` : '';
    show({ ...head, html: `${steps(3)}<div class="box"><div class="row2"><h1 class="h2">سفارش <span dir="ltr">${e(o.code)}</span></h1><span class="status ${st[1]}">${e(st[0])}</span></div>${ok === '1' ? '<p class="ok">پرداخت شما با موفقیت تأیید شد. سپاسگزاریم!</p>' : ok === '0' ? '<p class="err">پرداخت انجام نشد. می‌توانید دوباره تلاش کنید.</p>' : ''}
<div class="meta">${new Date(o.created_at * 1000).toLocaleDateString('fa-IR')} — ${e(cfg.ship[o.ship]?.name || '')}</div><div class="meta">${e(o.addr)}</div>${o.tracking_code ? `<p>کد رهگیری پست: <b dir="ltr">${e(o.tracking_code)}</b></p>` : ''}
<div class="items">${o.items.map(i => `<div><span>${e(i.name)} × ${fa(i.qty)}</span><span>${T(i.price * i.qty)}</span></div>`).join('')}${o.discount ? `<div class="ok"><span>تخفیف</span><span>−${T(o.discount)}</span></div>` : ''}<div><span>ارسال</span><span>${o.ship_fee ? T(o.ship_fee) : 'رایگان'}</span></div><div class="tot"><span>جمع کل</span><span>${T(o.total)}</span></div></div>${online}</div>${pay}<a class="btn alt" href="${u('/shop/')}" data-link>ادامه خرید</a>` });
  } catch (err) { show({ ...head, html: `<div class="empty"><h1>سفارش پیدا نشد</h1><p>${e(err.message)}</p><a class="btn" href="${u('/orders/')}" data-link>پیگیری با کد و موبایل</a></div>` }); }
}

// ---------- رویدادها (واگذاری به document؛ بدون inline handler) ----------
document.addEventListener('click', ev => {
  const g = s => ev.target.closest(s); let b;
  const a = g('a[data-link]');
  if (a && !ev.defaultPrevented && ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !a.target) { ev.preventDefault(); return go(a.href); }
  const n = () => +$('#n')?.dataset.v || 1;
  if ((b = g('[data-add]'))) { ev.preventDefault(); add(+b.dataset.add, 1, b); }
  else if ((b = g('[data-addn]'))) add(+b.dataset.addn, n(), b);
  else if ((b = g('[data-buy]'))) { if (add(+b.dataset.buy, n())) go(u('/cart/')); }
  else if ((b = g('[data-d]'))) { const el = $('#n'), mx = prodOf(data, $('[data-addn]').dataset.addn).stock, v = Math.min(Math.max(mx, 1), Math.max(1, n() + +b.dataset.d)); el.dataset.v = v; el.textContent = fa(v); }
  else if ((b = g('[data-inc]'))) { add(+b.dataset.inc) && cartView(); }
  else if ((b = g('[data-dec]'))) { const i = b.dataset.dec; if (--cart[i] <= 0) delete cart[i]; commit(); cartView(); }
  else if ((b = g('[data-del]'))) { delete cart[b.dataset.del]; commit(); cartView(); }
  else if (g('#applycp')) applyCoupon();
  else if ((b = g('.copy'))) { navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('کپی شد')).catch(() => { }); }
  else if ((b = g('#repay'))) repay(b);
});
async function applyCoupon() {
  const c = $('#cp').value.trim().toUpperCase(), err = $('#cperr'); err.textContent = '';
  if (!c) { coupon = null; return cartView(); }
  try { const r = await api('/api/coupon', { code: c, subtotal: totals().sub }); coupon = { code: c, percent: r.percent }; cartView(); } catch (x) { coupon = null; err.textContent = x.message; }
}
async function repay(b) { b.disabled = true; try { const r = await api('/api/orders/pay', { code: b.dataset.code, phone: b.dataset.phone }); location.assign(r.url); } catch (x) { b.disabled = false; toast(x.message); } }
document.addEventListener('input', ev => { if (ev.target.id === 'q') { F.q = ev.target.value.slice(0, 60); paint(); } });
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'sort') { F.sort = t.value; paint(); }
  else if (t.name === 'ship') { shipSel = t.value; $('#sm').innerHTML = sumHTML(); }
  else if (t.name === 'prov') { $('#so').innerHTML = shipOpts(t.value); $('#sm').innerHTML = sumHTML(); }
});
document.addEventListener('submit', async ev => {
  const f = ev.target; if (!(f instanceof HTMLFormElement)) return;
  if (f.id === 'co') { ev.preventDefault(); place(f); }
  else if (f.id === 'hs') { ev.preventDefault(); const q = f.q.value.trim().slice(0, 60); go(u('/shop/') + (q ? '?q=' + encodeURIComponent(q) : '')); f.q.blur(); }
  else if (f.id === 'tr') { ev.preventDefault(); const code = f.code.value.trim().toUpperCase(), phone = en(f.phone.value).trim(), er = $('#te'); if (!/^NR-[A-Z0-9]{8}$/.test(code)) return er.textContent = 'کد سفارش را مثل NR-ABCD1234 بنویسید'; if (!/^09\d{9}$/.test(phone)) return er.textContent = 'شماره موبایل نامعتبر است'; sessionStorage.setItem('nr_phone', phone); go(u('/order/?code=' + code)); }
  else if (f.id === 'rc') { ev.preventDefault(); const l4 = en(f.last4.value).trim(), ref = en(f.ref.value).trim(), er = $('#re'); if (!/^\d{4}$/.test(l4) || ref.length < 4) return er.textContent = 'چهار رقم آخر کارت و شمارهٔ پیگیری را کامل وارد کنید'; try { await api('/api/orders/receipt', { code: f.dataset.code, phone: f.dataset.phone, last4: l4, ref }); toast('رسید ثبت شد؛ پس از بررسی تأیید می‌شود'); orderView(f.dataset.code); } catch (x) { er.textContent = x.message; } }
  else if (f.id === 'ct') { ev.preventDefault(); const er = $('#cte'); if (f.m.value.trim().length < 5) return er.textContent = 'پیام را کامل‌تر بنویسید'; try { await api('/api/contact', { name: f.n.value, contact: f.c.value, message: f.m.value, website: f.website.value }); f.reset(); er.textContent = ''; toast('پیام شما ارسال شد'); } catch (x) { er.textContent = x.message; } }
});
// عکسی که پیدا نشود حذف می‌شود و تصویر گرافیکی جایگزین دیده می‌شود (بدون inline handler)
document.addEventListener('error', ev => { const t = ev.target; if (t?.tagName === 'IMG' && t.hasAttribute('data-fb')) t.remove(); }, true);
addEventListener('popstate', () => route());

// ---------- ورود/ظاهر شدن تدریجی کارت‌ها ----------
const io = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('seen'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
function observe() { $$('.card:not(.seen),.cat:not(.seen),.trust>div:not(.seen)').forEach(el => (io ? (el.classList.add('rv'), io.observe(el)) : el.classList.add('seen'))); }

// ---------- بازنشانی داده‌های زنده از سرور (قیمت/موجودی معتبر) ----------
async function refresh() {
  if (!API) return;
  try {
    const r = await api('/api/catalog'); if (!Array.isArray(r.products) || !r.products.length) return;
    const changed = JSON.stringify(r.products) !== JSON.stringify(data.products) || JSON.stringify(r.config) !== JSON.stringify(cfg);
    data = { cats: r.cats || data.cats, products: r.products }; if (r.config) cfg = r.config; cart = sanitizeCart(cart); commit();
    const n = parse().name; if (changed && ['cart', 'checkout'].includes(n) === false && !document.activeElement?.closest?.('form')) route();
  } catch { /* با داده‌های build ادامه می‌دهیم */ }
}

// ---------- شروع ----------
const root = document.documentElement;
function endSplash() { if (!root.classList.contains('splash')) return; $('#splash')?.classList.add('leave'); root.classList.add('in'); try { sessionStorage.setItem('nrs', '1'); } catch { } setTimeout(() => root.classList.remove('splash'), reduce ? 0 : 500); }
if (root.classList.contains('splash')) { if (reduce) endSplash(); else { setTimeout(endSplash, 2600); addEventListener('pointerdown', endSplash, { once: true }); addEventListener('keydown', endSplash, { once: true }); } } else root.classList.add('in');
commit(); route(true); refresh();
