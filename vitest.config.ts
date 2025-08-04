import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.{ts,js}", "**/?(*.)+(test|spec).{ts,js}"],
    testTimeout: 15000,
    globals: true,
  },
});
