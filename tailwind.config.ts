import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "var(--font-noto-thai)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "var(--font-noto-thai)", "sans-serif"],
      },
      colors: {
        // Brand palette -- planning-docs/2.สรุปแนวคิดแบรนด์ SecondServe.docx §10.
        // 900 Deep Green (headings/logo), 800 Forest Green (nav/buttons),
        // 100 Light Green (cards), 50 Soft Green (backgrounds).
        forest: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
          800: "#166534",
          900: "#14532D",
        },
        // Leaf Green -- accents / highlights (600 is the brand value).
        leaf: {
          50: "#F7FEE7",
          100: "#ECFCCB",
          500: "#84CC16",
          600: "#65A30D",
          700: "#4D7C0F",
        },
        // Brand Orange (#F97316 = Tailwind orange-500) is used via the built-in
        // `orange-*` scale for prices, discounts and call-to-action highlights.
      },
    },
  },
  plugins: [],
};
export default config;
