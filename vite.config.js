import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // The Three.js board is a deliberate, lazily loaded chunk (~140 kB gzipped).
    chunkSizeWarningLimit: 600,
  },
})
