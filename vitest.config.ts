export default {
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/**',
      '**/.ccw/**',
      '**/docs-site/**',
      '**/target/**',
    ],
    testTimeout: 10000,
  },
};
