"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { parseFile, ParseOverrides } from "@/lib/parser";
import { ParsedColumn, Transaction, FirstLookAnalysis } from "@/types";
import AppShell from "@/components/AppShell";
import FirstLookReport from "@/components/FirstLookReport";
import { formatCurrency, cleanDescription, buildFirstLookContext, generateId } from "@/lib/utils";
import {
  getTransactions,
  clearBusinessTransactions,
  findDuplicates,
  getFirstLookAnalysis,
  saveFirstLookAnalysis,
  saveMergeRule,
} from "@/lib/store";
import {
  Upload, CheckCircle, FileText, X, Trash2, AlertTriangle,
  TrendingUp, TrendingDown, Calendar, ChevronDown, Sparkles, HelpCircle,
  Pencil, RefreshCw, ArrowRight, Users,
} from "lucide-react";

const CATEGORY_OPTIONS_EN = [
  "Salaries", "Rent", "Marketing", "Software", "Utilities",
  "Banking & Fees", "Insurance", "Inventory", "Professional Services",
  "Travel", "Food", "Office", "Other",
  // Income categories
  "Client Payment", "Loan", "Tax Refund", "Investment", "Grant", "Other Income",
];
const CATEGORY_OPTIONS_HE = [
  "שכר", "שכירות", "שיווק", "תוכנה", "חשמל ומים",
  "בנק ועמלות", "ביטוח", "מלאי", "שירותים מקצועיים",
  "נסיעות", "אוכל", "משרד", "אחר",
  // Income categories
  "תשלום לקוח", "הלוואה", "החזר מס", "השקעה", "מענק", "הכנסה אחרת",
];

type AmbiguityChoice = "negative_expense" | "separate_column" | "all_income";
type UploadStage = "idle" | "parsing" | "confirming" | "cleaning" | "naming" | "merging" | "reviewing" | "importing" | "success";

// ── Owner transaction detection ─────────────────────────────────────────────
function detectOwnerTransactions(
  txs: Transaction[],
  ownerNames: string[]
): { txs: Transaction[]; count: number } {
  if (!ownerNames.length) return { txs, count: 0 };
  const words = ownerNames
    .flatMap((n) => n.trim().split(/\s+/))
    .filter((w) => w.length >= 2);
  if (words.length === 0) return { txs, count: 0 };
  const divKeywords = /דיבידנד|הפרשה|dividend/i;
  let count = 0;
  const updated = txs.map((tx) => {
    const desc = tx.description.toLowerCase();
    const hasOwnerWord = words.some((w) => desc.includes(w.toLowerCase()));
    if (!hasOwnerWord) return tx;
    count++;
    if (divKeywords.test(desc)) {
      return { ...tx, category: "הפרשת דיבידנדים", isExcluded: true, excludeReason: "dividend" as const };
    }
    if (tx.amount > 0) {
      return { ...tx, category: "הלוואת בעלים", isExcluded: true, excludeReason: "owner_loan" as const };
    }
    return { ...tx, category: "משיכת בעלים", isExcluded: true, excludeReason: "owner_loan" as const };
  });
  return { txs: updated, count };
}

// ── Dividend tax candidate detection ────────────────────────────────────────
function findDividendTaxCandidates(txs: Transaction[]): Transaction[] {
  const dividendTxs = txs.filter((t) => t.excludeReason === "dividend");
  if (dividendTxs.length === 0) return [];
  const TAX_KEYWORDS = /מס הכנסה|ניכוי מס|מס דיבידנד|רשות המסים|tax|dividend tax/i;
  const candidates: Transaction[] = [];
  const MS_45_DAYS = 45 * 24 * 60 * 60 * 1000;
  for (const divTx of dividendTxs) {
    const divDate = new Date(divTx.date).getTime();
    const divAmt = Math.abs(divTx.amount);
    for (const tx of txs) {
      if (tx.isExcluded) continue;
      if (tx.amount >= 0) continue;
      if (!TAX_KEYWORDS.test(tx.description)) continue;
      const txDate = new Date(tx.date).getTime();
      if (Math.abs(txDate - divDate) > MS_45_DAYS) continue;
      const ratio = Math.abs(tx.amount) / divAmt;
      if (ratio >= 0.08 && ratio <= 0.45) {
        candidates.push(tx);
      }
    }
  }
  // deduplicate by id
  return [...new Map(candidates.map((t) => [t.id, t])).values()];
}

// ── Deposit (פיקדון) candidate detection ────────────────────────────────────
function findDepositCandidates(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => !t.isExcluded && /פיקדון/i.test(t.description));
}

// ── Jaccard word similarity ─────────────────────────────────────────────────
function jaccardWords(a: string, b: string): number {
  const wA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  const wB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  if (!wA.size || !wB.size) return 0;
  const inter = new Set([...wA].filter((x) => wB.has(x)));
  const union = new Set([...wA, ...wB]);
  return inter.size / union.size;
}

export default function UploadPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const { lang, setSelectedBusinessId, importTransactions, businesses, refreshData } = useApp();
  const tr = t[lang];
  const router = useRouter();

  // ── Existing state ──────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [columns, setColumns] = useState<ParsedColumn | null>(null);
  const [newTransactions, setNewTransactions] = useState<Transaction[]>([]);
  const [success, setSuccess] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dupInfo, setDupInfo] = useState<{ duplicates: number; unique: number; uniqueTxs: Transaction[] } | null>(null);
  const [aiCategorizationFailed, setAiCategorizationFailed] = useState(false);

  // Ambiguity confirmation state
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [ambiguityChoice, setAmbiguityChoice] = useState<AmbiguityChoice>("negative_expense");
  const [overrideDateCol, setOverrideDateCol] = useState<number>(-1);
  const [overrideDescCol, setOverrideDescCol] = useState<number>(-1);
  const [overrideAmountCol, setOverrideAmountCol] = useState<number>(-1);
  const [expenseCol, setExpenseCol] = useState<number>(-1);

  // Editable column mapping on the normal preview
  const [editingCols, setEditingCols] = useState(false);
  const [pendingDateCol, setPendingDateCol] = useState<number>(-1);
  const [pendingDescCol, setPendingDescCol] = useState<number>(-1);
  const [pendingAmountCol, setPendingAmountCol] = useState<number>(-1);

  // ── New wizard state ────────────────────────────────────────────────────────
  const [stage, setStage] = useState<UploadStage>("idle");
  const [cleaningStatus, setCleaningStatus] = useState<"cleaning_names" | "categorizing" | "done">("cleaning_names");

  // Merge step
  const [similarPairs, setSimilarPairs] = useState<Array<{ nameA: string; nameB: string; score: number }>>([]);
  const [currentPairIdx, setCurrentPairIdx] = useState(0);
  const [canonicalInput, setCanonicalInput] = useState("");

  // First Look
  const [firstLookLoading, setFirstLookLoading] = useState(false);
  const [firstLookResult, setFirstLookResult] = useState<FirstLookAnalysis | null>(null);
  const [firstLookError, setFirstLookError] = useState(false);

  // AI progress bar
  const [aiProgress, setAiProgress] = useState(0);

  // Name cleaning review
  const [cleanReviews, setCleanReviews] = useState<Array<{ original: string; cleaned: string }>>([]);
  const [cleanEdits, setCleanEdits] = useState<Record<string, string>>({});
  const [preCatTxs, setPreCatTxs] = useState<Transaction[]>([]);

  // Owner detection + dividend tax + deposit
  const [ownerDetectedCount, setOwnerDetectedCount] = useState(0);
  const [dividendTaxCandidates, setDividendTaxCandidates] = useState<Transaction[]>([]);
  const [currentDivTaxIdx, setCurrentDivTaxIdx] = useState(0);
  const [depositCandidates, setDepositCandidates] = useState<Transaction[]>([]);
  const [currentDepositIdx, setCurrentDepositIdx] = useState(0);

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId, setSelectedBusinessId]);

  useEffect(() => {
    const aiStages: UploadStage[] = ["cleaning"];
    const isProcessing = aiStages.includes(stage) || (stage === "reviewing" && firstLookLoading) || stage === "importing";
    if (!isProcessing) {
      setAiProgress(0);
      return;
    }
    setAiProgress(3);
    let current = 3;
    const id = setInterval(() => {
      if (current < 30) current += 4;
      else if (current < 60) current += 2;
      else if (current < 88) current += 0.8;
      else clearInterval(id);
      setAiProgress(Math.min(Math.round(current), 88));
    }, 500);
    return () => clearInterval(id);
  }, [stage, firstLookLoading]);

  const biz = businesses.find((b) => b.id === businessId);
  const existingTxs = getTransactions(businessId);
  const existingIncome = existingTxs.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
  const existingExpenses = existingTxs.filter((tx) => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const dates = existingTxs.map((tx) => tx.date).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  // ── Similarity check ────────────────────────────────────────────────────────
  const runSimilarityCheck = useCallback((txs: Transaction[]) => {
    const uniqueNames = [...new Set(txs.map((t) => t.description))].slice(0, 120);
    const pairs: Array<{ nameA: string; nameB: string; score: number }> = [];
    for (let i = 0; i < uniqueNames.length; i++) {
      for (let j = i + 1; j < uniqueNames.length; j++) {
        const score = jaccardWords(uniqueNames[i], uniqueNames[j]);
        if (score >= 0.5) pairs.push({ nameA: uniqueNames[i], nameB: uniqueNames[j], score });
      }
    }
    const top = pairs.sort((a, b) => b.score - a.score).slice(0, 12);
    setSimilarPairs(top);
    setCurrentPairIdx(0);
    setCanonicalInput(top[0]?.nameA ?? "");
    setStage("merging");
  }, []);

  // ── Step 2 of pipeline: categorize + owner detection + dividend tax ──────────
  const continueAfterNaming = useCallback(async (txs: Transaction[]) => {
    setStage("cleaning");
    setCleaningStatus("categorizing");

    const uniqueExpDescs = [...new Set(txs.filter((t) => t.amount < 0).map((t) => `- ${t.description}`))].slice(0, 50);
    const uniqueIncDescs = [...new Set(txs.filter((t) => t.amount > 0).map((t) => `+ ${t.description}`))].slice(0, 20);
    const allDescs = [...uniqueExpDescs, ...uniqueIncDescs];
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorizeMode: true, descriptions: allDescs, lang }),
      });
      const data = await res.json();
      const rawMap: Record<string, string> = data.categories || {};
      const catMap: Record<string, string> = {};
      Object.entries(rawMap).forEach(([k, v]) => {
        catMap[k.replace(/^[+\-]\s*/, "")] = String(v);
      });
      const defaultExpCat = lang === "he" ? "אחר" : "Other";
      const defaultIncCat = lang === "he" ? "הכנסה אחרת" : "Other Income";
      txs = txs.map((tx) => ({
        ...tx,
        category: catMap[tx.description] ?? (tx.amount < 0 ? defaultExpCat : defaultIncCat),
      }));
    } catch {
      setAiCategorizationFailed(true);
    }

    const biz = businesses.find((b) => b.id === businessId);
    if (biz?.ownerNames?.length) {
      const { txs: ownerTxs, count } = detectOwnerTransactions(txs, biz.ownerNames);
      txs = ownerTxs;
      if (count > 0) setOwnerDetectedCount(count);
    }

    const divCandidates = findDividendTaxCandidates(txs);
    const depCandidates = findDepositCandidates(txs);
    setNewTransactions(txs);
    setCleaningStatus("done");
    setAiProgress(100);

    if (divCandidates.length > 0) {
      setDividendTaxCandidates(divCandidates);
      setCurrentDivTaxIdx(0);
      setDepositCandidates(depCandidates);
      setCurrentDepositIdx(0);
      setStage("reviewing");
    } else if (depCandidates.length > 0) {
      setDepositCandidates(depCandidates);
      setCurrentDepositIdx(0);
      setStage("reviewing");
    } else {
      runSimilarityCheck(txs);
    }
  }, [lang, runSimilarityCheck, businesses, businessId]);

  // ── Clean + categorize pipeline ─────────────────────────────────────────────
  const runCleanAndCategorize = useCallback(async (rawTxs: Transaction[]) => {
    setStage("cleaning");
    setCleaningStatus("cleaning_names");

    // Step 1: Rule-based cleaning
    let txs = rawTxs.map((tx) => ({ ...tx, description: cleanDescription(tx.description) }));

    // Step 2: AI name cleaning (batch unique descriptions)
    const uniqueDescs = [...new Set(txs.map((t) => t.description))].slice(0, 80);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanMode: true, descriptions: uniqueDescs, lang }),
      });
      const data = await res.json();
      const cleanMap: Record<string, string> = data.cleaned || {};
      txs = txs.map((tx) => ({ ...tx, description: cleanMap[tx.description] ?? tx.description }));
    } catch {
      // keep rule-based cleaned names
    }

    // Collect changed descriptions for user review
    const seen = new Set<string>();
    const reviews: Array<{ original: string; cleaned: string }> = [];
    rawTxs.forEach((rawTx, i) => {
      const orig = rawTx.description;
      const final = txs[i].description;
      if (orig !== final && !seen.has(orig)) {
        seen.add(orig);
        reviews.push({ original: orig, cleaned: final });
      }
    });

    setPreCatTxs(txs);
    setCleanReviews(reviews);
    setCleanEdits(Object.fromEntries(reviews.map((r) => [r.original, r.cleaned])));
    setCleaningStatus("done");

    if (reviews.length > 0) {
      setStage("naming");
    } else {
      await continueAfterNaming(txs);
    }
  }, [lang, continueAfterNaming]);

  // ── Legacy categorizeTxs (kept for handleReparse / handleRetryCategorize) ──
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
      setAiCategorizationFailed(true);
      return txs;
    } finally {
      setCategorizing(false);
    }
  }, [lang]);

  // ── Merge handlers ──────────────────────────────────────────────────────────
  const advanceMergePair = useCallback(() => {
    const nextIdx = currentPairIdx + 1;
    if (nextIdx >= similarPairs.length) {
      setStage("reviewing");
    } else {
      setCurrentPairIdx(nextIdx);
      setCanonicalInput(similarPairs[nextIdx]?.nameA ?? "");
    }
  }, [currentPairIdx, similarPairs]);

  const handleMergeConfirm = useCallback(() => {
    const pair = similarPairs[currentPairIdx];
    if (!pair) return;
    const canonical = canonicalInput.trim() || pair.nameA;
    // Save merge rule
    saveMergeRule(businessId, {
      id: generateId(),
      canonicalName: canonical,
      aliases: [pair.nameB],
      createdAt: new Date().toISOString(),
    });
    // Apply to current transactions
    setNewTransactions((prev) =>
      prev.map((tx) => tx.description === pair.nameB ? { ...tx, description: canonical } : tx)
    );
    advanceMergePair();
  }, [similarPairs, currentPairIdx, canonicalInput, businessId, advanceMergePair]);

  const handleMergeSkip = useCallback(() => {
    advanceMergePair();
  }, [advanceMergePair]);

  // ── Naming review confirm ────────────────────────────────────────────────────
  const handleNamingConfirm = useCallback(async () => {
    // Map AI-cleaned description → user-approved final name
    const aiToUser: Record<string, string> = {};
    cleanReviews.forEach(({ original, cleaned }) => {
      aiToUser[cleaned] = cleanEdits[original] ?? cleaned;
    });
    const txs = preCatTxs.map((tx) => ({
      ...tx,
      description: aiToUser[tx.description] ?? tx.description,
    }));
    await continueAfterNaming(txs);
  }, [cleanReviews, cleanEdits, preCatTxs, continueAfterNaming]);

  // ── Dividend tax dialog handlers ─────────────────────────────────────────
  const advanceDivTax = (currentCandidates: Transaction[], currentIdx: number) => {
    const next = currentIdx + 1;
    if (next < currentCandidates.length) {
      setCurrentDivTaxIdx(next);
    } else {
      setDividendTaxCandidates([]);
      setCurrentDivTaxIdx(0);
      if (depositCandidates.length === 0) {
        setNewTransactions((prev) => {
          runSimilarityCheck(prev);
          return prev;
        });
      }
      // else: deposit dialog will show next (depositCandidates already set)
    }
  };

  const handleDivTaxConfirm = () => {
    const candidate = dividendTaxCandidates[currentDivTaxIdx];
    setNewTransactions((prev) =>
      prev.map((t) =>
        t.id === candidate.id
          ? { ...t, isExcluded: true, excludeReason: "dividend_tax" as const }
          : t
      )
    );
    advanceDivTax(dividendTaxCandidates, currentDivTaxIdx);
  };

  const handleDivTaxSkip = () => {
    advanceDivTax(dividendTaxCandidates, currentDivTaxIdx);
  };

  // ── Deposit (פיקדון) dialog handlers ─────────────────────────────────────
  const advanceDeposit = (currentCandidates: Transaction[], currentIdx: number) => {
    const next = currentIdx + 1;
    if (next < currentCandidates.length) {
      setCurrentDepositIdx(next);
    } else {
      setDepositCandidates([]);
      setCurrentDepositIdx(0);
      setNewTransactions((prev) => {
        runSimilarityCheck(prev);
        return prev;
      });
    }
  };

  const handleDepositExclude = () => {
    const candidate = depositCandidates[currentDepositIdx];
    setNewTransactions((prev) =>
      prev.map((t) =>
        t.id === candidate.id
          ? { ...t, isExcluded: true, excludeReason: "deposit" }
          : t
      )
    );
    advanceDeposit(depositCandidates, currentDepositIdx);
  };

  const handleDepositKeep = () => {
    advanceDeposit(depositCandidates, currentDepositIdx);
  };

  // ── File handling ───────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParsing(true);
    setStage("parsing");
    try {
      const { columns, transactions } = await parseFile(f, businessId);
      setColumns(columns);
      setParsing(false);

      if (columns.isAmbiguous) {
        // Pause — ask the user to confirm column mapping / sign convention
        setOverrideDateCol(columns.dateCol);
        setOverrideDescCol(columns.descCol);
        setOverrideAmountCol(columns.amountCol);
        setExpenseCol(-1);
        setAmbiguityChoice("negative_expense");
        setAwaitingConfirmation(true);
        setStage("confirming");
        // Store raw unprocessed transactions for display only (may be wrong signs)
        setNewTransactions(transactions);
      } else {
        await runCleanAndCategorize(transactions);
      }
    } catch (err) {
      alert(lang === "he" ? "שגיאה בקריאת הקובץ" : "Error reading file");
      console.error(err);
      setParsing(false);
      setStage("idle");
    }
  }, [businessId, lang, runCleanAndCategorize]);

  // Sync pending cols whenever auto-detected columns arrive
  useEffect(() => {
    if (columns) {
      setPendingDateCol(columns.dateCol);
      setPendingDescCol(columns.descCol);
      setPendingAmountCol(columns.amountCol);
      setEditingCols(false);
    }
  }, [columns]);

  const handleReparse = useCallback(async () => {
    if (!file) return;
    setEditingCols(false);
    setParsing(true);
    setAiCategorizationFailed(false);
    try {
      const overrides: ParseOverrides = {
        dateCol: pendingDateCol >= 0 ? pendingDateCol : undefined,
        descCol: pendingDescCol >= 0 ? pendingDescCol : undefined,
        amountCol: pendingAmountCol >= 0 ? pendingAmountCol : undefined,
      };
      const { columns: newCols, transactions } = await parseFile(file, businessId, overrides);
      setColumns(newCols);
      setParsing(false);
      await runCleanAndCategorize(transactions);
    } catch (err) {
      alert(lang === "he" ? "שגיאה בקריאת הקובץ" : "Error reading file");
      console.error(err);
      setParsing(false);
    }
  }, [file, businessId, lang, runCleanAndCategorize, pendingDateCol, pendingDescCol, pendingAmountCol]);

  const handleRetryCategorize = useCallback(async () => {
    if (newTransactions.length === 0) return;
    setAiCategorizationFailed(false);
    const categorized = await categorizeTxs(newTransactions);
    setNewTransactions(categorized);
  }, [newTransactions, categorizeTxs]);

  const handleConfirmAmbiguity = useCallback(async () => {
    if (!file) return;
    setAwaitingConfirmation(false);
    setParsing(true);
    setStage("parsing");

    const overrides: ParseOverrides = {
      dateCol: overrideDateCol >= 0 ? overrideDateCol : undefined,
      descCol: overrideDescCol >= 0 ? overrideDescCol : undefined,
      amountCol: overrideAmountCol >= 0 ? overrideAmountCol : undefined,
    };

    if (ambiguityChoice === "separate_column" && expenseCol >= 0) {
      overrides.expenseCol = expenseCol;
    }
    // "all_income" → no extra overrides; all amounts will stay positive (income)
    // "negative_expense" → normal parsing; minus sign already handled

    try {
      const { columns: newCols, transactions } = await parseFile(file, businessId, overrides);
      setColumns(newCols);
      setParsing(false);
      await runCleanAndCategorize(transactions);
    } catch (err) {
      alert(lang === "he" ? "שגיאה בקריאת הקובץ" : "Error reading file");
      console.error(err);
      setParsing(false);
      setStage("idle");
    }
  }, [file, businessId, lang, runCleanAndCategorize, overrideDateCol, overrideDescCol, overrideAmountCol, ambiguityChoice, expenseCol]);

  const handleDupDecision = useCallback(async (choice: "skip" | "all" | "cancel") => {
    if (choice === "cancel" || !dupInfo) {
      resetUpload();
      setDupInfo(null);
      return;
    }
    setDupInfo(null);
    const txsToProcess = choice === "skip" ? dupInfo.uniqueTxs : newTransactions;
    if (txsToProcess.length === 0) {
      resetUpload();
      return;
    }
    await runCleanAndCategorize(txsToProcess);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dupInfo, newTransactions, runCleanAndCategorize]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── First Look fetch helper ─────────────────────────────────────────────────
  const fetchFirstLook = useCallback(async () => {
    setFirstLookError(false);
    setFirstLookLoading(true);
    try {
      const allTxs = getTransactions(businessId);
      const context = buildFirstLookContext(biz!, allTxs);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstLookMode: true, context, lang }),
      });
      const data = await res.json();
      if (data.analysis) {
        setFirstLookResult(data.analysis);
        saveFirstLookAnalysis(businessId, data.analysis);
        setAiProgress(100);
      } else {
        setFirstLookError(true);
      }
    } catch {
      setFirstLookError(true);
    } finally {
      setFirstLookLoading(false);
    }
  }, [businessId, biz, lang]);

  // ── Import handler ──────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    // Duplicate check
    const { duplicates, unique } = findDuplicates(businessId, newTransactions);
    if (duplicates.length > 0) {
      setDupInfo({ duplicates: duplicates.length, unique: unique.length, uniqueTxs: unique });
      return;
    }

    importTransactions(newTransactions);
    setStage("success");
    setSuccess(true);
    setFirstLookLoading(true);

    // Check cache
    const cached = getFirstLookAnalysis(businessId);
    if (cached) {
      setFirstLookResult(cached);
      setAiProgress(100);
      setFirstLookLoading(false);
      return;
    }

    await fetchFirstLook();
  }, [businessId, newTransactions, importTransactions, fetchFirstLook]);

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

  const resetUpload = () => {
    setFile(null);
    setColumns(null);
    setAwaitingConfirmation(false);
    setNewTransactions([]);
    setAiCategorizationFailed(false);
    setStage("idle");
    setFirstLookLoading(false);
    setFirstLookResult(null);
    setFirstLookError(false);
    setSimilarPairs([]);
    setCurrentPairIdx(0);
    setCleanReviews([]);
    setCleanEdits({});
    setPreCatTxs([]);
    setDepositCandidates([]);
    setCurrentDepositIdx(0);
  };

  const colLetter = (idx: number) => String.fromCharCode(65 + idx);
  const catOptions = lang === "he" ? CATEGORY_OPTIONS_HE : CATEGORY_OPTIONS_EN;

  // ── Wizard step definitions ────────────────────────────────────────────────
  const WIZARD_STEPS = [
    "uploadStep_upload", "uploadStep_verify", "uploadStep_categorize",
    "uploadStep_merge", "uploadStep_review",
  ] as const;

  const stageToStep: Record<UploadStage, number> = {
    idle: 0, parsing: 0, confirming: 1, cleaning: 2, naming: 2, merging: 3, reviewing: 4, importing: 4, success: 4,
  };

  // ── Success screen — show FirstLookReport ──────────────────────────────────
  if (stage === "success" || success) {
    return (
      <AppShell>
        <FirstLookReport
          analysis={firstLookResult}
          loading={firstLookLoading}
          error={firstLookError}
          transactionCount={newTransactions.length}
          businessId={businessId}
          lang={lang}
          onRetry={fetchFirstLook}
        />
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
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium"
        >
          {tr.howToExportGuide}
          <ChevronDown className={`w-4 h-4 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
        </button>
        {guideOpen && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 space-y-1.5">
            {[tr.bankHapoalim, tr.bankLeumi, tr.bankDiscount, tr.googleSheets].map((line, i) => (
              <p key={i} className="text-sm text-blue-700">• {line}</p>
            ))}
          </div>
        )}

        {/* Wizard progress bar */}
        {stage !== "idle" && (
          <div className="flex items-center gap-1 mb-6">
            {WIZARD_STEPS.map((stepKey, i) => {
              const current = stageToStep[stage];
              return (
                <React.Fragment key={i}>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    i < current ? "bg-green-100 text-green-700" :
                    i === current ? "bg-blue-600 text-white" :
                    "bg-gray-100 text-gray-400"
                  }`}>
                    {i < current && <CheckCircle className="w-3 h-3" />}
                    {(tr as Record<string, string>)[stepKey]}
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full ${i < current ? "bg-green-300" : "bg-gray-200"}`} />
                  )}
                </React.Fragment>
              );
            })}
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

        {/* ── Main content area ── */}
        {stage === "cleaning" ? (
          <div className="text-center py-16">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-700 font-medium">
              {cleaningStatus === "cleaning_names"
                ? (lang === "he" ? "מנקה שמות..." : "Cleaning names...")
                : (lang === "he" ? "מסווג הכנסות והוצאות..." : "Categorizing transactions...")}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {lang === "he" ? "זה עשוי לקחת כ-15 שניות" : "This may take ~15 seconds"}
            </p>
            {aiProgress > 0 && (
              <div className="w-full max-w-xs mx-auto mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{lang === "he" ? "מעבד..." : "Processing..."}</span>
                  <span>{aiProgress}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${aiProgress}%` }}
                  />
                </div>
              </div>
            )}
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

        ) : awaitingConfirmation && columns ? (
          /* ── Ambiguity confirmation panel ── */
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <HelpCircle className="w-7 h-7 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800">
                  {lang === "he"
                    ? "נדרש אישורך לפני שנייבא את הנתונים"
                    : "We need your input before importing"}
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  {columns.ambiguityReason === "all_positive"
                    ? (lang === "he"
                        ? "כל הסכומים בקובץ חיוביים — לא ניתן להבחין אוטומטית בין הכנסות להוצאות."
                        : "All amounts in your file are positive — we can't automatically tell income from expenses.")
                    : (lang === "he"
                        ? "לא הצלחנו לזהות אוטומטית את מבנה העמודות. אנא אשר את המיפוי."
                        : "We couldn't auto-detect your column layout. Please verify the mapping below.")}
                </p>
              </div>
            </div>

            {/* Column mapping */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">
                {lang === "he" ? "מיפוי עמודות" : "Column Mapping"}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: lang === "he" ? "תאריך" : "Date",
                    value: overrideDateCol,
                    onChange: setOverrideDateCol,
                  },
                  {
                    label: lang === "he" ? "תיאור" : "Description",
                    value: overrideDescCol,
                    onChange: setOverrideDescCol,
                  },
                  {
                    label: lang === "he" ? "סכום" : "Amount",
                    value: overrideAmountCol,
                    onChange: setOverrideAmountCol,
                  },
                ].map(({ label, value, onChange }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <select
                      value={value}
                      onChange={(e) => onChange(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
                    >
                      {columns.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {colLetter(i)} — {h || `(${lang === "he" ? "ריק" : "empty"})`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Sign / direction question — only for all_positive case */}
            {columns.ambiguityReason === "all_positive" && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-4">
                  {lang === "he"
                    ? "כיצד מסומנות ההוצאות בקובץ שלך?"
                    : "How are expenses marked in your file?"}
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      value: "negative_expense" as AmbiguityChoice,
                      label: lang === "he"
                        ? "מינוס (−) = הוצאה, חיובי = הכנסה"
                        : "Negative (−) = expense, positive = income",
                    },
                    {
                      value: "separate_column" as AmbiguityChoice,
                      label: lang === "he"
                        ? "יש עמודה נפרדת להוצאות"
                        : "There is a separate column for expenses",
                    },
                    {
                      value: "all_income" as AmbiguityChoice,
                      label: lang === "he"
                        ? "כל השורות הן הכנסה (אין הוצאות בקובץ)"
                        : "All rows are income (no expenses in this file)",
                    },
                  ].map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="ambiguityChoice"
                        value={value}
                        checked={ambiguityChoice === value}
                        onChange={() => setAmbiguityChoice(value)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm text-gray-800">{label}</span>
                    </label>
                  ))}
                </div>

                {/* Expense column picker */}
                {ambiguityChoice === "separate_column" && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-1">
                      {lang === "he" ? "עמודת ההוצאות" : "Expense column"}
                    </p>
                    <select
                      value={expenseCol}
                      onChange={(e) => setExpenseCol(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
                    >
                      <option value={-1}>
                        {lang === "he" ? "— בחר עמודה —" : "— Select column —"}
                      </option>
                      {columns.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {colLetter(i)} — {h || `(${lang === "he" ? "ריק" : "empty"})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetUpload}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 font-medium text-sm"
              >
                {lang === "he" ? "ביטול" : "Cancel"}
              </button>
              <button
                onClick={handleConfirmAmbiguity}
                disabled={ambiguityChoice === "separate_column" && expenseCol < 0}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {lang === "he" ? "אישור והמשך" : "Confirm & Continue"}
              </button>
            </div>
          </div>

        ) : stage === "naming" ? (
          /* ── Naming review stage ── */
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {lang === "he" ? "ניקוי שמות עסקאות" : "Transaction Name Cleaning"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {lang === "he"
                    ? `ה-AI ניקה ${cleanReviews.length} שמות. עיין ועדכן אם נדרש.`
                    : `AI cleaned ${cleanReviews.length} names. Review and edit if needed.`}
                </p>
              </div>
              <button
                onClick={handleNamingConfirm}
                className="shrink-0 text-sm bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium"
              >
                {lang === "he" ? "אשר הכל" : "Approve All"}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                    <tr>
                      <th className="text-start px-4 py-2.5 text-gray-500 font-medium w-5/12">
                        {lang === "he" ? "מקורי" : "Original"}
                      </th>
                      <th className="text-start px-4 py-2.5 text-gray-500 font-medium w-7/12">
                        {lang === "he" ? "לאחר ניקוי (ניתן לעריכה)" : "Cleaned (editable)"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleanReviews.map(({ original }, i) => (
                      <tr key={original} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                        <td className="px-4 py-2.5 text-gray-400 text-xs truncate max-w-0" title={original}>
                          {original}
                        </td>
                        <td className="px-4 py-2 pe-3">
                          <input
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                            value={cleanEdits[original] ?? ""}
                            onChange={(e) =>
                              setCleanEdits((prev) => ({ ...prev, [original]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetUpload}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium"
              >
                {lang === "he" ? "ביטול" : "Cancel"}
              </button>
              <button
                onClick={handleNamingConfirm}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 text-sm"
              >
                {lang === "he" ? "אשר והמשך לסיווג" : "Confirm & Continue"}
              </button>
            </div>
          </div>

        ) : stage === "merging" ? (
          /* ── Merge stage ── */
          <div className="space-y-6">
            {similarPairs.length === 0 || currentPairIdx >= similarPairs.length ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-gray-800">
                  {lang === "he" ? "כל השמות עברו בדיקה" : "All names reviewed"}
                </p>
                <button
                  onClick={() => setStage("reviewing")}
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
                >
                  {lang === "he" ? "המשך לאישור" : "Continue to Review"}
                </button>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-gray-800">
                      {lang === "he" ? "שמות דומים" : "Similar Names"}
                    </h3>
                    <span className="text-xs text-gray-400 ms-auto">
                      {currentPairIdx + 1} / {similarPairs.length}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    {lang === "he" ? "האם אלה אותו גורם?" : "Are these the same entity?"}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                      <p className="font-medium text-blue-800 text-sm">
                        {similarPairs[currentPairIdx].nameA}
                      </p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                      <p className="font-medium text-purple-800 text-sm">
                        {similarPairs[currentPairIdx].nameB}
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">
                      {lang === "he" ? "שם קנוני:" : "Canonical name:"}
                    </p>
                    <input
                      value={canonicalInput}
                      onChange={(e) => setCanonicalInput(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      placeholder={similarPairs[currentPairIdx].nameA}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleMergeSkip}
                      className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50"
                    >
                      {lang === "he" ? "לא, שמור נפרד" : "No, keep separate"}
                    </button>
                    <button
                      onClick={handleMergeConfirm}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700"
                    >
                      {lang === "he" ? "כן, אחד" : "Yes, merge"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setStage("reviewing")}
                  className="w-full text-gray-400 hover:text-gray-600 text-sm py-2"
                >
                  {lang === "he" ? "דלג על כל השמות" : "Skip all"}
                </button>
              </>
            )}
          </div>

        ) : (stage === "reviewing" || stage === "importing") && columns ? (
          /* ── Review / preview stage ── */
          <div className="space-y-6">
            {ownerDetectedCount > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2.5 rounded-xl mb-3">
                <span className="text-lg">👤</span>
                <span>
                  {lang === "he"
                    ? `זוהו ${ownerDetectedCount} פעולות של בעל העסק והוצאו מהתחשיב`
                    : `${ownerDetectedCount} owner transactions detected and excluded`}
                </span>
              </div>
            )}
            {aiCategorizationFailed && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <span className="flex-1">{tr.aiCategorizationFailed}</span>
                <button
                  onClick={handleRetryCategorize}
                  disabled={categorizing}
                  className="shrink-0 flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  {lang === "he" ? "נסה שוב" : "Retry"}
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
              <FileText className="w-6 h-6 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium text-gray-800">{file?.name}</p>
                <p className="text-sm text-gray-500">{newTransactions.length} {lang === "he" ? "עסקאות זוהו" : "transactions found"}</p>
              </div>
              <button onClick={resetUpload} className="text-gray-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-800">{tr.mappingTitle}</h3>
                {!editingCols && (
                  <button
                    onClick={() => setEditingCols(true)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    {lang === "he" ? "ערוך" : "Edit"}
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-sm mb-4">{tr.mappingDesc}</p>

              {editingCols ? (
                /* ── Editable mode ── */
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: tr.dateColumn, value: pendingDateCol, onChange: setPendingDateCol },
                      { label: tr.descColumn, value: pendingDescCol, onChange: setPendingDescCol },
                      { label: tr.amountColumn, value: pendingAmountCol, onChange: setPendingAmountCol },
                    ].map(({ label, value, onChange }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        <select
                          value={value}
                          onChange={(e) => onChange(Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
                        >
                          {columns.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {colLetter(i)} — {h || `(${lang === "he" ? "ריק" : "empty"})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCols(false);
                        setPendingDateCol(columns.dateCol);
                        setPendingDescCol(columns.descCol);
                        setPendingAmountCol(columns.amountCol);
                      }}
                      className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      {lang === "he" ? "ביטול" : "Cancel"}
                    </button>
                    <button
                      onClick={handleReparse}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {lang === "he" ? "עדכן ונתח מחדש" : "Apply & Re-parse"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read-only display ── */
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: tr.dateColumn, col: columns.dateCol },
                    { label: tr.descColumn, col: columns.descCol },
                    { label: tr.amountColumn, col: columns.amountCol },
                  ].map(({ label, col }) => (
                    <div key={label} className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-blue-500 mb-1">{label}</p>
                      <p className="font-bold text-blue-800">
                        {lang === "he" ? `עמודה ${colLetter(col)}` : `Col ${colLetter(col)}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{columns.headers[col]}</p>
                    </div>
                  ))}
                </div>
              )}

              {columns.splitCols && !editingCols && (
                <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {lang === "he"
                    ? `זוהו עמודות זכות/חובה נפרדות (${colLetter(columns.splitCols.creditCol)} / ${colLetter(columns.splitCols.debitCol)})`
                    : `Separate credit/debit columns detected (${colLetter(columns.splitCols.creditCol)} / ${colLetter(columns.splitCols.debitCol)})`}
                </p>
              )}
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
                          <td className="py-2 text-gray-800 max-w-xs truncate">{fullTx.description}</td>
                          <td className={`py-2 text-end font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-2 ps-2">
                            <select
                              value={fullTx.category ?? ""}
                              onChange={(e) => updateCategory(tx.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:border-blue-400"
                            >
                              <option value="">—</option>
                              {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Income / Expense totals summary */}
            {(() => {
              const totalIncome = newTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
              const totalExpenses = newTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
              const net = totalIncome - totalExpenses;
              return (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm">
                    {lang === "he" ? "סיכום לפני ייבוא" : "Summary before import"}
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-green-600 mb-1">{lang === "he" ? "סה״כ הכנסות" : "Total Income"}</p>
                      <p className="font-bold text-green-700 text-sm">{formatCurrency(totalIncome)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {newTransactions.filter((t) => t.amount > 0).length} {lang === "he" ? "עסקאות" : "txns"}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-red-600 mb-1">{lang === "he" ? "סה״כ הוצאות" : "Total Expenses"}</p>
                      <p className="font-bold text-red-700 text-sm">{formatCurrency(totalExpenses)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {newTransactions.filter((t) => t.amount < 0).length} {lang === "he" ? "עסקאות" : "txns"}
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${net >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
                      <p className={`text-xs mb-1 ${net >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                        {lang === "he" ? "נטו" : "Net"}
                      </p>
                      <p className={`font-bold text-sm ${net >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                        {formatCurrency(net)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {newTransactions.length} {lang === "he" ? "סה״כ" : "total"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handleImport}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {tr.confirm}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

        ) : stage === "idle" ? (
          /* ── Upload drop zone ── */
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
        ) : null}
      </div>

      {/* Dividend tax dialog */}
      {dividendTaxCandidates.length > 0 && currentDivTaxIdx < dividendTaxCandidates.length && (
        (() => {
          const cand = dividendTaxCandidates[currentDivTaxIdx];
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🧾</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {lang === "he" ? "האם זה מס דיבידנד?" : "Is this a dividend tax?"}
                  </h3>
                  <p className="text-sm text-gray-500 mb-1">{cand.description}</p>
                  <p className="text-base font-semibold text-red-600 mb-3">
                    ₪{Math.abs(cand.amount).toLocaleString()} — {cand.date}
                  </p>
                  <p className="text-sm text-gray-600">
                    {lang === "he"
                      ? "מצאנו תשלום זה בסמוך להפרשת דיבידנד. מס דיבידנד לא צריך להיכנס לתחשיב הרווח התפעולי."
                      : "We found this payment near a dividend provision. Dividend tax should not be included in operating profit calculations."}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDivTaxSkip}
                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 font-medium"
                  >
                    {lang === "he" ? "לא, השאר" : "No, keep it"}
                  </button>
                  <button
                    onClick={handleDivTaxConfirm}
                    className="flex-1 bg-amber-600 text-white py-3 rounded-xl hover:bg-amber-700 font-medium"
                  >
                    {lang === "he" ? "כן, הוצא מהתחשיב" : "Yes, exclude"}
                  </button>
                </div>
                {dividendTaxCandidates.length > 1 && (
                  <p className="text-xs text-center text-gray-400 mt-3">
                    {currentDivTaxIdx + 1} / {dividendTaxCandidates.length}
                  </p>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* Deposit (פיקדון) dialog */}
      {depositCandidates.length > 0 && currentDepositIdx < depositCandidates.length && dividendTaxCandidates.length === 0 && (
        (() => {
          const cand = depositCandidates[currentDepositIdx];
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🏦</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {lang === "he" ? "פיקדון — לכלול בתחשיב?" : "Deposit — Include in calculation?"}
                  </h3>
                  <p className="text-sm text-gray-500 mb-1">{cand.description}</p>
                  <p className={`text-base font-semibold mb-3 ${cand.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ₪{Math.abs(cand.amount).toLocaleString()} — {cand.date}
                  </p>
                  <p className="text-sm text-gray-600">
                    {lang === "he"
                      ? "זיהינו פיקדון בנקאי. פיקדון בדרך כלל אינו הכנסה תפעולית — האם להוציא עסקה זו מתחשיב הרווח?"
                      : "We detected a bank deposit. Deposits are usually not operational income — exclude this from profit calculations?"}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDepositKeep}
                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 font-medium"
                  >
                    {lang === "he" ? "לא, כלול בתחשיב" : "No, keep it"}
                  </button>
                  <button
                    onClick={handleDepositExclude}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 font-medium"
                  >
                    {lang === "he" ? "כן, הוצא מהתחשיב" : "Yes, exclude"}
                  </button>
                </div>
                {depositCandidates.length > 1 && (
                  <p className="text-xs text-center text-gray-400 mt-3">
                    {currentDepositIdx + 1} / {depositCandidates.length}
                  </p>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* Duplicate detection modal */}
      {dupInfo && !awaitingConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-500 flex-shrink-0" />
              <h2 className="text-xl font-bold text-gray-900">{tr.duplicatesFound}</h2>
            </div>
            <p className="text-gray-600 mb-6">
              {tr.duplicatesDesc
                .replace("{dup}", String(dupInfo.duplicates))
                .replace("{total}", String(dupInfo.duplicates + dupInfo.unique))}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDupDecision("skip")}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
              >
                {tr.skipDuplicates} ({dupInfo.unique} {lang === "he" ? "עסקאות חדשות" : "new transactions"})
              </button>
              <button
                onClick={() => handleDupDecision("all")}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50"
              >
                {tr.importAll}
              </button>
              <button
                onClick={() => handleDupDecision("cancel")}
                className="w-full text-gray-400 hover:text-gray-600 py-2 text-sm"
              >
                {tr.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

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
