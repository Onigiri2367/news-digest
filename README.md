# 🗞 朝のニュースダイジェスト

毎朝6時(JST)に、世界のニュースをClaudeが重要5本に絞り込み、
それぞれに **Claudeの視点コメント** と **1日の総括** を添えて、
**自分専用のWebサイト（PWA）** に自動公開する。
サーバー不要・GitHub Actions + GitHub Pagesで完全無料運用（Claude API代のみ）。

スマホでサイトを「ホーム画面に追加」すれば、アプリのように開けます。

## 仕組み

```
RSS取得(11ソース) → Claudeが5本選別+要約+視点コメント → 静的サイト生成 → GitHub Pagesへ公開
                         ↑ GitHub Actionsが毎朝6時に自動実行
```

- 過去分は `data/history.json` に蓄積され、サイト下部に折りたたみで残る（既定30日）。
- サイト本体（`site/`）は毎回まるごと生成し直すビルド成果物。

## セットアップ

### 1. 必要なもの
- **Anthropic APIキー** … https://console.anthropic.com で取得

### 2. ローカルで動作確認
```bash
npm install
cp .env.example .env      # .env を編集して ANTHROPIC_API_KEY を入れる
npm run dry               # site/ を生成（history.jsonは更新しない）
# → site/index.html をブラウザで開くと見た目を確認できる
npm start                 # 本番同様に生成し history.json も更新
```

### 3. GitHub Actions + Pages で自動化
1. このプロジェクトをGitHubにpush
2. **Settings → Secrets and variables → Actions** に登録:
   - `ANTHROPIC_API_KEY`
3. **Settings → Pages → Build and deployment → Source** を **「GitHub Actions」** に設定
4. **Actions** タブ →「Daily News Digest」→ `Run workflow` で手動テスト
5. 成功すると `https://<ユーザー名>.github.io/<リポジトリ名>/` で閲覧可能
6. 以降は毎朝6時(JST)に自動更新

### 4. スマホにアプリとして追加（PWA）
- 公開URLをスマホのブラウザで開く
- iOS(Safari): 共有 → 「ホーム画面に追加」
- Android(Chrome): メニュー → 「アプリをインストール」

## カスタマイズどころ

| やりたいこと | 触る場所 |
|---|---|
| ニュースソースの追加・削除 | `src/feeds.js` |
| 視点コメントの切り口を変える | `src/claude.js` の `LENS` |
| 配信本数・対象時間・モデル | `.env`（`TOP_N` / `WINDOW_HOURS` / `CLAUDE_MODEL`） |
| 実行時刻 | `.github/workflows/daily-news.yml` の cron |
| サイトの見た目・タイトル・残す日数 | `src/site.js` / `SITE_TITLE` / `KEEP_DAYS` |

## 費用の目安
1日1回・Sonnetで数十円/月程度。`CLAUDE_MODEL=claude-haiku-4-5-20251001` にすればさらに安い。
GitHub Actions と Pages は（公開リポジトリなら）無料枠で収まる。
