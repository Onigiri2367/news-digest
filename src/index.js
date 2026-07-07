import "./env.js"; // 何よりも先に .env を読み込む（ローカル実行用）
import { fetchAllNews } from "./fetchNews.js";
import { curateNews } from "./claude.js";
import { buildSite } from "./site.js";

async function main() {
  console.log("🌅 朝のニュースダイジェスト開始:", new Date().toISOString());

  // DRY_RUN=1 または --dry のときは history.json を書き換えず site/ の生成だけ試す
  const dryRun = process.env.DRY_RUN || process.argv.includes("--dry");

  // 1. 全フィードから直近24時間の記事を取得
  const articles = await fetchAllNews();

  // 2. Claudeが重要5本を選別・要約し、視点コメント＋総括を付与
  const curated = await curateNews(articles);
  console.log(`📝 選定: ${curated.stories.length}本`);

  // 3. 静的サイト（GitHub Pages + PWA）を生成。dryのときは履歴を汚さない。
  const { siteDir, entryDate } = buildSite(curated, { persist: !dryRun });

  if (dryRun) {
    console.log(`\n🧪 DRY RUN: ${entryDate} のサイトを ${siteDir} に生成しました（history.jsonは未更新）。`);
    console.log("ブラウザで site/index.html を開くと見た目を確認できます。");
    return;
  }

  console.log(`✅ サイト生成完了: ${entryDate}（${siteDir}）`);
}

main()
  // 処理完了後、SDKのkeep-alive接続などで event loop が残りプロセスが
  // 終了しないこと（＝CIが固まる）を防ぐため、明示的に終了する。
  // buildSite は writeFileSync で書き終えているので即 exit しても安全。
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ エラー:", err);
    process.exit(1);
  });
