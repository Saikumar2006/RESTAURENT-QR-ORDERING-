import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { useTheme, AppleThemeToggle } from "../store/ThemeContext.jsx";
import { joinRestaurantRoom, getSocket } from "../sockets/socket";
import { GlobalLanguageSelector, LanguageSwitcher, useTranslation } from "../i18n.jsx";
import AiAssistantPanel from "../components/ai/AiAssistantPanel.jsx";
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
  const [activeOrderCount, setActiveOrderCount] = useState(0);

  // Fetch restaurant details for name and status, and active orders count
  useEffect(() => {
    if (!user?.restaurantId) return;
    api.get(`/restaurants/${user.restaurantId}`)
      .then((res) => setRestaurantData(res))
      .catch(() => {});

    function fetchActiveCount() {
      api.get(`/restaurants/${user.restaurantId}/orders`, { params: { pageSize: 50 } })
        .then((orders) => {
          if (Array.isArray(orders)) {
            const count = orders.filter((o) => ["PENDING", "ACCEPTED", "PREPARING"].includes(o.status)).length;
            setActiveOrderCount(count);
          }
        })
        .catch(() => {});
    }

    fetchActiveCount();
    const socket = getSocket();
    socket.on("order:new", fetchActiveCount);
    socket.on("order:updated", fetchActiveCount);
    return () => {
      socket.off("order:new", fetchActiveCount);
      socket.off("order:updated", fetchActiveCount);
    };
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
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)] flex transition-colors duration-200">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
        />
      )}

      {/* Left Sidebar - Enterprise Deep Teal navigation shell */}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 w-[260px]" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-[78px]" : "lg:w-[240px]"}`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center px-4 gap-2 border-b border-white/10 shrink-0">
          <SvaadyaLogo variant="sidebar" size={collapsed ? "compact" : "default"} />
          <button
            type="button"
            className="ml-auto text-teal-200/70 hover:text-white lg:hidden p-1 rounded"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 no-scrollbar">
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
                {!collapsed && item.badgeKey === "orders" && activeOrderCount > 0 && (
                  <span className="ms-auto nav-badge-count tabular-nums">{activeOrderCount}</span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Section with Restaurant info & User profile */}
        <div className="p-3 border-t border-white/10 shrink-0 space-y-2">
          {!collapsed && (
            <div className="p-2.5 rounded-md bg-black/20 border border-white/10 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-white/10 text-white flex items-center justify-center shrink-0 text-xs font-semibold">
                <ChefHatIcon className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{restaurantName}</p>
                <p className="text-[10px] text-teal-200/70">{t("workspace")}</p>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-teal-200/50" />
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={() => navigate("/admin/login")}
              className="text-[11px] text-teal-200/70 hover:text-white px-2 py-1 flex items-center justify-between w-full transition"
            >
              <span>{t("switchRestaurant")}</span>
              <span className="text-xs">›</span>
            </button>
          )}

          {/* User Profile Row */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/5 transition">
            <div className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center text-xs font-semibold border border-white/10 shrink-0">
              {user?.name?.[0]?.toUpperCase() || "S"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.name || "Admin User"}</p>
                <p className="text-[10px] text-teal-200/70 capitalize">{user?.roleName || (user?.role === "ADMIN" ? "Owner" : "Staff")}</p>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-teal-200/80 hover:text-rose-300 hover:bg-rose-500/10 transition ${
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
        <header className="admin-topbar">
          {/* Left: Mobile hamburger + Restaurant selector pill */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="w-8 h-8 rounded-md border border-[var(--border)] flex items-center justify-center lg:hidden text-[var(--text-primary)] bg-[var(--surface)]"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Restaurant Selector & Status Pill */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text-primary)]">
                <span className="truncate max-w-[160px] sm:max-w-[220px] font-semibold">{restaurantName}</span>
                <button
                  type="button"
                  onClick={toggleOpenStatus}
                  className={`ml-1 px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                    isOpen
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  }`}
                  title={`${t("open")} / ${t("closed")}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-600" : "bg-rose-600"}`} />
                  {isOpen ? t("open") : t("closed")}
                </button>
              </div>
            </div>
          </div>

          {/* Right Controls: Date Range, Notifications, AppleThemeToggle, Language, Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Date Range Selector Pill */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-secondary)]">
              <CalendarIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="tabular-nums font-mono text-[11px]">Today</span>
            </div>

            {/* Notification Bell (No fake notification badge) */}
            <button
              type="button"
              aria-label="Notifications"
              className="w-8 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              <BellIcon className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <AppleThemeToggle />

            {/* Global Language Selector */}
            <GlobalLanguageSelector className="admin-language-switcher" />

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2 ps-2 border-s border-[var(--border)]">
              <div className="w-7 h-7 rounded-full bg-[#0F4C45] text-white flex items-center justify-center text-xs font-semibold shadow-xs">
                {user?.name?.[0]?.toUpperCase() || "S"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight truncate max-w-[120px]">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-[var(--text-muted)] capitalize">{user?.roleName || (user?.role === "ADMIN" ? "Owner" : "Staff")}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Svaadya Enterprise Restaurant AI Assistant */}
      <AiAssistantPanel scope="RESTAURANT" />
    </div>
  );
}
