# ブラウザー番頭（browser-bantou）

Google広告などを **read-only** で開き、確認手順と広告番頭へ渡すJSONを出すローカル専用ツールです。

## 位置づけ

| ツール | 役割 | 実行場所 |
|--------|------|----------|
| **ブラウザー番頭** | ブラウザを開いて確認・読み取り | ローカル（Node + Playwright） |
| **広告番頭** (`ops/ad-bantou/`) | 記録・判定・履歴 | ブラウザ（GitHub Pages / localStorage） |

ブラウザー番頭は広告番頭に吸収しません。最終的に「取得 → 広告番頭へ転記」の運用を想定しています。

## 技術スタック

- Node.js 18+
- Playwright（Chromium / インストール済みChrome）
- 永続プロファイル（`.chrome-profile/`）でGoogleログインを維持

## セットアップ

```bash
cd browser-bantou
npm install
npx playwright install chrome
```

## 使い方（MVP）

### 1. JSONテンプレートだけ欲しいとき

```bash
npm run template
# または
node run-readonly.mjs --template-only --campaign=complete_disassembly
```

`output/ad-bantou-template-*.json` が出力されます。

### 2. ブラウザを開いて確認するとき

```bash
npm start
# または
node run-readonly.mjs --campaign=ai_bantou
```

1. Chromeが開き、Google広告概要へ移動します
2. **初回は手動ログイン**が必要です（プロファイルに保存されます）
3. ターミナルに read-only 確認手順が表示されます
4. キャンペーン画面まで**手動で**移動して確認します
5. ターミナルで Enter を押すと、画面上のテキストから **best-effort** で数値を読み取ります
6. `output/capture-*.json` を広告番頭へ転記します

## 安全ルール（禁止）

スクリプトは以下を行いません。

- 予算変更
- キャンペーン停止 / 公開
- 削除
- 課金・支払い設定の変更
- ボタンクリックによる設定変更

自動操作が壊れても、ターミナルの確認手順は常に表示されます。

## 広告番頭との連携

1. `output/capture-*.json` の `adBantouDailyInput` をコピー
2. https://teruya1229.github.io/ops/ad-bantou/ の「今日の入力」へ手動転記
3. 初期設定チェックは同ページの「Google広告 初期設定チェッカー」で記録

将来的には「JSONをクリップボードにコピー」ボタンや、広告番頭側の「browser-bantou JSON を読み込む」欄を追加可能です（現時点はファイル経由の手動連携）。

## 取得できる / できない項目

| 項目 | MVP |
|------|-----|
| 費用・表示回数・クリック・平均CPC | best-effort（画面テキスト解析。失敗時は null） |
| キャンペーン状態・入札・コンバージョン | 手動確認（JSONに manualRequired として記録） |
| LP URL・広告文・アセット | 広告番頭の初期設定チェッカーで記録 |

## ファイル構成

```
browser-bantou/
  package.json
  run-readonly.mjs   # read-only 起動・出力
  campaigns.json     # キャンペーン定義（広告番頭と整合）
  README.md
  .gitignore
  .chrome-profile/   # ログイン状態（git管理外）
  output/            # JSON出力（git管理外）
```

## 動作確認手順

```bash
cd browser-bantou
npm install
npm run template
```

`output/ad-bantou-template-complete_disassembly.json` が生成されればOK。

ブラウザ起動確認（手動ログイン必要）:

```bash
node run-readonly.mjs --campaign=complete_disassembly
```

## 注意

- このフォルダは **GitHub Pages には載せません**（ローカル実行専用）
- 個人情報（顧客名・住所・電話番号）は JSON に入れないでください
- Google広告のUI変更により、自動読み取りは壊れやすいです
