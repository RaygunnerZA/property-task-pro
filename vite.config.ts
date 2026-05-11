import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
