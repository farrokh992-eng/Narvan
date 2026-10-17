// API ناروَن — Cloudflare Worker + D1.
// اصل امنیتی: هر مبلغ، موجودی و تخفیف فقط از دیتابیس خوانده می‌شود؛ هیچ چیز از مرورگر باور نمی‌شود.
import { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } from './admin-ui.js';

const enc = new TextEncoder();
const STATUSES = ['pending', 'awaiting_verify', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed', 'cod'];
const ARTS = ['book', 'paper', 'pen', 'pencil', 'colors', 'marker', 'stapler', 'glue', 'case', 'bag'];
const PROV = 'تهران,البرز,اصفهان,خراسان رضوی,فارس,آذربایجان شرقی,آذربایجان غربی,خوزستان,مازندران,گیلان,کرمان,قم,یزد,هرمزگان,کرمانشاه,همدان,مرکزی,زنجان,قزوین,لرستان,اردبیل,گلستان,سیستان و بلوچستان,کردستان,بوشهر,سمنان,ایلام,چهارمحال و بختیاری,خراسان شمالی,خراسان جنوبی,کهگیلویه و بویراحمد'.split(',');
const DEFAULT_CFG = {
  freeShip: 600000,
  ship: { post: { name: 'پست پیشتاز', fee: 45000, days: [3, 5], note: 'سراسر کشور، با کد رهگیری' }, courier: { name: 'پیک موتوری', fee: 90000, days: [0, 1], note: 'فقط تهران', only: 'تهران' }, pickup: { name: 'تحویل حضوری', fee: 0, days: [0, 0], note: 'با هماهنگی قبلی' } },
  pay: { online: true, card: true, cod: true }
};

class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }
const fail = (s, m, x) => { throw new HttpError(s, m, x); };

// ---------- ابزارها ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const now = () => Math.floor(Date.now() / 1000);
const en = s => String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const rand = (n, alphabet) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => alphabet[x % alphabet.length]).join(''); };
const orderCode = () => 'NR-' + rand(8, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
function safeEq(a, b) { a = enc.encode(String(a)); b = enc.encode(String(b)); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a[i] || 0) ^ (b[i] || 0); return d === 0; }
async function hmac(secret, msg) { const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); return k; }
async function sign(secret, msg) { return b64u(await crypto.subtle.sign('HMAC', await hmac(secret), enc.encode(msg))); }
async function verifySig(secret, msg, sig) { try { return await crypto.subtle.verify('HMAC', await hmac(secret), unb64u(sig), enc.encode(msg)); } catch { return false; } }
async function sha(s) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 22); }
const ip = req => req.headers.get('CF-Connecting-IP') || '0.0.0.0';

const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
function respond(body, status, headers) { return new Response(body, { status, headers: { ...SEC, ...headers } }); }
const json = (data, status = 200, h = {}) => respond(JSON.stringify(data), status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...h });

function allowedOrigins(env) { return [env.SITE_URL, ...String(env.EXTRA_ORIGINS || '').split(',')].map(s => s.trim().replace(/\/$/, '')).filter(Boolean); }
function cors(req, env) {
  const o = req.headers.get('Origin'); if (!o) return {};
  if (!allowedOrigins(env).includes(o)) return null;
  return { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
}
async function body(req, max = 20000) {
  if (!(req.headers.get('Content-Type') || '').includes('application/json')) fail(415, 'درخواست نامعتبر است');
  const t = await req.text(); if (t.length > max) fail(413, 'حجم درخواست زیاد است');
  try { const j = JSON.parse(t); if (!j || typeof j !== 'object' || Array.isArray(j)) throw 0; return j; } catch { fail(400, 'درخواست نامعتبر است'); }
}
async function limit(env, key, max, windowSec) {
  const t = now();
  const r = await env.DB.prepare('INSERT INTO rate_limits (k, n, reset_at) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset_at <= ?3 THEN 1 ELSE n + 1 END, reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END RETURNING n').bind(key, t + windowSec, t).first();
  return r.n <= max;
}
const tooMany = () => fail(429, 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.');
const audit = (env, action, detail = '') => env.DB.prepare('INSERT INTO audit (actor, action, detail) VALUES (\'admin\', ?1, ?2)').bind(action, String(detail).slice(0, 300)).run();

// ---------- تنظیمات ----------
async function getCfg(env) {
  let saved = {}; try { const r = await env.DB.prepare('SELECT v FROM settings WHERE k = \'config\'').first(); if (r) saved = JSON.parse(r.v); } catch { /* پیش‌فرض */ }
  const cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
  if (Number.isInteger(saved.freeShip) && saved.freeShip >= 0) cfg.freeShip = saved.freeShip;
  for (const k of Object.keys(cfg.ship)) { const f = saved.ship?.[k]?.fee; if (Number.isInteger(f) && f >= 0 && f < 10000000) cfg.ship[k].fee = f; }
  for (const k of Object.keys(cfg.pay)) if (typeof saved.pay?.[k] === 'boolean') cfg.pay[k] = saved.pay[k];
  return cfg;
}
const onlineAvailable = env => (env.PAY_MODE === 'zarinpal' && !!env.ZARINPAL_MERCHANT) || (env.PAY_MODE === 'test' && env.ENV !== 'production');
const cardAvailable = env => !!(env.PAY_OWNER && (env.PAY_IBAN || env.PAY_CARD));
async function publicCfg(env) { const c = await getCfg(env); c.pay = { online: c.pay.online && onlineAvailable(env), card: c.pay.card && cardAvailable(env), cod: c.pay.cod }; return c; }

// ---------- محصولات ----------
const prodOut = r => ({ id: r.id, slug: r.slug, name: r.name, brand: r.brand, cat: r.cat_id, price: r.price, ...(r.old_price ? { old: r.old_price } : {}), stock: r.stock, desc: r.description, image: r.image, art: r.art, c: r.color, bg: r.bg, rating: r.rating, reviews: r.reviews });
async function catalog(env) {
  const [p, c] = await Promise.all([env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id').all(), env.DB.prepare('SELECT * FROM categories ORDER BY sort, id').all()]);
  return { products: p.results.map(prodOut), cats: c.results.map(x => ({ id: x.id, slug: x.slug, name: x.name, blurb: x.blurb })), config: await publicCfg(env) };
}
async function releaseStale(env) { // سفارش پرداخت‌نشدهٔ آنلاین/کارت بعد از ۴۸ ساعت لغو و موجودی آزاد می‌شود
  const old = await env.DB.prepare('SELECT id FROM orders WHERE status = \'pending\' AND pay_method <> \'cod\' AND created_at < ?1 LIMIT 20').bind(now() - 172800).all();
  for (const o of old.results) await setCancelled(env, o.id);
}
async function setCancelled(env, orderId) {
  const t = now(), items = (await env.DB.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?1').bind(orderId).all()).results;
  const o = await env.DB.prepare('SELECT status FROM orders WHERE id = ?1').bind(orderId).first();
  if (!o || ['cancelled', 'failed'].includes(o.status)) return; // موجودی فقط یک‌بار برمی‌گردد
  await env.DB.batch([env.DB.prepare('UPDATE orders SET status = \'cancelled\', updated_at = ?2 WHERE id = ?1').bind(orderId, t),
    ...items.map(i => env.DB.prepare('UPDATE products SET stock = stock + ?2 WHERE id = ?1').bind(i.product_id, i.qty))]);
}

// ---------- سفارش ----------
function validateOrder(b, cfg) {
  if (b.website) fail(400, 'درخواست نامعتبر است'); // honeypot برای ربات‌ها
  const o = { name: clean(b.name, 80), phone: en(clean(b.phone, 11)), prov: clean(b.prov, 40), city: clean(b.city, 60), zip: en(clean(b.zip, 10)), unit: clean(b.unit, 40), addr: clean(b.addr, 300), ship: String(b.ship), pay: String(b.pay), coupon: clean(b.coupon, 20).toUpperCase() };
  if (o.name.split(' ').length < 2 || o.name.length < 5) fail(400, 'نام و نام خانوادگی را کامل بنویسید');
  if (!/^09\d{9}$/.test(o.phone)) fail(400, 'شمارهٔ موبایل نامعتبر است');
  if (!PROV.includes(o.prov)) fail(400, 'استان نامعتبر است');
  if (o.city.length < 2) fail(400, 'شهر را وارد کنید');
  if (!/^\d{10}$/.test(o.zip)) fail(400, 'کد پستی باید ۱۰ رقم باشد');
  if (o.addr.length < 10) fail(400, 'نشانی را کامل‌تر بنویسید');
  if (!cfg.ship[o.ship]) fail(400, 'روش ارسال نامعتبر است');
  if (cfg.ship[o.ship].only && o.prov !== cfg.ship[o.ship].only) fail(400, 'این روش ارسال برای استان شما فعال نیست');
  if (!cfg.pay[o.pay]) fail(400, 'این روش پرداخت فعال نیست');
  if (b.terms !== true) fail(400, 'پذیرش قوانین لازم است');
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30) fail(400, 'سبد خرید نامعتبر است');
  const seen = new Set(); o.items = b.items.map(i => { const id = Number(i?.id), q = Number(i?.q); if (!Number.isInteger(id) || id < 1 || !Number.isInteger(q) || q < 1 || q > 99 || seen.has(id)) fail(400, 'سبد خرید نامعتبر است'); seen.add(id); return { id, q }; });
  return o;
}
async function findCoupon(env, code, subtotal) {
  if (!code) return null;
  const c = await env.DB.prepare('SELECT * FROM coupons WHERE code = ?1 AND active = 1').bind(code).first();
  if (!c || (c.expires_at && c.expires_at < now()) || (c.max_uses && c.used >= c.max_uses)) fail(400, 'این کد تخفیف معتبر نیست');
  if (subtotal < c.min_total) fail(400, `حداقل خرید برای این کد ${c.min_total.toLocaleString('fa-IR')} تومان است`);
  return c;
}
async function createOrder(env, req, cfg0) {
  const cfg = await publicCfg(env); const o = validateOrder(await body(req), cfg);
  const ids = o.items.map(i => i.id), rows = (await env.DB.prepare(`SELECT * FROM products WHERE active = 1 AND id IN (${ids.map((_, i) => '?' + (i + 1)).join(',')})`).bind(...ids).all()).results;
  const by = new Map(rows.map(r => [r.id, r])); const lines = o.items.map(i => { const p = by.get(i.id); if (!p) fail(409, 'یکی از کالاهای سبد دیگر موجود نیست'); if (p.stock < i.q) fail(409, `موجودی «${p.name}» کافی نیست`); return { p, q: i.q }; });
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.q, 0), cp = await findCoupon(env, o.coupon, subtotal);
  const discount = cp ? Math.round(subtotal * cp.percent / 100) : 0, base = subtotal - discount, sh = cfg.ship[o.ship];
  const shipFee = o.ship === 'post' && base >= cfg.freeShip ? 0 : sh.fee, total = base + shipFee;
  if (total < 1000 || total > 900000000) fail(400, 'مبلغ سفارش نامعتبر است');
  const code = orderCode(), t = now(), status = o.pay === 'cod' ? 'cod' : 'pending';
  const stmts = [env.DB.prepare('INSERT INTO orders (code, name, phone, province, city, zip, unit, address, ship_method, ship_fee, subtotal, discount, total, coupon, pay_method, status, created_at, updated_at, ip_hash) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?17,?18)')
    .bind(code, o.name, o.phone, o.prov, o.city, o.zip, o.unit, o.addr, o.ship, shipFee, subtotal, discount, total, cp ? cp.code : '', o.pay, status, t, await sha((env.IP_SALT || 'x') + ip(req)))];
  for (const l of lines) stmts.push(env.DB.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ((SELECT id FROM orders WHERE code = ?1), ?2, ?3, ?4, ?5)').bind(code, l.p.id, l.p.name, l.p.price, l.q));
  for (const l of lines) stmts.push(env.DB.prepare('UPDATE products SET stock = stock - ?2, updated_at = ?3 WHERE id = ?1').bind(l.p.id, l.q, t)); // CHECK(stock>=0) در صورت کمبود کل تراکنش را برمی‌گرداند
  if (cp) stmts.push(env.DB.prepare('UPDATE coupons SET used = used + 1 WHERE code = ?1').bind(cp.code));
  try { await env.DB.batch(stmts); } catch (e) { if (/CHECK|constraint/i.test(String(e.message))) fail(409, 'موجودی یکی از کالاها کافی نیست؛ سبد را بروزرسانی کنید.'); throw e; }
  const out = { code, total, next: { type: o.pay } };
  if (o.pay === 'online') { try { const r = await startOnline(env, { code, total, phone: o.phone }, req); out.next = { type: 'online', url: r.url }; } catch (e) { console.error('gateway', e.message); out.next = { type: 'pending', error: 'درگاه در دسترس نیست؛ از صفحهٔ سفارش دوباره تلاش کنید.' }; } }
  return out;
}
async function ownedOrder(env, b) {
  const code = clean(b.code, 11).toUpperCase(), phone = en(clean(b.phone, 11));
  if (!/^NR-[A-Z0-9]{8}$/.test(code) || !/^09\d{9}$/.test(phone)) fail(400, 'کد سفارش یا شمارهٔ موبایل نامعتبر است');
  const o = await env.DB.prepare('SELECT * FROM orders WHERE code = ?1').bind(code).first();
  if (!o || !safeEq(o.phone, phone)) fail(404, 'سفارشی با این مشخصات پیدا نشد');
  return o;
}
async function track(env, b) {
  const o = await ownedOrder(env, b), items = (await env.DB.prepare('SELECT name, price, qty FROM order_items WHERE order_id = ?1').bind(o.id).all()).results;
  const out = { code: o.code, status: o.status, pay_method: o.pay_method, ship: o.ship_method, ship_fee: o.ship_fee, subtotal: o.subtotal, discount: o.discount, total: o.total, created_at: o.created_at, addr: `${o.province}، ${o.city}، ${o.address}${o.unit ? '، ' + o.unit : ''}`, tracking_code: o.tracking_code, items };
  if (o.pay_method === 'card' && ['pending', 'awaiting_verify'].includes(o.status) && cardAvailable(env)) out.pay = { owner: env.PAY_OWNER, iban: env.PAY_IBAN || '', card: env.PAY_CARD || '' };
  return out;
}

// ---------- درگاه پرداخت ----------
const apiOrigin = req => new URL(req.url).origin;
const timeout = (ms = 10000) => AbortSignal.timeout(ms);
async function startOnline(env, o, req) {
  const mode = env.PAY_MODE; if (!onlineAvailable(env)) fail(503, 'پرداخت آنلاین فعال نیست');
  const order = await env.DB.prepare('SELECT id FROM orders WHERE code = ?1').bind(o.code).first();
  let authority, url;
  if (mode === 'test') { authority = 'T' + rand(24, '0123456789abcdef'); url = `${apiOrigin(req)}/pay/test/${authority}`; }
  else {
    const host = env.PAY_SANDBOX === 'yes' ? 'sandbox.zarinpal.com' : 'payment.zarinpal.com';
    const r = await fetch(`https://${host}/pg/v4/payment/request.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: timeout(),
      body: JSON.stringify({ merchant_id: env.ZARINPAL_MERCHANT, amount: o.total * 10, callback_url: `${apiOrigin(req)}/api/pay/callback`, description: `سفارش ${o.code}`, metadata: { mobile: o.phone, order_id: o.code } }) });
    const j = await r.json().catch(() => ({})); authority = j?.data?.authority;
    if (j?.data?.code !== 100 || !/^[A-Za-z0-9]{20,50}$/.test(authority || '')) throw new Error('zarinpal request failed ' + JSON.stringify(j?.errors || j?.data?.code));
    url = `https://${host}/pg/StartPay/${authority}`;
  }
  await env.DB.batch([env.DB.prepare('UPDATE payments SET status = \'failed\' WHERE order_id = ?1 AND status = \'init\'').bind(order.id),
    env.DB.prepare('INSERT INTO payments (order_id, provider, authority, amount, status) VALUES (?1, ?2, ?3, ?4, \'init\')').bind(order.id, mode, authority, o.total)]);
  return { url };
}
async function finalize(env, authority, ok, verifyFn) { // یک‌بار مصرف و idempotent
  const p = await env.DB.prepare('SELECT p.*, o.code, o.status AS ostatus FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.authority = ?1').bind(authority).first();
  if (!p) return null;
  if (p.status === 'paid') return { code: p.code, ok: true };
  if (p.status !== 'init') return { code: p.code, ok: false };
  let ref = '';
  if (ok) { const v = await verifyFn(p); ok = v.ok; ref = v.ref || ''; }
  const t = now();
  if (ok) await env.DB.batch([env.DB.prepare('UPDATE payments SET status = \'paid\', ref_id = ?2, verified_at = ?3 WHERE id = ?1 AND status = \'init\'').bind(p.id, ref, t),
    env.DB.prepare('UPDATE orders SET status = \'paid\', paid_at = ?2, updated_at = ?2 WHERE id = ?1 AND status IN (\'pending\', \'awaiting_verify\')').bind(p.order_id, t)]);
  else await env.DB.prepare('UPDATE payments SET status = \'failed\' WHERE id = ?1 AND status = \'init\'').bind(p.id).run();
  return { code: p.code, ok };
}
const back = (env, r) => respond(null, 302, { Location: `${env.SITE_URL}/order/?code=${encodeURIComponent(r?.code || '')}&paid=${r?.ok ? 1 : 0}`, 'Cache-Control': 'no-store' });
async function zpCallback(env, url) {
  const authority = url.searchParams.get('Authority') || '', st = url.searchParams.get('Status');
  if (!/^[A-Za-z0-9]{20,50}$/.test(authority)) return back(env, null);
  const host = env.PAY_SANDBOX === 'yes' ? 'sandbox.zarinpal.com' : 'payment.zarinpal.com';
  const r = await finalize(env, authority, st === 'OK', async p => { // مبلغ از دیتابیس می‌آید، نه از آدرس
    const x = await fetch(`https://${host}/pg/v4/payment/verify.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: timeout(), body: JSON.stringify({ merchant_id: env.ZARINPAL_MERCHANT, amount: p.amount * 10, authority }) });
    const j = await x.json().catch(() => ({})); return { ok: [100, 101].includes(j?.data?.code), ref: String(j?.data?.ref_id || '') };
  });
  return back(env, r);
}
const testPage = (amount, code, auth) => `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>درگاه آزمایشی</title><style>body{font-family:Tahoma,sans-serif;background:#f5f9f2;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;border:1px solid #d9e6d5;border-radius:16px;padding:24px;max-width:380px;width:92%;text-align:center}b{color:#1e6b45}p.w{background:#fff1cc;border-radius:10px;padding:8px;font-size:.85rem}form{display:flex;gap:8px;margin-top:16px}button{flex:1;padding:12px;border:0;border-radius:999px;font:inherit;cursor:pointer;color:#fff;background:#1e6b45}button.n{background:#b3362f}</style><main><h1>درگاه پرداخت آزمایشی</h1><p class="w">حالت تست: هیچ پولی برداشت نمی‌شود.</p><p>سفارش <b dir="ltr">${code}</b></p><p>مبلغ: <b>${amount.toLocaleString('fa-IR')} تومان</b></p><form method="post"><button name="r" value="ok">پرداخت موفق</button><button class="n" name="r" value="no">پرداخت ناموفق</button></form></main></html>`;

// ---------- ادمین ----------
async function pbkdf2(pass, salt, iter) { const k = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256)); }
async function checkPassword(env, pass) {
  const [alg, it, salt, hash] = String(env.ADMIN_PASS_HASH || '').split('$');
  if (alg !== 'pbkdf2' || !it || !salt || !hash) return false;
  const got = await pbkdf2(String(pass).slice(0, 200), unb64u(salt), Math.min(+it, 100000));
  return safeEq(b64u(got), hash);
}
const COOKIE = '__Host-nr_s';
async function mkSession(env) { const exp = now() + 8 * 3600, msg = `v1.${exp}.${rand(16, 'abcdef0123456789')}`; return `${msg}.${await sign(env.SESSION_SECRET, msg)}`; }
async function isAdmin(req, env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 24) return false;
  const m = (req.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '=')); if (!m) return false;
  const tok = m.slice(COOKIE.length + 1), parts = tok.split('.'); if (parts.length !== 4 || parts[0] !== 'v1') return false;
  return +parts[1] > now() && await verifySig(env.SESSION_SECRET, parts.slice(0, 3).join('.'), parts[3]);
}
const adminPath = env => { const p = env.ADMIN_PATH || '/admin'; return /^\/[\w\-]{3,60}$/.test(p) ? p : '/admin'; };
const adminHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const csv = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
const color = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : d);
function productInput(b, partial) {
  const p = {}; const need = (k, f) => { if (b[k] !== undefined || !partial) p[k] = f(b[k]); };
  need('name', v => { v = clean(v, 120); if (v.length < 2) fail(400, 'نام محصول کوتاه است'); return v; });
  need('brand', v => clean(v, 60)); need('description', v => clean(v, 800));
  need('cat_id', v => { v = +v; if (!Number.isInteger(v) || v < 1) fail(400, 'دسته‌بندی نامعتبر است'); return v; });
  need('price', v => { v = Number(v); if (!Number.isInteger(v) || v < 0 || v > 999999999) fail(400, 'قیمت نامعتبر است'); return v; });
  need('old_price', v => { if (v === null || v === '' || v === undefined || +v === 0) return null; v = Number(v); if (!Number.isInteger(v) || v < 1 || v > 999999999) fail(400, 'قیمت قبل نامعتبر است'); return v; });
  need('stock', v => { v = Number(v); if (!Number.isInteger(v) || v < 0 || v > 1000000) fail(400, 'موجودی نامعتبر است'); return v; });
  need('image', v => { v = clean(v, 300); if (v && !/^(images\/products\/[\w\-.]+\.(jpe?g|png|webp)|https:\/\/[^\s"'<>\\]+)$/.test(v)) fail(400, 'مسیر عکس نامعتبر است (images/products/نام.jpg یا آدرس https)'); return v; });
  need('art', v => (ARTS.includes(v) ? v : 'book')); need('color', v => color(v, '#3E9B5F')); need('bg', v => color(v, '#E4F1DE'));
  need('rating', v => { v = Number(v ?? 0); return v >= 0 && v <= 5 ? v : 0; }); need('reviews', v => { v = Number(v ?? 0); return Number.isInteger(v) && v >= 0 ? v : 0; });
  need('active', v => (v === 0 || v === false ? 0 : 1));
  if (b.slug !== undefined && b.slug !== '') { const s = String(b.slug).toLowerCase(); if (!/^[a-z0-9][a-z0-9\-]{1,78}$/.test(s)) fail(400, 'شناسهٔ لاتین (slug) فقط حروف انگلیسی کوچک، عدد و خط تیره'); p.slug = s; }
  return p;
}
async function admin(req, env, url, path) {
  if (path === '/api/admin/login' && req.method === 'POST') {
    if (!env.ADMIN_PASS_HASH || !env.SESSION_SECRET) fail(503, 'ورود مدیریت هنوز تنظیم نشده است');
    if (!(await limit(env, 'login:' + ip(req), 5, 900)) || !(await limit(env, 'login:all', 40, 3600))) tooMany();
    const b = await body(req, 2000); await new Promise(r => setTimeout(r, 400));
    if (!(await checkPassword(env, b.password || ''))) { await audit(env, 'login_failed', await sha(ip(req))); fail(401, 'رمز نادرست است'); }
    await audit(env, 'login_ok');
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=${await mkSession(env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
  }
  if (!(await isAdmin(req, env))) fail(401, 'نیاز به ورود');
  if (req.method !== 'GET') { if (req.headers.get('X-Admin-Req') !== '1' || req.headers.get('Origin') !== url.origin) fail(403, 'درخواست رد شد'); }
  const m = (re) => path.match(re), M = req.method;
  if (path === '/api/admin/logout' && M === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  if (path === '/api/admin/me') return json({ ok: true, flags: { online: onlineAvailable(env), card: cardAvailable(env), mode: env.PAY_MODE, env: env.ENV } });
  if (path === '/api/admin/stats') {
    const day = now() - 86400, q = s => env.DB.prepare(s).bind(day).first();
    const [a, b, c, d] = await Promise.all([q('SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE created_at >= ?1 AND status NOT IN (\'cancelled\',\'failed\')'), q('SELECT COUNT(*) n FROM orders WHERE status = \'awaiting_verify\' AND ?1 > 0'), q('SELECT COUNT(*) n FROM products WHERE active = 1 AND stock <= 5 AND ?1 > 0'), q('SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN (\'paid\',\'processing\',\'shipped\',\'delivered\') AND ?1 > 0')]);
    return json({ today_orders: a.n, today_sum: a.s, to_verify: b.n, low_stock: c.n, paid_total: d.s });
  }
  if (path === '/api/admin/orders' && M === 'GET') {
    const st = url.searchParams.get('status') || '', qq = clean(url.searchParams.get('q'), 40), w = [], a = [];
    if (STATUSES.includes(st)) { a.push(st); w.push('status = ?' + a.length); }
    if (qq) { a.push('%' + qq.replace(/[%_]/g, '') + '%'); w.push(`(code LIKE ?${a.length} OR phone LIKE ?${a.length} OR name LIKE ?${a.length})`); }
    const r = await env.DB.prepare(`SELECT code, name, phone, total, status, pay_method, created_at FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`).bind(...a).all();
    return json({ orders: r.results });
  }
  let x;
  if ((x = m(/^\/api\/admin\/orders\/(NR-[A-Z0-9]{8})$/))) {
    const o = await env.DB.prepare('SELECT * FROM orders WHERE code = ?1').bind(x[1]).first(); if (!o) fail(404, 'پیدا نشد');
    if (M === 'GET') { const [items, pays] = await Promise.all([env.DB.prepare('SELECT product_id, name, price, qty FROM order_items WHERE order_id = ?1').bind(o.id).all(), env.DB.prepare('SELECT provider, status, ref_id, card_last4, receipt_ref, amount, created_at FROM payments WHERE order_id = ?1 ORDER BY id DESC').bind(o.id).all()]); return json({ order: o, items: items.results, payments: pays.results }); }
    if (M === 'PATCH') {
      const b = await body(req, 2000); const t = now();
      if (b.tracking_code !== undefined) { const tc = clean(b.tracking_code, 40); await env.DB.prepare('UPDATE orders SET tracking_code = ?2, updated_at = ?3 WHERE id = ?1').bind(o.id, tc, t).run(); await audit(env, 'tracking', o.code); }
      if (b.status !== undefined) {
        if (!STATUSES.includes(b.status)) fail(400, 'وضعیت نامعتبر است');
        if (o.status === 'cancelled' && b.status !== 'cancelled') fail(409, 'سفارش لغوشده برنمی‌گردد؛ سفارش جدید ثبت کنید');
        if (b.status === 'cancelled') await setCancelled(env, o.id);
        else await env.DB.batch([env.DB.prepare('UPDATE orders SET status = ?2, updated_at = ?3, paid_at = CASE WHEN ?2 IN (\'paid\',\'processing\',\'shipped\',\'delivered\') AND paid_at IS NULL AND pay_method <> \'cod\' THEN ?3 ELSE paid_at END WHERE id = ?1').bind(o.id, b.status, t),
          env.DB.prepare('UPDATE payments SET status = \'paid\', verified_at = ?2 WHERE order_id = ?1 AND status = \'awaiting_verify\' AND ?3 IN (\'paid\',\'processing\',\'shipped\',\'delivered\')').bind(o.id, t, b.status)]);
        await audit(env, 'order_status', `${o.code}:${o.status}->${b.status}`);
      }
      return json({ ok: true });
    }
  }
  if (path === '/api/admin/export/orders.csv') {
    const r = (await env.DB.prepare('SELECT code, created_at, name, phone, province, city, zip, address, ship_method, ship_fee, subtotal, discount, total, pay_method, status, tracking_code FROM orders ORDER BY id DESC LIMIT 5000').all()).results;
    const head = Object.keys(r[0] || { code: 1 });
    return respond('\uFEFF' + [head.map(csv).join(',')].concat(r.map(o => head.map(k => csv(k === 'created_at' ? new Date(o[k] * 1000).toISOString() : o[k])).join(','))).join('\r\n'), 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="orders.csv"', 'Cache-Control': 'no-store' });
  }
  if (path === '/api/admin/products' && M === 'GET') { const [p, c] = await Promise.all([env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all(), env.DB.prepare('SELECT id, name FROM categories ORDER BY sort, id').all()]); return json({ products: p.results, cats: c.results }); }
  if (path === '/api/admin/products' && M === 'POST') {
    const p = productInput(await body(req, 8000), false); p.slug = p.slug || 'p-' + Date.now().toString(36);
    if (!(await env.DB.prepare('SELECT 1 FROM categories WHERE id = ?1').bind(p.cat_id).first())) fail(400, 'دسته‌بندی وجود ندارد');
    try { const r = await env.DB.prepare('INSERT INTO products (slug, name, brand, cat_id, price, old_price, stock, description, image, art, color, bg, rating, reviews, active) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)').bind(p.slug, p.name, p.brand, p.cat_id, p.price, p.old_price, p.stock, p.description, p.image, p.art, p.color, p.bg, p.rating, p.reviews, p.active).run(); await audit(env, 'product_add', p.name); return json({ ok: true, id: r.meta.last_row_id }); }
    catch (e) { if (/UNIQUE/i.test(e.message)) fail(409, 'این شناسهٔ لاتین (slug) تکراری است'); throw e; }
  }
  if ((x = m(/^\/api\/admin\/products\/(\d+)$/))) {
    const id = +x[1];
    if (M === 'PUT') { const p = productInput(await body(req, 8000), true), keys = Object.keys(p); if (!keys.length) fail(400, 'چیزی برای ذخیره نیست');
      try { const r = await env.DB.prepare(`UPDATE products SET ${keys.map((k, i) => k + ' = ?' + (i + 2)).join(', ')}, updated_at = ?${keys.length + 2} WHERE id = ?1`).bind(id, ...keys.map(k => p[k]), now()).run(); if (!r.meta.changes) fail(404, 'پیدا نشد'); await audit(env, 'product_edit', id); return json({ ok: true }); }
      catch (e) { if (e instanceof HttpError) throw e; if (/UNIQUE/i.test(e.message)) fail(409, 'این شناسهٔ لاتین تکراری است'); throw e; } }
    if (M === 'DELETE') { await env.DB.prepare('UPDATE products SET active = 0, updated_at = ?2 WHERE id = ?1').bind(id, now()).run(); await audit(env, 'product_archive', id); return json({ ok: true }); }
  }
  if (path === '/api/admin/coupons' && M === 'GET') return json({ coupons: (await env.DB.prepare('SELECT * FROM coupons ORDER BY code').all()).results });
  if (path === '/api/admin/coupons' && M === 'POST') {
    const b = await body(req, 1000), code = clean(b.code, 20).toUpperCase(), pc = Number(b.percent), mx = b.max_uses ? Number(b.max_uses) : null, mt = Number(b.min_total || 0), days = b.days ? Number(b.days) : null;
    if (!/^[A-Z0-9]{3,20}$/.test(code)) fail(400, 'کد فقط حروف انگلیسی بزرگ و عدد (۳ تا ۲۰ نویسه)'); if (!Number.isInteger(pc) || pc < 1 || pc > 90) fail(400, 'درصد بین ۱ تا ۹۰');
    if ((mx !== null && (!Number.isInteger(mx) || mx < 1)) || !Number.isInteger(mt) || mt < 0) fail(400, 'مقادیر نامعتبر است');
    await env.DB.prepare('INSERT INTO coupons (code, percent, min_total, max_uses, expires_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(code) DO UPDATE SET percent = ?2, min_total = ?3, max_uses = ?4, expires_at = ?5, active = 1').bind(code, pc, mt, mx, days ? now() + days * 86400 : null).run();
    await audit(env, 'coupon_set', code); return json({ ok: true });
  }
  if ((x = m(/^\/api\/admin\/coupons\/([A-Z0-9]{3,20})$/)) && M === 'DELETE') { await env.DB.prepare('UPDATE coupons SET active = 0 WHERE code = ?1').bind(x[1]).run(); await audit(env, 'coupon_off', x[1]); return json({ ok: true }); }
  if (path === '/api/admin/messages' && M === 'GET') return json({ messages: (await env.DB.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 200').all()).results });
  if ((x = m(/^\/api\/admin\/messages\/(\d+)(\/read)?$/))) { if (M === 'DELETE') await env.DB.prepare('DELETE FROM messages WHERE id = ?1').bind(+x[1]).run(); else if (M === 'POST' && x[2]) await env.DB.prepare('UPDATE messages SET is_read = 1 WHERE id = ?1').bind(+x[1]).run(); else fail(405, 'روش نامعتبر'); return json({ ok: true }); }
  if (path === '/api/admin/settings' && M === 'GET') return json({ config: await getCfg(env) });
  if (path === '/api/admin/settings' && M === 'PUT') {
    const b = await body(req, 3000), c = { freeShip: Number(b.freeShip), ship: {}, pay: {} };
    if (!Number.isInteger(c.freeShip) || c.freeShip < 0 || c.freeShip > 1e9) fail(400, 'سقف ارسال رایگان نامعتبر است');
    for (const k of Object.keys(DEFAULT_CFG.ship)) { const f = Number(b.ship?.[k]?.fee); if (!Number.isInteger(f) || f < 0 || f > 1e7) fail(400, 'هزینهٔ ارسال نامعتبر است'); c.ship[k] = { fee: f }; }
    for (const k of Object.keys(DEFAULT_CFG.pay)) c.pay[k] = b.pay?.[k] === true;
    if (!Object.values(c.pay).some(Boolean)) fail(400, 'حداقل یک روش پرداخت باید فعال باشد');
    await env.DB.prepare('INSERT INTO settings (k, v) VALUES (\'config\', ?1) ON CONFLICT(k) DO UPDATE SET v = ?1').bind(JSON.stringify(c)).run(); await audit(env, 'settings'); return json({ ok: true });
  }
  if (path === '/api/admin/audit') return json({ audit: (await env.DB.prepare('SELECT at, action, detail FROM audit ORDER BY id DESC LIMIT 60').all()).results });
  fail(404, 'پیدا نشد');
}

// ---------- مسیر اصلی ----------
async function handle(req, env) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/', M = req.method, ap = adminPath(env);
  // صفحهٔ مدیریت (مسیر مخفی)
  if (path === ap && M === 'GET') return respond(ADMIN_HTML(ap), 200, { 'Content-Type': 'text/html; charset=utf-8', ...adminHeaders, 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
  if (path === ap + '/app.js' && M === 'GET') return respond(ADMIN_JS, 200, { 'Content-Type': 'text/javascript; charset=utf-8', ...adminHeaders });
  if (path === ap + '/app.css' && M === 'GET') return respond(ADMIN_CSS, 200, { 'Content-Type': 'text/css; charset=utf-8', ...adminHeaders });
  if (path.startsWith('/api/admin/')) { try { return await admin(req, env, url, path); } catch (e) { return errOut(e, adminHeaders); } }
  // درگاه آزمایشی (فقط محیط توسعه)
  let x;
  if ((x = path.match(/^\/pay\/test\/(T[0-9a-f]{24})$/)) && env.PAY_MODE === 'test' && env.ENV !== 'production') {
    const p = await env.DB.prepare('SELECT p.amount, o.code FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.authority = ?1 AND p.status = \'init\'').bind(x[1]).first(); if (!p) return respond('پیدا نشد', 404, {});
    if (M === 'GET') return respond(testPage(p.amount, p.code, x[1]), 200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" });
    if (M === 'POST') { const f = await req.formData(); return back(env, await finalize(env, x[1], f.get('r') === 'ok', async () => ({ ok: true, ref: 'TEST' + rand(8, '0123456789') }))); }
  }
  if (path === '/api/pay/callback' && M === 'GET') { try { return await zpCallback(env, url); } catch (e) { console.error('callback', e.message); return back(env, null); } }
  if (!path.startsWith('/api/')) return json({ error: 'پیدا نشد' }, 404);
  // API عمومی
  const c = cors(req, env); if (c === null) return json({ error: 'دسترسی مجاز نیست' }, 403);
  if (M === 'OPTIONS') return respond(null, 204, c);
  try {
    let out;
    if (path === '/api/catalog' && M === 'GET') { if (await limit(env, 'stale', 1, 600)) await releaseStale(env); out = await catalog(env); return json(out, 200, { ...c, 'Cache-Control': 'public, max-age=20' }); }
    if (M !== 'POST') fail(405, 'روش نامعتبر');
    const who = ip(req);
    if (path === '/api/coupon') { if (!(await limit(env, 'cp:' + who, 20, 600))) tooMany(); const b = await body(req, 500), sub = Number(b.subtotal) || 0, cp = await findCoupon(env, clean(b.code, 20).toUpperCase(), sub); out = { percent: cp.percent }; }
    else if (path === '/api/orders') { if (!(await limit(env, 'ord:' + who, 8, 3600))) tooMany(); out = await createOrder(env, req); }
    else if (path === '/api/orders/track') { if (!(await limit(env, 'trk:' + who, 30, 600))) tooMany(); out = await track(env, await body(req, 500)); }
    else if (path === '/api/orders/receipt') {
      if (!(await limit(env, 'rc:' + who, 10, 3600))) tooMany(); const b = await body(req, 600), o = await ownedOrder(env, b), l4 = en(clean(b.last4, 4)), ref = en(clean(b.ref, 30));
      if (o.pay_method !== 'card' || !['pending', 'awaiting_verify'].includes(o.status)) fail(409, 'برای این سفارش ثبت رسید ممکن نیست');
      if (!/^\d{4}$/.test(l4) || ref.length < 4) fail(400, 'چهار رقم آخر کارت و شمارهٔ پیگیری را کامل وارد کنید');
      await env.DB.batch([env.DB.prepare('DELETE FROM payments WHERE order_id = ?1 AND provider = \'card\' AND status = \'awaiting_verify\'').bind(o.id), env.DB.prepare('INSERT INTO payments (order_id, provider, amount, status, card_last4, receipt_ref) VALUES (?1, \'card\', ?2, \'awaiting_verify\', ?3, ?4)').bind(o.id, o.total, l4, ref), env.DB.prepare('UPDATE orders SET status = \'awaiting_verify\', updated_at = ?2 WHERE id = ?1').bind(o.id, now())]);
      out = { ok: true };
    }
    else if (path === '/api/orders/pay') { if (!(await limit(env, 'pay:' + who, 10, 3600))) tooMany(); const o = await ownedOrder(env, await body(req, 500)); if (o.pay_method !== 'online' || o.status !== 'pending') fail(409, 'پرداخت این سفارش ممکن نیست'); out = await startOnline(env, { code: o.code, total: o.total, phone: o.phone }, req); }
    else if (path === '/api/contact') { if (!(await limit(env, 'ct:' + who, 5, 3600))) tooMany(); const b = await body(req, 3000); if (b.website) fail(400, 'درخواست نامعتبر است'); const m = clean(b.message, 1500); if (m.length < 5) fail(400, 'پیام را کامل‌تر بنویسید'); await env.DB.prepare('INSERT INTO messages (name, contact, body) VALUES (?1, ?2, ?3)').bind(clean(b.name, 80), clean(b.contact, 120), m).run(); out = { ok: true }; }
    else fail(404, 'پیدا نشد');
    return json(out, 200, c);
  } catch (e) { return errOut(e, c); }
}
function errOut(e, h = {}) { if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status, h); console.error('server error', e?.stack || e); return json({ error: 'خطای داخلی سرور؛ دوباره تلاش کنید.' }, 500, h); }

export default { fetch: (req, env, ctx) => handle(req, env).catch(e => errOut(e)) };
export { handle };
