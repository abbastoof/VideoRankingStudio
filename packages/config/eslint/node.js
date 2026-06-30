/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./base.js'],
  env: { node: true, es2022: true },
  rules: {
    'no-process-env': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    '@typescript-eslint/await-thenable': 'error',
  },
};
