module.exports = {
    env: {
        es2021: true,
        node: true,
        mocha: true
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
        // Some basic style rules
        'indent': ['error', 4],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'quote-props': ['error', 'consistent'],
    }
};
