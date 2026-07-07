# 🗞 朝のニュースダイジェスト

毎朝6時(JST)に、世界のニュースをClaudeが重要5本に絞り込み、
それぞれに **Claudeの視点コメント** と **1日の総括** を添えてTelegramに配信する。
サーバー不要・GitHub Actionsで完全無料運用（Claude API代のみ）。

## 仕組み

```
RSS取得(11ソース) → Claudeが5本選別+要約+視点コメント → Telegram配信
                         ↑ GitHub Actionsが毎朝6時に自動実行
```

## セットアップ

### 1. 必要なもの
- **Anthropic APIキー** … https://console.anthropic.com で取得
- **Telegram Bot トークン** … Telegramで @BotFather に `/newbot` して作成
- **Telegram Chat ID** … 作ったBotに何か送信し、
  `https://api.telegram.org/bot<トークン>/getUpdates` を開くと `chat.id` が見える

### 2. ローカルで動作確認
```bash
npm install
cp .env.example .env      # .env を編集してキーを入れる
npm run dry               # 送信せずに内容をコンソール確認
npm start                 # 実際にTelegramへ送信
```

### 3. GitHub Actionsで自動化
1. このプロジェクトをGitHubにpush（privateでOK）
2. リポジトリの **Settings → Secrets and variables → Actions** に3つ登録:
   - `ANTHROPIC_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
3. **Actions** タブ →「Daily News Digest」→ `Run workflow` で手動テスト
4. 以降は毎朝6時(JST)に自動配信

## カスタマイズどころ

| やりたいこと | 触る場所 |
|---|---|
| ニュースソースの追加・削除 | `src/feeds.js` |
| 視点コメントの切り口を変える | `src/claude.js` の `LENS` |
| 配信本数・対象時間・モデル | `.env`（`TOP_N` / `WINDOW_HOURS` / `CLAUDE_MODEL`） |
| 配信時刻 | `.github/workflows/daily-news.yml` の cron |
| メッセージの見た目 | `src/format.js` |

## 費用の目安
1日1回・Sonnetで数十円/月程度。`CLAUDE_MODEL=claude-haiku-4-5-20251001` にすればさらに安い。
