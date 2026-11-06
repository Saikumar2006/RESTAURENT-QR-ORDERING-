import React, { useEffect, useState } from "react";
import platformApi from "../../../services/platformApi";
import { Spinner, ErrorBanner } from "../../../components/Ui.jsx";

export default function PlatformSettingsTab() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Password reset state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.get("/settings");
      setSettings(res.map || {});
    } catch (err) {
      setError(err.message || "Failed to load platform settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function handleSaveSetting(key, category = "GENERAL") {
    setSavingKey(key);
    setSaveSuccess(null);
    setError(null);
    try {
      await platformApi.put("/settings", {
        key,
        value: settings[key],
        category,
      });
      setSaveSuccess(`Setting "${key}" updated successfully.`);
    } catch (err) {
      setError(err.message || "Failed to save setting.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      return setPasswordError("New password must be at least 8 characters long.");
    }
    if (newPassword !== confirmPassword) {
      return setPasswordError("New passwords do not match.");
    }

    setChangingPassword(true);
    try {
      await platformApi.post("/password", {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess("Your Super Admin password was changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Platform Global Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure platform branding, operational parameters, security policies, and administrative credentials.
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
        >
          ↻ Refresh
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>✓ {saveSuccess}</span>
          <button onClick={() => setSaveSuccess(null)} className="font-bold">×</button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="py-12 flex justify-center bg-white rounded-2xl border border-slate-200/80">
          <Spinner label="Loading platform settings..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Platform Branding & Currency */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Platform Identity & Localization</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Platform Brand Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.PLATFORM_NAME || "Svaadya"}
                  onChange={(e) => setSettings({ ...settings, PLATFORM_NAME: e.target.value })}
                  className="flex-1 p-2 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  onClick={() => handleSaveSetting("PLATFORM_NAME", "BRANDING")}
                  disabled={savingKey === "PLATFORM_NAME"}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Public Support Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={settings.SUPPORT_EMAIL || "svaadyarestro@gmail.com"}
                  onChange={(e) => setSettings({ ...settings, SUPPORT_EMAIL: e.target.value })}
                  className="flex-1 p-2 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  onClick={() => handleSaveSetting("SUPPORT_EMAIL", "GENERAL")}
                  disabled={savingKey === "SUPPORT_EMAIL"}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Currency</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.DEFAULT_CURRENCY || "INR"}
                    onChange={(e) => setSettings({ ...settings, DEFAULT_CURRENCY: e.target.value })}
                    className="flex-1 p-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    onClick={() => handleSaveSetting("DEFAULT_CURRENCY", "GENERAL")}
                    disabled={savingKey === "DEFAULT_CURRENCY"}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Timezone</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.DEFAULT_TIMEZONE || "Asia/Kolkata"}
                    onChange={(e) => setSettings({ ...settings, DEFAULT_TIMEZONE: e.target.value })}
                    className="flex-1 p-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    onClick={() => handleSaveSetting("DEFAULT_TIMEZONE", "GENERAL")}
                    disabled={savingKey === "DEFAULT_TIMEZONE"}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Trial Days (0-30)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={settings.DEFAULT_TRIAL_DAYS || "14"}
                  onChange={(e) => setSettings({ ...settings, DEFAULT_TRIAL_DAYS: e.target.value })}
                  className="flex-1 p-2 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  onClick={() => handleSaveSetting("DEFAULT_TRIAL_DAYS", "SUBSCRIPTION")}
                  disabled={savingKey === "DEFAULT_TRIAL_DAYS"}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Security & Maintenance Policies */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Platform Operational Flags</h3>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-semibold text-xs text-slate-800">Public Restaurant Registration</div>
                  <div className="text-[11px] text-slate-500">Allow new restaurants to register on /register</div>
                </div>
                <button
                  onClick={() => {
                    const nextVal = settings.ALLOW_PUBLIC_REGISTRATION === "false" ? "true" : "false";
                    setSettings({ ...settings, ALLOW_PUBLIC_REGISTRATION: nextVal });
                    handleSaveSetting("ALLOW_PUBLIC_REGISTRATION", "SECURITY");
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                    settings.ALLOW_PUBLIC_REGISTRATION !== "false"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-slate-200 text-slate-600 border-slate-300"
                  }`}
                >
                  {settings.ALLOW_PUBLIC_REGISTRATION !== "false" ? "ENABLED" : "DISABLED"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-rose-50/50 rounded-xl border border-rose-200/80">
                <div>
                  <div className="font-semibold text-xs text-rose-950">Maintenance Mode</div>
                  <div className="text-[11px] text-rose-700">Restricts public access while maintenance occurs</div>
                </div>
                <button
                  onClick={() => {
                    const nextVal = settings.MAINTENANCE_MODE === "true" ? "false" : "true";
                    if (nextVal === "true" && !window.confirm("Activate platform-wide maintenance mode?")) return;
                    setSettings({ ...settings, MAINTENANCE_MODE: nextVal });
                    handleSaveSetting("MAINTENANCE_MODE", "SECURITY");
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                    settings.MAINTENANCE_MODE === "true"
                      ? "bg-rose-600 text-white border-rose-700"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
                >
                  {settings.MAINTENANCE_MODE === "true" ? "ACTIVE" : "OFF"}
                </button>
              </div>
            </div>

            {/* Change Super Admin Password */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-3">Super Admin Security Credentials</h3>

              {passwordSuccess && (
                <div className="mb-3 p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200">
                  ✓ {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="mb-3 p-2.5 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200">
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-lg transition disabled:opacity-50"
                >
                  {changingPassword ? "Updating Password…" : "Update Super Admin Password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
