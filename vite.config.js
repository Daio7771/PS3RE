import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Momento de compilación (en desarrollo, el de arranque del servidor).
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
});
