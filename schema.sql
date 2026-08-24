-- 留言板資料表
-- 在 Cloudflare Dashboard → D1 → 你的資料庫 → Console 貼上執行,
-- 或用指令:npx wrangler d1 execute 資料庫名稱 --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT DEFAULT '',
  hidden INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_created ON comments (created_at);
