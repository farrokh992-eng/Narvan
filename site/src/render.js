// نمایش صفحه‌ها (رشتهٔ HTML) — هم در build برای سئو و هم در مرورگر استفاده می‌شود.
// قانون ایمنی: هر مقدار پویا فقط از مسیر e() یا num() وارد HTML می‌شود.
import { ART, MARK, elmTree } from './art.js';

export const CFG = { base: '' };
export const setBase = b => { CFG.base = (b || '').replace(/\/$/, ''); };
export const u = p => CFG.base + p;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const e = s => String(s ?? '').replace(/[&<>"'`]/g, c => ESC[c]);
export const num = n => (Number.isFinite(+n) ? +n : 0);
export const fa = n => num(n).toLocaleString('fa-IR');
export const T = n => fa(n) + ' تومان';
const col = c => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#4FA866');
export const imgSrc = s => (/^images\/[\w\-./]+$/.test(s || '') ? u('/' + s) : /^https:\/\/[^\s"'<>\\]+$/.test(s || '') ? s : '');
export const jsonLd = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

export const catOf = (d, id) => d.cats.find(c => c.id === id) || d.cats[0];
export const prodOf = (d, id) => d.products.find(p => p.id === +id);

export function pic(p, cls = '') {
  const src = imgSrc(p.image), art = ART[p.art] || ART.book;
  return `<div class="pic ${cls}" style="--bg:${col(p.bg)}"><svg viewBox="0 0 100 100" aria-hidden="true">${art(col(p.c))}</svg>${src ? `<img src="${e(src)}" alt="${e(p.name)}" width="600" height="600" loading="lazy" decoding="async" data-fb>` : ''}</div>`;
}

export const card = p => `<a class="card" href="${u('/product/' + num(p.id) + '/')}" data-link>${p.old ? `<span class="tag">${fa(Math.round((1 - p.price / p.old) * 100))}٪ تخفیف</span>` : ''}${pic(p)}
<div class="info"><h3>${e(p.name)}</h3><div class="meta">★ ${fa(p.rating)} (${fa(p.reviews)})</div>
<div class="price">${p.old ? `<s>${T(p.old)}</s>` : ''}<b>${T(p.price)}</b></div>
<button class="btn sm" type="button" data-add="${num(p.id)}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'ناموجود' : 'افزودن به سبد'}</button></div></a>`;

const crumbs = list => `<nav class="crumb" aria-label="مسیر صفحه">${list.map(([t, h]) => (h ? `<a href="${u(h)}" data-link>${e(t)}</a>` : `<span aria-current="page">${e(t)}</span>`)).join(' › ')}</nav>`;
const crumbLd = (site, list) => jsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map(([t, h], i) => ({ '@type': 'ListItem', position: i + 1, name: t, ...(h ? { item: site.origin + u(h) } : {}) })) });

// ---------- صفحه‌ها ----------
export function homeView(d, site) {
  const top = [...d.products].sort((a, b) => b.reviews - a.reviews).slice(0, 4), sale = d.products.filter(p => p.old);
  const leaves = [1, 2, 3, 4, 5, 6].map(i => `<i class="fall f${i}"></i>`).join('');
  return {
    title: `${site.name} (${site.nameAlt}) | ${site.tagline}`,
    desc: 'ناروَن (نارون)؛ فروشگاه آنلاین لوازم تحریر و نوشت‌افزار: دفتر، خودکار، مداد، کتاب، ماژیک، لوازم اداری و کیف مدرسه با قیمت شفاف و ارسال به سراسر کشور.',
    ld: [jsonLd({ '@context': 'https://schema.org', '@type': 'Store', name: site.name, alternateName: [site.nameAlt, 'Naroon'], url: site.origin + u('/'), description: 'فروشگاه آنلاین لوازم تحریر و نوشت‌افزار', telephone: site.phone, areaServed: 'IR' }),
      jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: site.origin + u('/'), inLanguage: 'fa-IR', potentialAction: { '@type': 'SearchAction', target: site.origin + u('/shop/?q={q}'), 'query-input': 'required name=q' } })],
    html: `<section class="hero"><div class="ht"><h1>نوشت‌افزار خوب، زیر سایهٔ یک درخت کهنسال</h1>
<p>دفتر، خودکار، مداد و لوازم اداری با قیمت شفاف و ارسال به سراسر کشور.</p>
<div class="hb"><a class="btn gold" href="${u('/shop/')}" data-link>دیدن محصولات</a><a class="btn ghost" href="${u('/category/notebooks/')}" data-link>دفتر و کاغذ</a></div></div>
<div class="hm">${leaves}${elmTree({ leaves: 64, seed: 21 })}</div></section>
<div class="trust"><div><b>ارسال به سراسر کشور</b>پست پیشتاز و پیک تهران</div><div><b>پرداخت امن</b>کارت‌به‌کارت، درگاه یا در محل</div><div><b>بازگشت کالا</b>تا ۷ روز پس از تحویل</div><div><b>پشتیبانی</b>${e(site.hours)}</div></div>
<h2 class="sh">دسته‌بندی‌ها</h2><div class="cats">${d.cats.map(c => `<a class="cat" href="${u('/category/' + e(c.slug) + '/')}" data-link>${e(c.name)}</a>`).join('')}</div>
<h2 class="sh">پرفروش‌ترین‌ها <a href="${u('/shop/')}" data-link>همهٔ محصولات</a></h2><div class="grid">${top.map(card).join('')}</div>
${sale.length ? `<h2 class="sh">پیشنهاد ویژه</h2><div class="grid">${sale.map(card).join('')}</div>` : ''}
<section class="seo"><h2>ناروَن؛ لوازم تحریر و نوشت‌افزار برای هر روز</h2>
<p>در ناروَن (نارون) می‌توانید لوازم تحریر و نوشت‌افزار موردنیاز مدرسه، دانشگاه و محل کار را یک‌جا پیدا کنید: دفتر و کتاب‌های یادداشت، خودکار، مداد، مدادرنگی، ماژیک، چسب، منگنه، جامدادی و کیف. قیمت‌ها شفاف است و سفارش‌ها با پست پیشتاز به سراسر کشور و با پیک موتوری در تهران ارسال می‌شود.</p></section>`
  };
}

export function shopView(d, site, { cat } = {}) {
  const c = cat ? d.cats.find(x => x.slug === cat) : null;
  const list = c ? d.products.filter(p => p.cat === c.id) : d.products;
  const trail = c ? [['خانه', '/'], ['فروشگاه', '/shop/'], [c.name]] : [['خانه', '/'], ['فروشگاه']];
  return {
    title: c ? `خرید ${c.name} | ${site.name}` : `فروشگاه لوازم تحریر و نوشت‌افزار | ${site.name}`,
    desc: c ? `${c.blurb} خرید آنلاین ${c.name} از ${site.name}.` : 'خرید آنلاین لوازم تحریر، نوشت‌افزار، دفتر، خودکار، مداد، کتاب و لوازم اداری با ارسال به سراسر کشور.',
    ld: [crumbLd(site, trail), jsonLd({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: site.origin + u('/product/' + p.id + '/'), name: p.name })) })],
    html: `${crumbs(trail)}<h1 class="h1">${c ? e(c.name) : 'فروشگاه'} <span class="meta" id="cnt">${fa(list.length)} کالا</span></h1>${c ? `<p class="lead">${e(c.blurb)}</p>` : ''}
<div class="shopl"><aside class="side"><div class="chips"><a class="chip ${c ? '' : 'on'}" href="${u('/shop/')}" data-link>همه</a>${d.cats.map(x => `<a class="chip ${c && c.id === x.id ? 'on' : ''}" href="${u('/category/' + e(x.slug) + '/')}" data-link>${e(x.name)}</a>`).join('')}</div></aside>
<section><div class="tools"><input id="q" type="search" placeholder="جست‌وجو در این فهرست" aria-label="جست‌وجو"><select id="sort" aria-label="مرتب‌سازی"><option value="pop">پربازدیدترین</option><option value="rate">بیشترین امتیاز</option><option value="lo">ارزان‌ترین</option><option value="hi">گران‌ترین</option></select></div>
<div class="grid" id="list" data-cat="${c ? c.id : 0}">${list.map(card).join('')}</div></section></div>`
  };
}

export function productView(d, site, id, cfg) {
  const p = prodOf(d, id); if (!p) return null;
  const c = catOf(d, p.cat), rel = d.products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  const trail = [['خانه', '/'], [c.name, '/category/' + c.slug + '/'], [p.name]];
  const img = imgSrc(p.image);
  return {
    title: `خرید ${p.name} | ${site.name}`,
    desc: `${p.name} — ${p.desc} قیمت ${T(p.price)}، ارسال به سراسر کشور از ${site.name}.`,
    og: img && /^https?:/.test(img) ? img : '',
    ld: [crumbLd(site, trail), jsonLd({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.desc, brand: { '@type': 'Brand', name: p.brand }, category: c.name, sku: String(p.id), ...(img ? { image: img.startsWith('http') ? img : site.origin + img } : {}),
      aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews }, offers: { '@type': 'Offer', priceCurrency: 'IRT', price: p.price, availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: site.origin + u('/product/' + p.id + '/') } })],
    html: `${crumbs(trail)}<div class="detail">${pic(p)}<div><div class="meta">برند: ${e(p.brand)}</div><h1>${e(p.name)}</h1><div class="meta">★ ${fa(p.rating)} · ${fa(p.reviews)} نظر</div>
<p class="desc">${e(p.desc)}</p><div class="price big">${p.old ? `<s>${T(p.old)}</s>` : ''}<b>${T(p.price)}</b></div>
<p class="${p.stock < 10 ? 'low' : 'ok'}">${p.stock < 1 ? 'ناموجود' : p.stock < 10 ? `فقط ${fa(p.stock)} عدد باقی مانده` : 'موجود در انبار'}</p>
<ul class="perks"><li>ارسال رایگان پست برای خرید بالای ${T(cfg.freeShip)}</li><li>۷ روز ضمانت بازگشت</li></ul></div></div>
<div class="buy"><div class="qty"><button type="button" data-d="-1" aria-label="کمتر">−</button><span id="n" data-v="1">۱</span><button type="button" data-d="1" aria-label="بیشتر">+</button></div>
<button class="btn" type="button" data-addn="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>افزودن به سبد</button><button class="btn go" type="button" data-buy="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>خرید سریع</button></div>
${rel.length ? `<h2 class="sh">محصولات مشابه</h2><div class="grid">${rel.map(card).join('')}</div>` : ''}`
  };
}

export const PAGES = {
  about: ['دربارهٔ ناروَن', () => `<p>ناروَن فروشگاه آنلاین لوازم تحریر و نوشت‌افزار است؛ با انتخاب دقیق کالا، قیمت شفاف و ارسال مطمئن، خرید روزمرهٔ دانش‌آموزان، دانشجویان و محیط‌های کاری را ساده می‌کند.</p><p>نام و نشان ما از نارون (Elm) گرفته شده؛ درختی کهنسال و پرسایه که سال‌ها کنار خیابان‌ها و حیاط‌ها ایستاده است. می‌خواهیم ناروَن هم برای نوشتن و یادگرفتن، سایه‌ای مطمئن باشد.</p>`],
  shipping: ['ارسال و هزینه‌ها', c => `<ul><li><b>${e(c.ship.post.name)}:</b> سراسر کشور، ${fa(c.ship.post.days[0])} تا ${fa(c.ship.post.days[1])} روز کاری، ${T(c.ship.post.fee)} (رایگان بالای ${T(c.freeShip)}).</li><li><b>${e(c.ship.courier.name)}:</b> فقط ${e(c.ship.courier.only)}، تحویل امروز یا فردا، ${T(c.ship.courier.fee)}.</li><li><b>${e(c.ship.pickup.name)}:</b> رایگان، با هماهنگی قبلی.</li></ul><p>سفارش‌های ثبت‌شده تا ساعت ۱۴ همان روز پردازش می‌شوند.</p>`],
  returns: ['شرایط بازگشت کالا', () => `<ul><li>تا ۷ روز پس از تحویل می‌توانید کالای استفاده‌نشده و دارای بستهٔ اصلی را بازگردانید.</li><li>در صورت معیوب بودن یا مغایرت کالا، هزینهٔ بازگشت بر عهدهٔ فروشگاه است.</li><li>مبلغ پس از بررسی کالا، ظرف ۳ تا ۵ روز کاری به حساب شما برمی‌گردد.</li></ul>`],
  faq: ['پرسش‌های متداول', () => `<p><b>چطور سفارشم را پیگیری کنم؟</b><br>از منوی «پیگیری سفارش» با کد سفارش و شمارهٔ موبایل.</p><p><b>روش‌های پرداخت چیست؟</b><br>کارت‌به‌کارت (با تأیید رسید)، پرداخت آنلاین و پرداخت در محل تحویل.</p><p><b>کد تخفیف دارم، کجا وارد کنم؟</b><br>در صفحهٔ سبد خرید.</p>`],
  contact: ['تماس با ما', (c, s) => `<p>تلفن: <b>${e(s.phone)}</b><br>ایمیل: <b dir="ltr">${e(s.email)}</b><br>نشانی: ${e(s.address)}<br>ساعت پاسخ‌گویی: ${e(s.hours)}</p>
<form id="ct" novalidate><label for="c1">نام</label><input id="c1" name="n" maxlength="80" autocomplete="name"><label for="c3">تلفن یا ایمیل</label><input id="c3" name="c" maxlength="120" dir="ltr"><label for="c2">پیام شما</label><textarea id="c2" name="m" rows="4" maxlength="1500"></textarea>
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><div class="err" id="cte"></div><button class="btn" type="submit">ارسال پیام</button></form>`]
};

export function pageView(d, site, key, cfg) {
  const p = PAGES[key]; if (!p) return null;
  const trail = [['خانه', '/'], [p[0]]];
  return { title: `${p[0]} | ${site.name}`, desc: `${p[0]} — ${site.name}، فروشگاه آنلاین لوازم تحریر و نوشت‌افزار.`, ld: [crumbLd(site, trail)], html: `${crumbs(trail)}<div class="pg"><h1>${e(p[0])}</h1>${p[1](cfg, site)}</div>` };
}

// ---------- چارچوب مشترک ----------
export function chrome(d, site, cfg) {
  const I = { h: '<path d="M4 11l8-7 8 7v9H4z"/>', s: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>', c: '<path d="M5 8h14l-1 12H6zM9 8a3 3 0 016 0"/>', o: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>' };
  const tab = (p, t, href, k, extra = '') => `<a href="${u(href)}" data-link data-t="${k}"><i>${`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`}${extra}</i>${t}</a>`;
  const en = site.enamad && /^https:\/\//.test(site.enamad.href || '') && /^https:\/\//.test(site.enamad.img || '') ? `<a class="enamad" href="${e(site.enamad.href)}" target="_blank" rel="noopener noreferrer"><img src="${e(site.enamad.img)}" alt="نماد اعتماد الکترونیکی" width="80" height="80" loading="lazy"></a>` : '';
  return {
    strip: `ارسال رایگان پست برای خرید بالای ${T(cfg.freeShip)}`,
    header: `<a class="logo" href="${u('/')}" data-link aria-label="${e(site.name)}، صفحهٔ اصلی">${MARK(42)}<span><b>${e(site.name)}</b><small>${e(site.tagline)}</small></span></a>
<form id="hs" class="hsearch" role="search" action="${u('/shop/')}" method="get"><input type="search" name="q" maxlength="60" aria-label="جست‌وجو" placeholder="جست‌وجو"></form>
<nav class="dnav" aria-label="منوی اصلی"><a href="${u('/')}" data-link data-t="">خانه</a><a href="${u('/shop/')}" data-link data-t="shop">فروشگاه</a><a href="${u('/orders/')}" data-link data-t="orders">پیگیری سفارش</a><a href="${u('/page/about/')}" data-link data-t="page">دربارهٔ ما</a></nav>
<a class="cartbtn" href="${u('/cart/')}" data-link aria-label="سبد خرید"><span class="lbl">سبد خرید</span><b class="bd">۰</b></a>`,
    tabs: tab(I.h, 'خانه', '/', '') + tab(I.s, 'فروشگاه', '/shop/', 'shop') + tab(I.c, 'سبد خرید', '/cart/', 'cart', '<b class="bd">۰</b>') + tab(I.o, 'سفارش‌ها', '/orders/', 'orders'),
    footer: `<div class="wrap"><div class="fg"><div><div class="fb">${MARK(40)}<h4>${e(site.name)}</h4></div><p>فروشگاه آنلاین لوازم تحریر و نوشت‌افزار؛ کیفیت، قیمت شفاف و ارسال مطمئن.</p>${en}</div>
<div><h4>راهنمای خرید</h4><a href="${u('/page/shipping/')}" data-link>ارسال و هزینه‌ها</a><a href="${u('/page/returns/')}" data-link>شرایط بازگشت کالا</a><a href="${u('/page/faq/')}" data-link>پرسش‌های متداول</a><a href="${u('/orders/')}" data-link>پیگیری سفارش</a></div>
<div><h4>ارتباط با ما</h4><a href="${u('/page/about/')}" data-link>دربارهٔ ما</a><a href="${u('/page/contact/')}" data-link>تماس با ما</a><span>${e(site.phone)}</span></div></div>
<div class="cp">© ${e(site.name)} — همهٔ حقوق محفوظ است.</div></div>`
  };
}
