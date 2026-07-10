import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          0:   'rgb(var(--surface-0) / <alpha-value>)',
          50:  'rgb(var(--surface-50) / <alpha-value>)',
          100: 'rgb(var(--surface-100) / <alpha-value>)',
          200: 'rgb(var(--surface-200) / <alpha-value>)',
          300: 'rgb(var(--surface-300) / <alpha-value>)',
          400: 'rgb(var(--surface-400) / <alpha-value>)',
          500: 'rgb(var(--surface-500) / <alpha-value>)',
          600: 'rgb(var(--surface-600) / <alpha-value>)',
        },
        slate: {
          50:  'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
        },
        fg: 'rgb(var(--fg) / <alpha-value>)',
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          muted: '#064e3b',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          muted: '#451a03',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          muted: '#450a0a',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          muted: '#1e3a5f',
        },
        amber: {
          300: 'rgb(var(--amber-300) / <alpha-value>)',
          400: 'rgb(var(--amber-400) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'monospace'],
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
        'card': 'var(--shadow-card)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'rise-in': 'riseIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'logo-pulse': 'logoPulse 1.1s cubic-bezier(0.16, 1, 0.3, 1) 1',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        riseIn: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        logoPulse: {
          '0%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(129,140,248,0))' },
          '45%': { transform: 'scale(1.18)', filter: 'drop-shadow(0 0 10px rgba(129,140,248,0.7))' },
          '100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(129,140,248,0))' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
