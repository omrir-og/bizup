import { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  accent?: boolean;
  icon?: ReactNode;
}

export default function KPICard({ label, value, sub, positive, accent, icon }: KPICardProps) {
  return (
    <div className={`rounded-2xl p-6 shadow-sm border ${accent ? "bg-blue-600 border-blue-500 text-white" : "bg-white border-gray-100"}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className={accent ? "text-blue-200" : "text-gray-400"}>{icon}</span>}
        <p className={`text-sm ${accent ? "text-blue-200" : "text-gray-500"}`}>{label}</p>
      </div>
      <p className={`text-2xl font-bold ${
        accent ? "text-white" :
        positive === undefined ? "text-gray-900" :
        positive ? "text-green-600" : "text-red-600"
      }`}>
        {value}
      </p>
      {sub && <p className={`text-xs mt-1 ${accent ? "text-blue-200" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}
