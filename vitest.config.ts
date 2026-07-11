import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Vitest runs outside Next.js, where the server-only guard package
      // would throw; stub it so server modules are unit-testable.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
