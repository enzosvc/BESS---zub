/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#12183C',   // navy da marca ZUB
        accent: '#47D73D',    // verde da marca ZUB
      },
    },
  },
  plugins: [],
};
