/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f1f5f9', 100: '#e2e8f0', 200: '#cbd8e6', 300: '#9db3cc',
          400: '#5f7fa6', 500: '#3b5a80', 600: '#24466e', 700: '#1e3a5f',
          800: '#152b47', 900: '#0f2037', 950: '#0a1626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
