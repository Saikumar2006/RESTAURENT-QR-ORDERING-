import React from "react";
import { useCart } from "../store/CartContext.jsx";
import { resolveAssetUrl } from "../utils/assetUrl.js";

export default function MenuItemCard({ item }) {
  const { items, addItem, updateQuantity } = useCart();
  const inCart = items.find((i) => i.menuItemId === item.id);

  return (
    <div className="card p-4 flex gap-4 items-center">
      {item.imageUrl ? (
        <img src={resolveAssetUrl(item.imageUrl)} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-marigold/15 shrink-0 flex items-center justify-center text-2xl">
          {item.isVeg ? "🥬" : "🍗"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{item.name}</h3>
          <span
            className={`shrink-0 mt-1 w-3 h-3 rounded-sm border-2 ${
              item.isVeg ? "border-sage" : "border-clove"
            } flex items-center justify-center`}
            title={item.isVeg ? "Vegetarian" : "Non-vegetarian"}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-sage" : "bg-clove"}`} />
          </span>
        </div>
        {item.description && <p className="text-xs text-charcoal/50 mt-0.5 line-clamp-2">{item.description}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold text-sm">₹{Number(item.price).toFixed(0)}</span>
          {!item.isAvailable ? (
            <span className="text-xs text-charcoal/40 font-medium">Unavailable</span>
          ) : inCart ? (
            <div className="flex items-center gap-2">
              <button
                className="w-7 h-7 rounded-full border border-charcoal/20 flex items-center justify-center text-sm"
                onClick={() => updateQuantity(item.id, inCart.quantity - 1)}
                aria-label={`Decrease quantity of ${item.name}`}
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-semibold">{inCart.quantity}</span>
              <button
                className="w-7 h-7 rounded-full bg-clove text-cream flex items-center justify-center text-sm"
                onClick={() => updateQuantity(item.id, inCart.quantity + 1)}
                aria-label={`Increase quantity of ${item.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button className="text-xs font-semibold text-clove border border-clove rounded-full px-3 py-1.5" onClick={() => addItem(item)}>
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
