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
        // Colours come from CSS variables, so a palette can be swapped at runtime (see globals.css and lib/palettes.ts).
        blue: { 50:'rgb(var(--blue-50) / <alpha-value>)', 100:'rgb(var(--blue-100) / <alpha-value>)', 200:'rgb(var(--blue-200) / <alpha-value>)', 300:'rgb(var(--blue-300) / <alpha-value>)', 400:'rgb(var(--blue-400) / <alpha-value>)', 500:'rgb(var(--blue-500) / <alpha-value>)', 600:'rgb(var(--blue-600) / <alpha-value>)', 700:'rgb(var(--blue-700) / <alpha-value>)', 800:'rgb(var(--blue-800) / <alpha-value>)', 900:'rgb(var(--blue-900) / <alpha-value>)', 950:'rgb(var(--blue-950) / <alpha-value>)' },
        gray: { 50:'rgb(var(--gray-50) / <alpha-value>)', 100:'rgb(var(--gray-100) / <alpha-value>)', 200:'rgb(var(--gray-200) / <alpha-value>)', 300:'rgb(var(--gray-300) / <alpha-value>)', 400:'rgb(var(--gray-400) / <alpha-value>)', 500:'rgb(var(--gray-500) / <alpha-value>)', 600:'rgb(var(--gray-600) / <alpha-value>)', 700:'rgb(var(--gray-700) / <alpha-value>)', 800:'rgb(var(--gray-800) / <alpha-value>)', 900:'rgb(var(--gray-900) / <alpha-value>)', 950:'rgb(var(--gray-950) / <alpha-value>)' },
        zinc: { 50:'rgb(var(--zinc-50) / <alpha-value>)', 100:'rgb(var(--zinc-100) / <alpha-value>)', 200:'rgb(var(--zinc-200) / <alpha-value>)', 300:'rgb(var(--zinc-300) / <alpha-value>)', 400:'rgb(var(--zinc-400) / <alpha-value>)', 500:'rgb(var(--zinc-500) / <alpha-value>)', 600:'rgb(var(--zinc-600) / <alpha-value>)', 700:'rgb(var(--zinc-700) / <alpha-value>)', 800:'rgb(var(--zinc-800) / <alpha-value>)', 900:'rgb(var(--zinc-900) / <alpha-value>)', 950:'rgb(var(--zinc-950) / <alpha-value>)' },
        pal: { 'page':'rgb(var(--pal-page) / <alpha-value>)', 'page-dark':'rgb(var(--pal-page-dark) / <alpha-value>)', 'card-dark':'rgb(var(--pal-card-dark) / <alpha-value>)', 'bar-dark':'rgb(var(--pal-bar-dark) / <alpha-value>)', 'card2-dark':'rgb(var(--pal-card2-dark) / <alpha-value>)', 'ink':'rgb(var(--pal-ink) / <alpha-value>)', 'brand':'rgb(var(--pal-brand) / <alpha-value>)', 'brand-dark':'rgb(var(--pal-brand-dark) / <alpha-value>)', 'brand-light':'rgb(var(--pal-brand-light) / <alpha-value>)', 'brand-mid':'rgb(var(--pal-brand-mid) / <alpha-value>)', 'brand-soft':'rgb(var(--pal-brand-soft) / <alpha-value>)', 'brand-pale':'rgb(var(--pal-brand-pale) / <alpha-value>)', 'accent-a':'rgb(var(--pal-accent-a) / <alpha-value>)', 'accent-b':'rgb(var(--pal-accent-b) / <alpha-value>)', 'accent-c':'rgb(var(--pal-accent-c) / <alpha-value>)', 'tint-1':'rgb(var(--pal-tint-1) / <alpha-value>)', 'tint-2':'rgb(var(--pal-tint-2) / <alpha-value>)', 'tint-dark':'rgb(var(--pal-tint-dark) / <alpha-value>)' },
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
