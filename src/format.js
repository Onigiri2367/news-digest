// Telegram の parse_mode=HTML 用にメッセージを組み立てる。
// HTMLモードでは & < > のエスケープが必要。

function esc(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const CATEGORY_EMOJI = {
  世界: "🌍",
  経済: "💹",
  AI: "🤖",
  テック: "💻",
};

export function formatMessage({ overview, stories }) {
  const today = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const lines = [];
  lines.push(`🗞 <b>今日の世界ニュース</b>  ${esc(today)}`);
  if (overview) {
    lines.push("");
    lines.push(`<i>${esc(overview)}</i>`);
  }

  stories.forEach((s, i) => {
    const emoji = CATEGORY_EMOJI[s.category] || "•";
    lines.push("");
    lines.push(`${emoji} <b>${i + 1}. ${esc(s.title_ja)}</b>`);
    lines.push(esc(s.summary));
    if (s.take) lines.push(esc(s.take));
    if (s.link) lines.push(`<a href="${esc(s.link)}">▶ ${esc(s.source)}で読む</a>`);
  });

  return lines.join("\n");
}
