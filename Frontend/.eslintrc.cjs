/** @type {import("@types/eslint").Linter.Config} */

module.exports = {
	root: true,

	env: {
		browser: true,
		node: true,
	},

	settings: {
		'import/resolver': {
			typescript: {
				project: ['./tsconfig.json'],
				tsconfigRootDir: __dirname,
				alwaysTryTypes: true,
			},
		},
	},

	overrides: [
		// TypeScript
		{
			files: ['*.ts', '*.mts', '*.cts'],
			parser: '@typescript-eslint/parser',
			parserOptions: {
				project: ['./tsconfig.json'],
				tsconfigRootDir: __dirname,
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
			plugins: ['@typescript-eslint', 'eslint-plugin-tsdoc'],
			extends: [
				'airbnb-base',
				'airbnb-typescript',
				'plugin:@typescript-eslint/recommended',
				'plugin:@typescript-eslint/recommended-requiring-type-checking',
				'plugin:@typescript-eslint/strict',
				'prettier',
			],
			rules: {
				'tsdoc/syntax': 'warn',
				'@typescript-eslint/no-unused-vars': [
					'error',
					{ argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
				],
				'@typescript-eslint/no-non-null-assertion': 'off',
				'max-lines': [
					'warn',
					{ max: 250, skipComments: true, skipBlankLines: true },
				],
				'import/extensions': 'off',
				'import/prefer-default-export': 'off',
				'react/jsx-filename-extension': 'off',
				'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
			},
		},

		// JavaScript
		{
			files: ['*.js', '*.mjs', '*.cjs'],
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
			extends: ['airbnb-base', 'eslint:recommended', 'prettier'],
			rules: {
				'import/prefer-default-export': 'off',
				'no-console': 'off',
			},
		},

		// Astro
		{
			files: ['*.astro'],
			parser: 'astro-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser',
				tsconfigRootDir: __dirname,
				project: ['./tsconfig.json'],
				extraFileExtensions: ['.astro'],
			},
			extends: ['airbnb-base', 'plugin:astro/recommended', 'prettier'],
			rules: {
				'import/no-absolute-path': 'off',
				'import/extensions': 'off',
				'import/no-named-as-default-member': 'off',
				'import/no-named-as-default': 'off',
				'import/prefer-default-export': 'off',
				'import/no-extraneous-dependencies': 'off',
				'import/no-unresolved': [
					'error',
					{
						ignore: ['@astrojs/image/components'],
					},
				],
				'no-undef': 'off',
				'no-unused-vars': ['error', { varsIgnorePattern: 'Props' }],
				'max-lines': [
					'error',
					{ max: 1000, skipComments: true, skipBlankLines: true },
				],
			},
			globals: {
				astroHTML: 'readonly',
			},
		},
		// React / JSX / TSX
		{
			files: ['*.jsx', '*.tsx'],
			parser: '@babel/eslint-parser',
			parserOptions: {
				requireConfigFile: false,
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: {
					jsx: true,
				},
			},
			plugins: ['react'],
			extends: ['plugin:react/recommended'],
			rules: {
				'react/react-in-jsx-scope': 'off', // No necesario con React 17+
				'import/extensions': 'off',
				'import/prefer-default-export': 'off',
			},
		},
	],
};
