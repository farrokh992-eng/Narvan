// تولید هش رمز مدیر + رمزهای تصادفی. اجرا: npm run hash -- "رمز-دلخواه"
import crypto from 'node:crypto';
const pass = process.argv[2];
if (!pass || pass.length < 10) { console.error('یک رمز حداقل ۱۰ نویسه‌ای بدهید:  npm run hash -- "رمز-قوی-شما"'); process.exit(1); }
const salt = crypto.randomBytes(16), it = 100000; // سقف تکرار در Cloudflare Workers برابر ۱۰۰٬۰۰۰ است
const b64u = b => Buffer.from(b).toString('base64url');
const hash = crypto.pbkdf2Sync(pass, salt, it, 32, 'sha256');
console.log('\nADMIN_PASS_HASH=' + `pbkdf2$${it}$${b64u(salt)}$${b64u(hash)}`);
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('base64url'));
console.log('IP_SALT=' + crypto.randomBytes(16).toString('base64url'));
console.log('ADMIN_PATH=/panel-' + crypto.randomBytes(6).toString('hex'));
console.log('\nهر خط را با «wrangler secret put NAME --config api/wrangler.toml» ثبت کنید (مقدار را بعد از = وارد کنید). این خروجی را جایی عمومی نگذارید.\n');
