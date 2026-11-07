import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import {
  TabGroup,
  PageHeader,
  Spinner,
  ErrorBanner,
} from "../../components/Ui.jsx";
import {
  SettingsIcon,
  CheckIcon,
  MapPinIcon,
} from "../../components/UiIcons.jsx";


export default function AdminSettings() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(null);
  const [activeTab, setActiveTab] = useState("operations"); // "operations" | "taxes" | "ordering" | "notifications" | "gateways"
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [whatsappCheck, setWhatsappCheck] = useState(null);
  const [whatsappError, setWhatsappError] = useState(null);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);

  useEffect(() => {
    api.get(`/restaurants/${user.restaurantId}`).then((r) => {
      setRestaurant(r);
      setForm({
        name: r.name,
        cuisineType: r.cuisineType || "",
        taxPercent: String(r.taxPercent),
        serviceChargePercent: String(r.serviceChargePercent),
        discountPercent: String(r.discountPercent),
        discountEnabled: r.discountEnabled ?? false,
        searchEnabled: r.searchEnabled ?? true,
        isOpen: r.isOpen ?? true,
        autoScheduleEnabled: r.autoScheduleEnabled ?? false,
        openTime: r.openTime || "10:00",
        closeTime: r.closeTime || "23:00",
        timezone: r.timezone || "Asia/Kolkata",
        geofenceEnabled: r.geofenceEnabled ?? false,
        latitude: r.latitude != null ? String(r.latitude) : "",
        longitude: r.longitude != null ? String(r.longitude) : "",
        geofenceRadiusMeters: String(r.geofenceRadiusMeters ?? 200),
        phoneVerificationEnabled: r.phoneVerificationEnabled ?? false,
        orderNotificationsEnabled: r.orderNotificationsEnabled ?? true,
        notificationChannel: r.notificationChannel || "whatsapp",
      });
    });
  }, [user.restaurantId]);

  useEffect(() => {
    api.get("/payments/provider-status").then(setPaymentProvider).catch(() => setPaymentProvider(null));
    api.get(`/restaurants/${user.restaurantId}/integrations/whatsapp/status`)
      .then(setWhatsappStatus)
      .catch((err) => setWhatsappError(err.message));
  }, [user.restaurantId]);

  async function testWhatsAppConnection() {
    setCheckingWhatsapp(true);
    setWhatsappError(null);
    setWhatsappCheck(null);
    try {
      setWhatsappCheck(await api.post(`/restaurants/${user.restaurantId}/integrations/whatsapp/test`, {}));
    } catch (err) {
      setWhatsappError(err.message);
    } finally {
      setCheckingWhatsapp(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support geolocation.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: String(pos.coords.latitude.toFixed(6)),
          longitude: String(pos.coords.longitude.toFixed(6)),
        }));
        setLocating(false);
      },
      () => {
        setError("Could not retrieve current GPS coordinates. Check browser permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    if (form.geofenceEnabled && (form.latitude === "" || form.longitude === "")) {
      setError("Set GPS coordinates before enforcing in-restaurant only geofencing.");
      setSaving(false);
      return;
    }

    try {
      const updated = await api.put(`/restaurants/${user.restaurantId}`, {
        name: form.name,
        cuisineType: form.cuisineType || null,
        taxPercent: parseFloat(form.taxPercent) || 0,
        serviceChargePercent: parseFloat(form.serviceChargePercent) || 0,
        discountPercent: parseFloat(form.discountPercent) || 0,
        discountEnabled: form.discountEnabled,
        searchEnabled: form.searchEnabled,
        isOpen: form.isOpen,
        autoScheduleEnabled: form.autoScheduleEnabled,
        openTime: form.autoScheduleEnabled ? form.openTime : null,
        closeTime: form.autoScheduleEnabled ? form.closeTime : null,
        timezone: form.timezone,
        geofenceEnabled: form.geofenceEnabled,
        latitude: form.latitude === "" ? null : parseFloat(form.latitude),
        longitude: form.longitude === "" ? null : parseFloat(form.longitude),
        geofenceRadiusMeters: parseInt(form.geofenceRadiusMeters, 10) || 200,
        phoneVerificationEnabled: form.phoneVerificationEnabled,
        orderNotificationsEnabled: form.orderNotificationsEnabled,
        notificationChannel: form.notificationChannel,
      });
      setRestaurant(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <Spinner label="Loading restaurant settings..." />;

  const tabs = [
    { id: "operations", label: "Operations & Hours" },
    { id: "taxes", label: "Taxes & Service Charges" },
    { id: "ordering", label: "QR & In-Dining Geofence" },
    { id: "notifications", label: "WhatsApp & Alerts" },
    { id: "gateways", label: "Payment Gateways" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <PageHeader
        title="Restaurant Settings"
        description="Configure operational hours, taxes, kitchen notifications, and table geofencing."
        actions={
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <CheckIcon className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        }
      />

      {saved && (
        <div className="p-3.5 rounded-xl bg-[#EAF7EE] border border-[#269B67]/30 text-xs font-semibold text-[#269B67] flex items-center gap-2">
          <span>✓</span>
          <span>All restaurant configurations saved successfully!</span>
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Tabs */}
      <div className="card px-4 pt-3">
        <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* TAB 1: Operations & Business Hours */}
        {activeTab === "operations" && (
          <div className="card p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#172B2A] mb-1">Restaurant Service State</h3>
              <p className="text-xs text-[#788582]">Manage whether guests can place orders right now.</p>
            </div>

            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              form.isOpen ? "bg-[#EAF7EE]/50 border-[#269B67]/30" : "bg-[#FDECEC]/50 border-[#D95359]/30"
            }`}>
              <div>
                <p className="text-xs font-bold text-[#172B2A] flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${form.isOpen ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <span>{form.isOpen ? "Restaurant is Open" : "Restaurant is Closed"}</span>
                </p>
                <p className="text-[11px] text-[#788582] mt-0.5">
                  {form.isOpen
                    ? "Guests scanning table QR codes can explore the menu and place live orders."
                    : "Menu displays an 'Out of Service' message to visiting customers."}
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.isOpen}
                  onChange={(e) => setForm({ ...form, isOpen: e.target.checked })}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="border-t border-[#E5ECE9] pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#172B2A]">Auto-Close Outside Business Hours</p>
                  <p className="text-[11px] text-[#788582]">
                    Automatically disables customer ordering outside scheduled service times.
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.autoScheduleEnabled}
                    onChange={(e) => setForm({ ...form, autoScheduleEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {form.autoScheduleEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8FAF9] border border-[#E5ECE9]">
                  <div>
                    <label className="block text-xs font-semibold text-[#172B2A] mb-1">Opens At</label>
                    <input
                      type="time"
                      value={form.openTime}
                      onChange={(e) => setForm({ ...form, openTime: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172B2A] mb-1">Closes At</label>
                    <input
                      type="time"
                      value={form.closeTime}
                      onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#E5ECE9] pt-4 space-y-3">
              <h4 className="text-xs font-bold text-[#172B2A]">Restaurant Identity</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                    Cuisine Speciality
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. South Indian, North Indian"
                    value={form.cuisineType}
                    onChange={(e) => setForm({ ...form, cuisineType: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Taxes & Service Charges */}
        {activeTab === "taxes" && (
          <div className="card p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-[#172B2A] mb-1">Taxes, GST & Billing Fees</h3>
              <p className="text-xs text-[#788582]">These charges are computed on every completed cart.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                  GST / Sales Tax Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.taxPercent}
                  onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
                  className="input font-bold"
                />
                <p className="text-[10px] text-[#9CA8A5] mt-1">Standard 5% for Indian restaurant GST.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                  Service Charge Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.serviceChargePercent}
                  onChange={(e) => setForm({ ...form, serviceChargePercent: e.target.value })}
                  className="input font-bold"
                />
                <p className="text-[10px] text-[#9CA8A5] mt-1">Set to 0% if no service fee is charged.</p>
              </div>
            </div>

            <div className="border-t border-[#E5ECE9] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#172B2A]">Global Restaurant Flat Discount</p>
                  <p className="text-[11px] text-[#788582]">Automatically applied across all dishes.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.discountEnabled}
                    onChange={(e) => setForm({ ...form, discountEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {form.discountEnabled && (
                <div className="max-w-xs">
                  <label className="block text-xs font-semibold text-[#172B2A] mb-1">
                    Discount Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="90"
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                    className="input font-bold text-indigo-600"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QR & In-Dining Geofence */}
        {activeTab === "ordering" && (
          <div className="card p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-[#172B2A]">Table Geofencing & Verification</h3>
              <p className="text-xs text-[#788582]">
                Prevent fraudulent orders by restricting dine-in orders to guests physically located on-premises.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-[#E5ECE9] bg-[#F8FAF9]">
              <div>
                <p className="text-xs font-bold text-[#172B2A]">Enforce In-Restaurant Location Only</p>
                <p className="text-[11px] text-[#788582]">
                  Customers outside your geofence radius cannot submit dine-in tickets.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.geofenceEnabled}
                  onChange={(e) => setForm({ ...form, geofenceEnabled: e.target.checked })}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">Latitude</label>
                <input
                  type="text"
                  placeholder="e.g. 12.9716"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">Longitude</label>
                <input
                  type="text"
                  placeholder="e.g. 77.5946"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172B2A] mb-1">Radius (Meters)</label>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.geofenceRadiusMeters}
                  onChange={(e) => setForm({ ...form, geofenceRadiusMeters: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <MapPinIcon className="w-3.5 h-3.5 text-[#0F4C45]" />
              <span>{locating ? "Acquiring GPS..." : "Set Coordinates to My Current Location"}</span>
            </button>
          </div>
        )}

        {/* TAB 4: WhatsApp & Alerts */}
        {activeTab === "notifications" && (
          <div className="card p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-[#172B2A]">Messaging & Order Notifications</h3>
              <p className="text-xs text-[#788582]">Configure automated WhatsApp and SMS order updates.</p>
            </div>

            <div className="p-4 rounded-xl border border-[#E5ECE9] bg-[#F8FAF9] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#172B2A]">Customer Mobile Phone Verification</p>
                <p className="text-[11px] text-[#788582]">Require guests to verify phone via OTP before placing order.</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.phoneVerificationEnabled}
                  onChange={(e) => setForm({ ...form, phoneVerificationEnabled: e.target.checked })}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="p-4 rounded-xl border border-[#E5ECE9] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#172B2A]">WhatsApp Cloud API Integration</h4>
                  <p className="text-[10px] text-[#788582]">Official Meta Cloud API connection</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  whatsappStatus?.configured ? "bg-[#EAF7EE] text-[#269B67]" : "bg-slate-100 text-[#788582]"
                }`}>
                  {whatsappStatus?.configured ? "Configured" : "Unconfigured"}
                </span>
              </div>

              {whatsappError && <ErrorBanner message={whatsappError} />}

              {whatsappCheck && (
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700">
                  Connection verified: {whatsappCheck.connectionStatus} (Quality: {whatsappCheck.qualityRating || "Good"})
                </div>
              )}

              <button
                type="button"
                onClick={testWhatsAppConnection}
                disabled={checkingWhatsapp || !whatsappStatus?.configured}
                className="btn-secondary text-xs"
              >
                {checkingWhatsapp ? "Testing..." : "Test WhatsApp Connection"}
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: Payment Gateways */}
        {activeTab === "gateways" && (
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#172B2A]">Online Payment Gateway</h3>
              <p className="text-xs text-[#788582]">Status of Razorpay / UPI online settlement.</p>
            </div>

            <div className="p-4 rounded-xl border border-[#E5ECE9] bg-[#F8FAF9] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#172B2A]">Payment Provider</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  paymentProvider?.available ? "bg-[#EAF7EE] text-[#269B67]" : "bg-[#FFF8E7] text-[#E7A13A]"
                }`}>
                  {paymentProvider?.available ? paymentProvider.provider.toUpperCase() : "MOCK / UNCONFIGURED"}
                </span>
              </div>
              <p className="text-xs text-[#788582]">
                {paymentProvider?.available
                  ? "Live credentials are functioning on the server. Customers can pay via UPI, cards, and netbanking."
                  : "Online payments are currently operating in mock/test mode. Configure production Razorpay credentials in Render environment to enable live processing."}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-xs py-2.5 px-6"
          >
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
