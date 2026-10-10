/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#080E0D',
        surface: '#14201B',
        primary: '#A3E635',
        secondary: '#22C55E',
        foreground: '#E5F7E7',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Arial Black', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
