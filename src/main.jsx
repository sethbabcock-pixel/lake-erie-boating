import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AccountPage from "./AccountPage.jsx";
import { recordPageview } from "./hit.js";
import "./tokens.css";
import "./styles.css";

recordPageview();

// Tiny path-based router: /account is its own standalone page; everything else
// is the main conditions app. (worker.js serves the SPA shell for /account.)
const Page = window.location.pathname.replace(/\/$/, "") === "/account" ? AccountPage : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
