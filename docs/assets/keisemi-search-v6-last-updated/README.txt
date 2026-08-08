最終更新日の自動表示版

上書きするファイル:
- docs/index.html
- docs/js/app.js
- scripts/build_data.R

変更不要:
- docs/css/style.css
- docs/assets/*
- .github/workflows/build-site.yml

仕組み:
1. GitHub Actions 実行時に build_data.R が GITHUB_SHA のコミット日時を取得
2. 日本時間へ変換して YYYY/MM/DD に整形
3. docs/data/last-updated.txt を生成
4. app.js が読み込んで
   「最終更新日：2026/08/08」
   のように表示

固定文言:
記事目録の原データは、ExcelおよびCSV形式でも公開しています。
