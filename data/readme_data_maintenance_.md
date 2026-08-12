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
`scripts/build_data.R` を実行し、以下のファイルを自動生成・更新します。

- `docs/data/articles.csv`
- `docs/data/articles.json`
- `docs/data/keisemi-article-index.xlsx`
- `docs/data/last-updated.txt`

その後、`docs` フォルダの内容がGitHub Pagesへ再デプロイされ、
全記事データベースのWebサイトも更新されます。

## 重要

- **記事データの正本は `data/keisemi-article-index.xlsx` だけです。**
- `articles.csv` や `articles.json` を手作業で編集する必要はありません。
- `docs/data/keisemi-article-index.xlsx` も手作業では更新しません。
- CSV・JSON・Web公開用Excelは、GitHub Actions実行時に正本Excelから自動生成されます。
- ファイル名 `keisemi-article-index.xlsx` は変更しないでください。
- Excelの列構成を変更する場合は、Webサイト側や `scripts/build_data.R` の修正が必要になる可能性があります。

## 反映されない場合

まずGitHubの **Actions** タブを開き、
`Build article data and deploy site` の最新実行結果を確認してください。

- 緑色（Success）: ビルド・デプロイ成功
- 赤色（Failure）: エラー内容を確認して修正が必要

Actionsが成功していても、GitHub Pagesへの反映には少し時間がかかる場合があります。
