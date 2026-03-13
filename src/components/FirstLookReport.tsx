"use client";

import { useRouter } from "next/navigation";
import {
  CheckCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Star,
  PieChart,
  Lock,
  Scissors,
  AlertTriangle,
} from "lucide-react";
import { FirstLookAnalysis } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { t } from "@/lib/translations";

interface FirstLookReportProps {
  analysis: FirstLookAnalysis | null;
  loading: boolean;
  error: boolean;
  transactionCount: number;
  businessId: string;
  lang: "he" | "en";
  onRetry: () => void;
}

export default function FirstLookReport({
  analysis,
  loading,
  error,
  transactionCount,
  businessId,
  lang,
  onRetry,
}: FirstLookReportProps) {
  const tr = t[lang];
  const router = useRouter();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Header — always visible */}
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-5">
        <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
        <div>
          <p className="font-bold text-green-800 text-lg">
            {transactionCount} {lang === "he" ? "עסקאות יובאו בהצלחה" : "transactions imported"}
          </p>
          <p className="text-sm text-green-600">
            {loading ? tr.firstLookAnalyzing : error ? tr.firstLookError : tr.firstLookReady}
          </p>
        </div>
        {loading && (
          <div className="ms-auto animate-spin w-6 h-6 border-3 border-blue-400 border-t-transparent rounded-full" />
        )}
      </div>

      {/* Error state */}
      {error && !loading && (
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 border border-amber-300 bg-amber-50 text-amber-700 py-3 rounded-xl text-sm font-medium hover:bg-amber-100"
        >
          <RefreshCw className="w-4 h-4" />
          {tr.retryFirstLook}
        </button>
      )}

      {/* Loading skeleton */}
      {loading && (
        <>
          <div className="animate-pulse bg-gray-100 rounded-2xl h-28" />
          <div className="animate-pulse bg-gray-100 rounded-2xl h-36" />
          <div className="animate-pulse bg-gray-100 rounded-2xl h-32" />
        </>
      )}

      {/* Analysis cards — only when loaded */}
      {analysis && !loading && (
        <>
          {/* Hero card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-3 ${
                    analysis.isProfitable
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {analysis.isProfitable ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {analysis.isProfitable ? tr.isProfitable : tr.isNotProfitable}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{analysis.currentProfitSummary}</p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-gray-500">{tr.operatingProfit}:</span>
                  <span
                    className={`font-bold ${
                      analysis.operatingProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(analysis.operatingProfit)} / {tr.perMonthAvg}
                  </span>
                </div>
              </div>
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0 ${
                  analysis.healthScore >= 70
                    ? "bg-green-100 text-green-700"
                    : analysis.healthScore >= 40
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {analysis.healthScore}
              </div>
            </div>
          </div>

          {/* Best month + profitability shifts */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              {tr.bestMonthLabel}
            </h3>
            <div className="bg-amber-50 rounded-xl p-3 mb-4">
              <p className="font-bold text-amber-800">
                {analysis.bestMonth} — {formatCurrency(analysis.bestMonthProfit)}
              </p>
              <p className="text-xs text-amber-700 mt-1">{analysis.bestMonthReason}</p>
            </div>
            {analysis.profitabilityShifts.length > 0 && (
              <>
                <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">
                  {tr.profitabilityChanges}
                </p>
                <div className="space-y-2">
                  {analysis.profitabilityShifts.map((shift, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-xl text-sm ${
                        shift.changeType === "income_drop" || shift.changeType === "client_loss"
                          ? "bg-red-50"
                          : shift.changeType === "expense_spike" ||
                            shift.changeType === "salary_increase"
                          ? "bg-orange-50"
                          : "bg-blue-50"
                      }`}
                    >
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                          shift.changeType === "income_drop" || shift.changeType === "client_loss"
                            ? "bg-red-100 text-red-700"
                            : shift.changeType === "expense_spike" ||
                              shift.changeType === "salary_increase"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {shift.month}
                      </span>
                      <span className="text-gray-700">{shift.description}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Expense breakdown — mandatory vs discretionary */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-500" />
              {lang === "he" ? "הוצאות לפי קטגוריה" : "Expenses by Category"}
            </h3>
            <div className="mb-3 bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">
                {lang === "he" ? "הוצאה מובילה" : "Top Expense"}
              </p>
              <p className="font-bold text-blue-800">
                {analysis.topExpenseCategory} —{" "}
                {formatCurrency(analysis.topExpenseCategoryAmount)} (
                {analysis.topExpenseCategoryPercent.toFixed(1)}%)
              </p>
            </div>
            {analysis.categoryClassifications.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> {tr.mandatoryExpenses}
                  </p>
                  <div className="space-y-1">
                    {analysis.categoryClassifications
                      .filter((c) => c.type === "mandatory")
                      .map((c) => (
                        <div
                          key={c.category}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg"
                        >
                          {c.category}
                        </div>
                      ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Scissors className="w-3 h-3" /> {tr.discretionaryExpenses}
                  </p>
                  <div className="space-y-1">
                    {analysis.categoryClassifications
                      .filter((c) => c.type === "discretionary")
                      .map((c) => (
                        <div
                          key={c.category}
                          className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-lg border border-dashed border-orange-200"
                        >
                          {c.category}
                        </div>
                      ))}
                  </div>
                  {analysis.categoryClassifications.some((c) => c.type === "discretionary") && (
                    <p className="text-xs text-gray-400 mt-1">✂ {tr.canConsiderCutting}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Supplier intelligence */}
          {analysis.supplierChanges.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {tr.supplierIntelligence}
              </h3>
              <div className="space-y-2">
                {analysis.supplierChanges.map((change, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
                    {change}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next month prediction */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              {lang === "he" ? "תחזית לחודש הבא" : "Next Month Prediction"}
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600 mb-1">
                  {lang === "he" ? "הכנסות" : "Income"}
                </p>
                <p className="font-bold text-green-700 text-sm">
                  {formatCurrency(analysis.nextMonthPredictedIncome)}
                </p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600 mb-1">
                  {lang === "he" ? "הוצאות" : "Expenses"}
                </p>
                <p className="font-bold text-red-700 text-sm">
                  {formatCurrency(analysis.nextMonthPredictedExpenses)}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 text-center ${
                  analysis.nextMonthPredictedProfit >= 0 ? "bg-blue-50" : "bg-orange-50"
                }`}
              >
                <p
                  className={`text-xs mb-1 ${
                    analysis.nextMonthPredictedProfit >= 0 ? "text-blue-600" : "text-orange-600"
                  }`}
                >
                  {lang === "he" ? "נטו" : "Net"}
                </p>
                <p
                  className={`font-bold text-sm ${
                    analysis.nextMonthPredictedProfit >= 0 ? "text-blue-700" : "text-orange-700"
                  }`}
                >
                  {formatCurrency(analysis.nextMonthPredictedProfit)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  analysis.nextMonthConfidence === "high"
                    ? "bg-green-100 text-green-700"
                    : analysis.nextMonthConfidence === "medium"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {analysis.nextMonthConfidence === "high"
                  ? tr.predictionConfidenceHigh
                  : analysis.nextMonthConfidence === "medium"
                  ? tr.predictionConfidenceMedium
                  : tr.predictionConfidenceLow}
              </span>
              {analysis.nextMonthNote && (
                <p className="text-xs text-gray-400 max-w-xs text-end">
                  {analysis.nextMonthNote}
                </p>
              )}
            </div>
          </div>

          {/* Data quality warning */}
          {analysis.dataQualityNote && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                {tr.dataQualityWarning}
                {analysis.dataQualityNote}
              </span>
            </div>
          )}
        </>
      )}

      {/* Footer navigation */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => router.push(`/insights/${businessId}`)}
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50"
        >
          {tr.viewFullInsights}
        </button>
        <button
          onClick={() => router.push(`/dashboard/${businessId}`)}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700"
        >
          {tr.goToDashboard}
        </button>
      </div>
    </div>
  );
}
