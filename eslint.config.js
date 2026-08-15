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
      /** Separate Vite app — has its own package.json. */
      "marketing/**",
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
      /**
       * Design token guardrails (Docs 04_UI_System §4.3/§4.5).
       * 1. Arbitrary hex utility classes (text-[#8EC9CE], bg-[#F6F4F2]/90, …) are banned —
       *    use semantic tokens (text-primary, bg-input, …). Hex as *data* (e.g. property
       *    icon colors passed to style props) is still allowed; only class utilities match.
       * 2. Raw Tailwind palette status classes that have a semantic equivalent are banned —
       *    destructive / warning(-vivid|-foreground) / success(-vivid|-foreground) /
       *    primary(-deep) / muted(-foreground) / border tokens. `dark:` variants are
       *    temporarily exempt until dark-mode tokens are audited.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/(?:^|[\\s:'\"`(])(?:[a-z-]+:)*[a-z-]+-\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: "Arbitrary hex utility classes are banned. Use semantic design tokens from tailwind.config.ts (e.g. text-primary, bg-input, text-muted-foreground). See @Docs/04_UI_System.md §4.5.",
        },
        {
          selector: "TemplateElement[value.raw=/(?:^|[\\s:'\"`(])(?:[a-z-]+:)*[a-z-]+-\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: "Arbitrary hex utility classes are banned. Use semantic design tokens from tailwind.config.ts (e.g. text-primary, bg-input, text-muted-foreground). See @Docs/04_UI_System.md §4.5.",
        },
        {
          selector: "Literal[value=/(?<!dark:)\\b(?:(?:bg|text)-red-(?:400|500|600|700|800)|bg-red-50|border-red-200|text-amber-(?:500|600|700|800)|bg-amber-(?:50|100|400|500)|text-yellow-(?:600|700)|bg-yellow-500|border-amber-(?:200|500)|text-green-(?:600|700|800)|text-emerald-(?:600|700)|bg-green-(?:50|100|500)|border-green-200|text-teal-(?:500|600|700|800)|ring-teal-500|bg-teal-(?:50|100|600|700)|border-teal-(?:200|300)|text-gray-(?:500|600|700|800|900)|border-gray-200|bg-neutral-(?:100|200)|text-neutral-(?:500|600|700)|bg-gray-(?:50|100)|text-orange-600|bg-orange-500|border-orange-500)\\b/]",
          message: "Raw Tailwind palette status classes are banned. Use semantic tokens: destructive, warning/warning-vivid/warning-foreground, success/success-vivid/success-foreground, primary/primary-deep, muted-foreground, border. See @Docs/04_UI_System.md §4.5.",
        },
      ],
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
