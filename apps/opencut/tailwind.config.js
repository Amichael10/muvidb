/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        muvi: {
          bg: '#0e0f11',
          panel: '#16181c',
          panel2: '#1c1f24',
          accent: '#ff5c00',
          brand: '#fc4d04',
          danger: '#ff647c',
          muted: '#9aa3ab',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        phone: '0 28px 90px rgba(0,0,0,0.55)',
        soft: '0 8px 28px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
