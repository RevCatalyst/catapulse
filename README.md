# Catapulse

Catapulse is a founder-facing brief for RevenueCat subscription apps.

It uses live RevenueCat API data to turn a large set of subscription metrics into a single operator-friendly table with four columns:

- **Metric**
- **Current**
- **Change**
- **Current situation**

Instead of asking a founder to interpret a dashboard full of charts, Catapulse tries to answer the more practical question:

> What changed in the business over the last 7, 28, or 90 days, and what does that mean?

## Why this exists

Founders usually do not need more chart surface area. They need a fast weekly operating read.

Catapulse is designed around that workflow:

- open the app
- switch between **7d / 28d / 90d**
- scan core subscription metrics
- understand whether acquisition, conversion, retention, and recurring revenue are improving or weakening

The app opens on the provided **Dark Noise** take-home project by default, but it also supports loading another RevenueCat project key from the UI.

## What the app does

Catapulse:

1. resolves a RevenueCat project server-side
2. fetches live metrics from RevenueCat
3. normalizes the responses into founder-readable rows
4. compares the selected window against the previous matching window
5. renders a minimal table UI

The header also shows:

- **Project ID**
- **Project Name**
- **Coverage**

A **Change** button lets you paste another RevenueCat V2 key and load a different project.

## Current product behavior

The app presents a single founder brief table and a range selector:

- **Last 7 days**
- **Last 28 days**
- **Last 90 days**

The selected range changes the calculations in the table rather than just changing a label.

### Table columns

#### Metric
The business metric being analyzed.

#### Current
The current value for the selected range.

#### Change
The period-over-period change versus the previous matching window.

Examples:
- `+4.2% vs previous 7d`
- `-1.3% vs previous 28d`
- `+9.1% vs previous 90d`

#### Current situation
A short sentence interpreting the metric in plain language.

## Metrics shown

Catapulse currently focuses on founder-relevant subscription signals, including:

- Active subscriptions
- Active trials
- Customers active
- MRR
- ARR
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
- MRR movement components that are useful in the current brief

The exact row set can evolve as the brief is tuned, but the goal stays the same: keep only metrics that help a founder understand business momentum.

## How range calculations work

Not every metric should be rolled up the same way.

Catapulse uses a few different strategies depending on metric type.

### Average-over-window metrics
These rows use the average value across the selected window so that `7d`, `28d`, and `90d` meaningfully differ:

- Active subscriptions
- Active trials
- Customers active
- MRR
- ARR

### Sum-over-window metrics
These rows sum values across the selected window:

- Revenue
- Transactions
- New customers
- Paying customers
- New trials
- Trial starts
- selected MRR movement components

### Average-rate metrics
These rows average the rate over the selected window:

- Conversion to paying
- Trial conversion rate
- Churn rate
- Refund rate

## RevenueCat endpoints used

Catapulse is powered by live RevenueCat data.

### Project resolution
- `GET /projects`

Used to resolve project ID and project name from a pasted V2 key.

### Overview metrics
- `GET /projects/{project_id}/metrics/overview`

Used for top-line metrics where helpful.

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
- `GET /projects/{project_id}/charts/ltv_per_customer`
- `GET /projects/{project_id}/charts/ltv_per_paying_customer`
- `GET /projects/{project_id}/charts/refund_rate`

Some chart requests use explicit daily resolution so they behave naturally with `7d / 28d / 90d`.

## Local development

From the root of this repository:

```bash
cd apps/catapulse
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment variables

For production or non-take-home use, configure these server-side:

```bash
REVENUECAT_API_KEY=sk_...
REVENUECAT_PROJECT_ID=proj_...
REVENUECAT_PROJECT_NAME=Your App Name
```

### Default fallback behavior

If those values are not set, Catapulse can fall back to the provided Dark Noise take-home configuration.

## API route

Catapulse exposes a local server route:

### `GET /api/catapulse`
Returns the transformed founder brief payload for the default configured project.

### `POST /api/catapulse`
Accepts a request body like:

```json
{
  "apiKey": "sk_..."
}
```

The server resolves the project and returns the same founder brief payload for the newly loaded key.

## Project structure

```text
apps/catapulse/
├─ app/
│  ├─ api/catapulse/route.ts
│  └─ page.tsx
├─ components/
│  ├─ catapulse/
│  │  └─ catapulse-dashboard.tsx
│  └─ ui/
├─ lib/
│  └─ catapulse-data.ts
├─ package.json
└─ README.md
```

## Implementation notes

### Server-side data loading
RevenueCat requests run server-side. The client never calls RevenueCat directly.

### Rate-limit protection
The data layer includes:

- bounded concurrency
- retry handling for `429`
- backoff support using RevenueCat error metadata
- short-lived caching where appropriate

### UI philosophy
The UI is intentionally minimal:

- black background
- one table
- no chart canvases
- no card wall
- no extra navigation

The point is not to replicate a BI tool. The point is to produce a fast founder read.

## Why this can be useful to founders

Catapulse is meant to help answer practical weekly questions like:

- Is recurring revenue improving?
- Are active customers growing or stalling?
- Is acquisition turning into payers?
- Is churn or refund pressure rising?
- Are trial mechanics improving?

That makes it more useful as a founder brief than a dashboard that requires the user to infer the narrative themselves.

## Known limitations

- Load time depends on live RevenueCat API response time.
- Project switching depends on the permissions available to the pasted V2 key.
- Some metric naming is optimized for founder readability rather than pure accounting terminology.
- The brief is intentionally opinionated and not a full analytics workbench.

## Next possible improvements

- segment drill-downs by country, store, product, or offering
- export to markdown or PDF
- Slack-ready weekly brief output
- optional advanced mode for deeper movement analysis
- cached background refresh for faster production loads

## Tech stack

- Next.js
- React
- Tailwind CSS
- RevenueCat API v2

## Repo / deployment

- GitHub: https://github.com/RevCatalyst/catapulse
- Production: https://catapulse.vercel.app

---

Catapulse is a practical RevenueCat Charts API product: a founder brief that tells you not just what the metrics are, but what changed and why it matters.
