library(readxl)
library(readr)
library(jsonlite)

# Input / output paths
input_file <- "data/keisemi-article-index.xlsx"
output_dir <- "docs/data"

csv_file <- file.path(output_dir, "articles.csv")
json_file <- file.path(output_dir, "articles.json")

# Safety checks
if (!file.exists(input_file)) {
  stop("Input Excel file not found: ", input_file)
}

# Git does not track empty directories, so create it if necessary
dir.create(
  output_dir,
  recursive = TRUE,
  showWarnings = FALSE
)

# Read master Excel file
# Increase guess_max because some author columns contain values only in later rows
data <- read_excel(
  input_file,
  guess_max = 20000
)

# Export CSV
write_csv(
  data,
  csv_file,
  na = ""
)

# Export JSON for the web interface
write_json(
  data,
  json_file,
  dataframe = "rows",
  pretty = FALSE,
  na = "null"
)

cat("Generated:\n")
cat(" - ", csv_file, "\n", sep = "")
cat(" - ", json_file, "\n", sep = "")
cat("Rows: ", nrow(data), "\n", sep = "")
cat("Columns: ", ncol(data), "\n", sep = "")