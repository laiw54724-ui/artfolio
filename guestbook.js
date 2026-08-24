/* ══════════════════════════════════════════════════
   留言板 API — Cloudflare Pages Functions + D1
   部署後這個檔案會自動變成 /api/guestbook 端點。
   需要在 Cloudflare Pages 設定裡綁定 D1 資料庫,
   繫結名稱(Variable name)必須是:DB
   建表 SQL 見專案根目錄的 schema.sql
   ══════════════════════════════════════════════════ */

// 讀取留言(最新 100 則)
// 站長模式:GET /api/guestbook?all=1 + Authorization: Bearer <ADMIN_TOKEN>
// 會回傳全部留言(含已隱藏的),給 admin.html 管理頁用
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "尚未綁定 D1 資料庫" }, 503);

  const wantAll = new URL(request.url).searchParams.get("all");
  if (wantAll) {
    if (!isAdmin(request, env)) return json({ error: "沒有權限" }, 401);
    const { results } = await env.DB.prepare(
      "SELECT id, name, message, hidden, created_at FROM comments ORDER BY id DESC LIMIT 500"
    ).all();
    return json(results);
  }

  const { results } = await env.DB.prepare(
    "SELECT id, name, message, created_at FROM comments WHERE hidden = 0 ORDER BY id DESC LIMIT 100"
  ).all();
  return json(results);
}

// 新增留言
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "尚未綁定 D1 資料庫" }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "格式錯誤" }, 400); }

  // 蜜罐:網頁上這個欄位是隱藏的,真人不會填。有填的就是機器人,假裝成功。
  if (body.website) return json({ ok: true });

  const name = String(body.name || "").trim().slice(0, 30);
  const message = String(body.message || "").trim().slice(0, 500);
  if (!name || !message) return json({ error: "暱稱和留言都要填喔" }, 400);

  // 簡易防洗版:同一 IP 60 秒內只能留一則
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comments WHERE ip = ? AND created_at > datetime('now', '-60 seconds')"
  ).bind(ip).first();
  if (recent && recent.n > 0) return json({ error: "留言太頻繁了,休息一下再試" }, 429);

  await env.DB.prepare(
    "INSERT INTO comments (name, message, ip) VALUES (?, ?, ?)"
  ).bind(name, message, ip).run();

  return json({ ok: true });
}

// 隱藏/恢復留言(站長專用,建議直接用 admin.html 管理頁操作)
// 隱藏:DELETE /api/guestbook?id=123
// 恢復:DELETE /api/guestbook?id=123&restore=1
// 都要帶 Authorization: Bearer <ADMIN_TOKEN>
// ADMIN_TOKEN 在 Cloudflare Pages 的環境變數(Secret)裡設定,教學有寫
export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: "尚未綁定 D1 資料庫" }, 503);
  if (!isAdmin(request, env)) return json({ error: "沒有權限" }, 401);

  const p = new URL(request.url).searchParams;
  const id = p.get("id");
  if (!id) return json({ error: "缺少 id" }, 400);

  const hidden = p.get("restore") ? 0 : 1;
  await env.DB.prepare("UPDATE comments SET hidden = ? WHERE id = ?").bind(hidden, id).run();
  return json({ ok: true });
}

function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
