import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// モデル: 精度重視なら claude-sonnet-5、コスト最優先なら claude-haiku-4-5-20251001 に変更可。
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

// 選ぶ本数
const TOP_N = Number(process.env.TOP_N || 5);

// 出力トークン上限。本数に応じて拡大（1本あたり約250tok + 総括ぶんの余裕）。
// これが小さいとJSONが途中で切れて解析に失敗するため、TOP_Nを増やすなら必ず連動させる。
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 1000 + TOP_N * 250);

// ───────────────────────────────────────────────────────────
// 💭 Claudeの「視点」の切り口をここで決める。
// この LENS の文章を書き換えるだけでコメントの性格が変わる。
// 例1（デフォルト）: 中立的なアナリスト
// 例2: 自分の事業・関心と絡める（下のコメントを外して使う）
// ───────────────────────────────────────────────────────────
const LENS = process.env.CLAUDE_LENS || `
あなたは各分野に精通した参謀役です。ニュースごとに、その記事の【カテゴリ】に応じた
切り口で「💭 視点コメント」を1〜2文添えてください。鋭く・実用的に。断定しすぎず、
しかし平凡な感想で終わらせないこと。カテゴリ別の切り口は次の通り:

- 世界: 地政学・国際関係の視点。パワーバランスの変化、次に起きうる展開、
        見落とされがちな利害を突く。
- 日本: それが日本の社会・経済・暮らしにどう跳ね返るか。国際情勢と日本のつながりを示す。
- アジア: アジア域内の力学と、それが日本・世界へどう波及するか。
- 経済: 投資家・ビジネスの視点。市場やマクロへの影響、リスクと機会を一言で。
- AI: 技術が産業・社会にもたらす本当のインパクト。何が新しく、どこが誇張かを見極める。
- テック: 業界構造・競争・ユーザーへの影響。勝者と敗者、次の一手。
- 科学: その発見の意義と、実用化までの距離。過度な期待への注意も添える。
`;

// ── さらに個人向けにチューニングしたい場合は、環境変数 CLAUDE_LENS で上書きできる。
// 例: 「読者はドローン・IoT・AIに関心のある個人事業主。自分の事業にどう関係するか一言添えて」など。

const SYSTEM_PROMPT = `あなたは世界中のニュースを毎朝キュレーションする編集者です。
渡された記事一覧から、世界的な影響度・重要度・緊急度が高いものを${TOP_N}本選び、
日本語で読者に届けます。芸能・スポーツの軽い話題より、政治・経済・国際情勢・
テクノロジー・AIの構造的に重要なニュースを優先してください。

${LENS}

必ず以下のJSONだけを返してください。前置き・後書き・コードフェンス（\`\`\`）は一切不要です。
{
  "overview": "今日のニュース全体を俯瞰した1〜2文の総括（日本語）",
  "stories": [
    {
      "index": <元記事の番号（整数）>,
      "rank": <1〜${TOP_N}の重要度順>,
      "title_ja": "日本語の見出し（簡潔に）",
      "summary": "事実ベースの要約。2〜3文、日本語。",
      "take": "💭 あなたの視点コメント。1〜2文、日本語。"
    }
  ]
}`;

function buildUserMessage(articles) {
  const list = articles
    .map(
      (a, i) =>
        `[${i}] (${a.category}/${a.source}) ${a.title}\n    ${a.snippet}`
    )
    .join("\n\n");

  return `以下は直近の記事一覧です。この中から重要な${TOP_N}本を選び、指定のJSON形式で返してください。\n\n${list}`;
}

function extractJson(text) {
  // 念のためコードフェンスや前後の余分な文字を除去してからパース
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSONが見つかりません: " + text.slice(0, 200));
  return JSON.parse(cleaned.slice(start, end + 1));
}

// 記事一覧 → { overview, stories[] }（元記事のsource/link/categoryを結合して返す）
export async function curateNews(articles) {
  if (articles.length === 0) {
    return { overview: "対象期間に配信できるニュースがありませんでした。", stories: [] };
  }

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // 選別＋要約はJSON抽出タスク。Sonnet 5は思考が既定ONで max_tokens を消費し
    // JSONが途切れる恐れがあるため、思考は切って安定・低コストにする。
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(articles) }],
  });

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = extractJson(text);

  // Claudeが返したindexで元記事にひも付け（linkのハルシネーション防止）
  const stories = (parsed.stories || [])
    .map((s) => {
      const src = articles[s.index];
      if (!src) return null;
      return {
        rank: s.rank,
        title_ja: s.title_ja,
        summary: s.summary,
        take: s.take,
        category: src.category,
        source: src.source,
        link: src.link,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  return { overview: parsed.overview || "", stories };
}
