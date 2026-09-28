import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
      '/latest-alert': 'http://localhost:5000',
      '/video_feed': 'http://localhost:5000',
      '/preview': 'http://localhost:5000',
      '/register': 'http://localhost:5000',
      '/camera': 'http://localhost:5000',
    }
  },
  build: {
    outDir: 'build'
  }
})
