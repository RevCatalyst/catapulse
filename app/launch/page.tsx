import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Introducing Catapulse — Founder Brief Built on RevenueCat Charts API",
  description:
    "Catapulse is a founder-facing subscription brief built on RevenueCat's Charts API.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
        {title}
      </h2>
      <div className="space-y-5 text-base leading-8 text-foreground">{children}</div>
    </section>
  );
}

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  return (
    <div className="overflow-hidden border border-dashed border-primary/70">
      <div className="border-b border-dashed border-primary/70 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-primary">
        {language}
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-7 text-[#d6d6de]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ArchitectureDiagram() {
  const boxClass =
    "flex min-h-20 items-center justify-center border border-dashed border-primary/70 px-4 py-4 text-center text-sm leading-6 text-[#d6d6de]";

  return (
    <div className="overflow-hidden border border-dashed border-primary/70 p-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
        <div className={boxClass}>Founder opens Catapulse</div>
        <div className="hidden text-center text-primary md:block">→</div>
        <div className={boxClass}>Next.js app</div>
        <div className="hidden text-center text-primary md:block">→</div>
        <div className={boxClass}>Local API route</div>
        <div className="hidden text-center text-primary md:block">→</div>
        <div className={boxClass}>RevenueCat data layer</div>
      </div>
      <div className="my-3 border-t border-dashed border-primary/30" />
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <div className={boxClass}>Resolve project from key</div>
        <div className="hidden text-center text-primary md:block">→</div>
        <div className={boxClass}>Fetch live chart data</div>
        <div className="hidden text-center text-primary md:block">→</div>
        <div className={boxClass}>Aggregate windows and generate founder brief rows</div>
      </div>
    </div>
  );
}

const keySwitchSnippet = `export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
  };

  const dashboard = await getDashboardPayload({
    apiKeyOverride: body.apiKey,
  });

  return NextResponse.json(dashboard);
}`;

const fetchLayerSnippet = `const [
  actives,
  mrr,
  arr,
  revenue,
  customersNew,
  customersActive,
  conversionToPaying,
  churn,
  refundRate,
] = await Promise.all([
  revenueCatGet(\`/projects/\${projectId}/charts/actives\`, { start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/mrr\`, { resolution: "0", start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/arr\`, { resolution: "0", start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/revenue\`, { start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/customers_new\`, { start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/customers_active\`, { resolution: "0", start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/conversion_to_paying\`, { start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/churn\`, { start_date, end_date }),
  revenueCatGet(\`/projects/\${projectId}/charts/refund_rate\`, { start_date, end_date }),
]);`;

const rowShapeSnippet = `{
  metric: "Revenue",
  current: "$5,127",
  change: "-1.5% vs previous 28d",
  situation: "Revenue is essentially flat versus previous period."
}`;

export default function LaunchPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8">
      <header className="space-y-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Launch post
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          I built Catapulse because founders do not need another dashboard
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-8 text-foreground">
          Catapulse is a founder-facing brief built on top of RevenueCat’s Charts API.
          Instead of giving you a wall of charts, it gives you a single operating table
          that tells you what changed, how much it changed, and why it matters.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="https://catapulse.vercel.app"
            className="rounded-none border border-dashed border-primary/80 px-5 py-3 text-sm font-medium text-[#d6d6de] transition hover:text-white"
          >
            Try Catapulse live
          </Link>
        </div>
      </header>

      <div className="overflow-hidden border border-dashed border-primary/70">
        <Image
          src="/launch/catapulse-founder-brief.png"
          alt="Catapulse founder brief UI showing a single operating table with metric, current, change, and current situation columns"
          width={2560}
          height={1599}
          className="h-auto w-full"
          priority
        />
      </div>

      <article className="space-y-12">
        <Section title="The problem Catapulse is solving">
          <p>
            There is a particular kind of disappointment that comes from opening a subscription
            dashboard right before a weekly review. The numbers are there. The charts are there.
            The filters are there. And yet the answer you actually need is still missing.
          </p>
          <p>
            Not <em>what are all the metrics?</em> Not <em>what does the curve look like?</em>
            But: what changed in the business this week, and what should I care about first?
          </p>
          <p>
            That is why I built Catapulse. The goal is not to impress a founder with more
            analytics UI. The goal is to make a founder faster.
          </p>
        </Section>

        <Section title="The core idea">
          <p>
            Most analytics products are optimized for exploration. Catapulse is optimized for a
            moment: the moment when a founder, growth lead, or operator opens the business and
            needs to understand whether acquisition is weakening, conversion is holding up,
            revenue quality is improving, or churn is becoming dangerous.
          </p>
          <p>
            In that moment, more chart surface area is not always more helpful. Sometimes the
            best product is the one that removes the burden of interpretation. Catapulse does
            that by turning live RevenueCat subscription data into a compact founder brief that
            can be scanned in seconds.
          </p>
        </Section>

        <Section title="What you actually get">
          <p>
            Catapulse presents one operating table with four columns: <strong>Metric</strong>,
            <strong> Current</strong>, <strong>Change</strong>, and <strong>Current situation</strong>.
            That means each row gives a founder the raw value, the period-over-period movement,
            and a plain-language interpretation in the same place.
          </p>
          <p>
            The current brief focuses on a selective set of founder-relevant subscription
            metrics, including active subscriptions, active trials, customers active, MRR, ARR,
            revenue, transactions, new customers, paying customers, conversion to paying, churn,
            refund rate, and a few recurring revenue movement signals.
          </p>
          <p>
            The app also compares the selected window against the previous matching window. So if
            you are on <code>28d</code>, you are seeing the current 28-day view versus the
            previous 28 days. That makes the interface answer not only “what is the metric?” but
            also “is it improving?” and “how should I interpret that movement?”
          </p>
        </Section>

        <Section title="Why I stripped the charts out">
          <p>
            The early versions looked more like what people expect from analytics products:
            multiple modules, chart blocks, cards, and sections. They worked technically, but
            they were forgettable. Once I removed the charts, the product got sharper.
          </p>
          <p>
            Founders do not need a prettier way to hesitate. They need a clearer way to decide.
            At the top level, a lot of founders do the same mental loop every time they open
            analytics: see the number, compare it mentally, decide whether it matters, guess what
            might be driving it, and then decide what to inspect next.
          </p>
          <p>
            Catapulse compresses that loop. The product is not “here are your metrics.” It is:
            here are your metrics, here is how they moved, and here is the first interpretation.
          </p>
        </Section>

        <Section title="What the brief surfaced on a live subscription app">
          <p>
            The default Catapulse demo runs on a real subscription app dataset rather than on a
            fabricated mock. Because the app is driven by live RevenueCat responses, the exact
            values continue to change over time. That is part of the value: the brief reflects
            the state of the business right now.
          </p>
          <p>
            During testing, the 28-day view surfaced a pattern that feels very realistic for a
            subscription app: revenue was roughly flat, new customers were down much more
            sharply, conversion to paying was up, churn had worsened, and refund rate had also
            worsened.
          </p>
          <p>
            That is a meaningful founder read. It suggests a business that is not collapsing, but
            is under pressure in ways that a topline-only view could easily hide. A chart-heavy
            dashboard would let you discover that eventually. Catapulse tries to make it obvious
            faster.
          </p>
        </Section>

        <Section title="Why this matters">
          <p>
            If you are an indie founder or small team running a subscription business, there are
            usually only a few questions that matter every week: are we growing, is acquisition
            feeding the funnel, is the funnel converting, are we retaining what we win, and is
            recurring revenue quality getting better or worse?
          </p>
          <p>
            Catapulse is built around those questions. It is not trying to replace a full
            analytics stack. It is trying to become the fastest high-signal read inside that
            stack. Not everything needs to be a platform. Sometimes the best tool is a strong
            lens.
          </p>
        </Section>

        <Section title="What makes Catapulse different from a normal dashboard">
          <p>
            There are plenty of products that can show you metrics. What makes Catapulse
            different is the combination of one-table clarity, real period comparison,
            interpretation instead of passive display, live project switching, and a deliberate
            founder-first prioritization of the signals that matter most.
          </p>
          <p>
            A lot of internal tools get worse as they get more comprehensive. Catapulse is trying
            to be useful by being opinionated.
          </p>
        </Section>

        <Section title="Why this is a compelling use case for RevenueCat’s Charts API">
          <p>
            What excites me most about Catapulse is not only the tool itself. It is what the tool
            suggests about RevenueCat’s Charts API. The obvious use case for a charts API is to
            build charts. The more interesting use case is to build products that think in
            metrics, not in chart components.
          </p>
          <p>
            Catapulse exists because the API already gives enough structure and signal to support
            founder briefs, weekly operating reviews, AI-generated subscription summaries,
            internal growth copilots, investor update generators, and compact workflow-specific
            reporting tools.
          </p>
          <p>
            That matters because adoption is rarely driven by endpoints alone. It is driven by
            seeing what kinds of products suddenly become possible. If Catapulse makes another
            builder think, “I could build a Slack weekly brief or a founder review assistant on
            top of this,” then it is doing more than demonstrating implementation. It is
            demonstrating a category.
          </p>
        </Section>

        <Section title="How Catapulse works">
          <p>
            Catapulse is built as a Next.js app with a deliberately thin client and a more
            opinionated server-side data layer. That architectural choice matters for two reasons.
            First, RevenueCat keys stay on the server. Second, the messier logic — project
            resolution, live chart fetching, retries, period aggregation, and row interpretation
            — lives in one place instead of being spread across the UI.
          </p>

          <ArchitectureDiagram />

          <p>
            The browser only needs one payload: a normalized founder brief. That lets the
            frontend stay simple while the server does the heavier work of turning raw chart
            output into a sharper operating read.
          </p>

          <p>
            For example, the local API route accepts a pasted RevenueCat key and rebuilds the
            brief for the newly resolved project:
          </p>

          <CodeBlock language="TypeScript" code={keySwitchSnippet} />

          <p>
            Under the hood, Catapulse then fans out across the RevenueCat chart endpoints it
            needs, including actives, trials, MRR, ARR, revenue, conversion, churn, refund rate,
            and movement-related signals.
          </p>

          <CodeBlock language="TypeScript" code={fetchLayerSnippet} />

          <p>
            From there, Catapulse does the more important product work: it decides how each
            metric should behave in a founder brief. Some values are averaged across the selected
            window, like active subscriptions, customers active, MRR, and ARR. Others are summed
            across the window, like revenue, transactions, new customers, and trial starts. Rate
            metrics such as conversion, churn, and refund rate are treated as rates rather than
            totals.
          </p>

          <p>
            The final row shape is intentionally simple:
          </p>

          <CodeBlock language="TypeScript" code={rowShapeSnippet} />

          <p>
            That row tells the story much faster than a dashboard that forces the founder to
            inspect multiple visual modules and synthesize the answer manually. That is the part I
            find most interesting technically: the Charts API is doing more than feeding a
            dashboard. It is acting as the substrate for a product that feels closer to a weekly
            operator memo than an analytics surface.
          </p>
        </Section>

        <Section title="Using Catapulse is deliberately simple">
          <p>
            Open the app and you immediately see the project ID, the project name, the date
            coverage, and the founder brief table. Then you do one thing: switch between
            <code> 7d</code>, <code>28d</code>, and <code>90d</code>.
          </p>
          <p>
            That is enough to understand whether the business is experiencing short-term
            momentum, medium-term softness, or longer-term improvement or decline. If you want to
            run the same brief on another project, click <strong>Change</strong>, paste another
            RevenueCat V2 key, and the app rebuilds the brief for that project.
          </p>
          <p>
            That is the whole loop. Simple in the UI. Strong in the output.
          </p>
        </Section>
      </article>

    </main>
  );
}
