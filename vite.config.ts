import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/. Relative asset paths work under any
  // repo name, so renaming the repo doesn't break the site.
  base: './',
  plugins: [react()],
})
