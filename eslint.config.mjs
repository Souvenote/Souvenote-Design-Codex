import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['**/.next/**', '**/coverage/**', '**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['scripts/**/*.mjs', '*.config.mjs'],
    ...eslint.configs.recommended,
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
  eslintConfigPrettier,
];
