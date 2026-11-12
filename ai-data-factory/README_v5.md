# AIデータ工場｜CPSCリコール通知の条件判定 v5（実験ブランチ専用）

## 現状
- 米国CPSC公式APIの直近14日間の情報をGitHub-hosted Ubuntuで取得し、未審査の条件候補を抽出する。
- 判定の根拠として使用できるのは、原文・通知番号・ID・原文ハッシュを検証した**5件の個別通知ルールだけ**。その他の通知27件（件数は実行日により変動）は条件案の収集にとどめる。
- 在庫データはすべて架空。現物・型番ラベル・シリアル・製造コードの真正性は未確認。
- `対象型番に一致` は「入力された型番が対象型番に一致」の意味で、実物のリコール対象確定を意味しない。
- `当該通知の条件に非一致` は**その1通知だけ**の判定。別通知や別年度のリコールを含む安全保証ではない。
- 改訂された公式説明はSHA-256整合が取れない限り判定を停止する。追加条件・誤抽出があっても自動で判定ルールへ昇格しない。
- 販売/使用可否は現品確認とメーカー・当局の正式な回収条件確認が必要。

## 商品としての不足点
1. CPSC過去全件との照合は未実装。直近14日の非該当は安全を意味しない。
2. 27件中5件のみ検証済みルール。残りの条件抽出は未検証の**候補**。
3. 対象地域・シリアル・製造コード・UPC・QCステッカーなどの証拠写真は自動検証していない。
4. 通知条件が更新されたら人間が比較・再承認する必要がある。
5. 日本を含む他国のリコール機関は対象外。

## 動作
隔離されたGitHub-hosted Runner上の`cpsc_schema_probe.py`が原文を取得後、
`cpsc_condition_extractor.py --raw RAW --out DRAFT.json`で条件案を生成。
`cpsc_verdict.py --raw RAW --inventory FIXTURE.csv --out VERDICTS.csv`で5件の承認済みルールに限定した通知別判定を出す。
この出力はGitHub Actionsの短期保持Artifactのみで、公式リコールDBや顧客・会社システムは変更しない。

`python3 -m unittest discover -s ai-data-factory/tests -p 'test_*.py' -v`

## 出典・固定サンプル
2026-11-12に取得した米国CPSC公式APIの公表された5通知のみをローカル回帰テスト用に抽出。原典は各レコードの`URL`で確認。
公式API: https://www.saferproducts.gov/RestWebServices/Recall?format=json
CPSC API案内: https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information

## 変更・公開境界
実験ブランチ`experiment/cpsc-hosted-20261112`のみ。`main`・既存LP・Supabase・Square・本番設定・毎日スケジュールには変更なし。