/** @type {import('tailwindcss').Config} */
export default {
  // Glob patterns are resolved relative to this config file, so climb one
  // level back up to the repo root.
  content: ["../src/client/**/*.{ts,tsx,html}"],
  theme: { extend: {} },
  plugins: [],
};
