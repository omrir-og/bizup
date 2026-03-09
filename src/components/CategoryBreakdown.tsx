"use client";

import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { groupByCategory, formatCurrency } from "@/lib/utils";
import { Transaction } from "@/types";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#22c55e", "#8b5cf6", "#ec4899", "#64748b"];

interface Props {
  transactions: Transaction[];
}

export default function CategoryBreakdown({ transactions }: Props) {
  const { lang } = useApp();
  const tr = t[lang];

  const raw = groupByCategory(transactions);
  if (Object.keys(raw).length === 0) return null;

  // Sort and cap at top 6 + Other
  const sorted = Object.entries(raw).sort(([, a], [, b]) => b - a);
  const top6 = sorted.slice(0, 6);
  const otherTotal = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
  const data = [
    ...top6.map(([name, value]) => ({ name, value })),
    ...(otherTotal > 0 ? [{ name: tr.catOther, value: otherTotal }] : []),
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-4">{tr.expensesByCategory}</h3>
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 w-full space-y-2 min-w-0">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="flex-1 text-gray-700 truncate">{d.name}</span>
              <span className="font-medium text-gray-800 flex-shrink-0">{formatCurrency(d.value)}</span>
              <span className="text-gray-400 text-xs flex-shrink-0">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
