// سرور آزمایشی محلی: همان Worker روی SQLite درون‌حافظه (بدون نیاز به Cloudflare). اجرا: node --no-warnings scripts/dev-api.mjs
import http from 'node:http'; import fs from 'node:fs'; import crypto from 'node:crypto'; import { DatabaseSync } from 'node:sqlite';
import { handle } from '../api/src/index.js';
const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); db.exec(fs.readFileSync('api/schema.sql', 'utf8')); db.exec(fs.readFileSync('api/seed.sql', 'utf8'));
const mk = (sql, a = []) => ({ bind: (...x) => mk(sql, x), first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; }, _x: () => db.prepare(sql).run(...a) });
const DB = { prepare: s => mk(s), batch: async st => { db.exec('BEGIN'); try { const r = st.map(s => s._x()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
const pass = process.env.DEV_ADMIN_PASS || 'dev-password-123', salt = crypto.randomBytes(16);
const env = { DB, ENV: 'development', SITE_URL: process.env.SITE_URL || 'http://localhost:8099', PAY_MODE: 'test', ADMIN_PATH: '/admin', SESSION_SECRET: crypto.randomBytes(32).toString('hex'), IP_SALT: 'dev', PAY_OWNER: 'صاحب حساب آزمایشی', PAY_IBAN: 'IR000000000000000000000000',
  ADMIN_PASS_HASH: `pbkdf2$100000$${salt.toString('base64url')}$${crypto.pbkdf2Sync(pass, salt, 100000, 32, 'sha256').toString('base64url')}` };
const port = +process.env.API_PORT || 8787;
http.createServer(async (rq, rs) => { const chunks = []; for await (const c of rq) chunks.push(c); const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await handle(new Request('http://localhost:' + port + rq.url, { method: rq.method, headers: { ...rq.headers, 'cf-connecting-ip': '127.0.0.1' }, body: ['GET', 'HEAD'].includes(rq.method) ? undefined : body, redirect: 'manual' }), env);
  const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); const sc = r.headers.getSetCookie?.(); if (sc?.length) h['set-cookie'] = sc; rs.writeHead(r.status, h); rs.end(Buffer.from(await r.arrayBuffer())); }).listen(port, () => console.log(`API آزمایشی: http://localhost:${port}  (مدیریت: /admin ، رمز: ${pass})`));
