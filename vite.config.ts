import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mismo proxy que el rewrite de vercel.json: la API de Pokédex Tracker no acepta CORS.
    proxy: {
      '/ptk': {
        target: 'https://pokedextracker.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ptk/, '/api'),
      },
    },
  },
})
