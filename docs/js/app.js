(() => {
  "use strict";

  const DATA_URL = "data/articles.json";
  const PAGE_SIZE = 50;

  const sourceColumns = [
    "通号表示",
    "年・月号表示",
    "刊行年月",
    "記事タイトル",
    "特集・連載名",
    "記事種別",
    "掲載頁",
    "著者1",
    "著者2",
    "著者3",
    "著者4",
    "著者5",
    "著者6",
    "著者7",
    "著者8",
    "著者9",
    "著者10",
    "著者11",
    "著者12"
  ];

  const authorColumns = sourceColumns.filter((name) =>
    name.startsWith("著者")
  );

  const elements = {
    keyword: document.getElementById("keyword"),
    searchButton: document.querySelector(".search-button"),
    yearFrom: document.getElementById("year-from"),
    yearTo: document.getElementById("year-to"),
    author: document.getElementById("author"),
    articleType: document.getElementById("article-type"),
    series: document.getElementById("series"),
    seriesList: document.getElementById("series-list"),
    clearButton: document.getElementById("clear-filters"),
    downloadFiltered: document.getElementById("download-filtered"),
    lastUpdated: document.getElementById("last-updated"),
    tableBody: document.getElementById("article-table-body"),
    resultCount: document.querySelector(".result-count strong"),
    resultsStatus: document.getElementById("results-status"),
    pagination: document.getElementById("pagination"),
    sortSelects: Array.from(document.querySelectorAll(".sort-select")),
    tableWrap: document.getElementById("article-table-wrap"),
    articleTable: document.getElementById("article-table"),
    topScrollbar: document.getElementById("table-scroll-top"),
    topScrollbarInner: document.getElementById("table-scroll-top-inner"),
    stickyHeader: document.getElementById("sticky-table-header"),
    stickyHeaderInner: document.getElementById("sticky-table-header-inner"),
    latestIssueButton: document.getElementById("latest-issue-button"),
    issuePurchaseCard: document.getElementById("issue-purchase-card"),
    issuePurchaseTitle: document.getElementById("issue-purchase-title"),
    issuePurchaseLink: document.getElementById("issue-purchase-link")
  };

  let articles = [];
  let filteredArticles = [];
  let currentPage = 1;
  let minYear = null;
  let maxYear = null;
  let sortKey = "";
  let sortDirection = "";

  let exactIssueDate = "";
  let exactIssueNumber = "";
  let exactTitle = "";

  let activeDrilldownKind = "";

  let latestIssue = null;
  let stickyHeaderFrame = null;

  function valueOrEmpty(value) {
    return value == null ? "" : String(value);
  }

  function normalizeText(value) {
    return valueOrEmpty(value)
      .normalize("NFKC")
      .toLocaleLowerCase("ja-JP")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitTerms(value) {
    return normalizeText(value)
      .split(" ")
      .filter(Boolean);
  }

  function getAuthors(article) {
    return authorColumns
      .map((column) => valueOrEmpty(article[column]).trim())
      .filter(Boolean);
  }

  function getYear(article) {
    const match = valueOrEmpty(article["刊行年月"]).match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
  }

  function prepareArticle(article, originalIndex) {
    const authors = getAuthors(article);
    const year = getYear(article);

    const searchParts = [
      article["通号表示"],
      article["年・月号表示"],
      article["刊行年月"],
      article["記事タイトル"],
      article["特集・連載名"],
      article["記事種別"],
      article["掲載頁"],
      ...authors
    ];

    return {
      ...article,
      __index: originalIndex,
      __authors: authors,
      __authorsText: authors.join("／"),
      __year: year,
      __searchText: normalizeText(searchParts.join(" "))
    };
  }

  function compareNewestFirst(a, b) {
    const dateA = valueOrEmpty(a["刊行年月"]);
    const dateB = valueOrEmpty(b["刊行年月"]);

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    const issueA = Number(a["通号表示"]) || 0;
    const issueB = Number(b["通号表示"]) || 0;

    if (issueA !== issueB) {
      return issueB - issueA;
    }

    // 同じ号の中ではExcel原本の掲載順を維持する。
    return a.__index - b.__index;
  }


  function getSortValue(article, key) {
    switch (key) {
      case "date":
        return valueOrEmpty(article["刊行年月"]).trim();

      case "issue": {
        const value = Number(article["通号表示"]);
        return Number.isFinite(value) ? value : null;
      }

      case "title":
        return valueOrEmpty(article["記事タイトル"]).trim();

      case "authors":
        return valueOrEmpty(article.__authorsText).trim();

      case "series":
        return valueOrEmpty(article["特集・連載名"]).trim();

      case "type":
        return valueOrEmpty(article["記事種別"]).trim();

      default:
        return null;
    }
  }

  function isBlankSortValue(value) {
    return (
      value == null ||
      (typeof value === "string" && value.trim() === "")
    );
  }

  function compareSortValues(a, b) {
    const valueA = getSortValue(a, sortKey);
    const valueB = getSortValue(b, sortKey);

    const blankA = isBlankSortValue(valueA);
    const blankB = isBlankSortValue(valueB);

    // Blank cells stay at the bottom in both ascending and descending order.
    if (blankA && blankB) {
      return compareNewestFirst(a, b);
    }

    if (blankA) {
      return 1;
    }

    if (blankB) {
      return -1;
    }

    let comparison = 0;

    if (
      typeof valueA === "number" &&
      typeof valueB === "number"
    ) {
      comparison = valueA - valueB;
    } else {
      comparison = String(valueA).localeCompare(
        String(valueB),
        "ja",
        {
          numeric: true,
          sensitivity: "base"
        }
      );
    }

    if (comparison === 0) {
      return compareNewestFirst(a, b);
    }

    return sortDirection === "desc"
      ? -comparison
      : comparison;
  }

  function applyCurrentSort() {
    if (!sortKey || !sortDirection) {
      filteredArticles.sort(compareNewestFirst);
      return;
    }

    filteredArticles.sort(compareSortValues);
  }

  function syncSortControls() {
    elements.sortSelects.forEach((select) => {
      if (select.dataset.sortKey === sortKey) {
        select.value = sortDirection;
      } else {
        select.value = "";
      }
    });
  }

  function configureLatestIssueButton() {
    if (!elements.latestIssueButton) {
      return;
    }

    const newestArticle = articles.find((article) => {
      return (
        valueOrEmpty(article["通号表示"]).trim() ||
        getIssueDateText(article)
      );
    });

    if (!newestArticle) {
      latestIssue = null;
      elements.latestIssueButton.disabled = true;
      return;
    }

    latestIssue = {
      issue: valueOrEmpty(newestArticle["通号表示"]).trim(),
      date: getIssueDateText(newestArticle)
    };

    elements.latestIssueButton.disabled = false;

    const detailParts = [];

    if (latestIssue.date) {
      detailParts.push(latestIssue.date);
    }

    if (latestIssue.issue) {
      detailParts.push(`通巻${latestIssue.issue}号`);
    }

    elements.latestIssueButton.title =
      detailParts.length > 0
        ? `${detailParts.join("・")}の記事を見る`
        : "最新号の記事を見る";
  }

  function showLatestIssue() {
    if (!latestIssue) {
      return;
    }

    if (latestIssue.issue) {
      drillDown("issue", latestIssue.issue);
      return;
    }

    if (latestIssue.date) {
      drillDown("date", latestIssue.date);
    }
  }

  function getMagazineBacknumberUrl(article) {
    const year = article?.__year;

    if (!Number.isFinite(year)) {
      return "https://www.nippyo.co.jp/";
    }

    if (year >= 2020) {
      return "https://www.nippyo.co.jp/shop/magazines/backnumber/3.html";
    }

    if (year >= 2010) {
      return "https://www.nippyo.co.jp/shop/magazines/backnumber/2010/3.html";
    }

    if (year >= 2000) {
      return "https://www.nippyo.co.jp/shop/magazines/backnumber/2000/3.html";
    }

    if (year >= 1990) {
      return "https://www.nippyo.co.jp/shop/magazines/backnumber/1990/3.html";
    }

    return "https://www.nippyo.co.jp/";
  }

  function renderIssuePurchaseCard() {
    if (
      !elements.issuePurchaseCard ||
      !elements.issuePurchaseTitle ||
      !elements.issuePurchaseLink
    ) {
      return;
    }

    const isIssueDrilldown =
      activeDrilldownKind === "date" ||
      activeDrilldownKind === "issue";

    if (!isIssueDrilldown || filteredArticles.length === 0) {
      elements.issuePurchaseCard.hidden = true;
      return;
    }

    const article = filteredArticles[0];
    const issueDate = getIssueDateText(article);
    const issue = valueOrEmpty(article["通号表示"]).trim();

    const parts = [];

    if (issueDate) {
      parts.push(`『経済セミナー』${issueDate}`);
    } else {
      parts.push("『経済セミナー』");
    }

    if (issue) {
      parts.push(`通巻${issue}号`);
    }

    elements.issuePurchaseTitle.textContent = parts.join("　");
    elements.issuePurchaseLink.href = getMagazineBacknumberUrl(article);
    elements.issuePurchaseCard.hidden = false;
  }

  function formatCitation(article) {
    const authors = article.__authors.join("・");
    const title =
      valueOrEmpty(article["記事タイトル"]).trim();
    const issueDate = getIssueDateText(article);
    const issue =
      valueOrEmpty(article["通号表示"]).trim();

    let citation = "";

    if (authors) {
      citation += authors;
    }

    if (title) {
      citation += `「${title}」`;
    }

    citation += "『経済セミナー』";

    if (issueDate) {
      citation += issueDate;
    }

    if (issue) {
      citation += `, 通巻${issue}号`;
    }

    return citation;
  }

  function renderCitationCopyButton(article) {
    const citation = formatCitation(article);

    return `
      <button
        type="button"
        class="citation-copy-button"
        data-copy-citation="${escapeHtml(citation)}"
        aria-label="書誌情報をコピー"
        title="書誌情報をコピー"
      >
        <svg
          class="citation-copy-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect
            x="8"
            y="8"
            width="11"
            height="11"
            rx="1.5"
          ></rect>
          <path
            d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-10A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17H8"
          ></path>
        </svg>
        <span
          class="citation-copy-done"
          aria-hidden="true"
        >✓</span>
      </button>
    `;
  }

  async function writeClipboardText(text) {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");

    textarea.remove();

    if (!copied) {
      throw new Error("Clipboard copy failed.");
    }
  }

  async function copyCitation(citation, button) {
    try {
      await writeClipboardText(citation);

      button.classList.add("is-copied");
      button.setAttribute("aria-label", "書誌情報をコピーしました");
      button.title = "コピーしました";

      window.setTimeout(() => {
        button.classList.remove("is-copied");
        button.setAttribute("aria-label", "書誌情報をコピー");
        button.title = "書誌情報をコピー";
      }, 1600);
    } catch (error) {
      console.error("Could not copy citation.", error);
      button.title = "コピーできませんでした";
    }
  }

  function buildStickyTableHeader() {
    if (
      !elements.stickyHeader ||
      !elements.stickyHeaderInner ||
      !elements.articleTable
    ) {
      return;
    }

    const originalHeader =
      elements.articleTable.querySelector("thead");

    if (!originalHeader) {
      return;
    }

    const originalCells = Array.from(
      originalHeader.querySelectorAll("th")
    );

    if (originalCells.length === 0) {
      return;
    }

    const tableWidth = elements.articleTable.scrollWidth;

    const stickyTable = document.createElement("table");
    stickyTable.className =
      "article-table sticky-header-table";
    stickyTable.style.width = `${tableWidth}px`;
    stickyTable.style.minWidth = `${tableWidth}px`;
    stickyTable.style.tableLayout = "fixed";

    const thead = document.createElement("thead");
    const row = document.createElement("tr");

    originalCells.forEach((cell) => {
      const stickyCell = document.createElement("th");
      const label =
        cell.querySelector(".sortable-heading > span")
          ?.textContent?.trim() ||
        cell.textContent.trim();

      const width = cell.getBoundingClientRect().width;

      stickyCell.textContent = label;
      stickyCell.style.width = `${width}px`;
      stickyCell.style.minWidth = `${width}px`;
      stickyCell.style.maxWidth = `${width}px`;

      row.appendChild(stickyCell);
    });

    thead.appendChild(row);
    stickyTable.appendChild(thead);

    elements.stickyHeaderInner.replaceChildren(
      stickyTable
    );
  }

  function syncStickyHeaderHorizontalPosition() {
    if (
      !elements.stickyHeaderInner ||
      !elements.tableWrap
    ) {
      return;
    }

    elements.stickyHeaderInner.style.transform =
      `translateX(-${elements.tableWrap.scrollLeft}px)`;
  }

  function updateStickyTableHeader() {
    stickyHeaderFrame = null;

    if (
      !elements.stickyHeader ||
      !elements.stickyHeaderInner ||
      !elements.tableWrap ||
      !elements.articleTable
    ) {
      return;
    }

    const originalHeader =
      elements.articleTable.querySelector("thead");

    if (!originalHeader) {
      elements.stickyHeader.hidden = true;
      return;
    }

    const headerRect =
      originalHeader.getBoundingClientRect();
    const wrapRect =
      elements.tableWrap.getBoundingClientRect();

    const shouldShow =
      headerRect.bottom <= 0 &&
      wrapRect.bottom > 56;

    if (!shouldShow) {
      elements.stickyHeader.hidden = true;
      return;
    }

    elements.stickyHeader.hidden = false;
    elements.stickyHeader.style.left =
      `${wrapRect.left}px`;
    elements.stickyHeader.style.width =
      `${wrapRect.width}px`;

    syncStickyHeaderHorizontalPosition();
  }

  function requestStickyTableHeaderUpdate() {
    if (stickyHeaderFrame != null) {
      return;
    }

    stickyHeaderFrame =
      window.requestAnimationFrame(
        updateStickyTableHeader
      );
  }

  function uniqueSorted(values, locale = "ja") {
    return Array.from(
      new Set(values.filter((value) => value !== ""))
    ).sort((a, b) =>
      String(a).localeCompare(String(b), locale, {
        numeric: true,
        sensitivity: "base"
      })
    );
  }

  function populateFilters() {
    const years = uniqueSorted(
      articles
        .map((article) => article.__year)
        .filter((year) => Number.isFinite(year))
        .map(String)
    ).map(Number);

    minYear = Math.min(...years);
    maxYear = Math.max(...years);

    elements.yearFrom.innerHTML = years
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");

    elements.yearTo.innerHTML = years
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");

    elements.yearFrom.value = String(minYear);
    elements.yearTo.value = String(maxYear);

    const articleTypes = uniqueSorted(
      articles.map((article) =>
        valueOrEmpty(article["記事種別"]).trim()
      )
    );

    elements.articleType.innerHTML = [
      '<option value="">すべて</option>',
      ...articleTypes.map(
        (type) =>
          `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`
      )
    ].join("");

    const seriesNames = uniqueSorted(
      articles.map((article) =>
        valueOrEmpty(article["特集・連載名"]).trim()
      )
    );

    elements.seriesList.innerHTML = seriesNames
      .map(
        (seriesName) =>
          `<option value="${escapeHtml(seriesName)}"></option>`
      )
      .join("");
  }

  function getIssueDateText(article) {
    return (
      valueOrEmpty(article["年・月号表示"]).trim() ||
      valueOrEmpty(article["刊行年月"]).trim()
    );
  }

  function ensureDrilldownClearButton() {
    let button = document.getElementById("clear-drilldown");

    if (button) {
      return button;
    }

    button = document.createElement("button");
    button.type = "button";
    button.id = "clear-drilldown";
    button.className = "drilldown-clear-button";
    button.hidden = true;
    button.textContent = "絞り込みを解除";

    elements.resultsStatus.insertAdjacentElement(
      "afterend",
      button
    );

    return button;
  }

  function getActiveDrilldownValue() {
    switch (activeDrilldownKind) {
      case "date":
        return exactIssueDate;

      case "issue":
        return exactIssueNumber;

      case "title":
        return exactTitle;

      case "author":
        return elements.author.value.trim();

      case "series":
        return elements.series.value.trim();

      case "type":
        return elements.articleType.value;

      default:
        return "";
    }
  }

  function renderDrilldownClearButton() {
    const button = ensureDrilldownClearButton();
    const value = getActiveDrilldownValue();

    button.hidden = !activeDrilldownKind || !value;
  }

  function resetFiltersForDrilldown() {
    elements.keyword.value = "";
    elements.author.value = "";
    elements.articleType.value = "";
    elements.series.value = "";

    if (minYear != null) {
      elements.yearFrom.value = String(minYear);
    }

    if (maxYear != null) {
      elements.yearTo.value = String(maxYear);
    }

    exactIssueDate = "";
    exactIssueNumber = "";
    exactTitle = "";
    activeDrilldownKind = "";

    sortKey = "";
    sortDirection = "";
    syncSortControls();

    currentPage = 1;
  }

  function drillDown(kind, value) {
    const cleanedValue = valueOrEmpty(value).trim();

    if (!cleanedValue || cleanedValue === "—") {
      return;
    }

    resetFiltersForDrilldown();
    activeDrilldownKind = kind;

    switch (kind) {
      case "date":
        exactIssueDate = cleanedValue;
        break;

      case "issue":
        exactIssueNumber = cleanedValue;
        break;

      case "title":
        exactTitle = cleanedValue;
        break;

      case "author":
        elements.author.value = cleanedValue;
        break;

      case "series":
        elements.series.value = cleanedValue;
        break;

      case "type":
        if (
          Array.from(elements.articleType.options).some(
            (option) => option.value === cleanedValue
          )
        ) {
          elements.articleType.value = cleanedValue;
        }
        break;

      default:
        return;
    }

    runSearch();

    document.querySelector(".results-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function renderDrilldownButton(kind, value, label = value) {
    const cleanedValue = valueOrEmpty(value).trim();

    if (!cleanedValue || cleanedValue === "—") {
      return escapeHtml(label || "—");
    }

    return `
      <button
        type="button"
        class="result-link"
        data-drill-kind="${escapeHtml(kind)}"
        data-drill-value="${escapeHtml(cleanedValue)}"
        title="この項目で記事を表示"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function getActiveDrilldownLabel() {
    const value = getActiveDrilldownValue();

    if (!value) {
      return "";
    }

    const labels = {
      date: "年月号",
      issue: "通巻番号",
      title: "記事タイトル",
      author: "著者名",
      series: "特集・連載等タイトル",
      type: "種別"
    };

    const label = labels[activeDrilldownKind];

    return label
      ? `${label}：${value}`
      : "";
  }

  function articleMatches(article) {
    if (
      exactIssueDate &&
      normalizeText(getIssueDateText(article)) !==
        normalizeText(exactIssueDate)
    ) {
      return false;
    }

    if (
      exactIssueNumber &&
      normalizeText(article["通号表示"]) !==
        normalizeText(exactIssueNumber)
    ) {
      return false;
    }

    if (
      exactTitle &&
      normalizeText(article["記事タイトル"]) !==
        normalizeText(exactTitle)
    ) {
      return false;
    }

    const keywordTerms = splitTerms(elements.keyword.value);
    const authorTerms = splitTerms(elements.author.value);
    const seriesTerms = splitTerms(elements.series.value);

    const selectedType = normalizeText(elements.articleType.value);

    const fromYear = Number(elements.yearFrom.value);
    const toYear = Number(elements.yearTo.value);

    if (
      Number.isFinite(article.__year) &&
      (article.__year < fromYear || article.__year > toYear)
    ) {
      return false;
    }

    if (
      selectedType &&
      normalizeText(article["記事種別"]) !== selectedType
    ) {
      return false;
    }

    const authorText = normalizeText(article.__authorsText);

    if (
      authorTerms.length > 0 &&
      !authorTerms.every((term) => authorText.includes(term))
    ) {
      return false;
    }

    const seriesText = normalizeText(article["特集・連載名"]);

    if (
      seriesTerms.length > 0 &&
      !seriesTerms.every((term) => seriesText.includes(term))
    ) {
      return false;
    }

    if (
      keywordTerms.length > 0 &&
      !keywordTerms.every((term) => article.__searchText.includes(term))
    ) {
      return false;
    }

    return true;
  }

  function runSearch({ resetPage = true, updateAddress = true } = {}) {
    if (Number(elements.yearFrom.value) > Number(elements.yearTo.value)) {
      const oldFrom = elements.yearFrom.value;
      elements.yearFrom.value = elements.yearTo.value;
      elements.yearTo.value = oldFrom;
    }

    filteredArticles = articles.filter(articleMatches);
    applyCurrentSort();

    if (resetPage) {
      currentPage = 1;
    }

    const totalPages = getTotalPages();

    if (currentPage > totalPages) {
      currentPage = Math.max(1, totalPages);
    }

    render();

    if (updateAddress) {
      updateUrl();
    }
  }

  function getTotalPages() {
    return Math.ceil(filteredArticles.length / PAGE_SIZE);
  }

  function getCurrentPageRows() {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredArticles.slice(start, start + PAGE_SIZE);
  }

  let isSyncingHorizontalScroll = false;

  function updateHorizontalScrollbars() {
    if (
      !elements.tableWrap ||
      !elements.articleTable ||
      !elements.topScrollbar ||
      !elements.topScrollbarInner
    ) {
      return;
    }

    const tableWidth = elements.articleTable.scrollWidth;
    const viewportWidth = elements.tableWrap.clientWidth;
    const hasHorizontalOverflow = tableWidth > viewportWidth + 1;

    elements.topScrollbarInner.style.width = `${tableWidth}px`;
    elements.topScrollbar.hidden = !hasHorizontalOverflow;

    if (!hasHorizontalOverflow) {
      elements.tableWrap.scrollLeft = 0;
      elements.topScrollbar.scrollLeft = 0;
      return;
    }

    elements.topScrollbar.scrollLeft = elements.tableWrap.scrollLeft;
  }

  function syncHorizontalScroll(source, target) {
    if (isSyncingHorizontalScroll || !source || !target) {
      return;
    }

    isSyncingHorizontalScroll = true;
    target.scrollLeft = source.scrollLeft;

    window.requestAnimationFrame(() => {
      isSyncingHorizontalScroll = false;
    });
  }

  function render() {
    elements.resultCount.textContent =
      filteredArticles.length.toLocaleString("ja-JP");

    if (elements.downloadFiltered) {
      elements.downloadFiltered.disabled =
        filteredArticles.length === 0;
    }

    renderTable();
    renderStatus();
    renderDrilldownClearButton();
    renderIssuePurchaseCard();
    renderPagination();

    window.requestAnimationFrame(() => {
      updateHorizontalScrollbars();
      buildStickyTableHeader();
      requestStickyTableHeaderUpdate();
    });
  }

  function renderTable() {
    if (filteredArticles.length === 0) {
      elements.tableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">
            条件に一致する記事はありません。
          </td>
        </tr>
      `;
      return;
    }

    const rows = getCurrentPageRows();

    elements.tableBody.innerHTML = rows
      .map((article) => {
        const issueDate =
          valueOrEmpty(article["年・月号表示"]).trim() ||
          valueOrEmpty(article["刊行年月"]).trim() ||
          "—";

        const issue =
          valueOrEmpty(article["通号表示"]).trim() || "—";

        const title =
          valueOrEmpty(article["記事タイトル"]).trim() || "—";

        const authors =
          article.__authorsText || "—";

        const series =
          valueOrEmpty(article["特集・連載名"]).trim() || "—";

        const type =
          valueOrEmpty(article["記事種別"]).trim() || "—";

        const authorLinks =
          article.__authors.length > 0
            ? article.__authors
                .map((author) =>
                  renderDrilldownButton(
                    "author",
                    author,
                    author
                  )
                )
                .join('<span class="result-link-separator">／</span>')
            : "—";

        return `
          <tr>
            <td class="cell-date">
              ${renderDrilldownButton("date", issueDate, issueDate)}
            </td>
            <td class="cell-issue">
              ${renderDrilldownButton("issue", issue, issue)}
            </td>
            <td class="cell-title">
              <div class="title-cell-content">
                <div class="title-cell-text">
                  ${renderDrilldownButton("title", title, title)}
                </div>
                ${renderCitationCopyButton(article)}
              </div>
            </td>
            <td class="cell-authors">
              ${authorLinks}
            </td>
            <td class="cell-series">
              ${renderDrilldownButton("series", series, series)}
            </td>
            <td class="cell-type">
              ${renderDrilldownButton("type", type, type)}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderStatus() {
    if (filteredArticles.length === 0) {
      elements.resultsStatus.textContent = "0件";
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(
      currentPage * PAGE_SIZE,
      filteredArticles.length
    );

    const drilldownLabel = getActiveDrilldownLabel();

    elements.resultsStatus.textContent =
      `${filteredArticles.length.toLocaleString("ja-JP")}件中 ` +
      `${start.toLocaleString("ja-JP")}–${end.toLocaleString("ja-JP")}件を表示` +
      (drilldownLabel ? ` ／ 絞り込み：${drilldownLabel}` : "");
  }

  function renderPagination() {
    const totalPages = getTotalPages();

    if (totalPages <= 1) {
      elements.pagination.innerHTML = "";
      return;
    }

    const items = buildPageItems(currentPage, totalPages);

    const previousDisabled = currentPage === 1;
    const nextDisabled = currentPage === totalPages;

    elements.pagination.innerHTML = `
      <button
        class="page-button page-prev"
        type="button"
        data-page="${currentPage - 1}"
        ${previousDisabled ? "disabled" : ""}
      >
        ‹ 前へ
      </button>

      <div class="page-numbers">
        ${items
          .map((item) => {
            if (item === "ellipsis") {
              return '<span class="page-ellipsis" aria-hidden="true">…</span>';
            }

            const isCurrent = item === currentPage;

            return `
              <button
                class="page-button page-number${isCurrent ? " is-current" : ""}"
                type="button"
                data-page="${item}"
                ${isCurrent ? 'aria-current="page"' : ""}
              >
                ${item}
              </button>
            `;
          })
          .join("")}
      </div>

      <button
        class="page-button page-next"
        type="button"
        data-page="${currentPage + 1}"
        ${nextDisabled ? "disabled" : ""}
      >
        次へ ›
      </button>
    `;
  }

  function buildPageItems(current, total) {
    if (total <= 9) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = new Set([
      1,
      2,
      total - 1,
      total,
      current - 2,
      current - 1,
      current,
      current + 1,
      current + 2
    ]);

    const validPages = Array.from(pages)
      .filter((page) => page >= 1 && page <= total)
      .sort((a, b) => a - b);

    const result = [];

    validPages.forEach((page, index) => {
      if (
        index > 0 &&
        page - validPages[index - 1] > 1
      ) {
        result.push("ellipsis");
      }

      result.push(page);
    });

    return result;
  }

  function changePage(page) {
    const totalPages = getTotalPages();

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > totalPages ||
      page === currentPage
    ) {
      return;
    }

    currentPage = page;
    render();
    updateUrl();

    document.querySelector(".results-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function clearSearch() {
    elements.keyword.value = "";
    elements.author.value = "";
    elements.articleType.value = "";
    elements.series.value = "";

    exactIssueDate = "";
    exactIssueNumber = "";
    exactTitle = "";
    activeDrilldownKind = "";

    if (minYear != null) {
      elements.yearFrom.value = String(minYear);
    }

    if (maxYear != null) {
      elements.yearTo.value = String(maxYear);
    }

    runSearch();
    elements.keyword.focus();
  }

  function updateUrl() {
    const params = new URLSearchParams();

    const keyword = elements.keyword.value.trim();
    const author = elements.author.value.trim();
    const series = elements.series.value.trim();
    const type = elements.articleType.value;

    if (keyword) {
      params.set("q", keyword);
    }

    if (author) {
      params.set("author", author);
    }

    if (
      minYear != null &&
      Number(elements.yearFrom.value) !== minYear
    ) {
      params.set("from", elements.yearFrom.value);
    }

    if (
      maxYear != null &&
      Number(elements.yearTo.value) !== maxYear
    ) {
      params.set("to", elements.yearTo.value);
    }

    if (type) {
      params.set("type", type);
    }

    if (series) {
      params.set("series", series);
    }

    if (exactIssueDate) {
      params.set("issueDate", exactIssueDate);
    }

    if (exactIssueNumber) {
      params.set("issue", exactIssueNumber);
    }

    if (exactTitle) {
      params.set("title", exactTitle);
    }

    if (activeDrilldownKind) {
      params.set("drill", activeDrilldownKind);
    }

    if (sortKey && sortDirection) {
      params.set("sort", sortKey);
      params.set("dir", sortDirection);
    }

    if (currentPage > 1) {
      params.set("page", String(currentPage));
    }

    const query = params.toString();
    const newUrl =
      window.location.pathname +
      (query ? `?${query}` : "") +
      window.location.hash;

    window.history.replaceState(null, "", newUrl);
  }

  function applyUrlParameters() {
    const params = new URLSearchParams(window.location.search);

    elements.keyword.value = params.get("q") || "";
    elements.author.value = params.get("author") || "";
    elements.series.value = params.get("series") || "";

    exactIssueDate = params.get("issueDate") || "";
    exactIssueNumber = params.get("issue") || "";
    exactTitle = params.get("title") || "";

    const requestedDrill = params.get("drill") || "";
    const allowedDrillKinds = new Set([
      "date",
      "issue",
      "title",
      "author",
      "series",
      "type"
    ]);

    activeDrilldownKind = allowedDrillKinds.has(requestedDrill)
      ? requestedDrill
      : "";

    const requestedType = params.get("type");

    if (
      requestedType &&
      Array.from(elements.articleType.options).some(
        (option) => option.value === requestedType
      )
    ) {
      elements.articleType.value = requestedType;
    }

    const requestedFrom = Number(params.get("from"));
    const requestedTo = Number(params.get("to"));

    if (
      Number.isFinite(requestedFrom) &&
      requestedFrom >= minYear &&
      requestedFrom <= maxYear
    ) {
      elements.yearFrom.value = String(requestedFrom);
    }

    if (
      Number.isFinite(requestedTo) &&
      requestedTo >= minYear &&
      requestedTo <= maxYear
    ) {
      elements.yearTo.value = String(requestedTo);
    }

    const requestedSort = params.get("sort") || "";
    const requestedDirection = params.get("dir") || "";

    const allowedSortKeys = new Set([
      "date",
      "issue",
      "title",
      "authors",
      "series",
      "type"
    ]);

    if (
      allowedSortKeys.has(requestedSort) &&
      (requestedDirection === "asc" ||
       requestedDirection === "desc")
    ) {
      sortKey = requestedSort;
      sortDirection = requestedDirection;
    }

    syncSortControls();

    const requestedPage = Number(params.get("page"));

    if (
      Number.isInteger(requestedPage) &&
      requestedPage >= 1
    ) {
      currentPage = requestedPage;
    }
  }

  function csvEscape(value) {
    const text = valueOrEmpty(value);

    if (
      text.includes(",") ||
      text.includes('"') ||
      text.includes("\n") ||
      text.includes("\r")
    ) {
      return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
  }

  function downloadFilteredCsv() {
    if (filteredArticles.length === 0) {
      return;
    }

    const rows = [
      sourceColumns.join(","),
      ...filteredArticles.map((article) =>
        sourceColumns
          .map((column) => csvEscape(article[column]))
          .join(",")
      )
    ];

    // BOM付きUTF-8にしてExcelでも日本語が文字化けしにくくする。
    const blob = new Blob(
      ["\uFEFF" + rows.join("\r\n")],
      {
        type: "text/csv;charset=utf-8"
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "keisemi-search-results.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    elements.searchButton.addEventListener("click", () =>
      runSearch()
    );

    if (elements.tableWrap && elements.topScrollbar) {
      elements.tableWrap.addEventListener("scroll", () => {
        syncHorizontalScroll(
          elements.tableWrap,
          elements.topScrollbar
        );
        syncStickyHeaderHorizontalPosition();
      });

      elements.topScrollbar.addEventListener("scroll", () => {
        syncHorizontalScroll(
          elements.topScrollbar,
          elements.tableWrap
        );
      });

      window.addEventListener("resize", () => {
        updateHorizontalScrollbars();
        buildStickyTableHeader();
        requestStickyTableHeaderUpdate();
      });

      window.addEventListener(
        "scroll",
        requestStickyTableHeaderUpdate,
        { passive: true }
      );

      if ("ResizeObserver" in window && elements.articleTable) {
        const tableResizeObserver = new ResizeObserver(
          updateHorizontalScrollbars
        );

        tableResizeObserver.observe(elements.articleTable);
      }
    }

    if (elements.latestIssueButton) {
      elements.latestIssueButton.addEventListener(
        "click",
        showLatestIssue
      );
    }

    elements.keyword.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });

    elements.author.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });

    elements.series.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });

    [
      elements.yearFrom,
      elements.yearTo,
      elements.articleType
    ].forEach((element) => {
      element.addEventListener("change", () =>
        runSearch()
      );
    });

    elements.clearButton.addEventListener(
      "click",
      clearSearch
    );

    if (elements.downloadFiltered) {
      elements.downloadFiltered.addEventListener(
        "click",
        downloadFilteredCsv
      );
    }

    elements.tableBody.addEventListener("click", (event) => {
      const copyButton =
        event.target.closest("[data-copy-citation]");

      if (copyButton) {
        copyCitation(
          copyButton.dataset.copyCitation,
          copyButton
        );
        return;
      }

      const button =
        event.target.closest("[data-drill-kind]");

      if (!button) {
        return;
      }

      drillDown(
        button.dataset.drillKind,
        button.dataset.drillValue
      );
    });

    ensureDrilldownClearButton().addEventListener(
      "click",
      () => {
        resetFiltersForDrilldown();
        runSearch();

        document.querySelector(".results-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    );

    elements.sortSelects.forEach((select) => {
      select.addEventListener("change", () => {
        const direction = select.value;

        if (direction) {
          sortKey = select.dataset.sortKey;
          sortDirection = direction;
        } else {
          sortKey = "";
          sortDirection = "";
        }

        syncSortControls();

        currentPage = 1;
        applyCurrentSort();
        render();
        updateUrl();
      });
    });

    elements.pagination.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");

      if (!button || button.disabled) {
        return;
      }

      changePage(Number(button.dataset.page));
    });
  }

  function escapeHtml(value) {
    return valueOrEmpty(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadLastUpdated() {
    if (!elements.lastUpdated) {
      return;
    }

    try {
      const response = await fetch("data/last-updated.txt", {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load last-updated.txt: HTTP ${response.status}`
        );
      }

      const dateText = (await response.text()).trim();

      elements.lastUpdated.textContent = dateText || "—";
    } catch (error) {
      console.warn("Could not load last updated date.", error);
      elements.lastUpdated.textContent = "—";
    }
  }

  function showError(error) {
    console.error(error);

    elements.resultCount.textContent = "—";

    elements.tableBody.innerHTML = `
      <tr class="error-row">
        <td colspan="6">
          記事データを読み込めませんでした。
          ページを再読み込みしても解決しない場合は、
          データ生成処理を確認してください。
        </td>
      </tr>
    `;

    elements.resultsStatus.textContent =
      "記事データの読み込みに失敗しました。";

    elements.pagination.innerHTML = "";

    if (elements.downloadFiltered) {
      elements.downloadFiltered.disabled = true;
    }
  }

  async function initialize() {
    loadLastUpdated();

    try {
      const response = await fetch(DATA_URL, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load ${DATA_URL}: HTTP ${response.status}`
        );
      }

      const rawArticles = await response.json();

      if (!Array.isArray(rawArticles)) {
        throw new Error("articles.json is not an array.");
      }

      articles = rawArticles
        .map(prepareArticle)
        .sort(compareNewestFirst);

      populateFilters();
      configureLatestIssueButton();
      applyUrlParameters();
      bindEvents();

      runSearch({
        resetPage: false,
        updateAddress: false
      });

      const totalPages = getTotalPages();

      if (currentPage > totalPages) {
        currentPage = Math.max(1, totalPages);
        render();
      }

      updateUrl();
    } catch (error) {
      showError(error);
    }
  }

  initialize();
})();
