const state = {
  rawRows: [],
  normalizedRows: [],
  files: [],
  sourceMode: "none",
  filters: {
    brand: "All",
    campaignType: "All",
    language: "All",
    model: "All",
  },
};

const metricCatalog = [
  { key: "spend", label: "Spend", kind: "currency" },
  { key: "impressions", label: "Impressions", kind: "integer" },
  { key: "landingPageViews", label: "Landing Page Views", kind: "integer" },
  { key: "ctr", label: "CTR", kind: "percent" },
  { key: "cpm", label: "CPM", kind: "currency" },
  { key: "costPerLandingPageView", label: "Cost per Landing Page View", kind: "currency" },
  { key: "subscriptions", label: "Subscriptions", kind: "integer" },
  { key: "addsToCart", label: "Adds to Cart", kind: "integer" },
  { key: "costPerSubscription", label: "Cost per Subscription", kind: "currency" },
  { key: "costPerAddToCart", label: "Cost per Add to Cart", kind: "currency" },
];

const dom = {
  fileInput: document.getElementById("file-input"),
  loadDataFolderButton: document.getElementById("load-data-folder"),
  refreshDataFolderButton: document.getElementById("refresh-data-folder"),
  resetButton: document.getElementById("reset-filters"),
  brandFilter: document.getElementById("brand-filter"),
  campaignFilter: document.getElementById("campaign-filter"),
  languageFilter: document.getElementById("language-filter"),
  modelFilter: document.getElementById("model-filter"),
  kpiGrid: document.getElementById("kpi-grid"),
  trendChart: document.getElementById("trend-chart"),
  trendTable: document.getElementById("trend-table"),
  campaignBreakdown: document.getElementById("campaign-breakdown"),
  campaignTable: document.getElementById("campaign-table"),
};

const headerAliases = {
  sourceWorkbook: ["source workbook"],
  brand: ["brand", "account", "advertiser", "make"],
  date: ["date", "day", "month", "reporting starts", "start date", "period start"],
  campaignType: ["campaign type", "objective", "campaign objective", "campaign_category", "campaign category"],
  language: ["language", "lang", "locale"],
  model: ["model", "vehicle model", "car model", "product model"],
  impressions: ["impressions"],
  landingPageViews: ["landing page views", "lpv", "landing_page_views"],
  spend: ["amount spent", "spend", "amount spent (cad)", "spend (cad)", "cost"],
  ctr: ["ctr", "click-through rate", "link click-through rate", "average of ctr (link click-through rate)"],
  cpm: ["cpm", "cost per 1,000 impressions", "average of cpm (cost per 1,000 impressions)(cad)"],
  costPerLandingPageView: [
    "cost per landing page view",
    "cost per landing page view (cad)",
    "average of cost per landing page view (cad)",
    "cost per lpv",
  ],
  subscriptions: ["subscriptions", "sum of subscriptions"],
  addsToCart: ["adds to cart", "sum of adds to cart", "add to cart"],
  costPerSubscription: ["cost per subscription", "cost per subscription (cad)", "average of cost per subscription (cad)"],
  costPerAddToCart: ["cost per add to cart", "cost per add to cart (cad)", "average of cost per add to cart (cad)"],
};

bootstrap();

function bootstrap() {
  dom.fileInput.addEventListener("change", handleFilesSelected);
  dom.loadDataFolderButton.addEventListener("click", loadDataFolderFiles);
  dom.refreshDataFolderButton.addEventListener("click", refreshDataFolderFiles);
  dom.resetButton.addEventListener("click", resetFilters);

  bindFilter(dom.brandFilter, "brand");
  bindFilter(dom.campaignFilter, "campaignType");
  bindFilter(dom.languageFilter, "language");
  bindFilter(dom.modelFilter, "model");

  renderEmptyState();
  loadDataFolderFiles();
}

function bindFilter(select, key) {
  select.addEventListener("change", (event) => {
    state.filters[key] = event.target.value;
    render();
  });
}

async function handleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const filePayloads = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      rows: parseCSV(await file.text()),
    }))
  );

  state.sourceMode = "upload";
  commitLoadedFiles(filePayloads);
}

async function loadDataFolderFiles() {
  try {
    const response = await fetch("/api/files");
    if (response.ok) {
      const payload = await response.json();
      if (!Array.isArray(payload.files) || !payload.files.length) {
        renderEmptyDataFolder("No CSV files were found in the data folder yet.");
        return;
      }

      state.sourceMode = "data-folder";
      commitLoadedFiles(payload.files);
      return;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    try {
      const files = await loadStaticManifestFiles();
      if (!files.length) {
        renderEmptyDataFolder("No CSV files were found in the data folder yet.");
        return;
      }
      state.sourceMode = "data-folder";
      commitLoadedFiles(files);
    } catch (fallbackError) {
      renderEmptyDataFolder("The data folder loader needs either the local server (`node server.js`) or the static Vercel manifest in `data/manifest.json`.");
    }
  }
}

async function refreshDataFolderFiles() {
  if (state.sourceMode !== "data-folder") {
    await loadDataFolderFiles();
    return;
  }
  await loadDataFolderFiles();
}

async function loadStaticManifestFiles() {
  const manifestResponse = await fetch("./data/manifest.json", { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error(`HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const fileNames = Array.isArray(manifest.files) ? manifest.files : [];
  return Promise.all(
    fileNames.map(async (name) => {
      const response = await fetch(`./data/${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        name,
        rows: parseCSV(await response.text()),
      };
    })
  );
}

function commitLoadedFiles(filePayloads) {
  state.files = filePayloads;
  state.rawRows = filePayloads.flatMap((payload) => payload.rows.map((row) => ({ ...row, __sourceFile: payload.name })));
  state.normalizedRows = normalizeRows(state.rawRows);
  resetFilters();
  render();
}

function resetFilters() {
  state.filters = {
    brand: "All",
    campaignType: "All",
    language: "All",
    model: "All",
  };
  syncFilterValues();
  render();
}

function syncFilterValues() {
  dom.brandFilter.value = state.filters.brand;
  dom.campaignFilter.value = state.filters.campaignType;
  dom.languageFilter.value = state.filters.language;
  dom.modelFilter.value = state.filters.model;
}

function render() {
  if (!state.normalizedRows.length) {
    renderEmptyState();
    return;
  }

  populateFilters();
  syncFilterValues();

  const filteredRows = applyFilters(state.normalizedRows);
  if (!filteredRows.length) {
    renderNoMatches();
    return;
  }

  renderKpis(filteredRows);
  renderTrendSection(filteredRows);
  renderCampaignBreakdown(filteredRows);
}

function renderEmptyState() {
  dom.kpiGrid.innerHTML = "";
  dom.trendChart.innerHTML = emptyCard("Upload CSV files to see monthly performance trends.");
  dom.trendTable.innerHTML = "";
  dom.campaignBreakdown.innerHTML = emptyCard("Campaign type breakdown will appear here.");
  dom.campaignTable.innerHTML = "";
}

function renderEmptyDataFolder(message) {
  dom.kpiGrid.innerHTML = "";
  dom.trendChart.innerHTML = emptyCard(message);
  dom.trendTable.innerHTML = "";
  dom.campaignBreakdown.innerHTML = emptyCard("Campaign type breakdown will appear here.");
  dom.campaignTable.innerHTML = "";
}

function renderNoMatches() {
  dom.kpiGrid.innerHTML = "";
  dom.trendChart.innerHTML = emptyCard("No rows match the current filter combination.");
  dom.trendTable.innerHTML = "";
  dom.campaignBreakdown.innerHTML = emptyCard("Try widening the campaign, model, or date filters.");
  dom.campaignTable.innerHTML = "";
}

function populateFilters() {
  populateSelect(dom.brandFilter, uniqueValues(state.normalizedRows.map((row) => row.brand)));
  populateSelect(dom.campaignFilter, uniqueValues(getRowsForFilterOptions("campaignType").map((row) => row.campaignType)));
  populateSelect(
    dom.languageFilter,
    uniqueValues(getRowsForFilterOptions("language").map((row) => row.language)).filter((value) => value !== "total")
  );
  populateSelect(dom.modelFilter, uniqueValues(getRowsForFilterOptions("model").map((row) => row.model)));
}

function populateSelect(select, values, labelFormatter = (value) => value) {
  const cleanedValues = values.filter(Boolean);
  const currentValue = select.value || "All";
  const options = ["All", ...cleanedValues.filter((value) => value !== "total")];
  select.innerHTML = options
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelFormatter(value))}</option>`)
    .join("");
  select.value = options.includes(currentValue) ? currentValue : "All";
}

function applyFilters(rows) {
  return rows.filter((row) => {
    if (state.filters.brand !== "All" && row.brand !== state.filters.brand) return false;
    if (state.filters.campaignType !== "All" && row.campaignType !== state.filters.campaignType) return false;
    if (state.filters.language === "All") {
      if (row.language !== "total" && row.language !== "unknown") return false;
    } else if (row.language !== state.filters.language) {
      return false;
    }
    if (state.filters.model !== "All" && row.model !== state.filters.model) return false;
    return true;
  });
}

function getRowsForFilterOptions(excludedKey) {
  return state.normalizedRows.filter((row) => {
    if (excludedKey !== "brand" && state.filters.brand !== "All" && row.brand !== state.filters.brand) return false;
    if (excludedKey !== "campaignType" && state.filters.campaignType !== "All" && row.campaignType !== state.filters.campaignType) return false;
    if (excludedKey !== "language") {
      if (state.filters.language === "All") {
        if (row.language !== "total" && row.language !== "unknown") return false;
      } else if (row.language !== state.filters.language) {
        return false;
      }
    }
    if (excludedKey !== "model" && state.filters.model !== "All" && row.model !== state.filters.model) return false;
    return true;
  });
}

function renderKpis(rows) {
  const totals = aggregateMetrics(rows);
  const distinctMonths = uniqueValues(rows.map((row) => row.monthKey).filter(Boolean)).length;
  const totalCampaigns = uniqueValues(rows.map((row) => row.campaignType)).length;
  const avgCtr = safeAverage(rows.map((row) => row.ctr));
  const avgCplpv = safeAverage(rows.map((row) => row.costPerLandingPageView).filter((value) => Number.isFinite(value)));

  const cards = [
    { label: "Landing Page Views", value: formatValue(totals.landingPageViews, "integer"), note: `${distinctMonths || 0} tracked months` },
    { label: "Add to Wishlist", value: formatValue(totals.addsToCart, "integer"), note: `${totalCampaigns || 0} campaign types` },
    { label: "Average CTR", value: formatValue(avgCtr, "percent"), note: "Average across filtered rows" },
    { label: "Avg Cost per LPV", value: formatValue(avgCplpv, "currency"), note: "Average across filtered rows" },
  ];

  dom.kpiGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card">
          <div class="kpi-label">${escapeHtml(card.label)}</div>
          <div class="kpi-value">${escapeHtml(card.value)}</div>
          <div class="kpi-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function renderTrendSection(rows) {
  const chartDimension = getChartDimension(rows);
  const sourceRows = rows.filter((row) => hasMetricData(row, ["landingPageViews", "addsToCart", "costPerAddToCart"]));
  const ordered = aggregateForCharts(sourceRows, chartDimension).map((entry) => ({
      label: entry.label,
      landingPageViews: entry.metrics.landingPageViews,
      addsToCart: entry.metrics.addsToCart,
      costPerAddToCart: entry.metrics.costPerAddToCart,
    }));

  dom.trendChart.innerHTML = ordered.length
    ? ordered.length === 1
      ? singleMetricProfileChart({
          seriesLabel: formatChartLabel(ordered[0].label, chartDimension),
          points: [
            { label: "Landing page views", value: ordered[0].landingPageViews, kind: "integer", color: "#3d7ee8" },
            { label: "Wishlist", value: ordered[0].addsToCart, kind: "integer", color: "#e74c3c" },
            { label: "CPAW", value: ordered[0].costPerAddToCart, kind: "currency", color: "#f4b400" },
          ],
        })
      : multiSeriesChart({
          labels: ordered.map((entry) => formatChartLabel(entry.label, chartDimension)),
          leftSeries: [
            { label: "LPV", color: "#3d7ee8", kind: "integer", values: ordered.map((entry) => entry.landingPageViews) },
            { label: "Wishlist", color: "#e74c3c", kind: "integer", values: ordered.map((entry) => entry.addsToCart) },
          ],
          rightSeries: [{ label: "CPAW", color: "#f4b400", kind: "currency", values: ordered.map((entry) => entry.costPerAddToCart) }],
        })
    : emptyCard("Landing page view and add-to-wishlist metrics were not found for the selected filters.");

  dom.trendTable.innerHTML = ordered.length
    ? tableHtml(
        [chartDimension === "monthKey" ? "Month" : "Campaign Type", "LPV", "Wishlist", "CPAW"],
        ordered.map((entry) => [
          formatChartLabel(entry.label, chartDimension),
          formatValue(entry.landingPageViews, "integer"),
          formatValue(entry.addsToCart, "integer"),
          formatValue(entry.costPerAddToCart, "currency"),
        ])
      )
    : "";
}

function renderCampaignBreakdown(rows) {
  const chartDimension = getChartDimension(rows);
  const sourceRows = rows.filter((row) =>
    hasMetricData(row, ["cpm", "ctr", "costPerLandingPageView"])
  );
  const ordered = aggregateForCharts(sourceRows, chartDimension).map((entry) => ({
      label: entry.label,
      cpm: entry.metrics.cpm,
      ctr: entry.metrics.ctr,
      costPerLandingPageView: entry.metrics.costPerLandingPageView,
    }));

  dom.campaignBreakdown.innerHTML = ordered.length
    ? ordered.length === 1
      ? singleMetricProfileChart({
          seriesLabel: formatChartLabel(ordered[0].label, chartDimension),
          points: [
            { label: "CPM", value: ordered[0].cpm, kind: "currency", color: "#3d7ee8" },
            { label: "CTR", value: ordered[0].ctr, kind: "percent", color: "#e74c3c" },
            { label: "CPLPV", value: ordered[0].costPerLandingPageView, kind: "currency", color: "#f4b400" },
          ],
        })
      : multiSeriesChart({
          labels: ordered.map((entry) => formatChartLabel(entry.label, chartDimension)),
          leftSeries: [{ label: "CTR", color: "#e74c3c", kind: "percent", values: ordered.map((entry) => entry.ctr) }],
          rightSeries: [
            { label: "CPM", color: "#3d7ee8", kind: "currency", values: ordered.map((entry) => entry.cpm) },
            { label: "CPLPV", color: "#f4b400", kind: "currency", values: ordered.map((entry) => entry.costPerLandingPageView) },
          ],
        })
    : emptyCard("Efficiency metrics were not found in the loaded files.");

  dom.campaignTable.innerHTML = ordered.length
    ? tableHtml(
        [chartDimension === "monthKey" ? "Month" : "Campaign Type", "CPM", "CTR", "CPLPV"],
        ordered.map((entry) => [
          formatChartLabel(entry.label, chartDimension),
          formatValue(entry.cpm, "currency"),
          formatValue(entry.ctr, "percent"),
          formatValue(entry.costPerLandingPageView, "currency"),
        ])
      )
    : "";
}

function aggregateByDimension(rows, key) {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = row[key] || "Unknown";
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(row);
  });

  return Array.from(grouped.entries()).map(([label, groupedRows]) => ({
    label,
    metrics: aggregateMetrics(groupedRows),
  }));
}

function getChartDimension(rows) {
  const months = uniqueValues(rows.map((row) => row.monthKey).filter(Boolean));
  return months.length > 1 ? "monthKey" : "campaignType";
}

function aggregateForCharts(rows, dimension) {
  const aggregated = aggregateByDimension(rows, dimension).filter((entry) => entry.label && entry.label !== "Unknown");
  if (dimension === "monthKey") {
    return aggregated.sort((left, right) => left.label.localeCompare(right.label));
  }
  return aggregated.sort((left, right) => left.label.localeCompare(right.label));
}

function formatChartLabel(label, dimension) {
  if (dimension === "monthKey") return formatMonthKey(label);
  return label;
}

function hasMetricData(row, keys) {
  return keys.some((key) => {
    const value = row[key];
    return value !== "" && value != null && !(typeof value === "number" && Number.isNaN(value));
  });
}

function aggregateMetrics(rows) {
  const totals = Object.fromEntries(metricCatalog.map((metric) => [metric.key, 0]));
  const averageKeys = new Set(["ctr", "cpm", "costPerLandingPageView", "costPerSubscription", "costPerAddToCart"]);
  const averageBuckets = Object.fromEntries(Array.from(averageKeys).map((key) => [key, []]));

  rows.forEach((row) => {
    metricCatalog.forEach((metric) => {
      const value = row[metric.key];
      if (averageKeys.has(metric.key)) {
        if (Number.isFinite(value)) averageBuckets[metric.key].push(value);
      } else {
        totals[metric.key] += value || 0;
      }
    });
  });

  averageKeys.forEach((key) => {
    totals[key] = safeAverage(averageBuckets[key]);
  });

  return totals;
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const sourceBrand = readField(row, "brand");
    const sourceDate = readField(row, "date");
    const parsedDate = parseLooseDate(sourceDate);
    const fileBrand = row.__sourceFile ? inferBrandFromFilename(row.__sourceFile) : "";

    return {
      __sourceFile: row.__sourceFile || "",
      sourceWorkbook: readField(row, "sourceWorkbook") || "",
      brand: sourceBrand || fileBrand || "Unknown",
      campaignType: readField(row, "campaignType") || "Unknown",
      language: readField(row, "language") || "Unknown",
      model: readField(row, "model") || "Unknown",
      date: parsedDate,
      monthKey: parsedDate ? `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, "0")}` : "",
      impressions: parseNumber(readField(row, "impressions")),
      landingPageViews: parseNumber(readField(row, "landingPageViews")),
      spend: parseNumber(readField(row, "spend")),
      ctr: parsePercent(readField(row, "ctr")),
      cpm: parseNumber(readField(row, "cpm")),
      costPerLandingPageView: parseNumber(readField(row, "costPerLandingPageView")),
      subscriptions: parseNumber(readField(row, "subscriptions")),
      addsToCart: parseNumber(readField(row, "addsToCart")),
      costPerSubscription: parseNumber(readField(row, "costPerSubscription")),
      costPerAddToCart: parseNumber(readField(row, "costPerAddToCart")),
    };
  });
}

function readField(row, targetKey) {
  const aliases = (headerAliases[targetKey] || []).map((alias) => normalizeHeader(alias));
  const entries = Object.entries(row);
  const match = entries.find(([header]) => aliases.includes(normalizeHeader(header)));
  return match ? match[1] : "";
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/_/g, " ");
}

function parseCSV(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((cell) => String(cell).trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
}

function parseNumber(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/CAD/gi, "")
    .replace(/\s+/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = parseNumber(raw.replace("%", ""));
  if (!Number.isFinite(numeric)) return null;
  return raw.includes("%") ? numeric / 100 : numeric > 1 ? numeric / 100 : numeric;
}

function parseLooseDate(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = String(value).trim();
  const monthOnly = normalized.match(/^(\d{4})[-/](\d{1,2})$/);
  if (monthOnly) {
    return new Date(Date.UTC(Number(monthOnly[1]), Number(monthOnly[2]) - 1, 1));
  }

  const namedMonth = normalized.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (namedMonth) {
    const parsed = new Date(`${namedMonth[1]} 1, ${namedMonth[2]}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function inferBrandFromFilename(filename) {
  const lower = String(filename).toLowerCase();
  if (lower.includes("polestar")) return "Polestar";
  if (lower.includes("hyundai")) return "Hyundai";
  if (lower.includes("mitsubishi")) return "Mitsubishi";
  return "";
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter((value) => value && value !== "Unknown"))).sort((a, b) => a.localeCompare(b));
}

function safeAverage(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function formatValue(value, kind) {
  if (!Number.isFinite(value)) return "0";
  if (kind === "currency") {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(value);
  }
  if (kind === "percent") {
    return new Intl.NumberFormat("en-CA", { style: "percent", maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(value);
}

function formatDelta(value, kind) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatValue(value, kind)}`;
}

function formatMonthKey(value) {
  if (!value || value === "All") return value;
  const [year, month] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function byAbsoluteMax(entries, key) {
  return entries.reduce((best, entry) => {
    if (!best) return entry;
    return Math.abs(entry[key]) > Math.abs(best[key]) ? entry : best;
  }, null);
}

function tableHtml(headers, rows) {
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (cells) =>
              `<tr>${cells.map((cell, index) => `<td>${index === 0 ? escapeHtml(String(cell)) : escapeHtml(String(cell))}</td>`).join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function emptyCard(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function multiSeriesChart({ labels, leftSeries, rightSeries }) {
  const width = 860;
  const height = 420;
  const margin = { top: 36, right: 108, bottom: 104, left: 96 };
  const usableWidth = width - margin.left - margin.right;
  const usableHeight = height - margin.top - margin.bottom;
  const leftMax = computeAxisMax(leftSeries);
  const rightMax = computeAxisMax(rightSeries);
  const tickCount = 4;
  const combinedSeries = [...leftSeries.map((series) => ({ ...series, axis: "left" })), ...rightSeries.map((series) => ({ ...series, axis: "right" }))];

  const xPoints = labels.map((label, index) => ({
    label,
    x: labels.length === 1 ? margin.left + usableWidth / 2 : margin.left + (usableWidth * index) / Math.max(labels.length - 1, 1),
  }));

  const gridlines = Array.from({ length: tickCount + 1 }, (_, index) => {
    const ratio = index / tickCount;
    const y = margin.top + usableHeight - ratio * usableHeight;
    const leftValue = leftMax * ratio;
    const rightValue = rightMax * ratio;
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#cfc3b5" stroke-width="1" />
      <text x="${margin.left - 12}" y="${y + 5}" text-anchor="end" font-size="11" fill="#6f665d">
        ${escapeHtml(formatAxisValue(leftValue, leftSeries[0]?.kind || "integer"))}
      </text>
      <text x="${width - margin.right + 12}" y="${y + 5}" text-anchor="start" font-size="11" fill="#6f665d">
        ${escapeHtml(formatAxisValue(rightValue, rightSeries[0]?.kind || "currency"))}
      </text>
    `;
  }).join("");

  const axisLabels = xPoints
    .map(
      (point) => `
        <text
          x="${point.x}"
          y="${height - 24}"
          text-anchor="middle"
          font-size="14"
          font-weight="600"
          fill="#6f665d"
          ${labels.length > 4 ? `transform="rotate(-28 ${point.x} ${height - 24})"` : ""}
        >
          ${escapeHtml(point.label)}
        </text>
      `
    )
    .join("");

  const laidOutSeries = combinedSeries.map((series, seriesIndex) => {
    const axisMax = series.axis === "left" ? leftMax : rightMax;
    const points = series.values.map((value, index) => {
      const x = xPoints[index].x;
      const y = margin.top + usableHeight - ((value || 0) / axisMax) * usableHeight;
      return { x, y, value, index, seriesIndex, kind: series.kind, label: series.label, color: series.color };
    });
    return { ...series, points };
  });

  const labelLayouts = computeLabelLayouts(laidOutSeries, xPoints, {
    top: margin.top + 14,
    bottom: height - margin.bottom - 12,
  });

  const seriesMarkup = laidOutSeries
    .map((series) => {
      const axisMax = series.axis === "left" ? leftMax : rightMax;
      const points = series.points;
      const polyline =
        points.length === 1
          ? `${points[0].x - 24},${points[0].y} ${points[0].x + 24},${points[0].y}`
          : points.map((point) => `${point.x},${point.y}`).join(" ");
      const markers = points
        .map(
          (point, pointIndex) => `
            <circle cx="${point.x}" cy="${point.y}" r="6.5" fill="${series.color}" />
            ${
              points.length <= 2 || pointIndex === 0 || pointIndex === points.length - 1
                ? `<text x="${labelLayouts[point.index][point.seriesIndex].x}" y="${labelLayouts[point.index][point.seriesIndex].y}" text-anchor="${labelLayouts[point.index][point.seriesIndex].anchor}" font-size="15" font-weight="700" fill="#1f1d1a" stroke="#fffaf2" stroke-width="5" paint-order="stroke">
                    ${escapeHtml(formatValue(point.value, series.kind))}
                  </text>`
                : ""
            }
          `
        )
        .join("");
      return `
        <polyline points="${polyline}" fill="none" stroke="${series.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        ${markers}
      `;
    })
    .join("");

  const legend = `
    <div class="legend">
      ${[...leftSeries, ...rightSeries]
        .map(
          (series) => `
            <span class="legend-item">
              <span class="legend-swatch" style="background:${series.color}"></span>
              <span>${escapeHtml(series.label)}</span>
            </span>
          `
        )
        .join("")}
    </div>
  `;

  return `
    <svg class="svg-root" viewBox="0 0 ${width} ${height}" role="img" aria-label="Multi-series chart">
      ${gridlines}
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#6f665d" stroke-width="1.4" />
      ${labels.length === 1 ? `<line x1="${xPoints[0].x}" y1="${margin.top}" x2="${xPoints[0].x}" y2="${height - margin.bottom}" stroke="#e7ddd0" stroke-width="1" stroke-dasharray="4 4" />` : ""}
      ${seriesMarkup}
      ${axisLabels}
    </svg>
    ${legend}
  `;
}

function computeAxisMax(seriesList) {
  if (!seriesList.length) return 1;
  const kind = seriesList[0]?.kind || "integer";
  const maxValue = Math.max(...seriesList.flatMap((series) => series.values.map((value) => value || 0)), 0);
  if (kind === "percent") {
    const pct = maxValue * 100;
    if (pct <= 2.5) return 0.025;
    if (pct <= 5) return 0.05;
    if (pct <= 10) return 0.1;
    if (pct <= 20) return 0.2;
    return Math.ceil(pct / 5) * 0.05;
  }
  if (kind === "currency" && maxValue < 10) {
    return Math.max(Math.ceil(maxValue * 4) / 4, 1);
  }
  return Math.max(maxValue, 1);
}

function computeLabelLayouts(seriesList, xPoints, bounds) {
  const layouts = xPoints.map(() => Array(seriesList.length).fill(null));
  xPoints.forEach((point, pointIndex) => {
    const labelItems = seriesList.map((series, seriesIndex) => {
      const metricPoint = series.points[pointIndex];
      const nearBottom = metricPoint.y > bounds.top + (bounds.bottom - bounds.top) * 0.72;
      const direction = series.axis === "left" ? -1 : nearBottom ? -1 : 1;
      const kindBias = series.kind === "percent" ? -10 : series.kind === "currency" ? 10 : 0;
      return {
        point: metricPoint,
        seriesIndex,
        desiredY: metricPoint.y + direction * (18 + seriesIndex * 8) + kindBias,
        direction,
      };
    });

    labelItems.sort((left, right) => left.desiredY - right.desiredY);
    const minGap = 24;
    for (let index = 1; index < labelItems.length; index += 1) {
      if (labelItems[index].desiredY - labelItems[index - 1].desiredY < minGap) {
        labelItems[index].desiredY = labelItems[index - 1].desiredY + minGap;
      }
    }
    for (let index = labelItems.length - 2; index >= 0; index -= 1) {
      if (labelItems[index + 1].desiredY > bounds.bottom) {
        labelItems[index + 1].desiredY = bounds.bottom;
      }
      if (labelItems[index + 1].desiredY - labelItems[index].desiredY < minGap) {
        labelItems[index].desiredY = labelItems[index + 1].desiredY - minGap;
      }
    }

    labelItems.forEach((item) => {
      const clampedY = Math.max(bounds.top, Math.min(bounds.bottom, item.desiredY));
      let x = item.point.x;
      let anchor = "middle";
      const horizontalShift = item.seriesIndex % 2 === 0 ? 12 : -12;
      if (pointIndex === 0) {
        x += 12;
        anchor = "start";
      } else if (pointIndex === xPoints.length - 1) {
        x -= 12;
        anchor = "end";
      } else {
        x += horizontalShift;
      }
      layouts[pointIndex][item.seriesIndex] = { x, y: clampedY, anchor };
    });
  });
  return layouts;
}

function singleMetricProfileChart({ seriesLabel, points }) {
  const width = 860;
  const height = 420;
  const margin = { top: 36, right: 40, bottom: 120, left: 40 };
  const usableWidth = width - margin.left - margin.right;
  const usableHeight = height - margin.top - margin.bottom;
  const convertedValues = points.map((point) => (point.kind === "percent" ? point.value * 100 : point.value));
  const safeValues = convertedValues.map((value) => Math.max(value || 0, 0.01));
  const logs = safeValues.map((value) => Math.log10(value));
  const minLog = Math.min(...logs);
  const maxLog = Math.max(...logs);
  const span = Math.max(maxLog - minLog, 1);
  const xPoints = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? margin.left + usableWidth / 2 : margin.left + (usableWidth * index) / Math.max(points.length - 1, 1),
    plotValue: safeValues[index],
    logValue: logs[index],
  }));

  const gridlines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = margin.top + usableHeight - ratio * usableHeight;
    return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#cfc3b5" stroke-width="1" />`;
  }).join("");

  const polyline = xPoints
    .map((point) => {
      const normalized = (point.logValue - minLog) / span;
      const y = margin.top + usableHeight - normalized * usableHeight;
      point.y = y;
      return `${point.x},${y}`;
    })
    .join(" ");

  const segments = xPoints.slice(0, -1)
    .map((point, index) => {
      const nextPoint = xPoints[index + 1];
      return `<line x1="${point.x}" y1="${point.y}" x2="${nextPoint.x}" y2="${nextPoint.y}" stroke="${point.color}" stroke-width="3.5" stroke-linecap="round" />`;
    })
    .join("");

  const markers = xPoints
    .map(
      (point) => `
        <circle cx="${point.x}" cy="${point.y}" r="6.5" fill="${point.color}" />
        <text x="${point.x}" y="${point.y - 16}" text-anchor="middle" font-size="15" font-weight="700" fill="#1f1d1a" stroke="#fffaf2" stroke-width="5" paint-order="stroke">
          ${escapeHtml(formatValue(point.value, point.kind))}
        </text>
      `
    )
    .join("");

  const axisLabels = xPoints
    .map(
      (point) => `
        <text
          x="${point.x}"
          y="${height - 28}"
          text-anchor="middle"
          font-size="13"
          font-weight="600"
          fill="#6f665d"
          transform="rotate(-28 ${point.x} ${height - 28})"
        >
          ${escapeHtml(point.label)}
        </text>
      `
    )
    .join("");

  const legend = `
    <div class="legend">
      <span class="legend-item">
        <span class="legend-swatch" style="background:#1f1d1a"></span>
        <span>${escapeHtml(seriesLabel)}</span>
      </span>
      ${xPoints
        .map(
          (point) => `
            <span class="legend-item">
              <span class="legend-swatch" style="background:${point.color}"></span>
              <span>${escapeHtml(point.label)}</span>
            </span>
          `
        )
        .join("")}
    </div>
  `;

  return `
    <svg class="svg-root" viewBox="0 0 ${width} ${height}" role="img" aria-label="Single campaign metric profile chart">
      ${gridlines}
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#6f665d" stroke-width="1.4" />
      <polyline points="${polyline}" fill="none" stroke="#1f1d1a" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" opacity="0.38" />
      ${segments}
      ${markers}
      ${axisLabels}
    </svg>
    ${legend}
  `;
}

function formatAxisValue(value, kind) {
  if (!Number.isFinite(value)) return "0";
  if (kind === "percent") {
    return new Intl.NumberFormat("en-CA", { style: "percent", maximumFractionDigits: 0 }).format(value);
  }
  if (kind === "currency") {
    const fractionDigits = Math.abs(value) < 10 ? 2 : 0;
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
