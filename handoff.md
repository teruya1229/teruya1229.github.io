更新日: 2026-06-10

## 前提（読む順）

1. **status.md**（進捗の正本）を先に読む
2. 本ファイル（handoff / 引継ぎの正本）で次の1手を確認
3. 問題対応の進め方：**ルート [`rules.md`](rules.md)**（ゴール達成型 / ピンポイント修正型 / /goal診断型）
4. 公開版参照（任意）：`https://teruya1229.github.io/ops/status/` / `https://teruya1229.github.io/ops/handoff/`

## フェーズ

- **浦添市家庭LP `urasoe.html` 公開確認OK（2026-06-10）**：市町村別LPの1本目。南部・中部の橋渡しページ。内部リンク・sitemap追加済み（`a1b329b`）
- **composer-2.5 + ゴール達成型プロンプト検証完了（2026-06-10）**：新規LP作成〜commit/pushまで再現性あり。今後のLP量産はゴール達成型を基本にする
- **中部家庭LP `central.html` 公開準備完了**（新規作成・公開前調整・sitemap・南部LPからの内部リンク・本番微調整まで push 済み）
- **広告番頭MVP 作成・検証完了（2026-06-10）**：Google広告開始前の採算確認用。内部確認用ページとしてLPから分離。**表示確認・入力テスト済みで運用開始可能**
- **広告開始前チェック・LP debug CTA確認 最終確認完了（2026-06-10）**：Google広告小額テスト開始可能
- **完全分解LP LINE相談優先文面 追加完了（2026-06-10）**：ヒーロー・PCヘッダーに補足文追加。電話番号・CTA・GA4・debugは維持（`f7a2195`）
- **Search Console は対応済み → 反映待ち確認フェーズ**（再送信・再リクエストは不要。時間を置いてインデックス状況を確認）
- 新規 LP コード修正は、公開確認で問題が出た場合のみ
- 市町村別ページ量産は **浦添LPの表示確認・Search Console反映・問い合わせ導線確認後** に進む

## 固定URL（変更禁止）

- LINE（正）：`https://lin.ee/tsilra6`
- Airリザーブ：`https://airrsv.net/bc-servicesokinawa/calendar`
- 家庭LP（南部）：`https://teruya1229.github.io/cursor-test/`
- 家庭LP debug：`https://teruya1229.github.io/cursor-test/?debug=1`
- **中部家庭LP（新）：`https://teruya1229.github.io/cursor-test/central.html`**
- **浦添市家庭LP（新）：`https://teruya1229.github.io/cursor-test/urasoe.html`**
- 完全分解LP（正）：`https://teruya1229.github.io/complete-disassembly/`
- 完全分解LP debug：`https://teruya1229.github.io/complete-disassembly/?debug=1`
- 広告番頭（内部用）：`https://teruya1229.github.io/ops/ad-bantou/`
- 業務LP：`https://teruya1229.github.io/business-cleaning/`
- 施工事例一覧：`https://teruya1229.github.io/cursor-test/cases.html`

## 現在の状態（要約）

| ページ | パス | 状態 |
|--------|------|------|
| 家庭LP（南部） | `cursor-test/index.html` | FAQ9 + JSON-LD、AIまとめ、Instagram事例、cases導線、構造化データ済み。LINE優先・電話一時停止は維持。**中部LPへの内部リンク2箇所・浦添LPへの内部リンク1箇所追加済み** |
| **中部家庭LP** | `cursor-test/central.html` | **2026-06-09 新規作成・公開確認済み**。スマホ固定CTA / build表示 / 南城市表現 / ナビ / 料金表調整済み。FAQ9 + JSON-LD、構造化データ、GA4 `central_lp` 計測済み。ルート sitemap 登録済み。**浦添LPへの内部リンク1箇所追加済み** |
| **浦添市家庭LP** | `cursor-test/urasoe.html` | **2026-06-10 新規作成・公開確認OK**（`a1b329b`、composer-2.5 + ゴール達成型）。南部・中部・那覇方面の中間エリア。市町村別LP1本目。FAQ5 + JSON-LD、構造化データ、GA4 `urasoe_lp` 計測済み。ルート sitemap 登録済み。南部LP・中部LPから導線あり |
| 完全分解LP | `complete-disassembly/index.html` | 写真4枚、Instagramリール、FAQ8、AIまとめ、cases導線、構造化データ済み。**2026-06-10：LINE相談優先補足文追加**（ヒーロー・PCヘッダー。スマホはヒーローのみ） |
| 施工事例一覧 | `cursor-test/cases.html` | リール4件+写真4枚、CollectionPage JSON-LD、sitemap登録済み |
| FAQ一覧 | `cursor-test/faq.html` | cases・業務LP導線、構造化データ確認済み |
| 南部まとめ | `cursor-test/south.html` | cases・業務LP導線、構造化データ確認済み |
| 業務LP | `business-cleaning/index.html` | FAQ7、相談事例・見積り前・料金セクション、Instagram1件（`DMh62EjPcNu`）、構造化データ・sitemap済み |
| **広告番頭MVP** | `ops/ad-bantou/`（index.html / style.css / app.js） | **2026-06-10 新規作成・検証完了**（`0a058bb`）。日次入力・自動計算・自動判定（継続/改善/停止候補/データ不足）・日別ログ・LP別集計・**広告開始前チェック**（`bcAdBantouPreflightChecks`）。localStorage（`bcAdBantouDailyLogs`）。noindex・sitemap未登録・既存LPからの導線なし。**公開URLでの表示確認・テスト入力・再読み込み復元・広告開始前チェック最終確認まで全項目OK。Google広告小額テスト開始可能** |

**中部LP 対応エリア**

沖縄市 / うるま市 / 北谷町 / 嘉手納町 / 読谷村 / 宜野湾市 / 北中城村 / 中城村

**浦添市LP 位置づけ・料金（2026-06-10）**

- 南部LPにも中部LPにも含まれない中間エリア。南部LP・中部LPの橋渡しページ
- 料金目安：通常分解 9,000円〜 / 完全分解 15,000円〜 / お掃除機能付き 16,000円〜
- 内部リンク：南部LP・中部LP → 浦添LP。浦添LP → 南部LP・中部LP・完全分解LP・FAQ・施工事例

**composer-2.5 検証結果（2026-06-10）**

- Fable 5 Highの制限後、composer-2.5で浦添LPを実装
- 新規LP作成・内部リンク追加・sitemap追加・GA4・FAQ JSON-LD・commit/pushまで完了
- 結論：高性能モデルだけでなく、**ゴール達成型プロンプト自体に再現性がある**
- 今後のLP量産は、まずゴール達成型で進める方針を継続
- note有料記事への追記候補：「composer-2.5でもゴール達成型が通用した」検証結果

**広告番頭MVP 検証結果（2026-06-10）**

- 確認URL：`https://teruya1229.github.io/ops/ad-bantou/`
- ページ表示 / 注意表示 / 入力フォーム / 自動計算 / 判定 / 日別ログ / LP別集計 / localStorage 復元：すべてOK
- テスト入力（家庭LP・広告費1,000円・成約1・売上8,000円）→ CTR 4.0% / CPA 1,000円 / ROAS 8.00 / 判定「継続」と正しく算出
- 総合判断：重大な不具合なし。MVPとして公開・運用開始可能
- 軽微な気になり点（必須修正ではない）：日別ログのメモ列が省略表示される程度

**広告開始前チェック 最終確認完了（2026-06-10）**

- 確認対象：広告番頭 / 完全分解LP debug（`?debug=1`）
- 広告番頭 表示OK / 広告開始前チェック 表示OK
- 家庭LPチェック4項目（ページ表示 / LINE CTA / Airリザーブ CTA / 表示崩れ）正常。電話CTAは現行LP非表示のため対象外
- 完全分解LPチェック4項目（ページ表示 / LINE CTA / 電話CTA / 表示崩れ）正常
- 完全分解LP debug：電話CTA・LINE CTA とも外部遷移なし、「計測OK」トースト表示OK
- 全項目ONで「広告開始OK」判定 / 保存 / 再読み込み後の履歴保持OK
- 日次入力・日別ログ・LP別集計への影響なし
- **総合判断：Google広告開始前の最低限チェック完了。追加修正なしで小額テスト開始可能**
- 軽微な気になり点（必須修正ではない）：トースト表示時間が短い。必要なら後日改善

**完全分解LP LINE相談優先文面 追加完了（2026-06-10）**

- 対象：`complete-disassembly/index.html`（`f7a2195`）
- 公開URL：`https://teruya1229.github.io/complete-disassembly/`
- ヒーローLINEボタン下：写真を送れるLINE相談がおすすめ／型番・設置状況・汚れ具合確認後に目安料金案内
- PCヘッダー電話番号下：作業中は電話に出られない場合あり／LINE相談がスムーズ
- スマホ：ヘッダー補足非表示、ヒーロー補足のみ
- 電話番号・LINE URL・CTA文言・GA4 `cta_click`・debug処理・sitemap：変更なし

**検証結果（2026-06-09時点）**

- 中部LP：公開確認済み（スマホCTA・ナビ・料金表・FAQ/JSON-LD整合）
- 南部LP・中部LP：`COMMIT: REPLACE_ME` build 表示削除済み、電気工事士表記更新済み
- リッチリザルト / Schema Validator：主要ページでエラーなし（2026-06-04時点の確認を継承）
- 警告：LocalBusiness の `image` 任意のみ → 現時点修正不要

**sitemap（Search Console 正本）**

- 送信URL：**`https://teruya1229.github.io/sitemap.xml`** のみ
- `cursor-test/central.html` 登録済み（`6741002`）
- `cursor-test/urasoe.html` 登録済み（`a1b329b`）
- `business-cleaning/`、`cursor-test/cases.html`、`faq.html`、`south.html` 登録済み
- `/cursor-test/sitemap.xml` は Search Console に送らない

**運用ルール**

- ルート [`rules.md`](rules.md) に最新3分類ルール（ゴール達成型優先）を正本として反映済み（`bca0a9c`）

## 最近の主な commit

**2026-06-10**

| commit | 内容 |
|--------|------|
| `a1b329b` | 浦添市家庭LP新規作成・内部リンク・sitemap追加（`feat: add Urasoe family aircon LP`） |
| `d09681f` | AI帳票番頭LPにnote記事カード追加 |
| `4c975f0` | 現場業プラスワン研究会LP新規作成 |
| `f7a2195` | 完全分解LP LINE相談優先文面追加（`copy: emphasize LINE consultation on complete disassembly LP`） |
| `c98f3d6` | 広告開始前チェック最終確認の記録（`docs: record ad preflight verification`） |
| `78ae15c` | 広告開始前チェックとLP debug挙動の整合（`fix: align preflight CTA checks with LP behavior`） |
| `4d1654d` | 広告開始前チェック機能追加（`feat: add ad preflight checklist`） |
| `94f0141` | GA4 debug時のCTA外部遷移停止 |
| `0a058bb` | 広告番頭MVP 新規作成（push：`8dbbd5c..0a058bb`） |

**2026-06-09**

| commit | 内容 |
|--------|------|
| `8c43e5a` | 中部LP `central.html` 新規作成 |
| `19f6934` | 中部LP公開前調整 |
| `6741002` | ルート `sitemap.xml` に `central.html` 追加 |
| `7d7a552` | 南部LPから中部LPへの内部リンク追加 |
| `8b18a8a` | debug build表示削除・資格表記更新 |
| `bca0a9c` | 共通ルール最新化（3分類） |
| `ce8bafa` | status 更新 |

詳細は status.md の作業ログを参照。

## 次回やること（優先順）

1. **浦添LPのSearch Console反映状況確認**（再送信・再リクエストは不要）
   - 時間を置いて `https://teruya1229.github.io/cursor-test/urasoe.html` のインデックス反映状況を確認
   - 中部LP `central.html` の反映状況もあわせて確認
2. **浦添LPのスマホ実機確認**
   - ヒーロー・固定CTA・料金カード：`https://teruya1229.github.io/cursor-test/urasoe.html`
3. **那覇LPとの相互導線確認**（必要なら `naha.html` → 浦添LP）
4. **市町村別LP量産の判断**（上記確認後）
   - 問題なければ沖縄市 / 宜野湾市 / うるま市などへ進む
   - ゴール達成型プロンプトを基本にする（composer-2.5検証で再現性確認済み）
5. **note有料記事への追記**
   - 「composer-2.5でもゴール達成型が通用した」検証結果を追記
6. **Google広告の小額テスト設計**（表示確認OKなら進む）
7. **広告番頭への日次入力運用**

**次の実作業候補（急がない）**

- 広告番頭：トースト表示時間の延長（必要なら）
- 沖縄市ページ / 宜野湾市ページ / うるま市ページの量産（浦添LP確認後）
- 那覇LP `naha.html` から浦添LPへの相互導線
- 業務LPの Instagram 埋め込み表示を公開URLで確認
- Instagramプロフィール / note / Googleビジネスプロフィール → LP 導線を整理

## 次にやるべき1手

- **浦添LPのSearch Console反映状況確認**（`https://teruya1229.github.io/cursor-test/urasoe.html`）。あわせてスマホ実機でヒーロー・固定CTA・料金カードを確認

## 判断基準

- 問題対応・改善作業の進め方は、ルート [`rules.md`](rules.md) の共通ルール（原則ゴール達成型）に従う
- LP本文・CSS・JS・sitemap・Instagram埋め込みは **触らない**（問題が出たときのみ最小修正）
- 沖縄全域対応・必ず直る・最安No.1 などの断定表現は禁止（既存LPルール維持）
- 業務LPは BtoB 文脈維持。民泊清掃を主役にしない
- 未追跡 `business-cleaning/business-clean-parts-optimized.jpg` は add / commit しない
- 広告番頭 `ops/ad-bantou/` は内部確認用。sitemap に登録しない・既存LPから導線を貼らない・個人情報を入力しない

## Search Console 運用（固定）

- ルートプロパティ `https://teruya1229.github.io/` を正とする
- 送るサイトマップは **`https://teruya1229.github.io/sitemap.xml`** のみ
- URL検査は実URL（`/cursor-test/central.html` など）で行う
- sitemap 送信・URL検査・インデックス登録リクエストは **実施済みの場合は再実行しない**。反映待ち確認を優先

## 注意点

- ローカル正本パス：`C:\dev\bc-service\teruya1229-github-io`
- 電工プロジェクト文脈は混ぜない
- 破壊系 git コマンド禁止（rm / del / git reset / git clean / git restore など）
- 2026-04-15 の家庭LP「LINE優先・電話一時停止」はそのまま維持

## 使い方（新チャット1発目）

```
前提は status.md → handoff.md → rules.md の順で読んで進めてください。
浦添市家庭LP urasoe.html は 2026-06-10 に公開確認OK（a1b329b）。市町村別LP1本目。
composer-2.5 + ゴール達成型プロンプトでLP作成〜commit/pushまで再現性あり。今後の量産はゴール達成型を基本にする。
Search Console は時間を置いて反映確認。再送信・再リクエストは不要。
広告開始前チェック・LP debug CTA確認は 2026-06-10 に最終確認完了。Google広告小額テスト開始可能です。
```
