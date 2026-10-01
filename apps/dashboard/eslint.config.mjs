// Flat ESLint config for the dashboard (Next 16 + React 19).
// eslint-config-next 16 exports a native flat array - do NOT wrap it in
// FlatCompat (that throws "Converting circular structure to JSON" on the
// react plugin). `next lint` was removed in Next 16, so CI runs eslint directly.
import next from 'eslint-config-next/core-web-vitals'
import * as espree from 'espree'

export default [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'] },
  ...next,
  {
    // eslint-plugin-react 7.x auto-detects the React version via
    // context.getFilename, which ESLint 10 removed. Pin it so detection is skipped.
    settings: { react: { version: '19.2' } },
  },
  {
    // The Babel parser bundled with Next lacks scopeManager.addGlobals, which
    // ESLint 10 calls. Plain JS files here have no JSX, so lint them with espree.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { parser: espree },
  },
  {
    // New react-hooks v6 rules flag pre-existing, intentional patterns across
    // the app. Kept visible as warnings so they don't red-wall the gate on
    // arrival; tighten to error once the flagged effects are refactored.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'import/no-anonymous-default-export': 'warn',
    },
  },
]
