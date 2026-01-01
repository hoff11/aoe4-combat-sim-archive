import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// eslint.config.js
export default [
  // Ignore build artifacts
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**'],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended (fast, non-type-aware)
  ...tseslint.configs.recommended,

  // Node scripts (mjs): allow process/console; use node globals
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },

  // App TS/TSX
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Vite + React refresh best practice
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Practical defaults for your codebase
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // IMPORTANT: parsing AoE data/JSON is messy—allow `any` ONLY in data layer
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Data layer: allow controlled `any` during parsing/adapting
  {
    files: ['src/data/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // UI layer: keep strict (but we can relax if you want)
  {
    files: ['src/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    files: ['api/**/*.js', 'api/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      // server code can safely ignore unused error vars
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]
