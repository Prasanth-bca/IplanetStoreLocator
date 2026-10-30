/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Indigo / lavender palette from the sign-in page. "blue" is the site's interactive colour (white on 600 is 8:1).
        blue: { 50:'#F1EFFE',100:'#E4E0FC',200:'#C9C2F8',300:'#A89EF2',400:'#8E82EB',500:'#6C5FDC',600:'#4A3DC0',700:'#3A2F9E',800:'#2F2593',900:'#251C75',950:'#181050' },
        gray: { 50:'#F7F6FD',100:'#EEECF9',200:'#DDD9F0',300:'#C2BDE0',400:'#9690BB',500:'#6A6593',600:'#4F4A78',700:'#3B3763',800:'#2A2650',900:'#1F1B45',950:'#15122F' },
        zinc: { 50:'#F7F6FD',100:'#EDEBF8',200:'#DAD7EE',300:'#BFBBE0',400:'#9490BE',500:'#6F6B9C',600:'#4D4980',700:'#35316A',800:'#25214F',900:'#1A1740',950:'#121030' },
        iplanet: {
          blue: "#0071e3",
          dark: "#1d1d1f",
          gray: "#86868b",
          light: "#f5f5f7",
          accent: "#2997ff",
        },
      },
    },
  },
  plugins: [],
};
