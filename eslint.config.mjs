import { createRequire } from "node:module";

const requireFromCwd = createRequire(`${process.cwd()}/`);
const tsPlugin = requireFromCwd("@typescript-eslint/eslint-plugin");
const tsParser = requireFromCwd("@typescript-eslint/parser");

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/test-results/**",
      "**/.workflow/**",
      "**/.writing/**",
      "**/target/**",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {},
  },
  {
    files: ["**/*.{cjs,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "script",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {},
  },
];
