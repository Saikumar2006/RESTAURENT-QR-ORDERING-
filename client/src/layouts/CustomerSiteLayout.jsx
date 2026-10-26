import React, { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import api from "../services/api";

const DEFAULT_THEME = {
  preset: "ELEGANT", logoUrl: null, bannerUrl: null,
  primaryColor: "#75432f", backgroundColor: "#fffaf4", textColor: "#28231f",
  buttonTextColor: "#ffffff", typography: "serif", layout: "editorial", featuredSections: [],
};

function themeStyle(theme) {
  const typography = theme.typography === "serif"
    ? '"Fraunces", Georgia, serif'
    : theme.typography === "rounded"
      ? '"DM Sans", "Trebuchet MS", sans-serif'
      : '"DM Sans", Arial, sans-serif';
  return {
    "--site-primary": theme.primaryColor,
    "--site-background": theme.backgroundColor,
    "--site-text": theme.textColor,
    "--site-button-text": theme.buttonTextColor,
    "--site-font": typography,
    "--site-layout": theme.layout,
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
  };
}

export default function CustomerSiteLayout() {
  const { slug } = useParams();
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    let current = true;
    api.get(`/public/restaurants/${slug}/theme`)
      .then((result) => { if (current) setTheme(result.config || DEFAULT_THEME); })
      .catch(() => { if (current) setTheme(DEFAULT_THEME); });
    return () => { current = false; };
  }, [slug]);

  return (
    <div className="customer-site-theme min-h-full" data-layout={theme.layout} style={themeStyle(theme)}>
      <Outlet context={{ theme }} />
    </div>
  );
}
