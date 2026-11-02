import React from "react";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "./UiIcons.jsx";

// KPI Card matching the blue-purple enterprise design
export function KpiCard({
  icon: Icon,
  iconBg = "bg-indigo-50",
  iconColor = "text-indigo-600",
  label,
  value,
  subtext,
  badgeText,
  badgeType = "success", // success | warning | danger | info | neutral | purple
  toggle, // { checked, onChange }
}) {
  const badgeColors = {
    success: "text-emerald-700 bg-emerald-50 border border-emerald-200/60",
    warning: "text-amber-700 bg-amber-50 border border-amber-200/60",
    danger: "text-rose-700 bg-rose-50 border border-rose-200/60",
    info: "text-blue-700 bg-blue-50 border border-blue-200/60",
    purple: "text-purple-700 bg-purple-50 border border-purple-200/60",
    neutral: "text-slate-600 bg-slate-100 border border-slate-200/60",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-start justify-between min-w-0 transition hover:shadow-md hover:border-indigo-200/80">
      <div className="flex items-start gap-4 min-w-0">
        {Icon && (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${iconBg} ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 truncate">{label}</p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
            {badgeText && (
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${badgeColors[badgeType] || badgeColors.neutral}`}>
                {badgeText}
              </span>
            )}
          </div>
          {subtext && <p className="mt-1 text-xs text-slate-400 truncate">{subtext}</p>}
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
    ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", defaultLabel: "Active" },
    IN_STOCK: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", defaultLabel: "In Stock" },
    OPEN: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", defaultLabel: "Open" },
    PAID: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", defaultLabel: "Paid" },
    COMPLETED: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-600", defaultLabel: "Completed" },
    READY: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-600", defaultLabel: "Ready" },
    ACCEPTED: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-600", defaultLabel: "Accepted" },
    PREPARING: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-600", defaultLabel: "Preparing" },
    PENDING: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", defaultLabel: "Pending" },
    LOW_STOCK: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", defaultLabel: "Low Stock" },
    ON_LEAVE: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", defaultLabel: "On Leave" },
    INACTIVE: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", defaultLabel: "Inactive" },
    OUT_OF_STOCK: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", defaultLabel: "Out of Stock" },
    CANCELLED: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", defaultLabel: "Cancelled" },
    FAILED: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", defaultLabel: "Failed" },
  };

  const config = configs[normalized] || { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", defaultLabel: status };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
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
      <SearchIcon className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-700"
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
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`pb-3 px-3.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px flex items-center gap-2 ${
              isActive
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"
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
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-500">
      <span>
        Showing {start} to {end} of {totalItems} items
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
              page === currentPage
                ? "bg-indigo-600 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none"
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-xs sm:text-sm text-slate-500">{description}</p>}
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
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {detail && <p className="text-xs text-slate-400 mt-0.5">{detail}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <div className="w-8 h-8 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-xs">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 font-bold">⚠️</span>
        <span className="truncate">{message}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-rose-700 font-bold ml-2 hover:opacity-75">
          ✕
        </button>
      )}
    </div>
  );
}

export function StatCard({ label, value, detail }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {detail && <p className="text-[11px] text-slate-400 mt-1">{detail}</p>}
    </div>
  );
}
