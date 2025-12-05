import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        // Configure for SSE (Server-Sent Events) streaming
        // SSE requires keep-alive connections and no timeout
        ws: false, // WebSocket not needed for SSE
        // Increase timeout for long-running transcription requests (5 minutes)
        timeout: 300000,
        // Configure proxy to handle streaming responses
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            if (err.code === 'ECONNREFUSED') {
              console.error('⚠️  Backend server is not running!');
              console.error('   Please start the backend server:');
              console.error('   cd youtube-transcript/backend && npm start');
            } else {
              console.error('Proxy error:', err.message);
            }
          });
        },
      }
    }
  }
})
