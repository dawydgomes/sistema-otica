import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host: true permite abrir no celular pela rede local (http://IP-DO-PC:5173)
  server: { host: true },
});
