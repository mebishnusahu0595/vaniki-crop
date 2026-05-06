/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0faf5',
          100: '#dcf4e8',
          200: '#b9e9d1',
          300: '#84d4b0',
          400: '#52B788',
          500: '#2D6A4F',
          600: '#1b4d3a',
          700: '#143d2e',
          800: '#0d2f23',
          900: '#082018',
        },
        offwhite: '#F8FAF9',
      },
      fontFamily: {
        sans: ['System'],
      },
      boxShadow: {
        soft: '0px -6px 18px rgba(8, 32, 24, 0.08)',
      },
    },
  },
  plugins: [],
};
