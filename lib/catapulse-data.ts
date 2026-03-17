import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export type RangeKey = "7d" | "28d" | "90d";

type Tone = "up" | "down" | "neutral";
type ValueFormat = "currency" | "number" | "percent";

type RawOverviewMetric = {
  id: string;
  name: string;
  value: number;
  unit: string;
  period: string;
};

type RawChartMeasure = {
  display_name: string;
  unit?: string;
};

type RawChartObjectRow = {
  cohort: number;
  measure?: number;
  value: number;
  incomplete?: boolean;
};

type RawChart = {
  display_name: string;
  description?: string;
  resolution: string;
  measures?: RawChartMeasure[] | null;
  values?: Array<RawChartObjectRow | Array<number | null>>;
};

type RawOption = {
  id: string;
  display_name: string;
};

type RawProject = {
  id: string;
  name: string;
};

type RawProjectList = {
  items?: RawProject[];
};

type RawChartOptions = {
  filters?: RawOption[];
  segments?: RawOption[];
  user_selectors?: Record<
    string,
    {
      options?: Array<{ id: string; display_name: string }>;
    }
  >;
};

type SeriesPoint = {
  timestamp: number;
  value: number;
  incomplete: boolean;
};

export type DashboardCard = {
  label: string;
  value: string;
  delta: string;
  tone: Tone;
  helper: string;
};

export type InsightBlock = {
  title: string;
  value: string;
  tone: Tone;
  detail: string;
};

export type InsightPanel = {
  headline: string;
  summary: string;
  bullets: string[];
  actions: string[];
  notes: string[];
};

export type SnapshotRow = {
  metric: string;
  current: string;
  change: string;
  situation: string;
};

export type CoverageRow = {
  category: string;
  metrics: string;
  founderQuestion: string;
};

export type ChartSeriesDefinition = {
  key: string;
  label: string;
  color: string;
};

export type ChartDataset = {
  title: string;
  description: string;
  format: ValueFormat;
  data: Array<Record<string, string | number | null>>;
  series: ChartSeriesDefinition[];
};

export type MrrMovementDatum = {
  label: string;
  value: number;
  tone: Tone;
};

export type RangeView = {
  label: string;
  cards: DashboardCard[];
  signals: InsightBlock[];
  brief: InsightPanel;
  snapshotRows: SnapshotRow[];
  snapshotMarkdown: string;
  charts: {
    revenue: ChartDataset;
    acquisition: ChartDataset;
    conversion: ChartDataset;
    churn: ChartDataset;
  };
};

export type DashboardPayload = {
  projectId: string;
  projectName: string;
  extractedRange: string;
  ranges: Array<{ key: RangeKey; label: string }>;
  globalCards: DashboardCard[];
  rangeViews: Record<RangeKey, RangeView>;
  mrrChart: ChartDataset;
  mrrMovement: {
    title: string;
    description: string;
    monthLabel: string;
    netMovement: string;
    netTone: Tone;
    items: MrrMovementDatum[];
  };
  availableDrilldowns: string[];
  coverageRows: CoverageRow[];
  coverageMarkdown: string;
};

const RANGE_CONFIG: Record<RangeKey, { days: number; label: string }> = {
  "7d": { days: 7, label: "Last 7 days" },
  "28d": { days: 28, label: "Last 28 days" },
  "90d": { days: 90, label: "Last 90 days" },
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const BASE_URL = "https://api.revenuecat.com/v2";
const DAILY_LOOKBACK_DAYS = 200;
const MRR_LOOKBACK_DAYS = 420;
const CACHE_TTL_MS = 1000 * 60 * 5;
const TASK_PROJECT_ID = "proj058a6330";
const TASK_PROJECT_NAME = "Dark Noise";
const MAX_CONCURRENT_REVENUECAT_REQUESTS = 2;
const MAX_REVENUECAT_RETRIES = 4;
const DEFAULT_REVENUECAT_BACKOFF_MS = 2000;

function todayIsoUtc() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgoUtc(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function resolveRevenueCatApiKey(apiKeyOverride?: string) {
  const normalizedOverride = apiKeyOverride?.trim();

  if (normalizedOverride) {
    return normalizedOverride;
  }

  if (process.env.REVENUECAT_API_KEY) {
    return process.env.REVENUECAT_API_KEY;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), "../../maintask.md"),
    path.resolve(process.cwd(), "../maintask.md"),
    path.resolve(process.cwd(), "maintask.md"),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      const raw = await fs.readFile(candidatePath, "utf8");
      const match = raw.match(/Key:\s*(sk_[A-Za-z0-9]+)/);
      if (match?.[1]) {
        return match[1];
      }
    } catch {
      // Ignore and try the next location.
    }
  }

  throw new Error(
    "Missing REVENUECAT_API_KEY and could not find a Charts API key in maintask.md.",
  );
}

function fallbackProjectInfo() {
  return {
    projectId: process.env.REVENUECAT_PROJECT_ID ?? TASK_PROJECT_ID,
    projectName: process.env.REVENUECAT_PROJECT_NAME ?? TASK_PROJECT_NAME,
  };
}

const projectInfoCache = new Map<
  string,
  {
    expiresAt: number;
    value: { projectId: string; projectName: string };
  }
>();

async function resolveProjectInfo(apiKeyOverride?: string) {
  const cacheKey = apiKeyOverride?.trim() || "__default__";
  const cached = projectInfoCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const projects = await revenueCatGet<RawProjectList>("/projects", undefined, apiKeyOverride);
    const items = projects.items ?? [];

    if (items.length > 0) {
      const fallback = fallbackProjectInfo();
      const matchedProject =
        items.find((item) => item.id === fallback.projectId) ??
        items[0];

      const value = {
        projectId: matchedProject.id,
        projectName: matchedProject.name,
      };

      projectInfoCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return value;
    }
  } catch (error) {
    if (apiKeyOverride?.trim()) {
      throw error;
    }
  }

  const fallback = fallbackProjectInfo();
  projectInfoCache.set(cacheKey, {
    value: fallback,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return fallback;
}

let activeRevenueCatRequests = 0;
const revenueCatRequestQueue: Array<() => void> = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireRevenueCatRequestSlot() {
  if (activeRevenueCatRequests < MAX_CONCURRENT_REVENUECAT_REQUESTS) {
    activeRevenueCatRequests += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    revenueCatRequestQueue.push(resolve);
  });

  activeRevenueCatRequests += 1;
}

function releaseRevenueCatRequestSlot() {
  activeRevenueCatRequests = Math.max(0, activeRevenueCatRequests - 1);
  const next = revenueCatRequestQueue.shift();
  next?.();
}

async function withRevenueCatRequestSlot<T>(task: () => Promise<T>) {
  await acquireRevenueCatRequestSlot();

  try {
    return await task();
  } finally {
    releaseRevenueCatRequestSlot();
  }
}

function getRevenueCatBackoffMs(response: Response, body: string) {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  try {
    const parsed = JSON.parse(body) as { backoff_ms?: number };
    if (typeof parsed.backoff_ms === "number" && parsed.backoff_ms > 0) {
      return parsed.backoff_ms;
    }
  } catch {
    // Ignore malformed error bodies.
  }

  return DEFAULT_REVENUECAT_BACKOFF_MS;
}

async function revenueCatGet<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
  apiKeyOverride?: string,
): Promise<T> {
  const apiKey = await resolveRevenueCatApiKey(apiKeyOverride);
  const url = new URL(`${BASE_URL}${endpoint}`);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  for (let attempt = 0; attempt < MAX_REVENUECAT_RETRIES; attempt += 1) {
    const response = await withRevenueCatRequestSlot(() =>
      fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }),
    );

    if (response.ok) {
      return (await response.json()) as T;
    }

    const body = await response.text();

    if (response.status === 429 && attempt < MAX_REVENUECAT_RETRIES - 1) {
      const backoffMs = getRevenueCatBackoffMs(response, body) + attempt * 250;
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`RevenueCat request failed (${response.status}) ${endpoint}: ${body}`);
  }

  throw new Error(`RevenueCat request failed after retries ${endpoint}`);
}

function normalizeTimestamp(raw: number) {
  return raw < 10_000_000_000 ? raw * 1000 : raw;
}

function formatDateLabel(timestamp: number, compact = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: compact ? undefined : "numeric",
  }).format(new Date(timestamp));
}

function formatWindowDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function formatValue(value: number, format: ValueFormat) {
  if (format === "currency") return CURRENCY_FORMATTER.format(value);
  if (format === "percent") return `${PERCENT_FORMATTER.format(value)}%`;
  return NUMBER_FORMATTER.format(value);
}

function formatDelta(
  delta: number | null,
  inverted = false,
  comparisonLabel = "previous period",
): { delta: string; tone: Tone } {
  if (delta === null || Number.isNaN(delta) || !Number.isFinite(delta)) {
    return { delta: "No comparison", tone: "neutral" as Tone };
  }

  const magnitude = Math.abs(delta);
  const sign = delta > 0 ? "+" : "-";
  const tone = magnitude < 2 ? "neutral" : inverted ? (delta < 0 ? "up" : "down") : delta > 0 ? "up" : "down";

  return {
    delta: `${sign}${magnitude.toFixed(1)}% vs ${comparisonLabel}`,
    tone,
  };
}

function toSentenceDelta(
  delta: number | null,
  label: string,
  inverted = false,
  comparisonLabel = "previous period",
) {
  if (delta === null || !Number.isFinite(delta)) {
    return `${label} has no comparable ${comparisonLabel} yet.`;
  }

  const magnitude = Math.abs(delta).toFixed(1);
  if (Math.abs(delta) < 2) {
    return `${label} is essentially flat versus ${comparisonLabel}.`;
  }

  const direction = inverted
    ? delta < 0
      ? "improved"
      : "worsened"
    : delta > 0
      ? "increased"
      : "decreased";

  return `${label} ${direction} by ${magnitude}% versus ${comparisonLabel}.`;
}

function pointsToSeries(chart: RawChart) {
  const values = chart.values ?? [];
  const measureNames = chart.measures?.map((measure) => measure.display_name) ?? [chart.display_name ?? "Value"];
  const output = new Map<string, SeriesPoint[]>();

  for (const name of measureNames) {
    output.set(name, []);
  }

  if (values.length === 0) {
    return output;
  }

  if (Array.isArray(values[0])) {
    for (const row of values as Array<Array<number | null>>) {
      const [rawTimestamp, ...measureValues] = row;
      if (typeof rawTimestamp !== "number") continue;
      measureValues.forEach((value, index) => {
        if (typeof value !== "number") return;
        const key = measureNames[index] ?? `Measure ${index + 1}`;
        const bucket = output.get(key) ?? [];
        bucket.push({
          timestamp: normalizeTimestamp(rawTimestamp),
          value,
          incomplete: false,
        });
        output.set(key, bucket);
      });
    }

    return output;
  }

  for (const row of values as RawChartObjectRow[]) {
    const measureIndex = row.measure ?? 0;
    const key = measureNames[measureIndex] ?? `Measure ${measureIndex + 1}`;
    const bucket = output.get(key) ?? [];
    bucket.push({
      timestamp: normalizeTimestamp(row.cohort),
      value: row.value,
      incomplete: Boolean(row.incomplete),
    });
    output.set(key, bucket);
  }

  return output;
}

function pickSeriesFromMap(seriesMap: Map<string, SeriesPoint[]>, preferredNames: string[]) {
  for (const name of preferredNames) {
    const match = seriesMap.get(name);
    if (match && match.length > 0) {
      return match;
    }
  }

  return [...seriesMap.values()].find((series) => series.length > 0) ?? [];
}

function pickSeries(chart: RawChart, preferredNames: string[]) {
  return pickSeriesFromMap(pointsToSeries(chart), preferredNames);
}

function sortAndFilter(points: SeriesPoint[]) {
  return [...points]
    .filter((point) => Number.isFinite(point.value) && !point.incomplete)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getWindows(points: SeriesPoint[], size: number) {
  const clean = sortAndFilter(points);
  const current = clean.slice(-size);
  const previous = clean.slice(-size * 2, -size);
  return { clean, current, previous };
}

function sumPoints(points: SeriesPoint[]) {
  return points.reduce((total, point) => total + point.value, 0);
}

function averagePoints(points: SeriesPoint[]) {
  if (points.length === 0) return 0;
  return sumPoints(points) / points.length;
}

function latestPoint(points: SeriesPoint[]) {
  const clean = sortAndFilter(points);
  return clean.at(-1) ?? null;
}

function previousPoint(points: SeriesPoint[]) {
  const clean = sortAndFilter(points);
  return clean.at(-2) ?? null;
}

function deltaPercent(current: number, previous: number) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function chartDataFromSeries({
  title,
  description,
  format,
  size,
  series,
}: {
  title: string;
  description: string;
  format: ValueFormat;
  size: number;
  series: Array<{ key: string; label: string; color: string; points: SeriesPoint[] }>;
}): ChartDataset {
  const cleanSeries = series.map((item) => ({
    ...item,
    points: getWindows(item.points, size).current,
  }));

  const timestamps = Array.from(
    new Set(cleanSeries.flatMap((item) => item.points.map((point) => point.timestamp))),
  ).sort((a, b) => a - b);

  const compact = size > 40;
  const data = timestamps.map((timestamp) => {
    const row: Record<string, string | number | null> = {
      label: formatDateLabel(timestamp, compact),
    };

    for (const item of cleanSeries) {
      const match = item.points.find((point) => point.timestamp === timestamp);
      row[item.key] = match?.value ?? null;
    }

    return row;
  });

  return {
    title,
    description,
    format,
    data,
    series: cleanSeries.map(({ key, label, color }) => ({ key, label, color })),
  };
}

function toneFromDelta(delta: number | null, inverted = false): Tone {
  if (delta === null || Math.abs(delta) < 2) return "neutral";
  return inverted ? (delta < 0 ? "up" : "down") : delta > 0 ? "up" : "down";
}

function humanizeFilterName(filter: string) {
  const aliases: Record<string, string> = {
    app_id: "App",
    country: "Country",
    product_id: "Product",
    offering_identifier: "Offering",
    store: "Store",
    platform: "Platform",
    first_platform: "First platform",
    first_country: "First country",
    app_version: "App version",
    placement_id: "Placement",
    targeting_rule_id: "Targeting rule",
    attribution_source: "Attribution source",
  };

  return aliases[filter] ?? filter.replaceAll("_", " ");
}

function buildMarkdownTable(headers: string[], rows: string[][]) {
  const divider = headers.map(() => "---");
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];

  return lines.join("\n");
}

function summarizeChartMeasures(chart: RawChart) {
  if (!chart.measures?.length) {
    return chart.display_name;
  }

  return chart.measures.map((measure) => measure.display_name).join(", ");
}

type DashboardPayloadOptions = {
  apiKeyOverride?: string;
};

async function buildDashboardPayload(
  options?: DashboardPayloadOptions,
): Promise<DashboardPayload> {
  const apiKeyOverride = options?.apiKeyOverride;
  const { projectId, projectName } = await resolveProjectInfo(apiKeyOverride);
  const dailyStartDate = isoDaysAgoUtc(DAILY_LOOKBACK_DAYS);
  const endDate = todayIsoUtc();

  const [
    actives,
    trials,
    mrr,
    arr,
    revenue,
    customersNew,
    customersActive,
    conversionToPaying,
    churn,
    trialsNew,
    trialConversionRate,
    mrrMovement,
    ltvPerCustomer,
    ltvPerPayingCustomer,
    refundRate,
  ] = await Promise.all([
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/actives`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/trials`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/mrr`,
      {
        resolution: "0",
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/arr`,
      {
        resolution: "0",
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/revenue`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/customers_new`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/customers_active`,
      {
        resolution: "0",
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/conversion_to_paying`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/churn`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/trials_new`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/trial_conversion_rate`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/mrr_movement`,
      {
        resolution: "0",
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/ltv_per_customer`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/ltv_per_paying_customer`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
    revenueCatGet<RawChart>(
      `/projects/${projectId}/charts/refund_rate`,
      {
        start_date: dailyStartDate,
        end_date: endDate,
      },
      apiKeyOverride,
    ),
  ]);

  const activesSeries = pickSeries(actives, ["Actives", "Active Subscriptions"]);
  const trialsSeries = pickSeries(trials, ["Active Trials"]);
  const mrrSeries = pickSeries(mrr, ["MRR"]);
  const arrSeries = pickSeries(arr, ["ARR"]);
  const revenueSeries = pickSeries(revenue, ["Revenue"]);
  const transactionSeries = pickSeries(revenue, ["Transactions"]);
  const newCustomersSeries = pickSeries(customersNew, ["New Customers"]);
  const customersActiveSeries = pickSeries(customersActive, ["Active Customers", "Customers Active"]);
  const conversionRateSeries = pickSeries(conversionToPaying, ["Conversion Rate (7 days)", "Conversion Rate"]);
  const payingCustomersSeries = pickSeries(conversionToPaying, ["Paying Customers (7 days)", "Paying Customers"]);
  const churnRateSeries = pickSeries(churn, ["Churn Rate"]);
  const trialsNewSeries = pickSeries(trialsNew, ["New Trials"]);
  const trialStartsSeries = pickSeries(trialConversionRate, ["Trial Starts"]);
  const trialRateSeries = pickSeries(trialConversionRate, ["Conversion Rate"]);
  const ltvPerCustomerSeries = pickSeries(ltvPerCustomer, ["Realized LTV per Customer", "LTV per Customer"]);
  const ltvPerPayingCustomerSeries = pickSeries(ltvPerPayingCustomer, ["Realized LTV per Paying Customer", "LTV per Paying Customer"]);
  const refundRateSeries = pickSeries(refundRate, ["Refund Rate"]);

  const mrrMovementSeries = pointsToSeries(mrrMovement);
  const movementSeries = pickSeriesFromMap(mrrMovementSeries, ["Movement"]);
  const newMrrSeries = pickSeriesFromMap(mrrMovementSeries, ["New MRR"]);
  const resubscriptionMrrSeries = pickSeriesFromMap(mrrMovementSeries, ["Resubscription MRR"]);
  const expansionMrrSeries = pickSeriesFromMap(mrrMovementSeries, ["Expansion MRR"]);
  const churnedMrrSeries = pickSeriesFromMap(mrrMovementSeries, ["Churned MRR"]);
  const contractionMrrSeries = pickSeriesFromMap(mrrMovementSeries, ["Contraction MRR"]);
  const latestMovementPoint = latestPoint(movementSeries);
  const latestMovementPointLabel = latestMovementPoint
    ? formatWindowDate(latestMovementPoint.timestamp)
    : "Latest day";

  const globalActives = latestPoint(activesSeries)?.value ?? 0;
  const globalTrials = latestPoint(trialsSeries)?.value ?? 0;
  const globalCustomersActive = latestPoint(customersActiveSeries)?.value ?? 0;
  const globalMrr = latestPoint(mrrSeries)?.value ?? 0;
  const previousMrr = previousPoint(mrrSeries)?.value ?? 0;
  const latestArr = latestPoint(arrSeries)?.value ?? 0;
  const previousArr = previousPoint(arrSeries)?.value ?? 0;
  const arrDelta = deltaPercent(latestArr, previousArr);

  const latestNetMovement = latestPoint(movementSeries)?.value ?? 0;
  const previousNetMovement = previousPoint(movementSeries)?.value ?? 0;
  const latestNewMrr = latestPoint(newMrrSeries)?.value ?? 0;
  const previousNewMrr = previousPoint(newMrrSeries)?.value ?? 0;
  const latestResubscriptionMrr = latestPoint(resubscriptionMrrSeries)?.value ?? 0;
  const previousResubscriptionMrr = previousPoint(resubscriptionMrrSeries)?.value ?? 0;
  const latestExpansionMrr = latestPoint(expansionMrrSeries)?.value ?? 0;
  const previousExpansionMrr = previousPoint(expansionMrrSeries)?.value ?? 0;
  const latestChurnedMrr = latestPoint(churnedMrrSeries)?.value ?? 0;
  const previousChurnedMrr = previousPoint(churnedMrrSeries)?.value ?? 0;
  const latestContractionMrr = latestPoint(contractionMrrSeries)?.value ?? 0;
  const previousContractionMrr = previousPoint(contractionMrrSeries)?.value ?? 0;

  const globalCards: DashboardCard[] = [
    {
      label: "Active subscriptions",
      value: formatValue(globalActives, "number"),
      ...formatDelta(deltaPercent(globalActives, getWindows(activesSeries, 28).previous.at(-1)?.value ?? 0)),
      helper: "Current paid subscriber base from the live Charts API.",
    },
    {
      label: "Active trials",
      value: formatValue(globalTrials, "number"),
      ...formatDelta(deltaPercent(globalTrials, getWindows(trialsSeries, 28).previous.at(-1)?.value ?? 0)),
      helper: "Current users in trial right now.",
    },
    {
      label: "Current MRR",
      value: formatValue(globalMrr, "currency"),
      ...formatDelta(deltaPercent(globalMrr, previousMrr), false, "previous day"),
      helper: `Active customers: ${formatValue(globalCustomersActive, "number")}.`,
    },
  ];

  const rangeViews = {} as Record<RangeKey, RangeView>;

  for (const [rangeKey, config] of Object.entries(RANGE_CONFIG) as Array<[
    RangeKey,
    { days: number; label: string },
  ]>) {
    const activesWindow = getWindows(activesSeries, config.days);
    const trialsActiveWindow = getWindows(trialsSeries, config.days);
    const customersActiveWindow = getWindows(customersActiveSeries, config.days);
    const mrrWindow = getWindows(mrrSeries, config.days);
    const arrWindow = getWindows(arrSeries, config.days);
    const revenueWindow = getWindows(revenueSeries, config.days);
    const transactionWindow = getWindows(transactionSeries, config.days);
    const newCustomersWindow = getWindows(newCustomersSeries, config.days);
    const conversionWindow = getWindows(conversionRateSeries, config.days);
    const payingWindow = getWindows(payingCustomersSeries, config.days);
    const churnWindow = getWindows(churnRateSeries, config.days);
    const refundWindow = getWindows(refundRateSeries, config.days);
    const trialsWindow = getWindows(trialsNewSeries, config.days);
    const trialStartsWindow = getWindows(trialStartsSeries, config.days);
    const trialRateWindow = getWindows(trialRateSeries, config.days);
    const ltvCustomerWindow = getWindows(ltvPerCustomerSeries, config.days);
    const ltvPayingCustomerWindow = getWindows(ltvPerPayingCustomerSeries, config.days);
    const movementWindow = getWindows(movementSeries, config.days);
    const newMrrWindow = getWindows(newMrrSeries, config.days);
    const resubscriptionMrrWindow = getWindows(resubscriptionMrrSeries, config.days);
    const expansionMrrWindow = getWindows(expansionMrrSeries, config.days);
    const churnedMrrWindow = getWindows(churnedMrrSeries, config.days);
    const contractionMrrWindow = getWindows(contractionMrrSeries, config.days);

    const activeSubscriptionsCurrent = activesWindow.current.length > 0
      ? averagePoints(activesWindow.current)
      : globalActives;
    const activeSubscriptionsPrevious = activesWindow.previous.length > 0
      ? averagePoints(activesWindow.previous)
      : 0;
    const activeSubscriptionsDeltaForRange = deltaPercent(activeSubscriptionsCurrent, activeSubscriptionsPrevious);

    const activeTrialsCurrent = trialsActiveWindow.current.length > 0
      ? averagePoints(trialsActiveWindow.current)
      : globalTrials;
    const activeTrialsPrevious = trialsActiveWindow.previous.length > 0
      ? averagePoints(trialsActiveWindow.previous)
      : 0;
    const activeTrialsDeltaForRange = deltaPercent(activeTrialsCurrent, activeTrialsPrevious);

    const customersActiveCurrent = customersActiveWindow.current.length > 0
      ? averagePoints(customersActiveWindow.current)
      : globalCustomersActive;
    const customersActivePrevious = customersActiveWindow.previous.length > 0
      ? averagePoints(customersActiveWindow.previous)
      : 0;
    const customersActiveDeltaForRange = deltaPercent(customersActiveCurrent, customersActivePrevious);

    const mrrCurrent = mrrWindow.current.length > 0
      ? averagePoints(mrrWindow.current)
      : globalMrr;
    const mrrPrevious = mrrWindow.previous.length > 0
      ? averagePoints(mrrWindow.previous)
      : 0;
    const mrrDeltaForRange = deltaPercent(mrrCurrent, mrrPrevious);

    const arrCurrent = arrWindow.current.length > 0
      ? averagePoints(arrWindow.current)
      : latestArr;
    const arrPreviousForRange = arrWindow.previous.length > 0
      ? averagePoints(arrWindow.previous)
      : 0;
    const arrDeltaForRange = deltaPercent(arrCurrent, arrPreviousForRange);

    const revenueCurrent = sumPoints(revenueWindow.current);
    const revenuePrevious = sumPoints(revenueWindow.previous);
    const revenueDelta = deltaPercent(revenueCurrent, revenuePrevious);

    const transactionsCurrent = sumPoints(transactionWindow.current);
    const transactionsPrevious = sumPoints(transactionWindow.previous);
    const transactionsDelta = deltaPercent(transactionsCurrent, transactionsPrevious);

    const customersCurrent = sumPoints(newCustomersWindow.current);
    const customersPrevious = sumPoints(newCustomersWindow.previous);
    const customersDelta = deltaPercent(customersCurrent, customersPrevious);

    const conversionCurrent = averagePoints(conversionWindow.current);
    const conversionPrevious = averagePoints(conversionWindow.previous);
    const conversionDelta = deltaPercent(conversionCurrent, conversionPrevious);

    const payingCustomersCurrent = sumPoints(payingWindow.current);
    const payingCustomersPrevious = sumPoints(payingWindow.previous);
    const payingCustomersDelta = deltaPercent(payingCustomersCurrent, payingCustomersPrevious);

    const churnCurrent = averagePoints(churnWindow.current);
    const churnPrevious = averagePoints(churnWindow.previous);
    const churnDelta = deltaPercent(churnCurrent, churnPrevious);

    const refundCurrent = averagePoints(refundWindow.current);
    const refundPrevious = averagePoints(refundWindow.previous);
    const refundDelta = deltaPercent(refundCurrent, refundPrevious);

    const trialsCurrent = sumPoints(trialsWindow.current);
    const trialsPrevious = sumPoints(trialsWindow.previous);
    const trialsDelta = deltaPercent(trialsCurrent, trialsPrevious);

    const trialStartsCurrent = sumPoints(trialStartsWindow.current);
    const trialStartsPrevious = sumPoints(trialStartsWindow.previous);
    const trialStartsDelta = deltaPercent(trialStartsCurrent, trialStartsPrevious);

    const trialRateCurrent = averagePoints(trialRateWindow.current);
    const trialRatePrevious = averagePoints(trialRateWindow.previous);
    const trialRateDelta = deltaPercent(trialRateCurrent, trialRatePrevious);

    const ltvCustomerCurrent = averagePoints(ltvCustomerWindow.current);
    const ltvCustomerPrevious = averagePoints(ltvCustomerWindow.previous);
    const ltvCustomerDelta = deltaPercent(ltvCustomerCurrent, ltvCustomerPrevious);

    const ltvPayingCustomerCurrent = averagePoints(ltvPayingCustomerWindow.current);
    const ltvPayingCustomerPrevious = averagePoints(ltvPayingCustomerWindow.previous);
    const ltvPayingCustomerDelta = deltaPercent(ltvPayingCustomerCurrent, ltvPayingCustomerPrevious);

    const movementNet = sumPoints(movementWindow.current);
    const movementPrevious = sumPoints(movementWindow.previous);
    const movementDelta = deltaPercent(movementNet, movementPrevious);

    const newMrrCurrent = sumPoints(newMrrWindow.current);
    const newMrrPrevious = sumPoints(newMrrWindow.previous);
    const newMrrDelta = deltaPercent(newMrrCurrent, newMrrPrevious);

    const resubscriptionMrrCurrent = sumPoints(resubscriptionMrrWindow.current);
    const resubscriptionMrrPrevious = sumPoints(resubscriptionMrrWindow.previous);
    const resubscriptionMrrDelta = deltaPercent(resubscriptionMrrCurrent, resubscriptionMrrPrevious);

    const expansionMrrCurrent = sumPoints(expansionMrrWindow.current);
    const expansionMrrPrevious = sumPoints(expansionMrrWindow.previous);
    const expansionMrrDelta = deltaPercent(expansionMrrCurrent, expansionMrrPrevious);

    const churnedMrrCurrent = sumPoints(churnedMrrWindow.current);
    const churnedMrrPrevious = sumPoints(churnedMrrWindow.previous);
    const churnedMrrDelta = deltaPercent(churnedMrrCurrent, churnedMrrPrevious);

    const contractionMrrCurrent = sumPoints(contractionMrrWindow.current);
    const contractionMrrPrevious = sumPoints(contractionMrrWindow.previous);
    const contractionMrrDelta = deltaPercent(contractionMrrCurrent, contractionMrrPrevious);

    const newMrrLatest = newMrrCurrent;
    const churnedMrrLatest = churnedMrrCurrent;

    const cards: DashboardCard[] = [
      {
        label: `${config.label} revenue`,
        value: formatValue(revenueCurrent, "currency"),
        ...formatDelta(revenueDelta),
        helper: `${formatValue(sumPoints(getWindows(transactionSeries, config.days).current), "number")} revenue-generating transactions in this window.`,
      },
      {
        label: `${config.label} new customers`,
        value: formatValue(customersCurrent, "number"),
        ...formatDelta(customersDelta),
        helper: "Top-of-funnel customer acquisition.",
      },
      {
        label: `${config.label} conversion to paying`,
        value: formatValue(conversionCurrent, "percent"),
        ...formatDelta(conversionDelta),
        helper: `${formatValue(payingCustomersCurrent, "number")} paying customers converted inside this view.`,
      },
    ];

    const signals: InsightBlock[] = [
      {
        title: "Revenue",
        value: formatValue(revenueCurrent, "currency"),
        tone: toneFromDelta(revenueDelta),
        detail: `${formatDelta(revenueDelta).delta}. Latest monthly MRR is ${formatValue(globalMrr, "currency")}.`,
      },
      {
        title: "Acquisition",
        value: formatValue(customersCurrent, "number"),
        tone: toneFromDelta(customersDelta),
        detail: `${formatValue(trialsCurrent, "number")} new trials in the same window.`,
      },
      {
        title: "Conversion",
        value: formatValue(conversionCurrent, "percent"),
        tone: toneFromDelta(conversionDelta),
        detail: `${formatValue(trialRateCurrent, "percent")} trial conversion rate on average (${formatDelta(trialRateDelta).delta.toLowerCase()}).`,
      },
      {
        title: "Retention",
        value: formatValue(churnCurrent, "percent"),
        tone: toneFromDelta(churnDelta, true),
        detail: `${formatDelta(churnDelta, true).delta}. New MRR ${formatValue(newMrrLatest, "currency")} vs churned MRR ${formatValue(churnedMrrLatest, "currency")}.`,
      },
    ];

    const headline =
      customersDelta !== null && customersDelta < -8 && conversionDelta !== null && conversionDelta > 3
        ? `Acquisition softened over ${config.label.toLowerCase()}, but conversion efficiency held up.`
        : revenueDelta !== null && revenueDelta > 5
          ? `Revenue accelerated over ${config.label.toLowerCase()}, with conversion doing enough to support the gain.`
          : revenueDelta !== null && revenueDelta < -5
            ? `Revenue slipped over ${config.label.toLowerCase()}, and the business needs a clearer acquisition or retention fix.`
            : `Revenue held relatively steady over ${config.label.toLowerCase()}, but the mix of drivers still changed.`;

    const summary =
      movementNet < 0
        ? "Net MRR movement is still slightly negative, so weak acquisition or higher churn can keep pressure on growth even when topline revenue looks stable."
        : "Net MRR movement is positive, which gives the app room to absorb some volatility in acquisition and churn.";

    const bullets = [
      `${config.label} revenue came in at ${formatValue(revenueCurrent, "currency")}. ${toSentenceDelta(revenueDelta, "Revenue")}`,
      `${config.label} new customers totaled ${formatValue(customersCurrent, "number")}. ${toSentenceDelta(customersDelta, "New customer acquisition")}`,
      `Conversion to paying averaged ${formatValue(conversionCurrent, "percent")}. ${toSentenceDelta(conversionDelta, "Paying conversion")}`,
      `Churn rate averaged ${formatValue(churnCurrent, "percent")}. ${toSentenceDelta(churnDelta, "Churn", true)}`,
      `Trial starts totaled ${formatValue(trialStartsCurrent, "number")}. ${toSentenceDelta(trialStartsDelta, "Trial starts")}`,
    ];

    const actions = [
      customersDelta !== null && customersDelta < -8
        ? "Break down acquisition by country, platform, and offering first. The clearest weakness is at the top of the funnel."
        : "Compare acquisition by country, platform, and offering to confirm where new customers are strongest.",
      conversionDelta !== null && conversionDelta > 3
        ? "Protect the conversion gains by checking which offering or product combinations are outperforming."
        : "Review paywall, offering, and product segments to find where conversion can improve.",
      churnDelta !== null && churnDelta > 5
        ? "Inspect churn, billing issue, and cancellation-heavy cohorts next. Retention pressure is rising."
        : "Inspect churn and renewal-risk metrics to ensure retention stays healthy.",
    ];

    const notes = [
      `Comparison window: ${config.days} days vs previous ${config.days} days.`,
      `This response is generated from live RevenueCat Charts API data and cached server-side for 5 minutes.`,
      `This UI intentionally removes charts and turns the underlying chart endpoints into a cleaner founder brief.`,
    ];

    const rangeComparisonLabel = `previous ${config.days}d`;

    const snapshotRows: SnapshotRow[] = [
      {
        metric: "Active subscriptions",
        current: formatValue(activeSubscriptionsCurrent, "number"),
        change: formatDelta(activeSubscriptionsDeltaForRange, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(activeSubscriptionsDeltaForRange, "Paid subscriptions"),
      },
      {
        metric: "Active trials",
        current: formatValue(activeTrialsCurrent, "number"),
        change: formatDelta(activeTrialsDeltaForRange, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(activeTrialsDeltaForRange, "Active trials"),
      },
      {
        metric: "Customers active",
        current: formatValue(customersActiveCurrent, "number"),
        change: formatDelta(customersActiveDeltaForRange, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(customersActiveDeltaForRange, "Active customers"),
      },
      {
        metric: "MRR",
        current: formatValue(mrrCurrent, "currency"),
        change: formatDelta(mrrDeltaForRange, false, rangeComparisonLabel).delta,
        situation: movementNet < 0 ? "Recurring revenue momentum is under pressure." : "Recurring revenue momentum is positive.",
      },
      {
        metric: "ARR",
        current: formatValue(arrCurrent, "currency"),
        change: formatDelta(arrDeltaForRange, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(arrDeltaForRange, "ARR"),
      },
      {
        metric: "New MRR",
        current: formatValue(newMrrCurrent, "currency"),
        change: formatDelta(newMrrDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(newMrrDelta, "New MRR"),
      },
      {
        metric: "Resubscription MRR",
        current: formatValue(resubscriptionMrrCurrent, "currency"),
        change: formatDelta(resubscriptionMrrDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(resubscriptionMrrDelta, "Resubscription MRR"),
      },
      {
        metric: "Revenue",
        current: formatValue(revenueCurrent, "currency"),
        change: formatDelta(revenueDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(revenueDelta, "Revenue"),
      },
      {
        metric: "Transactions",
        current: formatValue(transactionsCurrent, "number"),
        change: formatDelta(transactionsDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(transactionsDelta, "Transactions"),
      },
      {
        metric: "New customers",
        current: formatValue(customersCurrent, "number"),
        change: formatDelta(customersDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(customersDelta, "New customer acquisition"),
      },
      {
        metric: "Paying customers",
        current: formatValue(payingCustomersCurrent, "number"),
        change: formatDelta(payingCustomersDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(payingCustomersDelta, "Paying customer conversions"),
      },
      {
        metric: "New trials",
        current: formatValue(trialsCurrent, "number"),
        change: formatDelta(trialsDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(trialsDelta, "New trials"),
      },
      {
        metric: "Trial starts",
        current: formatValue(trialStartsCurrent, "number"),
        change: formatDelta(trialStartsDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(trialStartsDelta, "Trial starts"),
      },
      {
        metric: "Conversion to paying",
        current: formatValue(conversionCurrent, "percent"),
        change: formatDelta(conversionDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(conversionDelta, "Paying conversion"),
      },
      {
        metric: "Trial conversion rate",
        current: formatValue(trialRateCurrent, "percent"),
        change: formatDelta(trialRateDelta, false, rangeComparisonLabel).delta,
        situation: toSentenceDelta(trialRateDelta, "Trial conversion quality"),
      },
      {
        metric: "Churn rate",
        current: formatValue(churnCurrent, "percent"),
        change: formatDelta(churnDelta, true, rangeComparisonLabel).delta,
        situation: toSentenceDelta(churnDelta, "Churn", true),
      },
      {
        metric: "Refund rate",
        current: formatValue(refundCurrent, "percent"),
        change: formatDelta(refundDelta, true, rangeComparisonLabel).delta,
        situation: toSentenceDelta(refundDelta, "Refund rate", true),
      },
    ];

    const snapshotMarkdown = buildMarkdownTable(
      ["Metric", "Current", "Change", "Current situation"],
      snapshotRows.map((row) => [row.metric, row.current, row.change, row.situation]),
    );

    rangeViews[rangeKey] = {
      label: config.label,
      cards,
      signals,
      brief: {
        headline,
        summary,
        bullets,
        actions,
        notes,
      },
      snapshotRows,
      snapshotMarkdown,
      charts: {
        revenue: chartDataFromSeries({
          title: "Revenue trend",
          description: `${config.label} revenue backed by live RevenueCat chart data.`,
          format: "currency",
          size: config.days,
          series: [
            {
              key: "revenue",
              label: "Revenue",
              color: "#d56214",
              points: revenueSeries,
            },
          ],
        }),
        acquisition: chartDataFromSeries({
          title: "Acquisition",
          description: `${config.label} new customers versus new trials.`,
          format: "number",
          size: config.days,
          series: [
            {
              key: "newCustomers",
              label: "New customers",
              color: "#d56214",
              points: newCustomersSeries,
            },
            {
              key: "newTrials",
              label: "New trials",
              color: "#a78bfa",
              points: trialsNewSeries,
            },
          ],
        }),
        conversion: chartDataFromSeries({
          title: "Conversion efficiency",
          description: `${config.label} paying conversion versus trial conversion quality.`,
          format: "percent",
          size: config.days,
          series: [
            {
              key: "conversionRate",
              label: "Conversion to paying",
              color: "#d56214",
              points: conversionRateSeries,
            },
            {
              key: "trialConversionRate",
              label: "Trial conversion rate",
              color: "#8c8c94",
              points: trialRateSeries,
            },
          ],
        }),
        churn: chartDataFromSeries({
          title: "Churn pressure",
          description: `${config.label} churn rate from the subscription base.`,
          format: "percent",
          size: config.days,
          series: [
            {
              key: "churnRate",
              label: "Churn rate",
              color: "#8c8c94",
              points: churnRateSeries,
            },
          ],
        }),
      },
    };
  }

  const mrrChart = chartDataFromSeries({
    title: "MRR",
    description: "Latest monthly recurring revenue trend from live RevenueCat data.",
    format: "currency",
    size: 6,
    series: [
      {
        key: "mrr",
        label: "MRR",
        color: "#d56214",
        points: mrrSeries,
      },
    ],
  });

  const movementItems: MrrMovementDatum[] = [
    { label: "New MRR", value: latestPoint(mrrMovementSeries.get("New MRR") ?? [])?.value ?? 0, tone: "up" },
    {
      label: "Resubscription MRR",
      value: latestPoint(mrrMovementSeries.get("Resubscription MRR") ?? [])?.value ?? 0,
      tone: "up",
    },
    {
      label: "Expansion MRR",
      value: latestPoint(mrrMovementSeries.get("Expansion MRR") ?? [])?.value ?? 0,
      tone: "up",
    },
    {
      label: "Churned MRR",
      value: -(latestPoint(mrrMovementSeries.get("Churned MRR") ?? [])?.value ?? 0),
      tone: "down",
    },
    {
      label: "Contraction MRR",
      value: -(latestPoint(mrrMovementSeries.get("Contraction MRR") ?? [])?.value ?? 0),
      tone: "down",
    },
    {
      label: "Net movement",
      value: latestPoint(mrrMovementSeries.get("Movement") ?? [])?.value ?? 0,
      tone: toneFromDelta(latestPoint(mrrMovementSeries.get("Movement") ?? [])?.value ?? 0),
    },
  ];

  const coverageRows: CoverageRow[] = [
    {
      category: "Revenue",
      metrics: [
        revenue.display_name,
        mrr.display_name,
        mrrMovement.display_name,
      ]
        .filter(Boolean)
        .join(", "),
      founderQuestion: "How much money is the app making and what is moving recurring revenue?",
    },
    {
      category: "Subscriptions",
      metrics: [actives.display_name, summarizeChartMeasures(actives)].join(" — "),
      founderQuestion: "How large is the paid subscriber base right now?",
    },
    {
      category: "Cohorts and LTV",
      metrics: [ltvPerCustomer.display_name, summarizeChartMeasures(ltvPerCustomer)].join(" — "),
      founderQuestion: "Are newly acquired users becoming more valuable over time?",
    },
    {
      category: "Conversion funnel",
      metrics: [
        customersNew.display_name,
        conversionToPaying.display_name,
        trialConversionRate.display_name,
      ]
        .filter(Boolean)
        .join(", "),
      founderQuestion: "Are new users reaching paywall and converting into paying customers?",
    },
    {
      category: "Trials",
      metrics: [trials.display_name, trialsNew.display_name, summarizeChartMeasures(trialsNew)].join(" — "),
      founderQuestion: "How much fresh trial volume is entering the funnel?",
    },
    {
      category: "Churn and refunds",
      metrics: [churn.display_name, refundRate.display_name, summarizeChartMeasures(refundRate)].join(" — "),
      founderQuestion: "Where is revenue leaking through churn or refunds?",
    },
  ];

  const coverageMarkdown = buildMarkdownTable(
    ["Charts API category", "Live metrics queried", "Founder question answered"],
    coverageRows.map((row) => [row.category, row.metrics, row.founderQuestion]),
  );

  return {
    projectId,
    projectName,
    extractedRange: `${formatWindowDate(sortAndFilter(revenueSeries).at(0)?.timestamp ?? Date.now())} – ${formatWindowDate(sortAndFilter(revenueSeries).at(-1)?.timestamp ?? Date.now())}`,
    ranges: Object.entries(RANGE_CONFIG).map(([key, value]) => ({ key: key as RangeKey, label: value.label })),
    globalCards,
    rangeViews,
    mrrChart,
    mrrMovement: {
      title: "MRR movement drivers",
      description: "Latest daily MRR components, with churn and contraction shown as negative pressure.",
      monthLabel: latestMovementPointLabel,
      netMovement: formatValue(latestMovementPoint?.value ?? 0, "currency"),
      netTone: toneFromDelta(latestMovementPoint?.value ?? 0),
      items: movementItems,
    },
    availableDrilldowns: [],
    coverageRows,
    coverageMarkdown,
  };
}

let dashboardPayloadCache:
  | {
      expiresAt: number;
      value: DashboardPayload;
    }
  | null = null;
let dashboardPayloadPromise: Promise<DashboardPayload> | null = null;

export async function getDashboardPayload(options?: DashboardPayloadOptions) {
  const apiKeyOverride = options?.apiKeyOverride?.trim();

  if (apiKeyOverride) {
    return buildDashboardPayload({ apiKeyOverride });
  }

  const now = Date.now();

  if (dashboardPayloadCache && dashboardPayloadCache.expiresAt > now) {
    return dashboardPayloadCache.value;
  }

  if (!dashboardPayloadPromise) {
    dashboardPayloadPromise = buildDashboardPayload()
      .then((payload) => {
        dashboardPayloadCache = {
          value: payload,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        dashboardPayloadPromise = null;
        return payload;
      })
      .catch((error) => {
        dashboardPayloadPromise = null;
        throw error;
      });
  }

  return dashboardPayloadPromise;
}
