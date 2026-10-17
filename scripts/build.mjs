// ساخت سایت استاتیک: صفحه‌های واقعی برای هر محصول/دسته (سئو)، فونت‌های خودمیزبان، sitemap، manifest و هدرهای امنیتی.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as R from '../site/src/render.js';
import { elmTree } from '../site/src/art.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = p => path.join(root, 'site', p), D = p => path.join(root, 'dist', p);
const site = JSON.parse(fs.readFileSync(S('data/site.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(S('data/catalog.json'), 'utf8'));

const origin = (process.env.SITE_ORIGIN || (site.domain ? 'https://' + site.domain : '')).replace(/\/$/, '');
const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
const apiBase = (process.env.API_BASE || site.apiBase || '').replace(/\/$/, '');
if (!origin) console.warn('⚠️  SITE_ORIGIN یا domain در site.json تنظیم نشده؛ canonical و sitemap موقتاً example.ir می‌شوند. پیش از انتشار تنظیم کنید.');
site.origin = origin || 'https://example.ir';
R.setBase(base);
const cfg = site.config;
// عکسی که هنوز در site/images/products نیست در نمایش حذف می‌شود تا درخواست ۴۰۴ نرود (تصویر گرافیکی جایگزین می‌شود)
const data = { cats: catalog.cats, products: catalog.products.map(p => ({ ...p, image: p.image && fs.existsSync(S(p.image)) ? p.image : '' })) };

fs.rmSync(D(''), { recursive: true, force: true });
const write = (rel, txt) => { const f = D(rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };
const copy = (from, to) => { fs.mkdirSync(path.dirname(D(to)), { recursive: true }); fs.copyFileSync(from, D(to)); };
const copyDir = (from, to) => { if (!fs.existsSync(from)) return; for (const f of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, f.name), b = path.posix.join(to, f.name); f.isDirectory() ? copyDir(a, b) : copy(a, b); } };
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 8);

// ---------- فونت‌ها (خودمیزبان؛ جلوگیری از وابستگی به Google Fonts که در ایران کند/مسدود است) ----------
function find(dir, re) { if (!fs.existsSync(dir)) return null; for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) { const r = find(p, re); if (r) return r; } else if (re.test(f.name)) return p; } return null; }
const nm = p => path.join(root, 'node_modules', p);
const fonts = { vazir: find(nm('vazirmatn'), /^Vazirmatn\[wght\]\.woff2$/), mzA: find(nm('@fontsource-variable/markazi-text/files'), /arabic-wght-normal\.woff2$/), mzL: find(nm('@fontsource-variable/markazi-text/files'), /latin-wght-normal\.woff2$/) };
if (fonts.vazir) copy(fonts.vazir, 'fonts/vazirmatn.woff2'); else console.warn('⚠️  فونت Vazirmatn پیدا نشد. «npm install» را اجرا کنید (بدون آن متن‌ها با فونت پیش‌فرض دستگاه نمایش داده می‌شوند).');
if (fonts.mzA) copy(fonts.mzA, 'fonts/markazi-arabic.woff2');
if (fonts.mzL) copy(fonts.mzL, 'fonts/markazi-latin.woff2');
const AR = 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';
const fontCss = `@font-face{font-family:Vazirmatn;src:${fonts.vazir ? `url(${base}/fonts/vazirmatn.woff2) format('woff2'),` : ''}local('Vazirmatn');font-weight:100 900;font-display:swap}
${fonts.mzA ? `@font-face{font-family:'Markazi Text';src:url(${base}/fonts/markazi-arabic.woff2) format('woff2');font-weight:400 700;font-display:swap;unicode-range:${AR}}` : ''}
${fonts.mzL ? `@font-face{font-family:'Markazi Text';src:url(${base}/fonts/markazi-latin.woff2) format('woff2');font-weight:400 700;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122}` : ''}\n`;

// ---------- دارایی‌ها ----------
for (const f of ['art.js', 'render.js', 'app.js']) copy(S('src/' + f), 'assets/' + f);
write('assets/style.css', fontCss + fs.readFileSync(S('src/style.css'), 'utf8'));
copyDir(S('public'), '');
copyDir(S('images'), D('images'));
const v = h => h + '?v=' + hash(D('assets/' + h));
// importهای ES-module هم باید نسخه‌دار باشند تا کش قدیمی خراب نکند
for (const f of ['app.js', 'render.js']) {
  let s = fs.readFileSync(D('assets/' + f), 'utf8');
  s = s.replace(/from '\.\/(art|render)\.js'/g, (_, n) => `from './${n}.js?v=${hash(D('assets/' + n + '.js'))}'`);
  fs.writeFileSync(D('assets/' + f), s);
}

// ---------- قالب صفحه ----------
const BOOT = "try{if(!sessionStorage.getItem('nrs')&&document.documentElement.dataset.home==='1')document.documentElement.classList.add('splash')}catch(e){}";
const bootHash = 'sha256-' + crypto.createHash('sha256').update(BOOT).digest('base64');
let apiOrigin = ''; try { apiOrigin = apiBase ? new URL(apiBase).origin : ''; } catch { console.warn('⚠️  API_BASE نامعتبر است'); }
const csp = `default-src 'self'; script-src 'self' '${bootHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' ${apiOrigin}; manifest-src 'self'; form-action 'self'; base-uri 'self'; object-src 'none'`.replace(/\s+;/g, ';');
const ch = R.chrome(data, site, cfg);
const seed = JSON.stringify({ ...data, site: { ...site, enamad: site.enamad }, api: apiBase, base, v: Date.now() }).replace(/</g, '\\u003c');
const esc = R.e;

function shell({ route, view, index = true, home = false }) {
  const url = site.origin + base + route;
  const og = view.og || '';
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl" data-home="${home ? 1 : 0}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}"><meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="#1E6B45"><meta name="color-scheme" content="light"><meta name="format-detection" content="telephone=no">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="${esc(site.name)}">
<title>${esc(view.title)}</title><meta name="description" content="${esc(view.desc)}">
<meta name="keywords" content="لوازم تحریر، لوازم التحریر، نوشت افزار، نوشت افزار و لوازم التحریر، لوازم التحریر و نوشت افزار، نوشت افزار و لوازم تحریر، نارون، ناروَن، خودکار، مداد، کتاب، دفتر، ماژیک، کیف مدرسه">
<meta name="robots" content="${index ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}"><link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:locale" content="fa_IR"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:title" content="${esc(view.title)}"><meta property="og:description" content="${esc(view.desc)}"><meta property="og:url" content="${esc(url)}">${og ? `<meta property="og:image" content="${esc(og)}">` : `<meta property="og:image" content="${esc(site.origin + base)}/icons/icon-512.png">`}<meta name="twitter:card" content="summary">
<link rel="manifest" href="${base}/manifest.webmanifest"><link rel="icon" type="image/svg+xml" href="${base}/icons/icon.svg"><link rel="icon" type="image/png" sizes="192x192" href="${base}/icons/icon-192.png"><link rel="apple-touch-icon" href="${base}/icons/apple-touch-icon.png">
${fonts.vazir ? `<link rel="preload" href="${base}/fonts/vazirmatn.woff2" as="font" type="font/woff2" crossorigin>` : ''}
<link rel="stylesheet" href="${base}/assets/${v('style.css')}">
${(view.ld || []).join('\n')}
<script>${BOOT}</script></head>
<body>
<div id="splash" aria-hidden="true">${elmTree({ leaves: 60, anim: true, seed: 5 })}<div class="sw">${esc(site.name)}</div></div>
<div class="strip" id="strip">${esc(ch.strip)}</div>
<header class="top"><div class="wrap bar" id="hd">${ch.header}</div></header>
<main id="app" class="wrap" data-route="${esc(route)}" tabindex="-1">${view.html}<noscript><p class="empty">برای خرید، جاوااسکریپت مرورگر را فعال کنید.</p></noscript></main>
<footer id="ft">${ch.footer}</footer>
<nav class="tabs" id="tabs" aria-label="منوی موبایل">${ch.tabs}</nav>
<div id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="seed">${seed}</script>
<script type="module" src="${base}/assets/${v('app.js')}"></script>
</body></html>`;
}

const out = [];
const add = (route, view, opts = {}) => { write(route.replace(/^\//, '') + 'index.html', shell({ route, view, ...opts })); if (opts.index !== false) out.push(route); };
add('/', R.homeView(data, site), { home: true });
add('/shop/', R.shopView(data, site, {}));
for (const c of data.cats) add(`/category/${c.slug}/`, R.shopView(data, site, { cat: c.slug }));
for (const p of data.products) add(`/product/${p.id}/`, R.productView(data, site, p.id, cfg));
for (const k of Object.keys(R.PAGES)) add(`/page/${k}/`, R.pageView(data, site, k, cfg));
const plain = t => ({ title: `${t} | ${site.name}`, desc: t, html: `<div class="empty" id="dyn">…</div>`, ld: [] });
for (const [r, t] of [['/cart/', 'سبد خرید'], ['/checkout/', 'ثبت سفارش'], ['/orders/', 'پیگیری سفارش'], ['/order/', 'وضعیت سفارش']]) add(r, plain(t), { index: false });
fs.writeFileSync(D('404.html'), shell({ route: '/404', view: { title: `صفحه پیدا نشد | ${site.name}`, desc: 'صفحه پیدا نشد', html: `<div class="empty"><h1>صفحه پیدا نشد</h1><a class="btn" href="${base}/" data-link>بازگشت به خانه</a></div>`, ld: [] }, index: false }));

// ---------- سئو و فایل‌های جانبی ----------
const day = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${out.map(r => `<url><loc>${esc(site.origin + base + r)}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /cart/\nDisallow: /checkout/\nDisallow: /orders/\nDisallow: /order/\n\nSitemap: ${site.origin}${base}/sitemap.xml\n`);
write('manifest.webmanifest', JSON.stringify({ name: `${site.name} | ${site.tagline}`, short_name: site.name, lang: 'fa', dir: 'rtl', start_url: base + '/', scope: base + '/', display: 'standalone', background_color: '#F5F9F2', theme_color: '#1E6B45', icons: [{ src: base + '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: base + '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: base + '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 1));
write('.nojekyll', '');
if (site.domain && !process.env.BASE_PATH) write('CNAME', site.domain);
// برای میزبان‌هایی که هدر سفارشی می‌پذیرند (Cloudflare Pages / Netlify). GitHub Pages این فایل را نادیده می‌گیرد.
write('_headers', `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  Strict-Transport-Security: max-age=31536000; includeSubDomains\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
console.log(`✓ ساخته شد: ${out.length} صفحهٔ قابل‌ایندکس → dist/ (origin=${site.origin}${base}, api=${apiBase || '—'})`);
