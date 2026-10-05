import React from "react";

export function StatusBadge({ status }) {
  const styles = {
    PENDING: "bg-marigold/20 text-marigolddark",
    ACCEPTED: "bg-blue-100 text-blue-700",
    PREPARING: "bg-orange-100 text-orange-700",
    READY: "bg-sage/20 text-sage",
    COMPLETED: "bg-charcoal/10 text-charcoal/70",
    CANCELLED: "bg-red-100 text-red-700",
    PAID: "bg-sage/20 text-sage",
    FAILED: "bg-red-100 text-red-700",
    REFUNDED: "bg-charcoal/10 text-charcoal/70",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || "bg-charcoal/10"}`}>
      {status}
    </span>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-charcoal/50">
      <div className="w-8 h-8 border-2 border-charcoal/15 border-t-clove rounded-full animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="text-center py-16">
      <p className="font-display text-xl mb-1">{title}</p>
      {subtitle && <p className="text-sm text-charcoal/50">{subtitle}</p>}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
      {message}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, detail, accent = "teal" }) {
  return (
    <div className="stat-card">
      <div className={`stat-accent stat-accent-${accent}`} />
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {detail && <p className="stat-detail">{detail}</p>}
    </div>
  );
}

export function SectionHeading({ title, detail, action }) {
  return (
    <div className="section-heading">
      <div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>
      {action}
    </div>
  );
}
