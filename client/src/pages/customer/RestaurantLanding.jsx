import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../store/CartContext.jsx";
import { Spinner } from "../../components/Ui.jsx";
import { resolveAssetUrl } from "../../utils/assetUrl.js";
import { getCurrentPosition, distanceMeters } from "../../utils/geo.js";

// This is the ONE page every customer lands on after scanning the single
// restaurant QR. From here they choose "Dine in" (and which table) or
// "Takeaway" — replacing the old one-QR-per-table approach.
export default function RestaurantLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { setSession } = useCart();
  const [context, setContext] = useState(null);
  const [error, setError] = useState(null); // { status, message } | null
  const [mode, setMode] = useState(null); // null | "dine-in"

  // "checking" | "inside" | "outside" | "error" | "not-required"
  const [geoStatus, setGeoStatus] = useState("checking");
  const [geoError, setGeoError] = useState(null);
  const [verifiedLocation, setVerifiedLocation] = useState(null);

  useEffect(() => {
    api
      .get(`/public/restaurants/${slug}`)
      .then(setContext)
      .catch((err) => setError({ status: err.status, message: err.message }));
  }, [slug]);

  useEffect(() => {
    if (!context) return;
    if (!context.restaurant.geofenceEnabled) {
      setGeoStatus("not-required");
      return;
    }
    checkLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  async function checkLocation() {
    setGeoStatus("checking");
    setGeoError(null);
    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude, geofenceRadiusMeters } = context.restaurant;
      if (latitude == null || longitude == null) {
        // Misconfigured on the admin side — fail closed, same as the server.
        setGeoStatus("outside");
        setGeoError("This restaurant's location isn't set up yet. Ask staff for help.");
        return;
      }
      const d = distanceMeters(latitude, longitude, pos.lat, pos.lng);
      if (d <= geofenceRadiusMeters) {
        setVerifiedLocation({ lat: pos.lat, lng: pos.lng });
        setGeoStatus("inside");
      } else {
        setGeoStatus("outside");
      }
    } catch (err) {
      setGeoStatus("error");
      setGeoError(err.message);
    }
  }

  function chooseTable(table) {
    setSession({
      slug,
      orderType: "DINE_IN",
      tableToken: table.tableToken,
      tableNumber: table.tableNumber,
      restaurant: context.restaurant,
      location: verifiedLocation,
    });
    navigate(`/r/${slug}/menu`);
  }

  function chooseTakeaway() {
    setSession({
      slug,
      orderType: "TAKEAWAY",
      tableToken: null,
      tableNumber: null,
      restaurant: context.restaurant,
      location: verifiedLocation,
    });
    navigate(`/r/${slug}/menu`);
  }

  if (error) {
    // status === undefined means the request never got a response at all —
    // almost always because the API server isn't running or isn't
    // reachable (e.g. only `npm run dev`'s client half was started). A 404
    // means the server responded fine, it just doesn't know this slug.
    const isConnectionIssue = !error.status;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl mb-2">
            {isConnectionIssue ? "Can't reach the server" : "Restaurant not found"}
          </p>
          <p className="text-charcoal/60 text-sm mb-4">
            {isConnectionIssue
              ? "The app can't connect to the API right now. If you're running this locally, make sure the server is started (npm run dev or npm start), then try again."
              : "This QR code appears to be invalid or the restaurant is no longer active. Please ask a staff member for help."}
          </p>
          <button className="btn-secondary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!context) return <Spinner label="Loading..." />;

  if (context.restaurant.isOpenNow === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3">🌙</p>
          <p className="font-display text-2xl mb-2">Out of Service</p>
          <p className="text-charcoal/60 text-sm">
            {context.restaurant.name} isn't taking orders right now. Please check back during opening hours.
          </p>
        </div>
      </div>
    );
  }

  if (context.restaurant.geofenceEnabled && geoStatus === "checking") {
    return <Spinner label="Confirming you're on-site..." />;
  }

  if (context.restaurant.geofenceEnabled && (geoStatus === "outside" || geoStatus === "error")) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3">📍</p>
          <p className="font-display text-2xl mb-2">
            {geoStatus === "outside" ? "You need to be at the restaurant" : "Couldn't confirm your location"}
          </p>
          <p className="text-charcoal/60 text-sm mb-4">
            {geoError ||
              `Ordering from ${context.restaurant.name} is only available on-site. Please move closer and try again.`}
          </p>
          <button className="btn-secondary" onClick={checkLocation}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10 text-center bg-gradient-to-b from-marigold/10 to-cream">
      {context.restaurant.logoUrl ? (
        <img src={resolveAssetUrl(context.restaurant.logoUrl)} alt="" className="w-20 h-20 rounded-full object-cover mb-6 shadow" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-clove text-cream flex items-center justify-center font-display text-3xl mb-6 shadow">
          {context.restaurant.name.charAt(0)}
        </div>
      )}
      <h1 className="font-display text-4xl mb-2">{context.restaurant.name}</h1>
      <p className="text-charcoal/50 text-sm max-w-xs mb-10">
        Browse the menu, build your order, and pay right from your phone — no waiting for a waiter.
      </p>

      {mode !== "dine-in" && (
        <div className="w-full max-w-xs space-y-3">
          <button className="btn-primary w-full" onClick={() => setMode("dine-in")}>
            Dine In — Select Table
          </button>
          <button className="btn-secondary w-full" onClick={chooseTakeaway}>
            Takeaway
          </button>
        </div>
      )}

      {mode === "dine-in" && (
        <div className="w-full max-w-xs">
          {context.tables.length === 0 ? (
            <p className="text-sm text-charcoal/50 mb-4">No tables are set up yet — ask staff for help.</p>
          ) : (
            <>
              <p className="text-sm text-charcoal/50 mb-4">Tap your table number</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {context.tables.map((t) => (
                  <button
                    key={t.tableToken}
                    onClick={() => chooseTable(t)}
                    className="card py-4 font-display text-lg hover:bg-clove hover:text-cream transition-colors"
                  >
                    {t.tableNumber}
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="text-sm text-charcoal/50" onClick={() => setMode(null)}>
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
