"use client";

import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { Business } from "@/types";
import { updateBusiness } from "@/lib/store";
import { X, Upload, Briefcase, RefreshCw, ShoppingCart, Layers, Clock, BarChart2 } from "lucide-react";

const INDUSTRIES_HE = [
  { value: "services", label: "שירותים מקצועיים" },
  { value: "retail", label: "קמעונאות" },
  { value: "tech", label: "טכנולוגיה / סטארטאפ" },
  { value: "food", label: "מזון ומסעדנות" },
  { value: "construction", label: "בנייה וקבלנות" },
  { value: "health", label: "בריאות ורפואה" },
  { value: "education", label: "חינוך והדרכה" },
  { value: "real_estate", label: "נדלן" },
  { value: "beauty", label: "יופי וטיפוח" },
  { value: "logistics", label: "לוגיסטיקה ושילוח" },
  { value: "marketing", label: "שיווק ופרסום" },
  { value: "finance", label: "פיננסים וביטוח" },
  { value: "other", label: "אחר" },
];

const INDUSTRIES_EN = [
  { value: "services", label: "Professional Services" },
  { value: "retail", label: "Retail" },
  { value: "tech", label: "Technology / Startup" },
  { value: "food", label: "Food & Restaurants" },
  { value: "construction", label: "Construction" },
  { value: "health", label: "Health & Medical" },
  { value: "education", label: "Education & Training" },
  { value: "real_estate", label: "Real Estate" },
  { value: "beauty", label: "Beauty & Wellness" },
  { value: "logistics", label: "Logistics & Shipping" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "finance", label: "Finance & Insurance" },
  { value: "other", label: "Other" },
];

const REVENUE_MODELS = [
  { value: "one_time_projects", icon: Briefcase },
  { value: "monthly_retainer", icon: RefreshCw },
  { value: "product_sales", icon: ShoppingCart },
  { value: "subscriptions", icon: Layers },
  { value: "hourly_billing", icon: Clock },
  { value: "mixed", icon: BarChart2 },
] as const;

interface Props {
  business: Business;
  onClose: () => void;
  onSaved: (updated: Business) => void;
}

export default function EditBusinessModal({ business, onClose, onSaved }: Props) {
  const { lang } = useApp();
  const tr = t[lang];
  const industries = lang === "he" ? INDUSTRIES_HE : INDUSTRIES_EN;

  const [form, setForm] = useState({
    name: business.name,
    logo: business.logo ?? "",
    industry: business.industry,
    revenueModel: business.revenueModel ?? "",
    employees: business.employees,
    fixedMonthlyCosts: business.fixedMonthlyCosts,
    targetMonthlyProfit: business.targetMonthlyProfit,
  });
  const [ownerNames, setOwnerNames] = useState<string[]>(business.ownerNames ?? []);
  const [ownerInput, setOwnerInput] = useState("");

  const update = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update("logo", ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addOwner = () => {
    const trimmed = ownerInput.trim();
    if (trimmed && !ownerNames.includes(trimmed)) {
      setOwnerNames((prev) => [...prev, trimmed]);
    }
    setOwnerInput("");
  };

  const removeOwner = (name: string) => setOwnerNames((prev) => prev.filter((n) => n !== name));

  const revenueModelLabel = (value: string): string => {
    const key = `revenueModel_${value}` as keyof typeof tr;
    return (tr[key] as string) ?? value;
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const updated: Business = { ...business, ...form, ownerNames };
    updateBusiness(updated);
    onSaved(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white rounded-t-2xl px-8 pt-8 pb-4 border-b border-gray-100 z-10">
          <button onClick={onClose} className="absolute top-4 end-4 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-900">{tr.editBusiness}</h2>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden flex-shrink-0"
              onClick={() => document.getElementById("editLogoInput")?.click()}
            >
              {form.logo ? (
                <img src={form.logo} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {lang === "he" ? "לוגו העסק" : "Business Logo"}
              </p>
              <p className="text-xs text-gray-400">
                {lang === "he" ? "לחץ להחלפת תמונה (אופציונלי)" : "Click to change (optional)"}
              </p>
              {form.logo && (
                <button
                  type="button"
                  onClick={() => update("logo", "")}
                  className="text-xs text-red-400 hover:text-red-600 mt-1"
                >
                  {lang === "he" ? "הסר לוגו" : "Remove logo"}
                </button>
              )}
            </div>
            <input id="editLogoInput" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          {/* Business name */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">{tr.businessName}</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          {/* Owner names */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">{tr.ownerName}</label>
            {ownerNames.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {ownerNames.map((name) => (
                  <span
                    key={name}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full border border-blue-200"
                  >
                    {name}
                    <button type="button" onClick={() => removeOwner(name)} className="text-blue-400 hover:text-blue-700 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="ישראל ישראלי"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOwner(); } }}
              />
              <button
                type="button"
                onClick={addOwner}
                className="w-10 h-10 rounded-xl bg-blue-600 text-white text-xl font-light hover:bg-blue-700 flex items-center justify-center flex-shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">{tr.industry}</label>
            <select
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
            >
              {industries.map((ind) => (
                <option key={ind.value} value={ind.value}>{ind.label}</option>
              ))}
            </select>
          </div>

          {/* Revenue model */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">{tr.revenueModelStep}</label>
            <div className="grid grid-cols-3 gap-2">
              {REVENUE_MODELS.map(({ value, icon: Icon }) => {
                const selected = form.revenueModel === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update("revenueModel", value)}
                    className={`rounded-xl p-2.5 text-center cursor-pointer transition-all flex flex-col items-center gap-1 ${
                      selected
                        ? "bg-blue-50 border-2 border-blue-500 text-blue-700"
                        : "bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium leading-tight">{revenueModelLabel(value)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Employees */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">{tr.employees}</label>
            <input
              type="number" min={1}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.employees}
              onChange={(e) => update("employees", +e.target.value)}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white rounded-b-2xl px-8 py-6 border-t border-gray-100">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 font-medium">
              {tr.cancel}
            </button>
            <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 font-medium">
              {tr.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
