import Parser from "rss-parser";
import { FEEDS } from "./feeds.js";

const parser = new Parser({ timeout: 15000 });

// 直近この時間内の記事だけを対象にする（時間）
const WINDOW_HOURS = Number(process.env.WINDOW_HOURS || 24);

// 1フィードあたり最大何件まで拾うか（ノイズとトークン節約のため）
const MAX_PER_FEED = Number(process.env.MAX_PER_FEED || 15);

function withinWindow(item) {
  const dateStr = item.isoDate || item.pubDate;
  if (!dateStr) return true; // 日付不明なものは一応通す
  const published = new Date(dateStr).getTime();
  if (Number.isNaN(published)) return true;
  const cutoff = Date.now() - WINDOW_HOURS * 60 * 60 * 1000;
  return published >= cutoff;
}

function clean(text = "") {
  return text
    .replace(/<[^>]*>/g, " ")   // HTMLタグ除去
    .replace(/\s+/g, " ")        // 空白正規化
    .trim()
    .slice(0, 300);              // スニペットは短く（トークン節約）
}

// 全フィードを並行取得。落ちたフィードはスキップしてログだけ残す。
export async function fetchAllNews() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || [])
        .filter(withinWindow)
        .slice(0, MAX_PER_FEED)
        .map((item) => ({
          source: feed.name,
          category: feed.category,
          title: (item.title || "").trim(),
          snippet: clean(item.contentSnippet || item.content || ""),
          link: item.link || "",
          published: item.isoDate || item.pubDate || "",
        }));
    })
  );

  const articles = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      console.warn(`⚠️  フィード取得失敗: ${FEEDS[i].name} (${r.reason?.message || r.reason})`);
    }
  });

  // タイトル重複を除去（同じニュースが複数ソースに出るため）
  const seen = new Set();
  const unique = articles.filter((a) => {
    const key = a.title.toLowerCase().replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`📥 取得記事: ${unique.length}件（重複除去後）`);
  return unique;
}
