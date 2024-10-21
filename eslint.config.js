// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylisticJs from '@stylistic/eslint-plugin-js'

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            '@stylistic/js': stylisticJs
        },
        ignores: ['**/build/', '**/dist/', '**/*.d.ts'],
        languageOptions: {
            // parser: parser,
            parserOptions: {
                // project: ['./tsconfig.json', './packages/*/tsconfig.json'],
                projectService: true,
            }
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    "args": "none",
                }
            ],
            "accessor-pairs": [
                "error",
                {
                    "getWithoutSet": false,
                    "setWithoutGet": true
                }
            ],
            "@typescript-eslint/no-this-alias": [
                "off"
            ],
            "@stylistic/js/semi": "error",
            "@stylistic/js/comma-spacing": "error",
            "@stylistic/js/keyword-spacing": "error",
            "@stylistic/js/no-trailing-spaces": "error",
            "@stylistic/js/eol-last": "error",
            "@stylistic/js/space-infix-ops": "error",
            "@stylistic/js/brace-style": "error",
            "@stylistic/js/no-tabs": "error",
            "@stylistic/js/no-mixed-spaces-and-tabs": "error",
            "@stylistic/js/comma-dangle": ["error", {
                "functions": "never",
                "arrays": "never",
                "objects": "never",
                "imports": "never",
                "exports": "never",
            }],
            "getter-return": "error",
            "use-isnan": "error",
            "eqeqeq": "error",
            "no-var": "error",
            "indent": "error",
            "prefer-const": "error",
            "camelcase": "error",
            "block-scoped-var": "error",
        }
    }
];
