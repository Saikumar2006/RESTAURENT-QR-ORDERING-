import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, KpiCard, TabGroup, SearchBar } from "../../components/Ui.jsx";
import { AnalyticsIcon, UsersIcon, OrdersIcon } from "../../components/UiIcons.jsx";

export default function AdminModuleView({
  title = "Module",
  description = "Module overview and management.",
  icon = null,
  stats = [],
  tabs = [],
  children,
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "overview");
  const [search, setSearch] = useState("");

  const defaultTabs = tabs.length > 0 ? tabs : [
    { id: "overview", label: "Overview & Analytics" },
    { id: "activity", label: "Recent Records" },
    { id: "settings", label: "Preferences" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/admin/orders"
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <span>View Live Orders</span>
            </Link>
            <Link
              to="/admin/reports"
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>Analytics & Reports</span>
            </Link>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, idx) => (
            <div
              key={idx}
              className="card p-5 hover:shadow-md transition space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{s.label}</span>
                <span className="w-7 h-7 rounded-lg bg-teal-50 text-[#0F4C45] flex items-center justify-center text-xs font-bold">
                  {idx === 0 ? <AnalyticsIcon className="w-4 h-4" /> : idx === 1 ? <OrdersIcon className="w-4 h-4" /> : <UsersIcon className="w-4 h-4" />}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
              {s.change && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 pt-0.5">
                  <span>↗</span>
                  <span>{s.change}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Workspace Card */}
      <div className="card overflow-hidden">
        {/* Module Tab Switcher */}
        <div className="px-5 pt-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <TabGroup tabs={defaultTabs} activeTab={activeTab} onChange={setActiveTab} />
          <div className="pb-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={`Filter ${title.toLowerCase()}...`}
              className="w-56 text-xs"
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {children || (
            <div className="text-center py-12 px-4 max-w-lg mx-auto space-y-4">
              <div className="w-14 h-14 rounded-xl bg-teal-50 text-[#0F4C45] flex items-center justify-center mx-auto border border-teal-100">
                {icon || <AnalyticsIcon className="w-7 h-7" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {title} Workspace Active
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Real-time synchronization enabled. All records and transactions are securely partitioned by your restaurant workspace.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  to="/admin"
                  className="btn-secondary text-xs"
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/orders"
                  className="btn-primary text-xs"
                >
                  Explore Live Orders
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
