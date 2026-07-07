import "./env.js"; // 何よりも先に .env を読み込む（ローカル実行用）
import { fetchAllNews } from "./fetchNews.js";
import { curateNews } from "./claude.js";
import { formatMessage } from "./format.js";
import { sendTelegram } from "./telegram.js";

async function main() {
  console.log("🌅 朝のニュースダイジェスト開始:", new Date().toISOString());

  // 1. 全フィードから直近24時間の記事を取得
  const articles = await fetchAllNews();

  // 2. Claudeが重要5本を選別・要約し、視点コメント＋総括を付与
  const curated = await curateNews(articles);
  console.log(`📝 選定: ${curated.stories.length}本`);

  // 3. Telegram向けに整形
  const message = formatMessage(curated);

  // DRY_RUN=1 または --dry のときは送信せずコンソール出力だけ（動作確認用）
  const dryRun = process.env.DRY_RUN || process.argv.includes("--dry");
  if (dryRun) {
    console.log("\n──────── DRY RUN（送信なし） ────────\n");
    console.log(message);
    return;
  }

  // 4. 配信
  await sendTelegram(message);
}

main().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
