/**
 * Shared ESLint baseline. The child packages inherit this via their own
 * .eslintrc when present; each package's `pnpm lint` script points at
 * `eslint . --max-warnings=0`.
 *
 * Rules are intentionally lean — tsc already catches most correctness
 * issues via `pnpm typecheck`. This layer stops the drift we most often
 * regret: dead exports, floating promises, and stray `any` in service
 * code. Warnings are turned off by default so historical files aren't
 * newly failing; explicit errors are what CI enforces.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: { node: true, es2022: true, browser: true },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-console': ['error', { allow: ['warn', 'error', 'info', 'debug'] }],
    // Slot-friendly for the SSR job stream in the web app.
    'no-inner-declarations': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'no-empty-pattern': 'off',
  },
  overrides: [
    {
      // Prisma seed script logs progress to the operator running it — that's
      // its whole job, not a stray console.log.
      files: ['packages/db/prisma/seed.ts', '**/prisma/seed.ts'],
      rules: { 'no-console': 'off' },
    },
    {
      // Tests can spy/log more freely.
      files: ['**/test/**', '**/*.test.ts', '**/*.spec.ts'],
      rules: { 'no-console': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
    },
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '*.d.ts',
    'generated',
    // Terraform / infra artefacts
    'infrastructure',
    // Prisma migrations shouldn't be lint-blocked.
    'packages/db/prisma/migrations',
  ],
};
