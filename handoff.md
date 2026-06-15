更新日: 2026-06-15

## 前提（読む順）

1. **status.md**（進捗の正本）を先に読む
2. 本ファイル（handoff / 引継ぎの正本）で次の1手を確認
3. 問題対応の進め方：**ルート [`rules.md`](rules.md)**（ゴール達成型 / ピンポイント修正型 / /goal診断型）
4. 公開版参照（任意）：`https://teruya1229.github.io/ops/status/` / `https://teruya1229.github.io/ops/handoff/`

## フェーズ

**制作中心 → 運用・計測・回収フェーズへ移行（2026-06-11）**

- **南部7市町村LP 刷新・公開確認完了**：南城市・豊見城市・八重瀬町・与那原町・南風原町・糸満市・那覇市の7本が現行標準で揃った
- **糸満市LP `itoman.html` 既存刷新・公開確認OK（2026-06-11）**：URL維持（`b20fb1a`）。FAQ8問とJSON-LD8問を一致。LP内記事「南部商圏・大里拠点」あり
- **那覇市LP `naha.html` 既存刷新・公開確認OK（2026-06-11）**：URL維持（`9776372`）。FAQ8問とJSON-LD8問を一致。LP内記事「駐車場・搬入・事前確認」あり。那覇専用ブログは作らず
- **南風原町LP `haebaru.html` 既存刷新・公開確認OK（2026-06-10）**：URL維持（`7098e05` / `e0614ac` / `ab4f1f5` / `5b4949f`）
- **与那原町LP `yonabaru.html` 既存刷新・公開確認OK（2026-06-10）**：URL維持（`9e74947`）
- **八重瀬町LP `yaese.html` 既存刷新・公開確認OK（2026-06-10）**：URL維持（`d4c299a`）
- **豊見城市LP `tomigusuku.html` 既存刷新・公開確認OK（2026-06-10）**：URL維持（`8322aba` / `b73db60`）
- **南城市LP `nanjo.html` 既存刷新・公開確認OK（2026-06-10）**：URL維持（`dbc94e3`）
- **価格帯の整理**：南部7市町村は 8,000 / 14,000 / 15,000円。浦添市LP・中部家庭LPは 9,000円〜の独立価格帯
- **市町村別LPは都度SEO調査してから判断**（新規作成か既存刷新か）。SERP詳細は長期正本に残さない
- **浦添市家庭LP `urasoe.html` 公開確認OK（2026-06-10）**：南部・中部の橋渡しページ（`a1b329b`）
- **ゴール達成型プロンプト検証完了**：新規作成・既存刷新ともに再現性あり
- **中部家庭LP `central.html` 公開準備完了**
- **広告番頭MVP 作成・検証完了（2026-06-10）**：**表示確認・入力テスト済みで運用開始可能**
- **広告開始前チェック・LP debug CTA確認 最終確認完了（2026-06-10）**：Google広告小額テスト開始可能
- **Google広告 初期設定チェッカー追加済み（2026-06-12実装 / 2026-06-15最終確認）**：ブラウザー番頭の確認手順（LP CTA debug確認）は広告開始前チェックとして広告番頭へ統合済み。完全分解・AI帳票番頭の専用テンプレート、LP URL照合、4状態チェック、完了率・次の一手・履歴保存対応済み。日次入力にAI帳票番頭LP追加済み。localStorageのみ（`bcAdBantouCampaignSetupChecks`）。Google Ads API・GA4 API連携は未実装。実装コミット：`0ef2aae7d8da9197094b1ef389a88f07aabe9ab9`
- **ブラウザー番頭JSON読み込み追加済み（2026-06-15）**：広告番頭の「今日の入力」に `adBantouDailyInput` 貼り付け反映UIを追加。反映のみ（自動保存なし）。完全分解LP・AI帳票番頭LP対応。
- **21時チェック簡略化（2026-06-15）**：`browser-bantou/run-daily-check.bat` で2キャンペーン連続確認→一括JSON→クリップボード→広告番頭起動。広告番頭は daily-check 一括JSONのプレビュー反映対応。
- **広告番頭21時チェックUX改善（2026-06-15）**：最上部に専用パネル、クリップボード読込、2件まとめて保存、重複上書き/スキップ、保存後サマリー表示。
- **広告番頭 Phase 1 運用ダッシュボード改善 公開完了（2026-06-15）**：運用ダッシュボード・KPIカード6枚・異常バナー・ログフィルタ・スマホカード表示・最終保存日時・CSS変数整理。commit `c861b45`。新規キー `bcAdBantouLastSaveMeta`。既存3キー・コアロジックは維持。GitHub Pages公開確認済み。Phase 2は未着手。
- **完全分解LP LINE相談優先文面 追加完了（2026-06-10）**（`f7a2195`）
- **Search Console は反映待ち確認フェーズ**（再送信・再リクエストは不要）
- **新規 LP コード修正は急がない**。データを見て必要な地域だけ行う
- **今後の優先**：広告日次運用 / 広告番頭入力 / GA4 CTA反応 / 問い合わせ実績の蓄積

## 固定URL（変更禁止）

- LINE（正）：`https://lin.ee/tsilra6`
- Airリザーブ：`https://airrsv.net/bc-servicesokinawa/calendar`
- 家庭LP（南部）：`https://teruya1229.github.io/cursor-test/`
- 家庭LP debug：`https://teruya1229.github.io/cursor-test/?debug=1`
- **中部家庭LP（新）：`https://teruya1229.github.io/cursor-test/central.html`**
- **浦添市家庭LP：`https://teruya1229.github.io/cursor-test/urasoe.html`**
- **南城市LP（刷新）：`https://teruya1229.github.io/cursor-test/nanjo.html`**
- **豊見城市LP（刷新）：`https://teruya1229.github.io/cursor-test/tomigusuku.html`**
- **八重瀬町LP（刷新）：`https://teruya1229.github.io/cursor-test/yaese.html`**
- **与那原町LP（刷新）：`https://teruya1229.github.io/cursor-test/yonabaru.html`**
- **南風原町LP（刷新）：`https://teruya1229.github.io/cursor-test/haebaru.html`**
- **糸満市LP（刷新）：`https://teruya1229.github.io/cursor-test/itoman.html`**
- **那覇市LP（刷新）：`https://teruya1229.github.io/cursor-test/naha.html`**
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
| **南城市LP** | `cursor-test/nanjo.html` | **2026-06-10 既存刷新・公開確認OK**（`dbc94e3`、ゴール達成型）。本拠地大里・南部応援価格8,000円/完全分解14,000円。FAQ8 + JSON-LD一致、構造化データ、GA4 `nanjo_lp` 計測済み。sitemap `lastmod` 更新のみ |
| **豊見城市LP** | `cursor-test/tomigusuku.html` | **2026-06-10 既存刷新・公開確認OK**（`8322aba`、ゴール達成型）。軽微修正 `b73db60`。南部応援価格8,000円/完全分解14,000円/お掃除機能付き15,000円。FAQ8 + JSON-LD一致、構造化データ、GA4 `tomigusuku_lp` 計測済み。sitemap `lastmod` 更新のみ。index/south/他LP/ブログから内部リンク済み |
| **八重瀬町LP** | `cursor-test/yaese.html` | **2026-06-10 既存刷新・公開確認OK**（`d4c299a`、ゴール達成型）。東風平・富盛・具志頭・畑・エイサー等の地域訴求を維持。南部応援価格8,000円/完全分解14,000円/お掃除機能付き15,000円。FAQ8 + JSON-LD一致（刷新前13問表示・4問JSON-LD不一致を解消）、構造化データ、GA4 `yaese_lp` 計測済み。sitemap `lastmod` 更新のみ。完全分解LP・cases・関連ブログ3本への導線あり |
| **与那原町LP** | `cursor-test/yonabaru.html` | **2026-06-10 既存刷新・公開確認OK**（`9e74947`、ゴール達成型）。中城湾・潮風・湿気・住宅密集・マンション等の地域訴求を維持。南部応援価格8,000円/完全分解14,000円/お掃除機能付き15,000円。FAQ8 + JSON-LD一致（刷新前6問表示・6問JSON-LD一致）、構造化データ、GA4 `yonabaru_lp` 計測済み。sitemap `lastmod` 更新のみ。完全分解LP・cases・`yonabaru-sea-wind` への導線あり |
| **南風原町LP** | `cursor-test/haebaru.html` | **2026-06-10 既存刷新・公開確認OK**（`7098e05`、ゴール達成型）。軽微修正 `e0614ac` / `ab4f1f5` / `5b4949f`。那覇近接・住宅密集・共働き・交通粉塵・湿気・結露・カビ・新築マンション等の地域訴求を維持。南部応援価格8,000円/完全分解14,000円/お掃除機能付き15,000円。FAQ8 + JSON-LD一致（刷新前6問表示・6問JSON-LD一致）、構造化データ、GA4 `haebaru_lp` 計測済み。sitemap `lastmod` 更新のみ。完全分解LP・cases・関連ブログ2本への導線あり |
| **糸満市LP** | `cursor-test/itoman.html` | **2026-06-11 既存刷新・公開確認OK**（`b20fb1a`、ゴール達成型）。海風・潮風・湿気・西崎/潮崎/兼城/真栄里・戸建て/団地/マンション等の地域訴求を維持。LP内記事「南部商圏・大里拠点」。南部応援価格8,000円/完全分解14,000円/お掃除機能付き15,000円。FAQ8 + JSON-LD一致、構造化データ、GA4 `itoman_lp` 計測済み。sitemap `lastmod` 更新のみ。完全分解LP・cases・関連ブログへの導線あり |
| **那覇市LP** | `cursor-test/naha.html` | **2026-06-11 既存刷新・公開確認OK**（`9776372`、ゴール達成型）。マンション・アパート・駐車場・搬入・新都心/小禄/首里等の地域訴求を維持。LP内記事「駐車場・搬入・事前確認」。南部応援価格8,000円/完全分解14,000円/お掃除機能付き15,000円。FAQ8 + JSON-LD一致（刷新前6問表示・6問JSON-LD）、構造化データ、GA4 `naha_lp` 計測済み。sitemap `lastmod` 更新のみ。完全分解LP・cases・浦添LPへの導線あり。那覇専用ブログなし |
| **浦添市家庭LP** | `cursor-test/urasoe.html` | **2026-06-10 新規作成・公開確認OK**（`a1b329b`、ゴール達成型）。南部・中部・那覇方面の中間エリア。9,000円〜の独立価格帯。FAQ5 + JSON-LD、構造化データ、GA4 `urasoe_lp` 計測済み。ルート sitemap 登録済み。南部LP・中部LPから導線あり |
| 完全分解LP | `complete-disassembly/index.html` | 写真4枚、Instagramリール、FAQ8、AIまとめ、cases導線、構造化データ済み。**2026-06-10：LINE相談優先補足文追加**（ヒーロー・PCヘッダー。スマホはヒーローのみ） |
| 施工事例一覧 | `cursor-test/cases.html` | リール4件+写真4枚、CollectionPage JSON-LD、sitemap登録済み |
| FAQ一覧 | `cursor-test/faq.html` | cases・業務LP導線、構造化データ確認済み |
| 南部まとめ | `cursor-test/south.html` | cases・業務LP導線、構造化データ確認済み |
| 業務LP | `business-cleaning/index.html` | FAQ7、相談事例・見積り前・料金セクション、Instagram1件（`DMh62EjPcNu`）、構造化データ・sitemap済み |
| **広告番頭MVP** | `ops/ad-bantou/`（index.html / style.css / app.js） | **2026-06-10 新規作成**（`0a058bb`）。**2026-06-15 Phase 1 ダッシュボード改善公開完了**（`c861b45`）：運用ダッシュボード・KPI・異常バナー・ログフィルタ・スマホカード・最終保存日時。日次入力・自動計算・判定・日別ログ・LP別集計・21時チェック・browser-bantou JSON・広告開始前チェック・初期設定チェッカー。localStorage（`bcAdBantouDailyLogs` / `bcAdBantouPreflightChecks` / `bcAdBantouCampaignSetupChecks` / `bcAdBantouLastSaveMeta`）。noindex・sitemap未登録。**Google Ads API・GA4 API連携は未実装** |

**中部LP 対応エリア**

沖縄市 / うるま市 / 北谷町 / 嘉手納町 / 読谷村 / 宜野湾市 / 北中城村 / 中城村

**浦添市LP 位置づけ・料金（2026-06-10）**

- 南部LPにも中部LPにも含まれない中間エリア。南部LP・中部LPの橋渡しページ
- 料金目安：通常分解 9,000円〜 / 完全分解 15,000円〜 / お掃除機能付き 16,000円〜
- 内部リンク：南部LP・中部LP → 浦添LP。浦添LP → 南部LP・中部LP・完全分解LP・FAQ・施工事例

**南城市LP 刷新結果（2026-06-10）**

- 対象：`cursor-test/nanjo.html`（`dbc94e3`）。公開URL維持
- 新規作成ではなく既存刷新が正解（SEO調査の判断結果。SERP詳細は正本に残さない）
- ヒーロー・CTA・GA4・JSON-LD・FAQ整合・完全分解LP/cases導線を現行標準に合わせて整備
- 公開確認OK（表示・固定CTA・LINE・Airリザーブ・FAQ・build表示なし）

**南部7市町村LP 完了状態（2026-06-11）**

- 南城市 `nanjo.html` / 豊見城市 `tomigusuku.html` / 八重瀬町 `yaese.html` / 与那原町 `yonabaru.html` / 南風原町 `haebaru.html` / 糸満市 `itoman.html` / 那覇市 `naha.html` — すべて刷新・公開確認済み
- 共通：既存URL維持 / 8,000 / 14,000 / 15,000円 / LINE + Airリザーブ / GA4 page_type / CTA計測 / JSON-LD4種 / FAQ8問一致 / 完全分解LP・cases導線 / LINE優先 / スマホ固定CTA
- 浦添市LP（9,000円〜）・中部家庭LP（9,000円〜）とは価格帯を分けて維持

**糸満市LP 刷新結果（2026-06-11）**

- 対象：`cursor-test/itoman.html`（`b20fb1a`）。公開URL：`https://teruya1229.github.io/cursor-test/itoman.html`
- 新規作成ではなく既存刷新が正解（着手前調査の判断結果。SERP詳細は正本に残さない）
- 糸満市固有コンテンツ（海風・潮風・湿気・塩分・漁港・農地粉塵・西崎/潮崎/兼城/真栄里・戸建て/団地/マンション等）を維持しつつ、haebaru刷新済み標準に合わせて整備
- LP内記事：「糸満市も南部商圏。南城市大里拠点だから動きやすいエリアです」。移動効率の話として訴求（他社批判なし）
- FAQ：刷新後8問表示・8問JSON-LD一致
- 公開確認OK（2026-06-11）：表示・PCヒーロー改行・料金3プラン・LINE11箇所・Airリザーブ2箇所・固定CTA・FAQ・導線・`?debug=1`計測・build表示なし・電話導線なし

**那覇市LP 刷新結果（2026-06-11）**

- 対象：`cursor-test/naha.html`（`9776372`）。公開URL：`https://teruya1229.github.io/cursor-test/naha.html`
- 新規作成ではなく既存刷新が正解（着手前調査の判断結果。SERP詳細は正本に残さない）
- 那覇市固有コンテンツ（マンション・アパート・駐車場・搬入・新都心/小禄/首里/真嘉比/泊/安謝/壺川/古波蔵・お掃除機能付き需要等）を維持しつつ、itoman刷新済み標準に合わせて整備
- LP内記事：「那覇市のエアコンクリーニングは、駐車場・搬入まで含めた事前確認が大切です」。コインパーキング確認は追加料金を煽らない表現
- 価格：南部応援価格 8,000 / 14,000 / 15,000円を維持（サイト全体整合）。那覇だけ価格変更は行っていない
- FAQ：刷新前6問表示・6問JSON-LD一致 → 刷新後8問表示・8問JSON-LD一致
- 公開確認OK（2026-06-11）：表示・PCヒーロー改行・スマホ固定CTA・料金3プラン・LINE・Airリザーブ・FAQ・駐車場/お掃除機能付き/完全分解FAQ・導線・build表示なし・電話導線なし

**南風原町LP 刷新結果（2026-06-10）**

- 対象：`cursor-test/haebaru.html`（`7098e05`）。公開URL：`https://teruya1229.github.io/cursor-test/haebaru.html`
- 新規作成ではなく既存刷新が正解（着手前調査の判断結果。SERP詳細は正本に残さない）
- 南風原町固有コンテンツ（那覇近接・住宅密集・共働き・交通粉塵・湿気・結露・カビ・新築マンション・室内干し・子どもの咳等）を維持しつつ、yonabaru/yaese刷新済み標準に合わせて整備
- FAQ：刷新前6問表示・6問JSON-LD一致 → 刷新後8問表示・8問JSON-LD一致。住宅密集地の汚れ・駐車場/マンション対応を追加
- 軽微修正：ヒーローサブコピー短縮（`e0614ac`）、スマホ固定CTA文言短縮・CSS調整（`ab4f1f5` / `5b4949f`）。`.fixed-line-cta-text` に `flex: 1; white-space: nowrap;` を適用
- 公開確認OK（表示・固定CTA・PCヒーロー改行・LINE・Airリザーブ・FAQ・導線・build表示なし・電話導線なし）

**与那原町LP 刷新結果（2026-06-10）**

- 対象：`cursor-test/yonabaru.html`（`9e74947`）。公開URL：`https://teruya1229.github.io/cursor-test/yonabaru.html`
- 新規作成ではなく既存刷新が正解（着手前調査の判断結果。SERP詳細は正本に残さない）
- 与那原町固有コンテンツ（中城湾・潮風・湿気・塩分・住宅密集・結露カビ・那覇・西原アクセス・子育て世帯・マンション等）を維持しつつ、yaese/tomigusuku刷新済み標準に合わせて整備
- FAQ：刷新前6問表示・6問JSON-LD一致 → 刷新後8問表示・8問JSON-LD一致。潮風・マンション駐車場・完全分解・LINE写真相談を整備
- 公開確認OK（表示・固定CTA・PCヒーロー改行・LINE・Airリザーブ・FAQ・導線・build表示なし）

**八重瀬町LP 刷新結果（2026-06-10）**

- 対象：`cursor-test/yaese.html`（`d4c299a`）。公開URL：`https://teruya1229.github.io/cursor-test/yaese.html`
- 新規作成ではなく既存刷新が正解（着手前調査の判断結果。SERP詳細は正本に残さない）
- 八重瀬町固有コンテンツ（東風平・富盛・具志頭・畑・エイサー・新築1〜2年相談・子育て家庭等）を維持しつつ、nanjo/tomigusuku刷新済み標準に合わせて整備
- FAQ：刷新前13問表示・4問JSON-LD不一致 → 刷新後8問表示・8問JSON-LD一致。富盛・エイサー・畑関連は本文へ集約
- 公開確認OK（表示・固定CTA・PCヒーロー改行・LINE・Airリザーブ・FAQ・導線・build表示なし）

**豊見城市LP 刷新結果（2026-06-10）**

- 対象：`cursor-test/tomigusuku.html`（`8322aba`）。公開URL維持
- 新規作成ではなく既存刷新が正解（着手前調査の判断結果。SERP詳細は正本に残さない）
- 豊見城市固有コンテンツ（新築マンション・共働き・室内干し・気密性・マンション対応等）を維持しつつ、nanjo刷新済み標準に合わせて整備
- ヒーロー見出しのPC幅改行を `tomigusuku.html` 内CSSのみで軽微修正（`b73db60`）
- 公開確認OK（表示・固定CTA・LINE・Airリザーブ・FAQ・導線・build表示なし）

**ゴール達成型 検証結果（2026-06-11 更新）**

- 浦添LP新規作成〜南部7市町村LP既存刷新（南城市・豊見城市・八重瀬町・与那原町・南風原町・糸満市・那覇市）まで完了
- 結論：**ゴール達成型プロンプト自体に再現性がある**
- 南部7市町村LP刷新完了により、**制作中心から運用・計測・回収フェーズへ移行**
- LP追加量産は急がず、データを見て必要な地域だけ行う
- note有料記事への追記候補：ゴール達成型による南部7市町村LP刷新の実例

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

**2026-06-10〜11**

| commit | 内容 |
|--------|------|
| `9776372` | 那覇市LP既存刷新（`feat: refresh Naha family aircon LP`） |
| `b20fb1a` | 糸満市LP既存刷新（`feat: refresh Itoman family aircon LP`） |
| `5b4949f` | 南風原町LPスマホ固定CTA CSS再調整（`fix: force Haebaru mobile CTA text nowrap`） |
| `ab4f1f5` | 南風原町LPスマホ固定CTA CSS調整（`fix: improve Haebaru mobile fixed CTA layout`） |
| `e0614ac` | 南風原町LPヒーロー・スマホ固定CTA軽微修正（`fix: adjust Haebaru LP hero and mobile CTA text`） |
| `7098e05` | 南風原町LP既存刷新（`feat: refresh Haebaru family aircon LP`） |
| `9e74947` | 与那原町LP既存刷新（`feat: refresh Yonabaru family aircon LP`） |
| `ef5e688` | 南城市LPヤモリ・カバー内汚れの地域気づき追記（`feat: add Nanjo gecko aircon dirt insight`） |
| `d4c299a` | 八重瀬町LP既存刷新（`feat: refresh Yaese family aircon LP`） |
| `b73db60` | 豊見城市LPヒーロー見出し改行の軽微修正（`fix: prevent Tomigusuku hero title awkward wrap`） |
| `8322aba` | 豊見城市LP既存刷新（`feat: refresh Tomigusuku family aircon LP`） |
| `e40d4e6` | AI帳票番頭LPに魔法のプロンプトnote記事カード追加 |
| `dbc94e3` | 南城市LP既存刷新（`feat: refresh Nanjo family aircon LP`） |
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

**フェーズ：運用・計測・回収（制作中心から移行済み）**

1. **Google広告の日次運用**（最優先）
   - 毎日21時の広告番頭入力
   - 問い合わせ・成約・売上・CPA・ROASの確認
2. **GA4で地域LP別CTA反応を確認**
   - 南部7市町村LPの `page_type` 別反応を蓄積
   - 完全分解LPへの広告流入と、市町村LPのSEO流入を分けて評価
3. **糸満市・那覇市のSearch Console反映状況確認**（再送信・再リクエストは不要）
4. **南部7市町村LP全体のSearch Console反映状況確認**
5. **問い合わせ実績の記録**
   - 問い合わせが入った地域・検索語句・作業内容を記録
   - 反応がある地域を優先して記事・施工事例を追加
6. **新しいLP制作は急がない**
   - 次の候補は、データを見て中部市町村LPまたは地域記事を判断
7. **南城市LPヤモリ・虫追記（`ef5e688`）の公開確認**（必要なら記録を補足）
8. **note有料記事への追記候補**
   - ゴール達成型による南部7市町村LP刷新の実例

**次の実作業候補（急がない）**

- 広告番頭：トースト表示時間の延長（必要なら）
- 中部市町村LPまたは地域記事（データを見て判断）
- 業務LPの Instagram 埋め込み表示を公開URLで確認
- Instagramプロフィール / note / Googleビジネスプロフィール → LP 導線を整理

## 次にやるべき1手

- **ユーザー本人のChromeで広告番頭の実データ表示を確認する**（KPI・異常バナー・ログ一覧）。その後、毎日21時の日次入力で問い合わせ・成約・CPA・ROASを確認する

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
前提は status.md → handoff.md → rules.md の順で読んで進んでください。
南部7市町村LP（南城市・豊見城市・八重瀬町・与那原町・南風原町・糸満市・那覇市）は刷新・公開確認完了（2026-06-11）。
糸満市LP itoman.html は既存刷新・公開確認OK（b20fb1a）。那覇市LP naha.html は既存刷新・公開確認OK（9776372）。
制作中心から運用・計測・回収フェーズへ移行済み。LP追加量産は急がず、広告運用・GA4・問い合わせ実績を優先。
浦添市LP urasoe.html は9,000円〜の独立価格帯。中部家庭LP central.html も9,000円〜。南部7市町村は8,000/14,000/15,000円。
市町村別LPは都度SEO調査してから判断。SERP詳細は正本に残さない。
広告開始前チェック・LP debug CTA確認は 2026-06-10 に最終確認完了。Google広告小額テスト開始可能です。
次の優先：広告日次運用 / 毎日21時の広告番頭入力 / GA4地域LP別CTA反応 / Search Console反映確認。
```
