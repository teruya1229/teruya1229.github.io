# 開発ルール

変更は必ず最小差分にする。

1回の変更は1ファイルのみ。

既存ロジックは変更しない。

変更する前に、対象ファイルの現在のコード構造を必ず確認する。

以下のコマンドは使用禁止

rm
del
sudo
git reset --hard

Git運用

使用可能コマンド

git status
git add
git commit
git push

# LP編集ルール

LPの構造崩壊を防ぐため、以下のルールを適用する。

HTML

index.html の構造変更は必要最小限のみ。

既存セクションの削除は禁止。

CSS

既存クラスを優先して使用する。

既存スタイルを破壊する変更は禁止。

新規スタイルは追加のみ。

JavaScript

LPのUIに関係ないコード変更は禁止。

Cursor編集ルール

変更は最小差分。

指定されたファイルのみ編集する。

不要なリファクタリングは禁止。

# Cursor Command Safety Rules

Allowlist allowed commands

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


Never Allowlist commands

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
