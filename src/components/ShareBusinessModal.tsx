"use client";

import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { getTransactions } from "@/lib/store";
import { Business } from "@/types";
import { X, Download, Upload, Copy, Check } from "lucide-react";

interface Props {
  business: Business;
  onClose: () => void;
}

export default function ShareBusinessModal({ business, onClose }: Props) {
  const { lang, addBusiness, importTransactions } = useApp();
  const tr = t[lang];
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleExport = () => {
    const transactions = getTransactions(business.id);
    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      business: { ...business, id: undefined },
      transactions: transactions.map((tx) => ({ ...tx, id: undefined, businessId: undefined })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${business.name}-bizup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyData = async () => {
    const transactions = getTransactions(business.id);
    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      business: { ...business, id: undefined },
      transactions: transactions.map((tx) => ({ ...tx, id: undefined, businessId: undefined })),
    };
    await navigator.clipboard.writeText(JSON.stringify(exportData));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.business || !data.transactions) throw new Error("Invalid format");

        const newBiz = addBusiness({
          name: data.business.name + (lang === "he" ? " (יובא)" : " (imported)"),
          logo: data.business.logo || "",
          industry: data.business.industry,
          revenueModel: data.business.revenueModel || "",
          employees: data.business.employees || 1,
          fixedMonthlyCosts: 0,
          targetMonthlyProfit: data.business.targetMonthlyProfit || 0,
        });

        const { generateId } = require("@/lib/utils");
        const txs = data.transactions.map((tx: Record<string, unknown>) => ({
          ...tx,
          id: Math.random().toString(36).substring(2, 9),
          businessId: newBiz.id,
        }));
        importTransactions(txs);
        setImportSuccess(true);
      } catch {
        alert(lang === "he" ? "קובץ לא תקין" : "Invalid file format");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={onClose} className="absolute top-4 end-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {lang === "he" ? "שיתוף עסק" : "Share Business"}
        </h2>
        <p className="text-gray-500 text-sm mb-6">{business.name}</p>

        {importSuccess ? (
          <div className="text-center py-8">
            <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-gray-800">
              {lang === "he" ? "הנתונים יובאו בהצלחה!" : "Data imported successfully!"}
            </p>
            <button onClick={onClose} className="mt-4 text-blue-600 hover:text-blue-800 text-sm">
              {lang === "he" ? "סגור" : "Close"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Export section */}
            <div className="bg-blue-50 rounded-2xl p-5">
              <h3 className="font-semibold text-blue-800 mb-3">
                {lang === "he" ? "שתף עסק זה" : "Share this business"}
              </h3>
              <p className="text-blue-600 text-sm mb-4">
                {lang === "he"
                  ? "הורד קובץ JSON ושלח אותו למשתמש אחר. הוא יוכל לייבא אותו לחשבון BizUp שלו."
                  : "Download a JSON file and send it to another user. They can import it into their BizUp account."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  {lang === "he" ? "הורד קובץ" : "Download File"}
                </button>
                <button
                  onClick={handleCopyData}
                  className="flex items-center gap-2 border border-blue-300 text-blue-700 px-4 py-2.5 rounded-xl hover:bg-blue-50 text-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? (lang === "he" ? "הועתק!" : "Copied!") : (lang === "he" ? "העתק" : "Copy")}
                </button>
              </div>
            </div>

            {/* Import section */}
            <div className="bg-gray-50 rounded-2xl p-5">
              <h3 className="font-semibold text-gray-800 mb-3">
                {lang === "he" ? "ייבא עסק ממשתמש אחר" : "Import from another user"}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {lang === "he"
                  ? "קיבלת קובץ JSON? העלה אותו כאן."
                  : "Received a JSON file? Upload it here."}
              </p>
              <button
                onClick={() => document.getElementById("importJsonInput")?.click()}
                disabled={importing}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-600 py-3 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                {importing
                  ? (lang === "he" ? "מייבא..." : "Importing...")
                  : (lang === "he" ? "בחר קובץ JSON" : "Select JSON file")}
              </button>
              <input
                id="importJsonInput"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
