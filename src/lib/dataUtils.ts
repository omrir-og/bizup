import { Language, TimeRange, Transaction } from "@/types";
import { filterByTimeRange } from "@/components/tabs/tabUtils";

// ── Color palettes ──────────────────────────────────────────────────────
export const EXPENSE_COLORS = ["#3B82F6","#60A5FA","#93C5FD","#BFDBFE","#2563EB","#1D4ED8","#1E40AF","#1E3A8A"];
export const INCOME_COLORS  = ["#10B981","#34D399","#6EE7B7","#A7F3D0","#059669","#047857","#065F46","#064E3B"];

// ── Profit-type mapping ─────────────────────────────────────────────────
export const PROFIT_TYPE_MAP: Record<string, "gross" | "operating" | "net"> = {
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

export function getProfitTypeLabel(categoryName: string, lang: Language): string {
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

export function getProfitTypeBadgeClass(categoryName: string): string {
  const type = PROFIT_TYPE_MAP[categoryName.trim().toLowerCase()];
  if (type === "gross") return "bg-green-100 text-green-700";
  if (type === "operating") return "bg-blue-100 text-blue-700";
  if (type === "net") return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-500";
}

// ── Category groups ─────────────────────────────────────────────────────
export interface CategoryGroup {
  key: string;
  name: string;
  total: number;
  count: number;
}

export function buildCategoryGroups(
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

// ── Supplier groups ─────────────────────────────────────────────────────
export interface SupplierGroup {
  key: string;
  name: string;
  totalSpent: number;
  count: number;
  lastDate: string;
  topCategory: string;
}

export function buildSupplierGroups(txs: Transaction[]): SupplierGroup[] {
  const map = new Map<string, {
    nameFreq: Map<string, number>;
    totalSpent: number;
    count: number;
    lastDate: string;
    catFreq: Map<string, number>;
  }>();

  for (const tx of txs) {
    const normKey = tx.description.trim().toLowerCase();
    if (!map.has(normKey)) {
      map.set(normKey, { nameFreq: new Map(), totalSpent: 0, count: 0, lastDate: "", catFreq: new Map() });
    }
    const g = map.get(normKey)!;
    g.totalSpent += Math.abs(tx.amount);
    g.count += 1;
    if (tx.date > g.lastDate) g.lastDate = tx.date;
    g.nameFreq.set(tx.description, (g.nameFreq.get(tx.description) ?? 0) + 1);
    if (tx.category) {
      g.catFreq.set(tx.category, (g.catFreq.get(tx.category) ?? 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([key, { nameFreq, totalSpent, count, lastDate, catFreq }]) => {
      let bestName = "";
      let bestNameCount = 0;
      nameFreq.forEach((c, v) => {
        if (c > bestNameCount || (c === bestNameCount && v < bestName)) { bestName = v; bestNameCount = c; }
      });
      let bestCat = "";
      let bestCatCount = 0;
      catFreq.forEach((c, v) => {
        if (c > bestCatCount || (c === bestCatCount && v < bestCat)) { bestCat = v; bestCatCount = c; }
      });
      return { key, name: bestName, totalSpent, count, lastDate, topCategory: bestCat };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

// ── Client groups ───────────────────────────────────────────────────────
export interface ClientGroup {
  key: string;
  name: string;
  totalReceived: number;
  count: number;
  lastDate: string;
  topCategory: string;
}

export function buildClientGroups(txs: Transaction[]): ClientGroup[] {
  const map = new Map<string, {
    nameFreq: Map<string, number>;
    totalReceived: number;
    count: number;
    lastDate: string;
    catFreq: Map<string, number>;
  }>();

  for (const tx of txs) {
    const normKey = tx.description.trim().toLowerCase();
    if (!map.has(normKey)) {
      map.set(normKey, { nameFreq: new Map(), totalReceived: 0, count: 0, lastDate: "", catFreq: new Map() });
    }
    const g = map.get(normKey)!;
    g.totalReceived += tx.amount;
    g.count += 1;
    if (tx.date > g.lastDate) g.lastDate = tx.date;
    g.nameFreq.set(tx.description, (g.nameFreq.get(tx.description) ?? 0) + 1);
    if (tx.category) {
      g.catFreq.set(tx.category, (g.catFreq.get(tx.category) ?? 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([key, { nameFreq, totalReceived, count, lastDate, catFreq }]) => {
      let bestName = "";
      let bestNameCount = 0;
      nameFreq.forEach((c, v) => {
        if (c > bestNameCount || (c === bestNameCount && v < bestName)) { bestName = v; bestNameCount = c; }
      });
      let bestCat = "";
      let bestCatCount = 0;
      catFreq.forEach((c, v) => {
        if (c > bestCatCount || (c === bestCatCount && v < bestCat)) { bestCat = v; bestCatCount = c; }
      });
      return { key, name: bestName, totalReceived, count, lastDate, topCategory: bestCat };
    })
    .sort((a, b) => b.totalReceived - a.totalReceived);
}

// ── Category trend (for stacked bar) ────────────────────────────────────
export interface TrendPoint {
  month: string;
  [category: string]: number | string; // month is string, rest are amounts
}

export function buildCategoryTrend(
  txs: Transaction[],
  type: "expense" | "income",
  monthCount: number = 6
): TrendPoint[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const result: TrendPoint[] = months.map((m) => ({ month: m }));

  for (const tx of txs) {
    if (type === "expense" && tx.amount >= 0) continue;
    if (type === "income" && tx.amount <= 0) continue;
    if (tx.isExcluded) continue;

    const txMonth = tx.date.slice(0, 7); // YYYY-MM
    const idx = months.indexOf(txMonth);
    if (idx === -1) continue;

    const cat = tx.category || "אחר";
    result[idx][cat] = ((result[idx][cat] as number) || 0) + Math.abs(tx.amount);
  }

  return result;
}

// ── Prior period comparison ─────────────────────────────────────────────
export function getPriorPeriodTxs(allTxs: Transaction[], timeRange: TimeRange): Transaction[] {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();

  let priorStart: Date;
  let priorEnd: Date;

  switch (timeRange) {
    case "month": {
      priorStart = new Date(y, mo - 1, 1);
      priorEnd = new Date(y, mo, 0);
      break;
    }
    case "3months": {
      const s = new Date(now);
      s.setMonth(s.getMonth() - 6);
      priorStart = s;
      const e = new Date(now);
      e.setMonth(e.getMonth() - 3);
      priorEnd = e;
      break;
    }
    case "6months": {
      const s = new Date(now);
      s.setMonth(s.getMonth() - 12);
      priorStart = s;
      const e = new Date(now);
      e.setMonth(e.getMonth() - 6);
      priorEnd = e;
      break;
    }
    case "year": {
      priorStart = new Date(y - 1, 0, 1);
      priorEnd = new Date(y - 1, 11, 31);
      break;
    }
    default:
      return [];
  }

  return allTxs.filter((tx) => {
    const [ty, tm, td] = tx.date.split("-").map(Number);
    const d = new Date(ty, tm - 1, td);
    return d >= priorStart && d <= priorEnd;
  });
}

// ── Supplier anomaly detection ──────────────────────────────────────────
export interface SupplierAnomaly {
  supplierName: string;
  type: "spend_increase" | "large_payment" | "new" | "missing";
  detail: string;
}

export function detectSupplierAnomalies(
  currentGroups: SupplierGroup[],
  priorGroups: SupplierGroup[]
): SupplierAnomaly[] {
  const anomalies: SupplierAnomaly[] = [];
  const priorMap = new Map(priorGroups.map((g) => [g.key, g]));
  const currentMap = new Map(currentGroups.map((g) => [g.key, g]));

  for (const g of currentGroups) {
    const prior = priorMap.get(g.key);
    if (!prior) {
      anomalies.push({ supplierName: g.name, type: "new", detail: `₪${g.totalSpent.toLocaleString("he-IL")}` });
      continue;
    }
    if (prior.totalSpent > 0 && g.totalSpent > prior.totalSpent * 1.3) {
      const pct = Math.round(((g.totalSpent - prior.totalSpent) / prior.totalSpent) * 100);
      anomalies.push({ supplierName: g.name, type: "spend_increase", detail: `+${pct}%` });
    }
    const avg = g.totalSpent / g.count;
    if (g.count > 1) {
      // check if any single payment > 2x avg (approximate via max possible)
      const maxPossible = g.totalSpent - avg * (g.count - 1);
      if (maxPossible > avg * 2) {
        anomalies.push({ supplierName: g.name, type: "large_payment", detail: `₪${Math.round(maxPossible).toLocaleString("he-IL")}` });
      }
    }
  }

  for (const pg of priorGroups) {
    if (!currentMap.has(pg.key) && pg.count >= 3) {
      anomalies.push({ supplierName: pg.name, type: "missing", detail: `${pg.count} payments prior` });
    }
  }

  return anomalies;
}

// ── Client issue detection ──────────────────────────────────────────────
export interface ClientIssue {
  clientName: string;
  type: "concentration" | "dormant" | "new";
  detail: string;
}

export function detectClientIssues(
  currentGroups: ClientGroup[],
  priorGroups: ClientGroup[]
): ClientIssue[] {
  const issues: ClientIssue[] = [];
  const priorMap = new Map(priorGroups.map((g) => [g.key, g]));
  const totalRevenue = currentGroups.reduce((s, g) => s + g.totalReceived, 0);

  for (const g of currentGroups) {
    if (!priorMap.has(g.key)) {
      issues.push({ clientName: g.name, type: "new", detail: `₪${g.totalReceived.toLocaleString("he-IL")}` });
    }
    if (totalRevenue > 0 && g.totalReceived / totalRevenue > 0.4) {
      const pct = Math.round((g.totalReceived / totalRevenue) * 100);
      issues.push({ clientName: g.name, type: "concentration", detail: `${pct}%` });
    }
  }

  const currentMap = new Map(currentGroups.map((g) => [g.key, g]));
  for (const pg of priorGroups) {
    if (!currentMap.has(pg.key) && pg.count >= 2) {
      issues.push({ clientName: pg.name, type: "dormant", detail: `${pg.count} payments prior` });
    }
  }

  return issues;
}

// ── Daily cash flow ─────────────────────────────────────────────────────
export interface DailyBalancePoint {
  day: number;
  balance: number;
  incomeEvents: { name: string; amount: number }[];
  expenseEvents: { name: string; amount: number }[];
}

export function buildDailyBalance(
  txs: Transaction[],
  openingBalance: number,
  year: number,
  month: number // 0-indexed
): DailyBalancePoint[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: DailyBalancePoint[] = [];
  let balance = openingBalance;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayTxs = txs.filter((tx) => tx.date === dayStr && !tx.isExcluded);

    const incomeEvents: { name: string; amount: number }[] = [];
    const expenseEvents: { name: string; amount: number }[] = [];

    for (const tx of dayTxs) {
      if (tx.amount > 0) {
        balance += tx.amount;
        incomeEvents.push({ name: tx.description, amount: tx.amount });
      } else {
        balance += tx.amount; // negative
        expenseEvents.push({ name: tx.description, amount: Math.abs(tx.amount) });
      }
    }

    result.push({ day, balance: Math.round(balance), incomeEvents, expenseEvents });
  }

  return result;
}

// ── Helper: get transactions for a specific month ───────────────────────
export function getMonthTransactions(
  allTxs: Transaction[],
  year: number,
  month: number // 0-indexed
): Transaction[] {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return allTxs.filter((tx) => tx.date.startsWith(prefix));
}

// ── Helper: compute prior period % change ───────────────────────────────
export function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? 100 : null;
  return Math.round(((current - prior) / prior) * 100);
}

// Re-export filterByTimeRange for convenience
export { filterByTimeRange };
