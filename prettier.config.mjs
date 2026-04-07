/** @type {import('prettier').Config} */
const config = {
  printWidth: 100,
  trailingComma: "all",
  overrides: [
    {
      files: "desktop/**/*.{ts,tsx,js,cjs,mjs}",
      options: {
        singleQuote: true,
        semi: false,
      },
    },
    {
      files: "src-ts/**/*.{ts,tsx,mts,js,cjs,mjs}",
      options: {
        singleQuote: true,
        semi: true,
      },
    },
    {
      files: "*.json",
      options: {
        trailingComma: "none",
      },
    },
  ],
};

export default config;
