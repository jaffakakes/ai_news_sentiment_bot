import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    // All financial math must share one Decimal configuration (precision,
    // rounding). Import from @/lib/sim/decimal, never decimal.js directly.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/sim/decimal.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "decimal.js",
              message:
                "Import { D, Decimal } from '@/lib/sim/decimal' so precision and rounding stay uniform.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
