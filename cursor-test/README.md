# BCサービス LPプロジェクト


## 概要

沖縄南部向け  
エアコンクリーニングサービスLP

サービス名  
BCサービス


対象エリア

南城市  
八重瀬町  
豊見城市  
糸満市  
那覇市  
南風原町  
与那原町


目的

LINE問い合わせ率最大化



━━━━━━━━━━━━━━━━
LP構造
━━━━━━━━━━━━━━━━

LPは以下の順序で構成される

1 ファーストビュー  
2 相談の流れ（3ステップ）  
3 料金  
4 クリーニング前のエアコン内部  
5 洗浄で出た汚水  
6 Google口コミ  
7 代表プロフィール  
8 LINE CTA  
9 実施内容  

LP構造の順番は変更しない。



━━━━━━━━━━━━━━━━
LP URL
━━━━━━━━━━━━━━━━

本番LP

https://teruya1229.github.io/

検証LP

https://teruya1229.github.io/cursor-test/



━━━━━━━━━━━━━━━━
LINE
━━━━━━━━━━━━━━━━

公式LINE

https://lin.ee/tsilra6



━━━━━━━━━━━━━━━━
開発ルール
━━━━━━━━━━━━━━━━

変更は必ず最小差分

1回の変更は1ファイルのみ

既存HTML構造は壊さない

セクション削除禁止

不要なリファクタリング禁止



━━━━━━━━━━━━━━━━
Cursor安全ルール
━━━━━━━━━━━━━━━━

Allowlist推奨

git status
git add
git commit
git push
git diff
git log
Get-Location
Get-ChildItem
ls
pwd


Allowlist禁止

rm
del
sudo
git reset --hard
git clean
git checkout -- .
git restore .
git restore --source
git reset --mixed
git reset --soft



━━━━━━━━━━━━━━━━
AI三位一体運用
━━━━━━━━━━━━━━━━

ChatGPT  
戦略 / マーケ / 方針

Claude  
設計整理 / Cursorプロンプト作成

Cursor  
コード実装 / commit / push



━━━━━━━━━━━━━━━━
プロジェクト管理
━━━━━━━━━━━━━━━━

status

https://teruya1229.github.io/ops/status/


handoff

https://teruya1229.github.io/ops/handoff/
