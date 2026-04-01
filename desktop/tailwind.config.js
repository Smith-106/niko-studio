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
        // Backward-compatible aliases (hardcoded values for opacity modifier support)
        dark: {
          bg: '#0f172a',
          surface: '#1e293b',
          surface2: '#334155',
          border: '#334155',
          border2: '#475569',
          text: '#f8fafc',
          'text-secondary': '#94a3b8',
          'text-muted': '#64748b',
        },
        primary: {
          400: '#9b7ae1',
          500: '#7240dd',
          600: '#4808d1',
        },
        success: {
          500: '#10b981',
        },
        warning: {
          500: '#f59e0b',
        },
        danger: {
          500: '#ef4444',
        },
        // Semantic token colors via CSS variables
        surface: {
          base: 'var(--surface-base)',
          elevated: 'var(--surface-elevated)',
          sunken: 'var(--surface-sunken)',
        },
        cta: {
          DEFAULT: 'var(--primary-cta)',
          hover: 'var(--primary-cta-hover)',
          active: 'var(--primary-cta-active)',
        },
        txt: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
      },
      boxShadow: {
        tiny: 'var(--shadow-tiny)',
        DEFAULT: 'var(--shadow-default)',
        card: 'var(--shadow-card)',
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        pill: '20px',
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
