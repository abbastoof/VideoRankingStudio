const base = require('@vrs/config/tailwind/base.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: ['./src/**/*.{ts,tsx}'],
};
