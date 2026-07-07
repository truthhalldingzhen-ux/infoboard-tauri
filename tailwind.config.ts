import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-main': 'var(--bg-main)',
        'bg-surface': 'var(--bg-surface)',
        'bg-surface-hover': 'var(--bg-surface-hover)',
        'bg-glass': 'var(--bg-glass)',
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        'accent-hover': 'var(--accent-hover)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-glass': 'var(--border-glass)',
        'shadow-glass': 'var(--shadow-glass)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Geist', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
        glass: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.1)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
      },
      backdropBlur: {
        glass: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
