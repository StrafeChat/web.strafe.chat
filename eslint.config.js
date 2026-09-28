// ESLint for the Solid client.
//
// The Solid plugin is the point of this config: a Solid component body runs exactly once,
// so a `props.x ? a : b` or a signal read outside JSX/an effect silently freezes at its
// first value. That class of bug is invisible to tsc and was found by hand more than once
// (FieldError never showed an error that appeared after mount). These rules catch it
// mechanically.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/typescript';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'public/', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ...solid,
    languageOptions: {
      ...solid.languageOptions,
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...solid.rules,
      // Unused-arg underscores are the convention here.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // `any` is used deliberately at the wasm boundary and marked with a comment each time.
      '@typescript-eslint/no-explicit-any': 'off',
      // A rendering-cost hint, not a correctness rule: `.map` over a fixed seven-day header
      // or a three-state toggle recreates a handful of static nodes. Worth knowing, not
      // worth failing the build over.
      'solid/prefer-for': 'warn',
    },
  }
);
