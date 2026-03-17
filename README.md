# Catapulse

Catapulse is a founder-facing RevenueCat brief built for the Charts API take-home.

Instead of showing a chart-heavy dashboard, Catapulse turns live RevenueCat subscription data into a single dense operating table with:

- the current metric value
- period-over-period change
- a short founder-readable interpretation

The goal is simple: give a subscription app founder a fast answer to **what changed, by how much, and what it means**.

## What the app does

Catapulse loads a RevenueCat project server-side and renders one founder brief table across three windows:

- **Last 7 days**
- **Last 28 days**
- **Last 90 days**

The page opens on the provided **Dark Noise** take-home project by default.

A **Change** action in the header lets you paste another RevenueCat V2 key. Catapulse then:

1. resolves the project via `GET /projects`
2. loads the project name and ID
3. queries the chart endpoints
4. renders the same founder brief for that project

## Product thesis

Most subscription reporting tools answer one of two questions:

- *What do the charts look like?*
- *What are the raw KPIs?*

Catapulse is aimed at the question a founder actually asks during a weekly review:

> What changed in the business this week, and is that good or bad?

That is why the UI is intentionally minimal:

- no chart canvases
- no card wall
- no extra navigation
- one table
- one range selector
- one current situation sentence per metric

## Metrics currently shown

Catapulse currently renders these founder-facing rows:

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

### How Catapulse interprets the selected range

Not every metric should be treated the same way, so the app uses different rollups depending on metric type.

#### Average-over-window metrics

These rows use the **average daily value across the selected window**:

- Active subscriptions
- Active trials
- Customers active
- MRR
- ARR

This makes the `7d / 28d / 90d` switch meaningful instead of just showing the latest point.

#### Sum-over-window metrics

These rows use the **sum across the selected window**:

- New MRR
- Resubscription MRR
- Revenue
- Transactions
- New customers
- Paying customers
- New trials
- Trial starts

#### Average rate metrics

These rows use the **average rate across the selected window**:

- Conversion to paying
- Trial conversion rate
- Churn rate
- Refund rate

### Change column logic

The **Change** column compares the selected window against the immediately previous window of the same size:

- `7d` compares against the previous `7d`
- `28d` compares against the previous `28d`
- `90d` compares against the previous `90d`

## RevenueCat endpoints used

### Project discovery

Catapulse uses project discovery so the **Change** flow can resolve project ID and project name from a pasted key:

- `GET /projects`

### Chart endpoints used by the founder brief

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

### Resolution overrides

Some endpoints are explicitly requested with daily resolution so they work naturally with `7d / 28d / 90d`:

- `mrr`
- `arr`
- `customers_active`
- `mrr_movement`

## How the app is structured

```text
apps/catapulse/
├─ app/
│  ├─ api/catapulse/route.ts      # server route returning transformed founder brief payload
│  └─ page.tsx                    # page entrypoint
├─ components/catapulse/
│  └─ catapulse-dashboard.tsx     # single-table founder UI
├─ lib/
│  └─ catapulse-data.ts           # RevenueCat querying, retries, transforms, metric logic
└─ README.md
```

## Local development

From the project root:

```bash
cd apps/catapulse
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Environment variables

Recommended for any non-local or deployed use:

```bash
REVENUECAT_API_KEY=sk_...
REVENUECAT_PROJECT_ID=proj_...
REVENUECAT_PROJECT_NAME=Your App Name
```

### Default take-home behavior

For the take-home environment, Catapulse can fall back to the provided Dark Noise key and project metadata server-side.

For a real deployment, set environment variables explicitly and do **not** expose keys client-side.

## API route

Catapulse exposes a local server route:

### `GET /api/catapulse`
Returns the founder brief payload for the default configured project.

### `POST /api/catapulse`
Accepts a different RevenueCat key.

Example:

```json
{
  "apiKey": "sk_..."
}
```

The server then resolves the project and returns the transformed brief payload.

## Rate limiting and retries

RevenueCat rate limits chart requests. Catapulse includes server-side protection for this:

- bounded request concurrency
- retry logic on `429`
- support for `retry-after` / `backoff_ms`
- short server-side caching for project metadata

This keeps the brief usable while still working from live API responses.

## Why this is useful for founders

Catapulse is not trying to replace a full analytics suite.

It is trying to be the fastest way to answer:

- Is growth improving or slowing?
- Are active customers and subscribers moving together?
- Is MRR quality improving?
- Is churn or refund pressure getting worse?
- Is acquisition turning into paying customers efficiently?

In practice, that makes Catapulse a better weekly review surface than a generic dashboard full of charts.

## Current limitations

- load time depends on live RevenueCat API response time
- project switching requires a key that can resolve project access
- the app is intentionally opinionated and not a general-purpose chart explorer
- some metric naming and rollup choices are optimized for founder readability, not accounting-style reporting

## Next improvements

Possible next steps for Catapulse:

- optional advanced mode for deeper MRR movement details
- segment drill-downs by country, store, product, or offering
- export to markdown / PDF / Slack summary
- deploy as a public live demo

## Tech stack

- Next.js
- React
- Tailwind CSS
- RevenueCat API v2

## Summary

Catapulse is a live RevenueCat founder brief that turns chart data into a cleaner operating table.

It is built to show not just **what the metric is**, but **what changed and what it means**.
