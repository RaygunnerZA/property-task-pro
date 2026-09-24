import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    /** Dual-stack so browsers that resolve `localhost` → `::1` do not get ERR_CONNECTION_REFUSED. */
    host: "::",
    port: 8080,
    /** Fail fast if 8080 is taken — avoids silent fallback to 8081 while the browser still pings 8080. */
    strictPort: true,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("pdfjs-dist")) return "pdfjs";
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "export-pdf";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("/motion/") || id.includes("framer-motion")) return "motion";
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("/react/") ||
            id.includes("\\react\\")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    /** Only app tests; avoids duplicate dependency trees (e.g. `node_modules.nosync`). */
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  },
}));
