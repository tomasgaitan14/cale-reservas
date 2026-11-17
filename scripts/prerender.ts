import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Render the same public component at build time. Effects (Auth, database reads,
// animation timers) never run, so no account or customer data enters this file.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { LandingScreen } = await server.ssrLoadModule('/src/screens/LandingScreen.tsx')
  const markup = renderToStaticMarkup(createElement('div', { className: 'natural-theme' }, createElement(LandingScreen)))
  const template = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
  if (!template.includes('<div id="root"></div>')) throw new Error('Missing prerender placeholder')
  await writeFile(new URL('../dist/home.html', import.meta.url), template.replace('<div id="root"></div>', '<div id="root">' + markup + '</div>'))
  const production = process.env.VERCEL_ENV === 'production'
  await writeFile(new URL('../dist/robots.txt', import.meta.url), production
    ? 'User-agent: *\nAllow: /\n\nSitemap: https://cale.com.ar/sitemap.xml\n'
    : 'User-agent: *\nDisallow: /\n')
  await writeFile(new URL('../dist/sitemap.xml', import.meta.url), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + (production ? '<url><loc>https://cale.com.ar/</loc></url>' : '') + '</urlset>\n')
  console.log('Public home rendered. Private application shell kept separate.')
} finally {
  await server.close()
}
