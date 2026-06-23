/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // DataPulse accent palette.
        pulse: {
          50: "#eef6ff",
          400: "#3b9eff",
          500: "#1a85ff",
          600: "#0f6fe0",
        },
      },
    },
  },
  plugins: [],
};
