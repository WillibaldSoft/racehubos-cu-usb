import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['node_modules/**', '.test-addons/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  { files: ['**/*.jsx'], rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }] } },
];
