// تولید api/seed.sql از site/data/catalog.json. اجرا: npm run seed
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'site/data/catalog.json'), 'utf8'));
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
let o = '-- تولیدشده توسط scripts/gen-seed.mjs — دستی ویرایش نکنید\n';
for (const [i, k] of c.cats.entries()) o += `INSERT OR IGNORE INTO categories (id, slug, name, blurb, sort) VALUES (${k.id}, ${q(k.slug)}, ${q(k.name)}, ${q(k.blurb)}, ${i});\n`;
for (const p of c.products) o += `INSERT OR IGNORE INTO products (id, slug, name, brand, cat_id, price, old_price, stock, description, image, art, color, bg, rating, reviews) VALUES (${p.id}, ${q(p.slug)}, ${q(p.name)}, ${q(p.brand)}, ${p.cat}, ${p.price}, ${p.old || 'NULL'}, ${p.stock}, ${q(p.desc)}, ${q(fs.existsSync(path.join(root, 'site', p.image)) ? p.image : '')}, ${q(p.art)}, ${q(p.c)}, ${q(p.bg)}, ${p.rating}, ${p.reviews});\n`;
o += "INSERT OR IGNORE INTO coupons (code, percent) VALUES ('WELCOME10', 10);\n";
fs.writeFileSync(path.join(root, 'api/seed.sql'), o); console.log('api/seed.sql ساخته شد');
