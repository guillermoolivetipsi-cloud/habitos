import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// `base` relativo: la misma compilación sirve en el navegador y dentro de la app de Android (Capacitor).
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { environment: "node" },
});
