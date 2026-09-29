module.exports = {
  env: { node: true, es2021: true, jest: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'semi': ['error', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'comma-dangle': ['warn', 'always-multiline'],
    'no-trailing-spaces': 'warn',
    'eol-last': ['warn', 'always'],
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/'],
};
