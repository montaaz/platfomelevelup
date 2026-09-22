import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    // Même alias que tsconfig : les tests importent « @/… » comme le code.
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
