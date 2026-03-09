"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { parseFile } from "@/lib/parser";
import { ParsedColumn, Transaction } from "@/types";
import AppShell from "@/components/AppShell";
import { formatCurrency } from "@/lib/utils";
import { getTransactions, clearBusinessTransactions } from "@/lib/store";
import { Upload, CheckCircle, FileText, X, Trash2, AlertTriangle, TrendingUp, TrendingDown, Calendar, ChevronDown, Sparkles } from "lucide-react";

const CATEGORY_OPTIONS_EN = [
  "Salaries", "Rent", "Marketing", "Software", "Utilities",
  "Banking & Fees", "Insurance", "Inventory", "Professional Services",
  "Travel", "Food", "Office", "Other"
];
const CATEGORY_OPTIONS_HE = [
  "שכר", "שכירות", "שיווק", "תוכנה", "חשמל ומים",
  "בנק ועמלות", "ביטוח", "מלאי", "שירותים מקצועיים",
  "נסיעות", "אוכל", "משרד", "אחר"
];

export default function UploadPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId, importTransactions, businesses, refreshData } = useApp();
  const tr = t[lang];
  const router = useRouter();

  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [columns, setColumns] = useState<ParsedColumn | null>(null);
  const [newTransactions, setNewTransactions] = useState<Transaction[]>([]);
  const [success, setSuccess] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId, setSelectedBusinessId]);

  const biz = businesses.find((b) => b.id === businessId);
  const existingTxs = getTransactions(businessId);

  const existingIncome = existingTxs.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
  const existingExpenses = existingTxs.filter((tx) => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const dates = existingTxs.map((tx) => tx.date).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const categorizeTxs = useCallback(async (txs: Transaction[]): Promise<Transaction[]> => {
    const uniqueDescs = [...new Set(txs.filter((t) => t.amount < 0).map((t) => t.description))].slice(0, 60);
    if (uniqueDescs.length === 0) return txs;
    try {
      setCategorizing(true);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorizeMode: true, descriptions: uniqueDescs, lang }),
      });
      const data = await res.json();
      const map: Record<string, string> = data.categories || {};
      return txs.map((t) => ({
        ...t,
        category: t.amount < 0 ? (map[t.description] ?? (lang === "he" ? "אחר" : "Other")) : t.category,
      }));
    } catch {
      return txs;
    } finally {
      setCategorizing(false);
    }
  }, [lang]);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParsing(true);
    try {
      const { columns, transactions } = await parseFile(f, businessId);
      setColumns(columns);
      setParsing(false);
      const categorized = await categorizeTxs(transactions);
      setNewTransactions(categorized);
    } catch (err) {
      alert(lang === "he" ? "שגיאה בקריאת הקובץ" : "Error reading file");
      console.error(err);
      setParsing(false);
    }
  }, [businessId, lang, categorizeTxs]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = () => {
    importTransactions(newTransactions);
    setSuccess(true);
    setTimeout(() => router.push(`/dashboard/${businessId}`), 2000);
  };

  const handleDeleteData = () => {
    clearBusinessTransactions(businessId);
    refreshData();
    setShowDeleteWarning(false);
    setFile(null);
    setColumns(null);
  };

  const updateCategory = (txId: string, category: string) => {
    setNewTransactions((prev) => prev.map((t) => t.id === txId ? { ...t, category } : t));
  };

  const colLetter = (idx: number) => String.fromCharCode(65 + idx);
  const catOptions = lang === "he" ? CATEGORY_OPTIONS_HE : CATEGORY_OPTIONS_EN;

  if (success) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">{tr.importSuccess}</h2>
          <p className="text-4xl font-bold text-blue-600 my-3">{newTransactions.length}</p>
          <p className="text-gray-500 mb-2">{tr.importedSuccess}</p>
          <p className="text-gray-400 mt-4 text-sm">{tr.redirectingToDashboard}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{tr.uploadFile}</h1>
        <p className="text-gray-500 mb-3">{biz?.name}</p>

        {/* Bank export guide */}
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-6 font-medium"
        >
          {tr.howToExportGuide}
          <ChevronDown className={`w-4 h-4 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
        </button>
        {guideOpen && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 space-y-1.5">
            {[tr.bankHapoalim, tr.bankLeumi, tr.bankDiscount, tr.googleSheets].map((line, i) => (
              <p key={i} className="text-sm text-blue-700">• {line}</p>
            ))}
          </div>
        )}

        {/* Existing data summary */}
        {existingTxs.length > 0 && !file && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">
                {lang === "he" ? "נתונים קיימים במערכת" : "Existing Data"}
              </h3>
              <button
                onClick={() => setShowDeleteWarning(true)}
                className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {lang === "he" ? "הסר נתונים" : "Remove Data"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{tr.income}</p>
                  <p className="font-bold text-green-700">{formatCurrency(existingIncome)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-red-50 rounded-xl p-3">
                <TrendingDown className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{tr.expenses}</p>
                  <p className="font-bold text-red-700">{formatCurrency(existingExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>{firstDate} — {lastDate}</span>
              <span className="mx-2">·</span>
              <span>{existingTxs.length} {lang === "he" ? "עסקאות" : "transactions"}</span>
            </div>
          </div>
        )}

        {/* Upload zone */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer ${
              dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"
            }`}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-600 mb-1">{tr.dragDrop}</p>
            <p className="text-sm text-gray-400">{tr.orBrowse}</p>
            <input
              id="fileInput"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        ) : parsing || categorizing ? (
          <div className="text-center py-16">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">
              {categorizing ? (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  {tr.categorizingTransactions}
                </span>
              ) : (
                lang === "he" ? "מנתח את הקובץ..." : "Parsing file..."
              )}
            </p>
          </div>
        ) : columns ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
              <FileText className="w-6 h-6 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">{newTransactions.length} {lang === "he" ? "עסקאות זוהו" : "transactions found"}</p>
              </div>
              <button onClick={() => { setFile(null); setColumns(null); }} className="text-gray-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-1">{tr.mappingTitle}</h3>
              <p className="text-gray-500 text-sm mb-4">{tr.mappingDesc}</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: tr.dateColumn, col: columns.dateCol },
                  { label: tr.descColumn, col: columns.descCol },
                  { label: tr.amountColumn, col: columns.amountCol },
                ].map(({ label, col }) => (
                  <div key={label} className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-500 mb-1">{label}</p>
                    <p className="font-bold text-blue-800">{lang === "he" ? `עמודה ${colLetter(col)}` : `Col ${colLetter(col)}`}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{columns.headers[col]}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-gray-800">{lang === "he" ? "תצוגה מקדימה" : "Preview"}</h3>
                {newTransactions.some((t) => t.category) && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3" />
                    {lang === "he" ? "קטגוריות הוקצו ע\"י AI" : "AI-assigned categories"}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-start pb-2 text-gray-500 font-medium">{lang === "he" ? "תאריך" : "Date"}</th>
                      <th className="text-start pb-2 text-gray-500 font-medium">{lang === "he" ? "תיאור" : "Description"}</th>
                      <th className="text-end pb-2 text-gray-500 font-medium">{lang === "he" ? "סכום" : "Amount"}</th>
                      <th className="text-start pb-2 text-gray-500 font-medium ps-2">{tr.categoryColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.preview.map((tx) => {
                      const fullTx = newTransactions.find((t) => t.id === tx.id) ?? tx;
                      return (
                        <tr key={tx.id} className="border-b border-gray-50">
                          <td className="py-2 text-gray-600">{tx.date}</td>
                          <td className="py-2 text-gray-800 max-w-xs truncate">{tx.description}</td>
                          <td className={`py-2 text-end font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-2 ps-2">
                            {tx.amount < 0 ? (
                              <select
                                value={fullTx.category ?? ""}
                                onChange={(e) => updateCategory(tx.id, e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:border-blue-400"
                              >
                                <option value="">—</option>
                                {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleImport}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {tr.confirm}
            </button>
          </div>
        ) : null}
      </div>

      {/* Delete warning modal */}
      {showDeleteWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
              <h2 className="text-xl font-bold text-gray-900">
                {lang === "he" ? "מחיקת כל הנתונים" : "Delete All Data"}
              </h2>
            </div>
            <p className="text-gray-600 mb-4">
              {lang === "he"
                ? "פעולה זו תמחק לצמיתות את כל הנתונים הפיננסיים המקושרים לעסק זה:"
                : "This will permanently delete all financial data linked to this business:"}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{lang === "he" ? "תקופה:" : "Period:"}</span>
                <span className="font-medium">{firstDate} — {lastDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{lang === "he" ? "עסקאות:" : "Transactions:"}</span>
                <span className="font-medium">{existingTxs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{tr.income}:</span>
                <span className="font-medium text-green-700">{formatCurrency(existingIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{tr.expenses}:</span>
                <span className="font-medium text-red-700">{formatCurrency(existingExpenses)}</span>
              </div>
            </div>
            <p className="text-red-600 text-sm font-medium mb-6">
              {lang === "he" ? "לא ניתן לבטל פעולה זו." : "This action cannot be undone."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteWarning(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 font-medium"
              >
                {tr.cancel}
              </button>
              <button
                onClick={handleDeleteData}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 font-medium"
              >
                {lang === "he" ? "מחק הכל" : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
