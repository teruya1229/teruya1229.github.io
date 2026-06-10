更新日: 2026-06-10

## 前提（読む順）

1. **status.md**（進捗の正本）を先に読む
2. 本ファイル（handoff / 引継ぎの正本）で次の1手を確認
3. 問題対応の進め方：**ルート [`rules.md`](rules.md)**（ゴール達成型 / ピンポイント修正型 / /goal診断型）
4. 公開版参照（任意）：`https://teruya1229.github.io/ops/status/` / `https://teruya1229.github.io/ops/handoff/`

## フェーズ

- **南風原町LP `haebaru.html` 既存刷新・軽微CSS修正・公開確認OK（2026-06-10）**：新規作成ではなく既存SEO資産・内部リンク資産を活かす刷新。URL維持（`7098e05` / `e0614ac` / `ab4f1f5` / `5b4949f`）。FAQ表示8問とJSON-LD8問を一致（刷新前は6問表示・6問JSON-LDで一致）。スマホ固定CTA軽微CSS修正済み
- **与那原町LP `yonabaru.html` 既存刷新・公開確認OK（2026-06-10）**：新規作成ではなく既存SEO資産・内部リンク資産を活かす刷新。URL維持（`9e74947`）。FAQ表示8問とJSON-LD8問を一致（刷新前は6問表示・6問JSON-LDで一致）
- **八重瀬町LP `yaese.html` 既存刷新・公開確認OK（2026-06-10）**：新規作成ではなく既存SEO資産・内部リンク資産を活かす刷新。URL維持（`d4c299a`）。FAQ表示8問とJSON-LD8問を一致（刷新前は13問表示・4問JSON-LDで不一致）
- **豊見城市LP `tomigusuku.html` 既存刷新・公開確認OK（2026-06-10）**：新規作成ではなく既存SEO資産・内部リンク資産を活かす刷新。URL維持（`8322aba`）。ヒーロー見出し改行の軽微修正済み（`b73db60`）
- **南城市LP `nanjo.html` 既存刷新・公開確認OK（2026-06-10）**：新規作成ではなく既存SEO資産・内部リンク資産を活かす刷新。URL維持（`dbc94e3`）
- **市町村別LPは都度SEO調査してから判断**（新規作成か既存刷新か）。SERP詳細は長期正本に残さない
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
- **浦添市家庭LP：`https://teruya1229.github.io/cursor-test/urasoe.html`**
- **南城市LP（刷新）：`https://teruya1229.github.io/cursor-test/nanjo.html`**
- **豊見城市LP（刷新）：`https://teruya1229.github.io/cursor-test/tomigusuku.html`**
- **八重瀬町LP（刷新）：`https://teruya1229.github.io/cursor-test/yaese.html`**
- **与那原町LP（刷新）：`https://teruya1229.github.io/cursor-test/yonabaru.html`**
- **南風原町LP（刷新）：`https://teruya1229.github.io/cursor-test/haebaru.html`**
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

**南城市LP 刷新結果（2026-06-10）**

- 対象：`cursor-test/nanjo.html`（`dbc94e3`）。公開URL維持
- 新規作成ではなく既存刷新が正解（SEO調査の判断結果。SERP詳細は正本に残さない）
- ヒーロー・CTA・GA4・JSON-LD・FAQ整合・完全分解LP/cases導線を現行標準に合わせて整備
- 公開確認OK（表示・固定CTA・LINE・Airリザーブ・FAQ・build表示なし）

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

**composer-2.5 / ゴール達成型 検証結果（2026-06-10）**

- Fable 5 Highの制限後、composer-2.5で浦添LP新規作成〜南城市LP・豊見城市LP・八重瀬町LP・与那原町LP・南風原町LP既存刷新まで完了
- 結論：高性能モデルだけでなく、**ゴール達成型プロンプト自体に再現性がある**
- 今後のLP量産は、まずゴール達成型で進める方針を継続。市町村別は都度SEO調査して判断
- note有料記事への追記候補：「ゴール達成型で既存LP刷新まで進められた」事例

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

1. **次地域LPの着手前判断**（都度SEO調査）
   - 次候補：**糸満市 `cursor-test/itoman.html`**
   - いきなり刷新せず、既存確認・sitemap・内部リンク・現行標準との差分を先に確認し、「既存刷新」か「新規作成」か判断
   - 糸満市は人口が多くLP経由の反応もあるため優先度は高い。海風・潮風・湿気・戸建て/団地/新興住宅・西崎/潮崎/兼城/真栄里などの生活圏・完全分解需要を確認
2. **南風原町LPのSearch Console反映状況確認**（再送信・再リクエストは不要）
   - 時間を置いて `haebaru.html` のインデックス反映状況を確認
3. **与那原町LPのSearch Console反映状況確認**（再送信・再リクエストは不要）
   - 時間を置いて `yonabaru.html` のインデックス反映状況を確認
4. **八重瀬町LPのSearch Console反映状況確認**
5. **豊見城市LP・南城市LPのSearch Console反映状況確認**
   - 南城市LPヤモリ・虫追記（`ef5e688`）の公開確認も必要なら実施
6. **浦添LP・中部LPのSearch Console反映状況確認**
7. **市町村別LP量産の判断**（上記確認後）
   - ゴール達成型プロンプトを基本にする（新規作成・既存刷新ともに再現性確認済み）
8. **note有料記事への追記**
   - 「ゴール達成型で既存LP刷新まで進められた」事例として追記候補
9. **Google広告の小額テスト設計**（表示確認OKなら進む）
10. **広告番頭への日次入力運用**

**次の実作業候補（急がない）**

- 広告番頭：トースト表示時間の延長（必要なら）
- 沖縄市ページ / 宜野湾市ページ / うるま市ページの量産（浦添LP確認後）
- 那覇LP `naha.html` から浦添LPへの相互導線
- 業務LPの Instagram 埋め込み表示を公開URLで確認
- Instagramプロフィール / note / Googleビジネスプロフィール → LP 導線を整理

## 次にやるべき1手

- **糸満市LP `itoman.html` の着手前確認**（既存ページ・sitemap・内部リンク・現行標準との差分を調査し、既存刷新か新規作成か判断）

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
南風原町LP haebaru.html は 2026-06-10 に既存刷新・公開確認OK（7098e05 / e0614ac / ab4f1f5 / 5b4949f）。新規作成ではなく既存SEO資産・内部リンク資産を活かす刷新。FAQ8問とJSON-LD一致。スマホ固定CTA軽微CSS修正済み。
与那原町LP yonabaru.html は 2026-06-10 に既存刷新・公開確認OK（9e74947）。新規作成ではなく既存SEO資産・内部リンク資産を活かす刷新。FAQ8問とJSON-LD一致。
八重瀬町LP yaese.html は 2026-06-10 に既存刷新・公開確認OK（d4c299a）。
豊見城市LP tomigusuku.html は 2026-06-10 に既存刷新・公開確認OK（8322aba / b73db60）。
南城市LP nanjo.html は 2026-06-10 に既存刷新・公開確認OK（dbc94e3）。ヤモリ・カバー内汚れの地域気づき追記済み（ef5e688）。
浦添市家庭LP urasoe.html は 2026-06-10 に公開確認OK（a1b329b）。市町村別LP1本目。
次地域LP候補は糸満市 itoman.html。着手前に既存確認・差分調査してから判断。
市町村別LPは都度SEO調査してから判断（新規作成か既存刷新か）。SERP詳細は正本に残さない。
ゴール達成型プロンプトで新規作成・既存刷新ともに再現性あり。Search Console は時間を置いて反映確認。
広告開始前チェック・LP debug CTA確認は 2026-06-10 に最終確認完了。Google広告小額テスト開始可能です。
```
