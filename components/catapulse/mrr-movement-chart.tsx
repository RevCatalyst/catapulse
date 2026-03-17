"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardPayload } from "@/lib/catapulse-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function MrrMovementChart({ chart }: { chart: DashboardPayload["mrrMovement"] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{chart.title}</CardTitle>
          <CardDescription>{chart.description}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant={
              chart.netTone === "up"
                ? "default"
                : chart.netTone === "down"
                  ? "secondary"
                  : "outline"
            }
          >
            {chart.monthLabel}
          </Badge>
          <p className="text-sm text-muted-foreground">Net movement</p>
          <p className="text-xl font-semibold text-primary">{chart.netMovement}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.items} layout="vertical" margin={{ top: 4, right: 8, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(213, 98, 20, 0.12)" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCurrency} tickLine={false} axisLine={false} tick={{ fill: "#8c8c94", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tick={{ fontSize: 12, fill: "#8c8c94" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 18,
                    border: "1px solid rgba(213, 98, 20, 0.25)",
                    background: "#101011",
                    color: "#8c8c94",
                    boxShadow: "0 18px 48px -24px rgba(0, 0, 0, 0.72)",
                  }}
                  formatter={(value) =>
                    typeof value === "number" ? formatCurrency(value) : String(value ?? "")
                  }
                />
                <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                  {chart.items.map((item) => (
                    <Cell
                      key={item.label}
                      fill={
                        item.tone === "up"
                          ? "#d56214"
                          : item.tone === "down"
                            ? "#8c8c94"
                            : "#5f5f66"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full animate-pulse rounded-[1.25rem] bg-accent" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
