"use client";

import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { formatCurrency } from "@/lib/utils";
import { SupplierSummary } from "@/types";
import { RefreshCw, Search, ArrowUpDown } from "lucide-react";

type SortKey = "totalPaid" | "transactionCount" | "lastSeen";

interface Props {
  suppliers: SupplierSummary[];
}

export default function SupplierTable({ suppliers }: Props) {
  const { lang } = useApp();
  const tr = t[lang];
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalPaid");
  const [sortAsc, setSortAsc] = useState(false);

  if (suppliers.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center text-gray-400">
        {tr.noSuppliers}
      </div>
    );
  }

  const totalExpenses = suppliers.reduce((s, sup) => s + sup.totalPaid, 0);
  const top3Total = suppliers.slice(0, 3).reduce((s, sup) => s + sup.totalPaid, 0);
  const top3Pct = totalExpenses > 0 ? ((top3Total / totalExpenses) * 100).toFixed(0) : 0;
  const recurringCount = suppliers.filter((s) => s.isRecurring).length;

  const filtered = suppliers
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortAsc ? cmp : -cmp;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortBtn = ({ col }: { col: SortKey }) => (
    <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-blue-600">
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4">
        <h3 className="font-semibold text-gray-800 mb-1">{tr.suppliers}</h3>
        <p className="text-sm text-gray-500">
          {lang === "he"
            ? `3 הספקים הגדולים = ${top3Pct}% מהוצאות · ${recurringCount} ספקים חוזרים`
            : `Top 3 suppliers = ${top3Pct}% of expenses · ${recurringCount} recurring suppliers`}
        </p>
      </div>

      {/* Search */}
      <div className="px-6 pb-4">
        <div className="relative">
          <Search className="absolute w-4 h-4 text-gray-400 top-2.5 start-3" />
          <input
            type="text"
            placeholder={tr.searchSupplier}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-y border-gray-100">
            <tr>
              <th className="text-start px-6 py-3 text-gray-500 font-medium">{tr.supplierName}</th>
              <th className="text-end px-4 py-3 text-gray-500 font-medium">
                <span className="flex items-center justify-end gap-1">
                  {tr.totalPaid} <SortBtn col="totalPaid" />
                </span>
              </th>
              <th className="text-end px-4 py-3 text-gray-500 font-medium">
                <span className="flex items-center justify-end gap-1">
                  {tr.transactions} <SortBtn col="transactionCount" />
                </span>
              </th>
              <th className="text-end px-4 py-3 text-gray-500 font-medium">{tr.avgAmount}</th>
              <th className="text-end px-4 py-3 text-gray-500 font-medium">
                <span className="flex items-center justify-end gap-1">
                  {tr.lastPayment} <SortBtn col="lastSeen" />
                </span>
              </th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium">{tr.recurring}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((sup, i) => (
              <tr
                key={sup.name}
                className={`hover:bg-gray-50 transition-colors ${i < 3 ? "border-s-2 border-s-red-300" : ""}`}
              >
                <td className="px-6 py-3">
                  <span className="font-medium text-gray-800 line-clamp-1">{sup.name}</span>
                </td>
                <td className="px-4 py-3 text-end font-semibold text-gray-900">
                  {formatCurrency(sup.totalPaid)}
                </td>
                <td className="px-4 py-3 text-end text-gray-600">{sup.transactionCount}</td>
                <td className="px-4 py-3 text-end text-gray-500">{formatCurrency(sup.avgAmount)}</td>
                <td className="px-4 py-3 text-end text-gray-500">{sup.lastSeen}</td>
                <td className="px-4 py-3 text-center">
                  {sup.isRecurring && (
                    <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium">
                      <RefreshCw className="w-3 h-3" />
                      {tr.recurring}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
