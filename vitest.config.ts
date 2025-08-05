import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Add your path aliases here if needed
      "@": resolve(__dirname, "./"),
      "~": resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.{ts,js}", "**/?(*.)+(test|spec).{ts,js}"],
    testTimeout: 15000,
    globals: true,
  },
});
