import { defineConfig } from "vitest/config";
import path from "path";

// Testlar Next.js build'idan ajratilgan (tsconfig exclude). Vitest ularni alohida yuritadi.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/events/contracts.ts", "src/lib/supabase/**", "src/lib/auth.ts"],
    },
  },
});
