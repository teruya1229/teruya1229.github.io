# Cursor Run Allowlist ポリシー

## 目的
Run確認を減らし、安全な確認系コマンドのみ自動実行可能にする。

## Allowlist対象コマンド
Run確認が表示された際、以下のみAllowlistを選択する。

- `git status`
- `git add`
- `git commit`
- `git push`
- `git diff`
- `git log`
- `ls`
- `pwd`
- `Get-ChildItem`
- `Get-Location`

## 理由
- Git状態確認
- Git履歴確認
- フォルダ確認

上記のみを行う安全コマンドであり、ファイル削除や履歴破壊を行わない。

## Allowlist禁止コマンド
以下は絶対にAllowlistしない。

- `rm`
- `del`
- `sudo`
- `git reset --hard`
- `git clean`
- `git checkout -- .`
- `git restore .`
- `git restore --source`
- `git reset --mixed`
- `git reset --soft`

## 運用
1. Cursor Run確認が表示された際、Allowlist対象コマンドのみAllowlistを選択する。
2. 禁止コマンドはAllowlistしない。
