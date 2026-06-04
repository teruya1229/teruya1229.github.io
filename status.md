更新日: 2026-06-04

## 本日やったこと

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

- **LPコード追加は一区切り**。追加実装より Search Console と外部導線整理を優先
- 新規コード修正は、公開確認で問題が出た場合のみ
- 正本：本ファイル（status）＋ `handoff.md`。メモリには保存しない

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

### 2. 完全分解LP（`complete-disassembly/index.html`）

- 施工事例写真4枚反映済み
- Instagram 完全分解リール施工事例追加済み
- FAQ8件 + FAQPage JSON-LD 実装済み
- AI検索用まとめセクション追加済み
- 施工事例一覧 `../cursor-test/cases.html` への導線追加済み
- LocalBusiness / Service / BreadcrumbList 構造化データ追加済み

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

### 7. sitemap（`sitemap.xml`）

- `https://teruya1229.github.io/business-cleaning/` 登録済み
- `https://teruya1229.github.io/cursor-test/cases.html` 登録済み
- `faq.html` / `south.html` 登録済み
- XML崩れなし

### 未追跡・未コミット（意図的に除外）

- `.cursor/mcp.json`
- `business-cleaning/business-clean-parts-optimized.jpg`（予備画像）

---

## 次回やること

1. **Search Console** で URL検査・インデックス登録リクエスト
   - `https://teruya1229.github.io/business-cleaning/`
   - `https://teruya1229.github.io/cursor-test/cases.html`
   - `https://teruya1229.github.io/cursor-test/faq.html`
   - `https://teruya1229.github.io/cursor-test/south.html`
2. **業務LP** の Instagram 投稿表示を公開URLで再確認
   - `https://teruya1229.github.io/business-cleaning/`
3. Search Console 反映状況の確認
4. 実写真・業務用施工事例が増えたら、業務LPまたは別ページへ追加検討
5. Instagramプロフィール / note / Googleビジネスプロフィールから LP 導線を整理
