"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  Lightbulb,
  Building2,
  ChevronRight,
  ChevronLeft,
  Globe,
  TrendingUp,
} from "lucide-react";

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const { lang, setLang, dir, selectedBusinessId } = useApp();
  const tr = t[lang];
  const router = useRouter();
  const pathname = usePathname();

  const isRTL = dir === "rtl";
  const ChevronOpen = isRTL ? ChevronLeft : ChevronRight;
  const ChevronClose = isRTL ? ChevronRight : ChevronLeft;

  const navItems = [
    { icon: Building2, label: tr.hub, href: "/" },
    {
      icon: LayoutDashboard,
      label: tr.dashboard,
      href: selectedBusinessId ? `/dashboard/${selectedBusinessId}` : "/dashboard",
    },
    {
      icon: Upload,
      label: tr.upload,
      href: selectedBusinessId ? `/upload/${selectedBusinessId}` : "/upload",
    },
    {
      icon: Lightbulb,
      label: tr.insights,
      href: selectedBusinessId ? `/insights/${selectedBusinessId}` : "/insights",
    },
  ];

  return (
    <div
      className={cn(
        "h-screen bg-gray-900 text-white flex flex-col transition-all duration-300 z-50 relative",
        expanded ? "w-56" : "w-16"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-700 h-16">
        <TrendingUp className="w-7 h-7 text-blue-400 flex-shrink-0" />
        {expanded && (
          <span className="font-bold text-lg text-blue-400 whitespace-nowrap">BizUp</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1">
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <button
              key={href}
              onClick={() => {
                router.push(href);
                setExpanded(false);
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 w-full transition-colors rounded-none",
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="text-sm whitespace-nowrap">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Language toggle */}
      <div className="border-t border-gray-700 p-4">
        <button
          onClick={() => setLang(lang === "he" ? "en" : "he")}
          className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full"
        >
          <Globe className="w-5 h-5 flex-shrink-0" />
          {expanded && (
            <span className="text-sm">{lang === "he" ? "English" : "עברית"}</span>
          )}
        </button>
      </div>

      {/* Collapse indicator */}
      <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 bg-gray-700 rounded-full p-1 cursor-pointer opacity-0 group-hover:opacity-100">
        {expanded ? (
          <ChevronClose className="w-3 h-3" />
        ) : (
          <ChevronOpen className="w-3 h-3" />
        )}
      </div>
    </div>
  );
}
