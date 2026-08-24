/* ══════════════════════════════════════════════════
   RSS 訂閱 — 部署後自動生效於 你的網址/rss.xml
   粉絲用 RSS 閱讀器訂閱後,你新增作品他們就會收到,
   不用受演算法擺佈。內容自動取自 data.json 的作品列表。
   ══════════════════════════════════════════════════ */

const esc = s => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;

  let data;
  try {
    data = await (await env.ASSETS.fetch(new URL("/data.json", origin))).json();
  } catch {
    return new Response("data.json not found", { status: 404 });
  }

  const title = data.settings?.siteTitle || data.profile?.name || "作品集";
  const works = (data.works || []).slice(0, 30); // 最新 30 件(陣列順序=顯示順序)

  const items = works.map(w => {
    // 日期格式 YYYY-MM 或 YYYY-MM-DD 都接受
    const d = w.date ? new Date(w.date.length === 7 ? w.date + "-01" : w.date) : null;
    return `
  <item>
    <title>${esc(w.title)}</title>
    <link>${origin}/#works</link>
    <guid isPermaLink="false">${esc(w.id || w.title)}</guid>
    ${d && !isNaN(d) ? `<pubDate>${d.toUTCString()}</pubDate>` : ""}
    <description>${esc([w.category, (w.tags || []).join("、"), w.desc].filter(Boolean).join(" · "))}</description>
    ${w.image ? `<enclosure url="${origin}/${esc(w.image)}" type="image/jpeg" length="0"/>` : ""}
  </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(title)}</title>
  <link>${origin}/</link>
  <description>${esc(data.profile?.tagline || "作品更新")}</description>
  <language>zh-tw</language>${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
