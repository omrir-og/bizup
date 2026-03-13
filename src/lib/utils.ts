import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Business, CashFlowPoint, MonthlyStats, SupplierSummary, Transaction } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function groupByMonth(transactions: Transaction[]): MonthlyStats[] {
  const map: Record<string, { income: number; expenses: number }> = {};

  for (const t of transactions) {
    const key = t.date.substring(0, 7); // YYYY-MM
    if (!map[key]) map[key] = { income: 0, expenses: 0 };
    if (t.amount > 0) {
      map[key].income += t.amount;
    } else {
      map[key].expenses += Math.abs(t.amount);
    }
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { income, expenses }]) => ({
      month,
      income,
      expenses,
      netProfit: income - expenses,
    }));
}

export function calcAverage(stats: MonthlyStats[], months: number): number {
  const slice = stats.slice(-months);
  if (slice.length === 0) return 0;
  return slice.reduce((s, m) => s + m.netProfit, 0) / slice.length;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function parseDate(raw: string): string {
  if (!raw?.trim()) return raw;

  // Already ISO YYYY-MM-DD (optionally with time component)
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const parts = raw.split(/[./\-\s]/);
  if (parts.length >= 3) {
    const [a, b, c] = parts;
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    const cNum = parseInt(c, 10);

    // 4-digit year in position a → YYYY/MM/DD
    if (a.length === 4) {
      return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
    }

    // 4-digit year in position c → DD/MM/YYYY or MM/DD/YYYY
    if (c.length === 4) {
      // a > 12 → a is unambiguously the day (Israeli DD/MM/YYYY)
      if (aNum > 12) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
      // b > 12 → b is unambiguously the day (American MM/DD/YYYY)
      if (bNum > 12) return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
      // Both ≤ 12 → ambiguous; assume Israeli DD/MM (day first)
      return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    }

    // 2-digit year in position c → DD/MM/YY or MM/DD/YY
    if (c.length === 2 && !isNaN(cNum)) {
      const year = cNum <= 30 ? `20${c.padStart(2, "0")}` : `19${c.padStart(2, "0")}`;
      // a > 12 → a is unambiguously the day
      if (aNum > 12) return `${year}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
      // b > 12 → b is unambiguously the day (American MM/DD/YY)
      if (bNum > 12) return `${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
      // Both ≤ 12 → assume Israeli DD/MM
      return `${year}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    }
  }

  return raw;
}

export function parseAmount(raw: string): number {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "-") return 0;
  // Handle parentheses notation: (1,000) → -1000
  const isNegativeParens = trimmed.startsWith("(") && trimmed.endsWith(")");
  const cleaned = trimmed.replace(/[₪,\s()]/g, "");
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return isNegativeParens ? -Math.abs(value) : value;
}

/** Group expense transactions by category, returning total absolute amount per category */
export function groupByCategory(transactions: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount < 0 && t.category) {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    }
  }
  return map;
}

/** Normalize a transaction description for supplier matching.
 *  Strips dates, reference numbers, and trailing digits. */
function normalizeSupplierName(description: string): string {
  return description
    .replace(/\d{2}[./\-]\d{2}[./\-]\d{2,4}/g, "") // dates
    .replace(/\b\d{4,}\b/g, "") // long number sequences (ref codes)
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 40);
}

/** Extract supplier summaries from expense transactions */
export function extractSuppliers(transactions: Transaction[]): SupplierSummary[] {
  const map: Record<string, { total: number; count: number; months: Set<string>; lastSeen: string }> = {};

  for (const t of transactions) {
    if (t.amount >= 0) continue; // income, skip
    const key = normalizeSupplierName(t.description);
    if (!key) continue;
    if (!map[key]) map[key] = { total: 0, count: 0, months: new Set(), lastSeen: t.date };
    map[key].total += Math.abs(t.amount);
    map[key].count += 1;
    map[key].months.add(t.date.substring(0, 7));
    if (t.date > map[key].lastSeen) map[key].lastSeen = t.date;
  }

  return Object.entries(map)
    .map(([name, { total, count, months, lastSeen }]) => ({
      name,
      totalPaid: total,
      transactionCount: count,
      avgAmount: total / count,
      lastSeen,
      isRecurring: months.size >= 2,
      months: Array.from(months).sort(),
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid);
}

/** Extract client summaries from income transactions */
export function extractClients(transactions: Transaction[]): SupplierSummary[] {
  const map: Record<string, { total: number; count: number; months: Set<string>; lastSeen: string }> = {};

  for (const t of transactions) {
    if (t.amount <= 0) continue; // expenses, skip
    const key = normalizeSupplierName(t.description);
    if (!key) continue;
    if (!map[key]) map[key] = { total: 0, count: 0, months: new Set(), lastSeen: t.date };
    map[key].total += t.amount;
    map[key].count += 1;
    map[key].months.add(t.date.substring(0, 7));
    if (t.date > map[key].lastSeen) map[key].lastSeen = t.date;
  }

  return Object.entries(map)
    .map(([name, { total, count, months, lastSeen }]) => ({
      name,
      totalPaid: total,
      transactionCount: count,
      avgAmount: total / count,
      lastSeen,
      isRecurring: months.size >= 2,
      months: Array.from(months).sort(),
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid);
}

/** Detect recurring transactions: mark isRecurring=true if same normalized
 *  description appears in 2+ distinct months */
export function detectRecurring(transactions: Transaction[]): Transaction[] {
  const monthsByDesc: Record<string, Set<string>> = {};
  for (const t of transactions) {
    const key = normalizeSupplierName(t.description);
    if (!monthsByDesc[key]) monthsByDesc[key] = new Set();
    monthsByDesc[key].add(t.date.substring(0, 7));
  }
  return transactions.map((t) => {
    const key = normalizeSupplierName(t.description);
    return { ...t, isRecurring: (monthsByDesc[key]?.size ?? 0) >= 2 };
  });
}

/** Project monthly cash flow balance for the next N months.
 *  Uses: recurring expenses (fixed), avg variable expenses, avg income. */
export function projectCashFlow(
  transactions: Transaction[],
  currentBalance: number,
  months = 3,
  fixedMonthlyCosts = 0   // NEW parameter
): CashFlowPoint[] {
  const stats = groupByMonth(transactions);
  if (stats.length === 0) return [];

  // Build actual history points (cumulative balance from first transaction)
  // We treat currentBalance as the balance at end of last known month
  const points: CashFlowPoint[] = stats.map((s, i) => {
    // Approximate cumulative: use currentBalance as anchor at last month
    const monthsFromEnd = stats.length - 1 - i;
    const approxBalance = currentBalance + monthsFromEnd * (s.income - s.expenses);
    return { month: s.month, balance: approxBalance, isProjected: false };
  });
  // Correct last point to be currentBalance
  if (points.length > 0) {
    points[points.length - 1].balance = currentBalance;
  }

  // Calculate averages for projection
  const recentStats = stats.slice(-6);
  const avgIncome = recentStats.reduce((s, m) => s + m.income, 0) / recentStats.length;
  const avgExpenses = recentStats.reduce((s, m) => s + m.expenses, 0) / recentStats.length;
  const effectiveExpenses = fixedMonthlyCosts > 0
    ? Math.max(avgExpenses, fixedMonthlyCosts)
    : avgExpenses;
  const avgNet = avgIncome - effectiveExpenses;

  // Generate future months
  const lastMonth = stats[stats.length - 1]?.month ?? new Date().toISOString().substring(0, 7);
  let balance = currentBalance;

  for (let i = 1; i <= months; i++) {
    const [year, month] = lastMonth.split("-").map(Number);
    const futureDate = new Date(year, month - 1 + i, 1);
    const futureMonth = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;
    balance += avgNet;
    points.push({ month: futureMonth, balance, isProjected: true });
  }

  return points;
}

/** Build a list of recurring income and expense items for next-month prediction */
export function getRecurringItems(transactions: Transaction[]): import("@/types").RecurringItem[] {
  const monthsByKey: Record<string, { amounts: number[]; dates: string[]; months: Set<string>; description: string; type: "income" | "expense" }> = {};

  for (const t of transactions) {
    const key = normalizeSupplierName(t.description);
    if (!key) continue;
    if (!monthsByKey[key]) {
      monthsByKey[key] = {
        amounts: [],
        dates: [],
        months: new Set(),
        description: key,
        type: t.amount > 0 ? "income" : "expense",
      };
    }
    monthsByKey[key].amounts.push(Math.abs(t.amount));
    monthsByKey[key].dates.push(t.date);
    monthsByKey[key].months.add(t.date.substring(0, 7));
  }

  const items: import("@/types").RecurringItem[] = [];

  for (const [key, data] of Object.entries(monthsByKey)) {
    if (data.months.size < 2) continue; // must appear in 2+ distinct months
    const avgAmount = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
    const sortedMonths = Array.from(data.months).sort();
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    // Project next occurrence: 1 month after last seen
    const [y, m] = lastMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1); // m is already 0-based + 1 = next month
    const nextExpected = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    const lastSeen = data.dates.sort().reverse()[0];

    items.push({
      key,
      description: key,
      type: data.type,
      avgAmount,
      monthlyOccurrences: data.months.size,
      lastSeen,
      months: sortedMonths,
      nextExpected,
    });
  }

  return items.sort((a, b) => b.avgAmount - a.avgAmount);
}

// ── Description cleaner — strips Israeli bank noise ──────────────────────
const BANK_NOISE_PATTERNS: RegExp[] = [
  /\bבסניף\s+[\d\-]+\b/g,
  /\bסניף\s+[\d\-]+\b/g,
  /\bחשבון\s+[\d\-]+\b/g,
  /\bבנק\s+\d+\s+ל\b/g,
  /\bא\s+חשבון\b/g,
  /^הע\.\s*/,
  /^העברה\s+(מ|ל|מ-|ל-)\s*/,
  /^חיוב\s+/,
  /^זיכוי\s+/,
  /\s+\d{2}-\d{3}-\d{4}-\d{9,}/g,
  /\s*\(\d+\)\s*/g,
];

export function cleanDescription(raw: string): string {
  let s = raw.trim();
  for (const pattern of BANK_NOISE_PATTERNS) {
    s = s.replace(pattern, " ");
  }
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || raw.trim();
}

// ── Rich context builder for First Look AI analysis ───────────────────────
export function buildFirstLookContext(biz: Business, transactions: Transaction[]): string {
  if (transactions.length === 0) return "No transactions available.";

  const monthly = groupByMonth(transactions);
  const catBreakdown = groupByCategory(transactions);
  const totalExpensesAmt = Object.values(catBreakdown).reduce((s, v) => s + v, 0);
  const suppliers = extractSuppliers(transactions).slice(0, 10);
  const clients = extractClients(transactions).slice(0, 8);
  const recurring = getRecurringItems(transactions);

  const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalNet = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? ((totalNet / totalIncome) * 100).toFixed(1) : "0";
  const dates = transactions.map(t => t.date).sort();
  const dateRange = `${dates[0]} to ${dates[dates.length - 1]}`;

  const opexNoiseWords = /עמלה|ריבית|מס|fee|interest|tax|bank|בנק|עמלות/i;
  const recurringIncome = recurring.filter(r => r.type === "income");
  const recurringOpex = recurring.filter(r => r.type === "expense" && !opexNoiseWords.test(r.description));
  const avgRecurringIncome = recurringIncome.reduce((s, r) => s + r.avgAmount, 0);
  const avgRecurringOpex = recurringOpex.reduce((s, r) => s + r.avgAmount, 0);
  const operatingProfit = avgRecurringIncome - avgRecurringOpex;

  const lines: string[] = [];

  lines.push(`BUSINESS PROFILE:`);
  lines.push(`Name: ${biz.name}, Industry: ${biz.industry}, Revenue Model: ${biz.revenueModel || "not set"}`);
  lines.push(`Employees: ${biz.employees}, Fixed Monthly Costs: ₪${biz.fixedMonthlyCosts}, Profit Goal: ₪${biz.targetMonthlyProfit}`);

  lines.push(`\nFULL PERIOD SUMMARY:`);
  lines.push(`Total income: ₪${totalIncome.toFixed(0)}, Total expenses: ₪${totalExpenses.toFixed(0)}, Net: ₪${totalNet.toFixed(0)}, Margin: ${margin}%`);
  lines.push(`Date range: ${dateRange} (${monthly.length} months of data)`);

  lines.push(`\nMONTHLY BREAKDOWN:`);
  monthly.forEach(m => {
    lines.push(`${m.month}: income ₪${m.income.toFixed(0)}, expenses ₪${m.expenses.toFixed(0)}, profit ₪${m.netProfit.toFixed(0)}`);
  });

  lines.push(`\nEXPENSE CATEGORIES:`);
  Object.entries(catBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt]) => {
      const pct = totalExpensesAmt > 0 ? ((amt / totalExpensesAmt) * 100).toFixed(1) : "0";
      lines.push(`${cat}: ₪${amt.toFixed(0)} (${pct}% of total expenses)`);
    });

  if (recurringIncome.length > 0) {
    lines.push(`\nRECURRING INCOME ITEMS:`);
    recurringIncome.forEach(r => lines.push(`${r.description}: avg ₪${r.avgAmount.toFixed(0)}/month, seen in ${r.months.length} months`));
  }

  if (recurringOpex.length > 0) {
    lines.push(`\nRECURRING EXPENSE ITEMS:`);
    recurringOpex.forEach(r => lines.push(`${r.description}: avg ₪${r.avgAmount.toFixed(0)}/month, seen in ${r.months.length} months`));
  }

  if (suppliers.length > 0) {
    lines.push(`\nTOP SUPPLIERS:`);
    suppliers.forEach(s => lines.push(`${s.name}: total ₪${s.totalPaid.toFixed(0)}, ${s.isRecurring ? "recurring" : "one-time"}, ${s.transactionCount} transactions`));
  }

  if (clients.length > 0) {
    lines.push(`\nTOP CLIENTS:`);
    clients.forEach(c => lines.push(`${c.name}: total ₪${c.totalPaid.toFixed(0)}, ${c.isRecurring ? "recurring" : "one-time"}`));
  }

  lines.push(`\nOPERATING PROFIT (pre-calculated):`);
  lines.push(`Avg recurring income: ₪${avgRecurringIncome.toFixed(0)}/month`);
  lines.push(`Avg recurring operating expenses (excl. banking/taxes): ₪${avgRecurringOpex.toFixed(0)}/month`);
  lines.push(`Estimated operating profit: ₪${operatingProfit.toFixed(0)}/month`);

  return lines.join("\n");
}
