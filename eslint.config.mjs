// Flat config for ESLint 10. ESLint searches ancestor directories for a flat
// config, so without this file it picked up an unrelated C:\Users\63960\
// eslint.config.mjs and failed on a missing @eslint/eslintrc import.
//
// Rules mirror the legacy .eslintrc.js, which ESLint 10 no longer reads.
import js from '@eslint/js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'playwright.config.ts',
      'vitest.config.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'server.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-console': 'off',
      // Several catches intentionally swallow non-critical failures
      // (fire-and-forget emails, optional telemetry) and document why.
      'no-empty': ['error', { allowEmptyCatch: true }],
      semi: ['error', 'always'],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],
    },
  },
  {
    // Legacy jest suite kept in src/; not run by vitest but still linted.
    files: ['src/**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
];
