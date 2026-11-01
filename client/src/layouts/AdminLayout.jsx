import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { joinRestaurantRoom } from "../sockets/socket";
import { LanguageSwitcher, useTranslation } from "../i18n.jsx";
import {
  ChefHatIcon,
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
  { to: "/admin", label: "Overview", icon: OverviewIcon, end: true, permission: ["orders.view", "analytics.view", "tables.view"] },
  { to: "/admin/orders", label: "Orders", icon: OrdersIcon, badgeKey: "orders", permission: "orders.view" },
  { to: "/admin/tables", label: "Tables", icon: TablesIcon, permission: "tables.view" },
  { to: "/admin/menu", label: "Menu", icon: MenuIcon, permission: "menu.view" },
  { to: "/admin/coupons", label: "Promotions", icon: PromotionsIcon, adminOnly: true, permission: "coupons.view" },
  { to: "/admin/reports", label: "Analytics", icon: AnalyticsIcon, permission: "analytics.view" },
  { to: "/admin/orders?tab=customers", label: "Customers", icon: CustomersIcon, permission: "orders.view" },
  { to: "/admin/staff", label: "Staff", icon: StaffIcon, adminOnly: true, permission: "staff.view" },
  { to: "/admin/inventory", label: "Inventory", icon: InventoryIcon, permission: "inventory.view" },
  { to: "/admin/integrations", label: "Payments", icon: PaymentsIcon, permission: "orders.view" },
  { to: "/admin/reports", label: "Reports", icon: ReportsIcon, permission: "analytics.view" },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon, adminOnly: true, permission: "settings.view" },
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
        <div className="flex h-16 items-center px-5 gap-3 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#087F73] flex items-center justify-center text-white shrink-0 shadow-sm">
            <ChefHatIcon className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-white tracking-wide leading-tight">Svaadya</h1>
              <p className="text-[9px] uppercase tracking-wider text-[#A3C7C2] font-semibold">Restaurant Management</p>
            </div>
          )}
          <button
            type="button"
            className="ml-auto text-white/60 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 no-scrollbar">
          {availableNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.badgeKey === "orders" && (
                  <span className="ml-auto nav-badge-count">{activeOrderCount}</span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Section with Restaurant info & User profile */}
        <div className="p-3 border-t border-white/10 shrink-0 space-y-2">
          {!collapsed && (
            <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 text-xs font-bold">
                🍽️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{restaurantName}</p>
                <p className="text-[10px] text-[#A3C7C2]">Restaurant</p>
              </div>
              <ChevronRightIcon className="w-3.5 h-3.5 text-white/50" />
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={() => navigate("/admin/login")}
              className="text-[11px] text-[#A3C7C2] hover:text-white px-2 py-1 flex items-center justify-between w-full transition"
            >
              <span>Switch Restaurant</span>
              <span className="text-xs">›</span>
            </button>
          )}

          {/* User Profile Row */}
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition">
            <div className="w-8 h-8 rounded-full bg-[#087F73] text-white flex items-center justify-center text-xs font-bold shrink-0 border border-white/20">
              {user?.name?.[0]?.toUpperCase() || "S"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.name || "Admin User"}</p>
                <p className="text-[10px] text-[#A3C7C2] capitalize">{user?.roleName || (user?.role === "ADMIN" ? "Owner" : "Staff")}</p>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#A3C7C2] hover:text-white hover:bg-white/[0.08] transition ${
              collapsed ? "justify-center" : ""
            }`}
            title="Logout"
          >
            <LogOutIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Top Navigation Bar matching reference screenshot */}
        <header className="admin-topbar sticky top-0 z-20">
          {/* Left: Mobile hamburger + Restaurant selector pill */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="w-8 h-8 rounded-lg border border-[#E5ECE9] flex items-center justify-center lg:hidden text-[#172B2A]"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>

            {/* Restaurant Selector & Status Pill */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E5ECE9] bg-white text-xs font-semibold text-[#172B2A] shadow-xs">
                <span className="text-sm">🍃</span>
                <span className="truncate max-w-[160px] sm:max-w-[220px]">{restaurantName}</span>
                <button
                  type="button"
                  onClick={toggleOpenStatus}
                  className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition flex items-center gap-1 ${
                    isOpen ? "bg-[#EAF7EE] text-[#269B67]" : "bg-[#FDECEC] text-[#D95359]"
                  }`}
                  title="Click to toggle restaurant status"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-[#269B67]" : "bg-[#D95359]"}`} />
                  {isOpen ? "Open" : "Closed"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Controls: Date Range, Notifications, Language, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Date Range Selector Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5ECE9] bg-white text-xs font-medium text-[#788582] shadow-xs">
              <CalendarIcon className="w-3.5 h-3.5 text-[#087F73]" />
              <span>Oct 16, 2026 - Oct 22, 2026</span>
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative w-8 h-8 rounded-full border border-[#E5ECE9] bg-white flex items-center justify-center text-[#788582] hover:text-[#172B2A] hover:border-slate-300 transition"
            >
              <BellIcon className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D95359] text-white text-[9px] font-bold flex items-center justify-center">
                3
              </span>
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher className="admin-language-switcher hidden sm:block" />

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-[#E5ECE9]">
              <div className="w-8 h-8 rounded-full bg-[#004C46] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {user?.name?.[0]?.toUpperCase() || "S"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-[#172B2A] leading-tight truncate max-w-[100px]">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-[#788582] capitalize">{user?.roleName || (user?.role === "ADMIN" ? "Owner" : "Staff")}</p>
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
