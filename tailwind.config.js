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
        // Warm palette: deep teal #264653, cream #F4EDE4, persian green #2A9D8F, coral #E76F51.
        // "blue" is the site's interactive colour, so it is deep persian green here (white text on 600 is 5.7:1).
        blue: { 50:'#EAF6F4',100:'#D2EDE9',200:'#A9DBD4',300:'#7FC7BE',400:'#5CC4B7',500:'#2A9D8F',600:'#1B7268',700:'#155A52',800:'#114842',900:'#0F3A36',950:'#0B2A28' },
        gray: { 50:'#F9F6F1',100:'#F1EBE2',200:'#E2D9CC',300:'#CBC0B0',400:'#8A9EA4',500:'#567078',600:'#3F5A63',700:'#324D57',800:'#264653',900:'#264653',950:'#1A3340' },
        zinc: { 50:'#F6F8F8',100:'#EDF1F2',200:'#DDE5E7',300:'#C3D0D3',400:'#9DB1B6',500:'#6A858D',600:'#456069',700:'#2E4A54',800:'#1B323B',900:'#142830',950:'#0F1E25' },
        coral: { DEFAULT:'#E76F51', dark:'#BF4B31', light:'#FBE3DC' },
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
