import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { CartProvider } from "./store/CartContext.jsx";
import { AuthProvider } from "./store/AuthContext.jsx";
import { PlatformAuthProvider } from "./store/PlatformAuthContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlatformAuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </PlatformAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
