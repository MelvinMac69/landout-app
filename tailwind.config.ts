import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blm: {
          DEFAULT: '#8B6914',
          light: '#C4A35A',
          dark: '#5C4410',
        },
        fs: {
          DEFAULT: '#2D5016',
          light: '#6B9B4A',
          dark: '#1A3009',
        },
        wilderness: {
          DEFAULT: '#1D4D1D',
          light: '#3A7D3A',
          dark: '#0F2E0F',
        },
        wsa: {
          DEFAULT: '#7B3F00',
          light: '#A66B2A',
          dark: '#4A2500',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
