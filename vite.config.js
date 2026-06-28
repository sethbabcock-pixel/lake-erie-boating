import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Multi-page: / -> index.html (App), /account -> account.html (AccountPage).
    // A real account.html means Cloudflare serves /account as a static asset.
    rollupOptions: { input: { main: "index.html", account: "account.html" } },
  },
});
