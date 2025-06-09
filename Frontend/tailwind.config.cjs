/* eslint-disable global-require */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    './node_modules/flowbite/**/*.js',
  ],

  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7fb',
          100: '#d1e9f4',
          200: '#a4d2e9',
          300: '#78bbdd',
          400: '#4ba3d2',
          500: '#1e8bc6',
          600: '#1773a4',
          700: '#105b82',
          800: '#0a4360',
          900: '#052b3e',
        },
        accent: {
          50: '#fffaf0',
          100: '#feebc8',
          200: '#fbd38d',
          300: '#f6ad55',
          400: '#ed8936',
          500: '#dd6b20',
          600: '#c05621',
          700: '#9c4221',
          800: '#7b341e',
          900: '#652b19',
        },
        brand: {
          darkBlue: '#00538C',
          yellow: '#F6B234',
        },
      },

      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },

      transitionProperty: {
        width: 'width',
      },

      minWidth: {
        kanban: '28rem',
      },
    },
  },

  safelist: [
    'justify-evenly',
    'overflow-hidden',
    'rounded-md',
    'w-64',
    'w-1/2',
    'rounded-l-lg',
    'rounded-r-lg',
    'bg-gray-200',
    'grid-cols-4',
    'grid-cols-7',
    'h-6',
    'leading-6',
    'h-9',
    'leading-9',
    'shadow-lg',
    'bg-opacity-50',
    'dark:bg-opacity-80',
    'grid',
  ],

  plugins: [
    require('flowbite/plugin'),
    require('flowbite-typography'),
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
};

