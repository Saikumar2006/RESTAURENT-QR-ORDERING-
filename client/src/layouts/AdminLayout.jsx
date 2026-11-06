import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { joinRestaurantRoom } from "../sockets/socket";
import { GlobalLanguageSelector, LanguageSwitcher, useTranslation } from "../i18n.jsx";
import {
  ChefHatIcon,
  SvaadyaLogo,
  OverviewIcon,
  OrdersIcon,
  TablesIcon,
  MenuIcon,
  PromotionsIcon,
  AnalyticsIcon,
  CustomersIcon,
  StaffIcon,
  InventoryIcon,
  PaymentsIcon,
  ReportsIcon,
  SettingsIcon,
  LogOutIcon,
  BellIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "../components/UiIcons.jsx";
import api from "../services/api";

const NAV_ITEMS = [
  { to: "/admin", label: "Overview", translation: "overview", icon: OverviewIcon, end: true, permission: ["orders.view", "analytics.view", "tables.view"] },
  { to: "/admin/orders", label: "Orders", translation: "orders", icon: OrdersIcon, badgeKey: "orders", permission: "orders.view" },
  { to: "/admin/tables", label: "Tables", translation: "tables", icon: TablesIcon, permission: "tables.view" },
  { to: "/admin/menu", label: "Menu", translation: "menu", icon: MenuIcon, permission: "menu.view" },
  { to: "/admin/coupons", label: "Promotions", translation: "promotions", icon: PromotionsIcon, adminOnly: true, permission: "coupons.view" },
  { to: "/admin/reports", label: "Analytics", translation: "analytics", icon: AnalyticsIcon, permission: "analytics.view" },
  { to: "/admin/customers", label: "Customers", translation: "customers", icon: CustomersIcon, permission: "orders.view" },
  { to: "/admin/staff", label: "Staff", translation: "team", icon: StaffIcon, adminOnly: true, permission: "staff.view" },
  { to: "/admin/inventory", label: "Inventory", translation: "inventory", icon: InventoryIcon, permission: "inventory.view" },
  { to: "/admin/payments", label: "Payments", translation: "payments", icon: PaymentsIcon, permission: "analytics.view" },
  { to: "/admin/reports", label: "Reports", translation: "reports", icon: ReportsIcon, permission: "analytics.view" },
  { to: "/admin/settings", label: "Settings", translation: "settings", icon: SettingsIcon, adminOnly: true, permission: "settings.view" },
];

function canAccessNav(item, permissions = []) {
  if (!item.permission || permissions.includes("*")) return true;
  return Array.isArray(item.permission)
    ? item.permission.every((perm) => permissions.includes(perm))
    : permissions.includes(item.permission);
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [restaurantData, setRestaurantData] = useState(null);
  const [activeOrderCount, setActiveOrderCount] = useState(12); // visual badge or live count

  // Fetch restaurant details for name and status
  useEffect(() => {
    if (user?.restaurantId) {
      api.get(`/restaurants/${user.restaurantId}`)
        .then((res) => setRestaurantData(res))
        .catch(() => {});
    }
  }, [user?.restaurantId]);

  useEffect(() => {
    const token = localStorage.getItem("qr_ordering_token");
    if (token) joinRestaurantRoom(token);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  // Filter visible nav items by user permissions
  const availableNav = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || user?.role === "ADMIN" || user?.isOwner) && canAccessNav(item, user?.permissions)
  );

  const restaurantName = restaurantData?.name || user?.restaurantName || "Spice Garden Restaurant";
  const isOpen = restaurantData?.isOpen ?? true;

  // Toggle restaurant open status directly from header
  async function toggleOpenStatus() {
    if (!user?.restaurantId || (!user?.isOwner && user?.role !== "ADMIN")) return;
    try {
      const updated = await api.put(`/restaurants/${user.restaurantId}`, { isOpen: !isOpen });
      setRestaurantData(updated);
    } catch (err) {
      console.error("Failed to toggle open status", err);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F8F7] text-[#172B2A] flex">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
        />
      )}

      {/* Left Sidebar matching exact reference screenshot */}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 w-[260px]" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-[78px]" : "lg:w-[240px]"}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center px-4 gap-2 border-b border-white/10 shrink-0">
          <SvaadyaLogo variant="sidebar" size={collapsed ? "compact" : "default"} />
          <button
            type="button"
            className="ml-auto text-white/60 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 no-scrollbar">
          {availableNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                title={collapsed ? t(item.translation) : undefined}
                className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{t(item.translation)}</span>}
                {!collapsed && item.badgeKey === "orders" && (
                  <span className="ms-auto nav-badge-count">{activeOrderCount}</span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Section with Restaurant info & User profile */}
        <div className="p-3 border-t border-white/10 shrink-0 space-y-2">
          {!collapsed && (
            <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 text-xs font-bold">
                🍽️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{restaurantName}</p>
                <p className="text-[10px] text-indigo-300">{t("workspace")}</p>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-white/50" />
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={() => navigate("/admin/login")}
              className="text-[11px] text-indigo-200 hover:text-white px-2 py-1 flex items-center justify-between w-full transition"
            >
              <span>{t("switchRestaurant")}</span>
              <span className="text-xs">›</span>
            </button>
          )}

          {/* User Profile Row */}
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0 border border-white/20 shadow-xs">
              {user?.name?.[0]?.toUpperCase() || "S"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.name || "Admin User"}</p>
                <p className="text-[10px] text-indigo-200 capitalize">{user?.roleName || (user?.role === "ADMIN" ? "Owner" : "Staff")}</p>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.08] transition ${
              collapsed ? "justify-center" : ""
            }`}
            title={t("signOut")}
          >
            <LogOutIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{t("signOut")}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Top Navigation Bar */}
        <header className="admin-topbar sticky top-0 z-20">
          {/* Left: Mobile hamburger + Restaurant selector pill */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center lg:hidden text-slate-800"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>

            {/* Restaurant Selector & Status Pill */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs">
                <span className="text-sm">🍃</span>
                <span className="truncate max-w-[160px] sm:max-w-[220px]">{restaurantName}</span>
                <button
                  type="button"
                  onClick={toggleOpenStatus}
                  className={`ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition flex items-center gap-1.5 ${
                    isOpen ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                  title={`${t("open")} / ${t("closed")}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {isOpen ? t("open") : t("closed")}
                </button>
              </div>
            </div>
          </div>

          {/* Right Controls: Date Range, Notifications, Language, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Date Range Selector Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 shadow-2xs">
              <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Oct 16, 2026 - Oct 22, 2026</span>
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition"
            >
              <BellIcon className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                3
              </span>
            </button>

            {/* Global Language Selector */}
            <GlobalLanguageSelector className="admin-language-switcher" />

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2.5 ps-2 border-s border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {user?.name?.[0]?.toUpperCase() || "S"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[100px]">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-slate-500 capitalize">{user?.roleName || (user?.role === "ADMIN" ? "Owner" : "Staff")}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
