// 静的サイト（GitHub Pages + PWA）を生成する。
//  - data/history.json … 過去分を蓄積する唯一の状態（リポジトリにコミットされ永続化）
//  - site/            … 毎回まるごと生成するビルド成果物（Pagesにデプロイ。gitignore）
//
// 「今日の分」を history の先頭に入れ（同じ日付があれば上書き）、
// 直近 KEEP_DAYS 日ぶんから index.html を作る。過去分は折りたたみで読める。

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const HISTORY_PATH = join(DATA_DIR, "history.json");
const SITE_DIR = join(ROOT, "site");

// 何日ぶん残すか
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 30);
// ページ上部のタイトル
const SITE_TITLE = process.env.SITE_TITLE || "朝のニュースダイジェスト";
// テーマ色
const THEME = "#0b1020";
const ACCENT = "#6ea8fe";

const CATEGORY_EMOJI = {
  世界: "🌍", 日本: "🗾", アジア: "🌏", 経済: "💹",
  AI: "🤖", テック: "💻", 科学: "🔬",
};

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Claudeが出力する {漢字|かんじ} 記法を <ruby>漢字<rt>かんじ</rt></ruby> に変換（ふりがな）。
// esc のあとに呼ぶこと（記法の { | } は esc で壊れないので安全）。
function ruby(s = "") {
  return s.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, "<ruby>$1<rt>$2</rt></ruby>");
}

// Claude生成テキスト用（エスケープ＋ふりがな）。見出し・要約・コメント・総括に使う。
function fmt(s = "") {
  return ruby(esc(s));
}

// JSTでの日付関連の文字列を作る
function jstDateParts(now = new Date()) {
  const key = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD
  const label = now.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return { key, label };
}

function loadHistory() {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderStories(stories) {
  return stories
    .map((s, i) => {
      const emoji = CATEGORY_EMOJI[s.category] || "•";
      const link = s.link
        ? `<a class="src" href="${esc(s.link)}" target="_blank" rel="noopener">▶ ${esc(s.source)}で読む</a>`
        : "";
      const take = s.take ? `<p class="take">${fmt(s.take)}</p>` : "";
      return `
      <article class="story">
        <h3><span class="badge">${emoji} ${esc(s.category || "")}</span>${i + 1}. ${fmt(s.title_ja)}</h3>
        <p class="summary">${fmt(s.summary)}</p>
        ${take}
        ${link}
      </article>`;
    })
    .join("\n");
}

function renderEntry(entry, { open }) {
  const overview = entry.overview
    ? `<p class="overview">${fmt(entry.overview)}</p>`
    : "";
  const body = `
    ${overview}
    ${renderStories(entry.stories || [])}
  `;
  // 最新はそのまま、過去分は<details>で折りたたむ
  if (open) {
    return `
    <section class="entry latest">
      <div class="entry-date">${esc(entry.dateLabel)}</div>
      ${body}
    </section>`;
  }
  const titles = (entry.stories || [])
    .map((s) => fmt(s.title_ja))
    .slice(0, 3)
    .join(" ・ ");
  return `
    <details class="entry">
      <summary>
        <span class="entry-date">${esc(entry.dateLabel)}</span>
        <span class="peek">${titles}</span>
      </summary>
      ${body}
    </details>`;
}

function renderHtml(history) {
  const [latest, ...rest] = history;
  const latestHtml = latest ? renderEntry(latest, { open: true }) : "";
  const restHtml = rest.length
    ? `<h2 class="past-h">これまでのダイジェスト</h2>` +
      rest.map((e) => renderEntry(e, { open: false })).join("\n")
    : "";
  const updated = latest ? esc(latest.dateLabel) : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(SITE_TITLE)}</title>
<meta name="theme-color" content="${THEME}">
<meta name="description" content="Claudeが毎朝選ぶ世界のニュース5本">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./icon.svg">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ニュース">
<script>
  // 保存済みのふりがな設定を、描画前に反映（表示のちらつき防止）
  try { if (localStorage.getItem("furigana") === "off") document.documentElement.setAttribute("data-furigana", "off"); } catch (e) {}
</script>
<style>
  :root { --bg:${THEME}; --accent:${ACCENT}; --card:#151b31; --text:#e8ecf6; --muted:#9aa4bf; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
    line-height: 1.75; -webkit-font-smoothing: antialiased;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 20px 16px 64px; }
  header.site { padding: 8px 0 4px; }
  header.site h1 { font-size: 1.4rem; margin: 0; letter-spacing: .02em; }
  header.site .updated { color: var(--muted); font-size: .85rem; margin-top: 2px; }
  .entry-date { color: var(--accent); font-weight: 700; font-size: .95rem; }
  .overview {
    background: linear-gradient(180deg,#1a2340,#141b31); border:1px solid #26304f;
    border-radius: 14px; padding: 14px 16px; font-style: italic; color:#cdd6f0; margin: 10px 0 22px;
  }
  .story {
    background: var(--card); border:1px solid #232c49; border-radius: 14px;
    padding: 16px 16px 14px; margin: 0 0 14px;
  }
  .story h3 { margin: 0 0 6px; font-size: 1.08rem; }
  /* ふりがな（ルビ）: 読みは小さめ・控えめの色に */
  ruby rt { font-size: 0.58em; color: var(--muted); font-weight: 400; user-select: none; }
  .summary, .take, .overview, .story h3, .peek { line-height: 2.0; }
  /* ふりがなOFF時: 読みを隠して行間を詰める */
  :root[data-furigana="off"] rt { display: none; }
  :root[data-furigana="off"] .summary,
  :root[data-furigana="off"] .take,
  :root[data-furigana="off"] .overview,
  :root[data-furigana="off"] .story h3,
  :root[data-furigana="off"] .peek { line-height: 1.7; }
  /* ふりがな切り替えボタン */
  header.site .toprow { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .furigana-toggle {
    -webkit-appearance:none; appearance:none; cursor:pointer; white-space:nowrap;
    background:#222c4a; color:#cdd6f0; border:1px solid #2c3960;
    border-radius:999px; padding:7px 14px; font-size:.82rem; font-weight:700;
  }
  .furigana-toggle:active { transform: scale(0.97); }
  .badge {
    display:inline-block; font-size:.72rem; color:#cdd6f0; background:#222c4a;
    border-radius:999px; padding:2px 9px; margin-right:8px; vertical-align: middle; font-weight:600;
  }
  .summary { margin: 6px 0; color: var(--text); }
  .take { margin: 8px 0 6px; color:#c7d2f0; border-left:3px solid var(--accent); padding-left:10px; }
  a.src { color: var(--accent); text-decoration: none; font-size:.9rem; }
  a.src:hover { text-decoration: underline; }
  .past-h { margin: 34px 0 12px; font-size: 1rem; color: var(--muted); font-weight:600; border-top:1px solid #232c49; padding-top:22px; }
  details.entry { background:#111731; border:1px solid #232c49; border-radius:12px; margin:0 0 10px; padding: 4px 14px; }
  details.entry summary { cursor:pointer; list-style:none; padding:10px 0; display:flex; flex-direction:column; gap:2px; }
  details.entry summary::-webkit-details-marker { display:none; }
  details.entry .peek { color: var(--muted); font-size:.85rem; }
  details.entry[open] summary { border-bottom:1px solid #232c49; margin-bottom:8px; }
  footer { color: var(--muted); font-size:.78rem; text-align:center; margin-top: 40px; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="site">
      <div class="toprow">
        <h1>🗞 ${esc(SITE_TITLE)}</h1>
        <button class="furigana-toggle" id="furigana-toggle" type="button" aria-label="ふりがなの表示を切り替え"></button>
      </div>
      <div class="updated">最終更新: ${updated}</div>
    </header>
    <main>
      ${latestHtml || '<p class="overview">まだダイジェストがありません。</p>'}
      ${restHtml}
    </main>
    <footer>Claudeが毎朝キュレーション</footer>
  </div>
  <script>
    // ふりがなON/OFFボタン（設定はlocalStorageに記憶）
    (function () {
      var root = document.documentElement;
      var btn = document.getElementById("furigana-toggle");
      if (!btn) return;
      function refresh() {
        var off = root.getAttribute("data-furigana") === "off";
        btn.textContent = off ? "ふりがな OFF" : "ふりがな ON";
      }
      refresh();
      btn.addEventListener("click", function () {
        var off = root.getAttribute("data-furigana") === "off";
        if (off) { root.removeAttribute("data-furigana"); }
        else { root.setAttribute("data-furigana", "off"); }
        try { localStorage.setItem("furigana", off ? "on" : "off"); } catch (e) {}
        refresh();
      });
    })();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () =>
        navigator.serviceWorker.register("./sw.js").catch(() => {})
      );
    }
  </script>
</body>
</html>`;
}

const MANIFEST = JSON.stringify(
  {
    name: SITE_TITLE,
    short_name: "ニュース",
    description: "Claudeが毎朝選ぶ世界のニュース5本",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: THEME,
    theme_color: THEME,
    icons: [
      { src: "./icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
  },
  null,
  2
);

// アプリアイコン（新聞の絵文字を濃紺の角丸に載せたSVG）
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${THEME}"/>
  <rect x="96" y="96" width="320" height="320" rx="40" fill="${ACCENT}" opacity="0.15"/>
  <text x="50%" y="52%" font-size="300" text-anchor="middle" dominant-baseline="central">🗞</text>
</svg>`;

// 最小のオフライン用サービスワーカー（app shellをキャッシュ）
const SW_JS = `const CACHE = "news-digest-v1";
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icon.svg"])));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // ネット優先・失敗時キャッシュ（毎朝の更新を取りこぼさない）
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html")))
  );
});`;

/**
 * サイトを生成する。
 * @param {{overview:string, stories:any[]}} curated
 * @param {{persist:boolean}} opts persist=false のとき history.json を書き換えない（dry用）
 * @returns {{siteDir:string, historyPath:string, entryDate:string}}
 */
export function buildSite(curated, { persist = true } = {}) {
  const { key, label } = jstDateParts();

  const entry = {
    date: key,
    dateLabel: label,
    generatedAt: new Date().toISOString(),
    overview: curated.overview || "",
    stories: curated.stories || [],
  };

  // 履歴に反映（同日は置き換え、新しい順、KEEP_DAYSで切る）
  const prev = loadHistory().filter((e) => e.date !== key);
  const history = [entry, ...prev]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, KEEP_DAYS);

  if (persist) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n", "utf8");
  }

  // site/ をまるごと作り直す
  rmSync(SITE_DIR, { recursive: true, force: true });
  mkdirSync(SITE_DIR, { recursive: true });
  writeFileSync(join(SITE_DIR, "index.html"), renderHtml(history), "utf8");
  writeFileSync(join(SITE_DIR, "manifest.webmanifest"), MANIFEST, "utf8");
  writeFileSync(join(SITE_DIR, "icon.svg"), ICON_SVG, "utf8");
  writeFileSync(join(SITE_DIR, "sw.js"), SW_JS, "utf8");
  writeFileSync(join(SITE_DIR, ".nojekyll"), "", "utf8"); // GitHub Pagesの素通し

  return { siteDir: SITE_DIR, historyPath: HISTORY_PATH, entryDate: key };
}
