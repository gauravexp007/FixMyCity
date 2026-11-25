/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: { 50:'#f0f4fa',100:'#d9e2f2',200:'#b3c5e6',300:'#8da8d9',400:'#668bcc',500:'#406ec0',600:'#1e3a5f',700:'#172d4a',800:'#0f2035',900:'#081420',950:'#040a10' },
        tealbrand: { 50:'#effefb',100:'#c7fff2',200:'#90ffe5',300:'#51f7d4',400:'#1de4bf',500:'#05c8a5',600:'#00a187',700:'#05806d',800:'#0a6558',900:'#0d5449' },
        // Neutral grey surfaces for dark mode (no blue cast).
        carbon: { 50:'#f6f6f7',100:'#ececee',200:'#d8d9dc',300:'#bfc0c4',400:'#9b9ca2',500:'#73747b',600:'#56575e',700:'#3f4046',800:'#2a2b30',900:'#1b1c20',950:'#131418' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { 'card': '0 1px 3px rgba(15,32,53,0.04), 0 8px 24px rgba(15,32,53,0.04)', 'card-hover': '0 4px 12px rgba(15,32,53,0.08), 0 16px 32px rgba(15,32,53,0.06)' },
    },
  },
  plugins: [],
};
