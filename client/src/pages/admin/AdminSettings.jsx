import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { Spinner, ErrorBanner } from "../../components/Ui.jsx";

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${checked ? "bg-clove" : "bg-charcoal/20"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);

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
  }, []);

  function useMyLocation() {
    setLocateError(null);
    if (!("geolocation" in navigator)) {
      setLocateError("Your browser doesn't support location.");
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
        setLocateError("Couldn't get your location — check browser permissions and try again.");
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
      setError("Set the restaurant's location before turning on in-restaurant-only ordering.");
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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <Spinner label="Loading settings..." />;

  return (
    <div className="p-8 max-w-lg">
      <h1 className="font-display text-3xl mb-1">Settings</h1>
      <p className="text-sm text-charcoal/50 mb-6">
        These apply to every order, on top of any coupon a customer might use at checkout.
      </p>

      {error && <ErrorBanner message={error} />}

      <div className={`card p-6 mb-4 border-l-4 ${form.isOpen ? "border-emerald-500" : "border-red-500"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{form.isOpen ? "Restaurant is open" : "Restaurant is closed"}</p>
            <p className="text-xs text-charcoal/50">
              {form.isOpen
                ? "Customers scanning your QR can browse and order."
                : "Customers scanning your QR see \"Out of Service\" instead of the menu."}
            </p>
          </div>
          <Toggle checked={form.isOpen} onChange={(v) => setForm({ ...form, isOpen: v })} />
        </div>

        <div className="mt-4 pt-4 border-t border-charcoal/10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Auto-close outside business hours</p>
              <p className="text-xs text-charcoal/50">Shows "Out of Service" automatically outside these hours, on top of the toggle above</p>
            </div>
            <Toggle checked={form.autoScheduleEnabled} onChange={(v) => setForm({ ...form, autoScheduleEnabled: v })} />
          </div>
          {form.autoScheduleEnabled && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-charcoal/50 block mb-1">Opens at</label>
                <input className="input" type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-charcoal/50 block mb-1">Closes at</label>
                <input className="input" type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-medium">In-restaurant ordering only</p>
            <p className="text-xs text-charcoal/50">Blocks ordering from outside the restaurant, even if someone has the link</p>
          </div>
          <Toggle checked={form.geofenceEnabled} onChange={(v) => setForm({ ...form, geofenceEnabled: v })} />
        </div>
        {form.geofenceEnabled && (
          <div className="mt-4 pt-4 border-t border-charcoal/10 space-y-3">
            <button type="button" className="btn-secondary text-xs py-2 px-3" onClick={useMyLocation} disabled={locating}>
              {locating ? "Locating..." : "📍 Use my current location"}
            </button>
            {locateError && <p className="text-xs text-red-600">{locateError}</p>}
            <p className="text-xs text-charcoal/50">
              Stand inside the restaurant and tap this once to set its location — customers will need to be within the radius below.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-charcoal/50 block mb-1">Latitude</label>
                <input className="input" type="number" step="0.000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-charcoal/50 block mb-1">Longitude</label>
                <input className="input" type="number" step="0.000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-charcoal/50 block mb-1">Allowed radius (meters)</label>
              <input
                className="input"
                type="number"
                min="20"
                max="5000"
                value={form.geofenceRadiusMeters}
                onChange={(e) => setForm({ ...form, geofenceRadiusMeters: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-medium">Require phone verification</p>
            <p className="text-xs text-charcoal/50">Customers must verify their phone with an OTP before placing an order</p>
          </div>
          <Toggle checked={form.phoneVerificationEnabled} onChange={(v) => setForm({ ...form, phoneVerificationEnabled: v })} />
        </div>

        <div className="mt-4 pt-4 border-t border-charcoal/10 flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-medium">Order notifications</p>
            <p className="text-xs text-charcoal/50">Send order confirmation and status updates to the customer's phone</p>
          </div>
          <Toggle checked={form.orderNotificationsEnabled} onChange={(v) => setForm({ ...form, orderNotificationsEnabled: v })} />
        </div>

        {(form.phoneVerificationEnabled || form.orderNotificationsEnabled) && (
          <div className="mt-4 pt-4 border-t border-charcoal/10">
            <label className="text-xs text-charcoal/50 block mb-1">Preferred channel</label>
            <select
              className="input"
              value={form.notificationChannel}
              onChange={(e) => setForm({ ...form, notificationChannel: e.target.value })}
            >
              <option value="whatsapp">WhatsApp (falls back to SMS if delivery fails)</option>
              <option value="sms">SMS only</option>
            </select>
          </div>
        )}
      </div>

      <form onSubmit={save} className="card p-6 space-y-4">
        <div>
          <label className="text-xs text-charcoal/50 block mb-1">Restaurant name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-charcoal/50 block mb-1">Cuisine / type</label>
          <input
            className="input"
            placeholder="e.g. North Indian, Cafe, Fast Food"
            value={form.cuisineType}
            onChange={(e) => setForm({ ...form, cuisineType: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-charcoal/50 block mb-1">Tax (%)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.taxPercent}
            onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-charcoal/50 block mb-1">Service charge (%)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.serviceChargePercent}
            onChange={(e) => setForm({ ...form, serviceChargePercent: e.target.value })}
          />
        </div>
        <div className={form.discountEnabled ? "" : "opacity-50"}>
          <div className="flex items-center justify-between pt-2 border-t border-charcoal/10 mb-3">
            <div>
              <p className="text-sm font-medium">Default order discount</p>
              <p className="text-xs text-charcoal/50">Applies automatically to every order that doesn't use a coupon</p>
            </div>
            <Toggle checked={form.discountEnabled} onChange={(v) => setForm({ ...form, discountEnabled: v })} />
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-charcoal/50">Discount amount</span>
            <span className="text-sm font-semibold text-clove tabular-nums">{Number(form.discountPercent || 0).toFixed(0)}%</span>
          </div>
          <input
            className="w-full accent-clove"
            type="range"
            min="0"
            max="100"
            step="1"
            disabled={!form.discountEnabled}
            value={form.discountPercent || 0}
            onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
          />
          <div className="flex justify-between text-[10px] text-charcoal/35 -mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-charcoal/10">
          <div>
            <p className="text-sm font-medium">Menu search bar</p>
            <p className="text-xs text-charcoal/50">Let customers search the menu by name from their phone</p>
          </div>
          <Toggle checked={form.searchEnabled} onChange={(v) => setForm({ ...form, searchEnabled: v })} />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
