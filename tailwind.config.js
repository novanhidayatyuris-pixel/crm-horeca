/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#14213D",
          navyDark: "#1c2d54",
          gold: "#F2A104",
        },
      },
    },
  },
  plugins: [],
};
