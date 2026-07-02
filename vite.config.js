import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Build stamp shown in the app footer — Workers Builds sets the commit SHA,
  // so the live site always says exactly which commit it's serving.
  define: {
    __BUILD__: JSON.stringify(
      (process.env.WORKERS_CI_COMMIT_SHA || "").slice(0, 7) || `local·${new Date().toISOString().slice(5, 16).replace("T", "·")}`
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Multi-page: / -> index.html (App), /account -> account.html (AccountPage).
    // A real account.html means Cloudflare serves /account as a static asset.
    rollupOptions: { input: { main: "index.html", account: "account.html", admin: "admin.html" } },
  },
});
