-- دیتابیس ناروَن (Cloudflare D1 / SQLite). همهٔ مبلغ‌ها تومانِ صحیح هستند (بدون اعشار).
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, blurb TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 2 AND 80),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  brand TEXT NOT NULL DEFAULT '',
  cat_id INTEGER NOT NULL REFERENCES categories(id),
  price INTEGER NOT NULL CHECK (price >= 0 AND price < 1000000000),
  old_price INTEGER CHECK (old_price IS NULL OR old_price > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  art TEXT NOT NULL DEFAULT 'book',
  color TEXT NOT NULL DEFAULT '#3E9B5F',
  bg TEXT NOT NULL DEFAULT '#E4F1DE',
  rating REAL NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  reviews INTEGER NOT NULL DEFAULT 0 CHECK (reviews >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE INDEX IF NOT EXISTS idx_products_cat ON products (cat_id, active);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY CHECK (code GLOB '[A-Z0-9]*' AND length(code) BETWEEN 3 AND 20),
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90),
  min_total INTEGER NOT NULL DEFAULT 0 CHECK (min_total >= 0),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  used INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  CHECK (max_uses IS NULL OR used <= max_uses));

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, phone TEXT NOT NULL, province TEXT NOT NULL, city TEXT NOT NULL,
  zip TEXT NOT NULL, unit TEXT NOT NULL DEFAULT '', address TEXT NOT NULL,
  ship_method TEXT NOT NULL CHECK (ship_method IN ('post', 'courier', 'pickup')),
  ship_fee INTEGER NOT NULL CHECK (ship_fee >= 0),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  coupon TEXT NOT NULL DEFAULT '',
  pay_method TEXT NOT NULL CHECK (pay_method IN ('online', 'card', 'cod')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'awaiting_verify', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed', 'cod')),
  tracking_code TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  paid_at INTEGER,
  ip_hash TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (phone);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL, price INTEGER NOT NULL CHECK (price >= 0),
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 99));
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items (order_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, authority TEXT NOT NULL DEFAULT '', ref_id TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('init', 'paid', 'failed', 'awaiting_verify')),
  card_last4 TEXT NOT NULL DEFAULT '', receipt_ref TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), verified_at INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_auth ON payments (provider, authority) WHERE authority <> '';
CREATE INDEX IF NOT EXISTS idx_pay_order ON payments (order_id);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch()));

CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL DEFAULT (unixepoch()), actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
