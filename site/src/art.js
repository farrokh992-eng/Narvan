// تصویرسازی: درخت نارون (Elm) و تصاویر جایگزین محصولات — بدون وابستگی، قابل اجرا در Node و مرورگر
const LEAF = 'M0 0C5-3 9-11 4-19 2.5-22 0-22.5-2-20-6-14-5-5 0 0Z';
const GREENS = ['#1E6B45', '#2F8A55', '#4FA866', '#7FC17B', '#A9D58B'];

// تولید عدد شبه‌تصادفی قطعی (تا خروجی build و مرورگر یکسان باشد)
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/**
 * درخت نارون: تنهٔ کوتاه که به سه شاخهٔ اصلی «گلدانی» تقسیم می‌شود و تاج پهن با برگ‌های دندانه‌دار نامتقارن.
 * opts.leaves تعداد برگ، opts.anim کلاس‌های انیمیشن رشد را اضافه می‌کند.
 */
export function elmTree({ leaves = 70, anim = false, seed = 7, trunk = '#5B4632' } = {}) {
  const r = rng(seed);
  let out = '';
  const limbs = [
    'M100 192C100 170 99 150 100 128',
    'M100 132C94 112 78 100 58 84', 'M100 132C106 112 122 100 142 84', 'M100 128C99 108 100 88 100 62',
    'M82 106C70 100 62 92 50 90', 'M118 106C130 100 138 92 150 90'
  ];
  limbs.forEach((d, i) => { out += `<path class="${anim ? 'tk' : ''}" ${anim ? `style="--i:${i}"` : ''} d="${d}" fill="none" stroke="${trunk}" stroke-width="${i === 0 ? 7 : i < 4 ? 4 : 2.4}" stroke-linecap="round"/>`; });
  let lv = '';
  for (let i = 0; i < leaves; i++) {
    // تاج وارونهٔ گلدانی: نقاط درون یک بیضی که بالا پهن‌تر است
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    let x = 100 + Math.cos(a) * d * 84, y = 66 + Math.sin(a) * d * 50 - (Math.sin(a) < 0 ? 0 : d * 6);
    if (y > 118) y = 118 - r() * 10;
    const rot = Math.round((Math.atan2(y - 120, x - 100) * 180) / Math.PI + 90 + (r() - .5) * 60);
    const s = (0.55 + r() * 0.5).toFixed(2), c = GREENS[Math.floor(r() * GREENS.length)];
    lv += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${s})"><path class="${anim ? 'lf' : ''}" ${anim ? `style="--d:${(0.7 + i * 0.018).toFixed(2)}s"` : ''} d="${LEAF}" fill="${c}"/></g>`;
  }
  return `<svg viewBox="0 0 200 200" class="elm" aria-hidden="true" focusable="false">${out}${lv}</svg>`;
}

// نشان کوچک (لوگو): نسخهٔ سبک درخت با چند برگ
export const MARK = (s = 40) => `<svg width="${s}" height="${s}" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><rect width="200" height="200" rx="44" fill="#E4F1DE"/>${elmTree({ leaves: 26, seed: 11 }).replace(/^<svg[^>]*>/, '<g transform="translate(14 14) scale(.86)">').replace(/<\/svg>$/, '</g>')}</svg>`;

// تصاویر جایگزین محصولات (تا زمانی که عکس واقعی گذاشته نشده)
export const ART = {
  book: c => `<rect x="26" y="14" width="52" height="72" rx="5" fill="${c}"/><rect x="26" y="14" width="9" height="72" rx="3" fill="#0003"/><rect x="42" y="28" width="28" height="22" rx="2" fill="#fff9"/><path d="M42 60h28M42 68h20" stroke="#fff8" stroke-width="2"/>`,
  paper: c => `<rect x="30" y="22" width="48" height="62" rx="3" fill="#0002"/><rect x="25" y="17" width="48" height="62" rx="3" fill="${c}"/><rect x="21" y="13" width="48" height="62" rx="3" fill="#fff"/><path d="M30 28h30M30 36h30M30 44h20" stroke="${c}" stroke-width="2.5"/>`,
  pen: c => `<g transform="rotate(35 50 50)"><rect x="43" y="10" width="14" height="62" rx="5" fill="${c}"/><rect x="43" y="24" width="14" height="8" fill="#fff6"/><path d="M43 72h14l-7 18z" fill="#333"/></g>`,
  pencil: c => `<g transform="rotate(35 50 50)"><rect x="42" y="8" width="16" height="12" rx="3" fill="#F28B9B"/><rect x="42" y="20" width="16" height="6" fill="#bbb"/><rect x="42" y="26" width="16" height="44" fill="${c}"/><path d="M42 70h16l-8 18z" fill="#F3D9B1"/><path d="M47 80h6l-3 8z" fill="#333"/></g>`,
  colors: () => `<g transform="translate(50 52)">${['#E5484D', '#F5A623', '#1FA971', '#2F54EB', '#7C5CFF'].map((k, i) => `<g transform="rotate(${-36 + i * 18})"><rect x="-4.5" y="-40" width="9" height="62" rx="2" fill="${k}"/><path d="M-4.5 22h9l-4.5 12z" fill="#F3D9B1"/></g>`).join('')}</g>`,
  marker: c => `<g transform="rotate(30 50 50)"><rect x="40" y="12" width="20" height="50" rx="6" fill="#fff" stroke="#0002"/><rect x="40" y="38" width="20" height="14" fill="${c}"/><path d="M42 62h16l-3 16H45z" fill="${c}"/></g>`,
  stapler: c => `<path d="M16 62h68v12H16z" fill="#333"/><path d="M18 62c0-18 30-22 64-12v12z" fill="${c}"/><rect x="62" y="52" width="14" height="4" fill="#fff6"/>`,
  glue: c => `<rect x="34" y="20" width="32" height="64" rx="7" fill="#fff" stroke="#0002"/><rect x="34" y="16" width="32" height="18" rx="6" fill="${c}"/><rect x="34" y="44" width="32" height="24" fill="${c}"/><circle cx="50" cy="56" r="6" fill="#fff9"/>`,
  case: c => `<rect x="12" y="34" width="76" height="34" rx="14" fill="${c}"/><path d="M20 46h60" stroke="#fff9" stroke-width="3" stroke-dasharray="4 3"/><rect x="44" y="40" width="10" height="12" rx="3" fill="#fff"/>`,
  bag: c => `<path d="M36 26c0-12 28-12 28 0" fill="none" stroke="#333" stroke-width="5"/><rect x="24" y="24" width="52" height="62" rx="16" fill="${c}"/><rect x="34" y="52" width="32" height="24" rx="8" fill="#0003"/><path d="M34 40h32" stroke="#fff8" stroke-width="3"/>`
};
