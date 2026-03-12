# BizUp — Categories, Suppliers & Clients Tabs Design

**Date:** 2026-03-12
**Status:** Approved for implementation

---

## Overview

Add three aggregated data view tabs — **Categories**, **Suppliers**, and **Clients** — to the existing Transactions page (`/transactions/[businessId]`). Each tab shows charts and summary tables derived from the business's real transaction data. No new routes, no new API calls, no new localStorage keys.

---

## Scope

- Three new tab values added to the Transactions page tab bar
- Three new React components, one per tab
- One shared `TimeFilter` component
- No changes to existing All / Income / Expenses / Excluded tab logic
- No AI insight panels
- Uses existing light design system (white cards, blue/green palette, Recharts)
- Fully bilingual (Hebrew RTL + English LTR)

---

## Types

`src/types/index.ts` already exists. Add `TimeRange` to it:

```typescript
export type TimeRange = "month" | "3months" | "6months" | "year" | "all";
```

`Language` is already exported from `src/types/index.ts`. All tab components import both from `@/types`.

---

## Tab Bar

Current tabs: `All | Income | Expenses | Excluded`
New tabs appended: `All | Income | Expenses | Excluded | Categories | Suppliers | Clients`

The existing active-tab state default is unchanged. The first four tabs retain their existing filter logic. The last three are aggregated view tabs.

---

## Time Filter

### Component: `TimeFilter.tsx`

Stateless pill button group. **Rendered by the Transactions page** above the active tab component — not inside the tab components.

```typescript
interface TimeFilterProps {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  lang: Language;
}
```

**Options:**
| Key | Label (HE) | Label (EN) | Boundary (reference: `new Date()` at render, midnight local time) |
|-----|-----------|-----------|---|
| `month` | חודש זה | This Month | `txDate >= new Date(year, month, 1)` |
| `3months` | 3 חודשים | 3 Months | `txDate >= today − 90 days` (rolling) |
| `6months` | 6 חודשים | 6 Months | `txDate >= today − 180 days` (rolling) |
| `year` | שנה זו | This Year | `txDate >= new Date(year, 0, 1)` |
| `all` | הכל | All Time | no filter |

All boundaries are inclusive. Future-dated transactions (date > today) are always included regardless of filter.

Date comparison: parse `transaction.date` (YYYY-MM-DD) by splitting on `"-"` and constructing `new Date(year, month-1, day)` (midnight local). Compare against boundary Date objects constructed the same way.

**State:** Lifted to Transactions page. **Persists when switching between the three new tabs.** Resets to `"month"` only when the component mounts (initial value).

```typescript
const [timeRange, setTimeRange] = useState<TimeRange>("month");
```

The page renders `<TimeFilter>` only when the active tab is `"categories"`, `"suppliers"`, or `"clients"`. Hidden on the original four tabs — state is retained.

**Style:** Pill button group, `flex gap-1 flex-wrap`. Active: `bg-blue-600 text-white`. Inactive: `bg-white border border-gray-200 text-gray-600 hover:border-blue-300`. Each button: `rounded-full px-3 py-1.5 text-sm font-medium transition-colors`.

---

## Data Rules (all three tabs)

- Each tab component receives **raw, unfiltered** `transactions: Transaction[]` from the page.
- Each tab component filters `isExcluded: true` first, then applies the time filter.
- Transactions where `amount === 0` are silently discarded — they are not counted in any group, chart, or table.
- Amounts are displayed as absolute values; sign determines income vs expense classification.

---

## Categories Tab

### Props
```typescript
interface CategoriesTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}
```

### Toggle
Local state: `const [type, setType] = useState<"expense" | "income">("expense")`. Segmented control rendered at top-right of the card header. Toggling does not reset any chart or sort state — the top-8 selection and table sort both re-compute from scratch for the newly active type.

### Data processing (`useMemo` — recomputes when `transactions`, `timeRange`, or `type` changes)

1. Filter `!isExcluded`, discard `amount === 0`
2. Apply time range filter
3. Based on `type`: keep `amount < 0` (expenses) or `amount > 0` (income)
4. Group by normalized key: `(transaction.category ?? "").trim().toLowerCase() || "__other__"`
5. For display name within each group: use the **most frequent** original `category` value in the group (case/spacing as stored). Tie-break: alphabetically first. If the key is `"__other__"`, display `tr.otherCategory` ("אחר" / "Other").
6. Compute per group: `total` (sum of absolute amounts), `count` (transaction count)
7. Compute `grandTotal`: sum of `total` across all groups — used as denominator for % of Total

### % of Total
`(group.total / grandTotal * 100).toFixed(1) + "%"` — one decimal place, always using `.` as decimal separator (not locale-formatted, since it's a percentage).

### Chart
- Recharts `BarChart` with `layout="vertical"`, height `280px`
- Data: top 8 groups sorted by `total` descending
- Each bar gets a color from the palette by its index (0–7):
  - Expenses: `["#3B82F6","#60A5FA","#93C5FD","#BFDBFE","#2563EB","#1D4ED8","#1E40AF","#1E3A8A"]`
  - Income: `["#10B981","#34D399","#6EE7B7","#A7F3D0","#059669","#047857","#065F46","#064E3B"]`
- `<Bar dataKey="total">` with a `<Cell>` per entry using the palette
- X-axis: `tickFormatter={(v) => "₪" + v.toLocaleString("he-IL")}`
- Y-axis: `dataKey="name"`, `width={120}`, category display name
- No RTL mirroring of the chart itself

### Table
All groups sorted by `total` descending. Columns:

| Column | HE Header | EN Header | Format |
|--------|-----------|-----------|--------|
| Category | קטגוריה | Category | display name |
| Amount | סכום | Amount | `₪` + `toLocaleString("he-IL")` |
| % of Total | % מהסך | % of Total | `toFixed(1) + "%"` |
| Transactions | עסקאות | Transactions | integer |

**Table cell alignment (both RTL and LTR):** Category column — `text-start`. Amount, % of Total, Transactions — `text-end`. This ensures numbers are always right-aligned regardless of direction.

### Empty state
`tr.noDataPeriod` — shown when there are no transactions matching the active type after all filtering.

---

## Suppliers Tab

### Props
```typescript
interface SuppliersTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}
```

### Data processing (`useMemo`)
1. Filter `!isExcluded` and `amount < 0` (discard `amount === 0`)
2. Apply time range filter
3. Group by `transaction.description.trim().toLowerCase()` (normalized key)
4. Display name = **most frequent** original `description` in the group (original casing). Tie-break: alphabetically first.
5. Aggregate per group: `totalSpent` (sum of `Math.abs(amount)`), `count`, `lastDate` (max YYYY-MM-DD string — ISO string lexicographic comparison is correct for this format)

### Table row cap
All suppliers are rendered — no pagination, no row cap. (Business data volume is expected to be manageable within a single scrollable card.)

### Chart
Top 10 by `totalSpent`. Recharts `BarChart` `layout="vertical"`, height `320px`. Single color `#3B82F6`. Y-axis `width={140}`.

### Table
All suppliers sorted by `totalSpent` descending.

| Column | HE | EN | Format | Alignment |
|--------|----|----|--------|-----------|
| Supplier | ספק | Supplier | display name | `text-start` |
| Total Spent | סה"כ הוצאה | Total Spent | `₪` + `toLocaleString("he-IL")` | `text-end` |
| Transactions | עסקאות | Transactions | integer | `text-end` |
| Last Transaction | עסקה אחרונה | Last Transaction | `DD/MM/YYYY` via `date.split("-").reverse().join("/")` | `text-end` |

### Empty state
`tr.noSuppliersPeriod`

---

## Clients Tab

Identical structure to Suppliers Tab with these differences:
- Filter `amount > 0` instead of `< 0`
- Aggregate field name: `totalReceived` (sum of positive amounts, no `Math.abs` needed)
- Chart color: `#10B981`
- Column header: `tr.clientsTab` / `tr.totalReceived`

| Column | HE | EN | Format | Alignment |
|--------|----|----|--------|-----------|
| Client | לקוח | Client | display name | `text-start` |
| Total Received | סה"כ הכנסה | Total Received | `₪` + `toLocaleString("he-IL")` | `text-end` |
| Transactions | עסקאות | Transactions | integer | `text-end` |
| Last Transaction | עסקה אחרונה | Last Transaction | `DD/MM/YYYY` | `text-end` |

Empty state: `tr.noClientsPeriod`

---

## Component Architecture

### New files
```
src/components/tabs/
  TimeFilter.tsx
  CategoriesTab.tsx
  SuppliersTab.tsx
  ClientsTab.tsx
```

### Changes to `src/app/transactions/[businessId]/page.tsx`
1. Extend filter tab type to include `"categories" | "suppliers" | "clients"`
2. Add `const [timeRange, setTimeRange] = useState<TimeRange>("month")`
3. When active tab is one of the three new tabs:
   - Render `<TimeFilter value={timeRange} onChange={setTimeRange} lang={lang} />` above the tab content
   - Render the corresponding tab component, passing raw `transactions` (full list from context, no pre-filtering), `timeRange`, and `lang`
4. Original four tabs unchanged — `<TimeFilter>` is not rendered for them

---

## Visual Design

- Card: `bg-white rounded-2xl border border-gray-100 shadow-sm p-6`
- Card header row: `flex items-center justify-between mb-4` (heading on start side, toggle on end side)
- Section heading: `text-lg font-semibold text-gray-900`
- Table rows: `border-b border-gray-50 hover:bg-gray-50/50 transition-colors`
- Table headers: `text-xs font-medium text-gray-500 uppercase tracking-wide`
- Empty state: `text-gray-400 text-sm text-center py-12`

---

## Translations

Add to **both** `he` and `en` objects in `src/lib/translations.ts`:

| Key | Hebrew | English |
|-----|--------|---------|
| `categoriesTab` | `"קטגוריות"` | `"Categories"` |
| `suppliersTab` | `"ספקים"` | `"Suppliers"` |
| `clientsTab` | `"לקוחות"` | `"Clients"` |
| `expensesToggle` | `"הוצאות"` | `"Expenses"` |
| `incomeToggle` | `"הכנסות"` | `"Income"` |
| `noDataPeriod` | `"אין נתונים לתקופה הנבחרת"` | `"No data for selected period"` |
| `noSuppliersPeriod` | `"אין ספקים לתקופה הנבחרת"` | `"No suppliers for selected period"` |
| `noClientsPeriod` | `"אין לקוחות לתקופה הנבחרת"` | `"No clients for selected period"` |
| `otherCategory` | `"אחר"` | `"Other"` |
| `totalReceived` | `"סה\"כ הכנסה"` | `"Total Received"` |
| `totalSpent` | `"סה\"כ הוצאה"` | `"Total Spent"` |
| `lastTransaction` | `"עסקה אחרונה"` | `"Last Transaction"` |
| `thisMonth` | `"חודש זה"` | `"This Month"` |
| `threeMonths` | `"3 חודשים"` | `"3 Months"` |
| `sixMonths` | `"6 חודשים"` | `"6 Months"` |
| `thisYear` | `"שנה זו"` | `"This Year"` |
| `allTime` | `"הכל"` | `"All Time"` |

---

## Implementation Clarifications

### Translations access in tab components
Tab components import `t` from `@/lib/translations` and derive `const tr = t[lang]` internally — same pattern as all other components in the codebase. No extra prop needed.

### Prop interfaces (all three tab components)
```typescript
// SuppliersTab and ClientsTab — same shape as CategoriesTab
interface SuppliersTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}
interface ClientsTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}
```
`Language` is already exported from `src/types/index.ts`.

### TimeFilter visibility and state persistence
- `<TimeFilter>` is **conditionally rendered** (not hidden): `{isAggregatedTab && <TimeFilter ... />}`. It unmounts when the user switches to one of the original four tabs.
- `timeRange` state lives in the Transactions page and is **never reset** by tab switching. If a user selects `"year"`, navigates to `Expenses`, then returns to `Categories`, `timeRange` is still `"year"`.

### Amount formatting — locale
Use `"he-IL"` locale everywhere: `value.toLocaleString("he-IL")`. Apply consistently in chart axes and all table cells.

### Chart data slicing
Slice the sorted array **before** passing to BarChart:
```typescript
const chartData = sorted.slice(0, 8); // Categories (top 8)
const chartData = sorted.slice(0, 10); // Suppliers / Clients (top 10)
```
The full `sorted` array is used for the table.

### Y-axis label truncation
Truncate labels that would overflow the Y-axis width using a `tick` prop:
```typescript
const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + "…" : s;
// Categories: max=18 chars; Suppliers/Clients: max=20 chars
```

### lastDate initial accumulator
```typescript
const lastDate = group.dates.reduce((a, b) => (a > b ? a : b), "");
// YYYY-MM-DD lexicographic comparison is correct for ISO date strings.
// Initial value "" ensures any real date wins.
```

### Categories tab empty state
The empty state is shown when `filteredGroups.length === 0` after applying `type` toggle (expense/income), time range, and isExcluded filter. Toggling between expense/income independently checks for data.

---

## Out of Scope

- Row click drill-down
- CSV export
- AI insight panels
- New API routes / localStorage keys
- Pagination or virtual scrolling (intentionally omitted)

---

## Execution Order

1. `src/types/index.ts` — add `TimeRange` export
2. `src/lib/translations.ts` — add all keys above (parallel with 1)
3. `src/components/tabs/TimeFilter.tsx`
4. `src/components/tabs/CategoriesTab.tsx` (parallel with 5, 6 — after 1–3)
5. `src/components/tabs/SuppliersTab.tsx` (parallel with 4, 6)
6. `src/components/tabs/ClientsTab.tsx` (parallel with 4, 5)
7. `src/app/transactions/[businessId]/page.tsx` — wire up tabs + state (after 1–6)
