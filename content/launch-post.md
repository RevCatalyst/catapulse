# Introducing Catapulse: a founder brief built on RevenueCat’s Charts API

**Live demo:** https://catapulse.vercel.app  
**GitHub repo:** https://github.com/RevCatalyst/catapulse

Most subscription dashboards are optimized for exploration, not decision-making.

That sounds fine until you imagine the actual moment they are used. A founder opens the dashboard before a weekly check-in, glances at a dozen tiles, stares at four or five trend lines, scrolls through some filters, and then still has to do the real work manually: figure out what actually changed, whether the change matters, and what to look at next.

That is the problem Catapulse is trying to solve.

Catapulse is a founder-facing brief built on top of RevenueCat’s Charts API. Instead of presenting a wall of cards and chart canvases, it turns live subscription data into a single operating table with four columns:

- **Metric**
- **Current**
- **Change**
- **Current situation**

The result is intentionally opinionated. It is not a general-purpose analytics workbench. It is a compact weekly read for subscription founders who want a fast answer to a simple question:

> What changed in the business over the last 7, 28, or 90 days, and what does that mean?

In this post I’ll explain why I built Catapulse, how RevenueCat’s Charts API makes it possible, the technical architecture behind it, and what I learned from turning raw chart data into a founder-readable product.

---

## The product idea: less dashboard, more operating brief

The easiest thing to build with an analytics API is another dashboard.

That is also usually the least interesting thing to build.

RevenueCat’s Charts API is already strong enough to power charts. The more interesting question is whether it can support a product that is more focused than a dashboard and more useful than a wrapper. I wanted to test that by building something with a tighter point of view.

The thesis behind Catapulse is straightforward:

1. founders do not need more visual noise
2. they do need a reliable weekly operating read
3. RevenueCat’s chart endpoints already contain enough subscription signal to generate that read live

That shaped every design decision in the app.

There are no chart canvases in the final interface. There is no grid of flashy cards. There is one main table, a range selector for **7d / 28d / 90d**, and a short interpretation next to each metric.

The intent is to reduce the cognitive load between “here is the data” and “here is what to care about.”

---

## What Catapulse shows

The current version focuses on founder-relevant subscription metrics, including:

- Active subscriptions
- Active trials
- Customers active
- MRR
- ARR
- New MRR
- Resubscription MRR
- Revenue
- Transactions
- New customers
- Paying customers
- New trials
- Trial starts
- Conversion to paying
- Trial conversion rate
- Churn rate
- Refund rate

Those rows are not just raw values. Catapulse also compares the selected window to the previous matching window:

- `7d` vs previous `7d`
- `28d` vs previous `28d`
- `90d` vs previous `90d`

That means the interface is not only answering “what is the metric?” but also “is it improving?” and “how should I interpret that movement?”

For example, instead of only showing a churn rate, the brief can say whether churn worsened versus the previous period. Instead of only showing MRR, it can put that value in the context of recurring revenue momentum. That translation step is the whole point of the product.

---

## Why RevenueCat’s Charts API is a good fit for this kind of tool

One of the most interesting things about RevenueCat’s Charts API is that it is not limited to obvious dashboard use cases. The API gives you enough structure to build chart-native products that are not visually chart-centric.

Catapulse currently uses:

### Project resolution

- `GET /projects`

### Overview metrics

- `GET /projects/{project_id}/metrics/overview`

### Charts endpoints

- `GET /projects/{project_id}/charts/actives`
- `GET /projects/{project_id}/charts/trials`
- `GET /projects/{project_id}/charts/mrr`
- `GET /projects/{project_id}/charts/arr`
- `GET /projects/{project_id}/charts/revenue`
- `GET /projects/{project_id}/charts/customers_new`
- `GET /projects/{project_id}/charts/customers_active`
- `GET /projects/{project_id}/charts/conversion_to_paying`
- `GET /projects/{project_id}/charts/churn`
- `GET /projects/{project_id}/charts/trials_new`
- `GET /projects/{project_id}/charts/trial_conversion_rate`
- `GET /projects/{project_id}/charts/mrr_movement`
- `GET /projects/{project_id}/charts/refund_rate`

A few of those are requested with explicit daily resolution so they behave naturally with the selected windows:

- `mrr`
- `arr`
- `customers_active`
- `mrr_movement`

That mattered a lot in practice. A founder expects `7d`, `28d`, and `90d` to actually change the output. If MRR or ARR only reflected the latest point, switching ranges would feel decorative rather than analytical. Daily resolution allows those metrics to be averaged or aggregated over the selected period instead.

This is where the Charts API becomes more than a chart feed. It becomes raw material for productized reasoning.

---

## The technical architecture

Catapulse is built as a Next.js app with server-side data fetching. RevenueCat keys never touch the client. The UI only talks to a local server route, and the server is responsible for resolving the project, querying RevenueCat, handling retries, and transforming the payload into founder-readable rows.

### High-level flow

```mermaid
flowchart TD
    A[Browser UI] --> B[Next.js page]
    A --> C[/api/catapulse]
    B --> D[Server data layer]
    C --> D
    D --> E[Resolve project via GET /projects]
    D --> F[Fetch RevenueCat chart endpoints]
    F --> G[Normalize time series]
    G --> H[Aggregate selected windows]
    H --> I[Generate founder brief rows]
    I --> A
```

### The UI layer

The client-side dashboard component does very little calculation. It renders:

- project metadata
- the `7d / 28d / 90d` selector
- the founder brief table
- an optional project-key change form

The dashboard can also switch projects by posting a different RevenueCat V2 key to the local API route.

### The API route

The app exposes a simple server route:

```ts
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
  };

  const dashboard = await getDashboardPayload({
    apiKeyOverride: body.apiKey,
  });

  return NextResponse.json(dashboard);
}
```

That route keeps the frontend simple and makes the project-switching flow possible without exposing RevenueCat credentials in the browser.

### The data layer

The real logic lives in `lib/catapulse-data.ts`. That file is responsible for:

- resolving the project ID and project name
- querying RevenueCat endpoints
- normalizing chart measures into series
- calculating period windows
- choosing the correct aggregation style for each metric
- producing table rows and short interpretations

Here is the core pattern used to query the RevenueCat charts:

```ts
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
  refundRate,
] = await Promise.all([
  revenueCatGet(`/projects/${projectId}/charts/actives`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/trials`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/mrr`, { resolution: "0", start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/arr`, { resolution: "0", start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/revenue`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/customers_new`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/customers_active`, { resolution: "0", start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/conversion_to_paying`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/churn`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/trials_new`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/trial_conversion_rate`, { start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/mrr_movement`, { resolution: "0", start_date, end_date }),
  revenueCatGet(`/projects/${projectId}/charts/refund_rate`, { start_date, end_date }),
]);
```

That raw data then gets mapped into founder rows.

---

## The most important implementation choice: aggregation by metric type

If you only take the latest point for every metric, the range selector becomes misleading. That happened in an earlier iteration. Switching from `7d` to `28d` barely moved some rows because the app was still effectively looking at “today.”

The fix was to define the right aggregation style for each metric family.

### Average-over-window metrics

These are metrics where a founder usually wants the average level across the selected window:

- Active subscriptions
- Active trials
- Customers active
- MRR
- ARR

This is especially important for MRR and ARR. A founder choosing `90d` probably wants a broader read of recurring revenue level, not just the latest daily point.

### Sum-over-window metrics

These are cumulative metrics that should be added over the window:

- Revenue
- Transactions
- New customers
- Paying customers
- New trials
- Trial starts
- selected MRR movement components

### Average-rate metrics

These should be averaged as rates:

- Conversion to paying
- Trial conversion rate
- Churn rate
- Refund rate

That one decision made the whole tool more honest and more useful.

---

## Handling project switching cleanly

The take-home project opens on Dark Noise by default, but I also wanted the tool to work on another RevenueCat project without turning it into a generic API playground.

The compromise was a simple **Change** flow in the header.

When a user pastes another RevenueCat V2 key, Catapulse:

1. calls `GET /projects`
2. resolves the available project for that key
3. fetches the chart endpoints for that resolved project
4. rerenders the same founder brief UI

That keeps the experience consistent while removing the need to hardcode a single project forever.

---

## Rate limits, retries, and reality

Live APIs are messy in production, and RevenueCat rate limiting showed up quickly during development.

Because Catapulse fans out across multiple chart endpoints, it can trigger `429` responses if requests are too aggressive. To make the tool stable enough for a public demo, I added:

- bounded request concurrency
- retry logic on `429`
- support for `retry-after` and `backoff_ms`
- short-lived caching for project metadata

That is not the most glamorous part of the build, but it matters. A founder brief that fails on load is not a founder brief.

---

## Why I removed the charts

This is the most opinionated part of the project, and it is also the part I like most.

I started with a more standard dashboard approach. It worked technically, but it felt interchangeable with any other analytics UI. The charts were accurate, but they made the product less distinct and less helpful.

Removing them forced the product to answer a harder question:

> If I cannot rely on charts to impress the user, what value am I actually providing?

The answer became the table itself:

- stable layout
- strong metric coverage
- period-aware comparisons
- plain-language interpretation

That shift also makes Catapulse a better example of what RevenueCat’s Charts API can enable. The API is not only a way to reproduce charts. It is a way to build new interfaces around subscription intelligence.

---

## What I would improve next

If I kept building Catapulse, the next improvements would be:

### 1. Segment drill-downs
The natural next step is allowing founders to re-run the brief by:

- country
- store
- product
- offering

### 2. Export formats
A markdown export, PDF export, or Slack summary would make this much more useful as a weekly ritual.

### 3. Background refresh
The current tool uses live requests and retry logic. A production-grade version would likely add smarter caching and background refresh for faster first paint.

### 4. Advanced mode
The current brief is intentionally selective. An advanced mode could expose deeper MRR movement components or retention-specific metrics without overwhelming the default founder view.

---

## Why this matters for RevenueCat’s Charts API

The reason I think Catapulse is a useful take-home project is not only that it works. It also demonstrates a product argument about the API itself.

RevenueCat’s Charts API is already good for dashboards. The more interesting opportunity is that it also supports:

- founder briefs
- weekly operating summaries
- AI-generated interpretations
- distribution-ready growth reporting
- workflow-specific tools that sit on top of subscription metrics

That is the kind of story that helps a new API get adopted. Not just “here are the endpoints,” but “here is a product category you can now build.”

Catapulse is my attempt at exactly that.

---

## Try it

- **Live demo:** https://catapulse.vercel.app
- **GitHub repo:** https://github.com/RevCatalyst/catapulse

If you are building with RevenueCat’s Charts API, I’d encourage you to try a stronger product opinion than “dashboard.” Pick a user, pick a decision-making workflow, and build the shortest possible interface that helps them act.

That is what I tried to do here.

And if you are a founder running a subscription app, Catapulse is built for the moment before your weekly review, when you do not want more charts—you want clarity.
