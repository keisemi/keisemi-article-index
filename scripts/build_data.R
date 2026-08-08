library(readxl)
library(readr)
library(jsonlite)

# Input / output paths
input_file <- "data/keisemi-article-index.xlsx"
output_dir <- "docs/data"

csv_file <- file.path(output_dir, "articles.csv")
json_file <- file.path(output_dir, "articles.json")
xlsx_file <- file.path(output_dir, "keisemi-article-index.xlsx")
updated_file <- file.path(output_dir, "last-updated.txt")

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
# Some author columns contain values only in later rows,
# so use a sufficiently large guess_max.
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

# Copy the current master Excel file into the Pages artifact.
# This is a build-time copy only; it is not committed back to main.
copied <- file.copy(
  input_file,
  xlsx_file,
  overwrite = TRUE
)

if (!copied) {
  stop("Failed to copy Excel file to: ", xlsx_file)
}

# Record the date of the commit being deployed.
# GitHub Actions provides GITHUB_SHA. We read its Unix timestamp from git
# and convert it to Japan Standard Time. If run outside GitHub Actions,
# fall back to the current date in Japan.
github_sha <- Sys.getenv("GITHUB_SHA")

updated_date <- tryCatch(
  {
    if (!nzchar(github_sha)) {
      stop("GITHUB_SHA is not available.")
    }

    commit_epoch <- system2(
      "git",
      c("show", "-s", "--format=%ct", github_sha),
      stdout = TRUE,
      stderr = FALSE
    )

    if (length(commit_epoch) == 0 || !nzchar(commit_epoch[[1]])) {
      stop("Could not read commit timestamp.")
    }

    commit_time <- as.POSIXct(
      as.numeric(commit_epoch[[1]]),
      origin = "1970-01-01",
      tz = "UTC"
    )

    format(
      commit_time,
      tz = "Asia/Tokyo",
      format = "%Y/%m/%d"
    )
  },
  error = function(e) {
    format(
      Sys.time(),
      tz = "Asia/Tokyo",
      format = "%Y/%m/%d"
    )
  }
)

writeLines(
  updated_date,
  updated_file,
  useBytes = TRUE
)

cat("Generated:\n")
cat(" - ", csv_file, "\n", sep = "")
cat(" - ", json_file, "\n", sep = "")
cat(" - ", xlsx_file, "\n", sep = "")
cat(" - ", updated_file, "\n", sep = "")
cat("Rows: ", nrow(data), "\n", sep = "")
cat("Columns: ", ncol(data), "\n", sep = "")
