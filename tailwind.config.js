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
      },
    },
  },
  plugins: [typography],
};
