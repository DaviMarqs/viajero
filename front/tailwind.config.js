/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8f3',
          100: '#d8efdf',
          300: '#8ed0a5',
          500: '#2f8f5b',
          700: '#1b5d3b',
          900: '#103625',
        },
      },
      boxShadow: {
        panel: '0 18px 45px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
