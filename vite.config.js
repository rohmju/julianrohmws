import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The project lives in OneDrive, which turns node_modules/.vite into cloud placeholders that
  // Vite may not delete (EPERM on rmdir). Keep the dependency cache in the system temp folder.
  cacheDir: path.join(os.tmpdir(), 'vite-julianrohmws'),
  build: {
    // The Three.js board is a deliberate, lazily loaded chunk (~140 kB gzipped).
    chunkSizeWarningLimit: 600,
  },
})
