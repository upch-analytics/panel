import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base совпадает с именем репозитория на GitHub Pages: https://upch-analytics.github.io/panel/
export default defineConfig({
  base: '/panel/',
  plugins: [react(), tailwindcss()],
})
