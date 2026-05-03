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
          800: '#4A463F',
          900: '#2C2A26',
        },
      },
    },
  },
  plugins: [typography],
};
