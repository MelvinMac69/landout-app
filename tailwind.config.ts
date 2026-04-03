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
        landout: {
          sand: { DEFAULT: '#E8DCC8', light: '#F5EFE3', dark: '#C9B99A' },
          forest: { DEFAULT: '#1B3D2F', light: '#2D5A45', dark: '#0F2520' },
          aviation: { DEFAULT: '#D4621A', light: '#E8844A', dark: '#A34D14' },
          charcoal: { DEFAULT: '#2D3748', light: '#4A5568', dark: '#1A202C' },
        },
        // Legacy aliases — mapped to Landout palette
        blm: { DEFAULT: '#C9B99A', light: '#E8DCC8', dark: '#C9B99A' },
        fs: { DEFAULT: '#1B3D2F', light: '#2D5A45', dark: '#0F2520' },
        wilderness: { DEFAULT: '#0F2520', light: '#2D5A45', dark: '#0F2520' },
        wsa: { DEFAULT: '#D4621A', light: '#E8844A', dark: '#A34D14' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
