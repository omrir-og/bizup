"use client";

import { Search } from "lucide-react";

interface FilterOption {
  key: string;
  label: string;
  active: boolean;
}

interface SearchFilterProps {
  query: string;
  onQueryChange: (q: string) => void;
  placeholder: string;
  filters?: FilterOption[];
  onFilterToggle?: (key: string) => void;
}

export default function SearchFilter({ query, onQueryChange, placeholder, filters, onFilterToggle }: SearchFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>
      {filters && filters.length > 0 && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterToggle?.(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                f.active ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
