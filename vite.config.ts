import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/lifeos.svg"],
      manifest: {
        name: "LifeOS — إدارة حياتك",
        short_name: "LifeOS",
        description: "مساحة شخصية لإدارة الوقت والمهام والمشاريع",
        lang: "ar",
        dir: "rtl",
        theme_color: "#172b3a",
        background_color: "#f4f7f8",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/lifeos.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,woff2}"]
      }
    })
  ],
  server: { host: "0.0.0.0" }
});
