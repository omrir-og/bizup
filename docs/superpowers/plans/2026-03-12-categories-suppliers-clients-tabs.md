# Categories, Suppliers & Clients Tabs — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three aggregated data view tabs (Categories, Suppliers, Clients) to the existing Transactions page, each with a time filter, chart, and summary table.

**Architecture:** Four new components in `src/components/tabs/` — one shared `TimeFilter` and one per new tab. The Transactions page gets three new tab values and a shared `timeRange` state; existing tab logic is untouched. All data computation happens via `useMemo` inside each tab component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Recharts (already installed).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/index.ts` | Modify | Add `TimeRange` type export |
| `src/lib/translations.ts` | Modify | Add new translation keys to both `he` and `en` |
| `src/components/tabs/TimeFilter.tsx` | Create | Stateless pill button group for time range selection |
| `src/components/tabs/CategoriesTab.tsx` | Create | Categories breakdown view with chart + table |
| `src/components/tabs/SuppliersTab.tsx` | Create | Supplier spend view with chart + table |
| `src/components/tabs/ClientsTab.tsx` | Create | Client income view with chart + table |
| `src/app/transactions/[businessId]/page.tsx` | Modify | Wire up three new tabs, TimeFilter, timeRange state |

No new routes. No new API calls. No new localStorage keys.

---

## Notes on this codebase

- **No test suite** — verification is `npm run build` (TypeScript + Next.js compile) plus manual browser check.
- **Translations** — accessed as `const tr = t[lang]` inside components. Import `t` from `@/lib/translations`.
- **Existing keys** — `suppliersTab`, `clients`, `totalReceived`, `allTime` already exist in both `he` and `en`. Don't duplicate them. See cross-reference table in Task 2.
- **Build command** — run from project root: `npm run build --prefix "C:/Users/rusoo/bizup"` (Windows path, use `dangerouslyDisableSandbox: true` if needed).
- **Recharts** — already at `^3.8.0`. Import from `"recharts"`.

---

## Chunk 1: Foundation (Types + Translations)

### Task 1: Add TimeRange type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add TimeRange export**

Open `src/types/index.ts`. After the last `export interface` (after line 136), add:

```typescript
export type TimeRange = "month" | "3months" | "6months" | "year" | "all";
```

- [ ] **Step 2: Verify build**

Run: `npm run build --prefix "C:/Users/rusoo/bizup"`
Expected: Build succeeds (or same errors as before — no new TypeScript errors).

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/rusoo/bizup" add src/types/index.ts
git -C "C:/Users/rusoo/bizup" commit -m "feat: add TimeRange type"
```

---

### Task 2: Add translation keys

**Files:**
- Modify: `src/lib/translations.ts`

**Cross-reference — keys that ALREADY EXIST (do NOT add again):**
| Spec key | Existing key to use instead | He value | En value |
|----------|----------------------------|----------|----------|
| `suppliersTab` | `suppliersTab` | "ספקים" | "Suppliers" |
| `clientsTab` | `clients` | "לקוחות" | "Clients" |
| `totalReceived` | `totalReceived` | "סה\"כ התקבל" | "Total Received" |
| `allTime` | `allTime` | "כל הזמנים" | "All Time" |

**Keys to ADD** (append at the end of each language object, just before the closing `}`):

- [ ] **Step 1: Add keys to `he` object**

Find the line `excludedBadge: "{n} פעולות לא נכללות בתחשיב",` in the `he` object (around line 287). Add after it, before the closing `},`:

```typescript
    // Categories / Suppliers / Clients tabs
    categoriesTab: "קטגוריות",
    expensesToggle: "הוצאות",
    incomeToggle: "הכנסות",
    noDataPeriod: "אין נתונים לתקופה הנבחרת",
    noSuppliersPeriod: "אין ספקים לתקופה הנבחרת",
    noClientsPeriod: "אין לקוחות לתקופה הנבחרת",
    otherCategory: "אחר",
    totalSpent: "סה\"כ הוצאה",
    lastTransaction: "עסקה אחרונה",
    thisMonth: "חודש זה",
    threeMonths: "3 חודשים",
    sixMonths: "6 חודשים",
    thisYear: "שנה זו",
```

- [ ] **Step 2: Add keys to `en` object**

Find the line `excludedBadge: "{n} transactions excluded from calculation",` in the `en` object (around line 574). Add after it, before the closing `},`:

```typescript
    // Categories / Suppliers / Clients tabs
    categoriesTab: "Categories",
    expensesToggle: "Expenses",
    incomeToggle: "Income",
    noDataPeriod: "No data for selected period",
    noSuppliersPeriod: "No suppliers for selected period",
    noClientsPeriod: "No clients for selected period",
    otherCategory: "Other",
    totalSpent: "Total Spent",
    lastTransaction: "Last Transaction",
    thisMonth: "This Month",
    threeMonths: "3 Months",
    sixMonths: "6 Months",
    thisYear: "This Year",
```

- [ ] **Step 3: Verify build**

Run: `npm run build --prefix "C:/Users/rusoo/bizup"`
Expected: Build succeeds. If TypeScript complains about `TKeys`, the type is inferred — no manual update needed.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/rusoo/bizup" add src/lib/translations.ts
git -C "C:/Users/rusoo/bizup" commit -m "feat: add translation keys for tab views"
```

---

## Chunk 2: TimeFilter Component

### Task 3: Create TimeFilter component

**Files:**
- Create: `src/components/tabs/TimeFilter.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { Language, TimeRange } from "@/types";
import { t } from "@/lib/translations";

interface TimeFilterProps {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  lang: Language;
}

const RANGES: TimeRange[] = ["month", "3months", "6months", "year", "all"];

export default function TimeFilter({ value, onChange, lang }: TimeFilterProps) {
  const tr = t[lang];

  const label = (r: TimeRange): string => {
    if (r === "month") return tr.thisMonth;
    if (r === "3months") return tr.threeMonths;
    if (r === "6months") return tr.sixMonths;
    if (r === "year") return tr.thisYear;
    return tr.allTime;
  };

  return (
    <div className="flex gap-1 flex-wrap mb-4">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            value === r
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
          }`}
        >
          {label(r)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build --prefix "C:/Users/rusoo/bizup"`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/rusoo/bizup" add src/components/tabs/TimeFilter.tsx
git -C "C:/Users/rusoo/bizup" commit -m "feat: add TimeFilter component"
```

---

## Chunk 3: CategoriesTab Component

### Task 4: Create CategoriesTab component

**Files:**
- Create: `src/components/tabs/CategoriesTab.tsx`

**Helper — `filterByTimeRange`** (inline function, not a shared utility — only used here):

```typescript
function filterByTimeRange(txs: Transaction[], range: TimeRange): Transaction[] {
  if (range === "all") return txs;
  const now = new Date();
  const [y, m] = [now.getFullYear(), now.getMonth()];
  let boundary: Date;
  if (range === "month") boundary = new Date(y, m, 1);
  else if (range === "3months") boundary = new Date(y, m, now.getDate() - 90);
  else if (range === "6months") boundary = new Date(y, m, now.getDate() - 180);
  else boundary = new Date(y, 0, 1); // year
  return txs.filter((tx) => {
    const [ty, tm, td] = tx.date.split("-").map(Number);
    return new Date(ty, tm - 1, td) >= boundary;
  });
}
```

**Helper — `truncate`**:

```typescript
const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + "…" : s;
```

**Color palettes**:

```typescript
const EXPENSE_COLORS = ["#3B82F6","#60A5FA","#93C5FD","#BFDBFE","#2563EB","#1D4ED8","#1E40AF","#1E3A8A"];
const INCOME_COLORS  = ["#10B981","#34D399","#6EE7B7","#A7F3D0","#059669","#047857","#065F46","#064E3B"];
```

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from "recharts";
import { Language, TimeRange, Transaction } from "@/types";
import { t } from "@/lib/translations";

interface CategoriesTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}

const EXPENSE_COLORS = ["#3B82F6","#60A5FA","#93C5FD","#BFDBFE","#2563EB","#1D4ED8","#1E40AF","#1E3A8A"];
const INCOME_COLORS  = ["#10B981","#34D399","#6EE7B7","#A7F3D0","#059669","#047857","#065F46","#064E3B"];

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + "…" : s;

function filterByTimeRange(txs: Transaction[], range: TimeRange): Transaction[] {
  if (range === "all") return txs;
  const now = new Date();
  const [y, mo] = [now.getFullYear(), now.getMonth()];
  let boundary: Date;
  if (range === "month") boundary = new Date(y, mo, 1);
  else if (range === "3months") { const d = new Date(now); d.setDate(d.getDate() - 90); boundary = d; }
  else if (range === "6months") { const d = new Date(now); d.setDate(d.getDate() - 180); boundary = d; }
  else boundary = new Date(y, 0, 1);
  return txs.filter((tx) => {
    const [ty, tm, td] = tx.date.split("-").map(Number);
    return new Date(ty, tm - 1, td) >= boundary;
  });
}

interface CategoryGroup {
  key: string;
  name: string;
  total: number;
  count: number;
}

function buildGroups(
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
        // Most frequent original value, tie-break alphabetically first
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

export default function CategoriesTab({ transactions, timeRange, lang }: CategoriesTabProps) {
  const tr = t[lang];
  const [type, setType] = useState<"expense" | "income">("expense");

  const groups = useMemo(() => {
    const active = filterByTimeRange(
      transactions.filter((tx) => !tx.isExcluded && tx.amount !== 0),
      timeRange
    );
    return buildGroups(active, type, tr.otherCategory);
  }, [transactions, timeRange, type, tr.otherCategory]);

  const grandTotal = useMemo(() => groups.reduce((s, g) => s + g.total, 0), [groups]);
  const chartData = groups.slice(0, 8).map((g) => ({ name: truncate(g.name, 18), total: g.total }));
  const colors = type === "expense" ? EXPENSE_COLORS : INCOME_COLORS;

  const isEmpty = groups.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{tr.categoriesTab}</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(["expense", "income"] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => setType(tp)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                type === tp ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tp === "expense" ? tr.expensesToggle : tr.incomeToggle}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-gray-400 text-sm text-center py-12">{tr.noDataPeriod}</p>
      ) : (
        <>
          {/* Chart */}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => "₪" + (v as number).toLocaleString("he-IL")}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => ["₪" + (v as number).toLocaleString("he-IL")]}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.categoriesTab}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {lang === "he" ? "סכום" : "Amount"}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {lang === "he" ? "% מהסך" : "% of Total"}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.transactions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="text-start px-4 py-3 text-gray-800">{g.name}</td>
                    <td className="text-end px-4 py-3 text-gray-700">
                      ₪{g.total.toLocaleString("he-IL")}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-500">
                      {grandTotal > 0 ? (g.total / grandTotal * 100).toFixed(1) + "%" : "—"}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-500">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build --prefix "C:/Users/rusoo/bizup"`
Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/rusoo/bizup" add src/components/tabs/CategoriesTab.tsx
git -C "C:/Users/rusoo/bizup" commit -m "feat: add CategoriesTab component"
```

---

## Chunk 4: SuppliersTab + ClientsTab

Both components follow the same structure. They share the same `filterByTimeRange` logic (defined locally in each file — no shared utility needed).

### Task 5: Create SuppliersTab component

**Files:**
- Create: `src/components/tabs/SuppliersTab.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Language, TimeRange, Transaction } from "@/types";
import { t } from "@/lib/translations";

interface SuppliersTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + "…" : s;

function filterByTimeRange(txs: Transaction[], range: TimeRange): Transaction[] {
  if (range === "all") return txs;
  const now = new Date();
  const [y, mo] = [now.getFullYear(), now.getMonth()];
  let boundary: Date;
  if (range === "month") boundary = new Date(y, mo, 1);
  else if (range === "3months") { const d = new Date(now); d.setDate(d.getDate() - 90); boundary = d; }
  else if (range === "6months") { const d = new Date(now); d.setDate(d.getDate() - 180); boundary = d; }
  else boundary = new Date(y, 0, 1);
  return txs.filter((tx) => {
    const [ty, tm, td] = tx.date.split("-").map(Number);
    return new Date(ty, tm - 1, td) >= boundary;
  });
}

interface SupplierGroup {
  key: string;
  name: string;
  totalSpent: number;
  count: number;
  lastDate: string;
}

function buildSupplierGroups(txs: Transaction[]): SupplierGroup[] {
  const map = new Map<string, { freq: Map<string, number>; totalSpent: number; count: number; lastDate: string }>();

  for (const tx of txs) {
    const normKey = tx.description.trim().toLowerCase();
    if (!map.has(normKey)) map.set(normKey, { freq: new Map(), totalSpent: 0, count: 0, lastDate: "" });
    const g = map.get(normKey)!;
    g.totalSpent += Math.abs(tx.amount);
    g.count += 1;
    if (tx.date > g.lastDate) g.lastDate = tx.date;
    g.freq.set(tx.description, (g.freq.get(tx.description) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, { freq, totalSpent, count, lastDate }]) => {
      let best = "";
      let bestCount = 0;
      freq.forEach((c, v) => {
        if (c > bestCount || (c === bestCount && v < best)) { best = v; bestCount = c; }
      });
      return { key, name: best, totalSpent, count, lastDate };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export default function SuppliersTab({ transactions, timeRange, lang }: SuppliersTabProps) {
  const tr = t[lang];

  const groups = useMemo(() => {
    const active = filterByTimeRange(
      transactions.filter((tx) => !tx.isExcluded && tx.amount < 0),
      timeRange
    );
    return buildSupplierGroups(active);
  }, [transactions, timeRange]);

  const chartData = groups.slice(0, 10).map((g) => ({
    name: truncate(g.name, 20),
    totalSpent: g.totalSpent,
  }));

  const isEmpty = groups.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{tr.suppliersTab}</h2>
      </div>

      {isEmpty ? (
        <p className="text-gray-400 text-sm text-center py-12">{tr.noSuppliersPeriod}</p>
      ) : (
        <>
          {/* Chart */}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => "₪" + (v as number).toLocaleString("he-IL")}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => ["₪" + (v as number).toLocaleString("he-IL")]}
              />
              <Bar dataKey="totalSpent" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.supplierName}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.totalSpent}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.transactions}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.lastTransaction}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="text-start px-4 py-3 text-gray-800">{g.name}</td>
                    <td className="text-end px-4 py-3 text-gray-700">
                      ₪{g.totalSpent.toLocaleString("he-IL")}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-500">{g.count}</td>
                    <td className="text-end px-4 py-3 text-gray-500">
                      {g.lastDate ? g.lastDate.split("-").reverse().join("/") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build --prefix "C:/Users/rusoo/bizup"`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/rusoo/bizup" add src/components/tabs/SuppliersTab.tsx
git -C "C:/Users/rusoo/bizup" commit -m "feat: add SuppliersTab component"
```

---

### Task 6: Create ClientsTab component

**Files:**
- Create: `src/components/tabs/ClientsTab.tsx`

ClientsTab is structurally identical to SuppliersTab with these differences:
- Filter: `tx.amount > 0` (not `< 0`)
- Aggregate: `totalReceived` (sum of positive amounts, no `Math.abs` needed)
- Chart color: `#10B981`
- Labels use `tr.clients`, `tr.totalReceived`, `tr.noClientsPeriod`
- Interface: `ClientsTabProps`
- Group field: `totalReceived` (not `totalSpent`)

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Language, TimeRange, Transaction } from "@/types";
import { t } from "@/lib/translations";

interface ClientsTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + "…" : s;

function filterByTimeRange(txs: Transaction[], range: TimeRange): Transaction[] {
  if (range === "all") return txs;
  const now = new Date();
  const [y, mo] = [now.getFullYear(), now.getMonth()];
  let boundary: Date;
  if (range === "month") boundary = new Date(y, mo, 1);
  else if (range === "3months") { const d = new Date(now); d.setDate(d.getDate() - 90); boundary = d; }
  else if (range === "6months") { const d = new Date(now); d.setDate(d.getDate() - 180); boundary = d; }
  else boundary = new Date(y, 0, 1);
  return txs.filter((tx) => {
    const [ty, tm, td] = tx.date.split("-").map(Number);
    return new Date(ty, tm - 1, td) >= boundary;
  });
}

interface ClientGroup {
  key: string;
  name: string;
  totalReceived: number;
  count: number;
  lastDate: string;
}

function buildClientGroups(txs: Transaction[]): ClientGroup[] {
  const map = new Map<string, { freq: Map<string, number>; totalReceived: number; count: number; lastDate: string }>();

  for (const tx of txs) {
    const normKey = tx.description.trim().toLowerCase();
    if (!map.has(normKey)) map.set(normKey, { freq: new Map(), totalReceived: 0, count: 0, lastDate: "" });
    const g = map.get(normKey)!;
    g.totalReceived += tx.amount;
    g.count += 1;
    if (tx.date > g.lastDate) g.lastDate = tx.date;
    g.freq.set(tx.description, (g.freq.get(tx.description) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, { freq, totalReceived, count, lastDate }]) => {
      let best = "";
      let bestCount = 0;
      freq.forEach((c, v) => {
        if (c > bestCount || (c === bestCount && v < best)) { best = v; bestCount = c; }
      });
      return { key, name: best, totalReceived, count, lastDate };
    })
    .sort((a, b) => b.totalReceived - a.totalReceived);
}

export default function ClientsTab({ transactions, timeRange, lang }: ClientsTabProps) {
  const tr = t[lang];

  const groups = useMemo(() => {
    const active = filterByTimeRange(
      transactions.filter((tx) => !tx.isExcluded && tx.amount > 0),
      timeRange
    );
    return buildClientGroups(active);
  }, [transactions, timeRange]);

  const chartData = groups.slice(0, 10).map((g) => ({
    name: truncate(g.name, 20),
    totalReceived: g.totalReceived,
  }));

  const isEmpty = groups.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{tr.clients}</h2>
      </div>

      {isEmpty ? (
        <p className="text-gray-400 text-sm text-center py-12">{tr.noClientsPeriod}</p>
      ) : (
        <>
          {/* Chart */}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => "₪" + (v as number).toLocaleString("he-IL")}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => ["₪" + (v as number).toLocaleString("he-IL")]}
              />
              <Bar dataKey="totalReceived" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.clients}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.totalReceived}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.transactions}
                  </th>
                  <th className="text-end px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tr.lastTransaction}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="text-start px-4 py-3 text-gray-800">{g.name}</td>
                    <td className="text-end px-4 py-3 text-green-700">
                      ₪{g.totalReceived.toLocaleString("he-IL")}
                    </td>
                    <td className="text-end px-4 py-3 text-gray-500">{g.count}</td>
                    <td className="text-end px-4 py-3 text-gray-500">
                      {g.lastDate ? g.lastDate.split("-").reverse().join("/") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build --prefix "C:/Users/rusoo/bizup"`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/rusoo/bizup" add src/components/tabs/ClientsTab.tsx
git -C "C:/Users/rusoo/bizup" commit -m "feat: add ClientsTab component"
```

---

## Chunk 5: Wire Up Transactions Page

### Task 7: Update Transactions page

**Files:**
- Modify: `src/app/transactions/[businessId]/page.tsx`

The existing file has:
- `filter` state typed as `"all" | "income" | "expense" | "excluded"` — extend this type
- A filter tab bar rendering `["all", "income", "expense", "excluded"]`
- After the filter bar, the transaction table/pagination

**What to add:**
1. Import new components + types
2. Extend filter type
3. Add `timeRange` state
4. Add conditional `<TimeFilter>` above the tab content area
5. Add three new filter buttons to the tab bar
6. Conditionally render the tab components instead of the transaction table when active tab is one of the three new ones

- [ ] **Step 1: Add imports**

At the top of `src/app/transactions/[businessId]/page.tsx`, after the existing imports, add:

```typescript
import { TimeRange } from "@/types";
import TimeFilter from "@/components/tabs/TimeFilter";
import CategoriesTab from "@/components/tabs/CategoriesTab";
import SuppliersTab from "@/components/tabs/SuppliersTab";
import ClientsTab from "@/components/tabs/ClientsTab";
```

- [ ] **Step 2: Extend filter type and add timeRange state**

Find: `const [filter, setFilter] = useState<"all" | "income" | "expense" | "excluded">("all");`

Replace with:
```typescript
const [filter, setFilter] = useState<"all" | "income" | "expense" | "excluded" | "categories" | "suppliers" | "clients">("all");
const [timeRange, setTimeRange] = useState<TimeRange>("month");
```

- [ ] **Step 3: Add isAggregatedTab helper**

Right after the state declarations (before `const filtered = useMemo`), add:
```typescript
const isAggregatedTab = filter === "categories" || filter === "suppliers" || filter === "clients";
```

- [ ] **Step 4: Add new tab buttons to the tab bar**

Find the existing tab bar:
```tsx
{(["all", "income", "expense", "excluded"] as const).map((f) => (
```

Replace with:
```tsx
{(["all", "income", "expense", "excluded", "categories", "suppliers", "clients"] as const).map((f) => (
```

Find the label mapping inside the map:
```tsx
{f === "all" ? tr.filterAll : f === "income" ? tr.filterIncome : f === "expense" ? tr.filterExpenses : tr.excludedTransactions}
```

Replace with:
```tsx
{f === "all" ? tr.filterAll
  : f === "income" ? tr.filterIncome
  : f === "expense" ? tr.filterExpenses
  : f === "excluded" ? tr.excludedTransactions
  : f === "categories" ? tr.categoriesTab
  : f === "suppliers" ? tr.suppliersTab
  : tr.clients}
```

- [ ] **Step 5: Hide summary cards on aggregated tabs**

The three summary cards (transaction count, income total, expenses total) are computed from `filtered`. When `filter === "categories"` etc., `filtered` returns an empty array because none of the conditions match the new tab values — the cards would show zeros. Fix: wrap the summary cards block with `{!isAggregatedTab && (...)}`.

Find the summary section:
```tsx
{/* Summary */}
<div className="grid grid-cols-3 gap-4 mb-6">
```

Wrap the entire `<div className="grid grid-cols-3 gap-4 mb-6">...</div>` block:
```tsx
{!isAggregatedTab && (
  <div className="grid grid-cols-3 gap-4 mb-6">
    ... existing summary cards ...
  </div>
)}
```

- [ ] **Step 6: Add TimeFilter and tab content switching**

Find the section that renders the transaction table. It starts around:
```tsx
{/* Table */}
{paginated.length === 0 ? (
```

Just before this block (but after the search+filter bar `</div>`), insert:
```tsx
{/* Time filter — only for aggregated tabs */}
{isAggregatedTab && (
  <TimeFilter value={timeRange} onChange={setTimeRange} lang={lang} />
)}

{/* Aggregated tab views */}
{filter === "categories" && (
  <CategoriesTab transactions={txs} timeRange={timeRange} lang={lang} />
)}
{filter === "suppliers" && (
  <SuppliersTab transactions={txs} timeRange={timeRange} lang={lang} />
)}
{filter === "clients" && (
  <ClientsTab transactions={txs} timeRange={timeRange} lang={lang} />
)}
```

Then wrap the existing table+pagination block so it only renders for the original four tabs:

Find:
```tsx
{/* Table */}
{paginated.length === 0 ? (
```

Wrap from `{/* Table */}` to the closing pagination `</div>` in `{!isAggregatedTab && (...)}`.

**Important:** The `txs` variable (raw `Transaction[]` from `getTransactions`) is the correct prop — not `filtered` or `sorted`. The tab components do their own filtering.

- [ ] **Step 7: Verify build**

Run: `npm run build --prefix "C:/Users/rusoo/bizup"`
Expected: Zero TypeScript errors and successful build.

- [ ] **Step 8: Manual smoke test**

Run `npm run dev --prefix "C:/Users/rusoo/bizup"`, open `http://localhost:3000`, navigate to a business's Transactions page, and verify:
1. The tab bar shows: All | Income | Expenses | Excluded | Categories | Suppliers | Clients
2. Clicking Categories shows a time filter + bar chart + table
3. The expense/income toggle in Categories works
4. Clicking Suppliers shows chart + table of negative-amount transactions grouped by description
5. Clicking Clients shows chart + table of positive-amount transactions
6. Switching from Categories to All hides the time filter
7. Switching back to Categories shows the time filter with the last selected range
8. Time filter buttons change the displayed data

- [ ] **Step 9: Commit**

```bash
git -C "C:/Users/rusoo/bizup" add src/app/transactions/
git -C "C:/Users/rusoo/bizup" commit -m "feat: wire up Categories/Suppliers/Clients tabs in Transactions page"
```

---

## Final Check

- [ ] Run `npm run build --prefix "C:/Users/rusoo/bizup"` one final time — zero errors
- [ ] All 5 tasks committed to git
- [ ] New tab views work with both Hebrew (RTL) and English (LTR)
