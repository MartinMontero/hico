import tseslint from 'typescript-eslint';

// Data access lives in worker/repositories only (CLAUDE.md, 05 section 4 rule 2).
const rawDb = [
  {
    selector: "MemberExpression[property.name=/^(prepare|batch|dump)$/]",
    message: 'Raw database access belongs in worker/repositories (05 §4 rule 2).',
  },
  {
    selector: "CallExpression[callee.property.name='exec'][callee.object.name=/^(db|DB|database)$/]",
    message: 'Raw database access belongs in worker/repositories (05 §4 rule 2).',
  },
  {
    selector: "MemberExpression[object.name='env'][property.name='DB']",
    message: 'env.DB is only touched in worker/repositories and the request context builder.',
  },
  {
    selector: "Literal[value=/select\\s+\\*/i]",
    message: 'Selecting every column is forbidden: list the columns.',
  },
  {
    selector: 'TemplateElement[value.raw=/select\\s+\\*/i]',
    message: 'Selecting every column is forbidden: list the columns.',
  },
];

export default tseslint.config(
  { ignores: ['spike/**', 'dist/**', 'node_modules/**', '.wrangler/**', 'playwright-report/**', 'test-results/**', 'reference/**', 'public/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-restricted-syntax': ['error', ...rawDb],
    },
  },
  {
    // The only places allowed to touch the database directly.
    files: ['worker/repositories/**/*.ts', 'tests/support/**/*.ts', 'seed/**/*.ts', 'tests/worker/**/*.ts', 'tests/node/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', rawDb[3], rawDb[4]],
    },
  },
);
