// بررسی نشت اطلاعات حساس در خروجی سایت (dist) و مخزن. در GitHub Actions پیش از انتشار اجرا می‌شود.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rules = [
  [/\bIR(?!0{24})\d{24}\b/, 'شمارهٔ شبا'], [/\b\d{16}\b/, 'عدد ۱۶ رقمی (شبیه شمارهٔ کارت)'], [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'شبیه merchant_id'],
  [/pbkdf2\$\d+\$/, 'هش رمز مدیر'], [/SESSION_SECRET\s*=\s*\S{8,}/, 'SESSION_SECRET'], [/ZARINPAL_MERCHANT\s*=\s*\S{8,}/, 'ZARINPAL_MERCHANT'], [/ADMIN_PATH\s*=\s*\/\S+/, 'ADMIN_PATH']
];
const skip = new Set(['node_modules', '.git', 'dist', '.wrangler']);
let bad = 0;
function walk(d, scanFonts) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (skip.has(f.name) && !scanFonts) continue; if (f.isDirectory()) { walk(p, scanFonts); continue; } if (!/\.(html|js|mjs|css|json|toml|md|txt|xml|sql|yml|webmanifest)$/.test(f.name) || /^(check|hash-password)\.mjs$|\.example$|\.test\.mjs$|dev-(server|api)\.mjs$/.test(f.name)) continue; const t = fs.readFileSync(p, 'utf8'); for (const [re, name] of rules) { if (re.test(t) && !(name.includes('۱۶') && /\.(json|svg)$/.test(f.name) && /sitemap|manifest/.test(f.name))) { console.error(`✗ ${name} در ${path.relative(root, p)}`); bad++; } } } }
walk(root, false); if (fs.existsSync(path.join(root, 'dist'))) walk(path.join(root, 'dist'), true);
for (const f of ['.dev.vars', 'api/.dev.vars', '.env']) if (fs.existsSync(path.join(root, f))) console.warn(`⚠️  ${f} وجود دارد؛ مطمئن شوید در .gitignore است و commit نمی‌شود.`);
if (bad) { console.error(`\n${bad} مورد حساس پیدا شد — انتشار متوقف شد.`); process.exit(1); }
console.log('✓ هیچ اطلاعات حساسی در پروژه/خروجی پیدا نشد.');
