/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '480px',
      },
      colors: {
        dark: {
          bg: '#1a1b1e',
          surface: '#25262b',
          border: '#373a40',
          text: '#c1c2c5',
          'text-secondary': '#909296',
        }
      },
      transitionDuration: {
        120: '120ms',
      },
      animation: {
        'fade-in': 'fadeIn 120ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
