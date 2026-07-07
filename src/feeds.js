// 配信対象のニュースフィード一覧（「最強」構成 / 実フィード検証済み）。
// 地域（欧米・日本・アジア・中東）× 分野（国際・経済・AI・テック・科学）を
// バランスさせて世界を広くカバーする。
// ① 公式RSSが直接使えるもの と ② Google News RSS経由でう回するもの が混在。
// 落ちたフィードは自動でスキップされる（fetchNews.js 側で握りつぶす）ので、
// 使わないものはコメントアウト、増やしたいものは行を追加すればOK。

const gnews = (site) =>
  `https://news.google.com/rss/search?q=when:24h+site:${site}&hl=ja&gl=JP&ceid=JP:ja`;

export const FEEDS = [
  // 🌍 世界情勢（通信社・国際メディア。欧・中東も入れて多視点に）
  { name: "BBC World",     category: "世界", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Reuters",       category: "世界", url: gnews("reuters.com") },
  { name: "Al Jazeera",    category: "世界", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "The Guardian",  category: "世界", url: "https://www.theguardian.com/world/rss" },
  { name: "Deutsche Welle",category: "世界", url: "https://rss.dw.com/rdf/rss-en-all" },

  // 🗾 日本
  { name: "NHK",           category: "日本", url: gnews("nhk.or.jp") },
  { name: "Japan Times",   category: "日本", url: "https://www.japantimes.co.jp/feed/" },

  // 🌏 アジア（中国・香港・インド視点）
  { name: "Nikkei Asia",   category: "アジア", url: "https://asia.nikkei.com/rss/feed/nar" },
  { name: "SCMP",          category: "アジア", url: "https://www.scmp.com/rss/91/feed" },
  { name: "The Hindu",     category: "アジア", url: "https://www.thehindu.com/news/international/feeder/default.rss" },

  // 💹 投資・経済
  { name: "Bloomberg",     category: "経済", url: gnews("bloomberg.com") },
  { name: "Financial Times", category: "経済", url: "https://www.ft.com/rss/home" },
  { name: "The Economist", category: "経済", url: "https://www.economist.com/latest/rss.xml" },
  { name: "Wall St Journal", category: "経済", url: gnews("wsj.com") },
  { name: "CNBC",          category: "経済", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },

  // 🤖 AI（公式ブログ＋毎日更新のAI報道で補強）
  { name: "OpenAI",        category: "AI", url: "https://openai.com/news/rss.xml" },
  { name: "DeepMind",      category: "AI", url: "https://deepmind.google/blog/rss.xml" },
  { name: "TechCrunch AI", category: "AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "MIT Tech Review", category: "AI", url: "https://www.technologyreview.com/feed/" },

  // 💻 テクノロジー
  { name: "TechCrunch",    category: "テック", url: "https://techcrunch.com/feed/" },
  { name: "The Verge",     category: "テック", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Ars Technica",  category: "テック", url: "https://feeds.arstechnica.com/arstechnica/index" },

  // 🔬 科学
  { name: "Nature",        category: "科学", url: "https://www.nature.com/nature.rss" },
  { name: "ScienceDaily",  category: "科学", url: "https://www.sciencedaily.com/rss/top/science.xml" },
];
