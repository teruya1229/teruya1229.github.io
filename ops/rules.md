# AI Trinity OS Rules

## 1. Overview
このドキュメントは、BCサービスLP運用における「AI三位一体運用（ChatGPT + Claude + Cursor）」の判断OSです。  
以後の全チャット・全実装は、本ルールを共通基準として扱います。

## 2. Source of Truth
最上位の固定前提（唯一の正）:
- 前提（仕様・構造）は handoff を正として固定する  
  https://teruya1229.github.io/ops/handoff/
- 進捗（最新状態）は status を正として固定する  
  https://teruya1229.github.io/ops/status/
- 迷ったら必ず status を確認してから次の一手を決める
- 上記2URLは唯一の正として扱い、推測で上書きしない

判断優先順位:
1. status（最新の現状）
2. handoff（前提/仕様）
3. repoの実ファイル（実装の事実）
4. 会話ログ（参考）

## 3. Role Split
- ChatGPT: 戦略設計、優先順位設計、次の一手の提案
- Claude: 仕様整理、矛盾チェック、文章レビュー、リスク洗い出し
- Cursor: 実装、差分確認、commit/push、最低限の動作確認

## 4. Working Agreement
絶対ルール:
- 推測でURLを提示しない（特にLINEやフォーム）
- URLを変更する場合は、status/handoff/実ファイルの3点で整合確認する
- 不明点は断定せず、根拠（status/handoff/実ファイル）を先に示す
- 日本語で、簡潔かつ実務トーンで記述する
- ブランドトーンは「安心・信頼・地域密着」を維持する

固定URL（正）:
- LINE正URL: https://lin.ee/tsilra6
- Googleフォーム正URL: https://forms.gle/eVeRnY5vi24dAjbG8

固定表記:
- 対応エリア: 南城市 / 八重瀬町 / 豊見城市 / 糸満市 / 那覇市 / 南風原町 / 与那原町

GA4テスト手順（固定）:
1. 公開URLに `?debug=1` を付けて開く
2. CTAをクリックする
3. 「計測OK」が表示されることを確認する

## 5. Change Policy
変更を加える時は、必ず以下を残す:
- 変更理由
- 変更箇所
- 影響範囲
- 検証手順

更新先の原則:
- 前提/仕様変更: handoff に反映
- 進捗/作業実績: status に反映
- 実装詳細: repo内の対象ファイルに反映
- 運用判断ルール: この rules.md に反映

Cursor実装時の基本:
- 最小変更
- 既存デザイン破壊禁止
- commit / push まで実行
- 変更後に簡易チェック（ページ表示 / CTA / リンク / レイアウト崩れ）

「次の一手」の決め方:
1. status確認
2. 目的確認（CTAクリック率 / プレミアム選択率など）
3. 1手で効く修正から実装

## 6. Definition of Done
以下を全て満たしたら完了:
- [ ] status と handoff の整合が取れている
- [ ] 固定URL（LINE/フォーム）を誤変更していない
- [ ] 対応エリア表記が固定文言のまま
- [ ] 変更理由 / 変更箇所 / 影響範囲 / 検証手順を記載済み
- [ ] 画面表示・CTA・主要リンクを確認済み
- [ ] commit message が変更目的と一致
- [ ] push完了（必要時）

## 7. Prompt Templates
### ChatGPT用（戦略/設計依頼）
```text
あなたはBCサービスLPの戦略担当です。
まず status（https://teruya1229.github.io/ops/status/）を前提に、
handoff（https://teruya1229.github.io/ops/handoff/）と矛盾しない改善案を
優先順位つきで3つ提案してください。

目的:
- CTAクリック率向上
- プレミアム選択率向上

出力:
1) 何を変えるか
2) なぜ効くか
3) リスク
4) 検証方法
```

### Claude用（仕様整理/レビュー依頼）
```text
以下の変更案を仕様レビューしてください。
前提は status > handoff > repo実装 > 会話ログ の順で判断してください。

チェック観点:
- 仕様矛盾の有無
- URL/エリア表記の固定ルール遵守
- 既存導線（LINE/CTA/地域SEO）への影響
- リリース前の確認項目

対象変更:
{ここに変更案}
```

### Cursor用（実装一括）
```text
次の要件を最小変更で実装してください。
前提は以下を唯一の正として扱ってください:
- https://teruya1229.github.io/ops/handoff/
- https://teruya1229.github.io/ops/status/

要件:
{ここに要件}

実装条件:
- 既存デザインを壊さない
- 固定URL（LINE: https://lin.ee/tsilra6 / Form: https://forms.gle/eVeRnY5vi24dAjbG8）を変更しない
- 変更後に差分確認
- commit / push まで実施
- 検証: ページ表示 / CTA / リンク / レイアウト崩れ / GA4 debug

出力:
- 変更理由
- 変更箇所
- 影響範囲
- 検証手順
- commit hash
```
