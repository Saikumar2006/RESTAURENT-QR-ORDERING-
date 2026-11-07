import React, { useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, AlertTriangleIcon } from "./UiIcons.jsx";

// Standard Enterprise SaaS Card Container
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
      className={`rounded-lg transition-all duration-150 ${
        elevated
          ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs"
      } ${
        interactive
          ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs active:translate-y-[1px]"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
export const Card = AppleCard;
export const RoyaleCard = AppleCard;

// Standard Enterprise SaaS Button
export function AppleButton({
  children,
  variant = "primary", // primary | secondary | tinted | neutral | destructive | plain | gold | purple | glass
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
    xs: "px-2.5 py-1 text-xs rounded gap-1.5",
    sm: "px-3 py-1.5 text-xs rounded-md gap-1.5 font-medium",
    md: "px-3.5 py-2 text-xs sm:text-sm rounded-md gap-2 font-medium",
    lg: "px-4 py-2.5 text-sm rounded-md gap-2 font-medium",
  };

  const variantClasses = {
    primary:
      "bg-[#0F4C45] text-white hover:bg-[#0D3E38] active:translate-y-[1px] shadow-xs disabled:opacity-50",
    gold:
      "bg-[#0F4C45] text-white hover:bg-[#0D3E38] active:translate-y-[1px] shadow-xs disabled:opacity-50",
    purple:
      "bg-[#0F4C45] text-white hover:bg-[#0D3E38] active:translate-y-[1px] shadow-xs disabled:opacity-50",
    secondary:
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:translate-y-[1px] shadow-xs disabled:opacity-50",
    neutral:
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:translate-y-[1px] shadow-xs disabled:opacity-50",
    glass:
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 active:translate-y-[1px] disabled:opacity-50",
    tinted:
      "bg-teal-50 dark:bg-teal-950/40 text-[#0F4C45] dark:text-[#67B5AA] border border-teal-200/70 dark:border-teal-800/50 hover:bg-teal-100/70 font-medium disabled:opacity-50",
    destructive:
      "bg-rose-600 text-white hover:bg-rose-700 active:translate-y-[1px] shadow-xs disabled:opacity-50",
    plain:
      "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center transition-all duration-120 select-none ${
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

export const Button = AppleButton;
export const RoyaleButton = AppleButton;

// Standard Enterprise Segmented Control
export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  className = "",
}) {
  const sizeClasses = {
    sm: "p-0.5 text-xs rounded-md gap-0.5",
    md: "p-1 text-xs rounded-md gap-1",
    lg: "p-1 text-sm rounded-md gap-1",
  };

  const itemSizeClasses = {
    sm: "px-2.5 py-1 rounded",
    md: "px-3 py-1.5 rounded",
    lg: "px-3.5 py-2 rounded",
  };

  return (
    <div
      role="tablist"
      className={`inline-flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${
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
            className={`flex items-center gap-1.5 font-medium transition-all duration-120 select-none ${
              itemSizeClasses[size] || itemSizeClasses.md
            } ${
              isSelected
                ? "bg-white dark:bg-slate-900 text-[#0F4C45] dark:text-[#67B5AA] border border-slate-200/80 dark:border-slate-700 shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? "bg-teal-100 text-[#0F4C45] dark:bg-teal-950 dark:text-[#67B5AA]"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
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

// Enterprise KPI Card with clean typography and no decorative clutter
export function KpiCard({
  icon: Icon,
  iconBg = "bg-teal-50 dark:bg-teal-950/40",
  iconColor = "text-[#0F4C45] dark:text-[#67B5AA]",
  label,
  value,
  subtext,
  badgeText,
  badgeType = "info", // info | success | warning | danger | neutral
  toggle,
  onClick,
}) {
  const badgeColors = {
    info:
      "text-[#0F4C45] bg-teal-50 border border-teal-200/70 dark:bg-teal-950/50 dark:text-[#67B5AA] dark:border-teal-800/50",
    gold:
      "text-[#0F4C45] bg-teal-50 border border-teal-200/70 dark:bg-teal-950/50 dark:text-[#67B5AA] dark:border-teal-800/50",
    purple:
      "text-[#0F4C45] bg-teal-50 border border-teal-200/70 dark:bg-teal-950/50 dark:text-[#67B5AA] dark:border-teal-800/50",
    success:
      "text-emerald-700 bg-emerald-50 border border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50",
    warning:
      "text-amber-700 bg-amber-50 border border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50",
    danger:
      "text-rose-700 bg-rose-50 border border-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50",
    neutral:
      "text-slate-600 bg-slate-100 border border-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex items-start justify-between min-w-0 transition-all duration-120 ${
        onClick ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700" : ""
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div
            className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-800 ${iconBg} ${iconColor}`}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {label}
          </p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {value}
            </span>
            {badgeText && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center ${
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

// Status pill with clean dot indicator and solid business styling
export function StatusPill({ status, label }) {
  const normalized = String(status || "").toUpperCase();
  const configs = {
    ACTIVE: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
      defaultLabel: "Active",
    },
    IN_STOCK: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
      defaultLabel: "In Stock",
    },
    OPEN: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
      defaultLabel: "Open",
    },
    PAID: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
      defaultLabel: "Paid",
    },
    COMPLETED: {
      bg: "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
      text: "text-slate-700 dark:text-slate-300",
      dot: "bg-slate-500",
      defaultLabel: "Completed",
    },
    READY: {
      bg: "bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/40",
      text: "text-[#0F4C45] dark:text-[#67B5AA]",
      dot: "bg-[#0F4C45]",
      defaultLabel: "Ready",
    },
    ACCEPTED: {
      bg: "bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40",
      text: "text-sky-700 dark:text-sky-300",
      dot: "bg-sky-500",
      defaultLabel: "Accepted",
    },
    PREPARING: {
      bg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40",
      text: "text-amber-800 dark:text-amber-300",
      dot: "bg-amber-500",
      defaultLabel: "Preparing",
    },
    PENDING: {
      bg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40",
      text: "text-amber-800 dark:text-amber-300",
      dot: "bg-amber-500",
      defaultLabel: "Pending",
    },
    LOW_STOCK: {
      bg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40",
      text: "text-amber-800 dark:text-amber-300",
      dot: "bg-amber-500",
      defaultLabel: "Low Stock",
    },
    ON_LEAVE: {
      bg: "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
      text: "text-slate-600 dark:text-slate-400",
      dot: "bg-slate-400",
      defaultLabel: "On Leave",
    },
    INACTIVE: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
      defaultLabel: "Inactive",
    },
    OUT_OF_STOCK: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
      defaultLabel: "Out of Stock",
    },
    CANCELLED: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
      defaultLabel: "Cancelled",
    },
    FAILED: {
      bg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
      defaultLabel: "Failed",
    },
  };

  const config =
    configs[normalized] || {
      bg: "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
      text: "text-slate-600 dark:text-slate-400",
      dot: "bg-slate-400",
      defaultLabel: status,
    };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {label || config.defaultLabel}
    </span>
  );
}

export function StatusBadge({ status, label }) {
  return <StatusPill status={status} label={label} />;
}

// Enterprise Search Input
export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  onClear,
}) {
  return (
    <div className={`relative flex items-center min-w-[220px] ${className}`}>
      <SearchIcon className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-7 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#0F4C45] focus:ring-1 focus:ring-[#0F4C45] transition"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 text-xs text-slate-400 hover:text-slate-600 transition"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Tab navigation row
export function TabGroup({ tabs, activeTab, onChange, className = "" }) {
  return (
    <div
      className={`flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`pb-2.5 px-3 text-xs font-medium whitespace-nowrap transition-all border-b-2 -mb-px flex items-center gap-2 ${
              isActive
                ? "border-[#0F4C45] text-[#0F4C45] dark:border-[#67B5AA] dark:text-[#67B5AA] font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  isActive
                    ? "bg-teal-50 text-[#0F4C45] dark:bg-teal-950 dark:text-[#67B5AA]"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
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

// Keyboard keycap
export function KeyCap({ children, className = "" }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 ${className}`}
    >
      {children}
    </kbd>
  );
}

// Enterprise Pagination Bar
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
    <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
      <span className="tabular-nums">
        Showing {start} to {end} of {totalItems} items
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
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
              className={`w-7 h-7 rounded text-xs tabular-nums transition ${
                page === currentPage
                  ? "bg-[#0F4C45] text-white font-semibold"
                  : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              {page}
            </button>
          ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Enterprise Page Header
export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// Section Header
export function SectionHeading({ title, detail, action }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        {detail && (
          <p className="text-xs text-slate-500 mt-0.5">
            {detail}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Enterprise Loading Spinner
export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-slate-500">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-[#0F4C45] rounded-full animate-spin" />
      {label && <p className="text-xs font-medium">{label}</p>}
    </div>
  );
}

// Skeleton Loader
export function LoadingSkeleton({ className = "h-4 w-full", count = 1 }) {
  return (
    <div className="space-y-2 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-slate-100 dark:bg-slate-800 rounded animate-pulse ${className}`}
        />
      ))}
    </div>
  );
}

// Empty State: clean, professional, ZERO emojis
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-10 px-4 flex flex-col items-center justify-center">
      {Icon && (
        <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mb-2.5">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

// Error Banner: clean, professional, NO emojis
export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs rounded-md px-3.5 py-2.5 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangleIcon className="w-4 h-4 shrink-0 text-rose-600" />
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
      className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs ${
        onClick ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700" : ""
      }`}
    >
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums tracking-tight">
        {value}
      </p>
      {detail && (
        <p className="text-[11px] text-slate-400 mt-0.5">
          {detail}
        </p>
      )}
    </div>
  );
}

// Enterprise Modal / Dialog: crisp 8px radius, clean 1px border, no floating blur gimmicks
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
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
      />
      {/* Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-5 z-10`}
      >
        <div className="flex items-start justify-between gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs"
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
