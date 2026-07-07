// 配信対象のニュースフィード一覧。
// ① 公式RSSが直接使えるもの と ② Google News RSS経由でう回するもの が混在。
// Google News経由は site: の部分を差し替えるだけで他サイトにも流用できる。
// 落ちたフィードは自動でスキップされる（fetchNews.js 側で握りつぶす）ので、
// 使わないものはコメントアウト、増やしたいものは行を追加すればOK。

const gnews = (site) =>
  `https://news.google.com/rss/search?q=when:24h+site:${site}&hl=ja&gl=JP&ceid=JP:ja`;

export const FEEDS = [
  // 🌍 世界情勢
  { name: "BBC World", category: "世界", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Reuters",   category: "世界", url: gnews("reuters.com") },
  { name: "AP News",   category: "世界", url: gnews("apnews.com") },

  // 💹 投資・経済
  { name: "Bloomberg",     category: "経済", url: gnews("bloomberg.com") },
  { name: "Financial Times", category: "経済", url: gnews("ft.com") },
  { name: "Yahoo Finance", category: "経済", url: gnews("finance.yahoo.com") },

  // 🤖 AI
  { name: "OpenAI",    category: "AI", url: "https://openai.com/news/rss.xml" },
  { name: "Anthropic", category: "AI", url: gnews("anthropic.com/news") },
  { name: "DeepMind",  category: "AI", url: gnews("deepmind.google") },

  // 💻 テクノロジー
  { name: "TechCrunch", category: "テック", url: "https://techcrunch.com/feed/" },
  { name: "The Verge",  category: "テック", url: "https://www.theverge.com/rss/index.xml" },
];
