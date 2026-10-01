import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Serves the Vercel functions in api/ (e.g. /api/chat) from the dev server too, with the variables
// from .env.local, so `npm run dev` works without the Vercel CLI.
function apiRoutes() {
  return {
    name: 'api-routes',
    configureServer(server) {
      Object.assign(process.env, { ...loadEnv(server.config.mode, process.cwd(), ''), ...process.env })
      server.middlewares.use('/api', async (req, res, next) => {
        const name = req.url.split('?')[0].replace(/^\/+|\/+$/g, '')
        if (!/^[a-z0-9-]+$/i.test(name)) return next()
        const file = path.resolve('api', `${name}.js`)
        try {
          // A fresh import each time picks up edits to the handler (not to modules it imports).
          const { default: handler } = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
          await handler(req, res)
        } catch (error) {
          if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes(file)) return next()
          server.config.logger.error(`[api/${name}] ${error.stack ?? error}`)
          if (!res.headersSent) res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiRoutes()],
  // The project lives in OneDrive, which turns node_modules/.vite into cloud placeholders that
  // Vite may not delete (EPERM on rmdir). Keep the dependency cache in the system temp folder.
  cacheDir: path.join(os.tmpdir(), 'vite-julianrohmws'),
  build: {
    // The Three.js board is a deliberate, lazily loaded chunk (~140 kB gzipped).
    chunkSizeWarningLimit: 600,
  },
})
