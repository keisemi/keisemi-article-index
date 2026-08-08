library(readxl)
library(readr)
library(jsonlite)

data <- read_excel(
  "data/keisemi-article-index.xlsx"
)

write_csv(
  data,
  "docs/data/articles.csv"
)

write_json(
  data,
  "docs/data/articles.json",
  dataframe = "rows",
  pretty = FALSE,
  na = "null"
)