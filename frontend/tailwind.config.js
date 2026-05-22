/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // support dark/light modes
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      keyframes: {
        flashGreen: {
          '0%': { backgroundColor: 'rgba(16, 185, 129, 0.25)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' },
          '100%': { backgroundColor: 'transparent', boxShadow: 'none' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(244, 63, 94, 0.25)', boxShadow: '0 0 15px rgba(244, 63, 94, 0.2)' },
          '100%': { backgroundColor: 'transparent', boxShadow: 'none' },
        }
      },
      animation: {
        'flash-green': 'flashGreen 0.8s ease-out forwards',
        'flash-red': 'flashRed 0.8s ease-out forwards',
      }
    },
  },
  plugins: [],
}
