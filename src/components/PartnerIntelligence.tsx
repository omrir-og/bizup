"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { Transaction } from "@/types";
import { formatCurrency, extractSuppliers, extractClients, generateId } from "@/lib/utils";
import { getMergeRules, saveMergeRule } from "@/lib/store";
import { Users, TrendingUp, TrendingDown, Merge, Edit2, Check, X } from "lucide-react";

// Simple Jaccard similarity on word sets for merge suggestions
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function findMergeCandidates(names: string[]): Array<[string, string]> {
  const candidates: Array<[string, string]> = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (jaccardSimilarity(names[i], names[j]) >= 0.5) {
        candidates.push([names[i], names[j]]);
      }
    }
  }
  return candidates;
}

interface Props {
  transactions: Transaction[];
  businessId: string;
}

export default function PartnerIntelligence({ transactions, businessId }: Props) {
  const { lang } = useApp();
  const tr = t[lang];

  const [tab, setTab] = useState<"clients" | "suppliers">("suppliers");
  const [mergeRules, setMergeRules] = useState(() => getMergeRules(businessId));
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});

  // Apply merge rules and renames to a list
  const applyMerges = useCallback(<T extends { name: string; totalPaid: number }>(items: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of items) {
      const rule = mergeRules.find((r) => r.aliases.includes(item.name));
      const key = rule ? rule.canonicalName : (renameMap[item.name] ?? item.name);
      if (map.has(key)) {
        const existing = map.get(key)!;
        map.set(key, { ...existing, totalPaid: existing.totalPaid + item.totalPaid } as T);
      } else {
        map.set(key, { ...item, name: key } as T);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
  }, [mergeRules, renameMap]);

  const rawSuppliers = extractSuppliers(transactions);
  const rawClients = extractClients(transactions);
  const suppliers = applyMerges(rawSuppliers);
  const clients = applyMerges(rawClients);

  const currentItems = tab === "suppliers" ? suppliers : clients;
  const allNames = currentItems.map((i) => i.name);
  const mergeCandidates = findMergeCandidates(allNames).filter(
    ([a, b]) => !dismissedPairs.has(`${a}|${b}`)
  );

  const handleMerge = (a: string, b: string, canonical: string) => {
    const rule = { id: generateId(), canonicalName: canonical, aliases: [a, b], createdAt: new Date().toISOString() };
    saveMergeRule(businessId, rule);
    setMergeRules((prev) => [...prev, rule]);
    setDismissedPairs((prev) => new Set([...prev, `${a}|${b}`]));
  };

  const handleDismiss = (a: string, b: string) => {
    setDismissedPairs((prev) => new Set([...prev, `${a}|${b}`]));
  };

  const handleRename = (oldName: string) => {
    if (nameInput.trim()) {
      setRenameMap((prev) => ({ ...prev, [oldName]: nameInput.trim() }));
    }
    setEditingName(null);
    setNameInput("");
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-800">{tr.partnerIntelligence}</h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {(["suppliers", "clients"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === tabKey ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tabKey === "suppliers" ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            {tabKey === "suppliers" ? tr.suppliersTab : tr.clients}
          </button>
        ))}
      </div>

      {/* Merge suggestions */}
      {mergeCandidates.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
            <Merge className="w-3.5 h-3.5" />
            {tr.mergeNames}
          </p>
          {mergeCandidates.slice(0, 3).map(([a, b]) => (
            <div key={`${a}|${b}`} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-800 mb-2">
                {tr.mergeSuggestion.replace("{a}", a).replace("{b}", b)}
              </p>
              <div className="flex gap-2">
                <button onClick={() => handleMerge(a, b, a)} className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600">
                  {tr.mergeConfirm} → {a}
                </button>
                <button onClick={() => handleMerge(a, b, b)} className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50">
                  {tr.mergeConfirm} → {b}
                </button>
                <button onClick={() => handleDismiss(a, b)} className="text-xs text-gray-400 hover:text-gray-600 ms-auto">
                  {tr.mergeReject}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Partner list */}
      {currentItems.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          {tab === "clients" ? tr.noClients : tr.noSuppliers}
        </p>
      ) : (
        <div className="space-y-1">
          {currentItems.slice(0, 15).map((item, idx) => (
            <div key={item.name} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${idx < 3 ? "font-medium" : ""}`}>
              <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${tab === "suppliers" ? "bg-red-300" : "bg-green-400"} ${idx >= 3 ? "opacity-40" : ""}`} />
              <div className="flex-1 min-w-0">
                {editingName === item.name ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(item.name)}
                      className="text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:border-blue-400 w-32"
                    />
                    <button onClick={() => handleRename(item.name)} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingName(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <p className="text-sm text-gray-800 truncate">{item.name}</p>
                    <button
                      onClick={() => { setEditingName(item.name); setNameInput(item.name); }}
                      className="text-gray-200 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400">{item.transactionCount}x · {item.isRecurring ? "🔄 " : ""}{item.lastSeen}</p>
              </div>
              <p className={`text-sm font-medium ${tab === "suppliers" ? "text-gray-700" : "text-green-600"}`}>
                {formatCurrency(item.totalPaid)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
