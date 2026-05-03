import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "chat-bg": "#f5f5f5",
        "bubble-axis": "#ffffff",
        "bubble-user": "#dcf8c6",
      },
      keyframes: {
        "dot-bounce": {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-6px)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "dot-bounce": "dot-bounce 1.2s infinite",
        "fade-in": "fade-in 200ms ease-in forwards",
        "fade-out": "fade-out 200ms ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
