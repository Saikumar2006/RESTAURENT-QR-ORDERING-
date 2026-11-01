import React from "react";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "./UiIcons.jsx";

// KPI Card matching the exact screenshot design
export function KpiCard({
  icon: Icon,
  iconBg = "bg-[#E7F5F1]",
  iconColor = "text-[#087F73]",
  label,
  value,
  subtext,
  badgeText,
  badgeType = "success", // success | warning | danger | info | neutral
  toggle, // { checked, onChange }
}) {
  const badgeColors = {
    success: "text-[#269B67] bg-[#EAF7EE]",
    warning: "text-[#D96724] bg-[#FFF2E8]",
    danger: "text-[#D95359] bg-[#FDECEC]",
    info: "text-[#4285C5] bg-[#EBF3FB]",
    neutral: "text-[#788582] bg-[#F0F4F2]",
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5ECE9] p-4 shadow-sm flex items-start justify-between min-w-0 transition hover:shadow-md">
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#788582] truncate">{label}</p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-[#172B2A] tracking-tight">{value}</span>
            {badgeText && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${badgeColors[badgeType] || badgeColors.neutral}`}>
                {badgeText}
              </span>
            )}
          </div>
          {subtext && <p className="mt-1 text-xs text-[#9CA8A5] truncate">{subtext}</p>}
        </div>
      </div>
      {toggle && (
        <label className="toggle-switch shrink-0 ml-2">
          <input
            type="checkbox"
            checked={toggle.checked}
            onChange={(e) => toggle.onChange(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      )}
    </div>
  );
}

// Status badge with dot indicator
export function StatusPill({ status, label }) {
  const normalized = String(status || "").toUpperCase();
  const configs = {
    ACTIVE: { bg: "bg-[#EAF7EE]", text: "text-[#269B67]", dot: "bg-[#269B67]", defaultLabel: "Active" },
    IN_STOCK: { bg: "bg-[#EAF7EE]", text: "text-[#269B67]", dot: "bg-[#269B67]", defaultLabel: "In Stock" },
    OPEN: { bg: "bg-[#EAF7EE]", text: "text-[#269B67]", dot: "bg-[#269B67]", defaultLabel: "Open" },
    PAID: { bg: "bg-[#EAF7EE]", text: "text-[#269B67]", dot: "bg-[#269B67]", defaultLabel: "Paid" },
    COMPLETED: { bg: "bg-[#EAF7EE]", text: "text-[#269B67]", dot: "bg-[#269B67]", defaultLabel: "Completed" },
    READY: { bg: "bg-[#EAF7EE]", text: "text-[#269B67]", dot: "bg-[#269B67]", defaultLabel: "Ready" },
    ACCEPTED: { bg: "bg-[#EBF3FB]", text: "text-[#4285C5]", dot: "bg-[#4285C5]", defaultLabel: "Accepted" },
    PREPARING: { bg: "bg-[#FFF4E5]", text: "text-[#D96724]", dot: "bg-[#D96724]", defaultLabel: "Preparing" },
    PENDING: { bg: "bg-[#FFF8E7]", text: "text-[#E7A13A]", dot: "bg-[#E7A13A]", defaultLabel: "Pending" },
    LOW_STOCK: { bg: "bg-[#FFF2E8]", text: "text-[#D96724]", dot: "bg-[#D96724]", defaultLabel: "Low Stock" },
    ON_LEAVE: { bg: "bg-[#FFF8E7]", text: "text-[#E7A13A]", dot: "bg-[#E7A13A]", defaultLabel: "On Leave" },
    INACTIVE: { bg: "bg-[#FDECEC]", text: "text-[#D95359]", dot: "bg-[#D95359]", defaultLabel: "Inactive" },
    OUT_OF_STOCK: { bg: "bg-[#FDECEC]", text: "text-[#D95359]", dot: "bg-[#D95359]", defaultLabel: "Out of Stock" },
    CANCELLED: { bg: "bg-[#FDECEC]", text: "text-[#D95359]", dot: "bg-[#D95359]", defaultLabel: "Cancelled" },
    FAILED: { bg: "bg-[#FDECEC]", text: "text-[#D95359]", dot: "bg-[#D95359]", defaultLabel: "Failed" },
  };

  const config = configs[normalized] || { bg: "bg-[#F0F4F2]", text: "text-[#788582]", dot: "bg-[#9CA8A5]", defaultLabel: status };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {label || config.defaultLabel}
    </span>
  );
}

// Backwards compatibility alias for StatusBadge
export function StatusBadge({ status }) {
  return <StatusPill status={status} />;
}

// Search bar input matching screenshot
export function SearchBar({ value, onChange, placeholder = "Search...", className = "", onClear }) {
  return (
    <div className={`relative flex items-center min-w-[240px] ${className}`}>
      <SearchIcon className="absolute left-3 w-4 h-4 text-[#9CA8A5] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 rounded-lg border border-[#E5ECE9] bg-white text-xs text-[#172B2A] placeholder-[#9CA8A5] focus:outline-none focus:border-[#087F73] focus:ring-1 focus:ring-[#087F73] transition"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 text-xs text-[#9CA8A5] hover:text-[#172B2A]"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Tab navigation row matching reference screenshots
export function TabGroup({ tabs, activeTab, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-[#E5ECE9] overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`pb-3 px-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px flex items-center gap-2 ${
              isActive
                ? "border-[#087F73] text-[#087F73]"
                : "border-transparent text-[#788582] hover:text-[#172B2A]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? "bg-[#E7F5F1] text-[#087F73]" : "bg-[#F0F4F2] text-[#788582]"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Table Pagination Bar matching screenshots
export function PaginationBar({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
}) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-[#E5ECE9] text-xs text-[#788582]">
      <span>
        Showing {start} to {end} of {totalItems} items
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="w-7 h-7 flex items-center justify-center rounded border border-[#E5ECE9] bg-white text-[#788582] hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`w-7 h-7 rounded text-xs font-medium transition ${
              page === currentPage
                ? "bg-[#087F73] text-white"
                : "border border-[#E5ECE9] bg-white text-[#788582] hover:bg-slate-50"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="w-7 h-7 flex items-center justify-center rounded border border-[#E5ECE9] bg-white text-[#788582] hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Reusable Page Header matching screenshot visual
export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#172B2A] tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-xs sm:text-sm text-[#788582]">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

// Section Header inside cards
export function SectionHeading({ title, detail, action }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div>
        <h2 className="text-sm font-bold text-[#172B2A]">{title}</h2>
        {detail && <p className="text-xs text-[#9CA8A5] mt-0.5">{detail}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#788582]">
      <div className="w-8 h-8 border-2 border-[#E5ECE9] border-t-[#087F73] rounded-full animate-spin" />
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-[#E7F5F1] text-[#087F73] flex items-center justify-center mb-3">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="text-base font-semibold text-[#172B2A]">{title}</p>
      {subtitle && <p className="text-xs text-[#788582] mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="bg-[#FDECEC] border border-[#F9C6C8] text-[#D95359] text-xs rounded-lg px-4 py-3 mb-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 font-bold">⚠️</span>
        <span className="truncate">{message}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-[#D95359] font-bold ml-2 hover:opacity-75">
          ✕
        </button>
      )}
    </div>
  );
}

export function StatCard({ label, value, detail, accent = "teal" }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5ECE9] p-4 shadow-sm relative overflow-hidden">
      <p className="text-xs font-medium text-[#788582]">{label}</p>
      <p className="text-2xl font-bold text-[#172B2A] mt-1">{value}</p>
      {detail && <p className="text-[11px] text-[#9CA8A5] mt-1">{detail}</p>}
    </div>
  );
}
