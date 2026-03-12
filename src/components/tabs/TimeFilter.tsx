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
