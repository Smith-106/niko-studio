import { createRequire } from "node:module";

const requireFromCwd = createRequire(`${process.cwd()}/`);
const tsPlugin = requireFromCwd("@typescript-eslint/eslint-plugin");
const tsParser = requireFromCwd("@typescript-eslint/parser");
const sharedBugRules = {
  "no-constant-binary-expression": "warn",
  "no-debugger": "error",
  "no-irregular-whitespace": "error",
  "no-self-compare": "error",
  "no-sparse-arrays": "error",
  "no-template-curly-in-string": "error",
  "no-unsafe-optional-chaining": "error",
  "no-unreachable": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
};

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
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
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
    rules: sharedBugRules,
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
    rules: sharedBugRules,
  },
];
