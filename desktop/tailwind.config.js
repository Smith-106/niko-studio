/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1b1e',
          surface: '#25262b',
          border: '#373a40',
          text: '#c1c2c5',
          'text-secondary': '#909296',
        }
      }
    },
  },
  plugins: [],
}
