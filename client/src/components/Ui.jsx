import React, { useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "./UiIcons.jsx";

// Apple Pro Squircle Card Container
export function AppleCard({
  children,
  className = "",
  elevated = false,
  interactive = false,
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl transition-all duration-200 ${
        elevated
          ? "bg-white dark:bg-[#2C2C2E] border border-slate-200/80 dark:border-white/[0.12] shadow-sm"
          : "bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/[0.08] shadow-xs"
      } ${
        interactive
          ? "cursor-pointer hover:border-[#007AFF]/40 dark:hover:border-[#007AFF]/40 hover:shadow-md active:scale-[0.99]"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Apple Pro Button with System variants
export function AppleButton({
  children,
  variant = "primary", // primary | tinted | secondary | neutral | destructive | plain
  size = "md", // xs | sm | md | lg
  icon: Icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  onClick,
  ...props
}) {
  const sizeClasses = {
    xs: "px-2.5 py-1 text-xs rounded-lg gap-1.5",
    sm: "px-3 py-1.5 text-xs rounded-[10px] gap-1.5 font-medium",
    md: "px-4 py-2 text-xs sm:text-sm rounded-[10px] gap-2 font-semibold",
    lg: "px-5 py-2.5 text-sm rounded-xl gap-2.5 font-semibold",
  };

  const variantClasses = {
    primary:
      "bg-[#007AFF] text-white hover:bg-[#0062CC] active:scale-[0.98] shadow-xs dark:shadow-none disabled:opacity-50",
    tinted:
      "bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 dark:bg-[#007AFF]/20 dark:text-[#3898FF] active:scale-[0.98] disabled:opacity-50",
    secondary:
      "bg-slate-100 text-slate-800 hover:bg-slate-200/80 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.12] active:scale-[0.98] disabled:opacity-50",
    neutral:
      "border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/[0.1] dark:bg-[#1C1C1E] dark:text-slate-200 dark:hover:bg-white/[0.06] active:scale-[0.98] disabled:opacity-50 shadow-2xs",
    destructive:
      "bg-[#FF3B30] text-white hover:bg-[#D70015] active:scale-[0.98] shadow-xs disabled:opacity-50",
    plain:
      "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-black/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 active:scale-[0.98] disabled:opacity-50",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center transition-all duration-150 select-none ${
        sizeClasses[size] || sizeClasses.md
      } ${variantClasses[variant] || variantClasses.primary} ${
        disabled || loading ? "pointer-events-none opacity-50" : "cursor-pointer"
      } ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon && iconPosition === "left" ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
      {!loading && Icon && iconPosition === "right" && (
        <Icon className="w-4 h-4 shrink-0" />
      )}
    </button>
  );
}

// Backwards-compatible Button alias
export const Button = AppleButton;

// Apple Segmented Capsule Control
export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  className = "",
}) {
  const sizeClasses = {
    sm: "p-0.5 text-xs rounded-lg gap-0.5",
    md: "p-1 text-xs rounded-xl gap-1",
    lg: "p-1.5 text-sm rounded-xl gap-1.5",
  };

  const itemSizeClasses = {
    sm: "px-2.5 py-1 rounded-[6px]",
    md: "px-3.5 py-1.5 rounded-[9px]",
    lg: "px-4 py-2 rounded-[9px]",
  };

  return (
    <div
      role="tablist"
      className={`inline-flex items-center bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
    >
      {options.map((option) => {
        const isSelected = value === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.id)}
            className={`flex items-center gap-1.5 font-medium transition-all duration-150 select-none ${
              itemSizeClasses[size] || itemSizeClasses.md
            } ${
              isSelected
                ? "bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? "bg-[#007AFF]/15 text-[#007AFF] dark:bg-[#007AFF]/25 dark:text-[#3898FF]"
                    : "bg-slate-200/80 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400"
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// KPI Card matching Apple Pro styling with full dark mode & tabular numbers
export function KpiCard({
  icon: Icon,
  iconBg = "bg-blue-50 dark:bg-blue-950/40",
  iconColor = "text-[#007AFF] dark:text-[#3898FF]",
  label,
  value,
  subtext,
  badgeText,
  badgeType = "success", // success | warning | danger | info | neutral | purple
  toggle, // { checked, onChange }
  onClick,
}) {
  const badgeColors = {
    success:
      "text-emerald-700 bg-emerald-50 border border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50",
    warning:
      "text-amber-700 bg-amber-50 border border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50",
    danger:
      "text-rose-700 bg-rose-50 border border-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50",
    info:
      "text-[#007AFF] bg-blue-50 border border-blue-200/70 dark:bg-blue-950/50 dark:text-[#3898FF] dark:border-blue-800/50",
    purple:
      "text-purple-700 bg-purple-50 border border-purple-200/70 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/50",
    neutral:
      "text-slate-600 bg-slate-100 border border-slate-200/70 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/[0.1]",
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#1C1C1E] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-xs flex items-start justify-between min-w-0 transition-all duration-200 hover:shadow-md hover:border-[#007AFF]/40 dark:hover:border-[#007AFF]/40 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${iconBg} ${iconColor}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {label}
          </p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
              {value}
            </span>
            {badgeText && (
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  badgeColors[badgeType] || badgeColors.neutral
                }`}
              >
                {badgeText}
              </span>
            )}
          </div>
          {subtext && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 truncate">
              {subtext}
            </p>
          )}
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

// Status pill with Apple-inspired system dot indicator
export function StatusPill({ status, label }) {
  const normalized = String(status || "").toUpperCase();
  const configs = {
    ACTIVE: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      defaultLabel: "Active",
    },
    IN_STOCK: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      defaultLabel: "In Stock",
    },
    OPEN: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      defaultLabel: "Open",
    },
    PAID: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      defaultLabel: "Paid",
    },
    COMPLETED: {
      bg: "bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40",
      text: "text-[#007AFF] dark:text-[#3898FF]",
      dot: "bg-[#007AFF] dark:bg-[#3898FF]",
      defaultLabel: "Completed",
    },
    READY: {
      bg: "bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40",
      text: "text-[#007AFF] dark:text-[#3898FF]",
      dot: "bg-[#007AFF] dark:bg-[#3898FF]",
      defaultLabel: "Ready",
    },
    ACCEPTED: {
      bg: "bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40",
      text: "text-sky-700 dark:text-sky-300",
      dot: "bg-sky-500 dark:bg-sky-400",
      defaultLabel: "Accepted",
    },
    PREPARING: {
      bg: "bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40",
      text: "text-purple-700 dark:text-purple-300",
      dot: "bg-purple-500 dark:bg-purple-400",
      defaultLabel: "Preparing",
    },
    PENDING: {
      bg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500 dark:bg-amber-400",
      defaultLabel: "Pending",
    },
    LOW_STOCK: {
      bg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500 dark:bg-amber-400",
      defaultLabel: "Low Stock",
    },
    ON_LEAVE: {
      bg: "bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08]",
      text: "text-slate-600 dark:text-slate-300",
      dot: "bg-slate-400 dark:bg-slate-500",
      defaultLabel: "On Leave",
    },
    INACTIVE: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500 dark:bg-rose-400",
      defaultLabel: "Inactive",
    },
    OUT_OF_STOCK: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500 dark:bg-rose-400",
      defaultLabel: "Out of Stock",
    },
    CANCELLED: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500 dark:bg-rose-400",
      defaultLabel: "Cancelled",
    },
    FAILED: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500 dark:bg-rose-400",
      defaultLabel: "Failed",
    },
  };

  const config =
    configs[normalized] || {
      bg: "bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08]",
      text: "text-slate-600 dark:text-slate-300",
      dot: "bg-slate-400 dark:bg-slate-500",
      defaultLabel: status,
    };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {label || config.defaultLabel}
    </span>
  );
}

// Backwards compatibility alias for StatusBadge
export function StatusBadge({ status, label }) {
  return <StatusPill status={status} label={label} />;
}

// Search bar input matching Apple Pro styling
export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  onClear,
}) {
  return (
    <div className={`relative flex items-center min-w-[240px] ${className}`}>
      <SearchIcon className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-100/80 dark:bg-white/[0.06] text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-[#1C1C1E] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition shadow-2xs"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Tab navigation row matching Apple Pro tab bar
export function TabGroup({ tabs, activeTab, onChange, className = "" }) {
  return (
    <div
      className={`flex items-center gap-1 border-b border-slate-200/80 dark:border-white/[0.08] overflow-x-auto no-scrollbar ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`pb-3 px-3.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px flex items-center gap-2 ${
              isActive
                ? "border-[#007AFF] text-[#007AFF] dark:text-[#3898FF]"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-[#007AFF]/15 text-[#007AFF] dark:bg-[#007AFF]/25 dark:text-[#3898FF]"
                    : "bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Table Pagination Bar matching Apple Pro styling
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
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1C1C1E] border-t border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
      <span className="tabular-nums">
        Showing {start} to {end} of {totalItems} items
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-800 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .slice(0, 5)
          .map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold tabular-nums transition ${
                page === currentPage
                  ? "bg-[#007AFF] text-white shadow-xs"
                  : "border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08]"
              }`}
            >
              {page}
            </button>
          ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-800 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Reusable Page Header matching Apple Pro visual hierarchy
export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// Section Header inside cards
export function SectionHeading({ title, detail, action }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        {detail && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {detail}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Apple Spinner loader
export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <div className="w-7 h-7 border-2 border-slate-200 dark:border-white/20 border-t-[#007AFF] rounded-full animate-spin" />
      {label && <p className="text-xs font-medium">{label}</p>}
    </div>
  );
}

// Skeleton loader
export function LoadingSkeleton({ className = "h-4 w-full", count = 1 }) {
  return (
    <div className="space-y-2.5 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-slate-200/70 dark:bg-white/[0.08] rounded-xl animate-pulse ${className}`}
        />
      ))}
    </div>
  );
}

// Empty state view
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-[#3898FF] flex items-center justify-center mb-3 shadow-2xs">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Error banner
export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 font-bold">⚠️</span>
        <span className="truncate">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-rose-700 dark:text-rose-300 font-bold ml-2 hover:opacity-75 transition"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Stat Card
export function StatCard({ label, value, detail, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#1C1C1E] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-xs relative overflow-hidden transition-all duration-200 hover:border-[#007AFF]/40 dark:hover:border-[#007AFF]/40 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums tracking-tight">
        {value}
      </p>
      {detail && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
          {detail}
        </p>
      )}
    </div>
  );
}

// Apple Frosted Modal / Dialog
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-lg",
  showClose = true,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Frosted Glass Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md transition-opacity"
      />
      {/* Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/[0.1] rounded-2xl shadow-2xl p-6 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition"
            >
              ✕
            </button>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
