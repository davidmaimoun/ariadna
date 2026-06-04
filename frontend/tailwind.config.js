export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
      colors: {
        bg: { primary:'#f0f5ff', secondary:'#e4edfb', panel:'#ffffff' },
        border: { default:'#93b4f0', subtle:'#c0d4f5', strong:'#5a8ae0' },
        accent: { DEFAULT:'#1a56db', dark:'#0f3fa8', light:'#4a7ac8' },
        text: { primary:'#0f2460', secondary:'#2e50a0', muted:'#5a7ec0' },
      },
    },
  },
  plugins: [],
}
