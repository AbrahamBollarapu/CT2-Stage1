/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          DEFAULT: "#0b0c0f",
          surface: "#111218",
          card: "#151823",
          ink: "#e6e8ef",
          "ink-dim": "#a3a7b3",
          primary: "#89b4ff",
          accent: "#7ee787"
        }
      },
      boxShadow: {
        soft: "0 6px 24px rgba(0,0,0,.25)"
      },
      borderRadius: { "2xl": "1rem" }
    },
  },
  plugins: [],
};
