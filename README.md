# ناروَن — فروشگاه آنلاین لوازم تحریر

نارون (Elm) درختی کهنسال و پرسایه است؛ نشان و رنگ سایت سبز نارون است.

## ساختار (چرا دو بخش؟)
GitHub Pages فقط فایل استاتیک نمایش می‌دهد و **نمی‌تواند دیتابیس، رمز مدیر یا درگاه پرداخت امن نگه دارد**. پس:

| بخش | کجا | چه کاری می‌کند |
|---|---|---|
| `site/` + `scripts/build.mjs` | **GitHub Pages** | ویترین سریع، صفحهٔ واقعی برای هر محصول/دسته (سئو)، سبد، ثبت سفارش |
| `api/` | **Cloudflare Workers + D1** (رایگان) | دیتابیس، قیمت و موجودی معتبر، سفارش، پرداخت، پنل مدیریت |

قیمت، موجودی، تخفیف و جمع سفارش **فقط سمت سرور** محاسبه می‌شود؛ مرورگر نمی‌تواند آن‌ها را دست‌کاری کند.

## اجرای محلی (آزمایشی)
```bash
npm install
npm run seed
node --no-warnings scripts/dev-api.mjs      # API آزمایشی روی :8787 (مدیریت: /admin ، رمز: dev-password-123)
API_BASE=http://localhost:8787 npm run build
PORT=8099 npm run preview                   # سایت روی :8099
node --no-warnings test/api.test.mjs        # ۴۷ تست امنیتی/سفارش/پرداخت
```

## انتشار — گام‌به‌گام
### ۱) بک‌اند (Cloudflare)
```bash
npm install
npx wrangler login
npx wrangler d1 create naroon                      # database_id را در api/wrangler.toml بگذارید
npx wrangler d1 execute naroon --remote --file=api/schema.sql
npm run seed && npx wrangler d1 execute naroon --remote --file=api/seed.sql
npm run hash -- "یک-رمز-قوی-حداقل-۱۰-نویسه"        # چهار مقدار چاپ می‌کند
```
هر مقدار چاپ‌شده را به‌عنوان secret ثبت کنید (مقدار را وقتی پرسید بچسبانید؛ **هرگز در فایل یا چت ننویسید**):
```bash
npx wrangler secret put ADMIN_PASS_HASH --config api/wrangler.toml
npx wrangler secret put SESSION_SECRET  --config api/wrangler.toml
npx wrangler secret put IP_SALT         --config api/wrangler.toml
npx wrangler secret put ADMIN_PATH      --config api/wrangler.toml   # مثلاً /panel-3fa91c2b7d10  ← آدرس مخفی پنل
npx wrangler secret put PAY_OWNER       --config api/wrangler.toml   # نام صاحب حساب (نمایش به مشتری)
npx wrangler secret put PAY_IBAN        --config api/wrangler.toml   # شمارهٔ شبا
npx wrangler secret put PAY_CARD        --config api/wrangler.toml   # (اختیاری) شمارهٔ کارت برای کارت‌به‌کارت
```
در `api/wrangler.toml` مقدار `SITE_URL` را آدرس سایت بگذارید، سپس `npm run api:deploy`.
پنل مدیریت: `https://<آدرس-worker>/<ADMIN_PATH>`.

### ۲) سایت (GitHub Pages)
1. پروژه را در یک مخزن GitHub بگذارید (`.gitignore` فایل‌های حساس را کنار می‌گذارد).
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables**: `SITE_ORIGIN` (مثل `https://your-domain.ir`) و `API_BASE` (آدرس Worker).
4. در `site/data/site.json` تلفن، ایمیل، نشانی و ساعت کاری واقعی را بنویسید و push کنید. گردش‌کار تست‌ها، ساخت و «اسکن نشت اطلاعات» را اجرا می‌کند.

### ۳) دامنه
در Pages → Custom domain دامنه را بدهید و DNS را طبق راهنمای GitHub تنظیم کنید. برای API می‌توانید در Cloudflare یک Custom Domain مثل `api.your-domain.ir` بدهید (بعد `API_BASE` و `SITE_URL`/`EXTRA_ORIGINS` را هماهنگ کنید).

## پرداخت
**کارت‌به‌کارت (همین حالا کار می‌کند):** مشتری سفارش می‌دهد → مشخصات حساب (فقط به خود او با کد سفارش + موبایل) نمایش داده می‌شود → ۴ رقم آخر کارت و شمارهٔ پیگیری را ثبت می‌کند → سفارش «نیازمند تأیید» می‌شود → شما رسید را در پنل بررسی و «پرداخت‌شده» می‌زنید. شبا و کارت **در کد و مخزن نیست**، فقط در secret سرور.

**درگاه آنلاین:** مبلغ/تأیید تراکنش سمت سرور انجام می‌شود (callback → verify با مبلغ دیتابیس، یک‌بارمصرف).
- درگاهی که پول را به شبای شما تسویه کند مثل **زرین‌پال** نیاز به اینماد و کد مالیاتی دارد. پس از دریافت: `ZARINPAL_MERCHANT` را secret کنید و `PAY_MODE = "zarinpal"` بگذارید. برای تست `PAY_SANDBOX="yes"`.
- **بله:** «پرداخت با بله» مبتنی بر API ربات و قرارداد پذیرندگی (provider_token) است و مشتری باید کاربر بله باشد؛ مستقیماً «اتصال به شبا» نیست. اگر قرارداد دارید، آدرس مستندات را بدهید تا آداپتر بنویسم.
- `PAY_MODE=test` فقط برای توسعه است و در `ENV=production` عمداً خاموش می‌شود.
- هشدار: برخی درگاه‌های ایرانی درخواست از IP خارج از ایران را رد می‌کنند. اگر زرین‌پال از Worker رد کرد، فقط تابع پرداخت را روی یک سرور ایرانی بگذارید (راهش را کمک می‌کنم).

## عکس و قیمت واقعی
عکس‌ها را با نام فایل ذکرشده در `site/data/catalog.json` (ستون `image`) در `site/images/products/` بگذارید، یا مسیرش را در پنل مدیریت → محصولات بنویسید. تا آن موقع تصویر گرافیکی سبز نمایش داده می‌شود. قیمت‌ها نمونه‌اند؛ از پنل ویرایش کنید. (کپی عکس/قیمت از دیجی‌کالا بدون اجازه نقض حقوق آن‌هاست؛ از عکس خودتان یا تأمین‌کننده استفاده کنید.)

## ایمنی (خلاصه)
- هیچ secret در مخزن/خروجی نیست؛ `scripts/check.mjs` پیش از هر انتشار شبا، کارت، هش و کلیدها را اسکن می‌کند.
- پنل: مسیر مخفی + رمز PBKDF2 + کوکی `__Host-` HttpOnly/Secure/SameSite=Strict + محدودیت تلاش ورود + هدر ضد CSRF + CSP + رندر فقط با `textContent` (ضد XSS) + گزارش فعالیت.
- API: CORS فقط دامنهٔ خودتان، اعتبارسنجی ورودی، محدودیت نرخ، honeypot، تراکنش اتمیک موجودی، پیگیری فقط با کد+موبایل.
- سایت: CSP، escape همهٔ داده‌ها، بدون inline script. توجه: GitHub Pages اجازهٔ هدر سفارشی نمی‌دهد (frame-ancestors/HSTS)؛ با Cloudflare Pages فایل `_headers` اعمال می‌شود.
- **شبای شما در چت ارسال شد؛ فقط برای واریز مشتری است، ولی بهتر است هر رمز/کلید واقعی را هرگز جایی عمومی نگذارید.**

## ویژگی‌های ظاهری
فونت Vazirmatn و Markazi Text خودمیزبان هستند (Google Fonts در ایران کند/مسدود است و دلیل نمایش فونت پیش‌فرض موبایل همین بود؛ ورودی‌ها هم `font: inherit` گرفتند). انیمیشن آغازین رشد درخت (یک‌بار در هر نشست، با لمس رد می‌شود)، برگ‌های افتان، پرواز برگ به سبد، احترام به `prefers-reduced-motion`، ناحیه‌های امن iOS (notch)، `dvh` برای اندروید، ورودی ۱۶px ضد زوم iOS، حالت hover فقط روی ماوس (ویندوز/دسکتاپ)، پشتیبانی `forced-colors` و manifest نصب‌پذیر (PWA).
