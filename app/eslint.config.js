import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // designer world modules are verbatim copies (handoff/design-to-app/assets/ch2/world/)
  { ignores: ['dist', 'node_modules', 'src/levels/ch2/world/*.js', 'src/levels/ch2/ui/*.js', 'src/levels/end1/game/*.js', 'src/levels/end2/game/*.js', 'src/levels/end3/game/*.js', 'src/levels/bridge/*.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
