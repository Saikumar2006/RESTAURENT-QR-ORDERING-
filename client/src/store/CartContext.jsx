import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);

// Cart lives client-side only. Server always recalculates authoritative
// totals at order time — this is advisory/display state for the customer.
//
// "session" replaces the old single tableToken: it remembers which
// restaurant the customer landed on (via the single QR) and whether they
// picked a dine-in table or takeaway, so a page refresh on /menu, /cart,
// /pay etc. doesn't lose that choice.
//   { slug, orderType: "DINE_IN" | "TAKEAWAY", tableToken, tableNumber, restaurant }
export function CartProvider({ children }) {
  const [session, setSessionState] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("qr_session") || "null");
    } catch {
      return null;
    }
  });
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("qr_cart_items") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    sessionStorage.setItem("qr_cart_items", JSON.stringify(items));
  }, [items]);

  function setSession(next) {
    setSessionState(next);
    if (next) {
      sessionStorage.setItem("qr_session", JSON.stringify(next));
    } else {
      sessionStorage.removeItem("qr_session");
    }
  }

  function addItem(menuItem, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: Number(menuItem.price),
          quantity,
          instructions: "",
        },
      ];
    });
  }

  function updateQuantity(menuItemId, quantity) {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems((prev) => prev.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i)));
  }

  function setInstructions(menuItemId, instructions) {
    setItems((prev) => prev.map((i) => (i.menuItemId === menuItemId ? { ...i, instructions } : i)));
  }

  function removeItem(menuItemId) {
    setItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  }

  function clearCart() {
    setItems([]);
    sessionStorage.removeItem("qr_cart_items");
  }

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        session,
        setSession,
        items,
        addItem,
        updateQuantity,
        setInstructions,
        removeItem,
        clearCart,
        subtotal,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
