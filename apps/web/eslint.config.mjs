import { FlatCompat } from '@eslint/eslintrc';
import eslintConfigPrettier from 'eslint-config-prettier';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    settings: {
      next: {
        rootDir: import.meta.dirname,
      },
    },
  },
  {
    // The approved prototype remains visually frozen during Section 1. These
    // exceptions isolate known legacy debt while keeping full rules for new
    // routes and modules; Section 4 will split and remediate these components.
    files: ['app/components/**/*.{ts,tsx}', 'app/lib/cognitoAuth.ts'],
    rules: {
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
  eslintConfigPrettier,
];

export default config;
