/* Root ESLint config (ESLint 8, classic). Fast, non-type-aware. */
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '**/*.config.ts',
    '**/*.config.js',
    'web/src/vite-env.d.ts',
    'server/prisma/migrations/',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': 'off',
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['web/src/**/*.{ts,tsx}'],
      env: { browser: true },
      plugins: ['react-hooks'],
      extends: ['plugin:react-hooks/recommended'],
    },
    {
      files: ['server/tests/**/*.ts', 'web/src/**/*.test.{ts,tsx}', 'web/src/test/**/*'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
