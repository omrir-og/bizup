"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { getTransactions } from "@/lib/store";
import { groupByMonth, formatCurrency } from "@/lib/utils";
import AppShell from "@/components/AppShell";
import OnboardingModal from "@/components/OnboardingModal";
import ShareBusinessModal from "@/components/ShareBusinessModal";
import CategoryPickerModal from "@/components/CategoryPickerModal";
import SparklineChart from "@/components/SparklineChart";
import { Business } from "@/types";
import { Plus, TrendingUp, TrendingDown, Trash2, BarChart3, Share2 } from "lucide-react";

export default function HomePage() {
  const { lang, businesses, setSelectedBusinessId, removeBusiness, transactions } = useApp();
  const tr = t[lang];
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sharingBusiness, setSharingBusiness] = useState<Business | null>(null);
  const [sortBy, setSortBy] = useState<"balance" | "name" | "transactions">("balance");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [categoryPickerBizId, setCategoryPickerBizId] = useState<string | null>(null);
  const [categoryPickerIndustry, setCategoryPickerIndustry] = useState<string>("services");

  const handleOnboardingClose = (businessId?: string) => {
    setShowOnboarding(false);
    if (businessId) {
      setSelectedBusinessId(businessId);
      const biz = businesses.find(b => b.id === businessId);
      setCategoryPickerBizId(businessId);
      setCategoryPickerIndustry(biz?.industry ?? "services");
    }
  };

  const getBusinessStats = (bizId: string) => {
    const txs = getTransactions(bizId);
    const stats = groupByMonth(txs);
    const last = stats[stats.length - 1];
    const sparkData = stats.slice(-6).map((s) => ({ value: s.netProfit }));
    const totalBalance = txs.reduce((s, tx) => s + tx.amount, 0);
    return { last, sparkData, totalBalance, txCount: txs.length };
  };

  const sortedBusinesses = [...businesses].sort((a, b) => {
    const statsA = getBusinessStats(a.id);
    const statsB = getBusinessStats(b.id);
    let val = 0;
    if (sortBy === "balance") val = statsA.totalBalance - statsB.totalBalance;
    else if (sortBy === "name") val = a.name.localeCompare(b.name);
    else if (sortBy === "transactions") val = statsA.txCount - statsB.txCount;
    return sortDir === "desc" ? -val : val;
  });

  const allStats = groupByMonth(transactions);
  const consolidatedBalance = transactions.reduce((s, tx) => s + tx.amount, 0);
  const consolidatedSparkData = allStats.slice(-6).map((s) => ({ value: s.netProfit }));
  const lastConsolidated = allStats[allStats.length - 1];

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tr.hub}</h1>
            <p className="text-gray-500 mt-1">{tr.tagline}</p>
          </div>
          <button
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {tr.addBusiness}
          </button>
        </div>

        {businesses.length > 1 && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <span className="text-gray-500">{lang === "he" ? "מיון לפי:" : "Sort by:"}</span>
            {(["balance", "name", "transactions"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (sortBy === s) setSortDir(d => d === "desc" ? "asc" : "desc");
                  else { setSortBy(s); setSortDir("desc"); }
                }}
                className={`px-3 py-1 rounded-lg border transition-colors ${sortBy === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
              >
                {s === "balance" ? (lang === "he" ? "יתרה" : "Balance") : s === "name" ? (lang === "he" ? "שם" : "Name") : (lang === "he" ? "עסקאות" : "Transactions")}
                {sortBy === s && (sortDir === "desc" ? " ↓" : " ↑")}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses.length > 1 && (
            <button
              onClick={() => { setSelectedBusinessId(null); router.push("/dashboard"); }}
              className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-start"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-lg">{tr.consolidatedView}</span>
                <BarChart3 className="w-6 h-6 opacity-70" />
              </div>
              <div className="text-3xl font-bold mb-1">{formatCurrency(consolidatedBalance)}</div>
              <div className="text-blue-200 text-sm mb-4">
                {businesses.length} {lang === "he" ? "עסקים" : "businesses"}
              </div>
              {lastConsolidated && (
                <div className={`flex items-center gap-1 text-sm ${lastConsolidated.netProfit >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {lastConsolidated.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {formatCurrency(lastConsolidated.netProfit)} {lang === "he" ? "החודש" : "this month"}
                </div>
              )}
              <div className="mt-4 opacity-70">
                <SparklineChart data={consolidatedSparkData} positive={consolidatedBalance >= 0} />
              </div>
            </button>
          )}

          {sortedBusinesses.map((biz) => {
            const { last, sparkData, totalBalance, txCount } = getBusinessStats(biz.id);
            const isPositive = totalBalance >= 0;
            return (
              <div key={biz.id} className="relative group">
                <button
                  onClick={() => { setSelectedBusinessId(biz.id); router.push(`/dashboard/${biz.id}`); }}
                  className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all w-full text-start border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{biz.name}</h3>
                      <p className="text-gray-400 text-sm capitalize">{biz.industry}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0 ${!biz.logo ? (isPositive ? "bg-green-500" : "bg-red-500") : ""}`}>
                      {biz.logo ? (
                        <img src={biz.logo} alt={biz.name} className="w-full h-full object-cover" />
                      ) : (
                        biz.name[0]?.toUpperCase()
                      )}
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalBalance)}</div>
                    <div className="text-gray-500 text-sm">{txCount} {tr.transactions_count}</div>
                  </div>
                  {last && (
                    <div className={`flex items-center gap-1 text-sm mb-3 ${last.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {last.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {formatCurrency(last.netProfit)} {lang === "he" ? "החודש" : "this month"}
                    </div>
                  )}
                  <SparklineChart data={sparkData} positive={isPositive} />
                </button>
                <div className="absolute top-3 end-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSharingBusiness(biz); }}
                    className="text-gray-400 hover:text-blue-500 p-1 rounded-lg hover:bg-blue-50"
                    title={lang === "he" ? "שתף" : "Share"}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(lang === "he" ? "למחוק עסק זה?" : "Delete this business?")) removeBusiness(biz.id);
                    }}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            onClick={() => setShowOnboarding(true)}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors min-h-48"
          >
            <Plus className="w-10 h-10" />
            <span className="font-medium">{tr.addBusiness}</span>
          </button>
        </div>
      </div>

      {showOnboarding && <OnboardingModal onClose={handleOnboardingClose} />}
      {sharingBusiness && <ShareBusinessModal business={sharingBusiness} onClose={() => setSharingBusiness(null)} />}
      {categoryPickerBizId && (
        <CategoryPickerModal
          businessId={categoryPickerBizId}
          industry={categoryPickerIndustry}
          onClose={() => {
            const bizId = categoryPickerBizId;
            setCategoryPickerBizId(null);
            router.push(`/dashboard/${bizId}`);
          }}
        />
      )}
    </AppShell>
  );
}
