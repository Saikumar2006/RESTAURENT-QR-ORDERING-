import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import PlatformProtectedRoute from "./routes/PlatformProtectedRoute.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const CustomerSiteLayout = lazy(() => import("./layouts/CustomerSiteLayout.jsx"));
const RestaurantLanding = lazy(() => import("./pages/customer/RestaurantLanding.jsx"));
const CustomerMenu = lazy(() => import("./pages/customer/CustomerMenu.jsx"));
const Cart = lazy(() => import("./pages/customer/Cart.jsx"));
const Payment = lazy(() => import("./pages/customer/Payment.jsx"));
const OrderTracking = lazy(() => import("./pages/customer/OrderTracking.jsx"));
const OrderHistory = lazy(() => import("./pages/customer/OrderHistory.jsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.jsx"));
const AdminRegister = lazy(() => import("./pages/admin/AdminRegister.jsx"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders.jsx"));
const AdminIntegrations = lazy(() => import("./pages/admin/AdminIntegrations.jsx"));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu.jsx"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory.jsx"));
const AdminTables = lazy(() => import("./pages/admin/AdminTables.jsx"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff.jsx"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports.jsx"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons.jsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.jsx"));
const AdminAppearance = lazy(() => import("./pages/admin/AdminAppearance.jsx"));
const AdminSubscription = lazy(() => import("./pages/admin/AdminSubscription.jsx"));
const StaffAccess = lazy(() => import("./pages/admin/StaffAccess.jsx"));
const PlatformLogin = lazy(() => import("./pages/platform/PlatformLogin.jsx"));
const PlatformDashboard = lazy(() => import("./pages/platform/PlatformDashboard.jsx"));
const PlatformAccess = lazy(() => import("./pages/platform/PlatformAccess.jsx"));
const ActivateAccount = lazy(() => import("./pages/platform/ActivateAccount.jsx"));
const PricingPage = lazy(() => import("./pages/PublicPages.jsx").then((module) => ({ default: module.PricingPage })));
const OnboardingPage = lazy(() => import("./pages/PublicPages.jsx").then((module) => ({ default: module.OnboardingPage })));
const OnboardingResultPage = lazy(() => import("./pages/PublicPages.jsx").then((module) => ({ default: module.OnboardingResultPage })));
const AboutPage = lazy(() => import("./pages/PublicPages.jsx").then((module) => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import("./pages/PublicPages.jsx").then((module) => ({ default: module.ContactPage })));
const LegalPage = lazy(() => import("./pages/PublicPages.jsx").then((module) => ({ default: module.LegalPage })));

export default function App() {
  return (
    <Suspense fallback={<main role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-[#f4f6f3] text-sm text-[#64716b]">Loading Svaadya…</main>}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/onboarding/:planKey" element={<OnboardingPage />} />
      <Route path="/onboarding/result" element={<OnboardingResultPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/activate-account/:token" element={<ActivateAccount />} />
      <Route path="/staff-access/:token" element={<StaffAccess />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />

      {/* Customer flow — public, driven by ONE QR per restaurant. The
          customer picks a dine-in table or takeaway on the landing page. */}
      <Route path="/r/:slug" element={<CustomerSiteLayout />}>
        <Route index element={<RestaurantLanding />} />
        <Route path="menu" element={<CustomerMenu />} />
        <Route path="cart" element={<Cart />} />
        <Route path="pay" element={<Payment />} />
        <Route path="confirmation" element={<OrderTracking />} />
        <Route path="order/:orderId" element={<OrderTracking />} />
        <Route path="orders" element={<OrderHistory />} />
      </Route>

      {/* Admin/staff flow */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/register" element={<AdminRegister />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProtectedRoute allPermissions={["orders.view", "analytics.view", "tables.view"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="dashboard" element={<ProtectedRoute allPermissions={["orders.view", "analytics.view", "tables.view"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute permissions={["orders.view"]}><AdminOrders /></ProtectedRoute>} />
        <Route path="integrations" element={<ProtectedRoute permissions={["orders.view"]}><AdminIntegrations /></ProtectedRoute>} />
        <Route path="menu" element={<ProtectedRoute permissions={["menu.view"]}><AdminMenu /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute permissions={["inventory.view"]}><AdminInventory /></ProtectedRoute>} />
        <Route path="tables" element={<ProtectedRoute permissions={["tables.view"]}><AdminTables /></ProtectedRoute>} />
        <Route path="staff" element={<ProtectedRoute permissions={["staff.view"]}><AdminStaff /></ProtectedRoute>} />
        <Route path="coupons" element={<ProtectedRoute permissions={["coupons.view"]}><AdminCoupons /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute permissions={["settings.view"]}><AdminSettings /></ProtectedRoute>} />
        <Route path="appearance" element={<ProtectedRoute permissions={["settings.view"]}><AdminAppearance /></ProtectedRoute>} />
        <Route path="billing" element={<ProtectedRoute roles={["ADMIN"]}><AdminSubscription /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute permissions={["analytics.view"]}><AdminReports /></ProtectedRoute>} />
      </Route>

      {/* Platform owner flow — cross-restaurant dashboard. Fully separate
          auth from the restaurant admin flow above; intentionally not
          linked from anywhere else in the app. */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/super-admin/login" element={<PlatformLogin />} />
      <Route
        path="/platform/dashboard"
        element={
          <PlatformProtectedRoute>
            <PlatformDashboard />
          </PlatformProtectedRoute>
        }
      />
      <Route path="/platform/access" element={<PlatformProtectedRoute><PlatformAccess /></PlatformProtectedRoute>} />
      <Route
        path="/super-admin/dashboard"
        element={
          <PlatformProtectedRoute>
            <PlatformDashboard />
          </PlatformProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="font-display text-2xl">Page not found</p>
    </div>
  );
}
