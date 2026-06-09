更新日: 2026-06-04

## 前提（読む順）

1. **status.md**（進捗の正本）を先に読む
2. 本ファイル（handoff / 引継ぎの正本）で次の1手を確認
3. 公開版参照（任意）：`https://teruya1229.github.io/ops/status/` / `https://teruya1229.github.io/ops/handoff/`

## フェーズ

- **LP実装は一区切り**（家庭 / 完全分解 / 施工事例一覧 / FAQ / 南部まとめ / 業務LP の SEO・構造化データ・導線は push 済み）
- **次フェーズ**：Search Console・公開URL確認・外部導線（Instagram / note / GBP）整理
- 新規 LP コード修正は、公開確認で問題が出た場合のみ

## 固定URL（変更禁止）

- LINE（正）：`https://lin.ee/tsilra6`
- Airリザーブ：`https://airrsv.net/bc-servicesokinawa/calendar`
- 完全分解LP（正）：`https://teruya1229.github.io/complete-disassembly/`
- 業務LP：`https://teruya1229.github.io/business-cleaning/`
- 施工事例一覧：`https://teruya1229.github.io/cursor-test/cases.html`

## 現在の状態（要約）

| ページ | パス | 状態 |
|--------|------|------|
| 家庭LP | `cursor-test/index.html` | FAQ9 + JSON-LD、AIまとめ、Instagram事例、cases導線、構造化データ済み。LINE優先・電話一時停止は維持 |
| 完全分解LP | `complete-disassembly/index.html` | 写真4枚、Instagramリール、FAQ8、AIまとめ、cases導線、構造化データ済み |
| 施工事例一覧 | `cursor-test/cases.html` | 新規。リール4件+写真4枚、CollectionPage JSON-LD、sitemap登録済み |
| FAQ一覧 | `cursor-test/faq.html` | cases・業務LP導線、構造化データ確認済み |
| 南部まとめ | `cursor-test/south.html` | cases・業務LP導線、構造化データ確認済み |
| 業務LP | `business-cleaning/index.html` | FAQ7、相談事例・見積り前・料金セクション、Instagram1件（`DMh62EjPcNu`）、構造化データ・sitemap済み |

**検証結果（2026-06-04時点）**

- リッチリザルト / Schema Validator：主要ページでエラーなし
- 警告：LocalBusiness の `image` 任意のみ → 現時点修正不要

**sitemap**

- `business-cleaning/`、`cursor-test/cases.html`、`faq.html`、`south.html` 登録済み

## 本日の主な commit（参照用）

`81d671e` `aad1d9d` `48f0fd5` `5f571f5` `fb5e390` `2e3770a` `3b8456d` `b39244a` `6a68ea9` `ae3cd14` `3d9fde3` `e578881` `339be47` `01fbad5` `c6f0653`  
詳細は status.md の作業ログ表を参照。

## 次回やること（優先順）

1. Search Console で以下を URL検査・インデックス登録リクエスト
   - `https://teruya1229.github.io/business-cleaning/`
   - `https://teruya1229.github.io/cursor-test/cases.html`
   - `https://teruya1229.github.io/cursor-test/faq.html`
   - `https://teruya1229.github.io/cursor-test/south.html`
2. 業務LPの Instagram 埋め込み表示を公開URLで確認（`business-cleaning/`）
3. Search Console の反映状況を確認
4. 業務用施工事例の実写真が増えたら、業務LPまたは別ページ追加を検討
5. Instagramプロフィール / note / Googleビジネスプロフィール → LP 導線を整理

## 次にやるべき1手

- **Search Console** で業務LP（`business-cleaning/`）の URL検査 → インデックス登録リクエストから開始

## 判断基準

- 問題対応・改善作業の進め方は、ルート [`rules.md`](rules.md) の共通ルール（原則ゴール達成型）に従う
- LP本文・CSS・JS・sitemap・Instagram埋め込みは **触らない**（問題が出たときのみ最小修正）
- 沖縄全域対応・必ず直る・最安No.1 などの断定表現は禁止（既存LPルール維持）
- 業務LPは BtoB 文脈維持。民泊清掃を主役にしない
- 未追跡 `business-cleaning/business-clean-parts-optimized.jpg` は add / commit しない

## Search Console 運用（固定）

- ルートプロパティ `https://teruya1229.github.io/` を正とする
- 送るサイトマップは `/sitemap.xml` のみ
- URL検査は実URL（`/cursor-test/` 配下・`/business-cleaning/` など）で行う

## 注意点

- ローカル正本パス：`C:\dev\bc-service\teruya1229-github-io`
- 電工プロジェクト文脈は混ぜない
- 破壊系 git コマンド禁止（rm / del / git reset / git clean / git restore など）
- 2026-04-15 の家庭LP「LINE優先・電話一時停止」はそのまま維持

## 使い方（新チャット1発目）

```
前提は status.md → handoff.md の順で読んで進めてください。
LPコードは一区切り。次は Search Console と外部導線整理が優先です。
```
