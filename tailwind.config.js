/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#08090c",
        surface: "#0f1114",
        primary: "#FAFAF7",
        teal: "#00A684",
        red: "#FD361C",
        amber: "#D4A84B",
        green: "#00A684",
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "ui-monospace", "monospace"],
        arabic: ['"Noto Sans Arabic"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
