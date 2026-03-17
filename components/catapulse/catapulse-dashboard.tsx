"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { DashboardPayload, RangeKey } from "@/lib/catapulse-data";
import { Button } from "@/components/ui/button";

type ParsedMarkdownTable = {
  headers: string[];
  rows: string[][];
};

const TABLE_LINE_COLOR = "#e56f1d";

function parseTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseMarkdownTable(markdown: string): ParsedMarkdownTable | null {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return null;
  }

  const headers = parseTableRow(lines[0]);
  const rows = lines
    .slice(2)
    .map(parseTableRow)
    .filter((row) => row.length === headers.length);

  if (!headers.length || !rows.length) {
    return null;
  }

  return { headers, rows };
}

function alignmentForCell(header: string) {
  return header === "Current" || header === "Change" ? "text-right" : "text-left";
}

function columnWidthForHeader(header: string) {
  if (header === "Metric") return "w-[20rem]";
  if (header === "Current") return "w-[10rem]";
  if (header === "Change") return "w-[16rem]";
  return "w-auto";
}

function MetadataDot() {
  return <span className="text-primary/60">•</span>;
}

function MarkdownTable({ markdown }: { markdown: string }) {
  const table = parseMarkdownTable(markdown);

  if (!table) {
    return (
      <pre
        className="overflow-x-auto whitespace-pre-wrap border border-dashed p-4 font-mono text-sm leading-7 text-[#c8c8d2]"
        style={{ borderColor: TABLE_LINE_COLOR }}
      >
        <code>{markdown}</code>
      </pre>
    );
  }

  return (
    <div className="overflow-x-auto border border-dashed" style={{ borderColor: TABLE_LINE_COLOR }}>
      <table className="min-w-full table-fixed border-separate border-spacing-0 font-mono text-sm leading-6 text-[#c8c8d2]">
        <colgroup>
          {table.headers.map((header) => (
            <col key={header} className={columnWidthForHeader(header)} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-primary">
            {table.headers.map((header, headerIndex) => (
              <th
                key={header}
                style={{ borderColor: TABLE_LINE_COLOR }}
                className={`border-b border-dashed px-4 py-3 font-semibold ${alignmentForCell(header)} ${columnWidthForHeader(header)} ${headerIndex < table.headers.length - 1 ? "border-r" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${row.join("-")}-${rowIndex}`} className="align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cell}-${cellIndex}`}
                  style={{ borderColor: TABLE_LINE_COLOR }}
                  className={`px-4 py-3 ${alignmentForCell(table.headers[cellIndex] ?? "")} ${cellIndex < row.length - 1 ? "border-r" : ""} ${rowIndex < table.rows.length - 1 ? "border-b" : ""} border-dashed`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CatapulseDashboard({ dashboard }: { dashboard: DashboardPayload }) {
  const [selectedRange, setSelectedRange] = useState<RangeKey>("28d");
  const [currentDashboard, setCurrentDashboard] = useState(dashboard);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [projectKeyInput, setProjectKeyInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const view = currentDashboard.rangeViews[selectedRange];

  const handleProjectChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedKey = projectKeyInput.trim();
    if (!normalizedKey) {
      setError("Enter a RevenueCat project key.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/catapulse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey: normalizedKey }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Unable to load project data.");
        }

        const nextDashboard = (await response.json()) as DashboardPayload;
        setCurrentDashboard(nextDashboard);
        setShowChangeForm(false);
        setProjectKeyInput("");
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to load project data.";
        setError(message);
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-none flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <section className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Catapulse — RevenueCat Founder Brief
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-primary">
          <span>Project ID: {currentDashboard.projectId}</span>
          <MetadataDot />
          <span>Project Name: {currentDashboard.projectName}</span>
          <MetadataDot />
          <span>Coverage: {currentDashboard.extractedRange}</span>
          <MetadataDot />
          <Button
            type="button"
            size="sm"
            variant="outline"
            style={{ borderColor: TABLE_LINE_COLOR }}
            className="h-7 rounded-none border border-dashed bg-transparent px-3 text-[11px] uppercase tracking-[0.18em] text-[#c8c8d2] hover:bg-transparent hover:text-[#f0f0f4]"
            onClick={() => {
              setShowChangeForm((value) => !value);
              setError(null);
            }}
          >
            Change
          </Button>
        </div>

        {showChangeForm ? (
          <form onSubmit={handleProjectChange} className="flex w-full max-w-3xl flex-col items-center gap-3 pt-2">
            <label
              htmlFor="project-key"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-primary"
            >
              Input Project Key:
            </label>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
              <input
                id="project-key"
                type="password"
                value={projectKeyInput}
                onChange={(event) => setProjectKeyInput(event.target.value)}
                placeholder="sk_..."
                className="h-10 flex-1 rounded-none border border-dashed bg-transparent px-4 font-mono text-sm text-[#c8c8d2] outline-none placeholder:text-[#7d7d86] focus:border-primary"
                style={{ borderColor: TABLE_LINE_COLOR }}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                style={{ borderColor: TABLE_LINE_COLOR }}
                className="h-10 min-w-32 rounded-none border border-dashed bg-transparent text-[#c8c8d2] hover:bg-transparent hover:text-[#f0f0f4]"
                disabled={isPending}
              >
                {isPending ? "Loading..." : "Load project"}
              </Button>
            </div>
            {error ? <p className="text-sm text-primary">{error}</p> : null}
          </form>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {currentDashboard.ranges.map((range) => (
            <Button
              key={range.key}
              size="sm"
              variant="outline"
              style={{
                borderColor: TABLE_LINE_COLOR,
                ...(selectedRange === range.key ? { color: TABLE_LINE_COLOR } : {}),
              }}
              className={
                selectedRange === range.key
                  ? "min-w-32 rounded-none border border-dashed bg-transparent text-current hover:bg-transparent hover:text-current"
                  : "min-w-32 rounded-none border border-dashed bg-transparent text-[#c8c8d2] hover:bg-transparent hover:text-[#f0f0f4]"
              }
              onClick={() => setSelectedRange(range.key)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="w-full">
        <MarkdownTable markdown={view.snapshotMarkdown} />
      </section>
    </main>
  );
}
