import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/, so asset paths need that prefix.
  base: '/FInancial-Tracking-System/',
  plugins: [react()],
})
