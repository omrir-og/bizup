"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { getTransactions, deleteTransaction, updateTransactions } from "@/lib/store";
import AppShell from "@/components/AppShell";
import { formatCurrency } from "@/lib/utils";
import { Trash2, Search, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, AlertTriangle, EyeOff, Eye } from "lucide-react";
import { Transaction } from "@/types";

const PAGE_SIZE = 50;

function SortHeader({
  label, col, sortCol, sortDir, onClick
}: {
  label: string;
  col: "date" | "description" | "category" | "amount";
  sortCol: string;
  sortDir: "asc" | "desc";
  onClick: () => void;
}) {
  const active = sortCol === col;
  return (
    <th
      onClick={onClick}
      className="px-6 py-3 text-gray-500 font-medium cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-xs opacity-60">
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

export default function TransactionsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId, businesses } = useApp();
  const tr = t[lang];

  useEffect(() => { setSelectedBusinessId(businessId); }, [businessId, setSelectedBusinessId]);

  const biz = businesses.find((b) => b.id === businessId);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "excluded">("all");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [sortCol, setSortCol] = useState<"date" | "description" | "category" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [txs, setTxs] = useState<Transaction[]>(() =>
    getTransactions(businessId).sort((a, b) => b.date.localeCompare(a.date))
  );

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      const matchesQuery = !query || t.description.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "income" && t.amount > 0) ||
        (filter === "expense" && t.amount < 0) ||
        (filter === "excluded" && t.isExcluded === true);
      return matchesQuery && matchesFilter;
    });
  }, [txs, query, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") cmp = a.date.localeCompare(b.date);
      else if (sortCol === "description") cmp = a.description.localeCompare(b.description);
      else if (sortCol === "category") cmp = (a.category ?? "").localeCompare(b.category ?? "");
      else if (sortCol === "amount") cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalIncome = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const handleDelete = (tx: Transaction) => {
    deleteTransaction(tx.id);
    setTxs((prev) => prev.filter((t) => t.id !== tx.id));
    setConfirmDelete(null);
    if (page > 1 && paginated.length === 1) setPage((p) => p - 1);
  };

  const handleToggleExclude = (tx: Transaction) => {
    const updated: Transaction = {
      ...tx,
      isExcluded: !tx.isExcluded,
      excludeReason: !tx.isExcluded ? "manual" : undefined,
    };
    updateTransactions([updated]);
    setTxs((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <AppShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{tr.transactionsPage}</h1>
          <p className="text-gray-500 mt-1">{biz?.name}</p>
          {txs.length > 0 && (() => {
            const dates = txs.map(t => t.date).sort();
            const from = dates[0];
            const to = dates[dates.length - 1];
            return (
              <p className="text-sm text-gray-400 mt-0.5">
                {lang === "he" ? `נתונים מ-${from} עד ${to}` : `Data from ${from} to ${to}`}
              </p>
            );
          })()}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <p className="text-xs text-gray-500 mb-1">{tr.transactions}</p>
              <p className="text-xl font-bold text-gray-800">{filtered.length}</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{tr.income}</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{tr.expenses}</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(totalExpenses)}</p>
            </div>
          </div>

        {/* Search + filter */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={tr.searchTransactions}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="w-full ps-9 pe-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["all", "income", "expense", "excluded"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "all" ? tr.filterAll
                  : f === "income" ? tr.filterIncome
                  : f === "expense" ? tr.filterExpenses
                  : tr.excludedTransactions}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <>
            {paginated.length === 0 ? (
              <div className="text-center py-16 text-gray-400">{tr.noTransactionsFound}</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <SortHeader
                        label={lang === "he" ? "תאריך" : "Date"}
                        col="date"
                        sortCol={sortCol} sortDir={sortDir}
                        onClick={() => { setSortDir(sortCol === "date" && sortDir === "desc" ? "asc" : "desc"); setSortCol("date"); setPage(1); }}
                      />
                      <SortHeader
                        label={lang === "he" ? "תיאור" : "Description"}
                        col="description"
                        sortCol={sortCol} sortDir={sortDir}
                        onClick={() => { setSortDir(sortCol === "description" && sortDir === "desc" ? "asc" : "desc"); setSortCol("description"); setPage(1); }}
                      />
                      <SortHeader
                        label={tr.categoryColumn}
                        col="category"
                        sortCol={sortCol} sortDir={sortDir}
                        onClick={() => { setSortDir(sortCol === "category" && sortDir === "desc" ? "asc" : "desc"); setSortCol("category"); setPage(1); }}
                      />
                      <SortHeader
                        label={lang === "he" ? "סכום" : "Amount"}
                        col="amount"
                        sortCol={sortCol} sortDir={sortDir}
                        onClick={() => { setSortDir(sortCol === "amount" && sortDir === "desc" ? "asc" : "desc"); setSortCol("amount"); setPage(1); }}
                      />
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((tx) => (
                      <tr key={tx.id} className={`border-b border-gray-50 hover:bg-gray-50 group ${tx.isExcluded ? "opacity-50" : ""}`}>
                        <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{tx.date}</td>
                        <td className="px-6 py-3 text-gray-800 max-w-xs truncate">{tx.description}</td>
                        <td className="px-6 py-3">
                          {tx.category ? (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tx.category}</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className={`px-6 py-3 text-end font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"} ${tx.isExcluded ? "line-through" : ""}`}>
                          {tx.amount >= 0 ? (
                            <span className="flex items-center justify-end gap-1">
                              <TrendingUp className="w-3 h-3" />{formatCurrency(tx.amount)}
                            </span>
                          ) : (
                            <span className="flex items-center justify-end gap-1">
                              <TrendingDown className="w-3 h-3" />{formatCurrency(Math.abs(tx.amount))}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleExclude(tx)}
                              title={tx.isExcluded ? tr.includeInCalc : tr.excludeFromCalc}
                              className={`opacity-0 group-hover:opacity-100 transition-all ${
                                tx.isExcluded ? "opacity-100 text-amber-500 hover:text-amber-700" : "text-gray-300 hover:text-amber-500"
                              }`}
                            >
                              {tx.isExcluded ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(tx)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} {lang === "he" ? "מתוך" : "of"} {filtered.length}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <h3 className="font-semibold text-gray-900">{tr.confirmDeleteTx}</h3>
            </div>
            <p className="text-sm text-gray-500 mb-1">{confirmDelete.description}</p>
            <p className={`text-sm font-medium mb-5 ${confirmDelete.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(confirmDelete.amount))}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 text-sm font-medium"
              >
                {tr.cancel}
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl hover:bg-red-700 text-sm font-medium"
              >
                {tr.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
