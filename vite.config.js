import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    // This forces Vite to use PostCSS for transforming CSS,
    // preventing LightningCSS from tripping over Tailwind's @apply or custom rules.
    transformer: 'postcss', 
    // Uses esbuild for minification, which is the standard for Vite 
    // and highly compatible with Tailwind's utility classes.
    minify: 'esbuild',      
  }
})