"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from "recharts";
import { Language, TimeRange, Transaction } from "@/types";
import { t } from "@/lib/translations";

interface CategoriesTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}

const EXPENSE_COLORS = ["#3B82F6","#60A5FA","#93C5FD","#BFDBFE","#2563EB","#1D4ED8","#1E40AF","#1E3A8A"];
const INCOME_COLORS  = ["#10B981","#34D399","#6EE7B7","#A7F3D0","#059669","#047857","#065F46","#064E3B"];

const PROFIT_TYPE_MAP: Record<string, "gross" | "operating" | "net"> = {
  "תשלום לקוח": "gross", "client payment": "gross",
  "הכנסה אחרת": "gross", "other income": "gross",
  "מענק": "gross", "grant": "gross",
  "מלאי": "gross", "inventory": "gross",
  "שכר": "operating", "salaries": "operating",
  "שכירות": "operating", "rent": "operating",
  "שיווק": "operating", "marketing": "operating",
  "תוכנה": "operating", "software": "operating",
  "חשמל ומים": "operating", "utilities": "operating",
  "ביטוח": "operating", "insurance": "operating",
  "שירותים מקצועיים": "operating", "professional services": "operating",
  "נסיעות": "operating", "travel": "operating",
  "אוכל": "operating", "food": "operating",
  "משרד": "operating", "office": "operating",
  "בנק ועמלות": "net", "banking & fees": "net",
  "הלוואת בעלים": "net", "owner loan": "net",
  "משיכת בעלים": "net", "owner withdrawal": "net",
  "הפרשת דיבידנדים": "net", "dividend provision": "net",
  "הלוואה": "net", "loan": "net",
  "החזר מס": "net", "tax refund": "net",
  "השקעה": "net", "investment": "net",
};

function getProfitTypeLabel(categoryName: string, lang: Language): string {
  const type = PROFIT_TYPE_MAP[categoryName.trim().toLowerCase()];
  if (lang === "he") {
    if (type === "gross") return "גולמי";
    if (type === "operating") return "תפעולי";
    if (type === "net") return "נקי";
    return "—";
  }
  if (type === "gross") return "Gross";
  if (type === "operating") return "Operating";
  if (type === "net") return "Net";
  return "—";
}

function getProfitTypeBadgeClass(categoryName: string): string {
  const type = PROFIT_TYPE_MAP[categoryName.trim().toLowerCase()];
  if (type === "gross") return "bg-green-100 text-green-700";
  if (type === "operating") return "bg-blue-100 text-blue-700";
  if (type === "net") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-500";
}

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + "…" : s;

function filterByTimeRange(txs: Transaction[], range: TimeRange): Transaction[] {
  if (range === "all") return txs;
  const now = new Date();
  const [y, mo] = [now.getFullYear(), now.getMonth()];
  let boundary: Date;
  if (range === "month") boundary = new Date(y, mo, 1);
  else if (range === "3months") { const d = new Date(now); d.setDate(d.getDate() - 90); boundary = d; }
  else if (range === "6months") { const d = new Date(now); d.setDate(d.getDate() - 180); boundary = d; }
  else boundary = new Date(y, 0, 1);
  return txs.filter((tx) => {
    const [ty, tm, td] = tx.date.split("-").map(Number);
    return new Date(ty, tm - 1, td) >= boundary;
  });
}

interface CategoryGroup {
  key: string;
  name: string;
  total: number;
  count: number;
}

function buildGroups(
  txs: Transaction[],
  type: "expense" | "income",
  otherLabel: string
): CategoryGroup[] {
  const map = new Map<string, { freq: Map<string, number>; total: number; count: number }>();

  for (const tx of txs) {
    if (type === "expense" && tx.amount >= 0) continue;
    if (type === "income" && tx.amount <= 0) continue;
    const normKey = (tx.category ?? "").trim().toLowerCase() || "__other__";
    if (!map.has(normKey)) map.set(normKey, { freq: new Map(), total: 0, count: 0 });
    const g = map.get(normKey)!;
    g.total += Math.abs(tx.amount);
    g.count += 1;
    if (normKey !== "__other__" && tx.category) {
      g.freq.set(tx.category, (g.freq.get(tx.category) ?? 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([key, { freq, total, count }]) => {
      let name: string;
      if (key === "__other__") {
        name = otherLabel;
      } else {
        let best = "";
        let bestCount = 0;
        freq.forEach((c, v) => {
          if (c > bestCount || (c === bestCount && v < best)) { best = v; bestCount = c; }
        });
        name = best || otherLabel;
      }
      return { key, name, total, count };
    })
    .sort((a, b) => b.total - a.total);
}

export default function CategoriesTab({ transactions, timeRange, lang }: CategoriesTabProps) {
  const tr = t[lang];
  const [type, setType] = useState<"expense" | "income">("expense");

  const groups = useMemo(() => {
    const active = filterByTimeRange(
      transactions.filter((tx) => !tx.isExcluded && tx.amount !== 0),
      timeRange
    );
    return buildGroups(active, type, tr.otherCategory);
  }, [transactions, timeRange, type, tr.otherCategory]);

  const grandTotal = useMemo(() => groups.reduce((s, g) => s + g.total, 0), [groups]);
  const chartData = groups.slice(0, 8).map((g) => ({ name: truncate(g.name, 18), total: g.total }));
  const colors = type === "expense" ? EXPENSE_COLORS : INCOME_COLORS;

  const isEmpty = groups.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{tr.categoriesTab}</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(["expense", "income"] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => setType(tp)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                type === tp ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tp === "expense" ? tr.expensesToggle : tr.incomeToggle}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-gray-400 text-sm text-center py-12">{tr.noDataPeriod}</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => "₪" + (v as number).toLocaleString("he-IL")}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => ["₪" + (v as number).toLocaleString("he-IL")]}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.categoriesTab}
                  </th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {lang === "he" ? "סוג רווח" : "Profit Type"}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {lang === "he" ? "סכום" : "Amount"}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {lang === "he" ? "% מהסך" : "% of Total"}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.transactions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="text-start px-4 py-3 text-gray-800">{g.name}</td>
                    <td className="text-start px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getProfitTypeBadgeClass(g.name)}`}>
                        {getProfitTypeLabel(g.name, lang)}
                      </span>
                    </td>
                    <td className="text-end px-4 py-3 text-gray-700">
                      ₪{g.total.toLocaleString("he-IL")}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-500">
                      {grandTotal > 0 ? (g.total / grandTotal * 100).toFixed(1) + "%" : "—"}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-500">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
