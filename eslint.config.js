// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactRecommended from "eslint-plugin-react/configs/recommended.js";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended, // Base ESLint recommended rules

  // TypeScript configurations
  ...tseslint.configs.recommendedTypeChecked, // Recommended TS rules requiring type checking
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: true, // Automatically find tsconfig.json
        tsconfigRootDir: import.meta.dirname, // Use the directory of eslint.config.js
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn", // Warn about unused vars
      // Add other TS specific rules here
    },
  },

  // React configurations
  {
    files: ["**/*.{ts,tsx}"], // Apply only to TS/TSX files
    ...reactRecommended, // Spread React recommended rules
    languageOptions: {
      ...reactRecommended.languageOptions, // Include React's language options (parser, parserOptions)
      globals: {
        ...globals.browser, // Add browser globals
      },
    },
    settings: {
      react: {
        version: "detect", // Automatically detect React version
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules, // Apply React Hooks recommended rules
      ...jsxA11y.configs.recommended.rules, // Apply JSX A11y recommended rules
      // Add other React specific rules here
    },
  },

  // Next.js configurations
  {
    files: ["**/*.{js,jsx,ts,tsx}"], // Apply to JS/JSX/TS/TSX files
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Add other Next.js specific rules here
    },
  },

  // Global ignores (optional, but good practice)
  {
    ignores: [
        "node_modules/",
        ".next/",
        "dist/",
        "build/",
        "coverage/",
        "**/*.config.js", // Ignore config files themselves
        "**/*.config.cjs",
        "next-env.d.ts",
        "jest.config.js",
        "jest.polyfills.js",
        "setupTests.js",
        "workers/",
        "scripts/",
        "*.mjs"
       ],
  }
); 