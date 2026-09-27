import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// RMAlbum runs fully client-side. No backend, no proxy.
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443 },
  },
});
