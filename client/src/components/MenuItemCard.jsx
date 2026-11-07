import React from "react";
import { useCart } from "../store/CartContext.jsx";
import { resolveAssetUrl } from "../utils/assetUrl.js";
import { formatCurrency } from "../i18n/resources.js";
import { useTranslation } from "../i18n.jsx";
import { VegBadge, NonVegBadge } from "./UiIcons.jsx";

export default function MenuItemCard({ item }) {
  const { items, addItem, updateQuantity, session } = useCart();
  const { language, t } = useTranslation();
  const inCart = items.find((i) => i.menuItemId === item.id);

  return (
    <div className="card p-3.5 flex gap-3.5 items-center">
      {item.imageUrl ? (
        <img src={resolveAssetUrl(item.imageUrl)} alt="" className="w-18 h-18 rounded-lg object-cover shrink-0 border border-slate-200/80" />
      ) : (
        <div className="w-18 h-18 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center border border-slate-200">
          {item.isVeg ? <VegBadge className="w-5 h-5" /> : <NonVegBadge className="w-5 h-5" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.isVeg ? <VegBadge className="w-3.5 h-3.5 shrink-0" /> : <NonVegBadge className="w-3.5 h-3.5 shrink-0" />}
            <h3 className="font-semibold text-sm leading-snug truncate text-slate-900">{item.name}</h3>
          </div>
        </div>
        {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>}
        <div className="flex items-center justify-between mt-2.5">
          <span className="font-semibold text-xs tabular-nums text-slate-900">{formatCurrency(Number(item.price), session?.restaurant?.currency || "INR", language)}</span>
          {!item.isAvailable ? (
            <span className="text-xs text-slate-400 font-medium">{t("unavailable")}</span>
          ) : inCart ? (
            <div className="flex items-center gap-1.5">
              <button
                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-xs text-slate-700 hover:bg-slate-100 transition"
                onClick={() => updateQuantity(item.id, inCart.quantity - 1)}
                aria-label={`Decrease quantity of ${item.name}`}
              >
                −
              </button>
              <span className="w-5 text-center text-xs font-semibold tabular-nums">{inCart.quantity}</span>
              <button
                className="w-6 h-6 rounded bg-[#0F4C45] hover:bg-[#0D3E38] text-white flex items-center justify-center text-xs transition"
                onClick={() => updateQuantity(item.id, inCart.quantity + 1)}
                aria-label={`Increase quantity of ${item.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button className="text-xs font-semibold text-[#0F4C45] border border-[#0F4C45] hover:bg-[#EBF5F3] rounded px-3 py-1 transition" onClick={() => addItem(item)}>
              {t("add")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
