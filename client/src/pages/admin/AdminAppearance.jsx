import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../store/AuthContext.jsx";
import { ErrorBanner, Spinner } from "../../components/Ui.jsx";
import { resolveAssetUrl } from "../../utils/assetUrl.js";

const PRESETS = {
  ELEGANT: { name: "Elegant", primaryColor: "#75432f", backgroundColor: "#fffaf4", textColor: "#28231f", buttonTextColor: "#ffffff", typography: "serif", layout: "editorial" },
  STREET_FOOD: { name: "Street Food", primaryColor: "#a43424", backgroundColor: "#fff7ec", textColor: "#2d201a", buttonTextColor: "#ffffff", typography: "rounded", layout: "compact" },
  LUXURY_DARK: { name: "Luxury Dark", primaryColor: "#d1aa64", backgroundColor: "#171715", textColor: "#f4efe5", buttonTextColor: "#201a10", typography: "serif", layout: "editorial" },
  FRESH_GREEN: { name: "Fresh & Green", primaryColor: "#206445", backgroundColor: "#f2faf4", textColor: "#1c3327", buttonTextColor: "#ffffff", typography: "sans", layout: "centered" },
};
const DEFAULT_CONFIG = {
  preset: "ELEGANT", logoUrl: null, bannerUrl: null,
  primaryColor: PRESETS.ELEGANT.primaryColor,
  backgroundColor: PRESETS.ELEGANT.backgroundColor,
  textColor: PRESETS.ELEGANT.textColor,
  buttonTextColor: PRESETS.ELEGANT.buttonTextColor,
  typography: PRESETS.ELEGANT.typography,
  layout: PRESETS.ELEGANT.layout,
  featuredSections: ["featured", "about", "hours"],
};
const SECTION_OPTIONS = [
  ["featured", "Featured dishes"], ["about", "About the restaurant"], ["hours", "Business hours"],
];

function cssPreview(config) {
  const font = config.typography === "serif" ? 'Georgia, "Times New Roman", serif' : config.typography === "rounded" ? '"Trebuchet MS", Arial, sans-serif' : 'Arial, sans-serif';
  return {
    backgroundColor: config.backgroundColor,
    color: config.textColor,
    fontFamily: font,
    "--preview-accent": config.primaryColor,
    "--preview-button-text": config.buttonTextColor,
  };
}

export default function AdminAppearance() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  async function refresh() {
    const result = await api.get(`/restaurants/${user.restaurantId}/website-theme`);
    setState(result);
    setConfig(result.draft?.config || result.published?.config || result.defaultConfig || DEFAULT_CONFIG);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [user.restaurantId]);

  const previewStyle = useMemo(() => cssPreview(config), [config]);

  function changePreset(preset) {
    const { name, ...presetConfig } = PRESETS[preset];
    setConfig((current) => ({ ...current, ...presetConfig, preset }));
    setMessage("");
  }

  function update(field, value) {
    setConfig((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  async function uploadImage(field, file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError("Choose a JPG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    setError(null);
    setImageBusy(field);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await api.post(`/restaurants/${user.restaurantId}/website-theme/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      update(field, result.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setImageBusy("");
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await api.post(`/restaurants/${user.restaurantId}/website-theme/drafts`, { config });
      await refresh();
      setMessage("Draft saved. The public website is unchanged until you publish.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!state?.draft) return saveDraftThenPublish();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await api.post(`/restaurants/${user.restaurantId}/website-theme/drafts/${state.draft.id}/publish`);
      await refresh();
      setMessage("Theme published to the restaurant website.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraftThenPublish() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const draft = await api.post(`/restaurants/${user.restaurantId}/website-theme/drafts`, { config });
      await api.post(`/restaurants/${user.restaurantId}/website-theme/drafts/${draft.id}/publish`);
      await refresh();
      setMessage("Theme published to the restaurant website.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function restoreDefault() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await api.post(`/restaurants/${user.restaurantId}/website-theme/restore-default`);
      await refresh();
      setMessage("Default appearance restored and published.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function rollback(versionId) {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await api.post(`/restaurants/${user.restaurantId}/website-theme/versions/${versionId}/rollback`);
      await refresh();
      setMessage("That version has been restored as a new published revision.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!state && !error) return <Spinner label="Loading website appearance..." />;
  if (!state) return <div className="p-6"><ErrorBanner message={error} /><button className="btn-secondary mt-3" onClick={() => refresh().catch((err) => setError(err.message))}>Retry</button></div>;

  return (
    <div className="space-y-6 p-4 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="section-eyebrow !ml-0">Restaurant website</p><h2 className="font-display text-3xl">Website appearance</h2><p className="mt-2 max-w-2xl text-sm text-charcoal/55">Set the look of your public restaurant website. Theme settings only affect presentation; menu prices, taxes, permissions, orders, and payments remain server controlled.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={restoreDefault} disabled={busy}>Restore default</button><button className="btn-secondary" onClick={saveDraft} disabled={busy}>Save draft</button><button className="btn-primary" onClick={publish} disabled={busy}>{busy ? "Saving..." : "Publish theme"}</button></div>
      </div>

      {error && <ErrorBanner message={error} />}
      {message && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(400px,1.15fr)]">
        <section className="card space-y-5 p-5 md:p-6">
          <div><h3 className="font-semibold">Choose a preset</h3><p className="mt-1 text-xs text-charcoal/50">Presets set a starting palette, type, and layout. Customize below.</p></div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button key={key} type="button" onClick={() => changePreset(key)} aria-pressed={config.preset === key} className={`rounded-lg border p-3 text-left transition ${config.preset === key ? "border-clove ring-2 ring-clove/15" : "border-charcoal/10 hover:border-charcoal/30"}`}>
                <span className="mb-2 flex gap-1"><i className="h-4 w-4 rounded-full" style={{ backgroundColor: preset.primaryColor }} /><i className="h-4 w-4 rounded-full border border-charcoal/10" style={{ backgroundColor: preset.backgroundColor }} /></span>
                <span className="block text-sm font-semibold">{preset.name}</span><span className="text-[11px] text-charcoal/45">{preset.layout} layout</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField label="Primary color" value={config.primaryColor} onChange={(value) => update("primaryColor", value)} />
            <ColorField label="Page background" value={config.backgroundColor} onChange={(value) => update("backgroundColor", value)} />
            <ColorField label="Text color" value={config.textColor} onChange={(value) => update("textColor", value)} />
            <ColorField label="Button text" value={config.buttonTextColor} onChange={(value) => update("buttonTextColor", value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-charcoal/60">Typography<select className="input mt-1" value={config.typography} onChange={(event) => update("typography", event.target.value)}><option value="sans">Clean sans</option><option value="serif">Editorial serif</option><option value="rounded">Friendly rounded</option></select></label>
            <label className="text-xs font-medium text-charcoal/60">Layout<select className="input mt-1" value={config.layout} onChange={(event) => update("layout", event.target.value)}><option value="centered">Centered</option><option value="editorial">Editorial</option><option value="compact">Compact</option></select></label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ImageField label="Logo" value={config.logoUrl} busy={imageBusy === "logoUrl"} onUpload={(file) => uploadImage("logoUrl", file)} onRemove={() => update("logoUrl", null)} />
            <ImageField label="Banner" value={config.bannerUrl} busy={imageBusy === "bannerUrl"} onUpload={(file) => uploadImage("bannerUrl", file)} onRemove={() => update("bannerUrl", null)} />
          </div>

          <fieldset><legend className="mb-2 text-xs font-semibold text-charcoal/70">Featured sections</legend><div className="grid grid-cols-2 gap-2">{SECTION_OPTIONS.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-md border border-charcoal/10 px-3 py-2 text-xs"><input type="checkbox" checked={config.featuredSections.includes(key)} onChange={(event) => update("featuredSections", event.target.checked ? [...config.featuredSections, key] : config.featuredSections.filter((section) => section !== key))} />{label}</label>)}</div></fieldset>

          <div className="border-t border-charcoal/10 pt-4"><h3 className="text-sm font-semibold">Version history</h3><p className="mt-1 text-xs text-charcoal/45">Rollback publishes a new revision; previous versions stay available.</p><div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{state.versions.length === 0 ? <p className="text-xs text-charcoal/45">No saved revisions yet.</p> : state.versions.map((version) => <div key={version.id} className="flex items-center justify-between gap-3 rounded-md border border-charcoal/10 px-3 py-2"><div><p className="text-xs font-semibold">Version {version.version} <span className="ml-1 font-normal text-charcoal/45">{version.status.toLowerCase()}</span></p><p className="text-[10px] text-charcoal/45">{new Date(version.createdAt).toLocaleString()}</p></div>{version.status === "PUBLISHED" && version.id !== state.published?.id && <button className="text-xs font-semibold text-clove" disabled={busy} onClick={() => rollback(version.id)}>Restore</button>}</div>)}</div></div>
        </section>

        <section className="space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold">Storefront preview</h3><p className="text-xs text-charcoal/45">Preview only. Changes go live after publishing.</p></div><div className="flex rounded-md border border-charcoal/10 bg-white p-1"><button className={`rounded px-3 py-1.5 text-xs ${previewMode === "desktop" ? "bg-charcoal text-white" : "text-charcoal/55"}`} onClick={() => setPreviewMode("desktop")} aria-pressed={previewMode === "desktop"}>Desktop</button><button className={`rounded px-3 py-1.5 text-xs ${previewMode === "mobile" ? "bg-charcoal text-white" : "text-charcoal/55"}`} onClick={() => setPreviewMode("mobile")} aria-pressed={previewMode === "mobile"}>Mobile</button></div></div>
          <div className="overflow-x-auto rounded-xl border border-charcoal/15 bg-[#e9ece9] p-3 md:p-5"><div className={`mx-auto overflow-hidden rounded-xl border border-charcoal/10 shadow-xl transition-all ${previewMode === "mobile" ? "max-w-[390px]" : "max-w-[900px]"}`} style={previewStyle}>
            <div className="flex items-center justify-between border-b border-current/10 px-5 py-3"><span className="flex items-center gap-2 text-sm font-bold">{config.logoUrl ? <img src={resolveAssetUrl(config.logoUrl)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full" style={{ backgroundColor: "var(--preview-accent)", color: "var(--preview-button-text)" }}>S</span>}Your Restaurant</span><span className="text-xs opacity-60">Menu&nbsp;&nbsp;&nbsp; About</span></div>
            {config.bannerUrl && <img src={resolveAssetUrl(config.bannerUrl)} alt="" className="h-36 w-full object-cover" />}
            <div className={`px-5 py-7 ${config.layout === "centered" ? "text-center" : ""}`}><p className="text-[10px] font-semibold uppercase tracking-[.18em] opacity-50">Fresh from our kitchen</p><h4 className="mt-2 text-2xl font-bold">Good food, good moments.</h4><p className="mt-2 text-sm opacity-60">A welcoming place to discover the menu.</p><button className="mt-4 rounded-md px-4 py-2 text-xs font-semibold" style={{ backgroundColor: "var(--preview-accent)", color: "var(--preview-button-text)" }}>Explore the menu</button></div>
            <div className={`grid gap-3 px-5 pb-6 ${previewMode === "mobile" ? "grid-cols-1" : "grid-cols-2"}`}><PreviewDish name="House special" price="₹320" style={previewStyle} /><PreviewDish name="Garden bowl" price="₹260" style={previewStyle} /></div>
          </div></div>
          <p className="text-right text-[11px] text-charcoal/45">Published version: {state.published ? `v${state.published.version}` : "Default appearance"}{state.draft ? ` · Draft v${state.draft.version}` : ""}</p>
        </section>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return <label className="text-xs font-medium text-charcoal/60">{label}<span className="mt-1 flex items-center gap-2 rounded-md border border-charcoal/10 bg-white p-2"><input className="h-7 w-9 cursor-pointer rounded border-0 p-0" type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} /><span className="font-mono text-xs text-charcoal/70">{value}</span></span></label>;
}

function ImageField({ label, value, busy, onUpload, onRemove }) {
  return <div className="rounded-md border border-charcoal/10 p-3"><p className="mb-2 text-xs font-semibold">{label}</p>{value && <img src={resolveAssetUrl(value)} alt={`${label} preview`} className="mb-2 h-20 w-full rounded object-cover" />}<label className="btn-secondary inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-xs">{busy ? "Uploading..." : value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; onUpload(file); }} /></label>{value && <button type="button" className="ml-3 text-xs text-red-600" onClick={onRemove}>Remove</button>}<p className="mt-2 text-[10px] text-charcoal/45">JPG, PNG, WEBP, or GIF · up to 5 MB</p></div>;
}

function PreviewDish({ name, price, style }) {
  return <article className="overflow-hidden rounded-lg border border-current/10 bg-white/50" style={style}><div className="h-20 bg-current/5" /><div className="flex items-center justify-between p-3"><span className="text-xs font-semibold">{name}</span><span className="text-xs font-bold" style={{ color: "var(--preview-accent)" }}>{price}</span></div></article>;
}
