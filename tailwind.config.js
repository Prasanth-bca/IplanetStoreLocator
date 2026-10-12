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
