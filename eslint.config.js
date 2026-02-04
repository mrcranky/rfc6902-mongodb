import js from '@eslint/js';
import mochaPlugin from 'eslint-plugin-mocha';

export default [
    js.configs.recommended,
    mochaPlugin.configs.recommended,
    {
        rules: {
            // Some basic style rules
            'indent': ['error', 4],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'quote-props': ['error', 'consistent'],
        }
    }
];
