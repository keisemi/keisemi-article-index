# 記事データの更新方法

このフォルダにある `keisemi-article-index.xlsx` が、  
『経済セミナー』全記事データベースの記事データの正本です。

新号の記事追加や既存データの修正を行う場合は、  
**このExcelファイルだけを更新してください。**

## 更新手順

1. `data/keisemi-article-index.xlsx` を開く
2. 新しい記事の追加、既存データの修正などを行う
3. ファイル名を変更せず、そのまま保存する
4. 更新した `data/keisemi-article-index.xlsx` をGitHubの `main` ブランチにpushする
5. GitHub Actionsが自動的に実行される
6. Actionsの `Build article data and deploy site` が成功したことを確認する
7. GitHub PagesのWebサイトに更新内容が反映されたことを確認する

## push後に自動で行われる処理

`data/keisemi-article-index.xlsx` が更新されると、GitHub Actionsが  
`scripts/build_data.R` を実行します。

Actionsの実行中に、正本Excelから次のWeb公開用ファイルが `docs/data` に生成されます。

- `articles.csv`
- `articles.json`
- `keisemi-article-index.xlsx`
- `last-updated.txt`

これらは **GitHub Pagesへデプロイするためのビルド成果物**です。

Actionsの実行環境内で生成され、GitHub Pagesへ公開されますが、  
生成されたファイルを `main` ブランチへ自動的にcommit・pushする処理は行っていません。

そのため、GitHub上で `main` ブランチの `docs/data` フォルダを見た場合、  
その内容が現在のGitHub Pages上の公開物と完全には一致しないことがあります。

Webサイトで実際に使われるCSV・JSON・公開用Excel・更新日ファイルは、  
**最新の成功したGitHub Actions実行時に生成されたもの**です。

また、ビルド時には `docs/index.html` 内の `__BUILD_VERSION__` が、  
そのpushのコミットSHAをもとにした値へ置換され、静的ファイルのキャッシュ更新にも利用されます。

## 重要

- **記事データの正本は `data/keisemi-article-index.xlsx` だけです。**
- 新号追加や記事データ修正の際は、この正本Excelだけを編集します。
- `articles.csv` や `articles.json` を手作業で更新する必要はありません。
- Pages公開用の `keisemi-article-index.xlsx` や `last-updated.txt` も手作業では作成しません。
- `main` ブランチ内の `docs/data` にある生成物を正本として扱わないでください。
- 正本Excelのファイル名 `keisemi-article-index.xlsx` は変更しないでください。
- Excelの列構成を変更する場合は、`scripts/build_data.R` やWebサイト側の修正が必要になる可能性があります。

## 更新できたか確認する方法

まずGitHubの **Actions** タブを開き、  
`Build article data and deploy site` の最新実行結果を確認してください。

- 緑色（Success）: ビルド・デプロイ成功
- 赤色（Failure）: エラー内容を確認して修正が必要

Successになったら、GitHub PagesのWebサイトを開き、  
追加・修正した記事が検索結果などに反映されていることを確認してください。

Actionsが成功していても、GitHub Pagesへの反映には少し時間がかかる場合があります。
