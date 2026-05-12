import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      /** Deno edge functions — different runtime; lint separately if needed (`deno lint`). */
      "supabase/functions/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      /** Backlog: promote to error during Phase A strictness ladder. */
      "@typescript-eslint/no-explicit-any": "warn",
      /** Require a reason when suppressing TS errors so suppressors are intentional. */
      "@typescript-eslint/ban-ts-comment": ["error", { "minimumDescriptionLength": 10 }],
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      /** Allow console.error and console.warn; ban console.log/debug in production code.
       *  Use src/lib/logger.ts for structured logging, src/lib/debug.ts for dev tracing. */
      "no-console": ["warn", { "allow": ["error", "warn"] }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/hooks/useTasks",
              message: "useTasks() is deprecated. Use useTasksQuery() from @/hooks/useTasksQuery instead. See migration guide in hook JSDoc.",
            },
            {
              name: "@/hooks/useProperties",
              message: "useProperties() is deprecated. Use usePropertiesQuery() from @/hooks/usePropertiesQuery instead.",
            },
            {
              name: "@/hooks/use-assets",
              message: "useAssets() is deprecated. Use useAssetsQuery() from @/hooks/useAssetsQuery instead.",
            },
            {
              name: "@/hooks/use-compliance",
              message: "useCompliance() is deprecated. Use useComplianceQuery() from @/hooks/useComplianceQuery instead.",
            },
            {
              name: "@/hooks/legacy/useTasks",
              message: "Legacy hook. Use useTasksQuery() from @/hooks/useTasksQuery instead.",
            },
            {
              name: "@/hooks/legacy/useProperties",
              message: "Legacy hook. Use usePropertiesQuery() from @/hooks/usePropertiesQuery instead.",
            },
            {
              name: "@/hooks/legacy/use-assets",
              message: "Legacy hook. Use useAssetsQuery() from @/hooks/useAssetsQuery instead.",
            },
            {
              name: "@/hooks/legacy/use-compliance",
              message: "Legacy hook. Use useComplianceQuery() from @/hooks/useComplianceQuery instead.",
            },
            {
              name: "@/hooks/legacy/use-tasks",
              message: "Legacy hook. Use useTasksQuery() from @/hooks/useTasksQuery instead.",
            },
          ],
          patterns: [
            {
              group: ["@/hooks/legacy/*"],
              message: "Legacy hooks are deprecated. Use optimized hooks from @/hooks/use*Query instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tailwind.config.ts", "vite.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
