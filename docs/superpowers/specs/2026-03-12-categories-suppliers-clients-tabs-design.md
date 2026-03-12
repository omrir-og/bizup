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

## Tab Bar

Current tabs: `All | Income | Expenses | Excluded`
New tabs appended: `All | Income | Expenses | Excluded | Categories | Suppliers | Clients`

The first four tabs retain their existing filter logic (operate on the transaction list). The last three are aggregated view tabs — they render their own components and ignore the existing transaction row list.

---

## Time Filter

A shared `TimeFilter` component rendered at the top of each of the three new tabs.

**Options:**
| Key | Label (HE) | Label (EN) | Logic |
|-----|-----------|-----------|-------|
| `month` | חודש זה | This Month | transactions in current calendar month |
| `3months` | 3 חודשים | 3 Months | last 90 days |
| `6months` | 6 חודשים | 6 Months | last 180 days |
| `year` | שנה זו | This Year | current calendar year |
| `all` | הכל | All Time | no date filter |

**Props:** `value: TimeRange`, `onChange: (v: TimeRange) => void`, `lang: Language`

**Style:** Pill button group, matching existing filter tab style. Active pill: `bg-blue-600 text-white`. Inactive: `bg-white border border-gray-200 text-gray-600 hover:border-blue-300`.

**State:** Lifted to the Transactions page. Shared across the three tabs so switching tabs retains the selected range.

---

## Data Rules (all three tabs)

- Transactions with `isExcluded: true` are excluded from all calculations.
- The time filter is applied before all aggregation.
- Amounts are treated as absolute values for display (sign determines income vs expense).

---

## Categories Tab

**Purpose:** Show how income and expenses break down by AI-assigned category.

### Toggle
A small segmented control at the top right: `הוצאות / Expenses` | `הכנסות / Income`. Default: Expenses.

### Chart
- **Type:** Horizontal `BarChart` (Recharts)
- **Data:** Top 8 categories by absolute amount for the selected type (expense or income)
- **Colors:** Expenses → blue shades (`#3B82F6`, `#60A5FA`, `#93C5FD`, …); Income → green shades (`#10B981`, `#34D399`, `#6EE7B7`, …)
- **X-axis:** Amount in ILS (formatted with `₪` + thousands separator)
- **Y-axis:** Category name (truncated at 20 chars if needed)
- **RTL:** When `lang === "he"`, chart layout mirrors horizontally (layout stays `horizontal`, labels align right)

### Table
Displayed below the chart. Shows all categories for the selected type (not just top 8).

| Column | Description |
|--------|-------------|
| Category | Category name |
| Amount | Total absolute amount in ILS |
| % of Total | Percentage of all expenses (or income) in the period |
| Transactions | Count of transactions in this category |

Sorted by Amount descending. No pagination — scrollable within the card.

Rows with no category (`undefined` or empty string) are grouped under `"אחר" / "Other"`.

---

## Suppliers Tab

**Purpose:** Show which suppliers the business spends the most with.

**Data source:** Transactions where `amount < 0` and `!isExcluded`, grouped by `description` (the cleaned supplier name).

### Chart
- **Type:** Horizontal `BarChart` (Recharts), top 10 suppliers by total spend
- **Color:** Blue (`#3B82F6`)
- **X-axis:** Total spent (absolute ILS)
- **Y-axis:** Supplier name

### Table
All suppliers in the filtered period, sorted by total spent descending.

| Column | Description |
|--------|-------------|
| Supplier | `transaction.description` (cleaned name) |
| Total Spent | Sum of absolute amounts |
| Transactions | Count |
| Last Transaction | Most recent date (formatted `DD/MM/YYYY`) |

---

## Clients Tab

**Purpose:** Show which clients pay the business the most.

**Data source:** Transactions where `amount > 0` and `!isExcluded`, grouped by `description`.

### Chart
- **Type:** Horizontal `BarChart` (Recharts), top 10 clients by total received
- **Color:** Green (`#10B981`)
- **X-axis:** Total received (ILS)
- **Y-axis:** Client name

### Table
All clients in the filtered period, sorted by total received descending.

| Column | Description |
|--------|-------------|
| Client | `transaction.description` |
| Total Received | Sum of amounts |
| Transactions | Count |
| Last Transaction | Most recent date |

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

### `TimeFilter.tsx`
```typescript
type TimeRange = "month" | "3months" | "6months" | "year" | "all";

interface TimeFilterProps {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  lang: Language;
}
```

Stateless — parent owns the state.

### `CategoriesTab.tsx`
```typescript
interface CategoriesTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}
```

Computes aggregates internally via `useMemo`. Renders TimeFilter + toggle + chart + table.

### `SuppliersTab.tsx` / `ClientsTab.tsx`
```typescript
interface SuppliersTabProps {
  transactions: Transaction[];
  timeRange: TimeRange;
  lang: Language;
}
```

Same pattern. SuppliersTab filters `amount < 0`; ClientsTab filters `amount > 0`.

### Changes to `src/app/transactions/[businessId]/page.tsx`
- Extend the tab filter type to include `"categories" | "suppliers" | "clients"`
- Add `timeRange` state: `const [timeRange, setTimeRange] = useState<TimeRange>("month")`
- Pass `transactions` (unfiltered except `isExcluded` is already excluded by the new tabs themselves), `timeRange`, and `lang` to the three new tab components
- Render the appropriate tab component when the active tab is one of the three new ones; otherwise render the existing transaction list

---

## Visual Design

All new components follow the existing design language:

- **Card:** `bg-white rounded-2xl border border-gray-100 shadow-sm p-6`
- **Headings:** `text-lg font-semibold text-gray-900`
- **Table rows:** `border-b border-gray-50 hover:bg-gray-50/50`
- **Table headers:** `text-xs font-medium text-gray-500 uppercase`
- **Empty state:** Centered gray text — "אין נתונים לתקופה הנבחרת" / "No data for selected period"
- **Number formatting:** ILS amounts with `toLocaleString("he-IL")` + `₪` prefix

---

## Out of Scope

- Clicking a row to drill down / filter the All tab
- Exporting data to CSV
- AI insight panels
- Any new API routes
- Any new localStorage keys

---

## Execution Order

1. `src/components/tabs/TimeFilter.tsx` — shared component
2. `src/components/tabs/CategoriesTab.tsx`
3. `src/components/tabs/SuppliersTab.tsx`
4. `src/components/tabs/ClientsTab.tsx`
5. `src/app/transactions/[businessId]/page.tsx` — wire up tabs + state

Steps 2–4 are independent and can be built in parallel.
