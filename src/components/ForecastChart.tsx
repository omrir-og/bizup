"use client";

import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { formatCurrency } from "@/lib/utils";
import { CashFlowPoint } from "@/types";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Legend
} from "recharts";

interface Props {
  data: CashFlowPoint[];
}

export default function ForecastChart({ data }: Props) {
  const { lang } = useApp();
  const tr = t[lang];

  if (data.length === 0) return null;

  const minBalance = Math.min(...data.map((d) => d.balance));
  const hasNegative = minBalance < 0;

  // Split into actual and projected for dual rendering
  const chartData = data.map((d) => ({
    month: d.month.substring(5), // MM
    fullMonth: d.month,
    actual: d.isProjected ? null : d.balance,
    projected: d.isProjected ? d.balance : null,
    // Overlap point: last actual = first projected
    overlap: !d.isProjected ? d.balance : null,
  }));

  // Add overlap: last actual point gets projected value too
  const lastActualIdx = [...data].reverse().findIndex((d) => !d.isProjected);
  if (lastActualIdx >= 0) {
    const idx = data.length - 1 - lastActualIdx;
    chartData[idx].projected = chartData[idx].actual;
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-1">{tr.forecastTitle}</h3>
      <p className="text-xs text-gray-400 mb-4">
        {lang === "he" ? "קווים מקווקווים = תחזית" : "Dashed lines = projected"}
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "actual" ? tr.actual : tr.projected,
            ]}
            labelFormatter={(label) => label}
          />
          <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
          {hasNegative && (
            <ReferenceArea
              y1={minBalance * 1.1}
              y2={0}
              fill="#fef2f2"
              fillOpacity={0.6}
            />
          )}
          <Area
            type="monotone"
            dataKey="actual"
            fill="#dbeafe"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            connectNulls
            name="actual"
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ fill: "#94a3b8", r: 3 }}
            connectNulls
            name="projected"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
