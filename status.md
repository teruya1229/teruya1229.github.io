更新日: 2026-06-15

## 本日やったこと

### 2026-06-15（21時チェック簡略化）

ブラウザー番頭に `run-daily-check.bat` / `run-daily-check.mjs` を追加。完全分解・AI帳票番頭を順番に read-only 実行し、一括JSONを `output/daily-check-latest.json` へ保存。Windows ではクリップボードコピーと広告番頭URL自動起動。広告番頭は一括JSON（daily-check）のプレビュー・1件ずつフォーム反映に対応。

### 2026-06-15（広告番頭：ブラウザー番頭JSON読み込み）

広告番頭 `ops/ad-bantou/` に、ブラウザー番頭の出力JSON（`adBantouDailyInput`）を貼り付けて「今日の入力」フォームへ反映するUIを追加。反映のみで自動保存はしない（既存の保存ボタンで保存）。localStorageキーは追加なし。

### 2026-06-15（広告番頭：Google広告 初期設定チェッカー 最終確認）

広告番頭 `ops/ad-bantou/` の Google広告 初期設定チェッカーを最終確認。本体は `0ef2aae` で実装済み。公開URL・コード・localStorageキーを確認し、追加修正は不要と判断。公開用 `ops/status/` / `ops/handoff/` ページを最新化。

**【確認結果】**

- Google広告 初期設定チェッカー：実装済み・公開URLで表示確認OK
- ブラウザー番頭の確認手順（LP CTA debug確認）は広告開始前チェックとして広告番頭へ統合済み
- 完全分解広告・AI帳票番頭広告の専用テンプレート対応済み
- LP URL照合（末尾スラッシュ許容）対応済み
- 4状態チェック、完了率、次の一手、履歴保存対応済み
- 日次入力へAI帳票番頭LP追加済み
- localStorageのみで保存（`bcAdBantouCampaignSetupChecks`）
- Google Ads API・GA4 API連携は未実装
- 実装コミット：`0ef2aae7d8da9197094b1ef389a88f07aabe9ab9`

**【localStorageキー】**

- `bcAdBantouDailyLogs`（既存・変更なし）
- `bcAdBantouPreflightChecks`（既存・変更なし）
- `bcAdBantouCampaignSetupChecks`（初期設定チェック）

**【公開URL】**

- 広告番頭：`https://teruya1229.github.io/ops/ad-bantou/`

---

### 2026-06-12（広告番頭：Google広告 初期設定チェッカー追加）

広告番頭 `ops/ad-bantou/` に「Google広告 初期設定チェッカー」を追加。Google Ads API・GA4 API連携は未実装。管理画面を手動確認して記録する内部用ツール。

**【追加内容】**

- 完全分解_南部_検索_小額テスト・AI帳票番頭_検索_全国_初期・その他の3キャンペーン選択
- キャンペーン別期待設定テンプレート（LP・入札・予算・コンバージョン・地域・アセット）
- LP URL入力・期待URL比較・末尾スラッシュ許容の自動一致判定
- 4状態チェック（未確認 / OK / NG / 対象外）、完了率・総合判定・次の一手
- 最新結果表示・履歴保存・読込・削除（localStorageキー `bcAdBantouCampaignSetupChecks`）
- 日次入力のLP種別に「AI帳票番頭LP」を追加

**【既存機能への影響】**

- 広告開始前チェック・日次入力・日別ログ・LP別集計・既存localStorageキーは変更なし
- `bcAdBantouDailyLogs` / `bcAdBantouPreflightChecks` は維持

**【公開URL】**

- `https://teruya1229.github.io/ops/ad-bantou/`

---

### 2026-06-11（糸満市LP・那覇市LP 既存刷新・公開確認OK・南部7市町村LP刷新完了・運用フェーズ移行）

糸満市LP `cursor-test/itoman.html` と那覇市LP `cursor-test/naha.html` の既存刷新・公開確認を完了。これにより南部7市町村LPの刷新が一通り揃った。**制作中心から運用・計測・回収フェーズへ移行**する。

**【糸満市LP 刷新完了】**

- 実施日：2026-06-10（刷新）/ 公開確認：2026-06-11
- ファイル：`cursor-test/itoman.html`（新規作成ではなく既存刷新）
- 公開URL：`https://teruya1229.github.io/cursor-test/itoman.html`
- commit hash：`b20fb1a`
- 公開確認：OK
- 新規ファイルなし
- sitemap.xml は `itoman.html` の `lastmod` のみ更新

**【刷新内容】**

- 南部応援価格 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- LINE CTA + Airリザーブ仮予約
- GA4：`page_type: itoman_lp` / `page_slug: /cursor-test/itoman.html`
- CTAクリック計測
- LocalBusiness / Service / BreadcrumbList / FAQPage JSON-LD
- 表示FAQ8問とJSON-LD8問を一致
- 完全分解LP・施工事例 `cases.html`・関連ブログへの導線
- 電話導線を非表示にしてLINE優先
- スマホ固定CTAの折り返し防止CSS

**【糸満市固有コンテンツ】**

- 海風・潮風・湿気・塩分 / 漁港・農地の粉塵 / 西崎・潮崎・兼城・真栄里 / 戸建て・団地・マンション・アパート・新興住宅 / 海沿いと内陸部の汚れ方の違い / 子育て・共働き・高齢世帯 / カビ臭・冷房効き悪化・長期未洗浄

**【LP内記事】**

- 見出し：`糸満市も南部商圏。南城市大里拠点だから動きやすいエリアです`
- 業者によって移動距離を感じられやすい地域であることを、他社批判ではなく移動効率の話として説明
- BCサービスは南城市大里拠点のため、糸満市を南部商圏として対応しやすいと訴求
- LINE相談へ自然につなげた

**【公開確認結果（2026-06-11）】**

- ページ表示正常 / PCヒーロー改行正常 / 料金3プラン正常
- LINEリンク11箇所正常 / Airリザーブ2箇所正常 / 固定CTA正常
- FAQ8問・開閉正常
- 完全分解・施工事例・南部まとめ・FAQ・関連ブログ導線正常
- `?debug=1` の計測挙動正常
- 古いbuild・COMMIT・電話優先表記なし
- 公開継続OK

---

**【那覇市LP 刷新完了】**

- 実施日：2026-06-10（刷新）/ 公開確認：2026-06-11
- ファイル：`cursor-test/naha.html`（新規作成ではなく既存刷新）
- 公開URL：`https://teruya1229.github.io/cursor-test/naha.html`
- commit hash：`9776372`
- 公開確認：OK
- 新規ファイルなし
- sitemap.xml は `naha.html` の `lastmod` のみ更新

**【刷新内容】**

- 南部応援価格 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- LINE CTA + Airリザーブ仮予約
- GA4：`page_type: naha_lp` / `page_slug: /cursor-test/naha.html`
- CTAクリック計測
- LocalBusiness / Service / BreadcrumbList / FAQPage JSON-LD
- 表示FAQ8問とJSON-LD8問を一致
- 完全分解LP・施工事例 `cases.html`・浦添LPなどへの導線
- 電話導線を非表示にしてLINE優先
- スマホ固定CTAの折り返し防止CSS

**【那覇市固有コンテンツ】**

- マンション・アパート・賃貸住宅・集合住宅 / 密閉環境・湿気・カビ / 都市部交通量・排気ガス・微粒子 / 潮風・高湿度 / 共働き・長時間稼働 / お掃除機能付き需要 / 新都心・小禄・首里・真嘉比・泊・安謝・壺川・古波蔵 / 駐車場・コインパーキング・搬入経路 / 子育て家庭・子どもの咳やアレルギー

**【LP内記事】**

- 見出し：`那覇市のエアコンクリーニングは、駐車場・搬入まで含めた事前確認が大切です`
- 駐車場所・建物入口・エレベーター・搬入経路の事前確認を説明
- コインパーキング確認は追加料金を煽るものではなく、当日トラブル防止と説明
- LINE写真相談でエアコン・型番・設置場所・駐車状況を事前確認できる導線
- 南城市大里拠点から南部商圏として対応する方針

**【価格整理】**

- 那覇市も今回は南部応援価格として 8,000 / 14,000 / 15,000円を維持
- `index.html` / `south.html` / `faq.html` / 他市町村LPとの整合を優先
- 駐車場代が必要な場合は事前にLINEで相談する案内を追加
- 那覇だけ価格変更する対応は行っていない

**【公開確認結果（2026-06-11）】**

- ページ表示正常 / PCヒーロー改行正常 / スマホ固定CTA正常 / 料金3プラン正常
- LINE・Airリザーブ正常 / FAQ8問・開閉正常
- 駐車場・お掃除機能付き・完全分解・LINE相談FAQが自然
- 完全分解・施工事例・南部まとめ・FAQ・浦添LP導線正常
- 古いbuild・COMMIT・電話優先表記なし
- 公開継続OK

---

**【南部7市町村LP 刷新完了】**

以下を刷新・公開確認済みとして整理。

| 市町村 | ファイル | 状態 |
|--------|----------|------|
| 南城市 | `nanjo.html` | 刷新・公開確認OK |
| 豊見城市 | `tomigusuku.html` | 刷新・公開確認OK |
| 八重瀬町 | `yaese.html` | 刷新・公開確認OK |
| 与那原町 | `yonabaru.html` | 刷新・公開確認OK |
| 南風原町 | `haebaru.html` | 刷新・公開確認OK |
| 糸満市 | `itoman.html` | 刷新・公開確認OK（`b20fb1a`） |
| 那覇市 | `naha.html` | 刷新・公開確認OK（`9776372`） |

**共通して揃ったもの**

- 既存URL維持 / 地域固有コンテンツ / 8,000 / 14,000 / 15,000円
- LINE + Airリザーブ / GA4 `page_type` / `page_slug` / CTAクリック計測
- LocalBusiness / Service / BreadcrumbList / FAQPage
- 表示FAQとJSON-LD一致 / 完全分解LP・施工事例導線 / LINE優先 / スマホ固定CTA / 公開確認

**価格帯の補足**

- 浦添市LPは9,000円〜の独立価格帯
- 中部家庭LPも9,000円〜
- 南部7市町村とは価格帯を分けて維持する

---

**【フェーズ移行】**

**これまで：** LP新規作成 / 既存市町村LP刷新 / 内部リンク整備 / sitemap更新 / 公開確認

**今後：制作中心から、運用・計測・回収フェーズへ移行**

次の優先事項：

1. Google広告の日次運用
2. 毎日21時の広告番頭入力
3. 問い合わせ・成約・売上・CPA・ROASの確認
4. GA4で地域LP別CTA反応を確認
5. Search Consoleは時間を置いて反映状況を確認
6. 再送信・再リクエストを直後に繰り返さない
7. 地域別の問い合わせ実績を蓄積
8. 実際に反応がある地域を優先して記事・施工事例を追加
9. 完全分解LPへの広告流入と、市町村LPのSEO流入を分けて評価
10. LPの追加量産は、データを見て必要な地域だけ行う

**【地域SEO運用ルール（維持）】**

- 市町村ページ着手前に既存ページ・sitemap・内部リンクを確認
- 既存ページがあれば新規作成せず、既存URL維持の刷新を優先
- SERP・競合・検索量は変動するため、固定情報として詳細保存しない
- 着手時に最新状況を都度確認
- 現場で気づいた地域特性をLPや記事へ反映
- 一般論より現場由来の具体性を重視
- 地域SEOで信頼を取り、完全分解など高単価メニューを広告で獲得する

**【既存仕様への影響】**

- `cursor-test/itoman.html` / `cursor-test/naha.html` / `sitemap.xml` 以外変更なし
- 新規ファイル作成なし

---

### 2026-06-10（南風原町LP 既存刷新・軽微CSS修正・公開確認OK）

既存の南風原町LP `cursor-test/haebaru.html` を、刷新済み南城市LP・豊見城市LP・八重瀬町LP・与那原町LPの現行標準に合わせて刷新。URL維持・既存SEO資産・内部リンク資産を活かす方針で対応。公開確認OK。スマホ固定CTAの軽微CSS修正後、最終表示確認OK。push 済み。

**【南風原町LP 刷新完了】**

- 実施日：2026-06-10
- ファイル：`cursor-test/haebaru.html`（新規作成ではなく既存刷新）
- 公開URL：`https://teruya1229.github.io/cursor-test/haebaru.html`
- commit hash：`7098e05`（刷新）/ `e0614ac`（ヒーロー・スマホ固定CTA軽微修正）/ `ab4f1f5`（固定CTA CSS調整）/ `5b4949f`（固定CTA CSS再調整）
- 公開確認：OK
- 最終表示確認：OK

**【刷新内容】**

- ヒーローを南風原町向けに整理
- 南部応援価格 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円を明確化
- LINE CTA + Airリザーブ CTAを追加・整理
- GA4：`page_type: haebaru_lp` / `page_slug: /cursor-test/haebaru.html`
- CTAクリック計測を現行標準に合わせた
- LocalBusiness / Service / BreadcrumbList / FAQPage JSON-LD を整備
- FAQ表示8問とJSON-LDを一致
- 完全分解LP・施工事例 `cases.html`・関連ブログ2本（`posts/haebaru-humidity-work.html` / `posts/haebaru-condensation.html`）への導線を強化
- sitemap.xml は `haebaru.html` の `lastmod` のみ更新

**【南風原町固有コンテンツ】**

- 那覇近接 / 住宅密集 / 共働き世帯 / 長時間稼働 / 那覇通勤圏 / 国道329号線・県道などの交通量 / 交通粉塵・排気ガス / 湿気 / 結露 / カビ / 新築マンション・アパート / 気密性の高い住宅 / 室内干し・浴室乾燥機 / 新築1〜2年のカビ臭相談 / 子どもの咳・くしゃみ / 南城市大里拠点から近い南部商圏を維持・強化

**【FAQ / JSON-LD整理】**

- 刷新前：表示FAQ6問 / JSON-LD6問で一致
- 刷新後：表示FAQ8問 / JSON-LD8問で完全一致
- 南風原町固有FAQとして「住宅密集地の汚れ」「駐車場が狭い・マンション対応」を追加
- 構造化データを現行標準へ整備

**【公開確認結果】**

- ページ表示正常 / スマホ固定CTA正常 / PC幅ヒーロー見出しの1文字孤立改行なし
- PCヒーローサブコピーの不自然な末尾改行を修正済み
- LINEリンク正常 / Airリザーブリンク正常 / FAQ開閉正常
- 完全分解LP・施工事例・南部まとめ・FAQ・関連ブログ2本への導線正常
- `COMMIT: REPLACE_ME` / build表示なし
- 古い「講習受講予定」表記なし
- 電話導線は表示されず、LINE優先に整理済み
- 公開継続OK

**【軽微修正】**

- スマホ固定CTA文言を短縮（`南風原町 8,000円でLINE予約`）
- ヒーローサブコピーを短縮してPC幅での不自然な末尾改行を解消（`e0614ac`）
- スマホ固定CTAのCSSを調整（`ab4f1f5` / `5b4949f`）
- `.fixed-line-cta .fixed-line-cta-link` 側で `display: flex` を明示
- `.fixed-line-cta .fixed-line-cta-text` に `flex: 1; min-width: 0; white-space: nowrap;` を適用
- `style.css` 側の `.line-cta { display: inline-block }` に負けないよう、詳細度を上げて固定CTA内だけに限定

**【地域SEO運用ルール】**

- 市町村別LPは、着手前に既存ページ有無・内部リンク・sitemap登録状況を確認する
- 既存ページがある場合は、新規作成ではなく既存URL維持の刷新を優先する
- SERP順位・競合状況は変動するため、次地域に着手する前に都度確認する（詳細は正本に残さない）
- 地元・現場で気づいた地域特性は、LPや地域記事に反映していく
- 今回の判断：南風原町は新規作成ではなく既存 `haebaru.html` の刷新が正解だった

**【既存仕様への影響】**

- `index.html` / `nanjo.html` / `tomigusuku.html` / `yaese.html` / `yonabaru.html` / `urasoe.html` / `south.html` / `faq.html` 変更なし
- 新規ファイル作成なし

---

### 2026-06-10（与那原町LP 既存刷新・公開確認OK）

既存の与那原町LP `cursor-test/yonabaru.html` を、刷新済み南城市LP・豊見城市LP・八重瀬町LPの現行標準に合わせて刷新。URL維持・既存SEO資産・内部リンク資産を活かす方針で対応。公開確認OK。push 済み。

**【与那原町LP 刷新完了】**

- 実施日：2026-06-10
- ファイル：`cursor-test/yonabaru.html`（新規作成ではなく既存刷新）
- 公開URL：`https://teruya1229.github.io/cursor-test/yonabaru.html`
- commit hash：`9e74947`
- 公開確認：OK

**【刷新内容】**

- ヒーローを与那原町向けに整理
- 南部応援価格 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円を明確化
- LINE CTA + Airリザーブ CTAを追加・整理
- GA4：`page_type: yonabaru_lp` / `page_slug: /cursor-test/yonabaru.html`
- CTAクリック計測を現行標準に合わせた
- LocalBusiness / Service / BreadcrumbList / FAQPage JSON-LD を整備
- FAQ表示8問とJSON-LDを一致
- 完全分解LP・施工事例 `cases.html`・関連ブログ `posts/yonabaru-sea-wind.html` への導線を強化
- sitemap.xml は `yonabaru.html` の `lastmod` のみ更新（`2026-06-10`）

**【与那原町固有コンテンツ】**

- 中城湾に面した海沿い / 潮風 / 湿気 / 塩分を含んだ湿った空気 / 住宅密集 / コンパクトな町 / 結露とカビの連鎖 / 梅雨〜夏のカビ臭 / 那覇・西原方面へのアクセス / 子育て世帯 / マンション需要 / マンション駐車場の相談 / カビ臭・冷房効き悪化 / フィルター掃除だけでは届かない汚れ / 南城市大里拠点から近い南部商圏を維持・強化

**【FAQ / JSON-LD整理】**

- 刷新前：表示FAQ6問 / JSON-LD6問で一致
- 刷新後：表示FAQ8問 / JSON-LD8問で完全一致
- 与那原町固有FAQとして「潮風の影響」「マンション駐車場」を追加（完全分解・LINE写真相談も整備）
- 構造化データを現行標準へ整備

**【公開確認結果】**

- ページ表示正常 / スマホ固定CTA正常 / PC幅ヒーロー見出しの1文字孤立改行なし
- LINEリンク正常 / Airリザーブリンク正常 / FAQ開閉正常
- 完全分解LP・施工事例・南部まとめ・FAQ・関連ブログへの導線正常
- `COMMIT: REPLACE_ME` / build表示なし
- 古い「講習受講予定」表記なし
- 公開継続OK

**【地域SEO運用ルール】**

- 市町村別LPは、着手前に既存ページ有無・内部リンク・sitemap登録状況を確認する
- 既存ページがある場合は、新規作成ではなく既存URL維持の刷新を優先する
- SERP順位・競合状況は変動するため、次地域に着手する前に都度確認する（詳細は正本に残さない）
- 地元・現場で気づいた地域特性は、LPや地域記事に反映していく
- 今回の判断：与那原町は新規作成ではなく既存 `yonabaru.html` の刷新が正解だった

**【既存仕様への影響】**

- `index.html` / `nanjo.html` / `tomigusuku.html` / `yaese.html` / `urasoe.html` / `south.html` / `faq.html` 変更なし
- 新規ファイル作成なし

---

### 2026-06-10（八重瀬町LP 既存刷新・公開確認OK）

既存の八重瀬町LP `cursor-test/yaese.html` を、刷新済み南城市LP・豊見城市LPの現行標準に合わせて刷新。URL維持・既存SEO資産・内部リンク資産を活かす方針で対応。公開確認OK。push 済み。

**【八重瀬町LP 刷新完了】**

- 実施日：2026-06-10
- ファイル：`cursor-test/yaese.html`（新規作成ではなく既存刷新）
- 公開URL：`https://teruya1229.github.io/cursor-test/yaese.html`
- commit hash：`d4c299a`
- 公開確認：OK

**【刷新内容】**

- ヒーローを八重瀬町向けに整理
- 南部応援価格 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円を明確化
- LINE CTA + Airリザーブ CTAを追加・整理
- GA4：`page_type: yaese_lp` / `page_slug: /cursor-test/yaese.html`
- CTAクリック計測を現行標準に合わせた
- LocalBusiness / Service / BreadcrumbList / FAQPage JSON-LD を整備
- FAQ表示8問とJSON-LDを一致
- 完全分解LP・施工事例 `cases.html`・関連ブログ3本への導線を強化
- sitemap.xml は `yaese.html` の `lastmod` のみ更新（`2026-06-10`）

**【八重瀬町固有コンテンツ】**

- 東風平 / 富盛 / 具志頭 / 畑エリアの砂埃・花粉 / 新興住宅と農地混在 / 湿気とホコリの複合汚れ / 富盛の石彫大獅子 / エイサーシーズンの粉塵 / 新築1〜2年のカビ・粉塵相談 / 共働き世帯・長時間稼働 / 子育て家庭・アレルギー・咳の訴求 / 地元育ち・代表の地域理解を維持・強化

**【FAQ / JSON-LD整理】**

- 刷新前：表示FAQ13問 / JSON-LD4問で不一致
- 刷新後：表示FAQ8問 / JSON-LD8問で完全一致
- 旧FAQの富盛・エイサー・畑関連内容は本文セクションへ集約
- 構造化データ上の不一致リスクを解消

**【公開確認結果】**

- ページ表示正常 / スマホ固定CTA正常 / PC幅ヒーロー見出しの1文字孤立改行なし
- LINEリンク正常 / Airリザーブリンク正常 / FAQ開閉正常
- 完全分解LP・施工事例・南部まとめ・FAQ・関連ブログ3本への導線正常
- `COMMIT: REPLACE_ME` / build表示なし
- 古い「講習受講予定」表記なし
- 公開継続OK

**【地域SEO運用ルール】**

- 市町村別LPは、着手前に既存ページ有無・内部リンク・sitemap登録状況を確認する
- 既存ページがある場合は、新規作成ではなく既存URL維持の刷新を優先する
- SERP順位・競合状況は変動するため、次地域に着手する前に都度確認する（詳細は正本に残さない）
- 地元・現場で気づいた地域特性は、LPや地域記事に反映していく
- 今回の判断：八重瀬町は新規作成ではなく既存 `yaese.html` の刷新が正解だった

**【既存仕様への影響】**

- `index.html` / `nanjo.html` / `tomigusuku.html` / `urasoe.html` / `south.html` / `faq.html` 変更なし
- 新規ファイル作成なし

---

### 2026-06-10（豊見城市LP 既存刷新・軽微修正・公開確認OK）

既存の豊見城市LP `cursor-test/tomigusuku.html` を、刷新済み南城市LPの現行標準に合わせて刷新。URL維持・既存SEO資産・内部リンク資産を活かす方針で対応。PC幅ヒーロー見出しの軽微修正後、公開確認OK。push 済み。

**【豊見城市LP 刷新完了】**

- 実施日：2026-06-10
- ファイル：`cursor-test/tomigusuku.html`（新規作成ではなく既存刷新）
- 公開URL：`https://teruya1229.github.io/cursor-test/tomigusuku.html`
- commit hash：`8322aba`（刷新）/ `b73db60`（ヒーロー見出し改行の軽微修正）
- 公開確認：OK

**【刷新内容】**

- ヒーローを豊見城市向けに整理
- 南部応援価格 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円を明確化
- LINE CTA + Airリザーブ CTAを追加・整理
- GA4：`page_type: tomigusuku_lp` / `page_slug: /cursor-test/tomigusuku.html`
- CTAクリック計測を現行標準に合わせた
- LocalBusiness / Service / BreadcrumbList / FAQPage JSON-LD を整備
- FAQ表示8問とJSON-LDを一致
- 完全分解LP・施工事例 `cases.html`・関連ブログへの導線を強化
- sitemap.xml は `tomigusuku.html` の `lastmod` のみ更新（`2026-06-10`）

**【豊見城市固有コンテンツ】**

- 新築マンション / 戸建て / 共働き世帯 / 室内干し / 気密性の高い住宅 / 新築1〜2年でもカビ臭い相談 / マンション対応 / 子育て家庭向け訴求を維持・強化

**【軽微修正】**

- PC幅1280pxでヒーロー見出し末尾「グ」だけが孤立する改行があったため、`tomigusuku.html` 内CSSのみで最小差分修正（`b73db60`）
- 修正後の公開確認：OK

**【公開確認結果】**

- ページ表示正常 / スマホ固定CTA正常 / LINEリンク正常 / Airリザーブリンク正常 / FAQ開閉正常
- 完全分解LP・施工事例・南部まとめ・FAQ・関連ブログへの導線正常
- `COMMIT: REPLACE_ME` / build表示なし
- 古い「講習受講予定」表記なし
- 公開継続OK

**【地域SEO運用ルール】**

- 市町村別LPは、着手前に既存ページ有無・内部リンク・sitemap登録状況を確認する
- 既存ページがある場合は、新規作成ではなく既存URL維持の刷新を優先する
- SERP順位・競合状況は変動するため、次地域に着手する前に都度確認する（詳細は正本に残さない）
- 今回の判断：豊見城市は新規作成ではなく既存 `tomigusuku.html` の刷新が正解だった

**【既存仕様への影響】**

- `index.html` / `nanjo.html` / `urasoe.html` / `south.html` / `faq.html` 変更なし
- 新規ファイル作成なし

---

### 2026-06-10（南城市LP 既存刷新・公開確認OK）

既存の南城市LP `cursor-test/nanjo.html` を、南部家庭LP・浦添LPの現行標準に合わせて刷新。URL維持・SEO資産・内部リンク資産を活かす方針で対応。公開確認OK。push 済み。

**【南城市LP 刷新完了】**

- 実施日：2026-06-10
- ファイル：`cursor-test/nanjo.html`（新規作成ではなく既存刷新）
- 公開URL：`https://teruya1229.github.io/cursor-test/nanjo.html`
- commit hash：`dbc94e3`
- push：成功 `main -> main`（`e869882..dbc94e3`）
- 公開確認：OK

**【刷新内容】**

- ヒーローを南城市・南城市大里・本拠地訴求へ整理
- 南部応援価格 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円を維持
- LINE CTA + Airリザーブ CTAを追加・整理
- GA4：`page_type: nanjo_lp` / `page_slug: /cursor-test/nanjo.html`
- CTAクリック計測を現行標準（urasoe型）に合わせた
- LocalBusiness / Service / BreadcrumbList / FAQPage JSON-LD を整備
- FAQ表示8問とJSON-LDを一致（旧版は不一致だった）
- 完全分解LP・施工事例 `cases.html` への導線を強化
- sitemap.xml は `nanjo.html` の `lastmod` のみ更新（`2026-06-10`）

**【公開確認結果】**

- ページ表示正常 / スマホ固定CTA正常 / LINEリンク正常 / Airリザーブリンク正常 / FAQ開閉正常
- `COMMIT: REPLACE_ME` / build表示なし
- 古い「講習受講予定」表記なし
- 公開継続OK

**【地域SEO調査の扱い（判断ルール）】**

- 市町村別LPは、作成前にSEO調査・既存LP有無・競合状況を確認してから判断する
- SERP順位・競合名・検索ボリュームは変動するため、長期正本には細かく保存しない
- 今回の判断：南城市は新規作成ではなく既存 `nanjo.html` の刷新が正解だった
- 次地域に着手する前も、その時点で再調査する

**【既存仕様への影響】**

- LINE URL `https://lin.ee/tsilra6` 変更なし
- Airリザーブ URL 変更なし
- `index.html` / `central.html` / `urasoe.html` / `south.html` / `faq.html` 変更なし
- 新規ファイル作成なし

---

### 2026-06-10（浦添市家庭LP 新規作成・公開確認・導線整備完了）

南部LP・中部LPの中間エリアとして、浦添市向け家庭用エアコンクリーニングLPを新規作成し、内部リンク・sitemap追加・公開確認まで完了。composer-2.5 + ゴール達成型プロンプトで実施。push 済み。

**【浦添市家庭LP 作成完了】**

- 実施日：2026-06-10
- ファイル：`cursor-test/urasoe.html`
- 公開URL：`https://teruya1229.github.io/cursor-test/urasoe.html`
- commit hash：`a1b329b`
- 実行モデル：composer-2.5
- push：成功 `main -> main`（`d09681f..a1b329b`）
- 公開確認：OK

**【位置づけ】**

- 南部LPにも中部LPにも含まれていない、南部・中部・那覇方面の中間エリア
- 市町村別LPの1本目として作成
- 南部LP・中部LPの両方からリンクを送る橋渡しページ
- 料金目安：浦添市 通常分解 9,000円〜 / 完全分解 15,000円〜 / お掃除機能付き 16,000円〜
- 設置状況・台数・機種により変動する場合あり

**【追加した内部リンク】**

- 南部LP `cursor-test/index.html` → 浦添LP（対応エリアセクション：「南部以外の近隣エリア」）
- 中部LP `cursor-test/central.html` → 浦添LP（対応エリアセクション：「中部・那覇寄りの近隣エリア」）
- 浦添LP → 南部LP（`./index.html`）・中部LP（`./central.html`）・完全分解LP・FAQ・施工事例

**【sitemap】**

- ルート `sitemap.xml` に `https://teruya1229.github.io/cursor-test/urasoe.html` を追加済み（`a1b329b`）
- 重複なし
- Search Console：必要に応じて時間を置いて反映確認。直後に何度も再送信する必要はない

**【composer-2.5 検証結果】**

- Fable 5 Highの制限後、composer-2.5で浦添LPを実装
- 結果：新規LP作成・内部リンク追加・sitemap追加・GA4計測・FAQ JSON-LD・commit/pushまで完了
- 「高性能モデルだけでなく、ゴール達成型プロンプト自体に再現性がある」と記録
- 今後のLP量産は、まずゴール達成型で進める方針を継続

**【既存仕様への影響】**

- LINE URL `https://lin.ee/tsilra6` 変更なし
- Airリザーブ URL 変更なし
- 南部LP・中部LPの主訴・料金・プラン・FAQ 変更なし（導線1行ずつのみ追加）
- `faq.html` / `south.html` / `complete-disassembly/` 変更なし

---

### 2026-06-10（完全分解LP LINE相談優先文面 追加完了）

完全分解LPで、電話問い合わせよりもLINE相談へ自然に誘導する文面を追加。push 済み。

**【完全分解LP LINE相談優先文面 追加完了】**

- 実施日：2026-06-10
- 対象：`complete-disassembly/index.html`
- 公開URL：`https://teruya1229.github.io/complete-disassembly/`
- commit hash：`f7a2195e82d2c5b50876baabd432d5a80c0f216b`
- push：成功 `main -> main`

**【追加内容】**

- ヒーローのLINEボタン下に補足文を追加
  - 写真を送れるLINE相談がおすすめです。
  - 型番・設置状況・汚れ具合を確認してから、対応可否と目安料金をご案内します。
- PC表示のヘッダー電話番号下に補足文を追加
  - 作業中は電話に出られない場合があります。写真で確認できるLINE相談がスムーズです。
- スマホではヘッダー補足は非表示、ヒーロー補足のみ表示

**【意図】**

- 完全分解は型番・設置状況・汚れ具合・分解可否の確認が必要になりやすいため、写真を送れるLINE相談へ自然に誘導する
- 電話番号・電話CTAは残しつつ、問い合わせ導線としてLINEを優先して見せる

**【既存機能への影響】**

- 電話番号 `tel:05017241338` 変更なし
- LINE URL 変更なし
- CTA文言 変更なし
- GA4イベント名 `cta_click` 変更なし
- debug処理 変更なし
- sitemap 変更なし
- `complete-disassembly/index.html` のみ変更

---

### 2026-06-10（広告開始前チェック 最終確認完了）

広告番頭・広告開始前チェック・LP debug CTA確認の最終確認が完了。**Google広告を小額テスト開始可能な状態**。

**【広告開始前チェック 最終確認完了】**

- 確認日：2026-06-10
- 確認対象：
  - 広告番頭：`https://teruya1229.github.io/ops/ad-bantou/`
  - 完全分解LP debug：`https://teruya1229.github.io/complete-disassembly/?debug=1`
- 確認結果：
  - 広告番頭 表示OK
  - 広告開始前チェック 表示OK
  - 家庭LPチェック項目は4項目で正常
    - ページ表示OK
    - LINE CTA 計測OK
    - Airリザーブ CTA 計測OK
    - 表示崩れなし
  - 家庭LPの電話CTAは現行LPでは非表示のためチェック対象外
  - 完全分解LPチェック項目は4項目で正常
    - ページ表示OK
    - LINE CTA 計測OK
    - 電話CTA 計測OK
    - 表示崩れなし
  - 完全分解LP debug時、電話CTAクリックで外部遷移なし
  - 完全分解LP debug時、電話CTAクリックで「計測OK」トースト表示OK
  - 完全分解LP LINE CTAも「計測OK」確認OK
  - 家庭LP4項目 + 完全分解LP4項目の全ONで「広告開始OK」判定OK
  - チェック結果保存OK
  - 再読み込み後も localStorage で履歴保持OK
  - 日次入力・日別ログ・LP別集計への影響なし

**【総合判断】**

- Google広告開始前の最低限チェックは完了
- 追加修正なしでGoogle広告の小額テスト開始可能
- トースト表示時間が短い点はあるが、機能上は問題なし。必要なら後日改善

**関連 commit（コード・修正）**

| commit | 内容 |
|--------|------|
| `4d1654d` | 広告開始前チェック機能追加（`feat: add ad preflight checklist`） |
| `78ae15c` | 電話CTAチェックとLP debug挙動の整合（`fix: align preflight CTA checks with LP behavior`） |

---

### 2026-06-10（広告番頭MVP 作成完了）

Google広告開始前に使う広告採算確認用MVP「広告番頭」を、公開LPとは分離した内部確認用ページとして新規作成し、push 済み。コード変更はこの新規3ファイルのみで、既存LPへの影響なし。

**作成ファイル・URL**

- `ops/ad-bantou/index.html` / `ops/ad-bantou/style.css` / `ops/ad-bantou/app.js`（新規3ファイル）
- 公開URL：`https://teruya1229.github.io/ops/ad-bantou/`

**実装内容**

- Claude in Chrome が毎日入力しやすい設計（全入力項目に「Claude用：〜」の説明文、作業手順8ステップを画面内に設置）
- 日次入力（日付 / LP種別 / キャンペーン名 / 広告費 / 表示回数 / クリック数 / 平均CPC / CTAクリック / 問い合わせ / 成約 / 売上 / メモ）
- 自動計算（CTR / CTA率 / 問い合わせ率 / 成約率 / CPA / ROAS / 粗利目安。0除算は「—」表示で安全処理）
- 自動判定：**継続 / 改善 / 停止候補 / データ不足**（色＋文字ラベル＋理由文）
- 日別ログ・LP別集計
- 保存：localStorage（専用キー `bcAdBantouDailyLogs`、API移行しやすいJSON配列）
- `noindex, nofollow` 付き・内部確認用ページとして分離
- 既存LP側から広告番頭への導線は追加していない（広告番頭 → LP の片方向リンクのみ）
- 個人情報入力禁止の注意書きを設置（メモ欄にも明記）

**既存LPへの影響**

- cursor-test / complete-disassembly / business-cleaning 等の既存LP変更なし
- sitemap 変更なし
- 既存LP側から広告番頭へのリンク追加なし

**commit / push**

| commit | 内容 |
|--------|------|
| `0a058bb` | 広告番頭MVP 新規作成（`0a058bb7c09b2664660c83298187b2189c2cfe6f`） |

- push：成功 `main -> main`（`8dbbd5c..0a058bb`）

**表示確認・入力テスト完了（2026-06-10）**

- 確認URL：`https://teruya1229.github.io/ops/ad-bantou/`
- 確認結果（すべてOK）：
  - ページ表示 / タイトル「広告番頭」表示
  - 内部確認用・個人情報入力禁止の注意表示
  - 日次入力フォーム / テスト入力
  - 自動計算 / 判定表示
  - 日別ログ保存 / LP別集計反映
  - 再読み込み後も localStorage で保存維持
- テスト入力値：家庭LP / テスト広告 / 広告費1,000円 / 表示回数500 / クリック20 / 平均CPC50円 / CTAクリック3 / 問い合わせ1 / 成約1 / 売上8,000円
- 自動計算結果：CTR 4.0% / CTA率 15.0% / 問い合わせ率 5.0% / 成約率 100.0% / CPA 1,000円 / ROAS 8.00 / 粗利目安 7,000円
- 判定：**継続**（理由：成約あり・売上が広告費を上回っている）
- 総合判断：**重大な不具合なし。MVPとして公開・運用開始可能**

**気になった点（必須修正ではない）**

- 日別ログのメモ列は省略表示されるが、現時点では必須修正ではない
- 内部確認用の参考LPリンクは折りたたみ内にあり、既存LP側から広告番頭への導線はないため問題なし
- 判定基準の折りたたみは追加確認してもよいが、MVP運用開始の阻害要因ではない

---

### 2026-06-09（沖縄中部家庭LP 新規作成・公開準備・運用ルール更新）

沖縄中部エリア向け家庭LP `cursor-test/central.html` を新規作成し、公開確認・sitemap登録・南部LPからの内部リンク・本番向け微調整・共通ルール更新まで実施。すべて push 済み。

**実施内容（時系列）**

1. `cursor-test/central.html` を新規作成（南部家庭LP `index.html` を参考、既存南部LPには影響なし）
2. 中部LPを公開確認し、スマホ固定CTA・build表示・南城市表現・ヘッダーナビ・料金表（中部/その他同額の整理）を調整
3. `cursor-test/sitemap.xml` に `central.html` を追加（テスト用サイトマップ）
4. Search Console 送信正本は **ルート `https://teruya1229.github.io/sitemap.xml`** であることを再確認し、ルート `sitemap.xml` に `central.html` を追加
5. 南部家庭LP `cursor-test/index.html` から中部LPへの内部リンクを2箇所追加（対応エリアセクション・AI検索用まとめ）
6. 本番向け調整：南部LP・中部LP双方で `COMMIT: REPLACE_ME` の build 表示削除、電気工事士表記更新（第二種電気工事士・認定電気工事従事者講習受講済み）、中部固定CTA文言調整
7. ルート `rules.md` に最新3分類ルール（ゴール達成型 / ピンポイント修正型 / /goal診断型）を正本として反映。`ops/rules.md` / `handoff.md` / `cursor-test/rules.md` 等は参照のみ

**主な commit（作業ログ）**

| commit | 内容 |
|--------|------|
| `8c43e5a` | 中部LP `central.html` 新規作成 |
| `19f6934` | 中部LP公開前調整（スマホCTA・ナビ・料金表・南城市表現など） |
| `461e87d` | `cursor-test/sitemap.xml` に `central.html` 追加 |
| `6741002` | ルート `sitemap.xml` に `central.html` 追加 |
| `7d7a552` | 南部LPから中部LPへの内部リンク追加 |
| `8b18a8a` | debug build表示削除・資格表記更新・中部固定CTA文言調整 |
| `bca0a9c` | 共通ルール最新化（3分類・ゴール達成型優先） |

**Search Console 運用（再確認）**

- 送信するサイトマップは **`https://teruya1229.github.io/sitemap.xml`** のみ（正本）
- `/cursor-test/sitemap.xml` は Search Console 送信対象にしない
- 中部LP URL：`https://teruya1229.github.io/cursor-test/central.html`

---

### 2026-06-04（LP実装フェーズ一区切り・docs反映）

本日は LP コード追加は一区切り。以下は本セッションまでに push 済みの実装内容を status へ整理した。

**主な commit（作業ログ）**

| commit | 内容 |
|--------|------|
| `81d671e` | 家庭LP AI検索用まとめ追加 |
| `aad1d9d` | 完全分解LP AI検索用まとめ追加 |
| `48f0fd5` | LocalBusiness / Service / BreadcrumbList 構造化データ追加 |
| `5f571f5` | 施工事例一覧ページ新規作成 |
| `fb5e390` | 通常分解リール2件目追加 |
| `2e3770a` | 完全分解リール2件目追加 |
| `3b8456d` | cases.html を sitemap / FAQ / south 導線へ追加 |
| `b39244a` | 主要ページナビに施工事例リンク追加 |
| `6a68ea9` | 業務LPのAI検索・内部リンク・構造化データ補強 |
| `ae3cd14` | 業務LPによくある相談事例追加 |
| `3d9fde3` | 業務LP FAQ7件 + FAQPage JSON-LD追加 |
| `e578881` | 業務LP meta / OGP補強 |
| `339be47` | 業務LP 見積り前チェックリスト追加 |
| `01fbad5` | 業務LP 料金・見積りの考え方追加 |
| `c6f0653` | 業務LP Instagram作業事例追加 |

**構造化データ・検証（公開確認済み）**

- 業務LP：リッチリザルトテストでパンくずリスト / よくある質問 / 地域のお店やサービス / 組織が有効
- 施工事例一覧：パンくずリスト有効、Schema Validatorで CollectionPage / BreadcrumbList OK
- FAQ一覧：パンくずリスト / よくある質問 有効
- 南部まとめ：パンくずリスト / よくある質問 / 地域のお店やサービス / 組織 / レビュースニペット 有効
- エラーなし。警告は LocalBusiness の `image` 任意項目のみ（重大ではない・現時点修正不要）

---

### 2026-04-15（参考・過去）

- 家庭LPで電話問い合わせ過多への対応として、電話導線を一時停止してLINE優先受付へ切替（`cursor-test/index.html` のみ、1439153）
- ファーストビュー内の主LINE CTA直下にLINE優先受付案内を追加
- 家庭LPの既存LINE URLは変更なし
- 業務LPは当時未変更

### 2026-04-10 以前（参考・過去）

- 家庭LP → 完全分解LP 導線（セクション内サブCTA・ヘッダーナビ）
- 完全分解LP・業務LPの実画像反映
- 子育て家庭応援プロジェクト数値更新 など

---

## 現在の状態

### 方針

- **南部7市町村LP 刷新・公開確認完了（2026-06-11）**。南城市・豊見城市・八重瀬町・与那原町・南風原町・糸満市・那覇市の7本が現行標準で揃った
- **糸満市LP `itoman.html` 既存刷新・公開確認OK（`b20fb1a`）**。南部商圏・海風・湿気・西崎/潮崎/兼城/真栄里などの固有訴求を維持
- **那覇市LP `naha.html` 既存刷新・公開確認OK（`9776372`）**。マンション・駐車場・搬入・新都心/小禄/首里などの固有訴求を維持。那覇専用ブログは作らず完全分解LP・cases・FAQへ導線
- **制作中心から運用・計測・回収フェーズへ移行**。LP追加量産は急がず、広告運用・GA4・問い合わせ実績を優先
- **浦添市家庭LP `urasoe.html` 公開確認OK（2026-06-10）**。9,000円〜の独立価格帯。南部7市町村とは分けて維持
- **中部家庭LP `central.html` 公開準備完了**。9,000円〜の独立価格帯
- **市町村別LPは都度SEO調査してから判断**（新規作成か既存刷新か）。SERP詳細は長期正本に残さない
- **ゴール達成型プロンプトで新規作成・既存刷新ともに再現性あり**
- **広告開始前チェック・LP debug CTA確認 最終確認完了（2026-06-10）**。Google広告小額テスト開始可能
- 新規コード修正は、公開確認で問題が出た場合のみ
- 正本：本ファイル（status）＋ `handoff.md` + 問題対応ルール `rules.md`。メモリには保存しない

### 固定URL（変更なし）

- LINE：`https://lin.ee/tsilra6`
- Airリザーブ：`https://airrsv.net/bc-servicesokinawa/calendar`

### 1. 家庭LP（`cursor-test/index.html`）

- 沖縄エアコンクリーニング文脈補強済み
- title / meta / OGP / H1 / FAQ 補強済み
- FAQ9件 + FAQPage JSON-LD 実装済み
- AI検索用まとめセクション追加済み
- 通常分解 Instagram 施工事例追加済み
- 施工事例一覧 `cases.html` への導線追加済み
- LocalBusiness / Service / BreadcrumbList 構造化データ追加済み
- 2026-04-15 時点の LINE優先受付・電話導線一時停止は維持
- 2026-06-09：中部LP `central.html` への内部リンク2箇所追加済み（対応エリア・AIまとめ）
- 2026-06-10：浦添LP `urasoe.html` への内部リンク1箇所追加済み（対応エリア：南部以外の近隣エリア）

### 1b. 中部家庭LP（`cursor-test/central.html`）

- 2026-06-09 新規作成・公開前調整済み
- 対応エリア：沖縄市 / うるま市 / 北谷町 / 嘉手納町 / 読谷村 / 宜野湾市 / 北中城村 / 中城村
- FAQ9件 + FAQPage JSON-LD、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: central_lp` / `page_slug: /cursor-test/central.html`
- ルート `sitemap.xml` 登録済み（Search Console 正本）
- 南部LP `index.html` から内部リンク2箇所あり
- 2026-06-10：浦添LP `urasoe.html` への内部リンク1箇所追加済み（対応エリア：中部・那覇寄りの近隣エリア）

### 1c. 南城市LP（`cursor-test/nanjo.html`）

- 2026-06-10 既存刷新・公開確認OK（`dbc94e3`、ゴール達成型）
- 本拠地（南城市大里）・地域密着訴求。佐敷 / 大里 / 玉城 / 知念など南城市内エリア
- 南部応援価格：通常分解 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- FAQ8件 + FAQPage JSON-LD（表示とJSON-LD一致）、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: nanjo_lp` / `page_slug: /cursor-test/nanjo.html`
- ルート `sitemap.xml` 登録済み（`lastmod` 更新のみ `dbc94e3`）
- 完全分解LP・`cases.html`・南部LP・南部まとめ・FAQへの導線あり

### 1d. 与那原町LP（`cursor-test/yonabaru.html`）

- 2026-06-10 既存刷新・公開確認OK（`9e74947`、ゴール達成型）
- 中城湾・潮風・湿気・塩分・住宅密集・結露カビ・那覇・西原アクセス・子育て世帯・マンション需要など与那原町固有訴求を維持・強化
- 南部応援価格：通常分解 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- FAQ8件 + FAQPage JSON-LD（表示とJSON-LD一致。刷新前は6問表示・6問JSON-LD）、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: yonabaru_lp` / `page_slug: /cursor-test/yonabaru.html`
- ルート `sitemap.xml` 登録済み（`lastmod` 更新のみ `9e74947`）
- 完全分解LP・`cases.html`・関連ブログ `posts/yonabaru-sea-wind.html` への導線あり。index / south / 他市町村LP / ブログ記事から内部リンク済み

### 1e. 八重瀬町LP（`cursor-test/yaese.html`）

- 2026-06-10 既存刷新・公開確認OK（`d4c299a`、ゴール達成型）
- 東風平・富盛・具志頭・畑エリアの砂埃・花粉、新興住宅と農地混在、湿気とホコリの複合汚れ、エイサーシーズンの粉塵など八重瀬町固有訴求を維持・強化
- 南部応援価格：通常分解 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- FAQ8件 + FAQPage JSON-LD（表示とJSON-LD一致。刷新前は13問表示・4問JSON-LDで不一致）、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: yaese_lp` / `page_slug: /cursor-test/yaese.html`
- ルート `sitemap.xml` 登録済み（`lastmod` 更新のみ `d4c299a`）
- 完全分解LP・`cases.html`・関連ブログ3本（`yaese-dust-aircon` / `tomori-aircon` / `kochi-higashikaze`）への導線あり。index / south / 他市町村LP / ブログ記事から内部リンク済み

### 1f. 豊見城市LP（`cursor-test/tomigusuku.html`）

- 2026-06-10 既存刷新・公開確認OK（`8322aba`、ゴール達成型）。軽微修正 `b73db60`
- 新築マンション・戸建て・共働き世帯・室内干し・気密性の高い住宅など豊見城市固有訴求を維持
- 南部応援価格：通常分解 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- FAQ8件 + FAQPage JSON-LD（表示とJSON-LD一致）、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: tomigusuku_lp` / `page_slug: /cursor-test/tomigusuku.html`
- ルート `sitemap.xml` 登録済み（`lastmod` 更新のみ `8322aba`）
- 完全分解LP・`cases.html`・関連ブログ `posts/tomigusuku-daily-use.html` への導線あり。index / south / 他市町村LP / ブログ記事から内部リンク済み

### 1g. 南風原町LP（`cursor-test/haebaru.html`）

- 2026-06-10 既存刷新・公開確認OK（`7098e05`、ゴール達成型）。軽微修正 `e0614ac` / `ab4f1f5` / `5b4949f`
- 那覇近接・住宅密集・共働き・交通粉塵・湿気・結露・カビ・新築マンション等の南風原町固有訴求を維持・強化
- 南部応援価格：通常分解 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- FAQ8件 + FAQPage JSON-LD（表示とJSON-LD一致。刷新前は6問表示・6問JSON-LD）、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: haebaru_lp` / `page_slug: /cursor-test/haebaru.html`
- ルート `sitemap.xml` 登録済み（`lastmod` 更新のみ）
- 完全分解LP・`cases.html`・関連ブログ2本（`haebaru-humidity-work` / `haebaru-condensation`）への導線あり。index / south / 他市町村LP / ブログ記事から内部リンク済み

### 1h. 糸満市LP（`cursor-test/itoman.html`）

- 2026-06-10 既存刷新・公開確認OK（`b20fb1a`、ゴール達成型）。公開確認：2026-06-11
- 海風・潮風・湿気・塩分・漁港・農地粉塵・西崎/潮崎/兼城/真栄里・戸建て/団地/マンション等の糸満市固有訴求を維持・強化
- LP内記事：「糸満市も南部商圏。南城市大里拠点だから動きやすいエリアです」
- 南部応援価格：通常分解 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円
- FAQ8件 + FAQPage JSON-LD（表示とJSON-LD一致）、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: itoman_lp` / `page_slug: /cursor-test/itoman.html`
- ルート `sitemap.xml` 登録済み（`lastmod` 更新のみ `b20fb1a`）
- 完全分解LP・`cases.html`・関連ブログ `posts/itoman-humidity.html` への導線あり。index / south / 他市町村LPから内部リンク済み

### 1i. 那覇市LP（`cursor-test/naha.html`）

- 2026-06-10 既存刷新・公開確認OK（`9776372`、ゴール達成型）。公開確認：2026-06-11
- マンション・アパート・駐車場・搬入・新都心/小禄/首里/真嘉比/泊/安謝/壺川/古波蔵・お掃除機能付き需要等の那覇市固有訴求を維持・強化
- LP内記事：「那覇市のエアコンクリーニングは、駐車場・搬入まで含めた事前確認が大切です」
- 南部応援価格：通常分解 8,000円 / 完全分解 14,000円 / お掃除機能付き 15,000円（サイト全体整合のため維持）
- FAQ8件 + FAQPage JSON-LD（表示とJSON-LD一致。刷新前は6問表示・6問JSON-LD）、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: naha_lp` / `page_slug: /cursor-test/naha.html`
- ルート `sitemap.xml` 登録済み（`lastmod` 更新のみ `9776372`）
- 完全分解LP・`cases.html`・浦添LP `urasoe.html` への導線あり。那覇専用ブログは作らず。index / south / 他市町村LP / ブログ記事から内部リンク済み

### 1j. 浦添市家庭LP（`cursor-test/urasoe.html`）

- 2026-06-10 新規作成・公開確認OK（`a1b329b`、composer-2.5 + ゴール達成型）
- 位置づけ：南部・中部・那覇方面の中間エリア。市町村別LPの1本目
- 料金目安：通常分解 9,000円〜 / 完全分解 15,000円〜 / お掃除機能付き 16,000円〜
- FAQ5件 + FAQPage JSON-LD、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: urasoe_lp` / `page_slug: /cursor-test/urasoe.html`
- ルート `sitemap.xml` 登録済み
- 南部LP・中部LPから内部リンクあり。浦添LPから南部LP・中部LP・完全分解LP・FAQ・施工事例へ導線あり

### 2. 完全分解LP（`complete-disassembly/index.html`）

- 施工事例写真4枚反映済み
- Instagram 完全分解リール施工事例追加済み
- FAQ8件 + FAQPage JSON-LD 実装済み
- AI検索用まとめセクション追加済み
- 施工事例一覧 `../cursor-test/cases.html` への導線追加済み
- LocalBusiness / Service / BreadcrumbList 構造化データ追加済み
- **2026-06-10：debug時 CTA計測OKトースト（LINE / 電話CTA）・外部遷移停止 確認済み**（`78ae15c`）
- **2026-06-10：LINE相談優先の補足文追加**（ヒーロー・PCヘッダー。電話番号・CTA・GA4・debugは維持）（`f7a2195`）

### 3. 施工事例一覧（`cursor-test/cases.html`）

- 新規作成済み
- 通常分解 Instagram リール2件：`DKwmGaGTs48` / `DO-xQ_PkUDL`
- 完全分解 Instagram リール2件：`DVvg1-tCP9I` / `DMCf9MEx_zN`
- 完全分解写真事例4枚掲載済み
- BreadcrumbList + CollectionPage JSON-LD 実装済み
- LINE CTA / Airリザーブ CTA あり
- 家庭LP / 完全分解LP / FAQ一覧 / 南部まとめから導線追加済み
- `sitemap.xml` 登録済み

### 4. FAQ一覧（`cursor-test/faq.html`）

- FAQ一覧ページ表示・開閉確認済み
- BreadcrumbList / FAQPage 構造化データ確認済み
- 施工事例一覧 `cases.html` への本文導線・フッターリンク追加済み
- 業務LPへの導線追加済み

### 5. 沖縄南部まとめ（`cursor-test/south.html`）

- 南城市 / 八重瀬町 / 豊見城市 / 糸満市 / 那覇市 / 南風原町 / 与那原町 の文脈維持
- 施工事例一覧 `cases.html` への関連ページ導線・フッターリンク追加済み
- 業務LPへの導線追加済み
- BreadcrumbList / FAQPage / LocalBusiness 構造化データ確認済み

### 6. 業務LP（`business-cleaning/index.html`）

- `sitemap.xml` 登録済み
- title / meta description / OGP / twitter meta 補強済み
- LocalBusiness / Service / BreadcrumbList 構造化データ追加済み
- FAQ7件 + FAQPage JSON-LD 追加済み
- AI検索用まとめセクション追加済み
- 「業務用エアコンでよくあるご相談」セクション（ドレン詰まり・水漏れ / フロートスイッチ / 床清掃まとめ相談 など）追加済み
- 「見積り相談の前に送っていただきたい情報」セクション追加済み
- 「料金・見積りの考え方」セクション追加済み
- Instagram フィード `https://www.instagram.com/p/DMh62EjPcNu/` を1件埋め込み済み（`c6f0653`）
- 家庭LP / 完全分解LP / 施工事例一覧 / FAQ一覧 / 南部まとめへの導線あり
- 主要ページから業務LPへの控えめ導線あり

### 7. sitemap（ルート `sitemap.xml` ※Search Console 正本）

- 送信URL：`https://teruya1229.github.io/sitemap.xml`
- `https://teruya1229.github.io/cursor-test/central.html` 登録済み（`6741002`）
- `https://teruya1229.github.io/cursor-test/urasoe.html` 登録済み（`a1b329b`）
- `https://teruya1229.github.io/business-cleaning/` 登録済み
- `https://teruya1229.github.io/cursor-test/cases.html` 登録済み
- `faq.html` / `south.html` 登録済み
- XML崩れなし

**補足：** `cursor-test/sitemap.xml` にも `central.html` あり（`461e87d`）。Search Console には送らない。

### 8. 広告番頭MVP（`ops/ad-bantou/` ※内部確認用）

- 2026-06-10 新規作成（`0a058bb`）
- 公開URL：`https://teruya1229.github.io/ops/ad-bantou/`
- 日次入力 / 自動計算 / 自動判定（継続・改善・停止候補・データ不足）/ 日別ログ / LP別集計
- **広告開始前チェック**（`bcAdBantouPreflightChecks`）：家庭LP4項目 + 完全分解LP4項目、debug確認URL、自動判定（広告開始OK / 広告開始前に要確認）
- **Google広告 初期設定チェッカー**（`bcAdBantouCampaignSetupChecks`、2026-06-12追加）：キャンペーン別テンプレート・LP URL自動判定・4状態チェック・完了率・履歴保存。Google Ads API・GA4 API連携は未実装
- localStorage 保存（日次：`bcAdBantouDailyLogs` / 開始前チェック：`bcAdBantouPreflightChecks` / 初期設定チェック：`bcAdBantouCampaignSetupChecks`）
- `noindex, nofollow`。sitemap 未登録（内部用のため登録しない）
- 既存LPからの導線なし（広告番頭 → LP の片方向のみ）
- **2026-06-10 表示確認・入力テスト完了。重大な不具合なし、MVPとして運用開始可能**
- **2026-06-10 広告開始前チェック・LP debug CTA確認 最終確認完了。Google広告小額テスト開始可能**

### 未追跡・未コミット（意図的に除外）

- `.cursor/mcp.json`
- `business-cleaning/business-clean-parts-optimized.jpg`（予備画像）

---

## 次回やること

**フェーズ：運用・計測・回収（制作中心から移行済み）**

1. **Google広告の日次運用**（最優先）
   - 毎日21時の広告番頭入力
   - 問い合わせ・成約・売上・CPA・ROASの確認
2. **GA4で地域LP別CTA反応を確認**
   - 南部7市町村LPの `page_type` 別反応を蓄積（`nanjo_lp` / `tomigusuku_lp` / `yaese_lp` / `yonabaru_lp` / `haebaru_lp` / `itoman_lp` / `naha_lp`）
   - 完全分解LPへの広告流入と、市町村LPのSEO流入を分けて評価
3. **糸満市・那覇市のSearch Console反映状況確認**
   - 時間を置いて `itoman.html` / `naha.html` のインデックス反映状況を確認
   - 再送信・再リクエストは不要
4. **南部7市町村LP全体のSearch Console反映状況確認**
   - 時間を置いて各LPのインデックス反映状況を確認（再送信不要）
5. **問い合わせ実績の記録**
   - 問い合わせが入った地域・検索語句・作業内容を記録
   - 実際に反応がある地域を優先して記事・施工事例を追加
6. **新しいLP制作は急がない**
   - 次の候補は、データを見て中部市町村LPまたは地域記事を判断
   - 着手前に既存ページ・sitemap・内部リンクを都度確認
7. **南城市LPヤモリ・虫・カバー内汚れ追記の公開確認**（別途 `ef5e688`）。必要なら記録を補足
8. **note有料記事への追記候補**
   - ゴール達成型による南部7市町村LP刷新の実例

**次の実作業候補（急がない）**

- 広告番頭：トースト表示時間の延長（必要なら）
- 広告番頭：メモ全文表示・JSONエクスポート/インポート（実運用で必要になったら）
- 中部市町村LPまたは地域記事（データを見て判断）
- 業務LPの Instagram 投稿表示を公開URLで再確認
- Instagramプロフィール / note / Googleビジネスプロフィールから LP 導線を整理
