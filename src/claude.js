import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// モデル: 精度重視なら claude-sonnet-5、コスト最優先なら claude-haiku-4-5-20251001 に変更可。
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

// 選ぶ本数
const TOP_N = Number(process.env.TOP_N || 5);

// 出力トークン上限。本数に応じて拡大（1本あたり約250tok + 総括ぶんの余裕）。
// これが小さいとJSONが途中で切れて解析に失敗するため、TOP_Nを増やすなら必ず連動させる。
// 20本ぶんの要約＋コメント＋ふりがな＋深掘りは出力が長い。上限が小さいとJSONが
// 途中で途切れて解析に失敗するため、十分な枠を確保する（TOP_N=20 で約16000）。
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 2000 + TOP_N * 700);

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

【選び方のルール（重要）】
1. まず、内容が近い記事どうしを頭の中でグループにまとめる。同じ出来事・同じ事件・
   同じ会議・同じ発表・同じ決算などを扱う記事は「1つの話題」とみなす
   （複数の報道機関が同じニュースを別記事で出しているケースが多い）。
2. 各話題からは【最も優れた1本だけ】を選ぶ。似た内容の記事を2本以上並べない。
3. ${TOP_N}本は【できるだけ多様な話題】に散らす。1つの大きな出来事が複数の枠を
   占有しないこと（どんなに重要でも、同じ話題からは原則1本）。
4. 分野（世界/日本/アジア/経済/AI/テック/科学）にも偏りが出ないよう、
   可能な範囲でバランス良く選ぶ。特定分野ばかりにならないこと。
5. 結果として、読者が「今日の世界の動きを幅広く把握できる」多彩なラインナップにする。

${LENS}

【ふりがな（ルビ）: 本当に難しい漢字だけに付ける（最小限に）】
title_ja / summary / take / overview の日本語で、【一般の大人でも読み方に迷うような
難読漢字・特殊な読みの語・読みにくい固有名詞】に【だけ】読み仮名を付ける。
基準は高めに。迷ったら付けない。記法は {漢字|かんじ}（波括弧＋縦棒）。
- 付ける対象（例）: {忖度|そんたく} {逼迫|ひっぱく} {脆弱|ぜいじゃく} {更迭|こうてつ}
  {隠蔽|いんぺい} {齟齬|そご} {軋轢|あつれき} {罷免|ひめん}、難読の人名・地名。
- 付けない対象: 新聞で普通に使う漢字語には付けない。
  例: 経済・影響・輸出・政府・首相・企業・半導体・為替・懸念・地政学・株価・
  日本・世界・社会・今日 など、大人が読める語には一切付けない。
- ひらがな・カタカナ・英数字・記号には付けない。読みは正確な現代仮名遣いで。
- 目安: 1記事あたり付くのは多くて数語、無い記事があってもよい。
- 例文: 政府内の{軋轢|あつれき}が表面化し、情報{隠蔽|いんぺい}への批判が強まった。

【今日の深掘り（deepdive）】
選んだ${TOP_N}本の中から、その日【最も重要で読者が深く理解すべき1件】を選び、
初心者にも分かるように【しっかり詳しく】解説する。
- 構成: ①何が起きたか ②背景・経緯（なぜこうなったか） ③なぜ重要か・誰に影響するか
  ④今後の見通し・注目点。段落を分けて書く（4〜6段落、日本語で500〜800字程度）。
- 前提知識がない人にも分かるよう、専門用語はかみ砕いて説明する。
- 事実に基づき、憶測は「〜とみられる」等と明示。ふりがな記法（難読漢字のみ）も使う。
- index には、この深掘りの主となる元記事の番号を入れる。
- 段落の区切りは本文中で改行文字 \\n を使う。

必ず以下のJSONだけを返してください。前置き・後書き・コードフェンス（\`\`\`）は一切不要です。
（各テキストは上記のふりがな記法を使って書くこと）
{
  "overview": "今日のニュース全体を俯瞰した1〜2文の総括（ふりがな付き日本語）",
  "deepdive": {
    "index": <深掘りの主となる元記事の番号（整数）>,
    "title": "深掘りの見出し（簡潔に・ふりがな付き）",
    "body": "しっかりした解説本文。4〜6段落・500〜800字・ふりがな付き。段落は \\n で区切る。"
  },
  "stories": [
    {
      "index": <元記事の番号（整数）>,
      "rank": <1〜${TOP_N}の重要度順>,
      "title_ja": "日本語の見出し（簡潔に・ふりがな付き）",
      "summary": "事実ベースの要約。2〜3文、ふりがな付き日本語。",
      "take": "💭 あなたの視点コメント。1〜2文、ふりがな付き日本語。"
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

  // 今日の深掘り（元記事にひも付けてsource/linkを付与）
  let deepdive = null;
  const dd = parsed.deepdive;
  if (dd && dd.body) {
    const src = Number.isInteger(dd.index) ? articles[dd.index] : null;
    deepdive = {
      title: dd.title || "",
      body: dd.body,
      category: (src && src.category) || "",
      source: src ? src.source : "",
      link: src ? src.link : "",
    };
  }

  return { overview: parsed.overview || "", deepdive, stories };
}
