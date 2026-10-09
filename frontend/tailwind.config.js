/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#090d10',
        panel: '#12181c',
        phantom: '#39f5ff',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Arial Black', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
