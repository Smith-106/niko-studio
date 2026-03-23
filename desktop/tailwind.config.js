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
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        dark: {
          bg: '#0f172a',          // slate-900 (main background)
          surface: '#1e293b',     // slate-800 (panels, bubbles)
          surface2: '#334155',    // slate-700 (hover states)
          border: '#334155',      // slate-700
          border2: '#475569',     // slate-600
          text: '#f8fafc',        // slate-50
          'text-secondary': '#94a3b8', // slate-400
          'text-muted': '#64748b',     // slate-500
        },
        primary: {
          400: '#818cf8',         // indigo-400
          500: '#6366f1',         // indigo-500
          600: '#4f46e5',         // indigo-600
        },
        success: {
          500: '#10b981',         // emerald-500
        },
        warning: {
          500: '#f59e0b',         // amber-500
        },
        danger: {
          500: '#ef4444',         // red-500
        }
      },
      transitionDuration: {
        120: '120ms',
        250: '250ms',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-in-right': 'slideInRight 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        }
      },
    },
  },
  plugins: [],
}
