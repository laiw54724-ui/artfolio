/* ══════════════════════════════════════════════════
   社群分享卡(OG meta)自動注入
   把網址貼到 X / Discord / FB / LINE 時,
   會顯示「網站標題+介紹+頭像」的漂亮預覽卡。
   原理:部署後這支程式會在送出首頁 HTML 前,
   自動從 data.json 讀你的資料塞進 <head>。
   你不需要改這個檔案。
   ══════════════════════════════════════════════════ */

const escAttr = s => String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // 只處理首頁
  if (url.pathname !== "/" && url.pathname !== "/index.html") return next();

  let data = null;
  try {
    const r = await env.ASSETS.fetch(new URL("/data.json", url.origin));
    data = await r.json();
  } catch { return next(); } // data.json 讀不到就原樣送出

  const res = await next();
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;

  const title = data.settings?.siteTitle || data.profile?.name || "作品集";
  const desc = [data.profile?.tagline, (data.profile?.about || "").split("\n")[0]]
    .filter(Boolean).join(" — ").slice(0, 160);
  const img = data.profile?.avatar ? new URL(data.profile.avatar, url.origin).href : "";

  const meta = `
<meta property="og:type" content="website">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${escAttr(url.origin)}/">
${img ? `<meta property="og:image" content="${escAttr(img)}">` : ""}
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escAttr(title)}">
<meta name="twitter:description" content="${escAttr(desc)}">
${img ? `<meta name="twitter:image" content="${escAttr(img)}">` : ""}
<meta name="description" content="${escAttr(desc)}">
`;

  const html = (await res.text()).replace("</head>", meta + "</head>");
  const headers = new Headers(res.headers);
  headers.delete("content-length"); // 長度已改變,讓平台重新計算
  return new Response(html, { status: res.status, headers });
}
