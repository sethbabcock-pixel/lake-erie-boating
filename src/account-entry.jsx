import React from "react";
import { createRoot } from "react-dom/client";
import AccountPage from "./AccountPage.jsx";
import { recordPageview } from "./hit.js";
import "./tokens.css";
import "./styles.css";

recordPageview();

// Dedicated entry for the standalone /account page (built as account.html so
// Cloudflare serves it as a real static asset — no SPA-fallback dependency).
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AccountPage />
  </React.StrictMode>
);
