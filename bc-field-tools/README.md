# BC現場アプリ（正本）

正本パス: `bc-field-tools`（本ディレクトリ）  
公開URL: https://teruya1229.github.io/bc-field-tools/

旧系統 `bc-field-diagnosis` は **Legacy / Reference Only** です。新規開発・修正・AI Function更新は本正本のみで行います。

## いまの事実（実装と一致）

- **4工程**: 現地調査 / 施工準備 / 施工中 / 完了確認
- **UI**: iframeなし。上部タブで「現場 / 見積」。選択式中心・数量ステッパー。写真0枚でも現場条件入力〜見積まで利用可能
- **写真保存**: 17枠（調査8 + 施工4 + 完了5）。端末カメラまたはライブラリ。Blobを IndexedDB に分離保存（Base64化なし・無断圧縮なし）
- **IndexedDB**: DB名は互換のため `bc-field-diagnosis`（URLが違っても同一オリジン `teruya1229.github.io` 上では同じ保存領域）。`schemaVersion` は `1B-2A`。revision / generation / tombstone / 別タブ競合検出あり
- **複数案件**: 作成・一覧切替・削除（二段階確認）・`.bcfd` backup / restore（新UUID・既存非上書き・SHA-256・暗号化なし）
- **クラウド案件同期**: **未実装**。案件と写真は端末ブラウザ内のみ
- **見積**: `localStorage` キー `bc_quote_state`（selected / prices / custom を維持）。料金マスター型 `bc_estimate_price_master`
- **AI写真読取**: **実装済み**（モックではない）。調査8枠の JPEG 1枚のみ、明示同意後に BC専用 Edge Function `ai-photo-proxy` 経由で OpenAI（**model: `gpt-4o-mini`** / max output tokens 400 / 全体45秒 timeout）へ送信。ブラウザに APIキーは置かない
- **AIが送信するデータ**: multipart の `photo`（JPEG）と `slotKey` のみ（最大4MiB）。案件全文や見積金額は送らない
- **AI結果**: runtime の `suggested` 候補のみ。IndexedDB / snapshot / `.bcfd` に保存しない。施工可否・電線サイズ・遮断器・接続方法は自動確定しない
- **人間確認**: AI候補は「反映する / 違う」で現場条件へ入れるまで見積金額に入らない。人間確認済みの現場条件は「見積へ」で `bc_quote_state` へマージ可能（二重の「候補確認」はしない）
- **認証**: AI読取権限確認用。案件閲覧・保存・backup・見積はログイン不要。パスワード再設定の戻り先コードは `https://teruya1229.github.io/bc-field-tools/`
- **AI Edge Functionソース正本**: 本ディレクトリ `supabase/functions/ai-photo-proxy/`（既存Supabaseプロジェクト `bc-field-diagnosis-ai` / ref `ahtmiobqemzrpqxowevc`）。プロジェクト変更・secrets変更・本番移行は別作業

## 起動（ローカル）

```bash
py -3 -m http.server 8780 --bind 127.0.0.1 --directory "C:\dev\bc-service\teruya1229-github-io\bc-field-tools"
```

`http://127.0.0.1:8780/index.html` を開く（`file://` 不可）。

## テスト

```bash
node --test tests/backup-format.test.js
node --test tests/ai-photo-safety.test.js
```

## Supabase管理画面（コード外）

Authentication → URL Configuration（本番整合済み）:

- Site URL: `https://teruya1229.github.io/bc-field-tools/`
- Redirect URLs: `https://teruya1229.github.io/bc-field-tools/`（旧 `bc-field-diagnosis` を当面残す場合は併記可）

## ファイル

- `index.html` / `style.css` / `app.js` … 現場UI・写真・AI確認・工程
- `estimate.js` … 見積・料金マスター・`bc_quote_state`
- `storage.js` … IndexedDB repository
- `case-persistence.js` … 案件管理・自動保存
- `backup.js` … `.bcfd`
- `auth-client.js` … Supabase Auth（anon keyのみ）
- `supabase/functions/ai-photo-proxy` … AI受け口ソース正本
