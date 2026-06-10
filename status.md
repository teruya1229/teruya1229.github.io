更新日: 2026-06-10

## 本日やったこと

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

- **広告開始前チェック・LP debug CTA確認 最終確認完了（2026-06-10）**。Google広告小額テスト開始可能
- **中部家庭LP `central.html` 公開準備完了**。次は Search Console でインデックス確認
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

### 1b. 中部家庭LP（`cursor-test/central.html`）

- 2026-06-09 新規作成・公開前調整済み
- 対応エリア：沖縄市 / うるま市 / 北谷町 / 嘉手納町 / 読谷村 / 宜野湾市 / 北中城村 / 中城村
- FAQ9件 + FAQPage JSON-LD、LocalBusiness / Service / BreadcrumbList 構造化データ実装済み
- GA4：`page_type: central_lp` / `page_slug: /cursor-test/central.html`
- ルート `sitemap.xml` 登録済み（Search Console 正本）
- 南部LP `index.html` から内部リンク2箇所あり

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
- localStorage 保存（日次：`bcAdBantouDailyLogs` / 開始前チェック：`bcAdBantouPreflightChecks`）
- `noindex, nofollow`。sitemap 未登録（内部用のため登録しない）
- 既存LPからの導線なし（広告番頭 → LP の片方向のみ）
- **2026-06-10 表示確認・入力テスト完了。重大な不具合なし、MVPとして運用開始可能**
- **2026-06-10 広告開始前チェック・LP debug CTA確認 最終確認完了。Google広告小額テスト開始可能**

### 未追跡・未コミット（意図的に除外）

- `.cursor/mcp.json`
- `business-cleaning/business-clean-parts-optimized.jpg`（予備画像）

---

## 次回やること

1. **完全分解LPの公開URL表示確認**
   - `https://teruya1229.github.io/complete-disassembly/` でヒーロー補足文を確認
   - スマホ表示確認（ヘッダー補足非表示・ヒーロー補足表示）
2. **Google広告の小額テスト設計**（表示確認OKなら進む）
   - まずは完全分解LP向けにキャンペーン作成
   - 1日500〜1,000円程度で開始
   - 地域・キーワード・除外キーワードを絞る
3. **広告番頭への日次入力運用**
   - 翌日から広告番頭に数値入力（Claude in Chrome 運用）
   - 7日分の数字で継続 / 改善 / 停止を判断
4. **Search Console：反映待ち確認**（sitemap再送信・URL検査の再実行は不要）
   - 数時間〜翌日以降に `https://teruya1229.github.io/cursor-test/central.html` のインデックス反映状況を確認
   - 未反映・エラー表示があれば、その時点で URL検査を再実行
   - ルート sitemap `https://teruya1229.github.io/sitemap.xml` の読み取り状況もあわせて確認
5. **中部LPの実機最終確認**
   - 375px固定CTA・公開URL表示：`https://teruya1229.github.io/cursor-test/central.html`
6. **業務LP** の Instagram 投稿表示を公開URLで再確認
   - `https://teruya1229.github.io/business-cleaning/`
7. Instagramプロフィール / note / Googleビジネスプロフィールから LP 導線を整理

**次の実作業候補（急がない）**

- 広告番頭：トースト表示時間の延長（必要なら）
- 広告番頭：メモ全文表示・JSONエクスポート/インポート・upsertルール（実運用で必要になったら）
- 中部LPを親にした市町村別ページ量産
- 沖縄市ページ / 宜野湾市ページ / うるま市ページの検討
- 既存LPとの内部リンク設計（例：中部LP → 南部LP 相互リンク）
- 焦って市町村別ページを作らず、**まず中部LPの反応・表示確認を優先**
