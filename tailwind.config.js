/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A73E8',
          hover: '#1557B0',
          light: '#E8F0FE',
        },
        surface: '#FFFFFF',
        background: '#F8F9FA',
        'text-primary': '#202124',
        'text-secondary': '#5F6368',
      },
      boxShadow: {
        map: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        'map-lg': '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
};
