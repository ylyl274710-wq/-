/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { paper: '#f5f3ec', pine: '#283f35', clay: '#d47753' },
      fontFamily: { sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'] }
    }
  },
  plugins: []
};
