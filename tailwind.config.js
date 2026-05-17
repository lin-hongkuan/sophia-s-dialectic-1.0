import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', '"Noto Serif SC"', '"Songti SC"', '"STSong"', '"SimSun"', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      colors: {
        museum: {
          50: '#F9F8F6',
          100: '#F2F0EB',
          200: '#E6E2D8',
          300: '#D1CCC0',
          400: '#A89F91',
          500: '#8A8175',
          600: '#6E665A',
          700: '#5B5246',
          800: '#4A463F',
          900: '#2C2A26',
        },
      },
      animation: {
        'chip-in': 'chip-in 0.4s ease-out both',
        'section-in': 'section-in 0.5s ease-out both',
        'lift-in': 'lift-in 0.55s cubic-bezier(0.22,1,0.36,1) both',
        'progress-shimmer': 'progress-shimmer 2.4s linear infinite',
      },
      keyframes: {
        'chip-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'section-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'lift-in': {
          from: { opacity: '0', transform: 'translateY(14px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'progress-shimmer': {
          '0%':   { transform: 'translateX(-130%)' },
          '100%': { transform: 'translateX(330%)' },
        },
      },
      boxShadow: {
        'museum-soft': '0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 30px -18px rgba(44,42,38,0.18)',
        'museum-lift': '0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 36px -18px rgba(44,42,38,0.28)',
        'museum-press': 'inset 0 2px 6px rgba(44,42,38,0.12)',
      },
    },
  },
  plugins: [typography],
};
