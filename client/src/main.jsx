import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { CartProvider } from "./store/CartContext.jsx";
import { AuthProvider } from "./store/AuthContext.jsx";
import { PlatformAuthProvider } from "./store/PlatformAuthContext.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import { LanguageProvider } from "./i18n.jsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <PlatformAuthProvider>
                <CartProvider>
                  <App />
                </CartProvider>
              </PlatformAuthProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
