import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://irsforge.com',
  integrations: [mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  trailingSlash: 'never',
})
