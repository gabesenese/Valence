import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Surface (dark-first design system)
        surface: {
          0:   '#0a0a0f',
          50:  '#0f0f17',
          100: '#13131e',
          200: '#18182a',
          300: '#1e1e32',
          400: '#252540',
          500: '#2e2e52',
          600: '#3a3a66',
        },
        // Status
        success: {
          DEFAULT: '#10b981',
          muted: '#064e3b',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#451a03',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: '#450a0a',
        },
        info: {
          DEFAULT: '#3b82f6',
          muted: '#1e3a5f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow-brand': '0 0 20px rgba(99, 102, 241, 0.25)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.2)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.2)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
